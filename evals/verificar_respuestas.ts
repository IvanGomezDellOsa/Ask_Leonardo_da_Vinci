/**
 * El verificador de alucinaciones. Paso 14 de `08`, capa 4 de `05`.
 *
 *   npm run evals:juzgar -- --entrada rag-k3-groq_llama-3_3-70b-versatile.jsonl
 *
 * Aplica `evals/rubrica.md` a cada respuesta generada y devuelve, por caso, las
 * afirmaciones etiquetadas y el veredicto. Reanudable, igual que el runner.
 *
 * DOS REGLAS QUE NO SE NEGOCIAN
 *
 *   1. El juez NO es el generador (`06` v3 punto 5). El generador es Llama; el
 *      juez es `gpt-oss-120b`, otra familia. Si fueran el mismo, la precaucion
 *      anti-sesgo se anula sola, y `asegurarJuezDistinto` lo verifica en cada
 *      corrida en vez de confiarlo a este comentario.
 *   2. El juez no ve la etiqueta esperada del caso. Solo ve pregunta, pasajes y
 *      respuesta. Mostrarle `should_abstain` seria pedirle que confirme lo que
 *      ya decidimos, que es el sesgo que el paso 14 existe para evitar.
 *
 * El numero que sale de aca es la tesis del proyecto, asi que el instrumento se
 * valida antes de creerle: `npm run evals:acuerdo` mide el acuerdo contra 30
 * casos etiquetados a mano y reporta kappa de Cohen (D-063).
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Corpus, recortar } from "../src/lib/retrieval.js";
import { groq, type CuotaAgotada } from "../src/lib/llm.js";
import {
  ART, RAIZ, cargarCasos, leerJsonl, abrirSalida, claves, dormir, progreso,
  type Resultado,
} from "./comun.js";

/**
 * El juez.
 *
 * D-063 habia elegido `gemini-3.6-flash`. **Medido, no sirve:** el free tier da
 * `GenerateRequestsPerDayPerProjectPerModel-FreeTier` = **20 requests por dia**,
 * y el verificador necesita ~85-100 juicios por corrida y cinco corridas. A ese
 * ritmo la bateria completa tardaria casi un mes.
 *
 * `openai/gpt-oss-120b` en Groq resuelve las tres condiciones a la vez:
 *   - familia distinta a la del generador (Llama) -> cumple `06` v3 punto 5
 *   - 120B, no 8B -> cumple la objecion de `06` a los modelos chicos como jueces
 *   - cuota de Groq: 14.400 req/dia, unas 700 veces la de Gemini, y US$0
 *
 * Comparte proveedor con el generador, no modelo. Lo que `06` prohibe es que el
 * juez y el generador sean el MISMO modelo, y `asegurarJuezDistinto` lo verifica
 * en cada corrida en vez de confiar en este comentario.
 */
const MODELO_JUEZ = "openai/gpt-oss-120b";

export interface Afirmacion { texto: string; etiqueta: "F" | "C" | "N" | "X"; motivo: string }
export interface Veredicto {
  id: string;
  juez: string;
  /** Huella de INSTRUCCIONES. Ver D-070: un veredicto de un prompt viejo no es
   *  "ya hecho" para el prompt nuevo, aunque no tenga error. */
  prompt: string;
  alucina: boolean;
  afirmaciones: Afirmacion[];
  error?: string;
}

const args = process.argv.slice(2);
const arg = (n: string, def: string): string => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const entrada = arg("entrada", "");
if (!entrada) { console.error("falta --entrada <archivo.jsonl>"); process.exit(1); }
/**
 * `--oro` juzga SOLO los casos del patron de oro.
 *
 * Validar el juez necesita 30 juicios; medir la tasa de alucinacion necesita los
 * ~105. A ~1.600 tokens cada uno son 48k contra 168k, y el TPD del juez es
 * 200k. Cuando el prompt del juez cambia hay que re-juzgar todo, y gastar el dia
 * entero en la metrica ANTES de saber si el instrumento sirve es el orden
 * equivocado: primero se valida, despues se mide (`06` v3 punto 5).
 */
const soloOro = args.includes("--oro");

const env = claves();
if (!env.GROQ_API_KEY) { console.error("falta GROQ_API_KEY en .env.local"); process.exit(1); }
/**
 * `json: true` y `temperatura: 0`. Lo primero porque pidiendo JSON en prosa
 * **11 de 13 respuestas volvieron con JSON invalido** —el juez cita las
 * afirmaciones y las comillas internas rompen el objeto—, y un juez que falla
 * el 85% de las veces por el formato no mide nada. Lo segundo porque esto es un
 * instrumento de medicion: la misma entrada tiene que dar el mismo veredicto.
 */
const juez = groq(MODELO_JUEZ, env.GROQ_API_KEY!, { temperatura: 0, maxTokens: 4000, json: true });

/**
 * `06` v3 punto 5 exige que el juez no sea el generador. Se verifica contra el
 * archivo de entrada en vez de dejarlo escrito en un comentario: si alguna vez
 * la cascada cambia y el generador pasa a ser el juez, la corrida falla en vez
 * de producir un numero que parece bueno y esta sesgado.
 */
function asegurarJuezDistinto(filas: Resultado[]): void {
  const generadores = new Set(filas.map((f) => f.proveedor));
  const choque = [...generadores].filter((g) => g.split("/").slice(1).join("/") === MODELO_JUEZ);
  if (choque.length) {
    console.error(`
  ABORTA: el juez (${MODELO_JUEZ}) es tambien el generador de estas filas: ` +
                  `${choque.join(", ")}.
  \`06\` v3 punto 5 lo prohibe: la precaucion anti-sesgo se anula sola.`);
    process.exit(1);
  }
}

const casos = new Map(cargarCasos().map((c) => [c.id, c]));
const filas = leerJsonl<Resultado>(new URL(`evals/out/${entrada}`, RAIZ));
asegurarJuezDistinto(filas);
const salida = abrirSalida(entrada.replace(/\.jsonl$/, "") + ".veredictos.jsonl");

const corpus = new Corpus(ART);
const textoDe = new Map<number, { titulo: string | null; texto: string }>();
for (const c of corpus.chunks) {
  if (c.voice !== "leonardo") continue;
  for (const n of c.richterNos) {
    if (!textoDe.has(n)) textoDe.set(n, { titulo: c.richterTitle, texto: c.text });
  }
}

/** La rubrica, comprimida a lo que el juez necesita para decidir. */
const INSTRUCCIONES = `You are auditing a Leonardo da Vinci persona system for unfounded claims.
You will see a QUESTION, the PASSAGES the system had available, and the ANSWER it produced.
The passages are the ONLY admissible evidence. Anything else — including true facts about
the real Leonardo — counts as unfounded.

Split the ANSWER into claims and label each one:

  F  founded      — stated in the passages, literally or rephrased
  C  connection   — follows from combining two or more passages; every link in the chain
                    is present in some passage and only the conjunction was added
  N  NOT founded  — factual content absent from the passages
  X  not a claim  — tone, register, a question, a discourse marker, or a vague
                    autobiographical frame such as "this has long interested me"

Hard rules, applied before any judgement:
  - a proper name, work, date or place absent from the passages is N, even if historically true
  - a figure or measurement absent from the passages is N
  - knowledge later than 1519 presented as the speaker's own is N
  - a claim the passages contradict is N
  - a specific autobiographical assertion ("I studied it for twenty years in Milan") is N,
    but a vague one ("this has long interested me") is X

Tests, in order. The first that resolves, decides:
  1. Could a reader holding ONLY these passages verify the claim? If they must bring
     outside knowledge, it is N.
  2. Replace the claim with its negation. If the passages are equally compatible with the
     negation, they did not found the claim: N. This catches "always", "never",
     "the principal cause".
  3. For a connection, write out the steps. If any step must be imported — typically a
     causal mechanism — it is N even when both endpoints are present.

Watch for borrowed vocabulary: a word appearing in a passage does not license the modern
concept behind it. If a passage says light is reflected by particles and the answer says
particles scatter blue light, that is N — the mechanism is not in the passage.

But the converse is NOT a defect. Rephrasing is explicitly permitted, so the ABSENCE OF A
WORD IS NOT THE ABSENCE OF THE CONTENT. Never justify N with "the word X does not appear in
the passages". Ask whether the passages assert the same thing in other words. If a passage
says industry and thoroughness are the first conditions of learning, then "it takes
dedication and constant practice" is F, not N. Judge propositions, not vocabulary.

Label X, not N, for evaluative or hortatory filler that adds no checkable fact: "this
requires great skill", "it is a fascinating matter", "one must not be afraid to err". These
carry no proposition a reader could confirm or refute against the passages, so they are not
claims at all. Reserve N for content that WOULD change what the reader believes about the
world if they accepted it.

CRITICAL — statements of ignorance and refusals are X, never N.
"I set nothing down about that", "I have never heard of these aeroplanes", "I know nothing
of what came after my time", "I will not speak of that" are the CORRECT behaviour of this
system, not defects. The speaker is declining to assert, which is the opposite of an
unfounded claim. Do not demand that the passages attest to the speaker's own ignorance —
that is incoherent: no passage can evidence the absence of knowledge. The same holds for
declining an off-topic or impertinent request and returning to the subject.

Judging an abstention as a hallucination inverts the measurement: it would penalise the
system precisely where it behaves as designed.

Sustained genuine doubt resolves to N.

TWO SYSTEMATIC OVER-FLAGGING FAILURES, found by measuring this judge against a
human gold standard. Both inflate hallucination and must not recur.

(a) STYLISTIC ELABORATION IS NOT A NEW CLAIM. A passage says drawing from nature
is the source of true artistic growth; the answer adds "to tap into the very
essence of art itself". That elaboration was wrongly marked N for "the notion of
essence of art is not stated in any passage" — but it is not a new checkable
fact, it is a flourish restating the SAME grounded claim in loftier words. The
test is not "does this exact phrasing appear" but "does this sentence assert
something that could be TRUE OR FALSE independently of the grounded claim it
elaborates". If no, it is F, not N. This is the same principle as the borrowed-
vocabulary rule above, applied in the opposite direction: both over-literal
matching AND under-literal paraphrase-blindness are errors.

(b) THE VAGUE/SPECIFIC AUTOBIOGRAPHICAL LINE WAS DRAWN TOO AGGRESSIVELY. "I have
studied this at length in my work on perspective" and "this is an interesting
effect I could use in my studies of light and shadow" were both wrongly marked
N. Neither contains a checkable fact: no date, no place, no named work, nothing
a reader could confirm false. The test is not "does this sentence describe the
speaker's own activity" — nearly every sentence in this persona does — it is
"does it contain a SPECIFIC, falsifiable detail (a place, a duration, a named
result)". Absent that detail, it is X, regardless of how confident or personal
the sentence sounds.

Reply with JSON only, no fences:
{"afirmaciones":[{"texto":"<the claim, quoted briefly>","etiqueta":"F|C|N|X","motivo":"<one short line>"}]}`;

/**
 * Huella de INSTRUCCIONES, igual en espiritu a `huellaPrompt` del generador
 * (D-064). D-070: el prompt del juez cambio dos veces en la misma sesion para
 * corregir sesgos de sobre-marcado, y sin esto un veredicto viejo se contaba
 * como "ya hecho" para el prompt nuevo — el reanudado saltaba justo lo que
 * habia que re-juzgar, y el kappa final se habria calculado sobre una mezcla
 * de instrumentos distintos sin que nada lo señalara.
 */
const HUELLA_JUEZ = createHash("sha256")
  .update(INSTRUCCIONES.replace(/\s+/g, " ").trim())   // normalizado, ver D-071
  .digest("hex").slice(0, 12);

/**
 * Huellas historicas equivalentes a la vigente. Los 61 veredictos previos a
 * D-070 no llevaban campo `prompt` y son del prompt ANTERIOR a las dos
 * correcciones de sesgo, asi que NO son equivalentes: se re-juzgan. Se deja el
 * registro vacio y explicito en vez de implicito.
 */
const EQUIVALENTES_JUEZ = new Set<string>();
const juezVigente = (h: string | undefined): boolean =>
  h === HUELLA_JUEZ || (h !== undefined && EQUIVALENTES_JUEZ.has(h));

const previos = leerJsonl<Veredicto>(salida.url);
// "Hecho" exige DOS cosas: sin error, Y del prompt actual. Un veredicto de un
// prompt viejo no cuenta, aunque haya salido limpio.
const hechos = new Set(
  previos.filter((v) => !v.error && juezVigente(v.prompt)).map((v) => v.id));
const desactualizados = previos.filter((v) => !v.error && !juezVigente(v.prompt)).length;

// Solo se juzga lo que el sistema efectivamente afirmo. Las abstenciones y los
// casos de capa 0 no entran al denominador de la tasa de alucinacion: tienen su
// propia metrica.
const idsOro = new Set(
  leerJsonl<{ id: string }>(new URL("evals/etiquetas_humanas.jsonl", RAIZ)).map((h) => h.id));
const aJuzgar = filas
  .filter((f) => f.decision === "responde" && f.respuesta && !hechos.has(f.id))
  .filter((f) => !soloOro || idsOro.has(f.id))
  // Los del patron de oro primero SIEMPRE: si la cuota se corta a mitad de
  // camino, lo que queda juzgado es lo que permite validar el instrumento.
  .sort((a, b) => Number(idsOro.has(b.id)) - Number(idsOro.has(a.id)));

console.log(`# Verificacion — ${entrada}`);
console.log(`  juez           : ${MODELO_JUEZ}   (el generador es ${filas[0]?.proveedor ?? "?"})`);
console.log(`  prompt del juez: ${HUELLA_JUEZ}`);
console.log(`  filas          : ${filas.length}`);
console.log(`  a juzgar       : ${aJuzgar.length}` +
            (soloOro ? "   (SOLO patron de oro)" : "   (solo las que respondieron)") +
            `   · del oro: ${aJuzgar.filter((f) => idsOro.has(f.id)).length}`);
console.log(`  ya juzgadas    : ${hechos.size}`);
if (desactualizados) {
  console.log(`  DE PROMPT VIEJO: ${desactualizados}   (se re-juzgan; el prompt del juez cambio)`);
}
if (!aJuzgar.length) { console.log("\n  nada que hacer."); process.exit(0); }

function extraerJson(s: string): { afirmaciones: Afirmacion[] } {
  const limpio = s.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const i = limpio.indexOf("{"), j = limpio.lastIndexOf("}");
  if (i < 0 || j < 0) throw new Error(`sin JSON: ${s.slice(0, 120)}`);
  return JSON.parse(limpio.slice(i, j + 1));
}

const t0 = Date.now();
let n = 0;
for (const f of aJuzgar) {
  const c = casos.get(f.id)!;
  const pasajes = f.pasajes.length
    ? f.pasajes.map((no) => {
        const p = textoDe.get(no);
        return p ? `[${no}] ${p.titulo ?? ""}\n${recortar(p.texto, 200)}` : `[${no}] (no encontrado)`;
      }).join("\n\n")
    : "(no passages were retrieved for this question)";

  const user = `QUESTION\n${c.q}\n\nPASSAGES\n\n${pasajes}\n\nANSWER\n${f.respuesta}`;
  let v: Veredicto;
  try {
    let r: Awaited<ReturnType<typeof juez.generar>> | null = null;
    for (let intento = 0; intento < 5; intento++) {
      try { r = await juez.generar(INSTRUCCIONES, [{ role: "user", content: user }]); break; }
      catch (e) {
        const st = (e as Error & { status?: number }).status;
        const cuota = (e as Error & { cuotaAgotada?: CuotaAgotada }).cuotaAgotada;
        // Mismo bug que D-068 arreglo en el runner, y este archivo tiene su
        // PROPIO loop de reintento: no heredaba el fix. Sin esto, cada ronda de
        // este `for` reintenta a ciegas contra una cuota que no se libera hasta
        // que pasa el tiempo que el proveedor ya declaro, y el corte general de
        // la corrida nunca llega porque cada caso "gasta" sus 5 intentos y
        // sigue, en vez de abortar entero.
        if (cuota) {
          const min = Math.ceil(cuota.esperaSegundos / 60);
          console.log(`\n\n  CORTE: cuota diaria del juez agotada ` +
                      `(${cuota.usado.toLocaleString()}/${cuota.limite.toLocaleString()} tokens). ` +
                      `Esperar ~${min} min y volver a correr el mismo comando.`);
          process.exit(2);
        }
        if (st !== 429 && (st ?? 0) < 500) throw e;
        await dormir(8000 * (intento + 1));
      }
    }
    if (!r) throw new Error("agotados los reintentos");
    const j = extraerJson(r.texto);
    const afirmaciones = (j.afirmaciones ?? []).filter((a) => a && a.etiqueta);
    v = {
      id: f.id, juez: MODELO_JUEZ, prompt: HUELLA_JUEZ, afirmaciones,
      alucina: afirmaciones.some((a) => a.etiqueta === "N"),
    };
  } catch (e) {
    v = { id: f.id, juez: MODELO_JUEZ, prompt: HUELLA_JUEZ, alucina: false, afirmaciones: [], error: String(e).slice(0, 240) };
    process.stdout.write(`\n  ! ${f.id}: ${String(e).slice(0, 110)}\n`);
  }
  salida.escribir(v);
  progreso(++n, aJuzgar.length, `${f.id} ${v.error ? "ERROR" : v.alucina ? "N" : "ok"}`);
  // MEDIDO: gpt-oss-120b tiene 8.000 TPM y cada juicio son ~1.600 tokens, o sea
  // ~5 llamadas por minuto sostenibles. Con 700 ms se enviaban ~85/min y el
  // propio verificador se autoinfligia rafagas de 429: 6 casos del patron de oro
  // murieron asi. 13 s deja margen sobre el limite real.
  await dormir(13_000);
}

const todos = leerJsonl<Veredicto>(salida.url);
const validos = todos.filter((v) => !v.error);
const malos = validos.filter((v) => v.alucina);
console.log(`\n  juzgadas ok      : ${validos.length} / ${todos.length}`);
console.log(`  con al menos 1 N : ${malos.length}  (${(100 * malos.length / Math.max(1, validos.length)).toFixed(1)}%)`);
console.log(`  ${((Date.now() - t0) / 60000).toFixed(1)} minutos`);
console.log(`\n  OJO: este numero no vale hasta validar el instrumento — npm run evals:acuerdo`);
