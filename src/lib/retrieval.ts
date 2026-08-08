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

import { readFileSync, existsSync } from "node:fs";

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
  /**
   * Para que sirve este texto. Lo pueblan dos fuentes distintas y no se pisan:
   * el pipeline marca `apparatus` / `substantive` / `absence` sobre las unidades
   * de Richter (D-053), y `tools/curar_corpus.ts` marca `inventory` sobre las de
   * Leonardo (D-098).
   */
  utility?: string;
  url: string | null;
  nWords: number;
  /**
   * Traduccion al castellano, de `artifacts/chunks_es.json`. Ver D-079.
   *
   * NO participa de la recuperacion: los embeddings y el BM25 siguen siendo los
   * del ingles, asi que buscar da exactamente lo mismo que antes. Esto es solo
   * el texto que se le MUESTRA al modelo y al lector cuando la consulta es en
   * castellano, para que pueda CITAR en vez de traducir al vuelo.
   */
  textoEs?: string;
  tituloEs?: string | null;
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

/** Valores de `utility` que salen del indice de recuperacion. Ver D-098 y D-108. */
const FUERA_DEL_INDICE = new Set(["inventory", "no_traducible"]);

export class Corpus {
  readonly meta: IndexMeta;
  readonly chunks: Chunk[];
  private readonly vecs: Float32Array;   // count * dims, ya renormalizado
  private readonly bm25: Bm25Artefacto;
  private readonly stop: Set<string>;
  /** Indices de fila por voz, para poder buscar en un solo indice (D-042). */
  readonly filasPorVoz: Record<Voz, number[]>;

  /**
   * `curar` saca del indice de recuperacion los chunks que la curaduria marco
   * como `inventory` (D-098). Se deja como opcion, y no como un artefacto
   * distinto, para que el eval pueda correr las DOS ramas en un solo proceso y
   * con los mismos vectores de consulta: comparar dos corridas separadas es
   * como se colaron antes dos cambios a la vez.
   */
  constructor(dir: URL, { curar = true, base = dir }: { curar?: boolean; base?: URL } = {}) {
    /**
     * `dir` trae lo que es PROPIO del indice —los vectores y su meta— y `base`
     * lo que es COMPARTIDO entre indices: el corpus, la traduccion, el BM25 y la
     * curaduria. El indice castellano de D-105 vive en `artifacts/es/` y no
     * necesita su propia copia de `chunks.json`: son 3,4 MB que ademas
     * divergirian del original en cuanto alguien regenere uno solo de los dos.
     *
     * Es la misma regla que todo lo demas del proyecto: una definicion
     * compartida, no una copia por consumidor.
     */
    this.meta = JSON.parse(readFileSync(new URL("index_meta.json", dir), "utf8"));
    this.chunks = JSON.parse(readFileSync(new URL("chunks.json", base), "utf8"));
    /**
     * La traduccion es OPCIONAL: si el artefacto no esta, todo funciona como
     * antes y en ingles. Asi el pipeline no se rompe en un clon recien hecho ni
     * antes de correr `npm run traducir`.
     */
    const fEs = new URL("chunks_es.json", base);
    if (existsSync(fEs)) {
      const es: Record<string, { texto: string; titulo: string | null }> =
        JSON.parse(readFileSync(fEs, "utf8"));
      for (const c of this.chunks) {
        const t = es[c.id];
        if (t) { c.textoEs = t.texto; c.tituloEs = t.titulo; }
      }
    }
    this.bm25 = JSON.parse(readFileSync(new URL("bm25.json", base), "utf8"));
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

    /**
     * La curaduria es OPCIONAL, igual que la traduccion: sin el artefacto todo
     * funciona como antes. Ver `tools/curar_corpus.ts` y D-098.
     *
     * Se marca el chunk SIEMPRE que el artefacto este, incluso con `curar` en
     * false, porque `utility` es un dato del corpus y no una decision de
     * busqueda. Lo que la opcion gobierna es solo si esa fila entra al indice.
     */
    const fCur = new URL("curaduria.json", base);
    if (existsSync(fCur)) {
      const { chunks: fichas }: { chunks: Record<string, { utility: string }> } =
        JSON.parse(readFileSync(fCur, "utf8"));
      for (const c of this.chunks) {
        const f = fichas[c.id];
        if (f) c.utility = f.utility;
      }
    }

    /**
     * El unico lugar donde la exclusion tiene efecto. Sacar la fila de aca la
     * saca del coseno, del BM25 y del top-k de una sola vez, porque `buscar`
     * arranca de `filasPorVoz` — y de paso baja el `cosMax` que umbraliza el
     * gate, que es exactamente lo que se quiere para las consultas fuera de
     * corpus.
     *
     * Ojo con la consecuencia, que es matematica y conviene tenerla escrita:
     * sacar filas solo puede BAJAR el `cosMax`. Asi que la curaduria nunca puede
     * agregar filtraciones al gate, y solo puede agregar abstenciones. El costo
     * esta acotado por construccion y es el unico numero que hay que vigilar.
     */
    this.filasPorVoz = { leonardo: [], richter: [] };
    this.meta.voice.forEach((v, i) => {
      // Dos clases distintas, un solo mecanismo: inventarios de Leonardo que no
      // contestan nada (D-098) y aparato de Richter en otro idioma que no puede
      // servir de evidencia mostrable (D-108).
      if (curar && FUERA_DEL_INDICE.has(this.chunks[i].utility ?? "")) return;
      this.filasPorVoz[v].push(i);
    });
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

  /**
   * Se despojan los acentos ANTES de partir en tokens. Sin eso la regex
   * `[a-z]...` no matchea vocales acentuadas ni ñ, y una consulta castellana se
   * fragmentaba: "cómo" -> "c" + "mo", metiendo el token basura "mo" en el
   * indice invertido ingles y perturbando el orden de RRF con coincidencias sin
   * sentido. El corpus es ingles, asi que BM25 aporta poco cross-lingue por
   * construccion —solo nombres propios compartidos: "Milan", "Ludovico"—, pero
   * una cosa es aportar poco y otra aportar ruido.
   *
   * El indice BM25 esta precomputado con la version anterior; para texto ingles
   * el despojo es practicamente identidad, asi que el efecto real es del lado de
   * la consulta, que es donde estaba el defecto.
   */
  tokenizar(texto: string): string[] {
    const plano = texto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return (plano.match(/[a-z][a-z'\-]*/g) ?? [])
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

/**
 * Los rangos de numeros de Richter que trae una etiqueta entre parentesis y al
 * final: "(19-20, 40-50)", "(507-508, 585)", "(1120-1131)".
 *
 * VIVE ACA, Y NO EN CADA CONSUMIDOR, a proposito. La escriben dos fuentes
 * distintas —`expected_topic` en `dataset.jsonl` y las entradas del indice de
 * contenidos en `medir_sugeridas.ts`— y la leen el recall de la categoria B y la
 * validacion de las preguntas sugeridas. Son cuatro lugares donde podria haber
 * cuatro copias que se separan en silencio, que es exactamente como dos copias
 * de `palabras()` reportaron 41,7% de citas inventadas donde habia 0%.
 */
export function rangosDeRichter(etiqueta: string): [number, number][] {
  const par = etiqueta.match(/\(([^)]*)\)\s*$/);
  if (!par) return [];
  const out: [number, number][] = [];
  for (const item of par[1].split(",")) {
    const t = item.trim();
    const m = t.match(/^(\d+)\s*[-—]\s*(\d+)$/) ?? t.match(/^(\d+)$/);
    if (m) out.push([Number(m[1]), Number(m[2] ?? m[1])]);
  }
  return out;
}

/** Si alguno de los numeros cae dentro de alguno de los rangos. */
export const caeEnRangos = (nums: number[], rangos: [number, number][]): boolean =>
  nums.some((n) => rangos.some(([a, b]) => n >= a && n <= b));

/** Recorta un pasaje a ~200 palabras. Es presupuesto de capacidad (D-020, D-023). */
export function recortar(texto: string, maxPalabras = 200): string {
  const p = texto.split(/\s+/);
  return p.length <= maxPalabras ? texto : p.slice(0, maxPalabras).join(" ") + " […]";
}
