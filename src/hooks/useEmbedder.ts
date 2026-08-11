"use client";

/**
 * El hook que carga el modelo de embeddings en el navegador y embebe
 * consultas. Ver D-118, D-126, D-127, D-128.
 *
 * ES LA "LÓGICA" DEL PASO 22 DEL ROADMAP, NO LA PANTALLA. Este archivo no
 * renderiza nada — ni barra de carga, ni popout, ni tarjeta explicativa. Esas
 * tres piezas (19-cuater) las decide el dueño del proyecto. Lo que sí se
 * decide desde código es CUÁNDO arranca la descarga y CÓMO se reporta el
 * progreso, porque D-118 ya lo fijó: automática al cargar la página, no
 * detrás de un botón.
 *
 * ================================================================
 * EL MODELO ES UN RECURSO DE MODULO, NO DE COMPONENTE. Ver D-128.
 * ================================================================
 *
 * `pipeline()` de Transformers.js **no memoiza**: leído en su fuente
 * (`pipelines.js`), cada llamada corre `loadItems` y construye una sesión ONNX
 * nueva. Con el estado adentro del hook —que es como nació este archivo en
 * D-127— dos componentes que llamaran `useEmbedder()` habrían tenido **dos
 * sesiones del modelo de 112,8 MB residentes a la vez**. Los bytes no se
 * vuelven a bajar (quedan en la Cache API del navegador), pero la memoria sí
 * se duplica, y el criterio de salida de la Fase 4 dice «funciona en móvil».
 *
 * Por eso el extractor, la promesa en vuelo y el estado viven en el MODULO, y
 * el hook es sólo una vista sobre eso vía `useSyncExternalStore`. Cuántos
 * componentes lo usen deja de importar: se carga una vez.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { cargarExtractor, embeberConsulta } from "../lib/embed.js";
import type { ProgressInfo } from "@huggingface/transformers";

export type EstadoEmbedder = "inactivo" | "cargando" | "listo" | "error";

export interface EstadoEmbedderPublico {
  estado: EstadoEmbedder;
  /** 0-100. Ver `BYTES_ESPERADOS`: nunca retrocede. */
  progreso: number;
  error: string | null;
}

export interface UseEmbedderResultado extends EstadoEmbedderPublico {
  /**
   * Embebe una consulta, esperando a que el modelo esté listo si hace falta.
   *
   * **Si la carga anterior falló, REINTENTA** en vez de tirar: un corte de red
   * pasajero no debería dejar la página inservible hasta recargarla. Dos
   * llamadas seguidas no disparan dos descargas — comparten la promesa en
   * vuelo. Si el reintento también falla, tira.
   */
  embed: (texto: string) => Promise<Float32Array>;
  /** Fuerza un reintento sin tener que embeber nada. Para un botón de "reintentar". */
  reintentar: () => void;
}

type Extractor = Awaited<ReturnType<typeof cargarExtractor>>;

/**
 * BYTES POR ARCHIVO, MEDIDOS EN EL NAVEGADOR (D-128), no estimados.
 *
 * Suman **135.392.016 B = 129,1 MiB**, que confirma al byte la cifra que D-097
 * había calculado por otra vía.
 *
 * NO ES UNA OPTIMIZACION, ES LA UNICA FORMA DE QUE LA BARRA NO MIENTA. Medido
 * el orden real de los eventos: Transformers.js anuncia `initiate` para los
 * tres archivos chicos, los descarga (1,1 KB en total) y **recién entonces
 * anuncia `onnx/model_quantized.onnx`**, que es el 87% del peso. Un progreso
 * calculado sobre "los archivos vistos hasta ahora" llega a **100% con 1,1 KB
 * bajados y se desploma a ~0%** cuando aparece el modelo. Con un denominador
 * conocido de antemano, sube parejo de 0 a 100.
 *
 * Si el modelo cambiara, los nombres no coincidirían y el denominador cae a la
 * suma de lo reportado: vuelve el escalón, pero nada se rompe.
 */
const BYTES_ESPERADOS: Record<string, number> = {
  "onnx/model_quantized.onnx": 118_308_185,
  "tokenizer.json": 17_082_730,
  "config.json": 658,
  "tokenizer_config.json": 443,
};
const TOTAL_ESPERADO = Object.values(BYTES_ESPERADOS).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Estado de módulo, compartido por todas las instancias del hook
// ---------------------------------------------------------------------------

let extractor: Extractor | null = null;
let promesa: Promise<Extractor> | null = null;
const bytesPorArchivo = new Map<string, number>();

/**
 * La instantánea que lee `useSyncExternalStore`. **Se reemplaza entera en cada
 * cambio**, nunca se muta: el store compara por identidad y mutarla dejaría a
 * React sin ver el cambio.
 */
let instantanea: EstadoEmbedderPublico = { estado: "inactivo", progreso: 0, error: null };

/** Constante y estable: en SSR no hay modelo ni descarga que reportar. */
const INSTANTANEA_SSR: EstadoEmbedderPublico = { estado: "inactivo", progreso: 0, error: null };

const oyentes = new Set<() => void>();

function publicar(parcial: Partial<EstadoEmbedderPublico>): void {
  instantanea = { ...instantanea, ...parcial };
  for (const avisar of oyentes) avisar();
}

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  return () => { oyentes.delete(avisar); };
}

function onProgreso(info: ProgressInfo): void {
  if (info.status !== "progress") return;
  bytesPorArchivo.set(info.file, info.loaded);

  let bajados = 0;
  for (const b of bytesPorArchivo.values()) bajados += b;

  // El denominador es el mayor entre lo que sabemos y lo que el navegador
  // reporta: si el modelo cambiara y pesara más, la barra sigue siendo honesta.
  const total = Math.max(TOTAL_ESPERADO, bajados);
  // Tope en 99: el 100 lo pone `cargar()` recién cuando la sesión está armada.
  // Bajar el último byte no es lo mismo que estar listo para embeber.
  const pct = Math.min(99, Math.round((bajados / total) * 100));

  if (pct > instantanea.progreso) publicar({ progreso: pct });
}

function cargar(): Promise<Extractor> {
  if (promesa) return promesa;
  publicar({ estado: "cargando", error: null });
  promesa = cargarExtractor(undefined, undefined, onProgreso)
    .then((ex: Extractor) => {
      extractor = ex;
      publicar({ estado: "listo", progreso: 100, error: null });
      return ex;
    })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      // Se libera la promesa para que un reintento arranque de cero. El
      // progreso también, si no la barra quedaría clavada donde se cortó.
      promesa = null;
      bytesPorArchivo.clear();
      publicar({ estado: "error", progreso: 0, error: msg });
      throw e;
    });
  return promesa;
}

// ---------------------------------------------------------------------------

export function useEmbedder(): UseEmbedderResultado {
  const vista = useSyncExternalStore(suscribir, () => instantanea, () => INSTANTANEA_SSR);

  /**
   * D-118: la descarga arranca sola al montar, no detrás de un click.
   *
   * EL `.catch()` NO ES DECORATIVO. Sin él, `cargar()` rechaza sin nadie
   * escuchando y el navegador reporta un `unhandledrejection` — comprobado
   * reproduciendo la cadena de promesas en Node (D-128). El estado de error ya
   * quedó publicado adentro de `cargar()`; acá sólo se absorbe el rechazo, que
   * es exactamente lo que un efecto de arranque debe hacer con un fallo que ya
   * está representado en el estado.
   */
  useEffect(() => { cargar().catch(() => { /* ya está en `estado: "error"` */ }); }, []);

  const embed = useCallback(async (texto: string): Promise<Float32Array> => {
    const ex = extractor ?? await cargar();
    return embeberConsulta(ex, texto);
  }, []);

  const reintentar = useCallback(() => {
    if (extractor || promesa) return;
    cargar().catch(() => { /* idem */ });
  }, []);

  return { ...vista, embed, reintentar };
}
