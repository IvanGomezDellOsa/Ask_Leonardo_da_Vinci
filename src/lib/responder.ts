/**
 * Una respuesta completa: gate, generación y las tres garantías. Ver D-113.
 *
 * POR QUE EXISTE. Este bucle estaba escrito TRES VECES —`evals/run.ts`,
 * `tools/ask.ts` y `tools/precalcular.ts`— y las tres copias tenían que aplicar
 * exactamente las mismas reglas de D-082, D-083 y D-093 para que el número del
 * eval significara algo sobre el producto. **No es un refactor de prolijidad: es
 * la condición para que medir y servir sean lo mismo.**
 *
 * Ya había costado: `precalcular.ts` nació copiando el bucle del runner y se
 * trajo la generación **sin el limitador de ritmo**, que era lo que lo protegía
 * (D-112). Una copia trae lo que el código hace, no lo que lo defiende.
 *
 * QUE NO HACE, A PROPOSITO:
 *
 *   - **No embebe.** El vector entra por parámetro, porque quién lo calcula
 *     cambia según dónde corra: en el navegador con Transformers.js (D-022) o en
 *     Node en el eval. Meter el extractor acá ataría la librería a uno de los dos.
 *   - **No maneja cuota ni reintentos de red.** Eso es del llamador: el runner
 *     tiene `PresupuestoTpm` y tope de requests (D-086, D-089), el CLI no
 *     necesita nada y la caché sólo una pausa. Son políticas distintas sobre la
 *     misma operación.
 *   - **No decide si guardar.** `precalcular` se niega a congelar una respuesta
 *     con citas sin respaldo; el runner la guarda igual porque esconderla
 *     falsearía la tasa (D-112). Por eso `citasSinRespaldo` sale en el
 *     resultado y la decisión queda afuera.
 */

import type { Recuperado } from "./retrieval.js";
import { citasInvalidas, quitarComillasInvalidas, podarTrasDeclinar } from "./citas.js";
import { construirPrompt } from "./llm.js";
import { decidirCon, type Motor, type Idioma } from "./grounding.js";

export interface Generador {
  (system: string, messages: { role: string; content: string }[]):
    Promise<{ texto: string; tokensEntrada: number; tokensSalida: number }>;
}

export interface Respondido {
  decision: "curada" | "abstiene" | "responde";
  texto: string;
  /** Los pasajes recuperados, con su score. Vacío si no se respondió. */
  pasajes: Recuperado[];
  /**
   * LOS TEXTOS TAL COMO LOS VIO EL MODELO, en el idioma en que los vio. Ver
   * D-084: guardar los números de Richter no alcanza, porque 32 números viven en
   * más de un chunk y quien resolviera número→chunto después podría verificar
   * una cita contra la mitad del pasaje que el modelo nunca leyó.
   */
  textosVistos: string[];
  /** Ids de las notas de Richter vinculadas, para la interfaz. */
  notas: string[];
  cosMax: number | null;
  tau: number | null;
  reintentosCita: number;
  comillasQuitadas: number;
  podadas: number;
  /** Citas que siguen sin respaldo DESPUÉS de todo. El llamador decide qué hacer. */
  citasSinRespaldo: string[];
  tokensEntrada: number;
  tokensSalida: number;
}

const VACIO = {
  pasajes: [] as Recuperado[], textosVistos: [] as string[], notas: [] as string[],
  reintentosCita: 0, comillasQuitadas: 0, podadas: 0,
  citasSinRespaldo: [] as string[], tokensEntrada: 0, tokensSalida: 0,
};

export async function responder(opciones: {
  motor: Motor;
  pregunta: string;
  idioma: Idioma;
  /** `query: <pregunta>` embebido por el llamador. */
  vector: Float32Array;
  generar: Generador;
  k?: number;
  /** Reintentos ante cita fabricada. 2 es lo que midió D-082. */
  reintentos?: number;
}): Promise<Respondido> {
  const { motor, pregunta, idioma, vector, generar, k = 3, reintentos = 2 } = opciones;

  const d = decidirCon(motor, pregunta, vector, idioma, k);
  if (d.tipo === "curada") {
    return { ...VACIO, decision: "curada", texto: "", cosMax: null, tau: null,
             notas: d.nota.map((x) => x.chunk.id) };
  }
  if (d.tipo === "abstiene") {
    // D-110: no se busca evidencia. `evidencia` viene vacía por diseño.
    return { ...VACIO, decision: "abstiene", texto: "", cosMax: d.cosMax, tau: d.tau };
  }

  const pasajes = d.pasajes.map((p) => ({ ...p, chunk: { ...p.chunk } }));
  const textosVistos = pasajes.map(
    (p) => (idioma === "es" && p.chunk.textoEs) ? p.chunk.textoEs : p.chunk.text);
  const { system, messages } = construirPrompt(
    pregunta, pasajes.map((p) => p.chunk), [], idioma);

  /**
   * REINTENTO POR CITA FABRICADA (D-082). Tras tres rondas de reglas de prompt
   * la cita inventada seguía siendo el último modo de fallo. Comprobarla es un
   * `string match`, así que en vez de pedirle al modelo que no invente se
   * comprueba y se le pide de nuevo.
   */
  let r = await generar(system, messages);
  let reintentosCita = 0;
  for (let i = 0; i < reintentos; i++) {
    if (!r.texto || !citasInvalidas(r.texto, textosVistos).length) break;
    reintentosCita++;
    r = await generar(system, messages);
  }

  let comillasQuitadas = 0, podadas = 0, texto = r.texto ?? "";
  if (texto) {
    /**
     * Si tras los reintentos la cita sigue sin verificar, se le quitan las
     * comillas (D-083): el problema no es lo que dice sino que promete
     * literalidad, así que se elimina la promesa falsa y se conserva el texto.
     */
    const limpio = quitarComillasInvalidas(texto, textosVistos);
    comillasQuitadas = limpio.quitadas;
    /** Y se poda la continuación sin cita tras declinar (D-093). */
    const podado = podarTrasDeclinar(limpio.texto);
    podadas = podado.podadas;
    texto = podado.texto;
  }

  return {
    decision: "responde", texto, pasajes, textosVistos,
    // `notasDe` devuelve Chunk[], no Recuperado[]: se toma `id` directo.
    notas: (d.notas as { id: string }[]).map((x) => x.id),
    cosMax: d.cosMax, tau: d.tau,
    reintentosCita, comillasQuitadas, podadas,
    citasSinRespaldo: texto ? citasInvalidas(texto, textosVistos) : [],
    tokensEntrada: r.tokensEntrada, tokensSalida: r.tokensSalida,
  };
}
