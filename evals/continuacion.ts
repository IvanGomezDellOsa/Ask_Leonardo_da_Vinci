/**
 * ¿Que pasa DESPUES de que Leonardo declina? Ver D-092 y D-093.
 *
 * POR QUE EXISTE. Cuando el sistema dice "sobre eso no deje nada escrito", lo
 * que sigue es contenido OPCIONAL, y ahi es donde se concentra la invencion que
 * queda: el modelo declina bien y enseguida agrega de que se ocupo, que le
 * interesa o que opina — afirmaciones sobre si mismo que no estan en ningun
 * pasaje.
 *
 * SE MIDE POR ESTRUCTURA, NO POR PALABRAS CLAVE. El primer intento fue una
 * regex de expresiones tipo "me he ocupado", y matcheaba tambien texto CITADO,
 * que es legitimo. La pregunta correcta no es que palabras usa sino **cuanto
 * texto NO CITADO produce despues de declinar**: eso es exactamente la
 * superficie que ninguna comprobacion mecanica puede verificar.
 */

import { RAIZ, leerJsonl, type Resultado } from "./comun.js";

const arg = (n: string, d = ""): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};

/** Formas de declinar, en los dos idiomas. Deliberadamente amplia. */
const RE_DECL = /(no dej[ée] (nada|poco) escrito|no he dejado (nada|poco)|nada escrito sobre|set (nothing|little) down|set down (nothing|little)|have set down no)/i;

/** Palabras fuera de guillemets: la superficie que nadie puede verificar. */
function palabrasLibres(t: string): number {
  return t.replace(/«[^»]*»/g, " ").split(/\s+/).filter(Boolean).length;
}

const entrada = arg("entrada");
if (!entrada) { console.error("falta --entrada <archivo.jsonl>"); process.exit(1); }

const filas = leerJsonl<Resultado>(new URL(`evals/out/${entrada}`, RAIZ))
  .filter((r) => r.decision === "responde" && r.respuesta);

interface Fila { id: string; total: number; libresDespues: number; citaDespues: boolean }
const decl: Fila[] = [];

for (const r of filas) {
  const t = r.respuesta!;
  const m = RE_DECL.exec(t);
  if (!m) continue;
  /** Todo lo que viene tras cerrar la oracion donde declina. */
  const desde = m.index + m[0].length;
  const fin = t.slice(desde);
  const corte = fin.search(/[.!?]/);
  const despues = corte >= 0 ? fin.slice(corte + 1) : "";
  decl.push({
    id: r.id,
    total: t.split(/\s+/).filter(Boolean).length,
    libresDespues: palabrasLibres(despues),
    citaDespues: /«/.test(despues),
  });
}

const med = (xs: number[]): number =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0;

const sinNada = decl.filter((d) => d.libresDespues === 0);
const soloCita = decl.filter((d) => d.libresDespues > 0 && d.libresDespues <= 12 && d.citaDespues);
const prosa = decl.filter((d) => d.libresDespues > 12);

console.log(`\n# Qué pasa después de declinar — ${entrada}\n`);
console.log(`Respuestas que declinan : ${decl.length} de ${filas.length}`);
console.log(`\n| tras declinar | respuestas | |`);
console.log(`|---|---:|---|`);
console.log(`| no agrega nada | ${sinNada.length} | riesgo cero |`);
console.log(`| solo presenta una cita | ${soloCita.length} | riesgo bajo: lo afirmado es la cita |`);
console.log(`| **prosa libre (>12 palabras)** | **${prosa.length}** | **superficie no verificable** |`);
console.log(`\nPalabras libres tras declinar — mediana: ${med(decl.map((d) => d.libresDespues))}`);
console.log(`Total de palabras libres producidas tras declinar: ${decl.reduce((s, d) => s + d.libresDespues, 0)}`);

if (prosa.length) {
  console.log(`\n## Las que siguen con prosa libre\n`);
  for (const d of prosa.sort((a, b) => b.libresDespues - a.libresDespues).slice(0, 12)) {
    console.log(`- \`${d.id}\` — ${d.libresDespues} palabras sin verificar${d.citaDespues ? " (además cita)" : ""}`);
  }
}
