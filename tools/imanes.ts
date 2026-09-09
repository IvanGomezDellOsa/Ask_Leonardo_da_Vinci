/**
 * ¿Cuáles son hoy los temas imán? Ver `28` §5 y D-240.
 *
 *   npm run imanes
 *
 * QUE ES UN TEMA IMAN. Un título que entra al top-3 de preguntas que no tienen
 * nada que ver entre sí. No es que esté mal indexado: es que su texto —máximas
 * sueltas, chistes, notas de fisiología— se parece un poco a todo y no mucho a
 * nada, así que el coseno lo pone arriba cuando no hay nada mejor. Ofrecerlo
 * como «lo más cercano» a cualquier cosa es la manera más rápida de que el
 * producto parezca tonto.
 *
 * ══════════════════════════════════════════════════════════════════════
 * LA LISTA ESTABA ESCRITA Y NADIE LA VOLVIA A MEDIR.
 * ══════════════════════════════════════════════════════════════════════
 *
 * Los cinco imanes de `28` §5 se midieron una vez y se congelaron a mano en
 * `tools/mapa_temas.ts`. Desde entonces el corpus cambió dos veces —D-230
 * corrigió 172 títulos y metió el testamento al índice, D-231 dejó de mandar al
 * coseno las consultas sin ninguna palabra del corpus— y **la lista siguió
 * diciendo lo mismo sin que nadie comprobara si seguía siendo cierta**. Es el
 * modo de fallo que este proyecto lleva dieciséis entradas documentando, esta
 * vez en una restricción de producto en vez de en un artefacto.
 *
 * D-231 en particular tendría que haber movido el número: «hola» era el imán
 * más fuerte de todos y ya ni siquiera llega al coseno.
 *
 * COMO SE MIDE. Se corren las 170 preguntas del banco —las 120 de control y las
 * 50 del banco común (D-236)— y se cuenta en cuántos top-3 aparece cada título.
 * Un título que aparece en muchas preguntas de categorías distintas es un imán;
 * uno que aparece en varias preguntas de la MISMA categoría es, simplemente, el
 * tema de esas preguntas.
 *
 * ⚠ POR ESO NO ALCANZA CON CONTAR APARICIONES. Se cuenta también en cuántas
 * CATEGORIAS distintas aparece: «Sobre el color de la atmósfera» sale mucho, y
 * está perfecto —sale en las preguntas sobre el cielo—. Lo que delata al imán es
 * la dispersión.
 */

import { cargarExtractor } from "../src/lib/embed.js";
import { cargarMotor, type Idioma } from "../src/lib/grounding.js";
import { cargarCasos } from "../evals/comun.js";

const ART = new URL("../artifacts/", import.meta.url);

/**
 * LOS CINCO CONGELADOS EN `mapa_temas.ts`. Se importan de ahí a propósito: si
 * este script tuviera su propia copia, las dos podrían divergir y el informe
 * diría que todo está bien mientras el mapa marca otra cosa.
 */
const CONGELADOS = new Set([
  "Citas y notas sobre libros y autores (1469—1508)",
  "Quotations and notes on books and authors (1469—1508)",
  "Chanzas y cuentos", "JESTS AND TALES",
  "Fisiología", "PHYSIOLOGY",
  "Moral", "MORALS",
  "La posición correcta del artista, al pintar y del espectador",
  "The right position of the artist, when painting and of the spectator",
]);

const motor = cargarMotor(ART);
const extractor = await cargarExtractor();
const emb = async (t: string): Promise<Float32Array> =>
  (await extractor("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

const casos = cargarCasos();

interface Cuenta { veces: number; categorias: Set<string>; idiomas: Set<string>; ejemplos: string[] }
const porTitulo = new Map<string, Cuenta>();

console.log(`\n# Temas imán — medidos sobre ${casos.length} preguntas del banco\n`);

for (const c of casos) {
  const v = await emb(c.q);
  const corpus = motor.por[c.lang as Idioma].corpus;
  /**
   * ⚠ SE MIRA EL TOP-3 DEL RETRIEVAL, NO LA DECISION DEL GATE. Un imán que sale
   * arriba en una pregunta que después se abstiene sigue siendo un imán: lo que
   * se mide es a qué se parece el corpus, no qué se publica.
   */
  const top = corpus.buscar(v, c.q, "leonardo", 3).top;
  const vistos = new Set<string>();
  for (const t of top) {
    const titulo = (c.lang === "es" ? (t.chunk.tituloEs ?? t.chunk.richterTitle) : t.chunk.richterTitle);
    if (!titulo || vistos.has(titulo)) continue;   // un título cuenta una vez por pregunta
    vistos.add(titulo);
    const x = porTitulo.get(titulo) ?? { veces: 0, categorias: new Set(), idiomas: new Set(), ejemplos: [] };
    x.veces++; x.categorias.add(c.category); x.idiomas.add(c.lang);
    if (x.ejemplos.length < 3) x.ejemplos.push(c.id);
    porTitulo.set(titulo, x);
  }
}

const filas = [...porTitulo.entries()]
  .map(([titulo, x]) => ({ titulo, ...x, cats: x.categorias.size }))
  .sort((a, b) => b.cats - a.cats || b.veces - a.veces);

const CATS = new Set(casos.map((c) => c.category)).size;

console.log(`  títulos que entran alguna vez al top-3 : ${filas.length}`);
console.log(`  categorías del banco                  : ${CATS}\n`);

console.log(`## Los 15 más dispersos — aparecen en preguntas que no se parecen entre sí\n`);
console.log(`| título | categorías | veces | idiomas | ¿congelado como imán? |`);
console.log(`|---|---:|---:|---|---|`);
for (const f of filas.slice(0, 15)) {
  console.log(`| ${f.titulo} | **${f.cats}/${CATS}** | ${f.veces} | ${[...f.idiomas].join("+")} | ${CONGELADOS.has(f.titulo) ? "**sí**" : "—"} |`);
}

/**
 * EL CORTE. Un título que aparece en la MITAD o más de las categorías del banco
 * es un imán: no hay tema que sea a la vez el más cercano a una pregunta directa
 * del corpus, a un anacronismo y a un ataque adversarial.
 */
const umbral = Math.ceil(CATS / 2);
const medidos = filas.filter((f) => f.cats >= umbral).map((f) => f.titulo);

console.log(`\n## Veredicto — corte en ${umbral} de ${CATS} categorías\n`);

const faltan = medidos.filter((t) => !CONGELADOS.has(t));
const sobran = [...CONGELADOS].filter((t) =>
  porTitulo.has(t) && !medidos.includes(t));

console.log(`  imanes medidos hoy      : ${medidos.length}`);
console.log(`  congelados en el mapa   : ${CONGELADOS.size / 2} (× 2 idiomas)\n`);

if (faltan.length) {
  console.log(`  ⚠ IMANES QUE NO ESTAN CONGELADOS (${faltan.length}):`);
  for (const t of faltan) {
    const f = filas.find((x) => x.titulo === t)!;
    console.log(`      ${t}  — ${f.cats} categorías, ${f.veces} veces (${f.ejemplos.join(", ")})`);
  }
} else {
  console.log(`  ✅ ningún imán nuevo: la lista congelada cubre todo lo que hoy se dispersa.`);
}

if (sobran.length) {
  console.log(`\n  ℹ CONGELADOS QUE HOY NO SE DISPERSAN (${sobran.length}):`);
  for (const t of sobran) {
    const f = filas.find((x) => x.titulo === t);
    console.log(`      ${t}  — ${f ? `${f.cats} categorías, ${f.veces} veces` : "no entra a ningún top-3"}`);
  }
  console.log(`\n  NO se quitan por esto solo. Dejar de sugerir un tema no le hace daño a nadie;`);
  console.log(`  volver a sugerir uno que se dispersa, sí. El costo de los dos errores no es igual.`);
}

console.log();
