/**
 * ¿Los modelos con los que generamos siguen existiendo? Ver D-199.
 *
 *   npm run modelos
 *
 * POR QUE EXISTE. D-133 fue una migración forzada: Groq decomisionó
 * `llama-3.3-70b-versatile` y el proyecto se enteró **por un mail**. El
 * 2026-09-05 llegaron cuatro avisos más —Compound, Compound Mini y recordatorios
 * de los dos Llama— y para saber si tocaban algo hubo que leerlos uno por uno.
 *
 * Un aviso que llega a una casilla no es una comprobación: depende de que
 * alguien lo lea, lo entienda y se acuerde de qué modelo usa el proyecto. Esto
 * pregunta a los proveedores, que es donde vive la respuesta.
 *
 * NO GENERA UN SOLO TOKEN: son dos `GET` de catálogo. Necesita las claves porque
 * los catálogos están autenticados, así que **no puede correr en CI** — eso lo
 * hereda el checklist de despliegue, no el workflow.
 *
 * Sale con código 1 si falta alguno, para poder colgarlo de un cron el día que
 * haya uno.
 */

import { readFileSync } from "node:fs";
import { CASCADA_PRODUCCION } from "../src/lib/llm.js";

const env: Record<string, string> = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && m[2].trim()) env[m[1]] = m[2].trim();
}

/** Los ids que publica cada proveedor, o `null` si no se pudo preguntar. */
async function catalogo(fam: string): Promise<Set<string> | null> {
  try {
    if (fam === "groq") {
      if (!env.GROQ_API_KEY) return null;
      const r = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { authorization: `Bearer ${env.GROQ_API_KEY}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json() as { data?: { id: string }[] };
      return new Set((j.data ?? []).map((m) => m.id));
    }
    if (fam === "gemini") {
      if (!env.GEMINI_API_KEY_A) return null;
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": env.GEMINI_API_KEY_A },
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json() as { models?: { name: string }[] };
      // Gemini los nombra `models/<id>`.
      return new Set((j.models ?? []).map((m) => m.name.replace(/^models\//, "")));
    }
  } catch (e) {
    console.error(`  no se pudo consultar ${fam}: ${(e as Error).message}`);
  }
  return null;
}

console.log(`\n# Modelos de la cascada de producción\n`);

const cache = new Map<string, Set<string> | null>();
let faltan = 0;
let sinRespuesta = 0;

for (const id of CASCADA_PRODUCCION) {
  const [fam, ...resto] = id.split("/");
  const modelo = resto.join("/");
  if (!cache.has(fam)) cache.set(fam, await catalogo(fam));
  const cat = cache.get(fam)!;
  if (!cat) {
    console.log(`  ?  ${id.padEnd(38)} sin clave o sin respuesta: no se pudo comprobar`);
    sinRespuesta++;
    continue;
  }
  const vive = cat.has(modelo);
  if (!vive) faltan++;
  console.log(`  ${vive ? "ok" : "NO"} ${id.padEnd(38)} ${vive ? "vive" : "**YA NO ESTA EN EL CATALOGO**"}`);
}

/**
 * Se listan los del proveedor de resguardo aunque no falte ninguno: cuando haya
 * que migrar, el reemplazo se elige de una lista que ya está delante y no de un
 * mail. Es la mitad barata de lo que costó D-133.
 */
const groq = cache.get("groq");
if (groq) {
  const texto = [...groq].filter((m) => !/whisper|orpheus|prompt-guard|allam/.test(m)).sort();
  console.log(`\n  Groq, modelos de texto disponibles hoy (${texto.length}):`);
  for (const m of texto) console.log(`    ${m}`);
}

if (faltan) {
  console.error(`\n  ${faltan} modelo(s) de la cascada ya no existen. Hay que migrar.`);
  process.exit(1);
}
console.log(`\n  la cascada está entera${sinRespuesta ? ` (${sinRespuesta} sin comprobar)` : ""}.\n`);
