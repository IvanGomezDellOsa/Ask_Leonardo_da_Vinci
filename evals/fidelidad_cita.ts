/**
 * Fidelidad de cita: ¿lo que Leonardo entrecomilla esta LITERALMENTE en el
 * pasaje? Ver D-074.
 *
 *   npm run evals:citas -- --entrada rag-k3-gemini_gemini-3_1-flash-lite.jsonl
 *
 * POR QUE ESTE SCRIPT EXISTE
 *
 * La regla de citacion (`PERSONAJE` en `src/lib/llm.ts`) le pide al modelo que
 * conteste apoyandose en las palabras exactas del corpus. El objetivo es de
 * producto: la eleccion de palabras ES el dato —"los pajaros me gustan" y "los
 * pajaros me inspiran" describen a dos hombres distintos— y dejar que el modelo
 * elija esas palabras borra lo que el usuario vino a leer.
 *
 * Pero pedir cita textual introduce un modo de fallo peor que el que resuelve:
 * los modelos parafrasean mientras entrecomillan. Una comilla que altera
 * palabras le ATRIBUYE a Leonardo elecciones que no hizo, presentadas como
 * suyas. Parafrasear a cara descubierta no promete exactitud; la comilla si.
 *
 * LO QUE HACE ESTE SCRIPT ES LO CONTRARIO DE TODO LO DEMAS EN `evals/`: no
 * necesita un juez. Comparar una cita contra su pasaje es `string match`. Es la
 * unica metrica del proyecto que no depende de otro modelo para producirse, y
 * por eso es la mas dura de las que se van a publicar.
 *
 * IDIOMA. El corpus es Richter 1888, solo ingles. En espanol la cita es
 * traduccion y NO puede matchear por caracteres: esas se cuentan aparte y su
 * fidelidad la juzga el verificador por contenido, no este script. La pagina
 * "Como funciona" declara esa asimetria.
 */

import { Corpus, recortar } from "../src/lib/retrieval.js";
import { ART, RAIZ, leerJsonl, type Resultado } from "./comun.js";

const args = process.argv.slice(2);
const arg = (n: string, def: string): string => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const entrada = arg("entrada", "");
if (!entrada) { console.error("falta --entrada <archivo.jsonl>"); process.exit(1); }
/** Cuantas citas fallidas se listan en detalle. */
const detalle = Number(arg("detalle", "12"));

/**
 * LO QUE SE MIDE ES LA ELECCION DE PALABRAS, no la tipografia.
 *
 * La primera version comparaba caracteres y daba 79,8%, pero al mirar los
 * fallos la mayoria eran de este tipo: la cita decia "certainly while a man is
 * painting" y el pasaje "Certainly while a man is painting" —solo la mayuscula,
 * porque la cita va embebida a mitad de frase—, o terminaba antes y agregaba un
 * punto. Eso es puntuacion editorial normal al citar, no ponerle en la boca
 * palabras que no dijo.
 *
 * Medir asi hacia dos daños: inflaba la infidelidad, y mezclaba lo trivial con
 * lo grave justo donde hay que separarlos. Lo que arruina el proyecto es que
 * "me gustan" se vuelva "me inspiran"; que "Certainly" se vuelva "certainly" no
 * le cambia la vida a nadie.
 *
 * Entonces se compara por SECUENCIA DE PALABRAS, sin mayusculas ni puntuacion.
 * Eso sigue detectando lo que importa —sustituir, insertar u omitir palabras en
 * el medio— y deja pasar lo que no. La puntuacion de Richter es del traductor de
 * 1888, no de Leonardo, asi que exigirla seria exigir fidelidad a la persona
 * equivocada.
 */
const palabras = (s: string): string[] =>
  s.toLowerCase()
   .replace(/[‘’ʼ]/g, "'")
   .replace(/[^\p{L}\p{N}'\s]/gu, " ")
   .split(/\s+/)
   .filter(Boolean);

/** ¿Aparece `aguja` como secuencia contigua dentro de `pajar`? */
function contiene(aguja: string[], pajar: string[]): boolean {
  if (!aguja.length || aguja.length > pajar.length) return false;
  for (let i = 0; i + aguja.length <= pajar.length; i++) {
    let ok = true;
    for (let j = 0; j < aguja.length; j++) {
      if (pajar[i + j] !== aguja[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Una cita puede omitir el medio con puntos suspensivos, que es legitimo. Se
 * parte por la elipsis y se exige que CADA tramo aparezca contiguo.
 */
function esLiteral(cita: string, pajar: string[]): boolean {
  const tramos = cita.split(/\s*(?:\.\.\.|…)\s*/).map(palabras).filter((t) => t.length);
  return tramos.length > 0 && tramos.every((t) => contiene(t, pajar));
}

/**
 * Extrae lo entrecomillado. El prompt pide guillemets «», que es lo que se
 * cuenta; se aceptan tambien comillas dobles rectas y curvas porque un modelo
 * las mezcla, y no reconocerlas inflaria artificialmente la fidelidad al ignorar
 * justo las citas mal formadas.
 */
/**
 * Solo `«»`, que es lo que el prompt pide. Las comillas rectas se contaban antes
 * y producian falsos positivos: en `D-03en` el modelo entrecomillo su PROPIA
 * habla —"...of which you speak? I have no knowledge of such a device"— y eso se
 * anotaba como cita infiel, cuando nunca pretendio ser una cita.
 *
 * Medir contra el contrato del prompt en vez de contra cualquier comilla es a la
 * vez mas simple y mas exacto. El uso de comillas rectas largas se reporta
 * aparte como señal de higiene, no como infidelidad.
 */
const RE_CITA = /«([^»]+)»/g;
const RE_RECTAS = /"([^"]{40,})"|“([^”]{40,})”/g;

function extraerCitas(t: string): string[] {
  // Una cita corta puede ser una palabra enfatizada, no una cita. El umbral es
  // arbitrario y se declara: por debajo de 6 palabras no se evalua.
  return [...t.matchAll(RE_CITA)]
    .map((m) => m[1].trim())
    .filter((s) => s.split(/\s+/).length >= 6);
}

const corpus = new Corpus(ART);
/**
 * Desde D-079 el corpus tiene traduccion congelada, asi que en castellano la
 * cita se compara contra el TEXTO ESPANOL que el modelo efectivamente vio. Antes
 * era estructuralmente imposible —se comparaba una traduccion improvisada contra
 * el ingles— y la fila de español no era una medicion sino un "n/a por diseño".
 */
const textoDe = new Map<number, { en: string; es: string | null }>();
for (const c of corpus.chunks) {
  if (c.voice !== "leonardo") continue;
  for (const n of c.richterNos) {
    if (!textoDe.has(n)) textoDe.set(n, { en: c.text, es: c.textoEs ?? null });
  }
}

const filas = leerJsonl<Resultado>(new URL(`evals/out/${entrada}`, RAIZ))
  .filter((f) => f.decision === "responde" && f.respuesta);

interface Fallo { id: string; idioma: string; cita: string; pasajes: number[] }
const fallos: Fallo[] = [];
/**
 * Citas SIN traducir dentro de respuestas en castellano.
 *
 * Se detectan con la misma maquinaria que la fidelidad, sin heuristicas de
 * idioma: si una cita de una respuesta en castellano **matchea el pasaje
 * INGLES**, es que el modelo no la tradujo. Un acierto aca es un fallo de
 * producto.
 *
 * MEDIDO: `gemini-3.1-flash-lite` no traduce citas largas de forma fiable, y
 * dos rondas de instrucciones cada vez mas explicitas no lo movieron —la segunda
 * salio peor que la primera—. Es limite de capacidad, no de redaccion del
 * prompt, asi que se mide en vez de seguir insistiendo. Ver D-076.
 */
const sinTraducir: Fallo[] = [];

/**
 * Mezcla parcial de ingles dentro de una cita en castellano.
 *
 * El match contra el pasaje ingles solo atrapa la cita copiada ENTERA. El caso
 * real medido es peor y mas sutil: `«primero tu ought to learn the limbs and
 * their mechanism, y habiendo este conocimiento...»` — empieza a traducir, se
 * cansa a mitad y sigue en ingles. Eso no matchea el pasaje completo, asi que se
 * colaba.
 *
 * Se detecta con palabras funcionales inglesas, que no existen en castellano y
 * son las mas frecuentes de cualquier texto ingles. Dos o mas son señal
 * inequivoca; una sola podria ser un nombre o un prestamo.
 */
const FUNCIONALES_EN = new Set([
  "the", "and", "of", "to", "in", "that", "which", "with", "for", "is", "are",
  "be", "you", "your", "should", "will", "would", "their", "they", "it", "its",
  "from", "this", "these", "those", "when", "where", "there", "has", "have",
]);
const mezclaIngles = (cita: string): boolean =>
  palabras(cita).filter((w) => FUNCIONALES_EN.has(w)).length >= 2;
let citas = 0, literales = 0, citasEs = 0, literalesEs = 0;
let conCita = 0;

let conRectas = 0;
for (const f of filas) {
  const idioma = f.id.endsWith("es") ? "es" : "en";
  const cs = extraerCitas(f.respuesta!);
  if (cs.length) conCita++;
  if (RE_RECTAS.test(f.respuesta!)) conRectas++;
  RE_RECTAS.lastIndex = 0;
  // El modelo ve los pasajes RECORTADOS a 200 palabras (`construirPrompt`), asi
  // que se compara contra lo mismo que vio. Comparar contra el texto entero
  // marcaria como literal una cita que el modelo no pudo haber leido.
  // Y se lee de la fila, no se reconstruye: 32 numeros de Richter viven en mas
  // de un chunk (D-055), asi que el mapa numero->chunk elegia uno de varios y la
  // cita podia fallar contra la mitad del pasaje que el modelo nunca leyo. Ver
  // D-084. La rama vieja queda solo para filas anteriores a `textosVistos`.
  const disponible = palabras((f.textosVistos?.length
    ? f.textosVistos
    : f.pasajes.map((n) => {
        const t = textoDe.get(n);
        if (!t) return "";
        return idioma === "es" && t.es ? t.es : t.en;
      })
  ).map((t) => recortar(t, 200)).join("   "));
  for (const c of cs) {
    const ok = esLiteral(c, disponible);
    if (idioma === "es") {
      citasEs++;
      if (ok) literalesEs++;
      // Desde D-079 la comparacion en castellano es contra el pasaje ESPANOL, asi
      // que un match ya no significa "no tradujo" sino "cito bien". El unico defecto
      // de idioma que queda es que se cuele ingles dentro de la comilla.
      if (mezclaIngles(c)) sinTraducir.push({ id: f.id, idioma, cita: c, pasajes: f.pasajes });
    } else {
      citas++;
      if (ok) literales++;
      if (!ok) fallos.push({ id: f.id, idioma, cita: c, pasajes: f.pasajes });
    }
  }
}

const pct = (a: number, b: number): string =>
  b === 0 ? "n/a" : `${(100 * a / b).toFixed(1)}%`;

console.log(`# Fidelidad de cita — ${entrada}\n`);
console.log(`Respuestas analizadas : ${filas.length}`);
console.log(`Con al menos una cita : ${conCita}  (${pct(conCita, filas.length)})`);
console.log(`Con comillas rectas   : ${conRectas}  (higiene: el prompt pide «», no "")\n`);
console.log("|  | citas | literales | fidelidad |");
console.log("|---|---:|---:|---:|");
console.log(`| **ingles** (comparable) | ${citas} | ${literales} | **${pct(literales, citas)}** |`);
console.log(`| español (traducidas) | ${citasEs} | ${literalesEs} | ${pct(literalesEs, citasEs)} |`);
console.log();
console.log(`**Citas en castellano con ingles colado: ${sinTraducir.length} de ${citasEs}  ` +
            `(${pct(sinTraducir.length, citasEs)})** — llevan palabras funcionales inglesas`);
console.log("dentro de la comilla; al lector le llega ingles a mitad de frase.\n");
console.log("> LAS DOS FILAS SON MEDICIONES. Hasta D-079 la de español no lo era: el modelo");
console.log("> traducia al vuelo y comparar eso contra el ingles por caracteres era imposible.");
console.log("> Ahora se compara contra el texto español que el modelo efectivamente vio.\n");

if (fallos.length) {
  console.log(`## Citas en ingles que NO son literales (${fallos.length})\n`);
  console.log("Cada una es una eleccion de palabras atribuida a Leonardo que no hizo.\n");
  for (const f of fallos.slice(0, detalle)) {
    console.log(`- \`${f.id}\` — pasajes ${f.pasajes.join(", ")}`);
    console.log(`  > ${f.cita.slice(0, 200)}`);
  }
  if (fallos.length > detalle) console.log(`\n…y ${fallos.length - detalle} mas.`);
}
