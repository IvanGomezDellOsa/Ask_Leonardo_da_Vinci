/**
 * Verifica que Transformers.js produzca los MISMOS vectores que
 * sentence-transformers para `multilingual-e5-small`.
 *
 * Es la premisa de D-022 y no es negociable: el corpus se embebe offline en
 * Python y la consulta del usuario se embebe en el navegador con Transformers.js.
 * Si los dos lados no viven en el mismo espacio vectorial, el coseno no
 * significa nada, el gate umbraliza ruido y toda la calibracion de tau mide
 * ruido — sin que nada falle de forma visible.
 *
 * "No es un cambio que se pueda hacer despues": define la arquitectura desde el
 * dia 1. Por eso se verifica antes de escribir el motor de recuperacion.
 *
 * Referencia: pipeline/out/parity_python.json, generado con sentence-transformers.
 */

import { readFileSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";

const REF = JSON.parse(
  readFileSync(new URL("../pipeline/out/parity_python.json", import.meta.url), "utf8"),
) as { consultas: string[]; vecs: number[][] };

// Umbrales: por debajo de esto, la diferencia es aritmetica de punto flotante y
// no de modelo. Se compara tambien el coseno entre pares, que es lo que el
// sistema realmente usa.
const MIN_COSENO = 0.999;
const MAX_DIF_PAR = 0.005;

function coseno(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let p = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    p += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return p / (Math.sqrt(na) * Math.sqrt(nb));
}

const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");

const js: number[][] = [];
for (const texto of REF.consultas) {
  // e5 usa mean pooling y normalizacion L2, igual que sentence-transformers
  const salida = await extractor(texto, { pooling: "mean", normalize: true });
  js.push(Array.from(salida.data as Float32Array));
}

console.log(`consultas: ${REF.consultas.length} · dims: ${js[0].length}`);
console.log("");

let peorCoseno = 1;
for (let i = 0; i < REF.consultas.length; i++) {
  const c = coseno(REF.vecs[i], js[i]);
  peorCoseno = Math.min(peorCoseno, c);
  const etiqueta = c >= MIN_COSENO ? "ok  " : "MAL ";
  console.log(`  ${etiqueta} coseno python-js = ${c.toFixed(6)}   ${REF.consultas[i].slice(7, 62)}`);
}

// Lo que de verdad importa no es que los vectores sean identicos sino que las
// SIMILITUDES que produce el sistema lo sean: el gate compara consulta contra
// pasaje, no consulta contra consulta.
console.log("");
let peorPar = 0;
for (let i = 0; i < REF.consultas.length; i++) {
  for (let j = i + 1; j < REF.consultas.length; j++) {
    const dif = Math.abs(coseno(REF.vecs[i], REF.vecs[j]) - coseno(js[i], js[j]));
    peorPar = Math.max(peorPar, dif);
  }
}
console.log(`  peor coseno vector a vector : ${peorCoseno.toFixed(6)}  (minimo ${MIN_COSENO})`);
console.log(`  peor diferencia entre pares : ${peorPar.toFixed(6)}  (maximo ${MAX_DIF_PAR})`);

const ok = peorCoseno >= MIN_COSENO && peorPar <= MAX_DIF_PAR;
console.log("");
console.log(ok
  ? "PARIDAD CONFIRMADA — los dos lados comparten espacio vectorial (D-022)"
  : "SIN PARIDAD — D-022 no se sostiene y hay que replantear la arquitectura");
process.exit(ok ? 0 : 1);
