/**
 * Corre el eval set contra el motor real. Paso 14 de `08` (y 15, 17 y 18, que
 * son la misma corrida con otros parametros).
 *
 *   npm run evals -- --modo rag                       las 120 con RAG
 *   npm run evals -- --modo baseline                  la linea de base (paso 15)
 *   npm run evals -- --modo rag --k 5                 k=3 vs k=5 (paso 17)
 *   npm run evals -- --modo rag --proveedor gemini/gemini-3.6-flash   (paso 18)
 *   npm run evals -- --modo rag --limite 20 --etiqueta piloto         (D-064)
 *
 * Escribe una fila por caso a `evals/out/<etiqueta>.jsonl` APENAS la tiene, y al
 * reanudar saltea las que ya estan. Una corrida completa son ~30 minutos de
 * reloj contra el limite de 6.000 TPM (D-023): perderla entera por un corte no
 * es aceptable.
 *
 * Este script NO juzga nada. Genera y registra. La verificacion es un paso
 * aparte y con otro modelo (`06` v3 punto 5, D-063).
 */

import { pipeline } from "@huggingface/transformers";
import { Corpus } from "../src/lib/retrieval.js";
import { cargarUmbrales, decidir } from "../src/lib/grounding.js";
import {
  PresupuestoTpm, construirPrompt, construirPromptSinRag, estimarTokens,
  groq, gemini, huellaPrompt, huellaVigente, type Proveedor, type CuotaAgotada,
} from "../src/lib/llm.js";
import {
  ART, cargarCasos, leerJsonl, abrirSalida, claves, esperarCapacidad, progreso,
  type Caso, type Resultado,
} from "./comun.js";

// ---- argumentos --------------------------------------------------------
const args = process.argv.slice(2);
const arg = (n: string, def: string): string => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const modo = arg("modo", "rag") as "rag" | "baseline";
const k = Number(arg("k", "3"));
const idProveedor = arg("proveedor", "groq/llama-3.3-70b-versatile");
const limite = Number(arg("limite", "0"));
const etiqueta = arg("etiqueta", `${modo}-k${k}-${idProveedor.replace(/[/.]/g, "_")}`);

// ---- proveedor ---------------------------------------------------------
const env = claves();
function construirProveedor(id: string): Proveedor {
  const [fam, ...resto] = id.split("/");
  const modelo = resto.join("/");
  if (fam === "groq") {
    if (!env.GROQ_API_KEY) throw new Error("falta GROQ_API_KEY en .env.local");
    return groq(modelo, env.GROQ_API_KEY);
  }
  if (fam === "gemini") {
    if (!env.GEMINI_API_KEY_A) throw new Error("falta GEMINI_API_KEY_A en .env.local");
    return gemini(modelo, env.GEMINI_API_KEY_A);
  }
  throw new Error(`proveedor desconocido: ${id}`);
}
const proveedor = construirProveedor(idProveedor);
const HUELLA = huellaPrompt();

// Gemini free tier no comparte el limite de Groq. El presupuesto de 6.000 TPM
// es el de D-023 y solo aplica a Groq; para Gemini se usa una ventana holgada y
// se confia en el reintento ante 429.
// MEDIDO el 2026-08-04 en los headers de Groq para llama-3.3-70b-versatile:
//   x-ratelimit-limit-tokens: 12000     <- D-023 asume 6.000
//   x-ratelimit-limit-requests: 1000
// D-023 fijo 6.000 TPM leyendo la documentacion del free tier. El limite real
// de ESTE modelo es el doble, asi que el presupuesto nos estaba estrangulando a
// la mitad de la capacidad disponible. Se deja configurable y se documenta que
// es un valor medido por modelo, no una constante del proveedor.
const TPM = Number(arg("tpm", idProveedor.startsWith("groq") ? "12000" : "60000"));
const presupuesto = new PresupuestoTpm(TPM);

// ---- estado ------------------------------------------------------------
const salida = abrirSalida(`${etiqueta}.jsonl`);
// Las filas con `error` NO cuentan como hechas: si contaran, reanudar saltearia
// justo los casos que fallaron y la corrida quedaria incompleta para siempre,
// con un resumen que igual da un numero. Se reintentan.
// Y tampoco cuentan las filas de un PROMPT distinto al actual. `run.ts` ya
// estampaba la huella pero no la miraba al reanudar: si el prompt del generador
// cambiara (paso 19), reanudar habria salteado las filas viejas y la corrida
// habria mezclado dos prompts en un mismo numero. Es el mismo bug que D-070
// encontro en el juez, en su gemelo del generador.
const previas = leerJsonl<Resultado>(salida.url);
const hechos = new Set(
  previas.filter((r) => r.decision !== "error" && huellaVigente(r.prompt))
    .map((r) => r.id));
const aReintentar = previas.filter((r) => r.decision === "error").length;
const dePromptViejo = previas.filter(
  (r) => r.decision !== "error" && !huellaVigente(r.prompt)).length;
let casos = cargarCasos();
if (limite > 0) {
  // Piloto de D-064: una muestra que toque las seis categorias, no las primeras N.
  const porCat = new Map<string, Caso[]>();
  for (const c of casos) porCat.set(c.category, [...(porCat.get(c.category) ?? []), c]);
  const cupo = Math.max(1, Math.floor(limite / porCat.size));
  casos = [...porCat.values()].flatMap((cs) => cs.slice(0, cupo)).slice(0, limite);
}
const pendientes = casos.filter((c) => !hechos.has(c.id));

console.log(`# Eval — modo ${modo} · k=${k} · ${idProveedor}`);
console.log(`  prompt         : ${HUELLA}`);
console.log(`  presupuesto    : ${TPM} TPM`);
console.log(`  casos          : ${casos.length}`);
console.log(`  ya hechos      : ${hechos.size}   (se saltean)`);
if (aReintentar) console.log(`  con error      : ${aReintentar}   (se reintentan)`);
if (dePromptViejo) console.log(`  DE PROMPT VIEJO: ${dePromptViejo}   (se regeneran; el prompt cambio)`);
console.log(`  pendientes     : ${pendientes.length}`);
console.log(`  salida         : ${salida.url.pathname.split("/").pop()}`);

/**
 * Presupuesto ESTIMADO antes de gastar un token.
 *
 * El limite que rompio la corrida anterior no fue el de por minuto sino el
 * DIARIO, y se rompio sin que nadie lo viera venir: tres corridas del piloto
 * (13 casos cada una) se comieron ~51.000 tokens —la mitad del tope diario—
 * antes de que empezara la medicion de verdad. Un aviso de dos lineas antes de
 * arrancar habria evitado perder el dia.
 *
 * TPD del free tier de Groq para llama-3.3-70b-versatile: ~100.000.
 */
const TPD = Number(arg("tpd", "100000"));
const COSTE_CASO = 1400;   // medido: ~1.100 de entrada + ~300 de salida
const costeEstimado = pendientes.length * COSTE_CASO;
console.log(`  coste estimado : ~${costeEstimado.toLocaleString()} tokens ` +
            `(${pendientes.length} casos x ~${COSTE_CASO})`);
if (costeEstimado > TPD) {
  console.log(`\n  AVISO: la estimacion supera el tope diario (~${TPD.toLocaleString()} tokens).`);
  console.log("  La corrida se va a cortar a mitad de camino. Corre por partes, o ajusta --tpd.");
}

if (!pendientes.length) { console.log("\n  nada que hacer."); process.exit(0); }

// ---- motor -------------------------------------------------------------
// Los dos modos cargan el motor: la linea de base no usa los pasajes para
// generar, pero si los registra para que el verificador la juzgue con la misma
// vara que al RAG.
const corpus = new Corpus(ART);
const umbrales = cargarUmbrales(ART);
const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");

async function embeber(texto: string): Promise<Float32Array> {
  const s = await extractor("query: " + texto, { pooling: "mean", normalize: true });
  return s.data as Float32Array;
}

async function generar(system: string, msgs: { role: string; content: string }[]) {
  const estimado = estimarTokens(system + msgs.map((m) => m.content).join("")) + 300;
  await esperarCapacidad(presupuesto, estimado,
    (uso) => process.stdout.write(`\n  … esperando ventana de TPM (${uso}/6000)\n`));
  let ultimo = "";
  // 3 intentos, 28 s como mucho. La version de 8 intentos con backoff hasta 2
  // min tardaba 8,1 MINUTOS por caso y fallaba igual: estaba esperando a que se
  // liberara una ventana por minuto, pero el limite que se habia agotado era el
  // DIARIO (TPD), que no se libera hasta el dia siguiente. Esperar mas no
  // arregla un limite diario; solo quema tiempo. Ver `abortarSiCuotaAgotada`.
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await proveedor.generar(system, msgs);
      presupuesto.registrar(r.tokensEntrada + r.tokensSalida);
      return r;
    } catch (e) {
      const st = (e as Error & { status?: number }).status;
      const cuota = (e as Error & { cuotaAgotada?: CuotaAgotada }).cuotaAgotada;
      // La cuota DIARIA no se libera reintentando. El cuerpo del 429 la reporta
      // directo ("Limit 100000, Used 99398, try again in 6m32s"); creerle en el
      // primer aviso, en vez de gastar 3 intentos a ciegas, es lo que evita
      // repetir la maratón de 3 horas del 2026-08-03.
      if (cuota) throw Object.assign(e as Error, { cuotaAgotada: cuota });
      ultimo = `${st ?? "sin status"}: ${String(e).slice(0, 160)}`;
      if (st !== 429 && (st ?? 0) < 500) throw e;
      // 429 o 5xx: backoff. No se pasa al siguiente proveedor a proposito — el
      // paso 18 compara proveedores, asi que cada corrida mide UNO solo.
      await new Promise((r) => setTimeout(r, 4000 * 2 ** intento));
    }
  }
  // El motivo del ultimo fallo va en el mensaje: "agotados los reintentos" a
  // secas no deja diagnosticar contra que limite se choco.
  throw new Error(`agotados los reintentos — ultimo fallo ${ultimo}`);
}

// ---- corrida -----------------------------------------------------------
/**
 * Corta la corrida cuando la cuota se agoto de verdad.
 *
 * No parsea el mensaje del proveedor —cada uno lo escribe distinto— sino que
 * cuenta FALLOS CONSECUTIVOS. Un 429 suelto es una rafaga y se reintenta; tres
 * casos seguidos que agotan sus reintentos significan que no queda cuota, y
 * seguir es quemar horas para escribir filas de error.
 *
 * Es la diferencia entre enterarse en 90 segundos o en 6 horas: la corrida
 * anterior gasto ~3 h reintentando contra un limite diario ya agotado.
 */
const MAX_FALLOS_SEGUIDOS = 3;
let fallosSeguidos = 0;

const t0 = Date.now();
let n = 0;
for (const c of pendientes) {
  const t = Date.now();
  const base = { id: c.id, modo, proveedor: idProveedor, k, prompt: HUELLA } as const;
  try {
    if (modo === "baseline") {
      // Sin retrieval y sin gate: el chatbot de personaje parametrico (paso 15).
      //
      // Pero SI se registran los pasajes que el retrieval habria devuelto, sin
      // meterlos en el prompt. No es un detalle: el verificador juzga cada
      // respuesta contra los pasajes de su fila, asi que sin esto la linea de
      // base se mediria contra evidencia vacia —donde todo es no fundamentado
      // por definicion— y el numero del README compararia dos varas distintas.
      // Con esto, las dos condiciones se juzgan con la MISMA vara y lo unico
      // que cambia es si el generador vio los pasajes o no.
      const d = decidir(corpus, umbrales, c.q, await embeber(c.q), c.lang, k);
      const pasajes = d.tipo === "responde"
        ? d.pasajes.flatMap((p) => p.chunk.richterNos) : [];
      const { system, messages } = construirPromptSinRag(c.q, [], c.lang);
      const r = await generar(system, messages);
      salida.escribir({
        ...base, decision: "responde", cosMax: null, tau: null, pasajes,
        notasRichter: [], respuesta: r.texto, tokensEntrada: r.tokensEntrada,
        tokensSalida: r.tokensSalida, ms: Date.now() - t,
      } satisfies Resultado);
    } else {
      const d = decidir(corpus, umbrales, c.q, await embeber(c.q), c.lang, k);
      if (d.tipo === "curada") {
        salida.escribir({
          ...base, decision: "curada", cosMax: null, tau: null, pasajes: [],
          notasRichter: d.nota.map((x) => x.chunk.id), respuesta: "",
          tokensEntrada: 0, tokensSalida: 0, ms: Date.now() - t,
        } satisfies Resultado);
      } else if (d.tipo === "abstiene") {
        salida.escribir({
          ...base, decision: "abstiene", cosMax: d.cosMax, tau: d.tau, pasajes: [],
          notasRichter: d.evidencia.map((x) => x.chunk.id), respuesta: "",
          tokensEntrada: 0, tokensSalida: 0, ms: Date.now() - t,
        } satisfies Resultado);
      } else {
        const { system, messages } = construirPrompt(
          c.q, d.pasajes.map((p) => ({ ...p.chunk })), [], c.lang);
        const r = await generar(system, messages);
        salida.escribir({
          ...base, decision: "responde", cosMax: d.cosMax, tau: d.tau,
          pasajes: d.pasajes.flatMap((p) => p.chunk.richterNos),
          notasRichter: (d.notas as { id: string }[]).map((x) => x.id),
          respuesta: r.texto, tokensEntrada: r.tokensEntrada,
          tokensSalida: r.tokensSalida, ms: Date.now() - t,
        } satisfies Resultado);
      }
    }
    fallosSeguidos = 0;
  } catch (e) {
    // NO se registra este como fallo del CASO: es la cuota del PROVEEDOR. Una
    // fila "error" aca marcaria un caso perfectamente respondible como si algo
    // le pasara a el, y el proximo `should_abstain` optimista de D-062 tomaria
    // esa fila vacia como evidencia. Se corta la corrida entera sin escribir
    // nada, y el caso sigue "pendiente" para la proxima corrida.
    const cuota = (e as Error & { cuotaAgotada?: CuotaAgotada }).cuotaAgotada;
    if (cuota) {
      const min = Math.ceil(cuota.esperaSegundos / 60);
      console.log(`\n\n  CORTE: cuota diaria de ${idProveedor} agotada ` +
                  `(${cuota.usado.toLocaleString()}/${cuota.limite.toLocaleString()} tokens).`);
      console.log(`  El proveedor pide esperar ~${min} min. Es una ventana RODANTE de 24 h`);
      console.log("  (D-068): no resetea a medianoche, se libera de a poco. Reintentar ahora");
      console.log("  no ayuda; correr el mismo comando en un rato reanuda donde quedo.");
      console.log(`\n  Hechos hasta aca: ${hechos.size + n} de ${casos.length}.`);
      process.exit(2);
    }
    // Se registra el fallo en vez de abortar: al reanudar hay que poder ver
    // que caso rompio y por que.
    salida.escribir({
      ...base, decision: "error", cosMax: null, tau: null, pasajes: [],
      notasRichter: [], respuesta: "", tokensEntrada: 0, tokensSalida: 0,
      ms: Date.now() - t, error: String(e).slice(0, 300),
    } satisfies Resultado);
    process.stdout.write(`\n  ! ${c.id}: ${String(e).slice(0, 120)}\n`);
    if (++fallosSeguidos >= MAX_FALLOS_SEGUIDOS) {
      console.log(`\n\n  CORTE: ${fallosSeguidos} casos seguidos agotaron sus reintentos.`);
      console.log("  La cuota diaria del proveedor esta agotada — reintentar no la devuelve.");
      console.log(`  Hechos hasta aca: ${hechos.size + n - fallosSeguidos} de ${casos.length}.`);
      console.log("  Volve a correr el mismo comando cuando resetee: reanuda donde quedo.");
      break;
    }
  }
  progreso(++n, pendientes.length, `${c.id}  ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

console.log(`\n  listo en ${((Date.now() - t0) / 60000).toFixed(1)} minutos.`);
console.log(`  siguiente: npm run evals:verificar-respuestas -- --entrada ${etiqueta}.jsonl`);
