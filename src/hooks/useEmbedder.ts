"use client";

/**
 * El hook que carga el modelo de embeddings en el navegador y embebe
 * consultas. Ver D-118, D-126, D-127.
 *
 * ES LA "LÓGICA" DEL PASO 22 DEL ROADMAP, NO LA PANTALLA. Este archivo no
 * renderiza nada — ni barra de carga, ni popout, ni tarjeta explicativa. Esas
 * tres piezas (19-cuater) las decide el dueño del proyecto. Lo que sí puede
 * decidirse desde código es CUÁNDO arranca la descarga y CÓMO se reporta el
 * progreso, porque D-118 ya lo fijó: automática al cargar la página, no
 * detrás de un botón.
 *
 * ================================================================
 * VERIFICADO CONTRA UN NAVEGADOR REAL, NO SUPUESTO (D-127).
 * ================================================================
 *
 * Todo lo que el proyecto sabía hasta acá sobre el embedding en el navegador
 * —los 129 MB de D-097, el par q8 de D-116/D-117— salía de aritmética sobre
 * tamaños de archivo y de Node con `onnxruntime-node`. **Nunca se había hecho
 * correr Transformers.js en un motor de navegador real.** Se hizo: un arnés
 * fuera del repo, servido por HTTP, en una pestaña de Chromium de verdad.
 *
 * Resultado — coseno contra el mismo vector calculado en Node, mismo dtype:
 *
 *   es: coseno = 1.0000000000  (max|Δ| ~7e-9, ruido de punto flotante)
 *   en: coseno = 1.0000000000  (max|Δ| ~2e-8)
 *
 * Confirma de punta a punta la cadena que D-022 abrió (Python → Node) y que
 * quedaba coja en el tramo que más importa: Node → navegador real.
 *
 * Y APARECIÓ UN COSTO QUE NADIE HABÍA MEDIDO: el runtime de ONNX (WASM + el
 * paquete de Transformers.js) pesa **~4,15 MB transferidos** (`ort-wasm-simd-
 * threaded.wasm` es el grueso, 4,1 MB) — aparte de los 129,1 MB de D-097, que
 * son sólo el modelo y el tokenizer. La primera carga real es más cerca de
 * **~133 MB**, no 129. Es una diferencia de guardarropa (+3,4%), pero D-097
 * medía "el embedder" y esto es "correr el embedder", que es lo que un
 * usuario en verdad descarga. Anotado; no vale la pena recalibrar nada por
 * esto, sólo decirlo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cargarExtractor, embeberConsulta } from "../lib/embed.js";
import type { ProgressInfo } from "@huggingface/transformers";

export type EstadoEmbedder = "inactivo" | "cargando" | "listo" | "error";

export interface UseEmbedderResultado {
  estado: EstadoEmbedder;
  /** 0-100, agregado de todos los archivos que componen el modelo. */
  progreso: number;
  error: string | null;
  /**
   * Embebe una consulta. Espera a que el modelo esté listo si todavía está
   * cargando — no hace falta que el llamador orqueste el orden. Tira si el
   * estado es "error": no hay vector válido que devolver.
   */
  embed: (texto: string) => Promise<Float32Array>;
}

/**
 * El tipo que devuelve `cargarExtractor` una vez resuelto. Se saca de ahí y
 * no se importa directo de la librería por la misma razón que `embed.ts` no
 * anota su propio retorno: el tipo condicional de `pipeline()` explota en
 * "union type too complex" apenas se lo nombra con otra forma.
 */
type Extractor = Awaited<ReturnType<typeof cargarExtractor>>;

export function useEmbedder(): UseEmbedderResultado {
  const [estado, setEstado] = useState<EstadoEmbedder>("inactivo");
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const extractorRef = useRef<Extractor | null>(null);
  const promesaRef = useRef<Promise<Extractor> | null>(null);
  /** Bytes por archivo, para agregar el progreso de varios archivos a la vez. */
  const archivosRef = useRef<Map<string, { loaded: number; total: number }>>(new Map());

  const onProgreso = useCallback((info: ProgressInfo) => {
    if (info.status !== "progress") return;
    archivosRef.current.set(info.file, { loaded: info.loaded, total: info.total });
    let loaded = 0, total = 0;
    for (const a of archivosRef.current.values()) { loaded += a.loaded; total += a.total; }
    if (total > 0) setProgreso(Math.round((loaded / total) * 100));
  }, []);

  /**
   * `cargar()` es idempotente: si ya hay una promesa en curso (o resuelta) la
   * devuelve en vez de arrancar una segunda descarga. Hace falta porque
   * StrictMode de React invoca los efectos dos veces en desarrollo —sin esto,
   * un usuario en dev bajaría el modelo dos veces en paralelo.
   */
  const cargar = useCallback((): Promise<Extractor> => {
    if (promesaRef.current) return promesaRef.current;
    setEstado("cargando");
    setError(null);
    const p = cargarExtractor(undefined, undefined, onProgreso)
      .then((ex: Extractor) => {
        extractorRef.current = ex;
        setEstado("listo");
        setProgreso(100);
        return ex;
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setEstado("error");
        promesaRef.current = null; // permite reintentar
        throw e;
      });
    promesaRef.current = p;
    return p;
  }, [onProgreso]);

  // D-118: la descarga arranca sola al montar, no detrás de un click.
  useEffect(() => { void cargar(); }, [cargar]);

  const embed = useCallback(async (texto: string): Promise<Float32Array> => {
    const ex = extractorRef.current ?? await cargar();
    return embeberConsulta(ex, texto);
  }, [cargar]);

  return { estado, progreso, error, embed };
}
