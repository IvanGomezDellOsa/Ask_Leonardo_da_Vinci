/**
 * Construye el indice de embeddings. Ver D-097.
 *
 *   npx tsx tools/indexar.ts --modelo Xenova/multilingual-e5-base --salida artifacts/e5base
 *
 * ESTE SCRIPT FALTABA EN EL REPO. El indice (`artifacts/index.bin` +
 * `index_meta.json`) existia desde la Fase 1 pero **el codigo que lo genero no
 * estaba versionado**: solo el lector, en `retrieval.ts`. Es decir que el
 * artefacto mas caro de reproducir del proyecto no era reproducible.
 *
 * Se escribe ahora porque hace falta para comparar modelos de embedding, pero el
 * motivo para dejarlo es otro: un artefacto que no se puede regenerar es un
 * artefacto que no se puede auditar.
 *
 * FORMATO, dictado por lo que `Corpus` espera leer:
 *   index.bin       Int8Array de count*dims, cuantizado con `scale`
 *   index_meta.json { model, dims, scale, count, queryPrefix, ids, voice }
 *
 * La cuantizacion a int8 es de D-022: 2.062 vectores de 384 dims en float32 son
 * 3 MB, en int8 son 790 KB. Importa porque el indice viaja al navegador.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";

const arg = (n: string, d = ""): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const modelo = arg("modelo", "Xenova/multilingual-e5-small");
const salida = arg("salida", "artifacts");
const PREF_CONSULTA = "query: ";
const PREF_PASAJE = "passage: ";

interface Chunk { id: string; text: string; voice: string; richterTitle: string | null }
const chunks: Chunk[] = JSON.parse(readFileSync("artifacts/chunks.json", "utf8"));

/**
 * `--idioma es` construye el indice sobre la TRADUCCION (`chunks_es.json`), para
 * que una consulta en castellano busque contra texto en castellano. Ver D-105.
 *
 * POR QUE. Medido en D-104: 40 temas se alcanzan solo en ingles y 7 solo en
 * castellano. El hueco es cross-lingue y es estructural — la consulta va en un
 * idioma y el indice esta en el otro. D-038 lo habia visto de refilon (el
 * castellano puntua ~0,05 mas bajo) pero lo trato como una constante a calibrar
 * en tau, no como algo que se pudiera arreglar.
 *
 * La traduccion existe desde D-079 y `retrieval.ts` dice explicito que "NO
 * participa de la recuperacion": se hizo para que Leonardo pudiera CITAR en
 * castellano. Esto la pone a buscar tambien.
 *
 * El orden de las filas es el MISMO que el del indice ingles —se recorre
 * `chunks.json`— asi que `chunks.json`, `bm25.json` y los ids siguen valiendo y
 * un `Corpus` apuntado a esta carpeta funciona sin cambiarle nada.
 */
const idioma = arg("idioma", "en");
let traduccion: Record<string, { texto: string; titulo: string | null }> = {};
if (idioma === "es") {
  traduccion = JSON.parse(readFileSync("artifacts/chunks_es.json", "utf8"));
  const faltan = chunks.filter((c) => !traduccion[c.id]).length;
  console.log(`idioma : es (traducción; ${chunks.length - faltan} de ${chunks.length} traducidos)`);
  if (faltan) console.log(`         ${faltan} sin traducir: se embeben en inglés`);
}

console.log(`\nmodelo : ${modelo}`);
console.log(`chunks : ${chunks.length}`);

const extractor = await pipeline("feature-extraction", modelo);

/**
 * SE EMBEBE `richterTitle + ". " + text`, no el texto solo. Ver D-025.
 *
 * Los 651 titulos tematicos que Richter escribio son un campo de primera clase:
 * 178 pasajes tienen menos de 15 palabras y son casi inembebibles solos. Medido
 * por accidente al escribir este script, que al principio embebia solo `text`:
 * los casos que fallan del todo pasan de 2 a 7 sobre 30. **El titulo vale mas
 * que el modelo** — triplica los fallos quitarlo, con todo lo demas igual.
 */
const vectores: Float32Array[] = [];
const t0 = Date.now();
for (const [i, c] of chunks.entries()) {
  // Si hay traduccion se usa titulo Y texto traducidos: mezclar un titulo ingles
  // con un cuerpo castellano seria un tercer idioma que no es ninguno de los dos.
  const t = traduccion[c.id];
  const titulo = t ? t.titulo : c.richterTitle;
  const cuerpo = t ? t.texto : c.text;
  const tit = titulo ? titulo + ". " : "";
  const s = await extractor(`${PREF_PASAJE}${tit}${cuerpo}`, { pooling: "mean", normalize: true });
  vectores.push(Float32Array.from(s.data as Float32Array));
  if ((i + 1) % 100 === 0) {
    const seg = (Date.now() - t0) / 1000;
    const falta = (seg / (i + 1)) * (chunks.length - i - 1);
    process.stdout.write(`\r  ${i + 1}/${chunks.length}  · faltan ~${Math.round(falta / 60)} min   `);
  }
}
process.stdout.write("\n");

const dims = vectores[0].length;

/**
 * `scale` = 127 fijo. Los vectores vienen normalizados a norma 1, asi que cada
 * componente cae en [-1,1] y multiplicar por 127 usa el rango entero de int8 sin
 * clipear. `Corpus` divide por `scale` y renormaliza al leer.
 */
const scale = 127;
const crudo = new Int8Array(chunks.length * dims);
for (let i = 0; i < vectores.length; i++) {
  for (let d = 0; d < dims; d++) {
    crudo[i * dims + d] = Math.max(-127, Math.min(127, Math.round(vectores[i][d] * scale)));
  }
}

mkdirSync(salida, { recursive: true });
writeFileSync(`${salida}/index.bin`, Buffer.from(crudo.buffer));
writeFileSync(`${salida}/index_meta.json`, JSON.stringify({
  model: modelo.replace(/^Xenova\//, "intfloat/"),
  dims, scale, count: chunks.length,
  queryPrefix: PREF_CONSULTA,
  ids: chunks.map((c) => c.id),
  voice: chunks.map((c) => c.voice),
}));

console.log(`\ndims   : ${dims}`);
console.log(`escrito: ${salida}/index.bin  (${(crudo.length / 1024).toFixed(0)} KB)`);
console.log(`         ${salida}/index_meta.json`);
