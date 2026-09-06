/**
 * Banco de pruebas del motor RAG, por linea de comandos. Sin frontend.
 *
 *   npm run ask -- es "¿Por qué el cielo es azul?"
 *   npm run ask -- --lote          corre las 20 preguntas de control
 *   npm run ask -- --conv es "¿Cómo estudiabas la anatomía?" "¿Y por qué?"
 *                                  una conversacion: cada turno ve los anteriores
 *
 * Muestra lo que el paso 11 de la Fase 2 pide: pasajes recuperados, `cos_max`,
 * si se abstuvo y por que. La llamada al LLM es la Fase 2 paso 10; hasta que
 * haya claves configuradas, esto imprime exactamente lo que se le mandaria.
 */

import { readFileSync } from "node:fs";
import { cargarExtractor } from "../src/lib/embed.js";
import { recortar } from "../src/lib/retrieval.js";
import { cargarMotor, Idioma } from "../src/lib/grounding.js";
import { consultaParaEmbeber, sanearHistorial, type Turno } from "../src/lib/conversacion.js";
import { responder } from "../src/lib/responder.js";
import { PresupuestoTpm, generar, cascadaDe } from "../src/lib/llm.js";

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

/**
 * LA MISMA CASCADA QUE `app/api/chat/route.ts` (D-197).
 *
 * Esto probaba Groq mientras produccion genera con `gemini-3.1-flash-lite`: el
 * banco de pruebas del motor **ejercitaba un proveedor que el producto no usa**,
 * y con la cuota de Groq agotada imprimia «Leonardo descansa» sobre un sistema
 * que habria contestado perfecto. Es la clase de defecto que D-113 arreglo con
 * las tres copias del bucle de respuesta — el banco tiene que mostrar lo que el
 * producto hace.
 *
 * Los topes por modelo los trae cada proveedor desde D-198, asi que tampoco hay
 * un numero cableado que se separe del de la ruta.
 *
 * Las claves salen de `.env.local`, gitignoreado. Nunca de `NEXT_PUBLIC_*` ni
 * del cliente (D-035). Sin claves, el banco corre igual y muestra el retrieval.
 */
const env: Record<string, string> = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  // Vercel escribe sus valores ENTRECOMILLADOS. Sin quitarlas, la URL queda con
  // comillas adentro y el fetch falla en silencio, cayendo al respaldo (D-220).
  if (m && m[2].trim()) env[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}
// El tope por modelo lo trae cada proveedor (D-198); esto es el de la cascada.
const presupuesto = new PresupuestoTpm(Infinity, Infinity);
const cascada = cascadaDe(env);

/**
 * Un motor con un índice por idioma (D-107). Antes era un solo Corpus inglés y
 * la consulta castellana buscaba cross-lingüe.
 */
const motor = cargarMotor(ART);
const extractor = await cargarExtractor();

async function embeber(texto: string): Promise<Float32Array> {
  // El prefijo `query: ` no es decorativo: e5 se entreno con el (D-022)
  const s = await extractor("query: " + texto, { pooling: "mean", normalize: true });
  return s.data as Float32Array;
}

async function preguntar(
  idioma: Idioma, texto: string, esperado?: string, historial: Turno[] = [],
) {
  /**
   * SE PASA POR `responder`, NO POR `decidirCon` A SECAS. Ver D-113.
   *
   * Hasta acá este CLI generaba directo y **no aplicaba ninguna de las tres
   * garantías** (D-082, D-083, D-093): la respuesta que se miraba para "ver cómo
   * anda el producto" no era la que el producto produce. Un banco de pruebas que
   * muestra otra cosa que el sistema real es peor que no tenerlo.
   */
  /**
   * El mismo reparto que en el navegador (D-197): el vector de la consulta sola
   * gobierna el gate, y el segundo —con el turno anterior adelante— sale solo si
   * la consulta no se sostiene por si misma.
   */
  const conContexto = consultaParaEmbeber(texto, historial);
  const R = await responder({
    motor, pregunta: texto, idioma, vector: await embeber(texto),
    vectorContexto: conContexto === texto ? undefined : await embeber(conContexto),
    historial,
    generar: async (sys, msgs) => {
      const g = await generar(cascada, presupuesto, sys, msgs);
      return g ?? { texto: "", tokensEntrada: 0, tokensSalida: 0 };
    },
  });
  const d = R.decision === "curada"
    // `caso`, `cita` y los pasajes de la nota salen de `responder()` desde
    // D-124: antes se reconstruía un curada vacío y el CLI no mostraba la nota,
    // que es justo lo que hay que poder inspeccionar de este camino.
    ? { tipo: "curada" as const, caso: R.caso ?? "", cita: R.cita ?? null, nota: R.pasajes }
    : R.decision === "abstiene"
      ? { tipo: "abstiene" as const, cosMax: R.cosMax!, tau: R.tau!, evidencia: [] }
      : { tipo: "responde" as const, cosMax: R.cosMax!, tau: R.tau!, pasajes: R.pasajes, notas: R.notas };
  const etq = esperado ? ` [${esperado}]` : "";
  console.log(`\n${"─".repeat(78)}\n[${idioma}]${etq} ${texto}`);

  if (d.tipo === "curada") {
    console.log(`  CAPA 0 — caso curado "${d.caso}", no se llama al retrieval`);
    if (d.cita) console.log(`    cita verificada: «${d.cita}»`);
    else console.log(`    sin nota: el corpus calla y Richter no comenta el silencio`);
    for (const n of d.nota) {
      const t = (idioma === "es" && n.chunk.textoEs) ? n.chunk.textoEs : n.chunk.text;
      console.log(`    nota ${n.chunk.id}: ${recortar(t, 40)}`);
    }
    return { d, texto: R.texto };
  }
  const rel = ((d.cosMax - d.tau) >= 0 ? "+" : "") + (d.cosMax - d.tau).toFixed(4);
  if (d.tipo === "abstiene") {
    console.log(`  ABSTIENE — cos_max ${d.cosMax.toFixed(4)} < τ_${idioma} ${d.tau.toFixed(4)} (${rel})`);
    // Sin evidencia que mostrar: D-110 eliminó la nota de Richter recuperada,
    // porque medida sobre 23 abstenciones casi nunca probaba nada. Lo único que
    // puede acompañar una abstención es la nota de un caso curado (D-124).
    return { d, texto: R.texto };
  }
  console.log(`  RESPONDE — cos_max ${d.cosMax.toFixed(4)} ≥ τ_${idioma} ${d.tau.toFixed(4)} (${rel})`);
  for (const p of d.pasajes) {
    console.log(`    R-${p.chunk.richterNo} cos ${p.cos.toFixed(4)} · rrf ${p.rrf.toFixed(5)} · «${p.chunk.richterTitle}»`);
    console.log(`      ${recortar(p.chunk.text, 28)}`);
  }
  if (d.notas.length) console.log(`    (${d.notas.length} notas de Richter vinculadas)`);

  if (!cascada.length) { /* sin clave: sólo se muestra el retrieval */ }
  else if (!R.texto) console.log("    [Leonardo descansa] presupuesto de tokens agotado");
  else {
    const g = [];
    if (R.reintentosCita) g.push(`${R.reintentosCita} reintento(s) por cita`);
    if (R.comillasQuitadas) g.push(`${R.comillasQuitadas} comilla(s) quitada(s)`);
    if (R.podadas) g.push(`${R.podadas} palabra(s) podada(s)`);
    if (R.citasSinRespaldo.length) g.push(`**${R.citasSinRespaldo.length} CITA(S) SIN RESPALDO**`);
    console.log(`\n  ${R.tokensEntrada}+${R.tokensSalida} tokens · ${presupuesto.usoActual()} tok en la ventana` +
                ` · historial: ${sanearHistorial(historial).length} mensaje(s)` +
                (g.length ? ` · ${g.join(" · ")}` : " · garantías sin intervenir"));
    console.log(R.texto.split("\n").map((l) => "  │ " + l).join("\n"));
  }
  return { d, texto: R.texto };
}

const args = process.argv.slice(2);
if (args[0] === "--lote") {
  const conteo: Record<string, Record<string, number>> = {};
  for (const [idioma, grupo, texto] of LOTE) {
    const { d } = await preguntar(idioma, texto, grupo);
    conteo[grupo] ??= {};
    conteo[grupo][d.tipo] = (conteo[grupo][d.tipo] ?? 0) + 1;
  }
  console.log(`\n${"═".repeat(78)}\nRESUMEN`);
  for (const [grupo, c] of Object.entries(conteo)) {
    console.log(`  ${grupo.padEnd(7)} ${JSON.stringify(c)}`);
  }
  console.log("\n  esperado: dentro→responde · fuera→abstiene · F→curada o abstiene");
} else if (args[0] === "--conv") {
  /**
   * Una conversacion de verdad: cada turno recibe los anteriores. Es la unica
   * forma de ver de punta a punta lo que D-197 arregla — el retrieval se mide
   * offline con `npm run evals:multiturno`, pero que Leonardo ENTIENDA «¿y por
   * qué?» sólo se comprueba generando.
   */
  const idioma = (args[1] as Idioma) ?? "es";
  const historial: Turno[] = [];
  for (const q of args.slice(2)) {
    const { texto } = await preguntar(idioma, q, undefined, historial);
    historial.push({ rol: "usuario", texto: q });
    if (texto) historial.push({ rol: "leonardo", texto });
  }
} else {
  const idioma = (args[0] as Idioma) ?? "es";
  await preguntar(idioma, args.slice(1).join(" ") || "¿Por qué el cielo es azul?");
}
