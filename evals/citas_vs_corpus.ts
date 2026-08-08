/**
 * ¿Existen en el corpus las citas que el sistema atribuye a Leonardo? Ver D-094.
 *
 * ES OTRA PREGUNTA QUE `fidelidad_cita.ts`, y hace falta para la linea de base.
 * Aquel compara la cita contra LOS PASAJES QUE EL MODELO VIO, que es lo correcto
 * para el modo RAG. Pero la linea de base no ve ningun pasaje: ahi la pregunta
 * es mas basica y mas grave — **¿esas palabras existen en algun lugar de los
 * cuadernos de Leonardo, si o no?**
 *
 * Se busca contra el CORPUS ENTERO, sin recorte y sin filtrar por voz. Es la
 * vara mas generosa posible: si una cita no aparece ni asi, es inventada.
 *
 * ES LA MEDICION QUE EL README NECESITA, porque no es una estimacion con
 * intervalo sino una comprobacion: o la frase esta en el libro o no esta.
 */

import { readFileSync } from "node:fs";
import { RAIZ, ART, leerJsonl, type Resultado } from "./comun.js";
/**
 * SE IMPORTA `palabras` DE `citas.ts`, no se reescribe. La primera version tenia
 * su propia copia que ademas despojaba acentos, mientras `esLiteral` —que usa la
 * de `citas.ts`— no lo hace: el pajar quedaba sin tildes y la aguja con ellas,
 * asi que NINGUNA cita en castellano podia matchear y el informe daba 41,7% de
 * citas inventadas donde `fidelidad_cita.ts` medía 100% de fidelidad.
 *
 * Se detecto porque las dos mediciones se contradecian. Es el mismo defecto de
 * toda la fase —dos componentes midiendo cosas distintas— y la unica cura
 * estructural es que compartan la funcion en vez de tener cada uno la suya.
 */
import { extraerCitas, esLiteral, palabras } from "../src/lib/citas.js";

const arg = (n: string, d = ""): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const entrada = arg("entrada");
if (!entrada) { console.error("falta --entrada <archivo.jsonl>"); process.exit(1); }


/** El corpus entero como una sola secuencia de palabras, en los dos idiomas. */
interface Chunk { id: string; text: string }
const chunks: Chunk[] = JSON.parse(readFileSync(new URL("chunks.json", ART), "utf8"));
const es: Record<string, { texto?: string }> =
  JSON.parse(readFileSync(new URL("chunks_es.json", ART), "utf8"));

const pajarEn = palabras(chunks.map((c) => c.text).join("   "));
const pajarEs = palabras(Object.values(es).map((x) => x.texto ?? "").join("   "));

const filas = leerJsonl<Resultado>(new URL(`evals/out/${entrada}`, RAIZ))
  .filter((r) => r.decision === "responde" && r.respuesta);

let citas = 0, existen = 0, conCita = 0;
const inventadas: { id: string; cita: string }[] = [];

for (const r of filas) {
  const cs = extraerCitas(r.respuesta!);
  if (cs.length) conCita++;
  for (const c of cs) {
    citas++;
    // Se acepta si aparece en CUALQUIERA de los dos idiomas del corpus.
    if (esLiteral(c, pajarEn) || esLiteral(c, pajarEs)) existen++;
    else inventadas.push({ id: r.id, cita: c });
  }
}

const pct = (a: number, b: number): string => b ? `${((a / b) * 100).toFixed(1)}%` : "n/a";

console.log(`\n# ¿Existen las citas? — ${entrada}\n`);
console.log(`Respuestas analizadas   : ${filas.length}`);
console.log(`Con al menos una cita   : ${conCita}  (${pct(conCita, filas.length)})`);
console.log(`\n| | citas | |`);
console.log(`|---|---:|---|`);
console.log(`| **existen en el corpus** | ${existen} | ${pct(existen, citas)} |`);
console.log(`| **INVENTADAS** | ${inventadas.length} | **${pct(inventadas.length, citas)}** |`);
console.log(`\n> Se busca contra el corpus ENTERO, en los dos idiomas, sin recorte.`);
console.log(`> Es la vara más generosa posible: si no aparece ni así, no existe.`);

if (inventadas.length) {
  console.log(`\n## Citas atribuidas a Leonardo que no están en sus cuadernos\n`);
  for (const x of inventadas.slice(0, 10)) {
    console.log(`- \`${x.id}\` — «${x.cita.slice(0, 110)}»`);
  }
  if (inventadas.length > 10) console.log(`- … y ${inventadas.length - 10} más`);
}
