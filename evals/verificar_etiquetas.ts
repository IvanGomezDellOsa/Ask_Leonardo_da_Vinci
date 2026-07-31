/**
 * Valida `evals/dataset.jsonl` ANTES de correr el eval.
 *
 *   npm run evals:verificar
 *
 * `06` v4 punto 5 lo pide explicitamente: en el experimento dos consultas
 * estaban mal etiquetadas —las de Salai, que se pusieron `fuera` cuando el
 * corpus SI tiene material (R-1528, R-1533, apuntes de contabilidad del propio
 * Leonardo)— y eso metia el error adentro de tau. Una etiqueta optimista mide
 * el sistema contra una verdad falsa.
 *
 * Seis chequeos, todos duros salvo el ultimo:
 *
 *   1. estructura       campos obligatorios, ids unicos, categorias validas
 *   2. cupos            A 30 · B 25 · C 20 · D 15 · E 10 · F 20 = 120
 *   3. balance          60 es / 60 en, y balanceado dentro de cada categoria (D-062)
 *   4. circularidad     ninguna consulta puede venir de las 190 del experimento
 *   5. pasajes          los `expected_passages` existen y son voz Leonardo
 *   6. abstenciones     cada `should_abstain: true` se mide contra el corpus  ← revision
 *
 * El 6 no falla la corrida: emite la lista para revisar a ojo, que es lo que
 * `06` v4 manda. Los otros cinco devuelven 1.
 */

import { readFileSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";
import { Corpus, recortar } from "../src/lib/retrieval.js";
import { cargarUmbrales, Idioma } from "../src/lib/grounding.js";

const RAIZ = new URL("../", import.meta.url);
const ART = new URL("artifacts/", RAIZ);

export interface Caso {
  id: string;
  q: string;
  lang: Idioma;
  category: string;
  expected_passages: number[];
  should_abstain: boolean;
  /** Por que se abstiene, o que tema se espera. Obligatorio si should_abstain. */
  nota?: string;
  expected_richter_note?: string;
  expected_topic?: string;
}

const CUPOS: Record<string, number> = {
  in_corpus_direct: 30,
  in_corpus_conceptual: 25,
  out_of_corpus_plausible: 20,
  anachronistic: 15,
  adversarial: 10,
  known_but_unwritten: 20,
};

export function cargarDataset(url = new URL("evals/dataset.jsonl", RAIZ)): Caso[] {
  return readFileSync(url, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trimStart().startsWith("//"))
    .map((l, i) => {
      try { return JSON.parse(l) as Caso; }
      catch { throw new Error(`linea ${i + 1} no es JSON valido: ${l.slice(0, 80)}`); }
    });
}

/** Las 190 consultas del experimento. Reusarlas volveria circular el paso 16. */
function consultasDelExperimento(): Set<string> {
  const py = readFileSync(new URL("experiments/separabilidad/consultas.py", RAIZ), "utf8");
  const out = new Set<string>();
  for (const m of py.matchAll(/\(\s*"(?:dentro|fuera)"\s*,\s*"(?:es|en)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/g)) {
    out.add(normalizar(m[1].replace(/\\"/g, '"')));
  }
  return out;
}

/**
 * Compara consultas ignorando tildes, signos y espaciado.
 *
 * Las marcas combinantes se filtran por codigo y no con una clase de caracteres
 * `/[U+0300-U+036F]/`, a proposito: esa clase se escribe con caracteres
 * invisibles que no se pueden revisar en un diff ni sobreviven de forma
 * confiable a un round-trip de encoding en Windows. El codigo queda 100% ASCII.
 */
const normalizar = (s: string): string =>
  [...s.toLowerCase().normalize("NFD")]
    .filter((ch) => { const c = ch.charCodeAt(0); return c < 0x0300 || c > 0x036f; })
    .join("")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

async function main(): Promise<number> {
  const casos = cargarDataset();
  const errores: string[] = [];
  const avisos: string[] = [];

  console.log(`# Verificacion de etiquetas — ${casos.length} casos\n`);

  // ---- 1. estructura ----------------------------------------------------
  const vistos = new Set<string>();
  for (const c of casos) {
    if (!c.id || !c.q || !c.lang || !c.category) errores.push(`${c.id ?? "?"}: faltan campos`);
    if (vistos.has(c.id)) errores.push(`${c.id}: id repetido`);
    vistos.add(c.id);
    if (!(c.category in CUPOS)) errores.push(`${c.id}: categoria desconocida "${c.category}"`);
    if (c.lang !== "es" && c.lang !== "en") errores.push(`${c.id}: idioma "${c.lang}"`);
    if (!Array.isArray(c.expected_passages)) errores.push(`${c.id}: expected_passages no es lista`);
    if (typeof c.should_abstain !== "boolean") errores.push(`${c.id}: should_abstain no es booleano`);
    if (c.should_abstain && !c.nota) errores.push(`${c.id}: should_abstain sin nota que lo justifique`);
    if (c.q.length > 500) errores.push(`${c.id}: consulta de mas de 500 caracteres`);
  }
  const dupQ = new Map<string, string[]>();
  for (const c of casos) {
    const k = normalizar(c.q);
    dupQ.set(k, [...(dupQ.get(k) ?? []), c.id]);
  }
  for (const [, ids] of dupQ) if (ids.length > 1) errores.push(`consulta repetida: ${ids.join(", ")}`);

  // ---- 2. cupos + 3. balance -------------------------------------------
  console.log("| categoria | casos | cupo | es | en |");
  console.log("|---|---:|---:|---:|---:|");
  for (const [cat, cupo] of Object.entries(CUPOS)) {
    const dela = casos.filter((c) => c.category === cat);
    const es = dela.filter((c) => c.lang === "es").length;
    const en = dela.length - es;
    const ok = dela.length === cupo;
    if (!ok) errores.push(`${cat}: ${dela.length} casos, se esperaban ${cupo}`);
    // D-062: tau es un mapa {es,en}; desbalancear calibra bien un idioma y mal el otro.
    if (Math.abs(es - en) > 1) errores.push(`${cat}: desbalance ${es} es / ${en} en (max 1)`);
    console.log(`| ${cat} | ${dela.length}${ok ? "" : " ⚠"} | ${cupo} | ${es} | ${en} |`);
  }
  const totalEs = casos.filter((c) => c.lang === "es").length;
  console.log(`| **total** | **${casos.length}** | **120** | **${totalEs}** | **${casos.length - totalEs}** |`);
  if (casos.length !== 120) errores.push(`total ${casos.length}, se esperaban 120`);
  if (totalEs !== 60) errores.push(`total en espanol ${totalEs}, se esperaban 60 (D-062)`);

  // ---- 4. circularidad --------------------------------------------------
  const exp = consultasDelExperimento();
  console.log(`\n## Circularidad\n\n- consultas del experimento leidas: ${exp.size}`);
  const chocan = casos.filter((c) => exp.has(normalizar(c.q)));
  if (chocan.length) {
    for (const c of chocan) errores.push(`${c.id}: la consulta ya esta en el experimento — «${c.q}»`);
  } else {
    console.log("- ok — ninguna consulta del eval set viene del experimento");
  }

  // ---- 5. pasajes esperados --------------------------------------------
  const corpus = new Corpus(ART);
  const nosLeonardo = new Set<number>();
  for (const ch of corpus.chunks) if (ch.voice === "leonardo") for (const n of ch.richterNos) nosLeonardo.add(n);

  console.log("\n## Pasajes esperados\n");
  let conPasajes = 0;
  for (const c of casos) {
    for (const n of c.expected_passages) {
      if (!nosLeonardo.has(n)) errores.push(`${c.id}: el pasaje R-${n} no existe como voz Leonardo en el indice`);
    }
    if (c.expected_passages.length) conPasajes++;
    if (c.category === "in_corpus_direct" && !c.expected_passages.length) {
      errores.push(`${c.id}: la categoria A necesita expected_passages (es la que mide precision@k)`);
    }
  }
  console.log(`- casos con \`expected_passages\`: ${conPasajes}`);
  console.log(`- pasajes distintos de Leonardo en el indice: ${nosLeonardo.size}`);

  // ---- 6. abstenciones contra el corpus --------------------------------
  const umbrales = cargarUmbrales(ART);
  const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");
  const aAbstener = casos.filter((c) => c.should_abstain);

  console.log(`\n## Abstenciones medidas contra el corpus (${aAbstener.length} casos)\n`);
  console.log("`06` v4 punto 5. No falla la corrida: los casos por encima del umbral se");
  console.log("revisan a ojo, porque un `should_abstain` optimista mide el sistema contra");
  console.log("una verdad falsa. Que el coseno pase NO implica etiqueta mal puesta — la");
  console.log("categoria F recupera material real de Leonardo a proposito (D-062).\n");
  console.log("| id | cat | cos_max | tau | delta | mejor pasaje |");
  console.log("|---|---|---:|---:|---:|---|");

  for (const c of aAbstener) {
    const s = await extractor("query: " + c.q, { pooling: "mean", normalize: true });
    const { cosMax, top } = corpus.buscar(s.data as Float32Array, c.q, "leonardo", 1);
    const tau = umbrales.tau[c.lang];
    const delta = cosMax - tau;
    const cat = c.category.replace("out_of_corpus_plausible", "C")
      .replace("anachronistic", "D").replace("adversarial", "E")
      .replace("known_but_unwritten", "F");
    const mejor = top[0] ? `R-${top[0].chunk.richterNo} «${top[0].chunk.richterTitle ?? "—"}»` : "—";
    const marca = delta >= 0 ? " ⚠" : "";
    console.log(`| ${c.id}${marca} | ${cat} | ${cosMax.toFixed(4)} | ${tau.toFixed(4)} | ${delta >= 0 ? "+" : ""}${delta.toFixed(4)} | ${mejor} |`);
    // Solo se avisa para C y D: en esas dos, pasar el pre-filtro es una senal de
    // que la etiqueta puede estar mal. En E y F no significa nada (D-062).
    if (delta >= 0 && (c.category === "out_of_corpus_plausible" || c.category === "anachronistic")) {
      avisos.push(`${c.id} (${cat}) supera tau por ${delta.toFixed(4)} — «${c.q}»\n` +
                  `    top-1: ${mejor}\n    ${recortar(top[0]?.chunk.text ?? "", 35)}`);
    }
  }

  // ---- resumen ----------------------------------------------------------
  console.log("\n## Resumen\n");
  if (avisos.length) {
    console.log(`### Para revisar a ojo (${avisos.length})\n`);
    for (const a of avisos) console.log(`- ${a}`);
    console.log();
  } else {
    console.log("- ok — ninguna consulta de C o D supera su umbral\n");
  }
  if (errores.length) {
    console.log(`### ERRORES (${errores.length})\n`);
    for (const e of errores) console.log(`- ${e}`);
    return 1;
  }
  console.log("- **los cinco chequeos duros pasan**");
  return 0;
}

process.exit(await main());
