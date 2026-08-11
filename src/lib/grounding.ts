/**
 * El grounding gate. Tres capas, en el orden que D-039 y D-040 fijaron.
 *
 *   capa 0  lista curada        antes del retrieval. 40% de las consultas fuera
 *                               de corpus y 62% de las filtraciones (D-040)
 *   capa 1  pre-filtro          cos_max PRE-fusion contra tau[idioma] (D-021,
 *                               D-038). NO juzga: pre-filtra
 *   capa 2  el LLM              decide lo dudoso con los pasajes delante y
 *                               devuelve respuesta O abstencion, en UNA llamada
 *
 * Lo que este archivo NO hace, a proposito:
 *   - no umbraliza sobre RRF ni sobre BM25 (D-021)
 *   - no usa un tau unico: el coseno de e5 no es comparable entre idiomas, y
 *     con uno solo la exactitud cae de 88,4% a 70,5% (D-038)
 *   - no detecta el idioma: viene del selector (D-031)
 *   - no lleva tau a la esquina: con cero filtraciones el espanol rechaza el
 *     97,9% de lo que si puede contestar (D-041)
 */

import { readFileSync, existsSync } from "node:fs";
import { Corpus, Recuperado, Voz } from "./retrieval.js";

export type Idioma = "es" | "en";

export type Decision =
  | { tipo: "curada"; caso: string; nota: Recuperado[]; cita: string | null }
  | { tipo: "abstiene"; cosMax: number; tau: number; evidencia: Recuperado[] }
  | { tipo: "responde"; cosMax: number; tau: number; pasajes: Recuperado[]; notas: unknown[] };

export interface Umbrales {
  provisional: boolean;
  tau: Record<Idioma, number>;
  puntosDeOperacion: Record<Idioma, Record<string, number>>;
}

export function cargarUmbrales(dir: URL): Umbrales {
  return JSON.parse(readFileSync(new URL("thresholds.json", dir), "utf8"));
}

/**
 * UN INDICE POR IDIOMA. Ver D-105, D-106 y D-107.
 *
 * Hasta acá había un solo índice, en inglés, y una consulta en castellano
 * buscaba a través de una barrera de idioma. Medido, eso costaba las dos cosas a
 * la vez: 32 temas del corpus que no se alcanzaban (D-105) y un gate que dejaba
 * pasar el 100% de las consultas fuera de corpus en vez del 47% (D-106).
 *
 * CADA INDICE TRAE SU PROPIO τ, Y NO SON INTERCAMBIABLES. Las distribuciones del
 * coseno están desplazadas ~0,06 entre sí: usar τ_es del índice inglés con el
 * índice castellano abre el gate por completo, y al revés lo cierra. Por eso el
 * umbral viaja PEGADO al corpus en esta estructura y no en un mapa aparte —
 * D-056 ya mostró que un cambio de representación desplaza el gate en silencio, y
 * la única defensa que funciona es que sea imposible tomar uno sin el otro.
 */
export interface Motor { por: Record<Idioma, { corpus: Corpus; umbrales: Umbrales }> }

/**
 * `es` sale de `<raiz>/es/` si está; si no, cae al índice inglés y todo funciona
 * como antes de D-105. Igual que la traducción y la curaduría: el artefacto que
 * falta degrada, no rompe.
 */
export function cargarMotor(raiz: URL): Motor {
  const en = { corpus: new Corpus(raiz), umbrales: cargarUmbrales(raiz) };
  const dirEs = new URL("es/", raiz);
  const hayEs = existsSync(new URL("index.bin", dirEs));
  return { por: {
    en,
    es: hayEs ? { corpus: new Corpus(dirEs, { base: raiz }), umbrales: cargarUmbrales(dirEs) } : en,
  } };
}

/**
 * Router sobre `decidir`. No es una segunda forma de decidir: es la primitiva
 * con el corpus y el umbral que le corresponden al idioma. `decidir` se sigue
 * usando directo donde el llamador ELIGE el índice a propósito —`compuerta.ts`
 * compara dos ramas, `alcance.ts` mide una— y ahí rutear sería lo incorrecto.
 */
export function decidirCon(
  motor: Motor, consulta: string, vector: Float32Array, idioma: Idioma, k = 3,
): Decision {
  const { corpus, umbrales } = motor.por[idioma];
  return decidir(corpus, umbrales, consulta, vector, idioma, k);
}

/**
 * Capa 0: los casos curados a mano. D-027, D-040 y D-124.
 *
 * Se resuelven por regla explicita ANTES del retrieval: son las preguntas de
 * entrada mas probables y el corpus no las cubre. **Medido sobre la categoria F
 * del eval set: 13 de 20 se colaban por el gate**, casi todas en ingles.
 *
 * NO ES SOLO DEFENSA, ES EL MEJOR MOMENTO DEL PRODUCTO (D-027). Cuando la
 * pregunta es sobre algo famoso que el corpus no cubre, Leonardo dice que no
 * dejo anotacion **y el sistema muestra la nota de Richter de 1888 que lo
 * confirma**. Deja de ser «el sistema no sabe» y pasa a ser un hecho historico
 * verificable, con su fuente. Es ademas lo unico que puede acompanar una
 * abstencion desde D-110.
 *
 * ================================================================
 * NINGUNA NOTA SE ESCRIBE ACA. SE CITA, Y LA CITA SE COMPRUEBA.
 * ================================================================
 *
 * `cita` es un fragmento **exacto** del texto de `notaDeRichter`, y
 * `npm run curadas` verifica por `string match` que aparezca tal cual. Es el
 * mismo mecanismo que D-082 usa con las citas del modelo, y por la misma razon:
 * la tesis del proyecto no admite texto atribuido a una fuente sin comprobar
 * que la fuente lo diga. Hace falta porque las notas de Richter son largas y
 * mezclan asuntos —la del vegetarianismo sigue con los canibales de Vespucci—,
 * asi que se muestra la oracion que responde y se enlaza la nota entera.
 *
 * `notaDeRichter: null` es una posicion honesta, no una tarea pendiente: hay
 * casos donde el corpus no cubre el tema Y Richter tampoco comenta el silencio.
 * Ahi Leonardo se abstiene sin evidencia que mostrar. Inventar la nota seria
 * exactamente lo que este proyecto existe para no hacer.
 */
export interface CasoCurado {
  caso: string;
  patrones: RegExp[];
  notaDeRichter: string | null;
  /** Fragmento exacto de la nota. Verificado por `npm run curadas`. */
  cita?: string;
  /**
   * Preguntas que este caso DEBE atrapar. No es documentacion: `npm run curadas`
   * comprueba que cada una caiga en ESTE caso y no en otro.
   *
   * Existe porque el eval set no cubre toda pregunta plausible de un visitante
   * —no tiene ninguna sobre la madre de Leonardo, y la nota de Richter que dice
   * «Leonardo never mentions her in the Manuscripts» es de las mejores que hay—.
   * Sin esto, la unica forma de validar un patron era que el eval set ya lo
   * contemplara, que es pedirle al instrumento que prediga el trafico real.
   */
  ejemplos: string[];
}

/**
 * QUE NO ESTA ACA, Y POR QUE. D-027 propuso seis ejemplos; medidos contra el
 * corpus real, **dos estaban equivocados**:
 *
 *   - **Salai** tiene 16 chunks de Leonardo (cartas al gobernador de Milan, el
 *     viaje a Roma de 1513).
 *   - **La Ultima Cena** tiene tres: R-665, R-666 y R-667, «Notes on the Last
 *     Supper», con los apostoles uno por uno.
 *
 * Curarlos habria convertido dos preguntas que el corpus SI contesta en
 * abstenciones automaticas. D-027 se escribio antes de que el corpus existiera
 * y listaba lo que uno supone famoso-y-ausente; la lista definitiva se mide.
 */
export const LISTA_CURADA: CasoCurado[] = [
  {
    caso: "mona_lisa",
    patrones: [/mona\s*lisa/i, /gioconda/i, /joconde/i],
    notaDeRichter: "intro-R663-5",
    cita: "no sketches are known for the portrait of \"Mona Lisa\", nor do the MS. notes ever allude to it",
    ejemplos: ["¿Cuánto tiempo te llevó pintar la Mona Lisa?", "How long did it take you to paint the Mona Lisa?",
               "¿Quién fue la Gioconda?"],
  },
  {
    caso: "vegetarianismo",
    patrones: [/vegetarian/i, /com[íi]as?\s+carne/i, /eat(ing)?\s+meat/i, /dieta/i],
    notaDeRichter: "fn-R988-1",
    cita: "We are led to believe that Leonardo himself was a vegetarian",
    ejemplos: ["¿Es cierto que eras vegetariano?", "Is it true that you were a vegetarian?",
               "¿Comías carne?"],
  },
  {
    caso: "obras_sin_terminar",
    patrones: [/sin\s+termin/i, /inacabad/i, /unfinished/i, /left.{0,20}incomplete/i],
    notaDeRichter: "fn-R745-0-1",
    cita: "in the absence of all allusion to it in the MSS",
    ejemplos: ["¿Por qué dejaste tantas obras sin terminar?", "Why did you leave so many works unfinished?"],
  },
  {
    caso: "madre_y_familia",
    patrones: [/tu\s+madre/i, /your\s+mother/i, /Caterina/i, /tu\s+familia/i, /your\s+family/i,
               /tus?\s+padres/i, /hijo\s+(natural|ileg[íi]timo)/i],
    notaDeRichter: "fn-R1566-65",
    cita: "Leonardo never mentions her in the Manuscripts",
    ejemplos: ["¿Quién era tu madre?", "Who was your mother?", "¿Cómo era tu familia?"],
  },
  {
    caso: "muerte",
    patrones: [/c[óo]mo\s+(fue\s+tu\s+muerte|moriste)/i, /tu\s+muerte/i,
               /how\s+did\s+you\s+die/i, /your\s+death/i, /cu[áa]ndo\s+moriste/i],
    notaDeRichter: "fn-R1566-138",
    cita: "Fr. Melzi, writing from Amboise, announces Leonardo's death",
    ejemplos: ["¿Cómo fue tu muerte?", "How did you die?", "¿Cuándo moriste?"],
  },
  /**
   * De aca abajo, sin nota: el corpus no los cubre y Richter tampoco comenta el
   * silencio. Se curan igual porque **se colaban por el gate** (medido) y una
   * abstencion honesta es mejor que una respuesta armada con pasajes ajenos.
   */
  {
    caso: "miguel_angel",
    // D-027 lo midio: 0 menciones en Leonardo. Las 3 de Richter son sobre la
    // cupula de San Pedro y el David, no sobre la relacion entre los dos.
    patrones: [/miguel\s*[áa]ngel/i, /michel\s*angelo/i, /michelangelo/i, /buonarroti/i],
    notaDeRichter: null,
    ejemplos: ["¿Cómo era tu relación con Miguel Ángel?", "What was your relationship with Michelangelo like?"],
  },
  {
    caso: "aspecto_fisico",
    patrones: [/c[óo]mo\s+eras\s+f[íi]sicamente/i, /tu\s+aspecto/i, /what\s+did\s+you\s+look\s+like/i,
               /tu\s+apariencia/i, /your\s+appearance/i],
    notaDeRichter: null,
    ejemplos: ["¿Cómo eras físicamente?", "What did you look like?"],
  },
  {
    caso: "maestro_y_formacion",
    /**
     * OJO CON EL SOLAPAMIENTO. «¿Dónde y con quién aprendiste a pintar?» es
     * biografia y no esta en el corpus; **«¿Cómo se aprende a pintar?» es una de
     * las preguntas de portada y el corpus la contesta muy bien** (R-483 a
     * R-497, «The course of instruction for an artist»).
     *
     * Por eso los patrones exigen la forma personal —«aprendiste», «did you
     * learn»— y nunca la impersonal. `npm run curadas` lo comprueba: falla si
     * algun patron matchea una pregunta de portada o un caso `in_corpus`.
     */
    patrones: [/Verrocchio/i, /tu\s+maestro/i, /your\s+master/i,
               /(d[óo]nde|con\s+qui[ée]n).{0,30}aprendiste/i, /where.{0,30}did\s+you\s+learn/i],
    notaDeRichter: null,
    ejemplos: ["¿Qué aprendiste de Verrocchio, tu maestro?", "What did you learn from Verrocchio, your master?",
               "¿Dónde y con quién aprendiste a pintar?", "Where and with whom did you learn to paint?"],
  },
  {
    caso: "escritura_especular",
    patrones: [/de\s+derecha\s+a\s+izquierda/i, /right\s+to\s+left/i,
               /escritura\s+especular/i, /mirror\s+writ/i, /al\s+rev[ée]s/i],
    notaDeRichter: null,
    ejemplos: ["¿Por qué escribías de derecha a izquierda?", "Why did you write from right to left?"],
  },
];

export function capaCurada(consulta: string): CasoCurado | null {
  return LISTA_CURADA.find((c) => c.patrones.some((p) => p.test(consulta))) ?? null;
}

/**
 * El gate completo. Devuelve la decision y la evidencia que la sostiene, para
 * que el llamador pueda mostrarla: la verificabilidad es la tesis del producto.
 */
export function decidir(
  corpus: Corpus,
  umbrales: Umbrales,
  consulta: string,
  vector: Float32Array,
  idioma: Idioma,
  k = 3,
): Decision {
  const curado = capaCurada(consulta);
  if (curado) {
    const nota = curado.notaDeRichter
      ? corpus.chunks
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.id === curado.notaDeRichter)
          .map(({ c, i }) => ({ chunk: c, cos: 1, rankDenso: 1, rankBm25: null, rrf: 1 }))
      : [];
    return { tipo: "curada", caso: curado.caso, nota, cita: curado.cita ?? null };
  }

  const tau = umbrales.tau[idioma];
  const { cosMax, top } = corpus.buscar(vector, consulta, "leonardo", k);

  if (cosMax < tau) {
    /**
     * NO SE BUSCA EVIDENCIA. Ver D-110, que anula esta parte de D-042.
     *
     * Hasta acá, al abstenerse se recuperaba la nota de Richter más cercana y se
     * mostraba como «evidencia de ausencia». **Medido sobre 23 consultas que se
     * abstienen, la nota más cercana casi nunca prueba nada**, y el coseno no
     * distingue las que sí de las que no: la de coseno más alto (0,8386) es
     * «In the original MS. no explanatory text is placed after this title-line»,
     * «¿Conocés la penicilina?» traía «Mongibello is a name commonly given in
     * Sicily to Mount Etna», y tres consultas sin relación compartían el mismo
     * chunk imán. Restringir a los 49 chunks marcados `absence` da lo mismo:
     * cuatro consultas distintas caen en «the windows of the Palazzo del
     * Podestà» por matchear «windows».
     *
     * Y no es inútil sino PEOR QUE INÚTIL. «¿Qué opinás de la fotografía?» traía
     * «Photographs of this page have been published by BRAUN», que se lee como si
     * los cuadernos hablaran de fotografía. **Presentar algo como respaldo cuando
     * no lo es es exactamente lo que este proyecto existe para no hacer** — la
     * misma falla que las citas inventadas, en el canal de al lado.
     *
     * El ejemplo que fundó la idea ya ni siquiera se dispara: «What did you think
     * of Michelangelo as a rival?» hoy pasa el gate y responde.
     *
     * La evidencia de ausencia SIGUE EXISTIENDO donde puede ser verdadera: en la
     * capa 0, donde la nota está vinculada a mano y verificada caso por caso
     * (D-027, D-040). Ahí es un dato; acá era el vecino más cercano disfrazado.
     */
    return { tipo: "abstiene", cosMax, tau, evidencia: [] };
  }

  return { tipo: "responde", cosMax, tau, pasajes: top, notas: corpus.notasDe(top) };
}
