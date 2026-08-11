/**
 * El extractor de embeddings, en un solo lugar. Ver D-116, D-117, D-126.
 *
 * POR QUE EXISTE. Trece archivos —evals, tools, la ruta del chat no, esa no
 * embebe (D-118)— llamaban `pipeline("feature-extraction", modelo)` cada uno
 * por su cuenta, SIN especificar `dtype`. En Node eso carga fp32. Y desde
 * D-116 se sabe que **consulta e índice tienen que hablar el mismo idioma**:
 * un query fp32 contra un índice q8 (o al revés) cambia el top-3 en 70 de 120
 * casos y mueve 6 decisiones del gate. Trece copias de la misma llamada eran
 * trece oportunidades de que una quedara desincronizada del dtype real del
 * índice — el mismo patrón que D-113 (`responder`), D-089 (`proveedorPorId`)
 * y D-122 (`varianteVigente`) ya sacaron de otros rincones del proyecto.
 *
 * `DTYPE_PRODUCCION` ES LA UNICA FUENTE DE VERDAD sobre qué pesos usa el
 * índice que se sirve. `tools/indexar.ts` lo lee para el default de `--dtype`;
 * todo lo que mide contra el índice real lo lee para embeber sus consultas.
 * Cambiar la producción de dtype es cambiar UNA línea, no auditar trece
 * archivos preguntándose cuáles se actualizaron.
 *
 * POR QUE q8 Y NO fp32 (D-126). D-118 cerró 19-bis: el embedding sigue en el
 * navegador. Un navegador que carga `Xenova/multilingual-e5-small` con
 * Transformers.js **baja los pesos cuantizados por defecto** — es lo que D-097
 * midió como el payload real de 129 MB (`model_quantized.onnx`). O sea que la
 * consulta de un usuario real siempre va a ser q8. Si el índice de producción
 * se queda en fp32 —que es lo que media este archivo hasta D-126—, CADA
 * consulta real de un navegador es el par desparejado que D-116 midió como
 * dañino, y nadie lo iba a notar porque no rompe: sólo degrada el top-3 en
 * silencio. D-117 ya había medido que el par q8 emparejado es igual o mejor
 * que fp32 y dejó dicho que el cambio iba "junto con la decisión de dónde se
 * embebe, no antes" — la decisión ya está (D-118), así que el cambio toca.
 *
 * `check_parity.ts` NO USA ESTO A PROPOSITO. Mide si Transformers.js reproduce
 * los vectores de referencia de `sentence-transformers` en Python, que se
 * generaron en fp32 (D-022): cambiarle el dtype mediría otra cosa que lo que
 * el archivo dice medir.
 */

import { pipeline, type ProgressCallback } from "@huggingface/transformers";

export type Dtype = "fp32" | "q8";

/** El dtype que sirve `artifacts/index.bin` y `artifacts/es/index.bin` hoy. */
export const DTYPE_PRODUCCION: Dtype = "q8";

export const MODELO_PRODUCCION = "Xenova/multilingual-e5-small";

/**
 * Sin anotar el tipo de retorno a proposito: `pipeline(...)` devuelve un tipo
 * condicional sobre el literal de tarea (`AllTasks["feature-extraction"]`) que
 * explota en "union type too complex" apenas se lo compara estructuralmente
 * contra una anotacion independiente. Dejando que TS infiera, el llamador sigue
 * viendo el mismo tipo callable que si hubiera llamado a `pipeline` directo.
 *
 * `progressCallback` es opcional y no lo usa ningun consumidor de Node (evals,
 * tools): ahi la carga es instantanea, desde disco. Existe para
 * `useEmbedder.ts` (D-127), que SI necesita reportar progreso de una descarga
 * real de ~133 MB.
 */
export async function cargarExtractor(
  dtype: Dtype = DTYPE_PRODUCCION, modelo = MODELO_PRODUCCION, progressCallback?: ProgressCallback,
) {
  return pipeline("feature-extraction", modelo, { dtype, progress_callback: progressCallback });
}

/** `query: <texto>` embebido y normalizado — la forma que `Corpus.buscar` espera. */
export async function embeberConsulta(
  extractor: Awaited<ReturnType<typeof cargarExtractor>>, texto: string,
): Promise<Float32Array> {
  const s = await extractor("query: " + texto, { pooling: "mean", normalize: true });
  return s.data as Float32Array;
}
