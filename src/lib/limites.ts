/**
 * Control de abuso: rate limit por IP, presupuesto diario y Turnstile.
 * Paso 25 del roadmap. Cubre R6 y parte de R17 y R19. Ver D-123.
 *
 * POR QUE EXISTE, EN UNA LINEA: sin esto, un script agota los 500 requests
 * diarios de Gemini en minutos y la web queda caida para todos. R6 lo dice sin
 * rodeos —«implementar el rate limiting y el modo degradado ANTES de compartir
 * el link en cualquier lado. No despues»— y hasta hoy la ruta no tenia ninguna
 * proteccion.
 *
 * LOS LIMITES SALEN DE `04-costos-y-limites.md`, no se inventaron aca:
 * 30 mensajes/hora y 60/dia por IP, 20 turnos por sesion, 500 caracteres de
 * entrada, y un contador global diario que dispara el modo degradado.
 *
 * ================================================================
 * LA IP SE HASHEA. LA CONSULTA NO SE GUARDA. NUNCA JUNTAS.
 * ================================================================
 *
 * D-034 y R19: «consulta + IP es dato personal», y es especialmente incomodo en
 * un proyecto cuyo argumento de venta es el rigor. Este modulo ve la IP el
 * tiempo justo para hashearla y **no recibe la consulta**: la firma de
 * `permitir()` no tiene por donde colarla, que es la unica forma de garantizar
 * que no se guarden juntas.
 */

import { createHash, randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Identidad del visitante
// ---------------------------------------------------------------------------

/**
 * LA SAL. Sin sal, hashear una IP no protege nada: son 2^32 valores y una
 * tabla completa se calcula en segundos. Con sal secreta, el hash deja de ser
 * reversible por fuerza bruta.
 *
 * Si no hay `SAL_IP` en el entorno se genera una **efimera, por instancia**. Es
 * un compromiso consciente y conviene entender de que lado cae:
 *
 *   - a favor: sin sal estable los hashes no se pueden correlacionar entre
 *     reinicios ni entre instancias, o sea es MAS privado, no menos.
 *   - en contra: el limite diario por IP se reinicia con el proceso, asi que
 *     protege menos. El limite horario y el presupuesto global siguen enteros.
 *
 * En produccion hay que configurar `SAL_IP`. Sin ella el sistema funciona y
 * avisa, en vez de romper — mismo criterio que `cargarMotor` con el indice en
 * castellano (D-107).
 */
let salCache: string | null = null;

export function sal(env: Record<string, string | undefined>): string {
  if (salCache) return salCache;
  const s = env.SAL_IP?.trim();
  if (s) {
    salCache = s;
  } else {
    salCache = randomBytes(32).toString("hex");
    console.warn("[limites] SAL_IP no configurada: sal efímera por instancia. " +
                 "El límite diario por IP no sobrevive a un reinicio.");
  }
  return salCache;
}

/**
 * La IP del visitante, detras del proxy de Vercel/Cloudflare.
 *
 * `NextRequest.ip` no existe desde Next 15, asi que sale de las cabeceras.
 * **Se toma la PRIMERA entrada de `x-forwarded-for`**, que es la del cliente:
 * las siguientes son los proxies intermedios, y quedarse con la ultima daria la
 * IP del proxy — un solo cubo para todo el mundo, o sea el limitador apagado.
 *
 * Las cabeceras las pone el proxy y un cliente directo puede mentirlas. En
 * Vercel/Cloudflare el borde las reescribe, asi que son confiables **en
 * despliegue**; en local no, y por eso el limitador no es la unica defensa: el
 * presupuesto global no depende de la IP.
 */
export function ipDe(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const primera = xff.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return headers.get("x-real-ip")?.trim() || "desconocida";
}

/** Identidad opaca y estable dentro de la instancia. La IP cruda muere acá. */
export function identidad(ip: string, sal: string): string {
  return createHash("sha256").update(sal + "|" + ip).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// El contador
// ---------------------------------------------------------------------------

/**
 * Incrementa y devuelve el valor nuevo, con vencimiento. Es la unica operacion
 * que el limitador necesita, y es atomica en las dos implementaciones: se
 * incrementa PRIMERO y se compara despues, para no tener una carrera entre
 * «leer» y «escribir» que dos pedidos simultaneos ganarian los dos.
 */
export interface Contador {
  incr(clave: string, ventanaSegundos: number): Promise<number>;
}

/**
 * En memoria. Exacto dentro de una instancia, ciego entre instancias.
 *
 * Alcanza para desarrollo y para un despliegue de una sola instancia. En
 * serverless con varias instancias cada una cuenta lo suyo, asi que el limite
 * efectivo se multiplica por la cantidad de instancias: es **mas permisivo de lo
 * declarado, nunca mas restrictivo**. Vale saberlo y no confundirlo con
 * proteccion completa.
 */
export class ContadorMemoria implements Contador {
  private m = new Map<string, { n: number; expira: number }>();
  private ultimaPoda = Date.now();

  async incr(clave: string, ventanaSegundos: number): Promise<number> {
    const ahora = Date.now();
    this.podar(ahora);
    const e = this.m.get(clave);
    if (!e || e.expira <= ahora) {
      this.m.set(clave, { n: 1, expira: ahora + ventanaSegundos * 1000 });
      return 1;
    }
    e.n++;
    return e.n;
  }

  /**
   * Sin poda, el Map crece con cada IP nueva y el limitador se vuelve el
   * vector de agotamiento de memoria que venia a evitar. Se poda como mucho
   * una vez por minuto para no recorrer el mapa en cada pedido.
   */
  private podar(ahora: number): void {
    if (ahora - this.ultimaPoda < 60_000) return;
    this.ultimaPoda = ahora;
    for (const [k, v] of this.m) if (v.expira <= ahora) this.m.delete(k);
  }
}

/**
 * Upstash Redis por REST. Es el backend que `03-arquitectura.md` eligio y el
 * unico que cuenta bien con varias instancias.
 *
 * EJERCITADO DESDE D-201, contra un servidor local que habla el protocolo REST
 * de Upstash: `npm run limites`. No hace falta una cuenta — lo que hay que
 * comprobar no es Redis sino este lado: que el pipeline lleve `INCR` + `EXPIRE
 * … NX` sobre la clave y la ventana pedidas, y que los cuatro modos de fallo
 * caigan a memoria. Corre en CI.
 *
 * ⚠️ **Sigue sin haber corrido contra Upstash de verdad**, porque no hay
 * credenciales en el entorno. Lo que está probado es el contrato, no la cuenta.
 * La seleccion automatica de abajo lo deja apagado mientras no haya
 * credenciales, asi que no puede romper nada por accidente.
 *
 * ANTE UN FALLO DE RED, CAE A MEMORIA en vez de decidir sola. Las dos
 * alternativas son peores: fallar cerrado tumba el sitio por un blip de Redis
 * —justo lo que R17 llama el peor escenario— y fallar abierto deja la cuota sin
 * proteccion. Caer a memoria conserva un limite real, sólo que por instancia.
 */
export class ContadorUpstash implements Contador {
  private respaldo = new ContadorMemoria();
  private avisado = false;

  constructor(private url: string, private token: string) {}

  async incr(clave: string, ventanaSegundos: number): Promise<number> {
    try {
      const r = await fetch(`${this.url}/pipeline`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify([["INCR", clave], ["EXPIRE", clave, String(ventanaSegundos), "NX"]]),
        signal: AbortSignal.timeout(2000),
      });
      if (!r.ok) throw new Error(`upstash ${r.status}`);
      const j = await r.json() as { result: number }[];
      const n = j[0]?.result;
      if (typeof n !== "number") throw new Error("respuesta inesperada de upstash");
      return n;
    } catch (e) {
      if (!this.avisado) {
        this.avisado = true;
        console.error("[limites] Upstash falló, se cae a memoria:", (e as Error).message);
      }
      return this.respaldo.incr(clave, ventanaSegundos);
    }
  }
}

/**
 * ⚠️ DOS JUEGOS DE NOMBRES, PORQUE NO LOS ELEGIMOS NOSOTROS. Si la base se
 * agrega desde el Marketplace de Vercel en vez de copiar las claves a mano,
 * **Vercel inyecta las credenciales con SUS nombres** (`KV_REST_API_URL` /
 * `KV_REST_API_TOKEN`, herencia del Vercel KV que migro a Upstash en 2024) y no
 * con los de Upstash. Leyendo solo un juego, el camino mas comodo para el dueno
 * —dos clics en el panel— dejaba el limitador en memoria **sin un solo sintoma**:
 * el sitio responde igual y el techo diario se multiplica por instancia.
 *
 * Es el mismo patron que D-218: *un limite que se degrada sin avisar no aparece
 * en ninguna lista de pendientes*. Ahi el disparador fue que en desarrollo corre
 * una sola instancia; aca habria sido que el nombre de la variable lo decide un
 * tercero. Se aceptan los dos y se prefiere el de Upstash si estan los dos.
 */
export function contadorDelEntorno(env: Record<string, string | undefined>): Contador {
  const url = env.UPSTASH_REDIS_REST_URL?.trim() || env.KV_REST_API_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim() || env.KV_REST_API_TOKEN?.trim();
  if (url && token) return new ContadorUpstash(url, token);
  /**
   * EL AVISO NO ES DECORATIVO. Sin base compartida el limitador sigue
   * funcionando, pero por instancia: es la unica degradacion del sistema que
   * toca la prioridad 2 (no agotar la capacidad) y la unica que no se ve desde
   * afuera. Que quede escrito en el log de arranque es lo minimo.
   */
  console.warn(
    "[limites] sin base compartida: los contadores viven en memoria y son POR INSTANCIA. " +
    "El techo diario efectivo pasa a ser (techo × instancias). " +
    "Configurar UPSTASH_REDIS_REST_URL/_TOKEN (o KV_REST_API_URL/_TOKEN). Ver docs/22-publicar.md.",
  );
  return new ContadorMemoria();
}

// ---------------------------------------------------------------------------
// Los limites
// ---------------------------------------------------------------------------

/** De `04-costos-y-limites.md`. Estos son los defaults; el entorno los pisa. */
export const LIMITES = {
  ipHora: 30,
  ipDia: 60,
  turnosSesion: 20,
  /**
   * El techo global de generaciones por dia. 400 sobre los 500 que da el free
   * tier de Gemini: el margen cubre lo que gasten los evals y las herramientas,
   * que salen del mismo pozo y no pasan por acá.
   */
  globalDia: 400,
  /** A partir de acá se avisa por consola. El 70% que pide `04`. */
  avisoGlobal: 0.7,
};

export type Limites = typeof LIMITES;

/**
 * Los limites, con lo que diga el entorno.
 *
 * Existe por dos razones y la segunda no es menor: ajustar el techo en
 * despliegue sin tocar codigo, y **poder probar el camino del presupuesto
 * agotado sin gastar 400 llamadas al proveedor** — con `LIMITE_GLOBAL_DIA=1`
 * el segundo pedido ya cae en el modo degradado. Un limite que solo se puede
 * ejercitar agotando la cuota real es un limite que nadie va a probar.
 */
export function limitesDelEntorno(env: Record<string, string | undefined>): Limites {
  const num = (v: string | undefined, def: number): number => {
    const n = Number(v);
    return v !== undefined && Number.isFinite(n) && n > 0 ? n : def;
  };
  return {
    ipHora: num(env.LIMITE_IP_HORA, LIMITES.ipHora),
    ipDia: num(env.LIMITE_IP_DIA, LIMITES.ipDia),
    turnosSesion: num(env.LIMITE_TURNOS, LIMITES.turnosSesion),
    globalDia: num(env.LIMITE_GLOBAL_DIA, LIMITES.globalDia),
    avisoGlobal: LIMITES.avisoGlobal,
  };
}

/**
 * EL AVISO DE CONSUMO. Ver D-210.
 *
 * `04-costos-y-limites.md` pide una alerta al 70% y hasta acá era un
 * `console.warn`. **En serverless nadie lee esa consola**: el aviso existia y no
 * avisaba, que es la definicion de una comprobacion que no comprueba (D-115).
 *
 * ⚠ SIN `ALERTA_WEBHOOK` NO SE MANDA NADA y el mensaje sigue yendo a consola,
 * igual que antes. Es el mismo criterio que Turnstile (D-206): la capacidad
 * queda cableada y configurarla la activa, sin que no configurarla cueste nada.
 *
 * El cuerpo lleva `content` Y `text` a proposito: Discord lee el primero y Slack
 * el segundo, cada uno ignora el que no conoce, y asi el mismo webhook sirve
 * para los dos sin preguntar cual es. Los dos tienen webhooks gratis, que es la
 * condicion del presupuesto de US$0.
 *
 * NUNCA LLEVA UNA CONSULTA. El mensaje son contadores agregados: cuantas
 * generaciones sobre cuantas. `Limitador` no recibe la pregunta por firma
 * (D-034), asi que no podria filtrarla ni queriendo.
 *
 * No bloquea ni propaga: si el webhook falla, se anota y la respuesta al usuario
 * sigue su curso. Un aviso caido no puede tumbar el chat.
 */
export interface Aviso {
  /** Webhook de Discord o Slack. */
  webhook?: string;
  /** Destinatario del correo. Necesita `resendKey` para servir de algo. */
  email?: string;
  /** Clave de Resend. Sin ella el correo no se manda y se dice por consola. */
  resendKey?: string;
  /**
   * Sólo para ejercitarlo: apunta el envío a un servidor local en vez de a la
   * API real. Es la misma costura que `limitesDelEntorno` abrió para poder
   * probar el presupuesto agotado sin gastar 400 llamadas — un camino que sólo
   * se puede ejercitar con una cuenta real es un camino que nadie prueba.
   */
  resendUrl?: string;
}

/**
 * EL CORREO VA POR RESEND. Ver D-212.
 *
 * Se eligió por lo que NO pide: no hace falta un dominio propio ni un servidor
 * SMTP, no agrega una dependencia —es un `fetch`— y su plan gratuito da 100
 * correos por día, contra los **dos por día como mucho** que este aviso puede
 * generar. El presupuesto de operación sigue en US$0.
 *
 * ⚠ CON LA CLAVE GRATUITA Y SIN DOMINIO PROPIO, Resend sólo entrega al correo
 * de la cuenta. Para esta alerta alcanza —el destinatario es el dueño— pero si
 * mañana hay que avisarle a otra persona, hace falta verificar un dominio.
 */
async function porEmail(mensaje: string, a: Aviso): Promise<void> {
  if (!a.email) return;
  if (!a.resendKey) {
    console.warn("[limites] ALERTA_EMAIL configurado sin RESEND_API_KEY: no se manda correo");
    return;
  }
  const r = await fetch(a.resendUrl ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${a.resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: "Ask Leonardo <onboarding@resend.dev>",
      to: [a.email],
      subject: `Ask Leonardo · ${mensaje.split(":")[0]}`,
      text: `${mensaje}

Este aviso lo manda el limitador de consumo del sitio. ` +
            `No lleva ninguna consulta de ningún visitante: son contadores agregados.`,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`resend ${r.status} ${(await r.text()).slice(0, 120)}`);
}

async function porWebhook(mensaje: string, a: Aviso): Promise<void> {
  if (!a.webhook) return;
  await fetch(a.webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: `Ask Leonardo · ${mensaje}`, text: `Ask Leonardo · ${mensaje}` }),
    signal: AbortSignal.timeout(3000),
  });
}

async function avisar(mensaje: string, a: Aviso = {}): Promise<void> {
  console.warn(`[limites] ${mensaje}`);
  /**
   * LOS DOS CANALES SON INDEPENDIENTES Y NINGUNO PUEDE TUMBAR AL OTRO.
   * `allSettled` y no `all`: si Resend está caído, el webhook igual sale — y al
   * revés. Un aviso a medias es mejor que ninguno, y ninguno de los dos puede
   * tumbar el chat, que es lo que de verdad importa.
   */
  const r = await Promise.allSettled([porWebhook(mensaje, a), porEmail(mensaje, a)]);
  for (const x of r) {
    if (x.status === "rejected") {
      console.error("[limites] no se pudo avisar:", (x.reason as Error).message);
    }
  }
}

export interface Veredicto {
  permite: boolean;
  /** Para el cuerpo de la respuesta y el `Retry-After`. */
  motivo?: "ip_hora" | "ip_dia" | "turnos" | "global_dia" | "turnstile";
  usado?: number;
  limite?: number;
  esperaSegundos?: number;
}

const PERMITE: Veredicto = { permite: true };

const hoy = (): string => new Date().toISOString().slice(0, 10);

export class Limitador {
  constructor(
    private c: Contador,
    private lim: Limites = LIMITES,
    /** A dónde avisar del consumo. Sin esto, el aviso queda en consola. */
    private aviso: Aviso = {},
  ) {}

  private async cupo(
    clave: string, limite: number, ventana: number, motivo: Veredicto["motivo"],
  ): Promise<Veredicto> {
    const n = await this.c.incr(clave, ventana);
    if (n <= limite) return PERMITE;
    return { permite: false, motivo, usado: n, limite, esperaSegundos: ventana };
  }

  /**
   * El cupo de un visitante. Cuenta PEDIDOS, no generaciones: una respuesta
   * servida de la caché N0 no cuesta cuota de LLM pero sí cuesta una invocación
   * de función, que es el recurso que R17 dice que puede tumbar el sitio entero.
   */
  async porVisitante(id: string): Promise<Veredicto> {
    const h = await this.cupo(`ip:h:${id}`, this.lim.ipHora, 3600, "ip_hora");
    if (!h.permite) return h;
    return this.cupo(`ip:d:${id}:${hoy()}`, this.lim.ipDia, 172_800, "ip_dia");
  }

  /**
   * EL PRESUPUESTO DIARIO CUENTA GENERACIONES, NO PEDIDOS. Es la distinción que
   * hace que la caché N0 signifique algo.
   *
   * D-112 congeló las 5 respuestas de portada precisamente para «sacarlas del
   * presupuesto de 500 requests/día para siempre». Si este contador subiera con
   * cada pedido, una respuesta cacheada gastaría cuota que no consume y esa
   * decisión quedaría anulada por su propio guardián. Lo mismo vale para las
   * abstenciones y los casos curados de capa 0: no llaman al LLM, no descuentan.
   *
   * Por eso se llama JUSTO ANTES de generar, y no al entrar al handler.
   */
  async presupuestoDiario(): Promise<Veredicto> {
    const clave = `gen:d:${hoy()}`;
    const n = await this.c.incr(clave, 172_800);
    /**
     * DOS AVISOS, NO UNO: al 70% queda margen para reaccionar; al 100% ya no hay
     * nada que hacer y lo que importa es enterarse de que el sitio esta en modo
     * degradado. Con un solo aviso hay que elegir entre las dos cosas.
     *
     * Se comparan por IGUALDAD, no por `>=`: `incr` es atomico y devuelve cada
     * valor exactamente una vez, asi que el aviso sale una sola vez por dia.
     */
    if (n === Math.ceil(this.lim.globalDia * this.lim.avisoGlobal)) {
      void avisar(`presupuesto diario al ${this.lim.avisoGlobal * 100}%: ` +
                  `${n} de ${this.lim.globalDia} generaciones`, this.aviso);
    }
    if (n === this.lim.globalDia + 1) {
      void avisar(`presupuesto diario AGOTADO: ${this.lim.globalDia} generaciones. ` +
                  `El sitio queda en modo degradado hasta mañana.`, this.aviso);
    }
    if (n <= this.lim.globalDia) return PERMITE;
    return { permite: false, motivo: "global_dia", usado: n, limite: this.lim.globalDia };
  }

  /**
   * EL LIMITE DE TURNOS NO ES UNA DEFENSA, ES UNA DECISION DE PRODUCTO.
   *
   * `04-costos-y-limites.md` lo pide y explica por qué: «además de proteger la
   * cuota, mejora el producto: obliga a conversaciones con intención en vez de
   * derivas infinitas», presentado en personaje.
   *
   * Pero el número de turno lo declara el cliente, y no hay sesión en el
   * servidor que lo verifique — D-032 decidió no persistir historial y no tener
   * base de datos con estado. **Un atacante lo pone en 1 y listo.** Se
   * implementa igual porque cumple su función de producto con un usuario
   * normal, y la protección real contra abuso son los otros tres límites, que
   * no dependen de que el cliente diga la verdad. Anotarlo importa: creerle a
   * este número como si fuera una defensa sería el error.
   */
  limiteDeTurnos(turno: number | undefined): Veredicto {
    if (typeof turno !== "number" || turno <= this.lim.turnosSesion) return PERMITE;
    return { permite: false, motivo: "turnos", usado: turno, limite: this.lim.turnosSesion };
  }
}

// ---------------------------------------------------------------------------
// Turnstile
// ---------------------------------------------------------------------------

/**
 * Verificación del token de Cloudflare Turnstile contra el servidor de
 * Cloudflare. `03-arquitectura.md` lo eligió: gratis y sin fricción visible.
 *
 * **Sólo actúa si `TURNSTILE_SECRET_KEY` está configurada.** Sin clave devuelve
 * `true` y el resto de los límites siguen en pie: el widget vive en el
 * frontend, que todavía no existe, y hacer obligatorio un token que nadie puede
 * emitir dejaría la ruta inutilizable. Cuando el frontend monte el widget,
 * configurar la clave lo activa sin tocar código.
 *
 * El secreto no sale del servidor (D-035). La IP se manda a Cloudflare porque
 * su API la usa para validar el token — es el único lugar donde una IP cruda
 * sale de este proceso, y va a un tercero declarado en el aviso de privacidad
 * (R19), no a nuestro almacenamiento.
 */
export async function verificarTurnstile(
  token: string | undefined, secreto: string | undefined, ip?: string,
): Promise<boolean> {
  if (!secreto) return true;
  if (!token) return false;
  try {
    const cuerpo = new URLSearchParams({ secret: secreto, response: token });
    if (ip && ip !== "desconocida") cuerpo.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: cuerpo, signal: AbortSignal.timeout(5000),
    });
    const j = await r.json() as { success?: boolean };
    return j.success === true;
  } catch (e) {
    /**
     * FALLA CERRADO, al revés que el contador. La asimetría es deliberada: si
     * Cloudflare no responde no se puede distinguir un humano de un bot, y
     * dejar pasar a todos en ese momento convierte una caída de un tercero en
     * la puerta abierta que el anti-bot venía a cerrar. El contador cae a
     * memoria porque ahí sí queda una defensa; acá no queda ninguna.
     */
    console.error("[limites] Turnstile no verificable:", (e as Error).message);
    return false;
  }
}
