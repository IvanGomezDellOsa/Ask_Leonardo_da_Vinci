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
import { Corpus, Recuperado } from "./retrieval.js";

export type Idioma = "es" | "en";

export type Decision =
  | { tipo: "curada"; caso: string; nota: Recuperado[]; cita: string | null;
      /** La segunda voz, ya resuelta al idioma de la consulta. Ver D-239. */
      wikipedia: string | null }
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
  vectorContexto?: Float32Array,
): Decision {
  const { corpus, umbrales } = motor.por[idioma];
  return decidir(corpus, umbrales, consulta, vector, idioma, k, vectorContexto);
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
  /** Fragmento exacto de la nota, en inglés. Verificado por `npm run curadas`. */
  cita?: string;
  /**
   * El MISMO fragmento, en la traducción congelada (D-125). Verificado contra
   * `textoEs`, no contra `cita` traducida al vuelo — mismo principio que D-079:
   * el modelo (y el usuario) cita la traducción congelada, nunca una
   * improvisada. Si falta, D-125 no llegó a cubrir esa nota y el fallback es
   * mostrar `cita` en inglés (mejor una cita real en el idioma que no toca que
   * inventar una traducción sin congelar).
   */
  citaEs?: string;
  /**
   * ══════════════════════════════════════════════════════════════════
   * LA SEGUNDA VOZ: lo que los cuadernos no traen. Ver D-239.
   * ══════════════════════════════════════════════════════════════════
   *
   * Un fragmento **EXACTO** del artículo de Wikipedia congelado en
   * `public/biblioteca/wikipedia.json`, uno por idioma. `npm run curadas`
   * verifica por `string match` que aparezca tal cual, igual que hace con las
   * notas de Richter — y por la misma razón: la tesis del proyecto no admite
   * texto atribuido a una fuente sin comprobar que la fuente lo diga.
   *
   * ⚠ NO ES UNA LLAMADA EN VIVO NI UNA PARAFRASIS DEL MODELO. Las dos cosas
   * volverían a abrir la puerta por la que entra la invención. El artículo está
   * bajado, con su revisión fijada, y el fragmento está escrito a mano acá.
   *
   * ⚠ NO ES LEONARDO HABLANDO, y la interfaz tiene que dejarlo obvio. Leonardo
   * dice que no dejó anotación; **después** habla otra voz, con otro color y
   * su fuente al pie. Es el mismo patrón que ya existe con las notas de Richter
   * (D-027), extendido a lo biográfico.
   *
   * ⚠ CC BY-SA 4.0. La atribución no es cortesía: es la licencia. `CREDITO_WIKI`
   * viaja con cada respuesta y la interfaz lo muestra.
   */
  wikipedia?: { es: string; en: string };
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
/**
 * LA ATRIBUCION DE WIKIPEDIA. CC BY-SA 4.0 la exige; no es cortesía.
 *
 * Sale tal cual de `public/biblioteca/wikipedia.json`, que guarda el número de
 * revisión y la fecha de consulta: la cita es a UNA versión del artículo, no a
 * «Wikipedia» en abstracto — que mañana dice otra cosa. Ver D-239.
 */
/** ⚠ La clave es `credito`, NO `texto`: `texto` es el fragmento citado y el
 *  ensamblado en la ruta hace `{ texto, ...CREDITO_WIKI[idioma] }`. Con el
 *  mismo nombre, el spread pisaba la cita con la línea de crédito. */
export const CREDITO_WIKI: Record<Idioma, { credito: string; url: string; licencia: string; licenciaUrl: string }> = {
  es: {
    credito: "«Leonardo da Vinci», Wikipedia, la enciclopedia libre. Texto de sus colaboradores, revisión 172338859, consultada el 2026-08-21.",
    url: "https://es.wikipedia.org/wiki/Leonardo_da_Vinci",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.es",
  },
  en: {
    credito: "“Leonardo da Vinci”, Wikipedia, the free encyclopedia. Text by its contributors, revision 1370412865, retrieved 2026-08-21.",
    url: "https://en.wikipedia.org/wiki/Leonardo_da_Vinci",
    licencia: "CC BY-SA 4.0",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
  },
};

export const LISTA_CURADA: CasoCurado[] = [
  {
    caso: "mona_lisa",
    patrones: [/mona\s*lisa/i, /gioconda/i, /joconde/i],
    notaDeRichter: "intro-R663-5",
    cita: "no sketches are known for the portrait of \"Mona Lisa\", nor do the MS. notes ever allude to it",
    citaEs: "no se conocen bocetos para el retrato de \"Mona Lisa\", ni las notas del MS. aluden jamás a él",
    ejemplos: ["¿Cuánto tiempo te llevó pintar la Mona Lisa?", "How long did it take you to paint the Mona Lisa?",
               "¿Quién fue la Gioconda?"],
  },
  {
    caso: "vegetarianismo",
    patrones: [/vegetarian/i, /com[íi]as?\s+carne/i, /eat(ing)?\s+meat/i, /dieta/i],
    notaDeRichter: "fn-R988-1",
    cita: "We are led to believe that Leonardo himself was a vegetarian",
    citaEs: "Se nos lleva a creer que el propio Leonardo era vegetariano",
    ejemplos: ["¿Es cierto que eras vegetariano?", "Is it true that you were a vegetarian?",
               "¿Comías carne?"],
  },
  {
    caso: "obras_sin_terminar",
    patrones: [/sin\s+termin/i, /inacabad/i, /unfinished/i, /left.{0,20}incomplete/i],
    notaDeRichter: "fn-R745-0-1",
    cita: "in the absence of all allusion to it in the MSS",
    citaEs: "en ausencia de toda alusión a él en los manuscritos",
    ejemplos: ["¿Por qué dejaste tantas obras sin terminar?", "Why did you leave so many works unfinished?"],
  },
  {
    caso: "madre_y_familia",
    patrones: [/tu\s+madre/i, /your\s+mother/i, /Caterina/i, /tu\s+familia/i, /your\s+family/i,
               /tus?\s+padres/i, /hijo\s+(natural|ileg[íi]timo)/i],
    notaDeRichter: "fn-R1566-65",
    cita: "Leonardo never mentions her in the Manuscripts",
    citaEs: "Leonardo nunca la menciona en los Manuscritos",
    ejemplos: ["¿Quién era tu madre?", "Who was your mother?", "¿Cómo era tu familia?"],
  },
  {
    caso: "muerte",
    patrones: [/c[óo]mo\s+(fue\s+tu\s+muerte|moriste)/i, /tu\s+muerte/i,
               /how\s+did\s+you\s+die/i, /your\s+death/i, /cu[áa]ndo\s+moriste/i],
    notaDeRichter: "fn-R1566-138",
    cita: "Fr. Melzi, writing from Amboise, announces Leonardo's death",
    citaEs: "Fr. Melzi, escribiendo desde Amboise, anuncia la muerte de Leonardo",
    wikipedia: {
      es: "Murió el 2 de mayo de 1519, en Cloux, a la edad de 67 años.",
      en: "Leonardo died at Clos Lucé on 2 May 1519 at the age of 67, possibly of a stroke.",
    },
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
    wikipedia: {
      es: "a partir de 1469, Leonardo entró como aprendiz a uno de los talleres de arte más prestigiosos bajo Andrea del Verrocchio",
      en: "Around the age of 14, he became a garzone (studio boy) in the workshop of Andrea del Verrocchio, who was the leading Florentine painter and sculptor of his time.",
    },
    ejemplos: ["¿Qué aprendiste de Verrocchio, tu maestro?", "What did you learn from Verrocchio, your master?",
               "¿Dónde y con quién aprendiste a pintar?", "Where and with whom did you learn to paint?"],
  },
  {
    caso: "escritura_especular",
    /** «¿Sos zurdo?» entra acá y no en un caso propio: en el artículo las dos cosas son UNA sola frase. */
    patrones: [/de\s+derecha\s+a\s+izquierda/i, /right\s+to\s+left/i,
               /escritura\s+especular/i, /mirror\s+writ/i, /al\s+rev[ée]s/i,
               /\bzurd[oa]\b/i, /left[\s-]?hand(ed)?\b/i],
    notaDeRichter: null,
    wikipedia: {
      es: "Era zurdo, lo que explicaría la utilización que hacía de la escritura especular.",
      en: "Since Leonardo wrote with his left hand, it was probably easier for him to write from right to left.",
    },
    ejemplos: ["¿Por qué escribías de derecha a izquierda?", "Why did you write from right to left?",
               "¿Sos zurdo?", "are you left-handed?"],
  },
  /**
   * ══════════════════════════════════════════════════════════════════
   * LOS TRES DE ABAJO SALIERON DE UNA MEDICION, NO DE UNA SUPOSICION.
   * ══════════════════════════════════════════════════════════════════
   *
   * D-236 agrego 50 preguntas escritas como tipea una persona y midio el gate
   * sobre ellas. La categoria F del banco viejo daba 20 de 20 —**porque la capa
   * curada la cubre**— pero las mismas preguntas en ropa de calle se colaban:
   *
   *   H-03  «que dia naciste?»        se colaba en los DOS idiomas
   *   H-15  «cuantos años tenes?»      se colaba en los DOS idiomas
   *   H-04  «cual es tu cuadro favorito?» se colaba en los DOS idiomas
   *
   * «¿Qué día naciste?» es, ademas, el ejemplo exacto que el dueño dio cuando
   * pidio la segunda voz. El corpus tiene notas fechadas —«Notas con fechas
   * (1369-1378)»— y el retrieval las traia como si contestaran: pasajes reales,
   * respuesta engañosa.
   */
  {
    caso: "nacimiento",
    patrones: [/qu[ée]\s+d[íi]a\s+naciste/i, /cu[áa]ndo\s+naciste/i, /d[óo]nde\s+naciste/i,
               /tu\s+nacimiento/i, /when\s+were\s+you\s+born/i, /where\s+were\s+you\s+born/i,
               /what\s+day\s+were\s+you\s+born/i, /your\s+birth(day|place)?\b/i,
               /cu[áa]ntos\s+a[ñn]os\s+ten[ée]s/i, /cu[áa]ntos\s+a[ñn]os\s+tienes/i,
               /how\s+old\s+are\s+you/i],
    notaDeRichter: null,
    wikipedia: {
      es: "Leonardo di ser Piero da Vinci (Vinci, 15 de abril de 1452-Amboise, 2 de mayo de 1519)",
      en: "Leonardo di ser Piero da Vinci (15 April 1452 – 2 May 1519) was an Italian polymath of the High Renaissance",
    },
    ejemplos: ["¿Qué día naciste?", "what day were you born?", "¿Cuántos años tenés?",
               "how old are you?", "¿Dónde naciste?"],
  },
  {
    caso: "obras_conocidas",
    /**
     * ⚠ NO ATRAPA «¿Por qué la pintura es superior a las demás artes?», que es una
     * pregunta de portada y el corpus contesta muy bien. Los patrones exigen la
     * forma posesiva —«tu cuadro», «your painting»— o la palabra «favorito».
     */
    patrones: [/tu\s+(cuadro|pintura|obra|dibujo)\s+(favorit|preferid|m[áa]s\s+conocid)/i,
               /your\s+(favou?rite|best.known)\s+(painting|work|picture|drawing)/i,
               /cu[áa]l\s+es\s+tu\s+(cuadro|obra|pintura)/i,
               /qu[ée]\s+obras?\s+pintaste/i, /what\s+(paintings?|works?)\s+did\s+you\s+paint/i],
    notaDeRichter: null,
    wikipedia: {
      es: "Dos de sus obras más conocidas, La Gioconda y La Última Cena, han sido copiadas y parodiadas en varias ocasiones",
      en: "The Mona Lisa is his best known work and is regarded as the world's most famous individual painting.",
    },
    ejemplos: ["¿Cuál es tu cuadro favorito?", "what is your favourite painting?",
               "¿Qué obras pintaste?"],
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
  /**
   * EL CONTEXTO RECUPERA, NUNCA DECIDE. Ver D-197.
   *
   * Cuando la consulta no se sostiene sola —«¿y por qué?»— el llamador embebe la
   * pregunta anterior pegada adelante y manda ese vector acá. **Sólo elige qué
   * pasajes van al prompt**: quien se compara contra τ sigue siendo el coseno de
   * `vector`, el de la consulta sola.
   *
   * ⚠ NO UMBRALIZAR ESTE COSENO. Medido en `npm run evals:multiturno` sobre los
   * 120 casos como segundo turno: si el gate mira el vector con contexto, hereda
   * el coseno del turno anterior y aparecen **16 filtraciones nuevas**. Con esta
   * separación son 0, y el conteo de filtraciones queda idéntico al de siempre.
   */
  vectorContexto?: Float32Array,
): Decision {
  const curado = capaCurada(consulta);
  if (curado) {
    const nota = curado.notaDeRichter
      ? corpus.chunks
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.id === curado.notaDeRichter)
          .map(({ c }) => ({ chunk: c, cos: 1, rankDenso: 1, rankBm25: null, rrf: 1 }))
      : [];
    /**
     * LA CITA EN EL IDIOMA DE LA CONSULTA (D-125). `citaEs` viaja verificada
     * contra la traduccion congelada (`npm run curadas`); si falta —D-125 no
     * llego a cubrir esa nota— se cae al ingles en vez de traducir al vuelo,
     * mismo criterio que D-079 con el resto del corpus.
     */
    const cita = (idioma === "es" && curado.citaEs) ? curado.citaEs : (curado.cita ?? null);
    /**
     * LA SEGUNDA VOZ, EN EL IDIOMA DE LA CONSULTA. Ver D-239. Los dos
     * fragmentos son de la Wikipedia de SU idioma —no una traducción del otro—:
     * el artículo castellano y el inglés no dicen lo mismo, y citar el inglés
     * traducido al vuelo sería exactamente el texto sin comprobar que este
     * proyecto no admite.
     */
    return { tipo: "curada", caso: curado.caso, nota, cita,
             wikipedia: curado.wikipedia ? curado.wikipedia[idioma] : null };
  }

  const tau = umbrales.tau[idioma];

  /**
   * CAPA 1a: SIN UNA SOLA PALABRA DEL CORPUS, NO HAY NADA QUE BUSCAR. Ver D-231.
   *
   * Va ANTES del coseno y no después, porque el coseno de una consulta sin tema
   * no es una medida floja: es ruido. «Hola» puntúa 0,8421 contra τ_es 0,8410,
   * **pasa**, y trae máximas sobre la muerte. Y no hay umbral que lo arregle:
   * «gracias» da 0,8517 y «¿cómo estás?» 0,8542, más alto que preguntas
   * legítimas. Las fáticas no forman una banda por debajo — están mezcladas.
   *
   * ⚠ ES OTRA DIMENSIÓN, NO OTRO UMBRAL. El gate mide *cuánto se parece*; esto
   * mide *si hay algo que comparar*. Es la lección que el proyecto lleva
   * repitiendo desde D-021: el ranking siempre pone algo en el primer puesto,
   * exista o no material pertinente.
   *
   * ⚠ NO ENUMERA SALUDOS. No hay lista de «hola/buenas/gracias»: se pregunta si
   * el corpus conoce alguna de las palabras. Por eso cubre el saludo que a nadie
   * se le ocurrió anotar, y por eso el dueño puede confiar en que no es un parche
   * —fue su propio pedido: «una solución sólida y no hardcodear».
   *
   * MEDIDO, CERO FALSOS POSITIVOS: de las 120 del banco, las únicas tres sin
   * ninguna ancla son anacronismos que deben abstenerse igual. Toda pregunta
   * contestable tiene al menos una; la mediana es 4.
   */
  /**
   * ⚠ NO SE APLICA A LAS REPREGUNTAS, y esto NO es una excepción cómoda: es la
   * definición misma de repregunta. «¿Y por qué?» no tiene anclas propias —por
   * eso el llamador le pasó un `vectorContexto`—, y sus anclas son las del turno
   * anterior. Sin esta salvedad la guarda mata el multiturno entero: medido,
   * `npm run evals:multiturno` reporta que **S4, la estrategia que corre en
   * producción, deja de cumplir su criterio** (D-197).
   *
   * Que `vectorContexto` esté es exactamente la señal correcta: el llamador ya
   * evaluó `esAutonoma()` y decidió que esta consulta no se sostiene sola.
   */
  if (!vectorContexto && corpus.anclas(consulta, idioma).length === 0) {
    return { tipo: "abstiene", cosMax: 0, tau, evidencia: [] };
  }

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

  /**
   * Recién acá entra el contexto, y con el TEXTO de la consulta del turno: así
   * BM25 puntúa con los términos de lo que se acaba de preguntar y no con los
   * del turno anterior. `cosMax` sigue siendo el que gobernó la decisión.
   */
  const pasajes = vectorContexto
    ? corpus.buscar(vectorContexto, consulta, "leonardo", k).top
    : top;
  return { tipo: "responde", cosMax, tau, pasajes, notas: corpus.notasDe(pasajes) };
}
