/**
 * Material de adjudicacion humana. Ver D-087 y D-090.
 *
 * NO se etiquetan 108 casos. Se etiqueta SOLO donde dos jueces de familias
 * distintas discrepan, que es donde vive la ambiguedad y donde el juicio humano
 * rinde. El resto —donde los dos coinciden— se acepta.
 *
 * EL PROTOCOLO ES CIEGO A PROPOSITO: no se muestra que dijo cada juez, ni
 * cuantos hay de cada tipo, ni la categoria del caso. Ver la etiqueta de un
 * modelo antes de decidir ancla la respuesta, y entonces el humano deja de ser
 * una fuente de error independiente —que es lo unico que aporta— y pasa a ser un
 * validador del modelo. `muestra_para_etiquetar.ts` ya establecio este criterio.
 *
 * LO QUE SE PREGUNTA son las dos decisiones que la rubrica pide, separadas,
 * porque los jueces fallan en las dos y por motivos distintos:
 *   1. ¿Esta afirmacion contiene un ELEMENTO DURO? (si no, es X y no se anota)
 *   2. Si lo contiene, ¿ese elemento esta EN LOS PASAJES? (si no, es N)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { RAIZ, cargarCasos, leerJsonl, type Resultado } from "./comun.js";
import { recortar } from "../src/lib/retrieval.js";

interface Afirmacion { texto: string; etiqueta: string; motivo: string }
interface Veredicto {
  id: string; juez: string; prompt?: string; resp?: string;
  afirmaciones?: Afirmacion[]; error?: string;
}

const arg = (n: string, d = ""): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const entrada = arg("entrada");
if (!entrada) { console.error("falta --entrada <archivo.jsonl>"); process.exit(1); }
const maximo = Number(arg("max", "18"));

const h = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 12);

const casos = new Map(cargarCasos().map((c) => [c.id, c]));
const filas = new Map<string, Resultado>();
for (const r of leerJsonl<Resultado>(new URL(`evals/out/${entrada}`, RAIZ))) filas.set(r.id, r);

/** Solo veredictos VIGENTES: mismo prompt de generacion y misma respuesta. */
/**
 * SE LEE EN CRUDO, no con `leerJsonl`. Ese helper deduplica por `id` con
 * "ultima fila gana", que es correcto para los resultados —una fila por caso—
 * pero destructivo aca: en el archivo de veredictos el id NO es la clave, porque
 * hay una fila por (caso, juez). Deduplicar por id borraba a un juez entero y
 * dejaba cero pares comparables, sin ningun error a la vista.
 */
const crudo = (u: URL): Veredicto[] =>
  readFileSync(u, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Veredicto);

const porJuez = new Map<string, Map<string, Veredicto>>();
for (const v of crudo(new URL(`evals/out/${entrada.replace(/\.jsonl$/, "")}.veredictos.jsonl`, RAIZ))) {
  if (v.error) continue;
  const f = filas.get(v.id);
  if (!f || !f.respuesta || !v.resp || v.resp !== h(f.respuesta)) continue;
  if (!porJuez.has(v.juez)) porJuez.set(v.juez, new Map());
  porJuez.get(v.juez)!.set(v.id, v);
}

const jueces = [...porJuez.keys()];
if (jueces.length < 2) {
  console.error(`hacen falta 2 jueces con veredictos vigentes; hay ${jueces.length}: ${jueces.join(", ")}`);
  process.exit(1);
}
const [A, B] = jueces;

/** Se emparejan afirmaciones por prefijo: cada juez segmenta a su manera. */
const clave = (t: string): string =>
  t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).slice(0, 7).join(" ");

interface Disputa {
  id: string; texto: string; a: string; b: string;
  /** `presencia` = discrepan sobre si esta en los pasajes (F vs N): comprobable
   *  leyendo. `dureza` = discrepan sobre si es un elemento duro (X vs N): es la
   *  rubrica la que no decide, no el pasaje. */
  tipo: "presencia" | "dureza";
}
const disputas: Disputa[] = [];
for (const [id, va] of porJuez.get(A)!) {
  const vb = porJuez.get(B)!.get(id);
  if (!vb) continue;
  const mapB = new Map((vb.afirmaciones ?? []).map((x) => [clave(x.texto), x]));
  for (const x of va.afirmaciones ?? []) {
    const y = mapB.get(clave(x.texto));
    if (!y || y.etiqueta === x.etiqueta) continue;
    const es = [x.etiqueta, y.etiqueta];
    if (!es.includes("N")) continue;   // solo interesa donde uno acusa
    disputas.push({
      id, texto: x.texto, a: x.etiqueta, b: y.etiqueta,
      tipo: es.includes("F") ? "presencia" : "dureza",
    });
  }
}

/** Orden estable pero no agrupado por juez ni por tipo, para no dar pistas. */
disputas.sort((p, q) => h(p.id + p.texto).localeCompare(h(q.id + q.texto)));
const sel = disputas.slice(0, maximo);

/**
 * Empareja un pasaje ingles con su traduccion congelada. Se busca POR TEXTO y no
 * por id porque la fila guarda los textos, no los ids (D-084): guardar el valor
 * y no la referencia costo un bug, y no se va a deshacer para ahorrar esta
 * busqueda, que corre una vez sobre 1.431 chunks.
 */
const chunksEn: { id: string; text: string }[] =
  JSON.parse(readFileSync(new URL("artifacts/chunks.json", RAIZ), "utf8"));
const chunksEs: Record<string, { texto?: string }> =
  JSON.parse(readFileSync(new URL("artifacts/chunks_es.json", RAIZ), "utf8"));
const porInicio = new Map<string, string>();
for (const c of chunksEn) {
  const es = chunksEs[c.id]?.texto;
  if (es) porInicio.set(c.text.slice(0, 60), es);
}
const enCastellano = (t: string): string | undefined => porInicio.get(t.slice(0, 60));

/**
 * Traduccion de las frases a evaluar, hecha a mano y guardada en archivo aparte
 * para que quede versionada y auditable: son texto GENERADO por el modelo, asi
 * que no existen en el corpus y no hay traduccion congelada de donde sacarlas.
 * La clave son los primeros 60 caracteres del original.
 */
const TRAD: Record<string, string> = JSON.parse(
  readFileSync(new URL("evals/adjudicacion_traducciones.json", RAIZ), "utf8"));

const L: string[] = [];
L.push(`# Adjudicación humana — ${sel.length} casos\n`);
L.push(`Dos jueces automáticos de familias distintas discreparon en estos casos.`);
L.push(`**No se muestra qué dijo cada uno**: si lo vieras, tu respuesta dejaría de ser`);
L.push(`independiente, y la independencia es lo único que aporta (ver D-087).\n`);
L.push(`Para cada caso, respondé **dos preguntas separadas**:\n`);
L.push(`1. **¿La frase contiene un ELEMENTO DURO?** La lista es cerrada — nombre propio,`);
L.push(`   fecha, número, mecanismo causal, o conocimiento posterior a 1519. Si no hay`);
L.push(`   ninguno (es un aforismo, una metáfora, una opinión general), la respuesta es **X**`);
L.push(`   y no sigas.`);
L.push(`2. **Si lo contiene: ¿ese elemento está en los PASAJES de abajo?**`);
L.push(`   Sí → **F**.   No → **N**.\n`);
L.push(`No hace falta que conozcas a Richter. Sólo mirá los pasajes que están acá.\n`);
L.push(`> Si dudás de si algo *está* en los pasajes → **N**.`);
L.push(`> Si dudás de si *es* un elemento duro → **X**.\n---\n`);

for (const [i, d] of sel.entries()) {
  const f = filas.get(d.id)!;
  const c = casos.get(d.id)!;
  L.push(`## ${i + 1}. \`${d.id}\`\n`);
  /**
   * La pregunta en castellano NO se traduce: el dataset ya la tiene. Cada caso
   * `X-NNen` tiene su gemelo `X-NNes` con la MISMA pregunta en el otro idioma —
   * asi se construyo (`06` v3). Usar el gemelo en vez de traducir evita meter
   * una traduccion mia en el documento que mide el juicio humano.
   */
  const gemelo = casos.get(d.id.replace(/en$/, "es"));
  const preg = d.id.endsWith("en") && gemelo ? gemelo.q : c.q;
  L.push(`**Pregunta del usuario:** ${preg}\n`);
  /**
   * PARA LOS CASOS EN INGLES SE MUESTRA EL PASAJE EN CASTELLANO, usando la
   * traduccion congelada de D-079 — la misma que ve el modelo cuando responde en
   * castellano, no una traduccion improvisada para este documento.
   *
   * El motivo es que el anotador tiene que poder LEER el pasaje: si no lo lee
   * comodo, la etiqueta mide su ingles y no su juicio, que es justo lo que este
   * documento intenta medir. La traduccion ya esta verificada por
   * `tools/verificar_traduccion.ts`: los elementos duros —nombres y numeros—
   * sobreviven, que es lo unico que hay que buscar aca.
   *
   * Se muestra el original debajo, plegado, por si una palabra concreta importa.
   */
  L.push(`**PASAJES que el sistema tenía a la vista:**\n`);
  for (const [j, t] of (f.textosVistos ?? []).entries()) {
    const es = enCastellano(t);
    L.push(`> **[${j + 1}]** ${recortar(es ?? t, 200).replace(/\n+/g, " ")}\n`);
    if (es) {
      L.push(`<details><summary><sub>ver original en inglés</sub></summary>\n`);
      L.push(`> ${recortar(t, 200).replace(/\n+/g, " ")}\n`);
      L.push(`</details>\n`);
    }
  }
  L.push(`**FRASE A EVALUAR:**\n`);
  L.push(`> ${TRAD[d.texto.slice(0, 60)] ?? d.texto}\n`);
  if (TRAD[d.texto.slice(0, 60)]) {
    L.push(`<details><summary><sub>ver original en inglés</sub></summary>\n`);
    L.push(`> ${d.texto}\n`);
    L.push(`</details>\n`);
  }
  L.push(`**Tu etiqueta:** \`___\`  (F / N / X)\n`);
  L.push(`---\n`);
}

const destino = new URL(`evals/adjudicacion_${entrada.replace(/\.jsonl$/, "")}.md`, RAIZ);
writeFileSync(destino, L.join("\n"));

const clave2 = new Map<string, Disputa[]>();
for (const d of disputas) clave2.set(d.tipo, [...(clave2.get(d.tipo) ?? []), d]);

console.log(`\n# Adjudicación — ${entrada}\n`);
console.log(`Jueces: ${A}  vs  ${B}`);
console.log(`Respuestas juzgadas por ambos: ${[...porJuez.get(A)!.keys()].filter((k) => porJuez.get(B)!.has(k)).length}`);
console.log(`\nAfirmaciones en disputa: ${disputas.length}`);
for (const [t, l] of clave2) console.log(`  ${t.padEnd(10)} : ${l.length}`);
console.log(`\nSeleccionadas para adjudicar: ${sel.length}`);
console.log(`\nEscrito: ${destino.pathname.split("/").slice(-2).join("/")}`);

/** La clave de respuestas se guarda APARTE, para no contaminar el documento. */
writeFileSync(new URL(`evals/adjudicacion_clave.json`, RAIZ),
  JSON.stringify(sel.map((d) => ({ id: d.id, texto: d.texto.slice(0, 60), [A]: d.a, [B]: d.b, tipo: d.tipo })), null, 1));
console.log(`Clave (qué dijo cada juez): evals/adjudicacion_clave.json — NO la abras antes de etiquetar.`);
