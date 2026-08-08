/**
 * Cuanto del corpus es ALCANZABLE. Ver D-104.
 *
 *   npm run alcance
 *
 * LA PREGUNTA. D-099 midio que solo 193 chunks de 1.404 entran alguna vez al
 * top-3 de las 120 preguntas del eval set. Eso no prueba que el resto sea
 * inalcanzable —el eval set no cubre el corpus— pero deja la pregunta abierta, y
 * es la pregunta que gobierna la Fase 4: si un tema no se puede recuperar ni
 * preguntandolo por su nombre, ninguna pregunta sugerida sobre ese tema puede
 * cumplir lo que promete.
 *
 * LA PRUEBA, y es la mas barata que hay. Se le pregunta al sistema por cada tema
 * **usando el titulo que Richter le puso**, y se mira si recupera los pasajes de
 * ese mismo titulo. Es un piso, no un techo: si un tema no se recupera ni con su
 * propio nombre, no se va a recuperar con una pregunta parafraseada.
 *
 * LA VERDAD NO SE PARSEA DE NINGUN LADO. El rango de un titulo son los
 * `richterNos` de sus propios chunks — el dato ya esta en el corpus. No hay
 * etiqueta humana, no hay juicio, no hay `expected_topic` que interpretar: es el
 * unico instrumento del proyecto cuya verdad no la escribio nadie.
 *
 * SIRVE PARA DOS COSAS: medir la salud del retrieval sobre el corpus entero
 * —1.404 chunks, no 120 preguntas— y dar el pool validado de temas del que la
 * puerta de entrada puede sacar sugerencias (paso 20, D-102).
 */

import { writeFileSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";
import { Corpus } from "../src/lib/retrieval.js";
import { cargarMotor, decidirCon, type Idioma } from "../src/lib/grounding.js";

const ART = new URL("../artifacts/", import.meta.url);
/** Un índice por idioma (D-107): se mide lo que el producto hace de verdad. */
const motor = cargarMotor(ART);
const corpus = motor.por.en.corpus;
const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");
const embeber = async (t: string): Promise<Float32Array> =>
  (await extractor("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

/** Un tema = un `richterTitle`, con los numeros de sus propios chunks. */
interface Tema { titulo: string; tituloEs: string | null; nums: Set<number>; chunks: number; palabras: number }
const temas = new Map<string, Tema>();
for (const f of corpus.filasPorVoz.leonardo) {
  const c = corpus.chunks[f];
  if (!c.richterTitle) continue;
  const t = temas.get(c.richterTitle) ?? {
    titulo: c.richterTitle, tituloEs: c.tituloEs ?? null,
    nums: new Set<number>(), chunks: 0, palabras: 0,
  };
  for (const n of c.richterNos) t.nums.add(n);
  t.chunks++; t.palabras += c.nWords;
  temas.set(c.richterTitle, t);
}

/**
 * El titulo se limpia del rango entre parentesis antes de usarlo como consulta.
 * "On Flying machines (1122-1126)" se le pregunta como "On Flying machines": los
 * numeros son aparato de Richter, no algo que un usuario escribiria.
 *
 * DOS TITULOS SON **SOLO** UN RANGO —"(832. 833)" y "(1165-1170)"— y limpiarlos
 * los dejaba en cadena vacia. La primera corrida los conto como inalcanzables y
 * los puso entre los temas mas grandes que fallan: 693 palabras de un tema que
 * nunca se consulto. **Un instrumento que le pregunta al corpus por la nada y
 * anota que no contesta**, que es la misma familia de todo lo demas — solo que
 * esta vez tardo cinco minutos en aparecer y no dos dias.
 *
 * Si limpiar deja vacio, se consulta el titulo tal cual.
 */
const comoConsulta = (t: string): string => {
  const limpio = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return limpio || t.trim();
};

console.log(`\n# Alcance del corpus — ${temas.size} temas de Richter\n`);
console.log(`Se le pregunta a cada tema por su propio nombre y se mira si recupera`);
console.log(`sus propios pasajes. Es un piso: si no se recupera asi, menos aún con`);
console.log(`una pregunta parafraseada.\n`);

interface Fila { tema: Tema; alcanza: Record<Idioma, boolean>; abstiene: Record<Idioma, boolean>; margen: number }
const filas: Fila[] = [];
let i = 0;
for (const t of temas.values()) {
  const alcanza = {} as Record<Idioma, boolean>;
  const abstiene = {} as Record<Idioma, boolean>;
  let margen = Infinity;
  for (const idioma of ["es", "en"] as Idioma[]) {
    // En castellano se usa el titulo traducido si existe; si no, el ingles.
    const texto = comoConsulta(idioma === "es" && t.tituloEs ? t.tituloEs : t.titulo);
    const d = decidirCon(motor, texto, await embeber(texto), idioma, 3);
    if (d.tipo !== "responde") { alcanza[idioma] = false; abstiene[idioma] = true; margen = Math.min(margen, -1); continue; }
    abstiene[idioma] = false;
    alcanza[idioma] = d.pasajes.some((p) => p.chunk.richterNos.some((n) => t.nums.has(n)));
    margen = Math.min(margen, d.cosMax - d.tau);
  }
  filas.push({ tema: t, alcanza, abstiene, margen });
  if (++i % 50 === 0) process.stdout.write(`\r  ${i}/${temas.size}   `);
}
process.stdout.write("\r".padEnd(30) + "\r");

const ambos = filas.filter((f) => f.alcanza.es && f.alcanza.en);
const soloUno = filas.filter((f) => (f.alcanza.es ? 1 : 0) + (f.alcanza.en ? 1 : 0) === 1);
const ninguno = filas.filter((f) => !f.alcanza.es && !f.alcanza.en);
const abst = filas.filter((f) => f.abstiene.es || f.abstiene.en);
const pct = (n: number) => `${((n / filas.length) * 100).toFixed(0)}%`;

console.log(`| | temas | |`);
console.log(`|---|---:|---:|`);
console.log(`| **alcanzable en los dos idiomas** | ${ambos.length} | ${pct(ambos.length)} |`);
console.log(`| alcanzable en uno solo | ${soloUno.length} | ${pct(soloUno.length)} |`);
/**
 * EL DESGLOSE PRUEBA UNA PREDICCION DE D-103. Ahi se midio que BM25 sin stemmer
 * puede arruinar un orden denso perfecto en INGLES —el caso del vuelo— mientras
 * que en castellano no aporta nada y el denso sobrevive intacto. Si eso es
 * general y no una anecdota, los temas de un solo idioma tienen que inclinarse
 * hacia "solo castellano". Es la unica prediccion falsable que salio de D-103.
 */
const soloEs = soloUno.filter((f) => f.alcanza.es).length;
console.log(`| · sólo castellano | ${soloEs} | |`);
console.log(`| · sólo inglés | ${soloUno.length - soloEs} | |`);
console.log(`| **no se alcanza en ninguno** | ${ninguno.length} | ${pct(ninguno.length)} |`);
console.log(`| (de esos, el gate se abstiene) | ${abst.length} | ${pct(abst.length)} |`);

const palAmbos = ambos.reduce((a, f) => a + f.tema.palabras, 0);
const palTotal = filas.reduce((a, f) => a + f.tema.palabras, 0);
console.log(`\nPor peso de texto: ${palAmbos} de ${palTotal} palabras viven en temas`);
console.log(`alcanzables en los dos idiomas (${((palAmbos / palTotal) * 100).toFixed(0)}%).\n`);

console.log(`## Los 15 temas más grandes que NO se alcanzan en ninguno de los dos\n`);
for (const f of ninguno.sort((a, b) => b.tema.palabras - a.tema.palabras).slice(0, 15)) {
  console.log(`  ${String(f.tema.palabras).padStart(5)} palabras · ${f.tema.chunks} chunks · ${f.tema.titulo.slice(0, 62)}`);
}

/** El pool para la puerta de entrada: alcanzable en los dos, y con sustancia. */
const pool = ambos
  .filter((f) => f.tema.palabras >= 150)
  .sort((a, b) => b.margen - a.margen);
writeFileSync("artifacts/alcance.json", JSON.stringify({
  regla: "Se consulta cada título de Richter por su propio nombre y se comprueba que el top-3 traiga sus propios pasajes, en es y en. La verdad son los richterNos del propio tema: no hay etiqueta humana. Ver D-104.",
  generado: new Date().toISOString().slice(0, 10),
  resumen: { temas: filas.length, ambos: ambos.length, soloUno: soloUno.length, ninguno: ninguno.length },
  pool: pool.map((f) => ({
    titulo: f.tema.titulo, tituloEs: f.tema.tituloEs,
    chunks: f.tema.chunks, palabras: f.tema.palabras,
    margenMinimo: Number(f.margen.toFixed(4)),
  })),
}, null, 2) + "\n");

console.log(`\n## Pool para la puerta de entrada\n`);
console.log(`  ${pool.length} temas alcanzables en los dos idiomas y con ≥150 palabras.`);
console.log(`  escrito: artifacts/alcance.json`);
