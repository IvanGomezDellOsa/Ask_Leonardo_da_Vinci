/**
 * Las decisiones del gate sobre los 120 casos, SIN generar una sola respuesta.
 *
 *   npm run evals:compuerta
 *
 * POR QUE EXISTE, y es el mismo descubrimiento que D-096. Que el gate responda o
 * se abstenga es una propiedad UNICAMENTE del retrieval y de tau: `cosMax` sale
 * del coseno denso pre-fusion y `should_abstain` esta etiquetado en el dataset.
 * No depende del generador, ni del prompt, ni de la temperatura. Se mide offline,
 * sin API y sin gastar cuota, sobre los 120 casos y no sobre los 30.
 *
 * Cubre lo que `evals:recall` no puede ver: las dos direcciones del error.
 *
 *   filtracion       deberia abstenerse y responde   (el gate deja pasar)
 *   sobre-abstencion podria contestar y se abstiene  (D-041: no es gratis)
 *
 * ================================================================
 * MIDE EL MOTOR REAL. Ver D-115.
 * ================================================================
 *
 * Este script nacio comparando dos ramas —con y sin curaduria— y para eso
 * construia `new Corpus(ART)` a mano. Cuando D-107 puso **un indice por idioma**,
 * quedo midiendo el indice INGLES para las consultas en castellano: una
 * configuracion que el producto ya no usa. Reportaba **65/54/1** mientras el
 * sistema real daba **77/43/0**, y esa discrepancia la encontro `npm run
 * regresion` en su primera corrida, no una persona.
 *
 * Es el defecto que este proyecto lleva catorce entradas documentando —un
 * instrumento que mide una dimension distinta de la que gobierna el resultado—
 * esta vez dentro del instrumento escrito para detectarlo.
 *
 * La comparacion con/sin curaduria se elimino: esa decision esta cerrada (D-098)
 * y su numero lo fija `regresion.ts`. Lo que hace falta es que el gate se mire
 * con el motor de verdad.
 */

import { cargarExtractor } from "../src/lib/embed.js";
import { cargarMotor, decidirCon, type Decision } from "../src/lib/grounding.js";
import { ART, cargarCasos } from "./comun.js";

const motor = cargarMotor(ART);
const embed = await cargarExtractor();
const casos = cargarCasos();

console.log(`\n# Decisiones del gate — motor real, un índice por idioma\n`);
console.log(`  es: ${motor.por.es.corpus.filasPorVoz.leonardo.length} chunks · τ ${motor.por.es.umbrales.tau.es}`);
console.log(`  en: ${motor.por.en.corpus.filasPorVoz.leonardo.length} chunks · τ ${motor.por.en.umbrales.tau.en}\n`);

/** `curada` cuenta como abstencion: la capa 0 tambien es un silencio (D-040). */
const seAbstiene = (d: Decision): boolean => d.tipo !== "responde";

const filtraciones: string[] = [];
const sobreAbstenciones: string[] = [];
let ok = 0;
const porCategoria = new Map<string, { n: number; fil: number; sob: number }>();
const porIdioma = new Map<string, { fil: number; sob: number }>();

for (const c of casos) {
  const s = await embed(`query: ${c.q}`, { pooling: "mean", normalize: true });
  const d = decidirCon(motor, c.q, s.data as Float32Array, c.lang, 3);

  const cat = porCategoria.get(c.category) ?? { n: 0, fil: 0, sob: 0 };
  const idi = porIdioma.get(c.lang) ?? { fil: 0, sob: 0 };
  cat.n++;

  if (seAbstiene(d) === c.should_abstain) ok++;
  else if (c.should_abstain) { filtraciones.push(c.id); cat.fil++; idi.fil++; }
  else { sobreAbstenciones.push(c.id); cat.sob++; idi.sob++; }

  porCategoria.set(c.category, cat);
  porIdioma.set(c.lang, idi);
}

console.log(`| | de ${casos.length} |`);
console.log(`|---|---:|`);
console.log(`| aciertos | **${ok}** |`);
console.log(`| **filtraciones** (debía abstenerse y respondió) | **${filtraciones.length}** |`);
console.log(`| **sobre-abstenciones** (podía contestar y se abstuvo) | **${sobreAbstenciones.length}** |`);

console.log(`\n## Por categoría\n`);
console.log(`| categoría | n | filtraciones | sobre-abst. |`);
console.log(`|---|---:|---:|---:|`);
for (const [k, v] of porCategoria) console.log(`| ${k} | ${v.n} | ${v.fil} | ${v.sob} |`);

console.log(`\n## Por idioma\n`);
for (const [k, v] of porIdioma) console.log(`  ${k}: ${v.fil} filtraciones · ${v.sob} sobre-abstenciones`);

console.log(`\nfiltraciones      : ${filtraciones.join(", ") || "—"}`);
console.log(`sobre-abstenciones: ${sobreAbstenciones.join(", ") || "—"}`);
console.log(`\n> La filtración es ALTA POR DISEÑO: τ está en el punto de 0% de pérdida y`);
console.log(`> quien juzga lo dudoso es el LLM con los pasajes delante (D-039). El número`);
console.log(`> que hay que vigilar es la sobre-abstención (D-041).`);
