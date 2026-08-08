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
  | { tipo: "curada"; caso: string; nota: Recuperado[] }
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
 * Capa 0. Los ~15 casos de D-027 se resuelven por regla explicita ANTES del
 * retrieval: son las preguntas de entrada mas probables y el corpus no las
 * cubre. Medido: `obra famosa` + `biografia` son el 40% de las consultas fuera
 * de corpus y el 62% de las filtraciones del gate (D-040).
 *
 * Se deja el esqueleto y una entrada real; las 15 se curan en la Fase 4 junto
 * con la nota de Richter que documenta cada silencio.
 */
export interface CasoCurado { caso: string; patrones: RegExp[]; notaDeRichter: string | null }

export const LISTA_CURADA: CasoCurado[] = [
  {
    caso: "mona_lisa",
    patrones: [/mona\s*lisa/i, /gioconda/i, /joconde/i],
    // La unica mencion en 1,4 MB, y es de Richter: "no sketches are known for
    // the portrait of 'Mona Lisa', nor do the MS. notes ever allude to it".
    notaDeRichter: "intro-R663-5",
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
    return { tipo: "curada", caso: curado.caso, nota };
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
