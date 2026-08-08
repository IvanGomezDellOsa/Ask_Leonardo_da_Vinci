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
 *   1. El juez NO es el generador (`06` v3 punto 5). Si fueran el mismo, la
 *      precaucion anti-sesgo se anula sola, y `asegurarJuezDistinto` lo verifica
 *      en cada corrida en vez de confiarlo a este comentario. Ver `JUECES` para
 *      cual esta en uso y por que.
 *   2. El juez no ve la etiqueta esperada del caso. Solo ve pregunta, pasajes y
 *      respuesta. Mostrarle `should_abstain` seria pedirle que confirme lo que
 *      ya decidimos, que es el sesgo que el paso 14 existe para evitar.
 *
 * El numero que sale de aca es la tesis del proyecto, asi que el instrumento se
 * valida antes de creerle: `npm run evals:acuerdo` mide el acuerdo contra 30
 * casos etiquetados a mano y reporta kappa de Cohen (D-063).
 */

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { Corpus, recortar } from "../src/lib/retrieval.js";
import { groq, gemini, deepseek, type CuotaAgotada } from "../src/lib/llm.js";
import {
  ART, RAIZ, cargarCasos, leerJsonl, abrirSalida, claves, dormir, progreso,
  type Resultado,
} from "./comun.js";

/**
 * Los jueces disponibles. Se elige con `--juez <clave>`.
 *
 * HISTORIA, porque el criterio importa mas que la eleccion concreta:
 *
 * D-063 habia elegido `gemini-3.6-flash`. **Medido, no sirve:** el free tier da
 * 20 requests por dia, y el verificador necesita ~85-100 juicios por corrida.
 *
 * Se paso a `openai/gpt-oss-120b` en Groq por su cuota de 14.400 req/dia.
 * **Medido, tampoco alcanza:** el limite que muerde no es el de requests sino el
 * de TOKENS por dia (200k, en ventana rodante — D-069/D-072). El patron de oro
 * son ~48k tokens, pero la cuota ya venia consumida por el generador, y durante
 * dos dias la corrida avanzo 9 casos de 30 en rafagas de 1-5 cortadas por esperas
 * de 30-45 minutos. Un instrumento que tarda tres dias en validarse bloquea el
 * proyecto entero.
 *
 * **Y en D-074 se dio vuelta el tablero:** la GENERACION se mudo a
 * `gemini-3.1-flash-lite`, asi que Groq dejo de usarse para generar y sus 200k
 * TPD de `gpt-oss-120b` quedaron enteros para juzgar. El cuello de botella
 * original —juez y generador peleandose la misma cuota— desaparecio solo.
 *
 * Ademas el prompt del juez bajo de ~110 lineas a ~40 con la rubrica v2 (D-075),
 * asi que cada juicio cuesta menos. Los 30 del patron de oro entran holgados, y
 * los ~105 completos tambien.
 *
 * Por eso `gpt-oss` vuelve a ser el default: 120B contra el "lite", familia
 * distinta Y proveedor distinto al del generador. `flash-lite` queda disponible
 * pero **ya no se puede usar con la corrida de Gemini** —seria juez y generador
 * el mismo modelo— y `asegurarJuezDistinto` aborta si se intenta.
 */
const JUECES: Record<string, {
  modelo: string;
  proveedor: "groq" | "gemini" | "deepseek";
  /** Pausa entre llamadas. Deriva del limite REAL del free tier de cada uno. */
  pausaMs: number;
}> = {
  /**
   * DeepSeek, PAGO — el unico de esta tabla que cuesta plata, y por eso el
   * default sigue siendo gratis. Se agrega en D-078 tras dos dias en que el free
   * tier no alcanzo para completar 30 juicios.
   *
   * Sin limite de requests por dia ni por minuto: solo un tope de concurrencia
   * (500 para pro). La pausa es minima, apenas para no abrir 30 conexiones de
   * golpe.
   *
   * Costo MEDIDO: ~1.350 tokens de entrada y ~310 de salida por caso. Con el
   * caching automatico (1.280 de 1.346 cacheados desde la segunda llamada) sale
   * ~US$0,0003 por caso: los 30 del patron de oro cuestan **un centavo**, y los
   * 108 completos ~US$0,03.
   */
  "deepseek":   { modelo: "deepseek-v4-pro",       proveedor: "deepseek", pausaMs: 300 },
  "deepseek-f": { modelo: "deepseek-v4-flash",     proveedor: "deepseek", pausaMs: 300 },
  // 500 req/dia, 15 RPM, 250K TPM. 4,5 s deja margen sobre los 4 s del RPM.
  "flash-lite": { modelo: "gemini-3.1-flash-lite", proveedor: "gemini", pausaMs: 4_500 },
  // 20 req/dia. Solo utilizable como desempate sobre un puñado de casos.
  "flash":      { modelo: "gemini-3.5-flash",      proveedor: "gemini", pausaMs: 4_500 },
  // 8.000 TPM y ~1.600 tokens por juicio: ~5 llamadas/min. Ver D-068.
  "gpt-oss":    { modelo: "openai/gpt-oss-120b",   proveedor: "groq",   pausaMs: 13_000 },
};

/** `C` (conexion) existio hasta la rubrica v1; v2 la pliega dentro de `F`. D-075. */
export interface Afirmacion { texto: string; etiqueta: "F" | "N" | "X"; motivo: string }
export interface Veredicto {
  id: string;
  juez: string;
  /** Huella de INSTRUCCIONES. Ver D-070: un veredicto de un prompt viejo no es
   *  "ya hecho" para el prompt nuevo, aunque no tenga error. */
  prompt: string;
  /**
   * Huella de LA RESPUESTA JUZGADA. Ver D-080.
   *
   * Faltaba, y el bug fue el mas silencioso de la serie: un veredicto se daba
   * por "hecho" segun (caso, modelo del juez, prompt del juez), sin registrar
   * QUE TEXTO habia juzgado. Al regenerar las 108 respuestas con un prompt
   * nuevo, el verificador dijo "nada que hacer" y habria reportado la tasa
   * VIEJA como si fuera la medicion nueva.
   *
   * Se hashea la respuesta y no la huella del prompt generador porque es mas
   * preciso: detecta cualquier cambio del texto juzgado, incluso una
   * regeneracion con el mismo prompt.
   */
  resp?: string;
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
/**
 * `--casos A-07es,B-06en` juzga solo esos ids.
 *
 * Existe para diagnosticar con un modelo caro sin gastar su cuota entera: cuando
 * un juez barato falla en N casos concretos, pasar SOLO esos N por uno grande
 * distingue "el prompt esta mal" de "el modelo no da". `gemini-3.5-flash` tiene
 * 20 requests por dia; los desacuerdos son 8.
 */
const soloCasos = new Set(arg("casos", "").split(",").map((s) => s.trim()).filter(Boolean));
/**
 * `--ref <archivo>` dice QUE archivo define el conjunto de oro.
 *
 * Sin esto, `idsOro` tomaba el primer archivo de etiquetas que existiera, y eso
 * eligio en silencio una referencia obsoleta: la muestra de la corrida VIEJA, en
 * vez de la que los anotadores acababan de etiquetar sobre la corrida nueva. Los
 * 30 casos salieron juzgados sin error visible y no eran comparables con nada.
 *
 * Es el modo de fallo de D-070 y D-073 por tercera vez —el codigo desempata solo
 * entre referencias y no avisa—, asi que la referencia se pide explicita y falla
 * ruidosamente si no existe. Cada muestra pertenece a la corrida que la genero.
 */
const refOro = arg("ref", "");

const claveJuez = arg("juez", "gpt-oss");
const JUEZ = JUECES[claveJuez];
if (!JUEZ) {
  console.error(`--juez desconocido: ${claveJuez}. Opciones: ${Object.keys(JUECES).join(", ")}`);
  process.exit(1);
}
const MODELO_JUEZ = JUEZ.modelo;

/**
 * El esquema de salida. Gemini lo aplica de verdad (`responseSchema`): el modelo
 * no puede devolver otra forma. En Groq el equivalente es `json: true`, que
 * garantiza JSON valido pero no la forma, asi que `extraerJson` sigue haciendo
 * falta para el segundo.
 *
 * Pedir JSON en prosa NO es alternativa: **11 de 13 respuestas volvieron
 * invalidas** —el juez cita las afirmaciones y las comillas internas rompen el
 * objeto— y un juez que falla el 85% de las veces por formato no mide nada.
 */
const ESQUEMA = {
  type: "OBJECT",
  properties: {
    afirmaciones: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          texto: { type: "STRING" },
          etiqueta: { type: "STRING", enum: ["F", "N", "X"] },
          motivo: { type: "STRING" },
        },
        required: ["texto", "etiqueta", "motivo"],
      },
    },
  },
  required: ["afirmaciones"],
};

const env = claves();
/**
 * `temperatura: 0` en ambos: esto es un instrumento de medicion, la misma
 * entrada tiene que dar el mismo veredicto.
 */
const juez = (() => {
  if (JUEZ.proveedor === "deepseek") {
    if (!env.DEEPSEEK_API_KEY) {
      console.error("falta DEEPSEEK_API_KEY en .env.local"); process.exit(1);
    }
    return deepseek(MODELO_JUEZ, env.DEEPSEEK_API_KEY, {
      temperatura: 0, maxTokens: 4000, json: true,
    });
  }
  if (JUEZ.proveedor === "gemini") {
    if (!env.GEMINI_API_KEY_A) {
      console.error("falta GEMINI_API_KEY_A en .env.local"); process.exit(1);
    }
    return gemini(MODELO_JUEZ, env.GEMINI_API_KEY_A, {
      temperatura: 0, maxTokens: 4000, esquema: ESQUEMA,
    });
  }
  if (!env.GROQ_API_KEY) { console.error("falta GROQ_API_KEY en .env.local"); process.exit(1); }
  return groq(MODELO_JUEZ, env.GROQ_API_KEY, { temperatura: 0, maxTokens: 4000, json: true });
})();

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
/**
 * El juez tiene que ver EXACTAMENTE los mismos pasajes que vio el generador. Si
 * la respuesta es en castellano el generador vio la traduccion congelada
 * (D-079), asi que mostrarle el ingles lo obligaria a comparar una afirmacion en
 * un idioma contra evidencia en otro, y marcaria `N` contenido que si estaba.
 */
const textoDe = new Map<number, {
  titulo: string | null; texto: string; tituloEs: string | null; textoEs: string | null;
}>();
for (const c of corpus.chunks) {
  if (c.voice !== "leonardo") continue;
  for (const n of c.richterNos) {
    if (!textoDe.has(n)) {
      textoDe.set(n, {
        titulo: c.richterTitle, texto: c.text,
        tituloEs: c.tituloEs ?? null, textoEs: c.textoEs ?? null,
      });
    }
  }
}

/** La rubrica, comprimida a lo que el juez necesita para decidir. */
/**
 * La rubrica v2 (`evals/rubrica.md`), comprimida a lo que el juez necesita.
 *
 * Paso de ~110 lineas a ~40 en D-075, y la brevedad no es estetica: la version
 * larga acumulaba reglas sobre reglas para arbitrar casos que NO TIENEN
 * respuesta estable, y tres anotadores independientes solo concordaban a
 * kappa ~0,5. Se cambio el corte —solo cuenta lo que se puede buscar y no
 * encontrar— y la mayor parte de la maquinaria dejo de hacer falta.
 */
const INSTRUCCIONES = `You are auditing a Leonardo da Vinci persona system for unfounded claims.
You will see a QUESTION, the PASSAGES the system had available, and the ANSWER it produced.
The passages are the ONLY admissible evidence. Anything else — including true facts about
the real Leonardo — counts as unfounded.

A claim is unfounded ONLY IF it contains a HARD ELEMENT that is absent from the passages.
The list of hard elements is CLOSED. If it is not on this list, it is not a hard element:

  1. a proper name — person, place, work, institution, guild, manuscript
  2. a date, year, age or duration — "in 1503", "for twenty years"
  3. a number or measurement
  4. a causal mechanism asserted as fact — "X happens BECAUSE Y", when the because is not
     in the passages. Both endpoints being present is not enough: the mechanism is the
     hard element.
  5. knowledge later than 1519, presented as something the speaker knows

Label each claim:

  F  founded      — every hard element is in the passages, literally or rephrased
  N  NOT founded  — at least one hard element is absent from the passages
  X  not a claim  — contains no hard element at all

THE ONE TEST: take the hard element, look for it in the passages. Present, in any wording?
F. Absent? N. No hard element at all? X. This is a lookup, not a judgement.

ALWAYS X, never N — none of these carries a hard element:
  - aphorisms and value judgements: "the true test of a work is that it lasts"
  - rhetorical flourish: "to reach the very essence of art", "a keen eye for light and shade"
  - autobiographical framing with no falsifiable detail: "this has long interested me",
    "I have studied it in my work". No date, place or named work means nothing to look up.
  - speculation marked as such: "I can only imagine", "perhaps", "were I to attempt it".
    BUT the hedge protects speculation, not data: "perhaps it was in 1503" names a date, N.
  - statements of ignorance and refusals: "I set nothing down about that", "I will not speak
    of that". This is the system behaving CORRECTLY. Marking it N inverts the measurement.
  - register, tone, questions, discourse markers

SIX CASES, each measured as a real disagreement between annotators. They are settled:
  - two passages contradict each other -> if ANY passage supports the claim, F
  - content appears only in the passage TITLE -> the title counts; it is text the model got
  - normative aphorism -> always X
  - rhetorical amplification of an already founded claim -> X; the claim itself is scored
    separately
  - autobiographical framing -> N only if it names a place, date, duration or work
  - hedged bridge between two passages -> X, if the hedge is there and it adds no hard element
  - a hard element the QUESTION introduced, echoed back to decline -> X. "I set down nothing
    of the man Verrocchio" names Verrocchio only to acknowledge the question and refuse; it
    asserts nothing about him. Still N if the speaker ADDS something: "Verrocchio was my
    master in Florence" is an assertion.
  - the closing "if you're interested, I can tell you about X" offer -> the offer wrapper does
    NOT launder an assertion. If X states a mechanism, figure or fact AS ALREADY TRUE ("like
    how water falling into a mass drags air down with it") and that content is absent from the
    passages, it is N, same as if said outside an offer. "I can tell you" is not a hedge: a
    hedge marks doubt about the fact itself, it does not reduce the commitment that the fact is
    true. It is X only if the offer names a topic without asserting anything about it yet
    ("I can tell you about light and shadow").
  - demonyms and nationalities count as a proper name (element 1): "that German who made
    mirrors" is as searchable as a literal name.

QUOTATIONS. Text inside «» is NOT scored: its literal fidelity is checked by string match
elsewhere. Score only what the speaker says AROUND the quotation. One exception: if the
quoted text appears in NO passage, that is N, and a serious one.

TIE-BREAKS, and they do not overlap:
  - unsure whether a hard element is IN the passages -> N
  - unsure whether something IS a hard element -> X (the list above is closed)

Reply with JSON only, no fences:
{"afirmaciones":[{"texto":"<the claim, quoted briefly>","etiqueta":"F|N|X","motivo":"<one short line>"}]}`;

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

/**
 * El instrumento es el par (modelo, prompt), no el prompt solo.
 *
 * D-070 hizo que un veredicto contara como "hecho" solo si venia del prompt
 * vigente. Al agregar `--juez` eso quedo corto: los veredictos de `gpt-oss-120b`
 * tienen la MISMA huella de prompt que los de `flash-lite` —las instrucciones no
 * cambiaron, cambio el modelo que las lee— asi que al cambiar de juez el
 * reanudado los habria dado por buenos y el kappa habria mezclado dos modelos
 * distintos bajo una sola etiqueta. Es el bug de D-070 en el otro eje.
 *
 * D-080 agrega el TERCER eje, que faltaba y era el mas peligroso: la respuesta
 * juzgada. Un veredicto describe un texto concreto; si ese texto se regenera, el
 * veredicto caduca aunque el juez y su prompt sean los mismos.
 */
const huellaResp = (s: string): string =>
  createHash("sha256").update(s).digest("hex").slice(0, 12);
const respDe = new Map(filas.filter((f) => f.respuesta).map((f) => [f.id, huellaResp(f.respuesta!)]));

const vigente = (v: Veredicto): boolean =>
  v.juez === MODELO_JUEZ &&
  (v.prompt === HUELLA_JUEZ ||
   (v.prompt !== undefined && EQUIVALENTES_JUEZ.has(v.prompt))) &&
  v.resp !== undefined && v.resp === respDe.get(v.id);

const previos = leerJsonl<Veredicto>(salida.url);
// "Hecho" exige CUATRO cosas: sin error, del prompt actual, del juez actual, y
// sobre la MISMA respuesta que hay hoy en el archivo de la corrida.
const hechos = new Set(previos.filter((v) => !v.error && vigente(v)).map((v) => v.id));
const otroInstrumento = previos.filter((v) => !v.error && !vigente(v));
const deOtroJuez = otroInstrumento.filter((v) => v.juez !== MODELO_JUEZ).length;
const deOtraResp = otroInstrumento.filter(
  (v) => v.juez === MODELO_JUEZ && v.resp !== respDe.get(v.id)).length;
const dePromptViejo = otroInstrumento.length - deOtroJuez - deOtraResp;

// Solo se juzga lo que el sistema efectivamente afirmo. Las abstenciones y los
// casos de capa 0 no entran al denominador de la tasa de alucinacion: tienen su
// propia metrica.
/**
 * Los 30 casos del conjunto de validacion. Aca solo interesa QUE casos son, no
 * como esten etiquetados: sirve para juzgarlos primero y para `--oro`.
 *
 * Se toma del primer archivo de etiquetas que exista. D-073 renombro
 * `etiquetas_humanas.jsonl` a `etiquetas_modelo_a.jsonl` al descubrir que no era
 * etiquetado a mano, y dejo el nombre viejo libre para las humanas de verdad;
 * el conjunto de casos es el mismo en ambos.
 */
const idsOro = new Set((() => {
  if (refOro) {
    const u = new URL(`evals/${refOro}`, RAIZ);
    if (!existsSync(u)) { console.error(`falta evals/${refOro}`); process.exit(1); }
    return leerJsonl<{ id: string }>(u).map((h) => h.id);
  }
  for (const n of ["etiquetas_humanas.jsonl", "etiquetas_modelo_a.jsonl"]) {
    const u = new URL(`evals/${n}`, RAIZ);
    if (existsSync(u)) return leerJsonl<{ id: string }>(u).map((h) => h.id);
  }
  return [];
})());
const aJuzgar = filas
  .filter((f) => f.decision === "responde" && f.respuesta && !hechos.has(f.id))
  .filter((f) => !soloOro || idsOro.has(f.id))
  .filter((f) => !soloCasos.size || soloCasos.has(f.id))
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
if (dePromptViejo) {
  console.log(`  DE PROMPT VIEJO: ${dePromptViejo}   (se re-juzgan; el prompt del juez cambio)`);
}
if (deOtroJuez) {
  console.log(`  DE OTRO JUEZ   : ${deOtroJuez}   (se re-juzgan; no son el mismo instrumento)`);
}
if (deOtraResp) {
  console.log(`  DE OTRA RESPUESTA: ${deOtraResp}   (se re-juzgan; la respuesta se regenero)`);
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
  /**
   * SE LEE LA EVIDENCIA DE LA FILA, no se reconstruye. Ver D-084.
   *
   * Reconstruirla desde `f.pasajes` (numeros de Richter) era un bug silencioso:
   * 32 numeros viven en mas de un chunk por los cortes de D-055, asi que el
   * mapa numero->chunk elegia el primero y el juez podia comparar contra la
   * mitad del pasaje que el generador nunca vio.
   *
   * La rama de abajo es solo para filas viejas, anteriores a `textosVistos`.
   * Conserva el defecto a proposito: rehacerlas no se puede, y fingir que la
   * reconstruccion es fiable seria peor que dejarla marcada aca.
   */
  const pasajes = f.textosVistos?.length
    ? f.textosVistos.map((t, i) => `[${i + 1}]\n${recortar(t, 200)}`).join("\n\n")
    : f.pasajes.length
    ? f.pasajes.map((no) => {
        const p = textoDe.get(no);
        if (!p) return `[${no}] (no encontrado)`;
        const es = c.lang === "es" && p.textoEs;
        const tit = es ? (p.tituloEs ?? "") : (p.titulo ?? "");
        return `[${no}] ${tit}\n${recortar(es ? p.textoEs! : p.texto, 200)}`;
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
      id: f.id, juez: MODELO_JUEZ, prompt: HUELLA_JUEZ, resp: huellaResp(f.respuesta!), afirmaciones,
      alucina: afirmaciones.some((a) => a.etiqueta === "N"),
    };
  } catch (e) {
    v = { id: f.id, juez: MODELO_JUEZ, prompt: HUELLA_JUEZ, resp: huellaResp(f.respuesta!),
           alucina: false, afirmaciones: [], error: String(e).slice(0, 240) };
    process.stdout.write(`\n  ! ${f.id}: ${String(e).slice(0, 110)}\n`);
  }
  salida.escribir(v);
  progreso(++n, aJuzgar.length, `${f.id} ${v.error ? "ERROR" : v.alucina ? "N" : "ok"}`);
  // El ritmo sale del limite REAL de cada juez (ver JUECES), no de un numero
  // fijo. MEDIDO en gpt-oss-120b: con 700 ms se enviaban ~85/min contra un techo
  // de ~5, y el propio verificador se autoinfligia rafagas de 429 que mataron 6
  // casos del patron de oro.
  await dormir(JUEZ.pausaMs);
}

const todos = leerJsonl<Veredicto>(salida.url);
const validos = todos.filter((v) => !v.error);
const malos = validos.filter((v) => v.alucina);
console.log(`\n  juzgadas ok      : ${validos.length} / ${todos.length}`);
console.log(`  con al menos 1 N : ${malos.length}  (${(100 * malos.length / Math.max(1, validos.length)).toFixed(1)}%)`);
console.log(`  ${((Date.now() - t0) / 60000).toFixed(1)} minutos`);
console.log(`\n  OJO: este numero no vale hasta validar el instrumento — npm run evals:acuerdo`);
