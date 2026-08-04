/**
 * Arma la muestra de 30 casos que se etiqueta A MANO para validar el
 * verificador. Paso 14 de `08`, `06` v3 punto 5.
 *
 *   npm run evals:muestra -- --entrada rag-k3-groq_llama-3_3-70b-versatile.jsonl
 *
 * Emite `evals/out/<entrada>.para_etiquetar.md` con pregunta, pasajes y
 * respuesta. NADA MAS.
 *
 * Lo que este script deliberadamente NO muestra, y el motivo:
 *
 *   - el veredicto del juez        seria el sesgo de anclaje entero: etiquetar
 *                                  "a mano" mirando la respuesta del instrumento
 *                                  que se quiere validar no valida nada
 *   - `should_abstain` del caso    es la etiqueta de OTRA pregunta (¿debia
 *                                  contestar?), no de esta (¿lo que dijo esta
 *                                  fundado?). Verla arrastra el juicio
 *   - la categoria del caso        saber que algo es "fuera de corpus" predispone
 *                                  a buscar invencion
 *
 * Y excluye los casos que ya se vieron juzgados durante la construccion del
 * verificador: un patron de oro escrito despues de leer al juez no es un patron
 * de oro. Es la contaminacion mas facil de cometer y la mas dificil de detectar
 * despues.
 */

import { readFileSync, existsSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { Corpus, recortar } from "../src/lib/retrieval.js";
import { ART, RAIZ, SALIDAS, cargarCasos, leerJsonl, type Resultado } from "./comun.js";

const args = process.argv.slice(2);
const arg = (n: string, def: string): string => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const entrada = arg("entrada", "");
const cuantos = Number(arg("n", "30"));
if (!entrada) { console.error("falta --entrada <archivo.jsonl>"); process.exit(1); }

/** Los 13 del piloto, cuyos veredictos ya se leyeron al construir el juez. */
const CONTAMINADOS = new Set<string>();
const piloto = new URL("piloto3.veredictos.jsonl", SALIDAS);
if (existsSync(piloto)) {
  for (const v of leerJsonl<{ id: string }>(piloto)) CONTAMINADOS.add(v.id);
}

const casos = new Map(cargarCasos().map((c) => [c.id, c]));
const filas = leerJsonl<Resultado>(new URL(`evals/out/${entrada}`, RAIZ))
  .filter((f) => f.decision === "responde" && f.respuesta);

const elegibles = filas.filter((f) => !CONTAMINADOS.has(f.id));

console.log(`respuestas en la corrida      : ${filas.length}`);
console.log(`descartadas por contaminacion : ${filas.length - elegibles.length}`);
console.log(`elegibles                     : ${elegibles.length}`);

/**
 * Muestreo estratificado por categoria, proporcional a cuantas respuestas
 * produjo cada una. Aleatorio simple concentraria la muestra en A y B, que son
 * las mas numerosas, y dejaria sin representar a C y F — que es justo donde `06`
 * v4 dice que vive el riesgo. Semilla fija: la muestra tiene que ser la misma
 * si alguien reproduce esto.
 */
let semilla = 20260803;
const rnd = (): number => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;

const porCat = new Map<string, Resultado[]>();
for (const f of elegibles) {
  const cat = casos.get(f.id)!.category;
  porCat.set(cat, [...(porCat.get(cat) ?? []), f]);
}

const muestra: Resultado[] = [];
for (const [cat, fs] of [...porCat.entries()].sort()) {
  const cupo = Math.max(1, Math.round((fs.length / elegibles.length) * cuantos));
  const mezclado = [...fs].sort(() => rnd() - 0.5);
  muestra.push(...mezclado.slice(0, cupo));
  console.log(`  ${cat.padEnd(24)} ${String(fs.length).padStart(3)} respuestas -> ${cupo} a la muestra`);
}
// El redondeo por categoria puede pasarse o quedarse corto del total pedido.
const final = muestra.slice(0, cuantos);

const corpus = new Corpus(ART);
const textoDe = new Map<number, { titulo: string | null; texto: string }>();
for (const c of corpus.chunks) {
  if (c.voice !== "leonardo") continue;
  for (const n of c.richterNos) {
    if (!textoDe.has(n)) textoDe.set(n, { titulo: c.richterTitle, texto: c.text });
  }
}

const L = [
  `# Muestra para etiquetado manual — ${final.length} casos`,
  "",
  "> Patron de oro para validar el verificador (`06` v3 punto 5).",
  "> Se etiqueta con `evals/rubrica.md` a la vista y **sin haber corrido el juez**",
  "> sobre estos casos. Los 13 del piloto estan excluidos por contaminacion.",
  "",
  "Para cada caso: partir la respuesta en afirmaciones, etiquetar `F` / `C` / `N` / `X`,",
  "y anotar el veredicto (`alucina` = tiene al menos una `N`).",
  "",
  "---",
  "",
];

for (const [i, f] of final.entries()) {
  const c = casos.get(f.id)!;
  L.push(`## ${i + 1}. \`${f.id}\``, "");
  L.push(`**Pregunta** (${c.lang})`, "", `> ${c.q}`, "");
  L.push("**Pasajes disponibles**", "");
  if (!f.pasajes.length) L.push("_(ninguno)_", "");
  for (const no of f.pasajes) {
    const p = textoDe.get(no);
    L.push(`- **[${no}]** ${p?.titulo ?? "—"}`, `  > ${recortar(p?.texto ?? "?", 200).replace(/\n/g, " ")}`, "");
  }
  L.push("**Respuesta del sistema**", "", ...f.respuesta.split("\n").map((x) => `> ${x}`), "", "---", "");
}

const destino = new URL(entrada.replace(/\.jsonl$/, "") + ".para_etiquetar.md", SALIDAS);
writeFileSync(destino, L.join("\n"), "utf8");
console.log(`\nmuestra -> ${destino.pathname.split("/").pop()}   (${final.length} casos)`);
console.log(`ids: ${final.map((f) => f.id).join(", ")}`);
