/**
 * Genera un paquete AUTOCONTENIDO para que un agente web haga de juez. Ver D-090.
 *
 * POR QUE EXISTE. Los jueces por API que el presupuesto permite —modelos rapidos
 * de free tier— se midieron contra etiquetas humanas y dieron kappa 0,000 entre
 * si. Las plataformas web corren modelos mas grandes, con mas computo por
 * respuesta y sin techo de cuota, y son genuinamente independientes: otro
 * modelo, otra infraestructura, otro prompt de sistema.
 *
 * EL LIMITE, Y ES SERIO: un juicio hecho en un chat NO SE PUEDE REPRODUCIR. No
 * hay hash, no hay version de modelo fijada, no se puede volver a correr. La
 * tesis del proyecto es un numero reproducible, asi que el rol de esto NO es
 * reemplazar al juez por API sino calibrarlo:
 *
 *   juez web  -> patron de referencia, se etiqueta UNA vez y se congela
 *   juez API  -> instrumento de regresion, se valida contra ese patron
 *
 * Por eso la salida se pide en formato ESTRICTO y parseable, y por eso el
 * archivo de respuesta tiene que anotar plataforma y fecha: la procedencia no se
 * puede hashear, asi que se registra a mano o no existe.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { RAIZ, cargarCasos, leerJsonl, type Resultado } from "./comun.js";
import { recortar } from "../src/lib/retrieval.js";

const arg = (n: string, d = ""): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const entrada = arg("entrada");
if (!entrada) { console.error("falta --entrada <archivo.jsonl>"); process.exit(1); }
const cuantos = Number(arg("casos", "40"));
const parte = Number(arg("parte", "1"));
const partes = Number(arg("partes", "1"));

const h = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 12);

const casos = new Map(cargarCasos().map((c) => [c.id, c]));
const filas = leerJsonl<Resultado>(new URL(`evals/out/${entrada}`, RAIZ))
  .filter((r) => r.decision === "responde" && r.respuesta);

/** Orden estable e independiente del archivo, para que dos partes no se pisen. */
filas.sort((a, b) => h(a.id).localeCompare(h(b.id)));
const sel = filas.slice(0, cuantos);
const tam = Math.ceil(sel.length / partes);
const mio = sel.slice((parte - 1) * tam, parte * tam);

const rubrica = readFileSync(new URL("evals/rubrica.md", RAIZ), "utf8");
/** Se pega la rubrica ENTERA, no un resumen: un resumen es otra rubrica. */
const cuerpo = rubrica.slice(rubrica.indexOf("## 1. La unidad"));

const L: string[] = [];
L.push(`# Tarea de evaluación — ${mio.length} respuestas\n`);
L.push(`Sos un evaluador. Tenés que decidir, para cada afirmación de cada respuesta, si lo`);
L.push(`que afirma está sostenido por los pasajes que el sistema tenía a la vista.\n`);
L.push(`**Los pasajes son la ÚNICA evidencia admisible.** Cualquier otra cosa —incluidos`);
L.push(`hechos verdaderos sobre el Leonardo real— cuenta como no fundamentada.\n`);
L.push(`Tomate el tiempo que haga falta. La calidad importa más que la velocidad.\n`);
L.push(`---\n`);
L.push(`# La rúbrica\n`);
L.push(cuerpo);
L.push(`\n---\n`);
L.push(`# Formato de salida — OBLIGATORIO\n`);
L.push(`Devolvé **un bloque de código** con una línea JSON por afirmación, sin nada más`);
L.push(`alrededor. Una línea por afirmación, no por respuesta:\n`);
L.push("```");
L.push(`{"id":"A-01es","n":1,"texto":"los primeros 60 caracteres de la afirmación","paso1":"qué afirma sobre el mundo","etiqueta":"F"}`);
L.push(`{"id":"A-01es","n":2,"texto":"...","paso1":"...","etiqueta":"N"}`);
L.push("```\n");
L.push(`- \`paso1\` es obligatorio y va **antes** de decidir: escribí qué afirma la frase sobre`);
L.push(`  el mundo, sin la figura retórica. Si no queda ninguna proposición, poné \`"-"\` y`);
L.push(`  etiquetá \`X\`.`);
L.push(`- \`etiqueta\` es exactamente \`F\`, \`N\` o \`X\`.`);
L.push(`- Segmentá la respuesta en afirmaciones vos mismo, una por oración con contenido.\n`);
L.push(`Al final del bloque, agregá una última línea con la procedencia:\n`);
L.push("```");
L.push(`{"meta":true,"plataforma":"<qué usaste: Gemini web, ChatGPT, etc.>","modelo":"<si lo sabés>","fecha":"AAAA-MM-DD"}`);
L.push("```\n");
L.push(`Esa línea no es opcional: sin ella el resultado no se puede citar en la publicación.\n`);
L.push(`---\n`);
L.push(`# Las respuestas a evaluar\n`);

for (const [i, f] of mio.entries()) {
  const c = casos.get(f.id)!;
  L.push(`\n## ${i + 1}. \`${f.id}\`\n`);
  L.push(`**PREGUNTA:** ${c.q}\n`);
  L.push(`**PASAJES disponibles:**\n`);
  for (const [j, t] of (f.textosVistos ?? []).entries()) {
    L.push(`> **[${j + 1}]** ${recortar(t, 200).replace(/\n+/g, " ")}\n`);
  }
  L.push(`**RESPUESTA DEL SISTEMA:**\n`);
  L.push(`${f.respuesta!.split("\n").filter(Boolean).map((p) => `| ${p}`).join("\n")}\n`);
}

const nombre = partes > 1
  ? `paquete_juez_${entrada.replace(/\.jsonl$/, "")}_${parte}de${partes}.md`
  : `paquete_juez_${entrada.replace(/\.jsonl$/, "")}.md`;
const destino = new URL(`evals/${nombre}`, RAIZ);
writeFileSync(destino, L.join("\n"));

/** La clave para leer la respuesta despues: qué respuesta exacta se juzgó. */
const clave = mio.map((f) => ({ id: f.id, resp: h(f.respuesta!), prompt: f.prompt }));
writeFileSync(new URL(`evals/${nombre.replace(/\.md$/, ".clave.json")}`, RAIZ),
  JSON.stringify({ entrada, generado: new Date().toISOString().slice(0, 10), casos: clave }, null, 1));

console.log(`\nPaquete ${parte}/${partes}: ${mio.length} respuestas`);
console.log(`  ${destino.pathname.split("/").slice(-2).join("/")}`);
console.log(`  ${(L.join("\n").length / 1000).toFixed(1)}k caracteres`);
console.log(`\nClave de procedencia guardada aparte (qué respuesta exacta se juzgó).`);
