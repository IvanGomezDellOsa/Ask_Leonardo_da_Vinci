/**
 * Los fallos de recuperación que quedan, con la evidencia para clasificarlos.
 * Ver D-205.
 *
 *   npm run evals:fallos
 *
 * POR QUE EXISTE. El `00-README` los listaba como **«los tres fallos de
 * recuperación sin resolver»** —`B-02`, `B-07` y el vuelo en inglés— y con eso
 * bastaba para pensar que son un problema con tres instancias. **Son tres cosas
 * distintas**, y la diferencia decide qué se puede intentar con cada una:
 *
 *   el vuelo    ya NO falla el criterio: entra en posición 2. Pero de los tres
 *               pasajes que van al prompt **uno solo habla de volar** — los otros
 *               dos son la naturaleza de la vista y la magnanimidad del halcón.
 *               En castellano son 3 de 3. **Parcial, no sin resolver**
 *   B-02        el denso lo deja en 34 (es) / 17 (en), pero lo que SI trae
 *               contesta la pregunta: es una ETIQUETA ANGOSTA, no un fallo
 *   B-07        el denso lo deja en 68 (es) / 95 (en) y lo que trae no habla del
 *               tema. **Era el único fallo de recuperación de verdad**, y desde
 *               D-217 está medido y cerrado — ver el aviso de abajo
 *
 * Ninguna palanca de ordenamiento sube un pasaje 68 puestos, así que juntarlos
 * bajo una etiqueta común invitaba a buscarles una cura común que no existe.
 *
 * ⚠ B-07: NO REINTENTAR CAMBIAR LO QUE SE EMBEBE. D-217 midió las cuatro
 * variantes de preparación del texto del chunk. Sacarle el título de Richter
 * —la hipótesis obvia, porque el título dice «Juegos y ejercicios útiles» y el
 * encabezado del propio Leonardo dice «UNA MANERA DE DESARROLLAR Y DESPERTAR LA
 * MENTE A VARIAS INVENCIONES»— gana **+0,0002** contra una brecha de **0,0368**.
 * Agregarle el encabezado de Leonardo **empeora** (−0,0112): diluye el texto con
 * una línea corta. El título ajeno no es lo que hunde al pasaje; es que el modelo
 * no acerca «imaginación» a «mirar manchas en una pared». Lo único que podría
 * moverlo es otro modelo de embeddings, que recalibra τ, recall y los 129 MB del
 * navegador.
 *
 * Y corrido por `responder()`, B-07 **contesta con Leonardo real, citado exacto y
 * sin que intervenga ninguna garantía de cita**. Es prioridad 3 (cobertura), no
 * prioridad 1 (no alucinar).
 *
 * ⚠ LAS TABLAS DE D-103 Y D-111 NO SE PUEDEN COMPARAR CON ESTO. Salieron del
 * instrumento anterior a D-134, que buscaba las consultas castellanas en el
 * índice inglés, y además son previas al índice q8 de D-126. Este script mide el
 * motor real, ruteado por idioma.
 *
 * NO GASTA CUOTA: no genera una sola respuesta. Sólo mira dónde cae cada cosa.
 */

import { cargarExtractor } from "../src/lib/embed.js";
import { cargarMotor, type Idioma } from "../src/lib/grounding.js";
import { recortar, rangosDeRichter, caeEnRangos } from "../src/lib/retrieval.js";
import { ART, cargarCasos } from "./comun.js";

const motor = cargarMotor(ART);
const embed = await cargarExtractor();
const casos = cargarCasos();
const vec = async (t: string) =>
  (await embed("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

interface Sujeto { etq: string; q: string; lang: Idioma; rangos: [number, number][]; nota: string }

const sujetos: Sujeto[] = [
  /**
   * El vuelo NO ESTA EN EL EVAL SET: es una de las 20 preguntas de control de
   * `tools/ask.ts --lote`. Por eso `recall.B.k3.fallos` no lo cuenta y la
   * regresión no lo vigila — conviene saberlo antes de buscarlo ahí.
   */
  { etq: "vuelo en", q: "Can man fly as the birds do?", lang: "en",
    rangos: [[1120, 1131]], nota: "control de `ask --lote`, no del eval set" },
  { etq: "vuelo es", q: "¿Se puede construir una máquina para que el hombre vuele?", lang: "es",
    rangos: [[1120, 1131]], nota: "el mismo, en el idioma donde funciona" },
];
for (const id of ["B-02es", "B-02en", "B-07es", "B-07en"]) {
  const c = casos.find((x) => x.id === id)!;
  sujetos.push({ etq: id, q: c.q, lang: c.lang, rangos: rangosDeRichter(c.expected_topic!),
                 nota: c.expected_topic! });
}

console.log(`\n# Los fallos de recuperación, con la evidencia para clasificarlos\n`);
/**
 * ⚠ «ESTA EN EL TOP-3» NO ES LO MISMO QUE «EL TOP-3 SIRVE», y por eso va la
 * cuarta columna.
 *
 * El vuelo en inglés **entra en posición 2** y por el criterio de recall
 * acierta. Pero de los tres pasajes que van al prompt, **uno solo habla de
 * volar**: los otros dos son la naturaleza de la vista y la magnanimidad del
 * halcón. En castellano los tres son máquinas voladoras. Contar sólo el acierto
 * habría dicho «resuelto» sobre un caso que sigue entregando un tercio del
 * material — que es la misma clase de error que D-098 cometió sumando dos
 * columnas que medían cosas distintas.
 */
console.log(`| caso | cos_max | posición DENSA de lo esperado | posición tras RRF | útiles en top-3 | clase |`);
console.log(`|---|---:|---:|---:|---:|---|`);

const detalles: { s: Sujeto; top3: { n: number | null; tit: string | null; texto: string }[] }[] = [];

function clasificar(densa: number, rrf: number, utiles: number): string {
  if (rrf <= 3 && utiles === 3) return "acierta";
  if (rrf <= 3) return `**parcial**: ${utiles} de 3 sirven`;
  if (densa <= 3) return "**fusión**: el denso lo tenía";
  if (densa <= 40) return "denso flojo";
  return "**fuera de alcance del ranking**";
}

for (const s of sujetos) {
  const { corpus } = motor.por[s.lang];
  const v = await vec(s.q);
  const filas = corpus.filasPorVoz.leonardo;
  const densos = corpus.cosenos(v, filas).sort((a, b) => b.cos - a.cos);
  const posDensa = densos.findIndex((d) => caeEnRangos(corpus.chunks[d.fila].richterNos, s.rangos)) + 1;

  const { top, cosMax } = corpus.buscar(v, s.q, "leonardo", 40);
  const posRrf = top.findIndex((r) => caeEnRangos(r.chunk.richterNos, s.rangos)) + 1;

  const utiles = top.slice(0, 3).filter((r) => caeEnRangos(r.chunk.richterNos, s.rangos)).length;
  console.log(`| ${s.etq} | ${cosMax.toFixed(4)} | ${posDensa || "—"} | ${posRrf || ">40"} | ` +
              `${utiles} | ${clasificar(posDensa, posRrf || 999, utiles)} |`);

  detalles.push({
    s,
    top3: top.slice(0, 3).map((r) => ({
      n: r.chunk.richterNo,
      tit: (s.lang === "es" && r.chunk.tituloEs) ? r.chunk.tituloEs : r.chunk.richterTitle,
      texto: recortar((s.lang === "es" && r.chunk.textoEs) ? r.chunk.textoEs : r.chunk.text, 45),
    })),
  });
}

/**
 * LO QUE TRAE SE IMPRIME PARA LEERLO. `recall_k.ts` lo dice y D-099 lo pagó: un
 * fallo de `expected_topic` puede ser un casi-empate, una etiqueta angosta o un
 * fallo de verdad, y **la tabla no distingue cuál**. Sin leer los pasajes, B-02
 * y B-07 son el mismo número y son cosas distintas.
 */
console.log(`\n## Lo que trae cada uno, para leerlo\n`);
for (const d of detalles) {
  console.log(`### ${d.s.etq} — «${d.s.q}»\n`);
  console.log(`Esperaba: ${d.s.nota}\n`);
  for (const p of d.top3) console.log(`- **R-${p.n}** «${p.tit}»\n  ${p.texto}\n`);
}
