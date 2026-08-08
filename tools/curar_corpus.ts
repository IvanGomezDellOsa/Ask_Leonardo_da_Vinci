/**
 * Clasifica por utilidad los chunks de Leonardo, para sacar del indice lo que no
 * es contenido contestable. Ver D-098.
 *
 *   npm run curar
 *
 * EL PROBLEMA, con caso testigo. `B-03es` —"¿por que vale mas la experiencia que
 * la autoridad de los libros?"— falla porque el top-3 son inventarios personales:
 * `rt-1469` y `rt-1488` son listas de titulos de libros, `rt-1444` es una lista
 * de compras. El pasaje correcto (`rt-0012`) queda en posicion 5.
 *
 * **El embedding no falla: hace exactamente lo que se le pide.** La consulta dice
 * "libros" y esos chunks SON listas de libros. Nadie hace una pregunta cuya
 * respuesta sea una lista de compras, pero esos chunks compiten de igual a igual
 * con los que si contestan algo.
 *
 * POR QUE HACEN FALTA DOS CLAVES, y no una. Se midieron las dos por separado y
 * ninguna sirve sola:
 *
 *   - Solo el titulo de Richter: se lleva puesto contenido real. Bajo
 *     "Quotations and notes on books and authors" vive `rt-1473` (Anaxagoras
 *     sobre que todo procede de todo) y `rt-1478` (Aristoteles sobre fuerza y
 *     distancia). Richter agrupo por procedencia del manuscrito, no por tipo de
 *     material.
 *   - Solo la estructura del texto: tambien. `rt-0393` ("OF Classification of
 *     trees") y `rt-0812` ("The divisions of the head") son listas, pero son
 *     listas SOBRE algo. Es la advertencia de D-044 —"se lleva puestos aforismos
 *     legitimos y cortos"— y se cumple.
 *
 * Es el mismo error que el proyecto viene cometiendo desde el principio: medir
 * una dimension distinta de la que gobierna el resultado. "Esta archivado como
 * memorandum" y "esta escrito como lista" son dos dimensiones, y lo que hay que
 * sacar es la INTERSECCION.
 *
 * ES EL MISMO MOVIMIENTO QUE D-053 Y D-054, un escalon mas: sacar del indice el
 * aparato de Richter y los pasajes iman. Cuesta cero, no toca el modelo y no
 * agrega descarga al navegador.
 *
 * NO SE BORRA NADA (D-059). La exclusion es del INDICE DE RECUPERACION, no del
 * corpus: `chunks.json` queda intacto y `citas_vs_corpus.ts` los sigue viendo,
 * porque una cita a un inventario sigue siendo una cita verdadera.
 */

import { readFileSync, writeFileSync } from "node:fs";

interface Chunk {
  id: string; voice: string; text: string; nWords: number;
  richterTitle: string | null; section: string | null;
}

const chunks: Chunk[] = JSON.parse(readFileSync("artifacts/chunks.json", "utf8"));

/**
 * CLAVE 1 — Richter lo archivo como registro personal, no bajo un tema.
 *
 * "Miscellaneous Notes" es el cajon que el propio Richter uso para el material
 * sin tema, y los dos titulos sueltos se nombran a si mismos como catalogo y
 * como diario. Es un dato del libro, no una inferencia nuestra — el mismo
 * criterio que D-047 uso para los titulos y D-065 para "Notes by unknown
 * persons".
 */
const SECCION_SIN_TEMA = "Miscellaneous Notes";
const TITULOS_DE_REGISTRO = new Set([
  "List of drawings",
  "Notes bearing Dates (1369—1378)",
]);

/**
 * CLAVE 2 — esta escrito como lista, no como prosa.
 *
 * La longitud media de segmento (partiendo por coma, punto y coma, raya y salto
 * de linea) separa donde el ratio de palabras funcionales de `calidad()` no
 * pudo: "Pandolfino's book,—knives,—a pen for ruling" da 3,26 y "Many will think
 * they may reasonably blame me…" da 15,00.
 *
 * EL UMBRAL SE FIJA LEYENDO LOS 102 CANDIDATOS, NO OPTIMIZANDO EL RECALL. El
 * item sustantivo mas bajo del conjunto candidato es `rt-1480` ("Aristotle says
 * that every body tends to maintain its nature") en 5,75; los tres testigos de
 * `B-03es` estan en 2,76 · 3,20 · 3,26. 5,0 deja margen de los dos lados.
 * Ajustarlo contra el numero que despues lo valida seria sobreajuste, y el
 * proyecto ya pago ese error una vez (D-091).
 */
const UMBRAL_SEGMENTO = 5.0;

function mediaDeSegmento(texto: string): number {
  const largos = texto
    .split(/[,;]|—|--|\n/)
    .map((s) => s.trim().split(/\s+/).filter(Boolean).length)
    .filter((n) => n > 0);
  return largos.reduce((a, b) => a + b, 0) / Math.max(1, largos.length);
}

const esCandidato = (c: Chunk): boolean =>
  c.section === SECCION_SIN_TEMA || TITULOS_DE_REGISTRO.has(c.richterTitle ?? "");

/**
 * SEGUNDA CLASE, y es de la voz de Richter: citas en frances o italiano dentro
 * de su aparato. Ver D-108.
 *
 * Estan legitimamente en el libro —Richter cita documentos de epoca— pero el
 * indice de Richter tiene un solo uso en el producto: ser la EVIDENCIA DE
 * AUSENCIA que se le muestra al usuario cuando el sistema se abstiene (D-042).
 * Un documento financiero frances del siglo XV no puede cumplir esa funcion en
 * ningun idioma que el producto hable. Se descubrio en una consulta real:
 * «¿Como se llega a dominar muchas artes?» se abstenia y mostraba
 * «de la mettre nonseulement a ses armes et a ses chiffres…».
 *
 * `calidad()` en el pipeline ya filtra alfabetos no latinos (griego, cirilico),
 * pero frances e italiano pasan por escritura latina. Se detectan por palabras
 * funcionales propias, exigiendo TRES para no llevarse puesta una nota inglesa
 * que menciona un titulo en otro idioma.
 */
const MARCAS_FR = ["nonseulement", "ouvrages", "manieres", "lesquels", "celui", "aussi", "pour elle", "dans les", "que le", "il y a"];
const MARCAS_IT = ["della", "nella", "questo", "perche", "sono", "delle", "alla"];
const marcas = (t: string, ws: string[]): number =>
  ws.filter((w) => t.toLowerCase().includes(w)).length;

const ajenos = chunks.filter((c) =>
  c.voice === "richter" && (marcas(c.text, MARCAS_FR) >= 3 || marcas(c.text, MARCAS_IT) >= 3));

const leo = chunks.filter((c) => c.voice === "leonardo");
const candidatos = leo.filter(esCandidato);

interface Ficha { utility: "inventory" | "no_traducible"; segMedia: number; titulo: string | null; muestra: string }
const fichas: Record<string, Ficha> = {};

for (const c of candidatos) {
  const seg = mediaDeSegmento(c.text);
  if (seg >= UMBRAL_SEGMENTO) continue;
  fichas[c.id] = {
    utility: "inventory",
    segMedia: Number(seg.toFixed(2)),
    titulo: c.richterTitle,
    muestra: c.text.replace(/\s+/g, " ").slice(0, 120),
  };
}

for (const c of ajenos) {
  fichas[c.id] = { utility: "no_traducible", segMedia: 0, titulo: c.richterTitle,
                   muestra: c.text.replace(/\s+/g, " ").slice(0, 120) };
}

const excluidos = Object.keys(fichas);
const palabrasFuera = leo
  .filter((c) => fichas[c.id])
  .reduce((a, c) => a + c.nWords, 0);
const palabrasTotal = leo.reduce((a, c) => a + c.nWords, 0);

writeFileSync("artifacts/curaduria.json", JSON.stringify({
  regla: {
    clave1: { seccion: SECCION_SIN_TEMA, titulos: [...TITULOS_DE_REGISTRO] },
    clave2: { metrica: "longitud media de segmento", umbral: UMBRAL_SEGMENTO },
  },
  resumen: {
    chunksLeonardo: leo.length,
    candidatos: candidatos.length,
    excluidos: excluidos.length,
    palabrasFuera, palabrasTotal,
  },
  chunks: fichas,
}, null, 2) + "\n");

/**
 * El .md existe para que la exclusion se pueda AUDITAR EN UN DIFF, sin correr
 * nada. Son 27 chunks: la lista entera entra en una pantalla y un humano puede
 * leerla y objetar item por item. Es la contraparte de la revision dirigida que
 * R1 exigio en la Fase 1.
 */
const filas = excluidos
  .map((id) => ({ id, ...fichas[id] }))
  .sort((a, b) => a.segMedia - b.segMedia);

const md = [
  `# Curaduría del corpus — chunks fuera del índice de recuperación`,
  ``,
  `> **Generado.** No editar a mano: \`npm run curar\`. Ver D-098.`,
  ``,
  `${excluidos.length} chunks de ${leo.length}, ${palabrasFuera} palabras de ${palabrasTotal}`,
  `(${((palabrasFuera / palabrasTotal) * 100).toFixed(1)}% del corpus de Leonardo).`,
  ``,
  `Siguen en \`chunks.json\` y siguen contando para verificar citas. Lo único que`,
  `cambia es que no compiten por entrar al top-k.`,
  ``,
  `| seg | id | título de Richter | texto |`,
  `|---:|---|---|---|`,
  ...filas.map((f) =>
    `| ${f.segMedia.toFixed(2)} | \`${f.id}\` | ${f.titulo ?? "—"} | ${f.muestra.replace(/\|/g, "\\|")} |`),
  ``,
].join("\n");
writeFileSync("artifacts/curaduria.md", md);

console.log(`\nchunks de Leonardo : ${leo.length}`);
console.log(`candidatos (clave 1): ${candidatos.length}`);
console.log(`aparato no traducible: ${ajenos.length} chunks de Richter (francés/italiano)`);
console.log(`excluidos total     : ${excluidos.length}  · ${palabrasFuera} palabras (${((palabrasFuera / palabrasTotal) * 100).toFixed(1)}%)`);
console.log(`\nescrito: artifacts/curaduria.json`);
console.log(`         artifacts/curaduria.md`);
