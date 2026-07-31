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

import { readFileSync } from "node:fs";
import { Corpus, Recuperado, Voz } from "./retrieval.js";

export type Idioma = "es" | "en";

export type Decision =
  | { tipo: "curada"; caso: string; nota: Recuperado[] }
  | { tipo: "abstiene"; cosMax: number; tau: number; evidencia: Recuperado[] }
  | { tipo: "responde"; cosMax: number; tau: number; pasajes: Recuperado[]; notas: unknown[] };

interface Umbrales {
  provisional: boolean;
  tau: Record<Idioma, number>;
  puntosDeOperacion: Record<Idioma, Record<string, number>>;
}

export function cargarUmbrales(dir: URL): Umbrales {
  return JSON.parse(readFileSync(new URL("thresholds.json", dir), "utf8"));
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
    // No se pasa el pre-filtro: se busca SOLO en el indice de Richter, porque
    // es el material que fundamenta una abstencion (D-042). Encontrado por
    // accidente en el experimento: «What did you think of Michelangelo as a
    // rival?» recupero sola la nota que prueba la ausencia.
    const { top: evidencia } = corpus.buscar(vector, consulta, "richter", 1);
    return { tipo: "abstiene", cosMax, tau, evidencia };
  }

  return { tipo: "responde", cosMax, tau, pasajes: top, notas: corpus.notasDe(top) };
}
