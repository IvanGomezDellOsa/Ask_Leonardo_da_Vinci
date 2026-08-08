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
 * POR QUE HACIA FALTA. `evals:recall` NO PUEDE detectar sobre-exclusion. Los 30
 * casos con `expected_passages` tienen su verdad en cinco secciones —Practice of
 * Painting, Botany, Light and Shade, Proportions, Theory of colours— y en
 * NINGUNA de ellas vive un inventario. Sacar inventarios del indice solo puede
 * dejar ese numero igual o mejorarlo: es ciego al dano colateral por
 * construccion. Medir la curaduria solo con recall seria, otra vez, medir una
 * dimension distinta de la que gobierna el resultado.
 *
 * Este script cubre el otro lado. Con las 120 etiquetas de `should_abstain` mide
 * las dos direcciones del error:
 *
 *   filtracion       deberia abstenerse y responde   (el gate deja pasar)
 *   sobre-abstencion podria contestar y se abstiene  (D-041: no es gratis)
 *
 * LAS DOS RAMAS EN UN SOLO PROCESO Y CON EL MISMO VECTOR DE CONSULTA. La fase
 * perdio dias comparando corridas donde habia cambiado mas de una cosa; aca no
 * puede pasar, porque lo unico distinto entre las dos columnas es que filas
 * entran al indice.
 */

import { pipeline } from "@huggingface/transformers";
import { Corpus } from "../src/lib/retrieval.js";
import { cargarUmbrales, decidir, type Decision } from "../src/lib/grounding.js";
import { ART, cargarCasos } from "./comun.js";

const umbrales = cargarUmbrales(ART);
const ramas = [
  { nombre: "sin curaduría", corpus: new Corpus(ART, { curar: false }) },
  { nombre: "con curaduría", corpus: new Corpus(ART, { curar: true }) },
];

console.log(`\n# Decisiones del gate — ${ramas[0].corpus.filasPorVoz.leonardo.length} vs ` +
            `${ramas[1].corpus.filasPorVoz.leonardo.length} chunks de Leonardo en el índice\n`);

const embed = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");
const casos = cargarCasos();

/** `curada` cuenta como abstencion: la capa 0 tambien es un silencio (D-040). */
const seAbstiene = (d: Decision): boolean => d.tipo !== "responde";

interface Cuenta { filtraciones: string[]; sobreAbstenciones: string[]; ok: number }
const cuentas = ramas.map((): Cuenta => ({ filtraciones: [], sobreAbstenciones: [], ok: 0 }));
const porCategoria = ramas.map(() => new Map<string, { fil: number; sob: number }>());
const cambios: string[] = [];

for (const c of casos) {
  const s = await embed(`query: ${c.q}`, { pooling: "mean", normalize: true });
  const v = s.data as Float32Array;

  const decs = ramas.map((r) => decidir(r.corpus, umbrales, c.q, v, c.lang, 3));

  decs.forEach((d, i) => {
    const abst = seAbstiene(d);
    const cat = porCategoria[i].get(c.category) ?? { fil: 0, sob: 0 };
    if (abst === c.should_abstain) cuentas[i].ok++;
    else if (c.should_abstain) { cuentas[i].filtraciones.push(c.id); cat.fil++; }
    else { cuentas[i].sobreAbstenciones.push(c.id); cat.sob++; }
    porCategoria[i].set(c.category, cat);
  });

  if (seAbstiene(decs[0]) !== seAbstiene(decs[1])) {
    const dir = seAbstiene(decs[1]) ? "responde → abstiene" : "abstiene → responde";
    cambios.push(`${c.id} (${c.category}, ${c.should_abstain ? "debe abstenerse" : "puede contestar"}): ${dir}`);
  }
}

console.log(`| | sin curaduría | con curaduría |`);
console.log(`|---|---:|---:|`);
console.log(`| aciertos de ${casos.length} | ${cuentas[0].ok} | ${cuentas[1].ok} |`);
console.log(`| **filtraciones** (debía abstenerse) | **${cuentas[0].filtraciones.length}** | **${cuentas[1].filtraciones.length}** |`);
console.log(`| **sobre-abstenciones** (podía contestar) | **${cuentas[0].sobreAbstenciones.length}** | **${cuentas[1].sobreAbstenciones.length}** |`);

console.log(`\n## Por categoría\n`);
console.log(`| categoría | filtr. sin | filtr. con | sobre-abst. sin | sobre-abst. con |`);
console.log(`|---|---:|---:|---:|---:|`);
for (const cat of new Set(casos.map((c) => c.category))) {
  const a = porCategoria[0].get(cat) ?? { fil: 0, sob: 0 };
  const b = porCategoria[1].get(cat) ?? { fil: 0, sob: 0 };
  console.log(`| ${cat} | ${a.fil} | ${b.fil} | ${a.sob} | ${b.sob} |`);
}

console.log(`\n## Casos que cambiaron de decisión: ${cambios.length}\n`);
for (const c of cambios) console.log(`  ${c}`);
if (!cambios.length) console.log(`  (ninguno)`);

console.log(`\nfiltraciones con curaduría   : ${cuentas[1].filtraciones.join(", ") || "—"}`);
console.log(`sobre-abstenciones con curad.: ${cuentas[1].sobreAbstenciones.join(", ") || "—"}`);
