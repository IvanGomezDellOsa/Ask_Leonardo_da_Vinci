/**
 * Recuperacion hibrida: coseno denso + BM25, fusionados con RRF.
 *
 * REGLA DURA (D-021): el coseno denso PRE-FUSION es lo unico que se umbraliza.
 * RRF solo ORDENA el top-k que va al prompt. Un score de RRF no puede en
 * principio distinguir "dentro del corpus" de "fuera": siempre hay un documento
 * en rank 1, exista o no material pertinente. Y los scores de BM25 no son
 * comparables entre consultas — medido, "how should one study anatomy" (dentro)
 * puntua 8,94 y "what do you think about the Mona Lisa" (fuera) puntua 13,14
 * con un resultado basura.
 *
 * Escrito a mano, sin LangChain ni LlamaIndex (D-004).
 */

import { readFileSync } from "node:fs";

export type Voz = "leonardo" | "richter";

export interface Chunk {
  id: string;
  richterNo: number | null;
  richterNos: number[];
  richterTitle: string | null;
  section: string | null;
  subsection?: string | null;
  voice: Voz;
  text: string;
  annotatesPassage: number | null;
  utility?: string;
  url: string | null;
  nWords: number;
}

export interface Recuperado {
  chunk: Chunk;
  cos: number;
  rankDenso: number;
  rankBm25: number | null;
  rrf: number;
}

interface IndexMeta {
  model: string; dims: number; scale: number; count: number;
  queryPrefix: string; ids: string[]; voice: Voz[];
}

interface Bm25Artefacto {
  k1: number; b: number; docCount: number; avgDocLength: number;
  docLengths: number[]; ids: string[];
  idf: Record<string, number>;
  postings: Record<string, { docs: number[]; tfs: number[] }>;
  stopwords: string[];
}

const K_RRF = 60;

export class Corpus {
  readonly meta: IndexMeta;
  readonly chunks: Chunk[];
  private readonly vecs: Float32Array;   // count * dims, ya renormalizado
  private readonly bm25: Bm25Artefacto;
  private readonly stop: Set<string>;
  /** Indices de fila por voz, para poder buscar en un solo indice (D-042). */
  readonly filasPorVoz: Record<Voz, number[]>;

  constructor(dir: URL) {
    this.meta = JSON.parse(readFileSync(new URL("index_meta.json", dir), "utf8"));
    this.chunks = JSON.parse(readFileSync(new URL("chunks.json", dir), "utf8"));
    this.bm25 = JSON.parse(readFileSync(new URL("bm25.json", dir), "utf8"));
    this.stop = new Set(this.bm25.stopwords);

    // int8 -> float32 y renormalizacion, igual que en el pipeline. Sin
    // renormalizar, el redondeo deja las normas apenas fuera de 1 y el producto
    // punto deja de ser el coseno.
    const crudo = new Int8Array(readFileSync(new URL("index.bin", dir)).buffer);
    const { count, dims, scale } = this.meta;
    this.vecs = new Float32Array(count * dims);
    for (let i = 0; i < count; i++) {
      let norma = 0;
      for (let d = 0; d < dims; d++) {
        const v = crudo[i * dims + d] / scale;
        this.vecs[i * dims + d] = v;
        norma += v * v;
      }
      norma = Math.sqrt(norma) || 1;
      for (let d = 0; d < dims; d++) this.vecs[i * dims + d] /= norma;
    }

    this.filasPorVoz = { leonardo: [], richter: [] };
    this.meta.voice.forEach((v, i) => this.filasPorVoz[v].push(i));
  }

  /** Coseno de la consulta contra cada fila del subconjunto pedido. */
  cosenos(consulta: Float32Array, filas: number[]): { fila: number; cos: number }[] {
    const { dims } = this.meta;
    const out = new Array<{ fila: number; cos: number }>(filas.length);
    for (let k = 0; k < filas.length; k++) {
      const base = filas[k] * dims;
      let p = 0;
      for (let d = 0; d < dims; d++) p += consulta[d] * this.vecs[base + d];
      out[k] = { fila: filas[k], cos: p };
    }
    return out;
  }

  tokenizar(texto: string): string[] {
    return (texto.toLowerCase().match(/[a-z][a-z'\-]*/g) ?? [])
      .filter((t) => t.length > 1 && !this.stop.has(t));
  }

  /** BM25 sobre el indice precomputado. Solo para ordenar (D-021, D-030). */
  puntuarBm25(consulta: string, permitidas: Set<number>): Map<number, number> {
    const { k1, b, avgDocLength, docLengths } = this.bm25;
    const scores = new Map<number, number>();
    for (const termino of new Set(this.tokenizar(consulta))) {
      const post = this.bm25.postings[termino];
      if (!post) continue;
      const idf = this.bm25.idf[termino] ?? 0;
      for (let i = 0; i < post.docs.length; i++) {
        const doc = post.docs[i];
        if (!permitidas.has(doc)) continue;
        const tf = post.tfs[i];
        const norm = 1 - b + (b * docLengths[doc]) / avgDocLength;
        scores.set(doc, (scores.get(doc) ?? 0) + idf * ((tf * (k1 + 1)) / (tf + k1 * norm)));
      }
    }
    return scores;
  }

  /**
   * Devuelve el top-k ordenado por RRF y, aparte, el `cosMax` PRE-fusion, que
   * es el unico numero que el gate puede umbralizar.
   */
  buscar(consulta: Float32Array, texto: string, voz: Voz, k = 3): {
    cosMax: number; top: Recuperado[];
  } {
    const filas = this.filasPorVoz[voz];
    const densos = this.cosenos(consulta, filas).sort((a, b) => b.cos - a.cos);
    const cosMax = densos.length ? densos[0].cos : 0;

    const candidatos = densos.slice(0, 40);
    const permitidas = new Set(candidatos.map((c) => c.fila));
    const bm25 = [...this.puntuarBm25(texto, permitidas).entries()]
      .sort((a, b) => b[1] - a[1]);

    const rankDenso = new Map(candidatos.map((c, i) => [c.fila, i + 1]));
    const rankBm25 = new Map(bm25.map(([fila], i) => [fila, i + 1]));

    const fusion = candidatos.map(({ fila, cos }) => {
      const rd = rankDenso.get(fila)!;
      const rb = rankBm25.get(fila) ?? null;
      return {
        chunk: this.chunks[fila],
        cos,
        rankDenso: rd,
        rankBm25: rb,
        rrf: 1 / (K_RRF + rd) + (rb ? 1 / (K_RRF + rb) : 0),
      };
    });
    fusion.sort((a, b) => b.rrf - a.rrf);
    return { cosMax, top: fusion.slice(0, k) };
  }

  /** Las notas de Richter vinculadas a los pasajes recuperados (D-042). */
  notasDe(recuperados: Recuperado[]): Chunk[] {
    const nums = new Set(recuperados.flatMap((r) => r.chunk.richterNos));
    return this.chunks.filter(
      (c) => c.voice === "richter" && c.annotatesPassage !== null &&
             nums.has(c.annotatesPassage) && c.utility !== "apparatus");
  }
}

/** Recorta un pasaje a ~200 palabras. Es presupuesto de capacidad (D-020, D-023). */
export function recortar(texto: string, maxPalabras = 200): string {
  const p = texto.split(/\s+/);
  return p.length <= maxPalabras ? texto : p.slice(0, maxPalabras).join(" ") + " […]";
}
