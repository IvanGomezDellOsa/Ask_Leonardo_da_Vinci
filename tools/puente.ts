/**
 * ¿Qué ofrecería el puente tras el rechazo? Ver `28` §4F y D-242.
 *
 *   npm run puente
 *   npm run puente -- --todos     también las que responden
 *
 * ══════════════════════════════════════════════════════════════════════
 * ESTO NO CONSTRUYE EL PUENTE. LO MIDE ANTES DE CONSTRUIRLO.
 * ══════════════════════════════════════════════════════════════════════
 *
 * `28` §4F fija la condición de entrada: **no se construye sin etiquetar antes
 * los 3 vecinos de las consultas que se abstienen**, con dos criterios escritos
 * de antemano:
 *
 *   1. ≥80% de las preguntas CON tema reciben un vecino real;
 *   2. **CERO disparates** en las preguntas sobre su vida, que es donde la capa
 *      curada da hoy el mejor momento del producto.
 *
 * Este script produce la planilla para etiquetar: por cada consulta que se
 * abstiene, los tres temas que el puente ofrecería, con su sección. La etiqueta
 * la pone una persona leyendo — no hay forma mecánica de decidir si «Chanzas y
 * cuentos» es un vecino razonable de «¿qué opinás de la fotografía?».
 *
 * ⚠ LO QUE SI SE MIDE SOLO: cuántos de esos vecinos son TEMAS IMAN (D-240). Un
 * imán no es un vecino: es lo que sale cuando no hay vecino. Si el puente ofrece
 * mayormente imanes, ofrecer «lo más cercano» equivale a ofrecer siempre lo
 * mismo, y eso ya se sabe sin etiquetar nada.
 *
 * ⚠ Y NO SE MUESTRA NADA CUANDO NO HAY ANCLA. Segunda condición de §4F: si la
 * consulta se abstuvo porque no tiene una sola palabra del corpus (D-231), no
 * hay vecino que valga — para «hola» no existe «cerca de esto». Esas se cuentan
 * aparte y NO entran al denominador.
 */

import { cargarExtractor } from "../src/lib/embed.js";
import { cargarMotor, decidirCon, type Idioma } from "../src/lib/grounding.js";
import { cargarCasos } from "../evals/comun.js";
import { MAPA } from "../src/data/mapa.js";

const ART = new URL("../artifacts/", import.meta.url);
const todos = process.argv.includes("--todos");

const motor = cargarMotor(ART);
const extractor = await cargarExtractor();
const emb = async (t: string): Promise<Float32Array> =>
  (await extractor("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

/** Los imanes, tal como los marca el mapa publicado: una sola fuente. */
const IMAN = new Set<string>();
for (const l of ["es", "en"] as Idioma[]) {
  for (const s of MAPA[l]) for (const t of s.temas) if (t.iman) IMAN.add(t.consulta);
}

const casos = cargarCasos();

interface Fila {
  id: string; lang: Idioma; categoria: string; q: string;
  motivo: "sin ancla" | "bajo el umbral";
  vecinos: { titulo: string; seccion: string | null; iman: boolean }[];
}
const filas: Fila[] = [];

for (const c of casos) {
  const v = await emb(c.q);
  const d = decidirCon(motor, c.q, v, c.lang as Idioma, 3);
  if (d.tipo === "curada") continue;                 // la capa 0 ya contesta: no hay puente
  if (d.tipo === "responde" && !todos) continue;

  const corpus = motor.por[c.lang as Idioma].corpus;
  const top = corpus.buscar(v, c.q, "leonardo", 3).top;

  /**
   * «SIN ANCLA» = el gate ni siquiera llegó al coseno (D-231): `cosMax` es 0.
   * Es el caso donde §4F dice explícitamente que no se muestre nada.
   */
  const cosMax = d.tipo === "abstiene" ? d.cosMax : null;
  const motivo = cosMax === 0 ? "sin ancla" as const : "bajo el umbral" as const;

  const vistos = new Set<string>();
  const vecinos: Fila["vecinos"] = [];
  for (const t of top) {
    const titulo = c.lang === "es" ? (t.chunk.tituloEs ?? t.chunk.richterTitle) : t.chunk.richterTitle;
    if (!titulo || vistos.has(titulo)) continue;
    vistos.add(titulo);
    vecinos.push({ titulo, seccion: t.chunk.section, iman: IMAN.has(titulo) });
  }
  filas.push({ id: c.id, lang: c.lang as Idioma, categoria: c.category, q: c.q, motivo, vecinos });
}

console.log(`\n# El puente — planilla para etiquetar. Ver 28 §4F\n`);

const sinAncla = filas.filter((f) => f.motivo === "sin ancla");
const conAncla = filas.filter((f) => f.motivo === "bajo el umbral");

console.log(`  consultas que se abstienen : ${filas.length}`);
console.log(`  sin ancla (no se muestra)  : ${sinAncla.length}  ← §4F condición 2`);
console.log(`  con ancla (candidatas)     : ${conAncla.length}\n`);

console.log(`## Lo que se mide solo: cuántos vecinos son temas imán\n`);
const totalVec = conAncla.reduce((a, f) => a + f.vecinos.length, 0);
const imanes = conAncla.reduce((a, f) => a + f.vecinos.filter((v) => v.iman).length, 0);
const conAlgunIman = conAncla.filter((f) => f.vecinos.some((v) => v.iman)).length;
console.log(`  vecinos ofrecidos          : ${totalVec}`);
console.log(`  de esos, temas imán        : ${imanes} (${totalVec ? ((imanes / totalVec) * 100).toFixed(1) : "0"}%)`);
console.log(`  consultas con ≥1 imán      : ${conAlgunIman} de ${conAncla.length}`);

/**
 * LA CONCENTRACION ES LA SEÑAL. Si un puñado de títulos cubre casi todas las
 * consultas, «lo más cercano» es un sinónimo de «lo de siempre».
 */
const cuenta = new Map<string, number>();
for (const f of conAncla) for (const v of f.vecinos) cuenta.set(v.titulo, (cuenta.get(v.titulo) ?? 0) + 1);
const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
const top5 = orden.slice(0, 5).reduce((a, x) => a + x[1], 0);
console.log(`  títulos distintos ofrecidos: ${orden.length}`);
console.log(`  los 5 más repetidos cubren : ${top5} de ${totalVec} (${totalVec ? ((top5 / totalVec) * 100).toFixed(1) : "0"}%)\n`);
for (const [t, n] of orden.slice(0, 8)) console.log(`     ${String(n).padStart(3)}×  ${t}${IMAN.has(t) ? "  ⟵ imán" : ""}`);

console.log(`\n## La planilla — una fila por consulta, para poner la etiqueta a mano\n`);
console.log(`| id | categoría | consulta | vecino 1 | vecino 2 | vecino 3 | ¿real? |`);
console.log(`|---|---|---|---|---|---|---|`);
for (const f of conAncla) {
  const v = [0, 1, 2].map((i) => {
    const x = f.vecinos[i];
    return x ? `${x.titulo}${x.iman ? " ⟵imán" : ""}` : "—";
  });
  console.log(`| ${f.id} | ${f.categoria} | ${f.q} | ${v[0]} | ${v[1]} | ${v[2]} |  |`);
}

console.log(`\n## Las que NO reciben puente (sin una sola palabra del corpus)\n`);
for (const f of sinAncla) console.log(`  ${f.id.padEnd(9)} ${f.q}`);

console.log(`\n> §4F: se construye si ≥80% de las consultas CON tema reciben un vecino real`);
console.log(`> y CERO disparates en las preguntas sobre su vida. La etiqueta la pone una`);
console.log(`> persona leyendo la tabla de arriba; este script sólo la prepara.\n`);
