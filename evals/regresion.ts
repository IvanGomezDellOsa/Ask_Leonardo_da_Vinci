/**
 * Guarda de regresión: recalcula los números offline y los compara con la línea
 * de base fijada. Ver D-115.
 *
 *   npm run regresion            comprueba; sale con código 1 si algo se movió
 *   npm run regresion -- --fijar reescribe la línea de base con lo actual
 *   npm run regresion -- --lento incluye el alcance (375 temas, ~5 min)
 *
 * POR QUE EXISTE. En una sola sesión se tocaron la curaduría, el índice por
 * idioma, τ, el pipeline de respuesta y la huella del prompt. Cada cambio se
 * verificó **a mano**, corriendo `evals:recall` y `evals:compuerta` y mirando si
 * seguía diciendo «2 / 9» y «65 / 54 / 1».
 *
 * Eso funciona mientras alguien se acuerde, y es exactamente el modo de fallo que
 * este proyecto viene documentando desde D-086: `podadas` estuvo en 0 durante
 * dieciséis corridas sin que nadie lo notara, porque el indicador se escribía y
 * no lo leía ningún código permanente (D-100). **Una comprobación que depende de
 * la memoria de quien edita no es una comprobación.**
 *
 * QUE PINCHA Y QUE NO. Sólo entran números que son **conteos exactos y
 * deterministas**: no hay temperatura, no hay juez, no hay muestreo. Si uno se
 * mueve, se movió el sistema — no el azar. Por eso este script puede fallar la
 * build y `evals:juzgar` no podría.
 *
 * Y NO PINCHA LAS PANTALLAS COMO SI FUERAN VEREDICTOS. Los fallos de categoría B
 * se fijan porque el NÚMERO es determinista, pero la línea de base anota que un
 * cambio ahí pide leer los casos antes de declararlo regresión (D-099).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { cargarExtractor } from "../src/lib/embed.js";
import { Corpus, rangosDeRichter, caeEnRangos } from "../src/lib/retrieval.js";
import { cargarMotor, decidirCon, capaCurada, type Idioma } from "../src/lib/grounding.js";
import { ART, cargarCasos } from "./comun.js";
import { MAPA } from "../src/data/mapa.js";

const LINEA = new URL("linea_base.json", ART);
const fijar = process.argv.includes("--fijar");
const lento = process.argv.includes("--lento");

interface Punto { valor: number | string; decision: string; nota?: string }

const motor = cargarMotor(ART);
const embed = await cargarExtractor();
const emb = async (t: string) =>
  (await embed("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

const casos = cargarCasos();
const vec = new Map<string, Float32Array>();
for (const c of casos) vec.set(c.id, await emb(c.q));

const medido: Record<string, Punto> = {};

// ---- retrieval, categoría A: el único conteo duro que queda -------------
{
  const A = casos.filter((c) => c.expected_passages?.length);
  let fallos = 0;
  for (const c of A) {
    const tr = new Set(motor.por[c.lang].corpus
      .buscar(vec.get(c.id)!, c.q, "leonardo", 3).top.flatMap((t) => t.chunk.richterNos));
    if (!c.expected_passages!.some((e) => tr.has(e))) fallos++;
  }
  medido["recall.A.k3.fallos"] = { valor: fallos, decision: "D-096",
    nota: "Conteo duro: el pasaje está en el top-3 o no está. Si sube, es una regresión real." };
}

// ---- retrieval, categoría B: PANTALLA, no veredicto ---------------------
{
  const B = casos.filter((c) => !c.expected_passages?.length && c.expected_topic)
    .map((c) => ({ ...c, r: rangosDeRichter(c.expected_topic!) })).filter((c) => c.r.length);
  let fallos = 0;
  for (const c of B) {
    const tr = motor.por[c.lang].corpus
      .buscar(vec.get(c.id)!, c.q, "leonardo", 3).top.flatMap((t) => t.chunk.richterNos);
    if (!caeEnRangos(tr, c.r)) fallos++;
  }
  medido["recall.B.k3.fallos"] = { valor: fallos, decision: "D-099",
    nota: "PANTALLA. Un cambio acá pide LEER los casos antes de llamarlo regresión: puede ser un casi-empate o una etiqueta angosta." };
}

// ---- el gate sobre los 120 casos ---------------------------------------
{
  let ok = 0, fuga = 0, sobre = 0;
  for (const c of casos) {
    const d = decidirCon(motor, c.q, vec.get(c.id)!, c.lang, 3);
    const abst = d.tipo !== "responde";
    if (abst === c.should_abstain) ok++; else if (c.should_abstain) fuga++; else sobre++;
  }
  medido["gate.aciertos"] = { valor: ok, decision: "D-100" };
  medido["gate.filtraciones"] = { valor: fuga, decision: "D-100",
    nota: "Alta por diseño: τ está en el punto de 0% de pérdida y quien juzga lo dudoso es el LLM (D-039)." };
  medido["gate.sobreAbstenciones"] = { valor: sobre, decision: "D-041",
    nota: "El número que hay que vigilar: la sobre-abstención no es gratis." };
}

// ---- curaduría y umbrales: artefactos, no búsquedas ---------------------
{
  const cur = JSON.parse(readFileSync(new URL("curaduria.json", ART), "utf8"));
  const porTipo: Record<string, number> = {};
  for (const f of Object.values(cur.chunks) as { utility: string }[]) {
    porTipo[f.utility] = (porTipo[f.utility] ?? 0) + 1;
  }
  medido["curaduria.inventory"] = { valor: porTipo.inventory ?? 0, decision: "D-098" };
  medido["curaduria.no_traducible"] = { valor: porTipo.no_traducible ?? 0, decision: "D-108" };
  medido["curaduria.aparato"] = { valor: porTipo.aparato ?? 0, decision: "D-207",
    nota: "Catálogo del editor dentro de un pasaje de Leonardo. Si baja, volvió a entrar al índice material que se recupera y se cita como si fuera suyo." };
  medido["indice.chunksLeonardo"] = { valor: motor.por.en.corpus.filasPorVoz.leonardo.length, decision: "D-098" };
  medido["tau.en"] = { valor: motor.por.en.umbrales.tau.en, decision: "D-100" };
  medido["tau.es"] = { valor: motor.por.es.umbrales.tau.es, decision: "D-108" };
}

// ---- ¿el mapa de temas sigue apuntando a títulos que existen? ------------
{
  /**
   * ⚠ EL MAPA GUARDA LOS TITULOS ORIGINALES COMO CONSULTAS. Ver D-233.
   *
   * `src/data/mapa.ts` está bundleado y viaja al navegador; sus `consulta` son
   * los títulos de Richter con los que se midió el 345/375 de `alcance.json`.
   * **Si alguien regenera el corpus sin correr `npm run mapa`, esos títulos
   * pueden dejar de existir y cada clic mandaría una consulta muerta** — sin
   * excepción, sin error y sin que nadie se entere: el gate simplemente
   * devolvería peores pasajes. Es exactamente el modo de fallo que D-211 y
   * D-226 arreglaron en los otros dos artefactos que se alinean por id.
   *
   * Se cuentan las consultas que YA NO existen. Tiene que ser 0.
   */
  const titulos = new Set<string>();
  for (const c of motor.por.es.corpus.chunks) {
    if (c.voice !== "leonardo") continue;
    const t = c.tituloEs ?? c.richterTitle;
    if (t) titulos.add(t);
  }
  const huerfanas = MAPA.flatMap((s) => s.temas).filter((t) => !titulos.has(t.consulta));
  medido["mapa.temas"] = { valor: MAPA.reduce((a, s) => a + s.temas.length, 0), decision: "D-233" };
  medido["mapa.consultasHuerfanas"] = { valor: huerfanas.length, decision: "D-233",
    nota: "Temas del mapa cuyo título ya no existe en el corpus. Si sube, el mapa quedó viejo: correr `npm run mapa`." };
}

// ---- ¿el índice castellano habla castellano? ----------------------------
{
  /**
   * SE COMPRUEBA POR CONTENIDO, NO POR FECHA DE ARCHIVO. Ver D-202.
   *
   * `artifacts/es/index.bin` puede construirse con la traducción o sin ella:
   * `indexar --idioma es` usa `chunks_es.json` **si el chunk está traducido** y
   * cae al inglés si no. Un índice reconstruido antes de que la traducción
   * existiera —o después de un `chunks_es.json` incompleto— queda con vectores
   * ingleses adentro del índice castellano, **y no falla nada**: sigue
   * devolviendo pasajes plausibles, sólo que peores, que es el modo de fallo que
   * este proyecto lleva quince entradas documentando.
   *
   * Se embebe el pasaje en los dos idiomas y se mira contra cuál se parece el
   * vector guardado. Doce chunks fijos, elegidos por orden y no al azar, para que
   * el número sea determinista.
   *
   * ⚠ SOLO DE LEONARDO DESDE D-211, y no por simplificar: **el índice ya no tiene
   * otra voz**. Muestrear de Richter daba 6 de 12 —no porque falte la traducción
   * sino porque esas filas no existen—, o sea un número que baja por la razón
   * equivocada. Que las notas de Richter estén traducidas lo cubre
   * `npm run curadas`, que verifica cada `citaEs` contra su `textoEs`.
   */
  const es = JSON.parse(readFileSync(new URL("chunks_es.json", ART), "utf8")) as
    Record<string, { texto: string; titulo: string | null }>;
  const corpusEs = motor.por.es.corpus;
  const muestra = corpusEs.chunks
    .filter((c) => c.voice === "leonardo" && es[c.id] && corpusEs.meta.ids.includes(c.id))
    .slice(0, 12);

  let enCastellano = 0;
  for (const c of muestra) {
    const fila = corpusEs.meta.ids.indexOf(c.id);
    if (fila < 0) continue;
    const t = es[c.id]!;
    const vEs = (await embed("passage: " + (t.titulo ? t.titulo + ". " : "") + t.texto,
      { pooling: "mean", normalize: true })).data as Float32Array;
    const vEn = (await embed("passage: " + (c.richterTitle ? c.richterTitle + ". " : "") + c.text,
      { pooling: "mean", normalize: true })).data as Float32Array;
    if (corpusEs.cosenos(vEs, [fila])[0].cos > corpusEs.cosenos(vEn, [fila])[0].cos) enCastellano++;
  }
  medido["indice.es.enCastellano"] = { valor: enCastellano, decision: "D-202",
    nota: `De ${muestra.length} chunks muestreados, cuántos tienen el vector del texto castellano. Si baja, el índice es se reconstruyó sin la traducción.` };
}

// ---- alcance: caro, sólo con --lento -----------------------------------
if (lento) {
  const base = motor.por.en.corpus;
  const temas = new Map<string, { es: string | null; nums: Set<number> }>();
  for (const f of base.filasPorVoz.leonardo) {
    const c = base.chunks[f];
    if (!c.richterTitle) continue;
    const t = temas.get(c.richterTitle) ?? { es: c.tituloEs ?? null, nums: new Set<number>() };
    for (const n of c.richterNos) t.nums.add(n);
    temas.set(c.richterTitle, t);
  }
  const limpiar = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "").trim() || s.trim();
  let ambos = 0;
  for (const [k, t] of temas) {
    let n = 0;
    for (const idi of ["es", "en"] as Idioma[]) {
      const q = limpiar(idi === "es" && t.es ? t.es : k);
      const d = decidirCon(motor, q, await emb(q), idi, 3);
      if (d.tipo === "responde" && d.pasajes.some((p) => p.chunk.richterNos.some((x) => t.nums.has(x)))) n++;
    }
    if (n === 2) ambos++;
  }
  medido["alcance.ambosIdiomas"] = { valor: ambos, decision: "D-107" };
  medido["alcance.temas"] = { valor: temas.size, decision: "D-104" };
}

// ---- comparación --------------------------------------------------------
if (fijar || !existsSync(LINEA)) {
  writeFileSync(LINEA, JSON.stringify({
    regla: "Números offline, deterministas y sin juez. `npm run regresion` los recalcula y falla si alguno se movió. Ver D-115.",
    fijado: new Date().toISOString().slice(0, 10),
    parcial: !lento,
    puntos: medido,
  }, null, 2) + "\n");
  console.log(`\nlínea de base ${existsSync(LINEA) ? "reescrita" : "creada"}: artifacts/linea_base.json`);
  console.log(`  ${Object.keys(medido).length} puntos${lento ? "" : " (sin alcance; usar --lento para incluirlo)"}`);
  for (const [k, v] of Object.entries(medido)) console.log(`  ${k.padEnd(28)} ${v.valor}`);
  process.exit(0);
}

const previo = JSON.parse(readFileSync(LINEA, "utf8")) as { puntos: Record<string, Punto> };
const movidos: string[] = [];
const sinFijar: string[] = [];

console.log(`\n# Regresión — línea de base de ${JSON.parse(readFileSync(LINEA, "utf8")).fijado}\n`);
for (const [k, v] of Object.entries(medido)) {
  const p = previo.puntos[k];
  if (!p) { sinFijar.push(k); console.log(`  ?  ${k.padEnd(28)} ${v.valor}   (sin fijar)`); continue; }
  if (p.valor === v.valor) { console.log(`  ok ${k.padEnd(28)} ${v.valor}`); continue; }
  movidos.push(k);
  console.log(`  ** ${k.padEnd(28)} ${p.valor} → ${v.valor}   [${p.decision}]`);
  if (p.nota) console.log(`       ${p.nota}`);
}

if (!movidos.length) {
  console.log(`\n  sin cambios en ${Object.keys(medido).length} puntos.${sinFijar.length ? `  (${sinFijar.length} sin fijar)` : ""}`);
  process.exit(0);
}
console.log(`\n  **${movidos.length} punto(s) se movieron.**`);
console.log(`  Si el cambio es intencional y está justificado en el log, fijar la nueva línea`);
console.log(`  con \`npm run regresion -- --fijar\` **en el mismo commit que lo causa**.`);
process.exit(1);
