/**
 * Ejercita `src/lib/limites.ts` de punta a punta. Ver D-201.
 *
 *   npm run limites
 *
 * POR QUE EXISTE. `ContadorUpstash` llevaba desde D-123 con este comentario
 * encima: «⚠️ SIN PROBAR CONTRA UN REDIS REAL … hasta que corra contra Upstash
 * de verdad esto es codigo no ejercitado, y el proyecto no acostumbra creerle a
 * codigo no ejercitado». Es el contador que protege la cuota en producción, o
 * sea la defensa que R6 pide tener **antes** de compartir el link.
 *
 * NO HACE FALTA UPSTASH. Lo que hay que comprobar no es Redis —que funciona— sino
 * NUESTRO lado: que el pipeline REST lleve los comandos correctos, que la
 * respuesta se lea bien, y sobre todo **que los tres modos de fallo caigan a
 * memoria en vez de tumbar el sitio o abrir la puerta**. Todo eso se ejercita
 * contra un servidor local que habla el mismo protocolo, sin red, sin claves y
 * sin cuenta — por eso esto sí puede correr en CI.
 *
 * Sale con código 1 si algo falla.
 */

import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import {
  ContadorUpstash, ContadorMemoria, Limitador, identidad, ipDe, LIMITES,
  limitesDelEntorno, verificarTurnstile, contadorDelEntorno, sospechosa,
} from "../src/lib/limites.js";

let fallos = 0;
let corridas = 0;

function comprobar(nombre: string, condicion: boolean, detalle = ""): void {
  corridas++;
  if (condicion) { console.log(`  ok   ${nombre}`); return; }
  fallos++;
  console.log(`  FALLA ${nombre}${detalle ? ` — ${detalle}` : ""}`);
}

/**
 * Un Upstash de mentira. `modo` decide qué devuelve, que es lo único que hace
 * falta variar para recorrer los caminos de fallo.
 */
type Modo = "ok" | "error500" | "basura" | "lento";

interface Falso {
  server: Server;
  url: string;
  /** Los cuerpos que recibió, para comprobar QUE se mandó y no sólo qué volvió. */
  pedidos: unknown[][];
  cerrar: () => Promise<void>;
}

async function levantar(modo: Modo): Promise<Falso> {
  const pedidos: unknown[][] = [];
  const contadores = new Map<string, number>();
  const server = createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (c) => { cuerpo += c; });
    req.on("end", async () => {
      try { pedidos.push(JSON.parse(cuerpo)); } catch { pedidos.push([]); }
      if (modo === "error500") { res.writeHead(500).end("boom"); return; }
      if (modo === "basura") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify([{ result: "no soy un número" }]));
        return;
      }
      if (modo === "lento") {
        // Más que el AbortSignal.timeout(2000) del contador.
        await new Promise((r) => setTimeout(r, 3000));
      }
      const cmds = JSON.parse(cuerpo) as [string, string, ...string[]][];
      const clave = cmds[0]?.[1] ?? "";
      const n = (contadores.get(clave) ?? 0) + 1;
      contadores.set(clave, n);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ result: n }, { result: 1 }]));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    server, pedidos, url: `http://127.0.0.1:${port}`,
    cerrar: () => new Promise((r) => { server.close(() => r()); }),
  };
}

console.log(`\n# Control de abuso — ${new Date().toISOString().slice(0, 10)}\n`);

// ---------------------------------------------------------------------------
console.log(`## La identidad del visitante\n`);

{
  /**
   * ⚠ UNA SAL QUE NO ES SECRETA NO ES UNA SAL. Ver D-247. El modo de fallo real
   * fue pegar en Vercel **el comando en vez de su resultado**: eso deja una sal
   * fija y pública, con la que los 2^32 hashes de IPv4 se tabulan en segundos.
   * No fallaba nada — andaba igual, en silencio.
   */
  comprobar("el comando pegado en vez de su resultado se rechaza",
            sospechosa("openssl rand -hex 32") !== null,
            "es el error que de verdad se cometió");
  comprobar("una sal corta se rechaza", sospechosa("abc123") !== null);
  comprobar("una sal con espacios se rechaza", sospechosa("mi sal secreta larga de 32+ caracteres") !== null);
  comprobar("un `openssl rand -hex 32` de verdad se acepta",
            sospechosa("7f861b88328859cbf14e04b76a9b2a6d484b66dff71d5859a3fcf1348514b013") === null);
  comprobar("una passphrase larga sin espacios se acepta",
            sospechosa("EsteEsUnSecretoLargoQueNoEsHexadecimalPeroSirve") === null,
            "no se exige hexadecimal: se exige que sea secreta y larga");
  comprobar("32 caracteres justos se aceptan", sospechosa("a".repeat(32)) === null);
  comprobar("31 caracteres no", sospechosa("a".repeat(31)) !== null);
}

{
  const ip = "203.0.113.7";
  const id = identidad(ip, "sal-de-prueba");
  comprobar("el hash no contiene la IP", !id.includes("203") && !id.includes("113"));
  comprobar("es estable con la misma sal", id === identidad(ip, "sal-de-prueba"));
  comprobar("cambia con otra sal", id !== identidad(ip, "otra-sal"),
            "sin esto la sal no protegería nada");
  comprobar("dos IPs no colisionan", id !== identidad("203.0.113.8", "sal-de-prueba"));
  comprobar("mide 16 caracteres", id.length === 16);
}

{
  /**
   * ⚠ LA PRIMERA ENTRADA, no la última: las siguientes son los proxies, y
   * quedarse con la última daría un solo cubo para todo el mundo — o sea el
   * limitador apagado sin que nada falle.
   */
  const h = new Headers({ "x-forwarded-for": "198.51.100.9, 10.0.0.1, 10.0.0.2" });
  comprobar("x-forwarded-for: se toma la del cliente", ipDe(h) === "198.51.100.9", ipDe(h));
  comprobar("cae a x-real-ip", ipDe(new Headers({ "x-real-ip": "192.0.2.5" })) === "192.0.2.5");
  comprobar("sin cabeceras no rompe", ipDe(new Headers()) === "desconocida");
}

// ---------------------------------------------------------------------------
console.log(`\n## El contador en memoria\n`);

{
  const c = new ContadorMemoria();
  const vals: number[] = [];
  for (let i = 0; i < 3; i++) vals.push(await c.incr("k", 60));
  comprobar("incrementa desde 1", vals.join(",") === "1,2,3", vals.join(","));
  comprobar("claves distintas no se pisan", await c.incr("otra", 60) === 1);
  // Ventana de 0 s: la entrada nace vencida, así que el siguiente vuelve a 1.
  await c.incr("efimera", 0);
  comprobar("una ventana vencida reinicia", await c.incr("efimera", 0) === 1);
}

// ---------------------------------------------------------------------------
console.log(`\n## El contador de Upstash, contra un servidor que habla su protocolo\n`);

{
  const f = await levantar("ok");
  const c = new ContadorUpstash(f.url, "token-de-prueba");
  const vals: number[] = [];
  for (let i = 0; i < 3; i++) vals.push(await c.incr("ip:h:abc", 3600));
  comprobar("devuelve el valor nuevo", vals.join(",") === "1,2,3", vals.join(","));

  const primero = f.pedidos[0] as [string, ...string[]][];
  comprobar("manda INCR y EXPIRE en un pipeline", primero?.length === 2, JSON.stringify(primero));
  comprobar("INCR sobre la clave pedida",
            primero?.[0]?.[0] === "INCR" && primero?.[0]?.[1] === "ip:h:abc");
  /**
   * `NX` es lo que hace que la ventana NO se renueve con cada pedido. Sin él,
   * quien pega sin parar empuja el vencimiento hacia adelante para siempre y el
   * cupo horario nunca se cierra: el limitador contaría bien y no limitaría.
   */
  comprobar("EXPIRE con NX y la ventana correcta",
            primero?.[1]?.[0] === "EXPIRE" && primero?.[1]?.[2] === "3600" &&
            primero?.[1]?.[3] === "NX", JSON.stringify(primero?.[1]));
  await f.cerrar();
}

console.log(`\n## Los tres modos de fallo: caer a memoria, nunca abrir ni tumbar\n`);

for (const modo of ["error500", "basura"] as const) {
  const f = await levantar(modo);
  const c = new ContadorUpstash(f.url, "t");
  const a = await c.incr("k", 60);
  const b = await c.incr("k", 60);
  comprobar(`${modo}: sigue contando en memoria`, a === 1 && b === 2, `${a},${b}`);
  await f.cerrar();
}

{
  // Servidor caído: nada escuchando en ese puerto.
  const f = await levantar("ok");
  const url = f.url;
  await f.cerrar();
  const c = new ContadorUpstash(url, "t");
  const a = await c.incr("k", 60);
  comprobar("sin servidor: cae a memoria", a === 1, String(a));
}

{
  const f = await levantar("lento");
  const c = new ContadorUpstash(f.url, "t");
  const t0 = Date.now();
  const a = await c.incr("k", 60);
  const ms = Date.now() - t0;
  comprobar("timeout a los ~2 s y cae a memoria", a === 1 && ms < 2900, `${a} en ${ms} ms`);
  await f.cerrar();
}

// ---------------------------------------------------------------------------
/**
 * POR QUE ESTA SECCION EXISTE. El fallo que cubre no es un bug de codigo: es que
 * **el nombre de las variables lo elige Vercel, no nosotros**. Agregando la base
 * desde su Marketplace, las credenciales llegan como `KV_REST_API_*`; copiandolas
 * a mano desde Upstash, como `UPSTASH_REDIS_REST_*`. Leer un solo juego hacia que
 * el camino de dos clics dejara el limitador en memoria sin ningun sintoma.
 *
 * Se prueba la SELECCION, no la conexion: que cada juego de nombres devuelva un
 * contador compartido, que falten-los-dos devuelva el de memoria, y que medio
 * juego —el error tipico de copiar y pegar— no se tome por bueno.
 */
console.log(`\n## De donde saca las credenciales de la base compartida\n`);

{
  const esUpstash = (c: unknown) => c instanceof ContadorUpstash;
  const U = "https://x.upstash.io", T = "tok";

  comprobar("nombres de Upstash: usa la base",
    esUpstash(contadorDelEntorno({ UPSTASH_REDIS_REST_URL: U, UPSTASH_REDIS_REST_TOKEN: T })));

  comprobar("nombres que inyecta Vercel: usa la base",
    esUpstash(contadorDelEntorno({ KV_REST_API_URL: U, KV_REST_API_TOKEN: T })));

  comprobar("los dos juegos a la vez: no rompe",
    esUpstash(contadorDelEntorno({
      UPSTASH_REDIS_REST_URL: U, UPSTASH_REDIS_REST_TOKEN: T,
      KV_REST_API_URL: "https://otro.upstash.io", KV_REST_API_TOKEN: "otro",
    })));

  comprobar("sin nada: cae a memoria",
    contadorDelEntorno({}) instanceof ContadorMemoria);

  comprobar("media credencial no cuenta como credencial",
    contadorDelEntorno({ KV_REST_API_URL: U }) instanceof ContadorMemoria);

  comprobar("cadena vacia no cuenta como credencial",
    contadorDelEntorno({ UPSTASH_REDIS_REST_URL: "  ", UPSTASH_REDIS_REST_TOKEN: T })
      instanceof ContadorMemoria);
}

// ---------------------------------------------------------------------------
console.log(`\n## El limitador\n`);

{
  const lim = new Limitador(new ContadorMemoria());
  const id = "visitante";
  let corte = 0;
  for (let i = 1; i <= 40; i++) {
    const v = await lim.porVisitante(id);
    if (!v.permite) { corte = i; break; }
  }
  /**
   * EL 31, NO EL 30: el contador incrementa PRIMERO y compara después, así que
   * el pedido 30 es el último permitido. Es a propósito —evita la carrera entre
   * leer y escribir que dos pedidos simultáneos ganarían los dos— y por eso el
   * número exacto se fija acá.
   */
  comprobar(`corta en el pedido 31 (cupo ${LIMITES.ipHora}/hora)`, corte === 31, `cortó en ${corte}`);
  const v = await lim.porVisitante(id);
  comprobar("el motivo es ip_hora", v.motivo === "ip_hora", String(v.motivo));
  comprobar("trae Retry-After", v.esperaSegundos === 3600, String(v.esperaSegundos));
  comprobar("otro visitante no arrastra el corte",
            (await lim.porVisitante("otro")).permite);
}

{
  const lim = new Limitador(new ContadorMemoria());
  comprobar("turno 20 pasa", lim.limiteDeTurnos(20).permite);
  comprobar("turno 21 corta", !lim.limiteDeTurnos(21).permite);
  comprobar("sin turno declarado pasa", lim.limiteDeTurnos(undefined).permite,
            "el cliente puede no mandarlo; los otros límites no dependen de él");
}

{
  /**
   * EL PRESUPUESTO CUENTA GENERACIONES, NO PEDIDOS, y eso es lo que hace que la
   * caché N0 signifique algo (D-112): la portada sigue respondiendo con el
   * presupuesto agotado porque nunca llama al LLM. Acá se comprueba el número:
   * con tope 3, la cuarta generación corta.
   */
  const lim = new Limitador(new ContadorMemoria(), { ...LIMITES, globalDia: 3 });
  const res: boolean[] = [];
  for (let i = 0; i < 4; i++) res.push((await lim.presupuestoDiario()).permite);
  comprobar("el presupuesto diario corta en la 4ª con tope 3",
            res.join(",") === "true,true,true,false", res.join(","));
  comprobar("y el motivo es global_dia",
            (await lim.presupuestoDiario()).motivo === "global_dia");
}

{
  /**
   * Sin esto no se puede probar el modo degradado sin quemar 400 llamadas
   * reales al proveedor, que es un límite que nadie iba a probar nunca.
   */
  const l = limitesDelEntorno({ LIMITE_GLOBAL_DIA: "1", LIMITE_IP_HORA: "5" });
  comprobar("el entorno pisa los topes", l.globalDia === 1 && l.ipHora === 5);
  const d = limitesDelEntorno({ LIMITE_GLOBAL_DIA: "0", LIMITE_IP_HORA: "no-es-número" });
  comprobar("un valor inválido cae al default", d.globalDia === LIMITES.globalDia &&
            d.ipHora === LIMITES.ipHora, `${d.globalDia}/${d.ipHora}`);
}

// ---------------------------------------------------------------------------
console.log(`\n## El aviso de consumo por webhook\n`);

{
  /**
   * Un receptor de mentira, igual que el Upstash de arriba: lo que hay que
   * comprobar no es Discord sino nuestro lado — que avise en los dos momentos,
   * que el cuerpo sirva para los dos servicios, y que un webhook caído no tumbe
   * el límite que estaba protegiendo.
   */
  const recibidos: string[] = [];
  const srv = createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (c) => { cuerpo += c; });
    req.on("end", () => { recibidos.push(cuerpo); res.writeHead(204).end(); });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address() as AddressInfo;

  // Tope 10 → el aviso del 70% sale en la 7ª y el de agotado en la 11ª.
  const lim = new Limitador(new ContadorMemoria(), { ...LIMITES, globalDia: 10 },
                            { webhook: `http://127.0.0.1:${port}` });
  for (let i = 0; i < 11; i++) await lim.presupuestoDiario();
  await new Promise((r) => setTimeout(r, 400));

  comprobar("avisa dos veces: al 70% y al agotarse", recibidos.length === 2,
            `${recibidos.length} aviso(s)`);
  comprobar("el primero dice 70%", /70%/.test(recibidos[0] ?? ""), recibidos[0] ?? "");
  comprobar("el segundo dice AGOTADO", /AGOTADO/.test(recibidos[1] ?? ""), recibidos[1] ?? "");
  /**
   * Discord lee `content` y Slack lee `text`. Mandar los dos hace que el mismo
   * webhook sirva para cualquiera sin preguntar cuál es.
   */
  comprobar("el cuerpo sirve para Discord y para Slack",
            recibidos.every((t) => t.includes('"content"') && t.includes('"text"')));
  await new Promise<void>((r) => { srv.close(() => r()); });
}

{
  const lim = new Limitador(new ContadorMemoria(), { ...LIMITES, globalDia: 1 },
                            { webhook: "http://127.0.0.1:1" });   // nada escuchando
  await lim.presupuestoDiario();
  const v = await lim.presupuestoDiario();
  comprobar("un webhook caído no rompe el límite", !v.permite && v.motivo === "global_dia");
}

{
  /**
   * El correo, contra un Resend de mentira. Lo que se comprueba es nuestro lado:
   * que mande al destinatario pedido, con la clave en la cabecera, y **que el
   * cuerpo no lleve ninguna consulta**.
   */
  const vistos: { auth: string; cuerpo: string }[] = [];
  const srv = createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (c) => { cuerpo += c; });
    req.on("end", () => {
      vistos.push({ auth: String(req.headers.authorization ?? ""), cuerpo });
      res.writeHead(200, { "content-type": "application/json" }).end('{"id":"falso"}');
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address() as AddressInfo;

  const lim = new Limitador(new ContadorMemoria(), { ...LIMITES, globalDia: 10 }, {
    email: "destino@ejemplo.test",
    resendKey: "clave-de-prueba",
    resendUrl: `http://127.0.0.1:${port}`,
  });
  for (let i = 0; i < 11; i++) await lim.presupuestoDiario();
  await new Promise((r) => setTimeout(r, 400));

  comprobar("manda dos correos: al 70% y al agotarse", vistos.length === 2, `${vistos.length}`);
  comprobar("lleva la clave en la cabecera", vistos[0]?.auth === "Bearer clave-de-prueba");
  comprobar("va al destinatario configurado", (vistos[0]?.cuerpo ?? "").includes("destino@ejemplo.test"));
  comprobar("el cuerpo dice que no lleva consultas",
            (vistos[0]?.cuerpo ?? "").includes("contadores agregados"));
  await new Promise<void>((r) => { srv.close(() => r()); });
}

{
  // Con destinatario y sin clave: se avisa por consola y no se rompe nada.
  const lim = new Limitador(new ContadorMemoria(), { ...LIMITES, globalDia: 1 },
                            { email: "destino@ejemplo.test" });
  await lim.presupuestoDiario();
  const v = await lim.presupuestoDiario();
  comprobar("email sin clave: no rompe el límite", !v.permite && v.motivo === "global_dia");
}

// ---------------------------------------------------------------------------
console.log(`\n## Turnstile\n`);

{
  comprobar("sin secreto configurado no bloquea", await verificarTurnstile(undefined, undefined));
  /**
   * ⚠ FALLA CERRADO, al revés que el contador, y la asimetría es deliberada: si
   * Cloudflare no responde no se puede distinguir un humano de un bot. Acá se
   * ejercita el caso «hay secreto y no hay token», que no toca la red.
   */
  comprobar("con secreto y sin token, rechaza", !await verificarTurnstile(undefined, "secreto"));
}

// ---------------------------------------------------------------------------
console.log(`\n${fallos ? "FALLA" : "OK"} — ${corridas - fallos}/${corridas} comprobaciones\n`);
process.exit(fallos ? 1 : 0);
