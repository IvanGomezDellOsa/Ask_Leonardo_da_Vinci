/**
 * Ruta del chat. Ver D-119, D-120 y D-122.
 *
 * NO EMBEBE (D-118, D-022): el cliente calcula el vector en el navegador con
 * Transformers.js y lo manda ya hecho. Este handler sólo lo reconstruye.
 *
 * PASA POR `responder()`, LA UNICA DEFINICION (D-113): el mismo camino que usan
 * los evals, así que lo que un usuario ve tiene las mismas tres garantías
 * (D-082 verificación de cita, D-083 comillas inválidas, D-093 poda tras
 * declinar) que el número que se publica.
 *
 * NO HACE STREAMING TOKEN A TOKEN DEL PROVEEDOR. Ver D-120: las garantías de
 * arriba corren DESPUES de tener el texto completo — no se puede verificar una
 * cita a mitad de generar. Transmitir tokens crudos mostraría al usuario texto
 * que después se corrige o desaparece, que es exactamente lo que este proyecto
 * existe para no hacer.
 *
 * Ninguna clave sale de acá (D-035): viven en variables de entorno del servidor.
 */

// ".js" explícito: bajo "nodenext" —necesario para que Turbopack resuelva los
// imports de `src/lib`, ver D-121— un import ESM sin extensión de un paquete
// sin mapa de "exports" (el caso de "next") no resuelve.
import { NextRequest, NextResponse } from "next/server.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { cargarMotor, type Motor, type Idioma } from "../../../src/lib/grounding.js";
import { responder } from "../../../src/lib/responder.js";
import {
  PresupuestoTpm, generar, proveedorPorId, huellaPrompt, varianteVigente,
  type Proveedor,
} from "../../../src/lib/llm.js";
import {
  Limitador, contadorDelEntorno, limitesDelEntorno, ipDe, identidad, sal,
  verificarTurnstile, type Veredicto,
} from "../../../src/lib/limites.js";
import type { Chunk } from "../../../src/lib/retrieval.js";
import type { PasajePublico, RespuestaPublica } from "../../../src/lib/respuesta.js";

export const runtime = "nodejs";

/**
 * El default de una función serverless suele ser 10s. Una respuesta puede
 * costar hasta TRES llamadas al proveedor: la verificación de cita reintenta
 * dos veces ante una cita fabricada (D-082). Con 10s el reintento se cortaría a
 * la mitad y el usuario vería un error justo en el caso que la garantía existe
 * para cubrir.
 */
export const maxDuration = 60;

/**
 * `process.cwd()`, no `new URL("../../../artifacts/", import.meta.url)`.
 *
 * El resto del proyecto usa la forma relativa a `import.meta.url` porque corre
 * bajo tsx y ese archivo SÍ vive donde el disco dice. Acá no: Turbopack
 * empaqueta la ruta, `import.meta.url` apunta al artefacto compilado, y además
 * analiza ese patrón en build time para decidir qué empaquetar — falla porque
 * `artifacts/` es una carpeta de datos, no un módulo. Ver D-121 y el
 * `outputFileTracingIncludes` de `next.config.ts`.
 */
const ART = pathToFileURL(join(process.cwd(), "artifacts") + "/");

// ---------------------------------------------------------------------------
// Carga perezosa y memoizada
// ---------------------------------------------------------------------------

/**
 * SE CARGA EN EL PRIMER PEDIDO, NO AL IMPORTAR EL MODULO.
 *
 * Con `const motor = cargarMotor(ART)` al tope, un artefacto faltante hacía
 * explotar el módulo entero al importarse: Next devuelve 500 sin cuerpo útil y
 * el log dice «failed to load route», que no nombra la causa. Memoizado acá, el
 * fallo se convierte en un 503 que dice qué archivo falta y en qué carpeta lo
 * buscó. Se sigue cargando UNA sola vez por instancia, que era el punto.
 */
let cargado: { motor: Motor; fijas: Map<string, Fija>; huella: string } | null = null;
let fallo: string | null = null;

interface Fija {
  id: string; lang: Idioma; pregunta: string; respuesta: string;
  pasajes: number[]; textosVistos: string[]; huella: string;
}

const normalizar = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

function cargar(): { motor: Motor; fijas: Map<string, Fija>; huella: string } | null {
  if (cargado || fallo) return cargado;
  try {
    const motor = cargarMotor(ART);
    const huella = huellaPrompt(varianteVigente(ART));

    /**
     * LA CACHE N0 (D-112). Estaba escrita y NADIE LA LEIA: la ruta generaba
     * las cinco preguntas de la portada con el LLM en cada clic, que es
     * exactamente lo que esa decisión existe para evitar — cuota, latencia y
     * sobre todo varianza (a temperatura 0,7 dos clics daban dos respuestas).
     *
     * Sólo entran las entradas cuya huella coincide con la vigente. Una entrada
     * vencida se ignora y la pregunta cae al camino vivo: servir algo viejo
     * creyéndolo nuevo es el bug que el proyecto lleva nueve entradas nombrando.
     */
    const fijas = new Map<string, Fija>();
    const f = new URL("respuestas_fijas.json", ART);
    if (existsSync(f)) {
      const j = JSON.parse(readFileSync(f, "utf8")) as { respuestas?: Fija[] };
      for (const r of j.respuestas ?? []) {
        if (r.huella === huella) fijas.set(`${r.lang}:${normalizar(r.pregunta)}`, r);
      }
    }
    cargado = { motor, fijas, huella };
    return cargado;
  } catch (e) {
    fallo = `no se pudieron cargar los artefactos desde ${ART.pathname}: ${(e as Error).message}`;
    console.error("[api/chat]", fallo);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Proveedores y presupuesto
// ---------------------------------------------------------------------------

/**
 * `gemini-3.1-flash-lite` es el generador de producción (D-089: la mitad de
 * D-088 que quedó vigente). Groq queda de resguardo por su cuota independiente
 * (D-023) — DeepSeek NO entra: D-089 lo reasignó a juez, y dejarlo en la
 * cascada de operación repetiría el error que esa entrada revocó.
 *
 * Cada proveedor entra sólo si su clave está: faltar una degrada, no rompe.
 */
function cascadaDeProduccion(env: Record<string, string | undefined>): Proveedor[] {
  const p: Proveedor[] = [];
  const intentar = (id: string) => {
    try { p.push(proveedorPorId(id, env as Record<string, string>)); } catch { /* falta la clave */ }
  };
  intentar("gemini/gemini-3.1-flash-lite");
  intentar("groq/llama-3.3-70b-versatile");
  return p;
}

/**
 * 60.000 TPM y 12 RPM — LOS VALORES DE GEMINI, no los de Groq. Ver D-086.
 *
 * Esto decía `new PresupuestoTpm(6000)` y estaba mal en las dos dimensiones,
 * reintroduciendo el defecto exacto que D-086 documentó:
 *
 *   - 6.000 TPM es el límite que D-023 leyó de la documentación de GROQ, y que
 *     D-086 midió mal por la mitad (son 12.000). Aplicado a Gemini, cuyo tier
 *     da ~60.000, estrangulaba a un décimo de la capacidad real.
 *   - `rpm` quedaba en `Infinity`, o sea **el presupuesto no miraba la
 *     dimensión que efectivamente muerde en Gemini**: 15 requests por minuto.
 *     Con la verificación de cita de D-082 un pedido son hasta tres requests,
 *     así que cinco usuarios concurrentes bastaban para un 429 que el limitador
 *     creía imposible.
 *
 * 12 y no 15 a propósito, igual que en el runner: el margen cubre los reintentos
 * que el propio cliente hace ante un 429. Valor medido por modelo y con fecha
 * (2026-08-05), no una constante del proveedor.
 */
const presupuesto = new PresupuestoTpm(60_000, 12);

/**
 * Control de abuso (paso 25, R6, R17). Ver `src/lib/limites.ts` y D-123.
 *
 * Una sola instancia por proceso: el contador en memoria no sirve de nada si se
 * construye por pedido, y el de Upstash no necesita reconstruirse.
 */
const limitador = new Limitador(contadorDelEntorno(process.env), limitesDelEntorno(process.env));

/**
 * EL SERVIDOR NO ESCRIBE PROSA DE LEONARDO, NI SIQUIERA PARA UN ERROR.
 *
 * `04-costos-y-limites.md` pide presentar el modo degradado en personaje —«el
 * día se acaba y debo volver a mis estudios»— y tiene razón como producto. Pero
 * esa frase no sale de ningún pasaje del corpus, y la tesis del proyecto es que
 * lo que Leonardo dice se comprueba contra sus cuadernos (D-112 lo dice para
 * las respuestas congeladas: ninguna se escribe a mano, nunca).
 *
 * Entonces la API devuelve un CODIGO, y la redacción es del cliente. Así el
 * texto en personaje vive donde se ve que es interfaz y no una cita, el
 * servidor no queda con frases atribuibles a Leonardo, y de paso la redacción
 * queda del lado de quien decide el diseño.
 */
function rechazo(v: Veredicto, status: number): NextResponse {
  const cuerpo: Record<string, unknown> = { error: "limite", motivo: v.motivo, descansa: true };
  const h = new Headers();
  if (v.esperaSegundos) h.set("retry-after", String(v.esperaSegundos));
  return NextResponse.json(cuerpo, { status, headers: h });
}

// ---------------------------------------------------------------------------
// Forma pública de la respuesta
// ---------------------------------------------------------------------------

/**
 * `PasajePublico`/`RespuestaPublica` viven en `src/lib/respuesta.ts` (D-132),
 * compartidas con `tools/exportar_portada.ts` — el bundle que el cliente
 * importa directo para las 6 preguntas de portada, sin pasar por acá. Que las
 * dos formas salgan del mismo tipo es lo que evita que diverjan sin que nadie
 * lo note, la misma razón por la que `responder()` es una sola definición
 * (D-113).
 *
 * LA RESPUESTA NO ES `Respondido` TAL CUAL. `responder()` devuelve el `Chunk`
 * entero por pasaje, y eso mandaba al cliente el mismo texto TRES veces
 * —`chunk.text`, `chunk.embedText` (que es título + texto concatenados) y
 * `textosVistos`— más campos que sólo importan adentro (`nWords`, `part`,
 * `sourceManuscript`, `annotatesPassage`). Medido: ~2,9 KB de chunks crudos
 * por respuesta, un tercio pura duplicación.
 *
 * Mandar eso contradice de frente la razón por la que 19-bis existió: si los
 * 129 MB de la primera carga preocupan en móvil, regalar kilobytes por turno no
 * se justifica con «es sólo JSON».
 *
 * Se manda EL TEXTO QUE VIO EL MODELO (`textosVistos`), no `chunk.text`: son
 * distintos en castellano —el modelo ve la traducción (D-079)— y el que hay que
 * mostrar junto a una cita es el que se verificó contra ella (D-084).
 *
 * Notas sobre dos campos del tipo importado:
 *   - `caso`/`cita`: sólo en `curada` (D-124); `cita: null` es una posición
 *     honesta cuando el corpus calla y Richter tampoco lo comenta.
 *   - `diagnostico.citasSinRespaldo` se publica a propósito: es el estado de
 *     la garantía que sostiene la tesis del proyecto.
 */

const tituloDe = (c: Chunk, idioma: Idioma): string | null =>
  (idioma === "es" && c.tituloEs !== undefined ? c.tituloEs : c.richterTitle) ?? null;

// ---------------------------------------------------------------------------
// Validación de entrada
// ---------------------------------------------------------------------------

/**
 * 384 = las dims de `Xenova/multilingual-e5-small` (D-097). Sin este chequeo un
 * vector vacío pasaba entero —`[].every(...)` es `true` por vacuidad— y llegaba
 * a `Corpus.buscar`, que da `cos: null` en los tres pasajes pero IGUAL generaba:
 * una llamada real y facturable disparada por un pedido degenerado.
 */
const DIMS_EMBEDDING = 384;

interface CuerpoPedido {
  pregunta: string; idioma: Idioma; vector: number[];
  /** Nº de turno declarado por el cliente, y token de Turnstile. Los dos opcionales. */
  turno?: number; turnstile?: string;
}

function validar(cuerpo: unknown): CuerpoPedido | null {
  if (!cuerpo || typeof cuerpo !== "object") return null;
  const c = cuerpo as Record<string, unknown>;
  // 500 caracteres: el punto 4 del control de abuso de `04-costos-y-limites.md`.
  // Corta la inyección de prompt larga y el vaciado de cuota con contextos enormes.
  if (typeof c.pregunta !== "string" || !c.pregunta.trim() || c.pregunta.length > 500) return null;
  if (c.idioma !== "es" && c.idioma !== "en") return null;
  if (!Array.isArray(c.vector) || c.vector.length !== DIMS_EMBEDDING) return null;
  if (!c.vector.every((x) => typeof x === "number" && Number.isFinite(x))) return null;
  if (c.turno !== undefined && (typeof c.turno !== "number" || !Number.isFinite(c.turno))) return null;
  if (c.turnstile !== undefined && typeof c.turnstile !== "string") return null;
  return {
    pregunta: c.pregunta.trim(), idioma: c.idioma, vector: c.vector as number[],
    turno: c.turno as number | undefined, turnstile: c.turnstile as string | undefined,
  };
}

// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "cuerpo no es JSON válido" }, { status: 400 });
  }
  const pedido = validar(cuerpo);
  if (!pedido) {
    return NextResponse.json(
      { error: "faltan o son inválidos: pregunta, idioma, vector" }, { status: 400 });
  }

  /**
   * EL ORDEN DE LAS COMPROBACIONES ES LA MITAD DEL DISEÑO. De lo más barato a
   * lo más caro, y lo que no cuesta cuota no la descuenta:
   *
   *   1. turnos      — un `if`, sin E/S
   *   2. cupo por IP — una operación de contador
   *   3. Turnstile   — una llamada de red a Cloudflare (sólo si hay clave)
   *   4. caché N0    — lectura de memoria, **no toca el presupuesto diario**
   *   5. presupuesto — se descuenta recién cuando se va a generar de verdad
   *
   * Si el presupuesto diario se comprobara acá arriba, una respuesta cacheada
   * gastaría cuota que no consume y D-112 quedaría anulada por su propio
   * guardián.
   */
  const vTurnos = limitador.limiteDeTurnos(pedido.turno);
  if (!vTurnos.permite) return rechazo(vTurnos, 429);

  const ip = ipDe(req.headers);
  const quien = identidad(ip, sal(process.env));
  const vIp = await limitador.porVisitante(quien);
  if (!vIp.permite) return rechazo(vIp, 429);

  if (!await verificarTurnstile(pedido.turnstile, process.env.TURNSTILE_SECRET_KEY, ip)) {
    return rechazo({ permite: false, motivo: "turnstile" }, 403);
  }

  const ctx = cargar();
  if (!ctx) return NextResponse.json({ error: fallo }, { status: 503 });

  // --- N0: la respuesta congelada, si existe y está vigente (D-112) ---------
  const fija = ctx.fijas.get(`${pedido.idioma}:${normalizar(pedido.pregunta)}`);
  if (fija) {
    const corpus = ctx.motor.por[pedido.idioma].corpus;
    const pasajes: PasajePublico[] = fija.pasajes.map((n, i) => {
      // `textosVistos[i]` es la autoridad sobre el texto: 32 números de Richter
      // viven en más de un chunk (D-084), así que resolver el número sólo sirve
      // para la metadata de la tarjeta, no para el texto que se muestra.
      const c = corpus.chunks.find((x) => x.richterNos.includes(n));
      return {
        richterNo: n,
        titulo: c ? tituloDe(c, pedido.idioma) : null,
        texto: fija.textosVistos[i] ?? "",
        url: c?.url ?? null,
      };
    });
    const r: RespuestaPublica = {
      decision: "responde", texto: fija.respuesta, pasajes, notas: [], origen: "cache",
      diagnostico: {
        cosMax: null, tau: null,
        reintentosCita: 0, comillasQuitadas: 0, podadas: 0, citasSinRespaldo: [],
      },
    };
    return NextResponse.json(r);
  }

  // --- camino vivo ---------------------------------------------------------
  const cascada = cascadaDeProduccion(process.env);
  if (cascada.length === 0) {
    return NextResponse.json(
      { error: "el servidor no tiene generador configurado" }, { status: 503 });
  }

  try {
    /**
     * SIN CUOTA NO ES UNA RESPUESTA VACIA. Bug encontrado auditando, y visto en
     * vivo durante las pruebas de D-120 sin reconocerlo.
     *
     * `generar()` devuelve `null` cuando el presupuesto se agotó o todos los
     * proveedores dieron 429 (D-023). Esto lo convertía en `{ texto: "" }`, que
     * `responder()` procesa sin objetar y devuelve como `decision: "responde"`
     * con texto vacío — un **200 con Leonardo mudo**, indistinguible de una
     * respuesta legítima. Es el «modo Leonardo descansa» del paso 25 del
     * roadmap, que merece decirse, no disfrazarse de éxito.
     */
    let sinCuota = false;
    let sinPresupuesto: Veredicto | null = null;
    const R = await responder({
      motor: ctx.motor,
      pregunta: pedido.pregunta,
      idioma: pedido.idioma,
      vector: new Float32Array(pedido.vector),
      /**
       * EL PRESUPUESTO DIARIO SE DESCUENTA ACA ADENTRO, no en el handler.
       *
       * Esta función la llama `responder()` **sólo si el gate decidió
       * responder**: una abstención o un caso curado de capa 0 nunca llegan
       * hasta acá, y por eso no descuentan cuota que no gastan. Es el único
       * lugar del código donde «se va a llamar al LLM» es un hecho y no una
       * predicción.
       *
       * Y se descuenta UNA VEZ POR LLAMADA, no una por pregunta: la
       * verificación de cita reintenta hasta dos veces (D-082) y cada reintento
       * es un request real contra la cuota del proveedor. Contar uno por
       * pregunta subestimaría el consumo justo en los casos difíciles.
       */
      generar: async (system, messages) => {
        const v = await limitador.presupuestoDiario();
        if (!v.permite) { sinPresupuesto = v; return { texto: "", tokensEntrada: 0, tokensSalida: 0 }; }
        const g = await generar(cascada, presupuesto, system, messages);
        if (!g) { sinCuota = true; return { texto: "", tokensEntrada: 0, tokensSalida: 0 }; }
        return g;
      },
    });

    if (sinPresupuesto) return rechazo(sinPresupuesto, 503);
    if (sinCuota) {
      return NextResponse.json(
        { error: "limite", motivo: "cuota_proveedor", descansa: true }, { status: 503 });
    }

    const r: RespuestaPublica = {
      decision: R.decision,
      texto: R.texto,
      pasajes: R.pasajes.map((p, i) => ({
        richterNo: p.chunk.richterNo,
        titulo: tituloDe(p.chunk, pedido.idioma),
        texto: R.textosVistos[i] ?? "",
        url: p.chunk.url ?? null,
      })),
      notas: R.notas,
      caso: R.caso,
      cita: R.cita,
      origen: "vivo",
      diagnostico: {
        cosMax: R.cosMax, tau: R.tau,
        reintentosCita: R.reintentosCita,
        comillasQuitadas: R.comillasQuitadas,
        podadas: R.podadas,
        citasSinRespaldo: R.citasSinRespaldo,
      },
    };
    return NextResponse.json(r);
  } catch (e) {
    console.error("[api/chat]", e);
    return NextResponse.json({ error: "fallo interno" }, { status: 500 });
  }
}
