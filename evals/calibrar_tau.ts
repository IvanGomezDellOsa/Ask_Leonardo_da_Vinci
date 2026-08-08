/**
 * Recalibra tau contra el eval set. Paso 16 del roadmap. Ver D-100.
 *
 *   npm run evals:calibrar
 *
 * POR QUE RECIEN AHORA. `artifacts/thresholds.json` dice `"provisional": true`
 * desde la Fase 1, con la nota «la Fase 3 recalibra con el eval set». La Fase 3
 * se cerro sin hacerlo, y no por olvido: se asumia que calibrar requeria correr
 * el eval. **No lo requiere.** `cosMax` sale del retrieval y `should_abstain`
 * esta etiquetado; es el mismo argumento de D-096 y de `compuerta.ts`. Offline,
 * sin API, en el tiempo que tarda en embeber 120 consultas.
 *
 * EL PROTOCOLO ES EL DE D-062 Y NO SE INVENTA NADA ACA:
 *
 *   dentro   A + B      son las que el pre-filtro NO puede perder
 *   fuera    C + D      son las que deberia frenar
 *   aparte   E + F      NO entran a la calibracion, y esto es lo importante
 *
 * **Por que E y F quedan afuera, que es la parte contraintuitiva.** Las dos
 * tienen `should_abstain: true`, asi que la tentacion es contarlas como "fuera".
 * Seria un error medido: los casos F recuperan material REAL de Leonardo —
 * «¿Como eras fisicamente?» puntua 0,8089 contra tau_es 0,7808 y **debe** pasar
 * el pre-filtro, porque el corpus tiene los pasajes sobre la figura humana. Que
 * la respuesta correcta sea una abstencion no lo decide el coseno: lo decide el
 * LLM con los pasajes delante (D-039). Contarlas empujaria tau hacia arriba y
 * reproduciria el fallo de D-041, con el espanol rechazando lo que si puede
 * contestar.
 *
 * SE REPORTA CON INTERVALOS, PORQUE EL INSTRUMENTO ES MAS CHICO QUE EL VIEJO.
 * D-062 lo dejo advertido: el experimento de separabilidad tenia ~48 dentro y
 * ~46 fuera POR IDIOMA; el eval set tiene menos de la mitad. La recalibracion es
 * la correcta —esta etiquetada a mano y tiene la distribucion real del
 * producto— pero es mas ruidosa, y un tau movido dentro del intervalo del tau
 * viejo no es un hallazgo: es la misma medicion con menos datos.
 */

import { pipeline } from "@huggingface/transformers";
import { Corpus } from "../src/lib/retrieval.js";
import { cargarUmbrales } from "../src/lib/grounding.js";
import { capaCurada } from "../src/lib/grounding.js";
import { ART, cargarCasos } from "./comun.js";

const REMUESTREOS = 2000;
const PERDIDAS = [0, 0.02, 0.05, 0.10, 0.20];
const IDIOMAS = ["es", "en"] as const;

/**
 * `--artifacts artifacts/es` apunta a otro indice. Hace falta desde D-105: el
 * indice castellano desplaza toda la distribucion del coseno ~0,06 hacia arriba,
 * asi que su tau no es el del ingles y hay que medirlo contra SU PROPIO indice.
 * Calibrar contra el indice equivocado es la version de D-056 de este paso.
 */
const arg = (n: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "";
};
const dirArg = arg("artifacts");
const DIR = dirArg ? new URL("../" + dirArg + "/", import.meta.url) : ART;
const corpus = new Corpus(DIR, { curar: true });
const viejos = cargarUmbrales(ART);
const embed = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");

/**
 * Los casos de la capa 0 se excluyen: `decidir` los resuelve por regla ANTES del
 * retrieval (D-040), asi que su `cosMax` no participa de ninguna decision y
 * meterlo en la calibracion seria contar un numero que el sistema no usa.
 */
const casos = cargarCasos().filter((c) => !capaCurada(c.q));

const grupo = (cat: string): "dentro" | "fuera" | "aparte" =>
  cat === "in_corpus_direct" || cat === "in_corpus_conceptual" ? "dentro"
  : cat === "out_of_corpus_plausible" || cat === "anachronistic" ? "fuera"
  : "aparte";

interface Punto { id: string; lang: string; grupo: string; cat: string; cos: number }
const puntos: Punto[] = [];
for (const c of casos) {
  const s = await embed(`query: ${c.q}`, { pooling: "mean", normalize: true });
  const { cosMax } = corpus.buscar(s.data as Float32Array, c.q, "leonardo", 3);
  puntos.push({ id: c.id, lang: c.lang, grupo: grupo(c.category), cat: c.category, cos: cosMax });
}

/**
 * tau para una perdida objetivo sobre "dentro": el cuantil que deja pasar a
 * todas menos esa fraccion. Se elige contra un OBJETIVO DE COBERTURA explicito y
 * no en la esquina (D-041).
 */
function tauPara(dentro: number[], perdida: number): number {
  const orden = [...dentro].sort((a, b) => a - b);
  const i = Math.floor(perdida * orden.length);
  // El tau que "pierde i" es el que queda justo por debajo del (i+1)-esimo.
  return i === 0 ? orden[0] - 1e-9 : orden[i] - 1e-9;
}

const fuga = (fuera: number[], tau: number): number =>
  fuera.filter((x) => x >= tau).length / Math.max(1, fuera.length);

/** Percentiles de una remuestra bootstrap de tau. */
function bootstrapTau(dentro: number[], perdida: number): [number, number] {
  const taus: number[] = [];
  for (let r = 0; r < REMUESTREOS; r++) {
    const m = Array.from({ length: dentro.length },
      () => dentro[Math.floor(Math.random() * dentro.length)]);
    taus.push(tauPara(m, perdida));
  }
  taus.sort((a, b) => a - b);
  return [taus[Math.floor(0.025 * REMUESTREOS)], taus[Math.floor(0.975 * REMUESTREOS)]];
}

console.log(`\n# Recalibración de τ contra el eval set — paso 16\n`);
console.log(`Protocolo D-062: «dentro» = A+B, «fuera» = C+D, E y F fuera de la calibración.`);
console.log(`Índice curado (D-098), ${corpus.filasPorVoz.leonardo.length} chunks de Leonardo.\n`);

for (const lang of IDIOMAS) {
  const del = (g: string) => puntos.filter((p) => p.lang === lang && p.grupo === g).map((p) => p.cos);
  const dentro = del("dentro"), fuera = del("fuera"), aparte = del("aparte");
  const tauViejo = viejos.tau[lang];

  console.log(`## ${lang} — ${dentro.length} dentro · ${fuera.length} fuera · ${aparte.length} aparte (E+F)\n`);
  console.log(`| pérdida objetivo | τ | IC 95% (bootstrap) | fuga de C+D | pasan E+F |`);
  console.log(`|---:|---:|---|---:|---:|`);
  for (const p of PERDIDAS) {
    const t = tauPara(dentro, p);
    const [lo, hi] = bootstrapTau(dentro, p);
    console.log(`| ${(p * 100).toFixed(0)}% | ${t.toFixed(4)} | [${lo.toFixed(4)} — ${hi.toFixed(4)}] | ` +
                `${(fuga(fuera, t) * 100).toFixed(0)}% | ${(fuga(aparte, t) * 100).toFixed(0)}% |`);
  }

  const [lo0, hi0] = bootstrapTau(dentro, 0);
  const dentroDebajo = dentro.filter((x) => x < tauViejo).length;
  console.log(`\n**τ provisional (190 consultas): ${tauViejo.toFixed(4)}**`);
  console.log(`  · ¿cae en el IC 95% del τ de 0% de pérdida [${lo0.toFixed(4)} — ${hi0.toFixed(4)}]? ` +
              `**${tauViejo >= lo0 && tauViejo <= hi0 ? "SÍ" : "NO"}**`);
  console.log(`  · con él, ${dentroDebajo} de ${dentro.length} casos contestables quedan por debajo ` +
              `(${((dentroDebajo / dentro.length) * 100).toFixed(0)}% de pérdida real)`);
  console.log(`  · fuga de C+D: ${(fuga(fuera, tauViejo) * 100).toFixed(0)}%  ·  pasan E+F: ${(fuga(aparte, tauViejo) * 100).toFixed(0)}%`);

  const dOrd = [...dentro].sort((a, b) => a - b), fOrd = [...fuera].sort((a, b) => b - a);
  console.log(`  · rango dentro: ${dOrd[0].toFixed(4)} … ${dOrd[dOrd.length - 1].toFixed(4)}`);
  console.log(`  · rango fuera : ${fOrd[fOrd.length - 1].toFixed(4)} … ${fOrd[0].toFixed(4)}`);
  console.log(`  · **solapan**: el ${(fuga(fuera, dOrd[0]) * 100).toFixed(0)}% de las «fuera» puntúa por encima de la «dentro» más baja\n`);
}

console.log(`## Los casos contestables que caen más abajo\n`);
for (const lang of IDIOMAS) {
  const bajos = puntos.filter((p) => p.lang === lang && p.grupo === "dentro")
    .sort((a, b) => a.cos - b.cos).slice(0, 4);
  console.log(`  ${lang}: ${bajos.map((b) => `${b.id} ${b.cos.toFixed(4)}`).join(" · ")}`);
}
