/**
 * Banco de pruebas del motor RAG, por linea de comandos. Sin frontend.
 *
 *   npm run ask -- es "¿Por qué el cielo es azul?"
 *   npm run ask -- --lote          corre las 20 preguntas de control
 *
 * Muestra lo que el paso 11 de la Fase 2 pide: pasajes recuperados, `cos_max`,
 * si se abstuvo y por que. La llamada al LLM es la Fase 2 paso 10; hasta que
 * haya claves configuradas, esto imprime exactamente lo que se le mandaria.
 */

import { pipeline } from "@huggingface/transformers";
import { Corpus, recortar } from "../src/lib/retrieval.js";
import { cargarUmbrales, decidir, Idioma } from "../src/lib/grounding.js";

const ART = new URL("../artifacts/", import.meta.url);

// 20 preguntas de control: 10 dentro del corpus, 5 fuera, 5 de la categoria F
// (`known_but_unwritten`), que es la que define el producto (D-027).
const LOTE: [Idioma, string, string][] = [
  ["es", "dentro", "¿Por qué el cielo es azul?"],
  ["es", "dentro", "¿Cómo debe estudiarse la anatomía?"],
  ["es", "dentro", "¿Qué es la perspectiva aérea?"],
  ["es", "dentro", "¿Cómo debe componerse una escena de batalla?"],
  ["es", "dentro", "¿Se puede construir una máquina para que el hombre vuele?"],
  ["en", "dentro", "How does one train the visual memory?"],
  ["en", "dentro", "What makes a shadow darker or lighter?"],
  ["en", "dentro", "How should a painter represent the emotions?"],
  ["en", "dentro", "Why do distant mountains look blue?"],
  ["en", "dentro", "How is water to be depicted in movement?"],
  ["es", "fuera", "¿Qué opinás de la inteligencia artificial?"],
  ["es", "fuera", "¿Cómo se hace una pizza?"],
  ["en", "fuera", "Who won the last World Cup?"],
  ["en", "fuera", "What is your opinion on democracy?"],
  ["es", "fuera", "¿Cuál es tu película favorita?"],
  ["es", "F", "¿Qué opinás de la Mona Lisa?"],
  ["es", "F", "¿Cómo era tu relación con Miguel Ángel?"],
  ["en", "F", "How did you die?"],
  ["es", "F", "¿Cómo eras físicamente?"],
  ["es", "F", "¿Quién era Salaì para vos?"],
];

const corpus = new Corpus(ART);
const umbrales = cargarUmbrales(ART);
const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");

async function embeber(texto: string): Promise<Float32Array> {
  // El prefijo `query: ` no es decorativo: e5 se entreno con el (D-022)
  const s = await extractor("query: " + texto, { pooling: "mean", normalize: true });
  return s.data as Float32Array;
}

async function preguntar(idioma: Idioma, texto: string, esperado?: string) {
  const d = decidir(corpus, umbrales, texto, await embeber(texto), idioma);
  const etq = esperado ? ` [${esperado}]` : "";
  console.log(`\n${"─".repeat(78)}\n[${idioma}]${etq} ${texto}`);

  if (d.tipo === "curada") {
    console.log(`  CAPA 0 — caso curado "${d.caso}", no se llama al retrieval`);
    for (const n of d.nota) console.log(`    nota: ${recortar(n.chunk.text, 40)}`);
    return d;
  }
  const rel = ((d.cosMax - d.tau) >= 0 ? "+" : "") + (d.cosMax - d.tau).toFixed(4);
  if (d.tipo === "abstiene") {
    console.log(`  ABSTIENE — cos_max ${d.cosMax.toFixed(4)} < τ_${idioma} ${d.tau.toFixed(4)} (${rel})`);
    for (const e of d.evidencia) {
      console.log(`    evidencia de Richter (${e.cos.toFixed(4)}): ${recortar(e.chunk.text, 30)}`);
    }
    return d;
  }
  console.log(`  RESPONDE — cos_max ${d.cosMax.toFixed(4)} ≥ τ_${idioma} ${d.tau.toFixed(4)} (${rel})`);
  for (const p of d.pasajes) {
    console.log(`    R-${p.chunk.richterNo} cos ${p.cos.toFixed(4)} · rrf ${p.rrf.toFixed(5)} · «${p.chunk.richterTitle}»`);
    console.log(`      ${recortar(p.chunk.text, 28)}`);
  }
  if (d.notas.length) console.log(`    (${d.notas.length} notas de Richter vinculadas)`);
  return d;
}

const args = process.argv.slice(2);
if (args[0] === "--lote") {
  const conteo: Record<string, Record<string, number>> = {};
  for (const [idioma, grupo, texto] of LOTE) {
    const d = await preguntar(idioma, texto, grupo);
    conteo[grupo] ??= {};
    conteo[grupo][d.tipo] = (conteo[grupo][d.tipo] ?? 0) + 1;
  }
  console.log(`\n${"═".repeat(78)}\nRESUMEN`);
  for (const [grupo, c] of Object.entries(conteo)) {
    console.log(`  ${grupo.padEnd(7)} ${JSON.stringify(c)}`);
  }
  console.log("\n  esperado: dentro→responde · fuera→abstiene · F→curada o abstiene");
} else {
  const idioma = (args[0] as Idioma) ?? "es";
  await preguntar(idioma, args.slice(1).join(" ") || "¿Por qué el cielo es azul?");
}
