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
  groq, gemini, type Proveedor,
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

// Gemini free tier no comparte el limite de Groq. El presupuesto de 6.000 TPM
// es el de D-023 y solo aplica a Groq; para Gemini se usa una ventana holgada y
// se confia en el reintento ante 429.
const presupuesto = new PresupuestoTpm(idProveedor.startsWith("groq") ? 6000 : 60_000);

// ---- estado ------------------------------------------------------------
const salida = abrirSalida(`${etiqueta}.jsonl`);
const hechos = new Set(leerJsonl<Resultado>(salida.url).map((r) => r.id));
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
console.log(`  casos          : ${casos.length}`);
console.log(`  ya hechos      : ${hechos.size}   (se saltean)`);
console.log(`  pendientes     : ${pendientes.length}`);
console.log(`  salida         : ${salida.url.pathname.split("/").pop()}`);
if (!pendientes.length) { console.log("\n  nada que hacer."); process.exit(0); }

// ---- motor -------------------------------------------------------------
const corpus = modo === "rag" ? new Corpus(ART) : null;
const umbrales = modo === "rag" ? cargarUmbrales(ART) : null;
const extractor = modo === "rag"
  ? await pipeline("feature-extraction", "Xenova/multilingual-e5-small")
  : null;

async function embeber(texto: string): Promise<Float32Array> {
  const s = await extractor!("query: " + texto, { pooling: "mean", normalize: true });
  return s.data as Float32Array;
}

async function generar(system: string, msgs: { role: string; content: string }[]) {
  const estimado = estimarTokens(system + msgs.map((m) => m.content).join("")) + 300;
  await esperarCapacidad(presupuesto, estimado,
    (uso) => process.stdout.write(`\n  … esperando ventana de TPM (${uso}/6000)\n`));
  for (let intento = 0; intento < 5; intento++) {
    try {
      const r = await proveedor.generar(system, msgs);
      presupuesto.registrar(r.tokensEntrada + r.tokensSalida);
      return r;
    } catch (e) {
      const st = (e as Error & { status?: number }).status;
      if (st !== 429 && (st ?? 0) < 500) throw e;
      // 429 o 5xx: backoff. No se pasa al siguiente proveedor a proposito — el
      // paso 18 compara proveedores, asi que cada corrida mide UNO solo.
      await new Promise((r) => setTimeout(r, 5000 * (intento + 1)));
    }
  }
  throw new Error("agotados los reintentos");
}

// ---- corrida -----------------------------------------------------------
const t0 = Date.now();
let n = 0;
for (const c of pendientes) {
  const t = Date.now();
  const base = { id: c.id, modo, proveedor: idProveedor, k } as const;
  try {
    if (modo === "baseline") {
      // Sin retrieval y sin gate: el chatbot de personaje parametrico (paso 15).
      const { system, messages } = construirPromptSinRag(c.q, [], c.lang);
      const r = await generar(system, messages);
      salida.escribir({
        ...base, decision: "responde", cosMax: null, tau: null, pasajes: [],
        notasRichter: [], respuesta: r.texto, tokensEntrada: r.tokensEntrada,
        tokensSalida: r.tokensSalida, ms: Date.now() - t,
      } satisfies Resultado);
    } else {
      const d = decidir(corpus!, umbrales!, c.q, await embeber(c.q), c.lang, k);
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
  } catch (e) {
    // Se registra el fallo en vez de abortar: al reanudar hay que poder ver
    // que caso rompio y por que.
    salida.escribir({
      ...base, decision: "error", cosMax: null, tau: null, pasajes: [],
      notasRichter: [], respuesta: "", tokensEntrada: 0, tokensSalida: 0,
      ms: Date.now() - t, error: String(e).slice(0, 300),
    } satisfies Resultado);
    process.stdout.write(`\n  ! ${c.id}: ${String(e).slice(0, 120)}\n`);
  }
  progreso(++n, pendientes.length, `${c.id}  ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

console.log(`\n  listo en ${((Date.now() - t0) / 60000).toFixed(1)} minutos.`);
console.log(`  siguiente: npm run evals:verificar-respuestas -- --entrada ${etiqueta}.jsonl`);
