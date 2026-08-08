/**
 * Traduce al castellano los pasajes de Leonardo, UNA SOLA VEZ. Ver D-079.
 *
 *   npm run traducir -- --modelo deepseek-v4-flash
 *   npm run traducir -- --limite 20        (muestra, para revisar calidad)
 *
 * POR QUE EXISTE
 *
 * El corpus es Richter 1888, solo ingles. Hasta ahora el modelo traducia cada
 * cita AL VUELO, en cada respuesta, y eso trae tres problemas medidos:
 *
 *   1. NO SE PUEDE VERIFICAR. `evals/fidelidad_cita.ts` mide 94,3% de fidelidad
 *      literal en ingles y **nada** en castellano: comparar una traduccion
 *      improvisada contra el original ingles por caracteres es imposible. La
 *      mitad del producto quedaba sin metrica.
 *   2. NO ES FIABLE. 4,4% de las citas en castellano quedaban mezclando idiomas
 *      («primero tu ought to learn the limbs...»). Dos rondas de instrucciones
 *      cada vez mas explicitas no lo movieron; la segunda salio peor. Es limite
 *      de capacidad del modelo, no de redaccion (D-076).
 *   3. ES UNA SUPERFICIE DE INVENCION MAS. Traducir es reescribir, y reescribir
 *      en el mismo paso en que se genera es donde se cuelan las palabras que
 *      Leonardo no eligio.
 *
 * Traducir una vez, congelar y verificar es mas simple que pedirle al modelo que
 * acierte cada vez. Despues de esto el modelo CITA en vez de TRADUCIR, y el
 * `string match` de fidelidad funciona en los dos idiomas.
 *
 * LO QUE NO CAMBIA: los embeddings y el BM25 siguen en ingles, asi que la
 * recuperacion es identica. Esto solo agrega el texto que se le muestra al
 * modelo y al lector.
 *
 * HONESTIDAD SOBRE LA CADENA: el italiano de Leonardo -> el ingles de Richter
 * (1888) -> este castellano. Son tres eslabones y la pagina "Como funciona"
 * tiene que decirlo. Es la misma situacion de cualquier edicion traducida, pero
 * se declara en vez de disimularse.
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { deepseek } from "../src/lib/llm.js";
import { ART, RAIZ, claves, dormir, progreso } from "../evals/comun.js";

interface Chunk { id: string; voice: string; text: string; richterTitle: string | null; nWords: number }
interface Traduccion { id: string; texto: string; titulo: string | null }

const args = process.argv.slice(2);
const arg = (n: string, def: string): string => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const modelo = arg("modelo", "deepseek-v4-flash");
const limite = Number(arg("limite", "0"));
/** Palabras por lote. Con ~118 de promedio, 1.200 son ~10 chunks por llamada. */
const LOTE_PALABRAS = Number(arg("lote", "1200"));

const env = claves();
if (!env.DEEPSEEK_API_KEY) { console.error("falta DEEPSEEK_API_KEY en .env.local"); process.exit(1); }
const proveedor = deepseek(modelo, env.DEEPSEEK_API_KEY, {
  temperatura: 0, maxTokens: 8000, json: true,
});

/**
 * La instruccion. Se pide fidelidad y se prohibe explicitamente lo que un
 * traductor con ganas de lucirse haria: modernizar, completar, explicar o
 * embellecer. La gracia del proyecto es que las palabras sean las de el.
 */
const INSTRUCCIONES = `You translate Leonardo da Vinci's notebooks from J.P. Richter's 1888 English edition into Spanish. Reply with json only.

RULES, in order of importance:
1. FAITHFUL, NOT BEAUTIFUL. Translate what is there. Do not improve the prose, do not modernise the vocabulary, do not complete an unfinished thought, do not explain an obscure one. If the English is abrupt or strange, the Spanish is abrupt or strange.
2. KEEP THE REGISTER: a Renaissance craftsman writing notes to himself. Readable Spanish, not archaic pastiche, but never contemporary or casual.
3. PRESERVE STRUCTURE: same sentence boundaries where Spanish allows it. Do not merge or split sentences to make it flow better.
4. Keep bracketed editorial insertions like [the surface of] as brackets in Spanish.
5. Keep proper names as they appear. Do not add titles or honorifics that are not there.
6. Translate the whole text. Never leave a word in English.
7. Use "tú" forms, not "vos" or "usted": the original addresses an apprentice directly.

Input is a json array of objects with "id", "title" and "text". Output json with this exact shape, one entry per input id, in the same order:

{"traducciones":[{"id":"<the same id>","titulo":"<translated title, or null if the input title was null>","texto":"<translated text>"}]}`;

const chunks: Chunk[] = JSON.parse(readFileSync(new URL("chunks.json", ART), "utf8"));
const leo = chunks.filter((c) => c.voice === "leonardo");

const salida = new URL("chunks_es.jsonl", ART);
const hechos = new Set<string>();
if (existsSync(salida)) {
  for (const l of readFileSync(salida, "utf8").split("\n")) {
    if (l.trim()) { try { hechos.add((JSON.parse(l) as Traduccion).id); } catch { /* linea parcial */ } }
  }
}

let pendientes = leo.filter((c) => !hechos.has(c.id));
if (limite) pendientes = pendientes.slice(0, limite);

// Lotes por presupuesto de palabras, no por cantidad fija: los chunks van de 8 a
// 499 palabras y un lote de 10 largos desbordaria el maxTokens de salida.
const lotes: Chunk[][] = [];
let actual: Chunk[] = [], acum = 0;
for (const c of pendientes) {
  if (actual.length && acum + c.nWords > LOTE_PALABRAS) { lotes.push(actual); actual = []; acum = 0; }
  actual.push(c); acum += c.nWords;
}
if (actual.length) lotes.push(actual);

const palabras = pendientes.reduce((s, c) => s + c.nWords, 0);
console.log(`# Traduccion del corpus al castellano`);
console.log(`  modelo      : ${modelo}`);
console.log(`  chunks leo  : ${leo.length}`);
console.log(`  ya hechos   : ${hechos.size}`);
console.log(`  pendientes  : ${pendientes.length}   (${palabras.toLocaleString()} palabras, ${lotes.length} lotes)`);
console.log(`  coste aprox : ~US$${(palabras * 1.35 * 0.14 / 1e6 + palabras * 1.6 * 0.28 / 1e6).toFixed(3)}`);
if (!pendientes.length) { console.log("\n  nada que hacer."); process.exit(0); }

function extraerJson(s: string): { traducciones: Traduccion[] } {
  const limpio = s.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const i = limpio.indexOf("{"), j = limpio.lastIndexOf("}");
  if (i < 0 || j < 0) throw new Error(`sin JSON: ${s.slice(0, 120)}`);
  return JSON.parse(limpio.slice(i, j + 1));
}

/**
 * Se corre en paralelo porque en serie no termina nunca: un lote tarda ~1 minuto
 * y son ~143, o sea casi dos horas y media. DeepSeek no tiene limite de
 * requests por minuto ni por dia —solo concurrencia, 2.500 para flash— asi que
 * el cuello de botella es puramente la latencia por llamada.
 *
 * 8 en paralelo baja la corrida a ~20 minutos y queda dos ordenes de magnitud
 * por debajo del limite. No se sube mas porque no hace falta y porque un fallo
 * masivo con 100 en vuelo desperdicia mas tokens.
 */
const CONCURRENCIA = Number(arg("concurrencia", "8"));

const t0 = Date.now();
let n = 0, fallos = 0;

async function traducirLote(lote: Chunk[]): Promise<void> {
  const entrada = JSON.stringify(lote.map((c) => ({ id: c.id, title: c.richterTitle, text: c.text })));
  for (let intento = 0; intento < 4; intento++) {
    try {
      const r = await proveedor.generar(INSTRUCCIONES, [{ role: "user", content: entrada }]);
      const j = extraerJson(r.texto);
      /**
       * Se aceptan `texto`/`text` y `titulo`/`title` indistintamente.
       *
       * MEDIDO: 147 chunks fallaban con "faltan todos los ids" y la traduccion
       * estaba PERFECTA — el modelo devolvia `"text"` en vez de `"texto"`,
       * copiando el nombre del campo de la ENTRADA. La culpa era del esquema:
       * la entrada usaba nombres en ingles y la salida los pedia en castellano,
       * asi que el modelo mezclaba. Tolerar ambos es mas simple que pelear con
       * el modelo por un nombre de campo.
       */
      const campo = (t: Record<string, unknown> | undefined, es: string, en: string): string | null => {
        const v = (t?.[es] ?? t?.[en]);
        return typeof v === "string" && v.trim() ? v.trim() : null;
      };
      const porId = new Map((j.traducciones ?? []).map((t) => [t.id, t as unknown as Record<string, unknown>]));
      // Alineacion verificada por id, no por posicion: si el modelo se saltea
      // uno o reordena, se detecta aca en vez de corromper el corpus en silencio.
      const faltan = lote.filter((c) => !campo(porId.get(c.id), "texto", "text"));
      if (faltan.length) throw new Error(`faltan ${faltan.length}/${lote.length} ids en la respuesta`);
      for (const c of lote) {
        const t = porId.get(c.id);
        appendFileSync(salida, JSON.stringify({
          id: c.id,
          texto: campo(t, "texto", "text")!,
          titulo: campo(t, "titulo", "title"),
        }) + "\n", "utf8");
      }
      return;
    } catch (e) {
      if (intento === 3) {
        fallos += lote.length;
        process.stdout.write(`\n  ! lote fallido: ${String(e).slice(0, 120)}\n`);
      } else { await dormir(2000 * (intento + 1)); }
    }
  }
}

const cola = [...lotes];
await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, cola.length) }, async () => {
  for (;;) {
    const lote = cola.shift();
    if (!lote) return;
    await traducirLote(lote);
    n += lote.length;
    progreso(n, pendientes.length, `${lotes.length - cola.length}/${lotes.length} lotes`);
  }
}));

console.log(`\n  traducidos : ${n - fallos} / ${pendientes.length}`);
if (fallos) console.log(`  FALLIDOS   : ${fallos}  (volver a correr el mismo comando; es reanudable)`);
console.log(`  ${((Date.now() - t0) / 60000).toFixed(1)} minutos`);

// Se emite tambien como JSON indexado por id, que es como lo consume el prompt.
const todas: Traduccion[] = readFileSync(salida, "utf8").split("\n")
  .filter((l) => l.trim()).map((l) => JSON.parse(l));
const mapa: Record<string, { texto: string; titulo: string | null }> = {};
for (const t of todas) mapa[t.id] = { texto: t.texto, titulo: t.titulo };
writeFileSync(new URL("chunks_es.json", ART), JSON.stringify(mapa), "utf8");
console.log(`  -> artifacts/chunks_es.json  (${Object.keys(mapa).length} traducciones)`);
