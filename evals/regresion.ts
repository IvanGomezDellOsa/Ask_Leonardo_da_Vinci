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
import { rangosDeRichter, caeEnRangos } from "../src/lib/retrieval.js";
import { cargarMotor, decidirCon, type Idioma } from "../src/lib/grounding.js";
import { ART, cargarCasos } from "./comun.js";
import { MAPA } from "../src/data/mapa.js";
import { HUELLA_PORTADA, PORTADA } from "../src/data/portada.js";
import { huellaPrompt, varianteVigente } from "../src/lib/llm.js";

const LINEA = new URL("linea_base.json", ART);
const fijar = process.argv.includes("--fijar");
const lento = process.argv.includes("--lento");

interface Punto { valor: number | string; decision: string; nota?: string }

const motor = cargarMotor(ART);
const embed = await cargarExtractor();
const emb = async (t: string) =>
  (await embed("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

const todos = cargarCasos();
/**
 * ⚠ DOS BANCOS, DOS MEDICIONES. Ver D-236.
 *
 * `casos` son los 120 de control, y son los que fijan los numeros historicos:
 * `recall.*` y `gate.*` se comparan contra su propia linea de base desde D-115 y
 * **mezclarles 50 casos nuevos los moveria por construccion**, no por un cambio
 * del sistema. Un numero que se mueve sin que se mueva el sistema es exactamente
 * lo que esta guarda existe para que no pase.
 *
 * `comunes` son los 50 de banco comun, y tienen sus propios puntos.
 */
const casos = todos.filter((c) => c.banco !== "comun");
const comunes = todos.filter((c) => c.banco === "comun");
const vec = new Map<string, Float32Array>();
for (const c of todos) vec.set(c.id, await emb(c.q));

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

// ---- el gate sobre los 120 de control -----------------------------------
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

// ---- el gate sobre el banco comun, y por idioma -------------------------
{
  /**
   * ⚠ SE MIDE POR IDIOMA, y no por prolijidad. En la primera corrida las tres
   * metas que se colaban se colaban **todas en ingles** — `what can i ask you
   * about?`, `i didn't understand what you said`, `do you speak spanish?` — y
   * `do you like music?` responde en ingles y se abstiene en castellano siendo la
   * misma pregunta. Un solo numero agregado esconderia que el problema tiene
   * idioma: τ_en (0,826) es mas bajo que τ_es (0,841) y el banco de control, con
   * cero preguntas meta, nunca pudo verlo.
   */
  let ok = 0, fuga = 0, sobre = 0, fugaEn = 0, fugaEs = 0;
  for (const c of comunes) {
    const d = decidirCon(motor, c.q, vec.get(c.id)!, c.lang, 3);
    const abst = d.tipo !== "responde";
    if (abst === c.should_abstain) ok++;
    else if (c.should_abstain) { fuga++; if (c.lang === "en") fugaEn++; else fugaEs++; }
    else sobre++;
  }
  medido["gateComun.aciertos"] = { valor: ok, decision: "D-236",
    nota: `De ${comunes.length} casos escritos como tipea una persona. Ver 28 §4E.` };
  medido["gateComun.filtraciones"] = { valor: fuga, decision: "D-236",
    nota: "Debía abstenerse y respondió. Son saludos, metapreguntas y datos biográficos que no están escritos." };
  medido["gateComun.filtraciones.en"] = { valor: fugaEn, decision: "D-236" };
  medido["gateComun.filtraciones.es"] = { valor: fugaEs, decision: "D-236" };
  medido["gateComun.sobreAbstenciones"] = { valor: sobre, decision: "D-236",
    nota: "PANTALLA. Podía contestar y se abstuvo: son preguntas cuya respuesta SÍ está en el corpus, verificada a mano." };
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
  /** ⚠ LOS DOS IDIOMAS. El mapa inglés se alinea contra los títulos ingleses. */
  const titulosEn = new Set<string>();
  for (const c of motor.por.en.corpus.chunks) {
    if (c.voice === "leonardo" && c.richterTitle) titulosEn.add(c.richterTitle);
  }
  const huerfanas = MAPA.es.flatMap((s) => s.temas).filter((t) => !titulos.has(t.consulta)).length
    + MAPA.en.flatMap((s) => s.temas).filter((t) => !titulosEn.has(t.consulta)).length;
  medido["mapa.temas"] = {
    valor: MAPA.es.reduce((a, s) => a + s.temas.length, 0)
         + MAPA.en.reduce((a, s) => a + s.temas.length, 0), decision: "D-233" };
  /**
   * ⚠ LOS DOS MAPAS TIENEN QUE MEDIR LO MISMO. Ver D-241.
   *
   * El mismo corpus, las mismas secciones: si un idioma tiene más temas que el
   * otro, alguno está mostrando de más o de menos. Estuvo en 423 contra 396
   * desde D-233 y nadie lo miró: eran 27 títulos ingleses con DOS traducciones
   * castellanas cada uno, así que el rail castellano mostraba 27 temas dos
   * veces, con los pasajes repartidos entre las dos redacciones.
   *
   * Se cuenta la diferencia, no el total: el total puede cambiar legítimamente
   * cuando cambia el corpus, la diferencia no.
   */
  medido["mapa.asimetria"] = {
    valor: Math.abs(MAPA.es.reduce((a, s) => a + s.temas.length, 0)
                  - MAPA.en.reduce((a, s) => a + s.temas.length, 0)),
    decision: "D-241",
    nota: "Temas de más que tiene un idioma sobre el otro. Tiene que ser 0: son el mismo corpus y las mismas secciones.",
  };
  /**
   * ⚠ CUANTOS TEMAS NECESITAN REFUERZO PARA ENCONTRARSE A SI MISMOS (D-261).
   *
   * Son 7 de 792, y `npm run mapa` los calcula solo. **Este punto es barato y
   * el que lo mide de verdad no lo es**: comprobar que ninguno se abstiene pide
   * embeber las 792 consultas, que es `npm run mapa:abstenciones` y tarda
   * minutos. Acá se vigila el proxy: si el corpus cambia y este número se
   * mueve, hay que correr el medidor y leer los casos.
   *
   * Que suba no es necesariamente malo —el generador arregló más temas—, pero
   * **es siempre una señal de que el corpus se movió debajo del mapa**.
   */
  medido["mapa.refuerzos"] = {
    valor: MAPA.es.flatMap((s) => s.temas).filter((t) => t.refuerzo).length
         + MAPA.en.flatMap((s) => s.temas).filter((t) => t.refuerzo).length,
    decision: "D-261",
    nota: "Temas cuyo título no alcanza a recuperar sus propios pasajes y llevan términos de refuerzo. Si se mueve: `npm run mapa:abstenciones`.",
  };
  medido["mapa.consultasHuerfanas"] = { valor: huerfanas, decision: "D-233",
    nota: "Temas del mapa, en cualquiera de los dos idiomas, cuyo título ya no existe en el corpus. Si sube, el mapa quedó viejo: correr `npm run mapa`." };
}

// ---- ¿la caché de portada sigue vigente? --------------------------------
{
  /**
   * ⚠ LA CACHE NO AVISABA CUANDO QUEDABA VIEJA. Ver D-237.
   *
   * Las 6 preguntas de portada viajan congeladas en el bundle del navegador
   * (D-132) y **se sirven sin pasar por el API**, que es justamente lo que las
   * hace instantáneas y a prueba de cuota. El precio: se saltean la validación
   * de huella que `app/api/chat` hace desde D-112. La huella estaba, pero en un
   * COMENTARIO — y un comentario no lo compara nadie.
   *
   * Ya mordió: el sitio estuvo sirviendo respuestas de un prompt y un índice que
   * ya no existían, en silencio, hasta que D-230 lo encontró de casualidad.
   *
   * ⚠ Y ESTO BLOQUEA A `28` §4C. Congelar las ~800 respuestas del mapa crearía
   * una SEGUNDA caché con el mismo agujero y dieciséis veces más grande. Primero
   * la comprobación.
   *
   * Dos cosas, las dos deterministas:
   *   1. la huella del bundle contra la vigente (prompt + corpus + índices + τ + curaduría)
   *   2. que cada número de Richter citado siga existiendo en SU idioma
   */
  const vigente = huellaPrompt(varianteVigente(ART));
  medido["cache.portadaVigente"] = { valor: HUELLA_PORTADA === vigente ? 1 : 0, decision: "D-237",
    nota: `1 = la caché de portada se generó con el prompt y el índice de hoy. Si baja a 0, el sitio está sirviendo respuestas viejas en silencio: correr \`npm run precalcular\` y \`npm run exportar:portada\`. bundle=${HUELLA_PORTADA} vigente=${vigente}` };

  let muertos = 0;
  for (const [clave, e] of Object.entries(PORTADA)) {
    const idioma = clave.endsWith(":es") ? "es" : "en";
    const corpus = motor.por[idioma as Idioma].corpus;
    for (const p of e.pasajes) {
      if (p.richterNo !== null && !corpus.chunks.some((c) => c.richterNos.includes(p.richterNo!))) muertos++;
    }
  }
  /**
   * ⚠ CUANTAS ENTRADAS TIENE EL BUNDLE. Ver D-238.
   *
   * Desde que `precalcular:mapa` escribe en el mismo `respuestas_fijas.json`,
   * un `exportar:portada` sin el filtro `origen !== "mapa"` bundlearia las 731
   * del mapa: **40 KB pasarian a unos 3 MB** que cada visitante baja para leer,
   * como mucho, una. No romperia nada — solo haria el sitio lento, en silencio.
   */
  medido["cache.portadaEntradas"] = { valor: Object.keys(PORTADA).length, decision: "D-238",
    nota: "6 preguntas x 2 idiomas. Si sube, se colaron al bundle respuestas del mapa: van por la ruta, no por el bundle." };

  medido["cache.portadaPasajesMuertos"] = { valor: muertos, decision: "D-237",
    nota: "Pasajes citados por la portada cuyo número de Richter ya no está en el corpus de su idioma. Tiene que ser 0." };
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
