/** Piezas compartidas por el runner, el verificador y el reporte. */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { PresupuestoTpm } from "../src/lib/llm.js";
import type { Idioma } from "../src/lib/grounding.js";

export const RAIZ = new URL("../", import.meta.url);
export const ART = new URL("artifacts/", RAIZ);
export const SALIDAS = new URL("evals/out/", RAIZ);

export interface Caso {
  id: string;
  pair?: string;
  q: string;
  lang: Idioma;
  category: string;
  expected_passages: number[];
  should_abstain: boolean;
  nota?: string;
  expected_richter_note?: string;
  expected_topic?: string;
}

/** Una fila de resultado. Se escribe apenas se produce, para poder reanudar. */
export interface Resultado {
  id: string;
  modo: "rag" | "baseline";
  proveedor: string;
  k: number;
  /** Huella del prompt con el que se genero. Ver `huellaPrompt` y D-064. */
  prompt?: string;
  decision: "curada" | "abstiene" | "responde" | "sin_capacidad" | "error";
  cosMax: number | null;
  tau: number | null;
  pasajes: number[];
  notasRichter: string[];
  respuesta: string;
  tokensEntrada: number;
  tokensSalida: number;
  ms: number;
  error?: string;
}

export function cargarCasos(): Caso[] {
  return readFileSync(new URL("evals/dataset.jsonl", RAIZ), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trimStart().startsWith("//"))
    .map((l) => JSON.parse(l) as Caso);
}

/**
 * Lee un JSONL de resultados y devuelve la ULTIMA fila por `id`.
 *
 * `abrirSalida` solo agrega (`appendFileSync`): nunca reescribe ni borra. Asi
 * que cuando un caso falla, se reintenta y despues tiene exito, el archivo
 * termina con DOS filas para el mismo id — la de error primero, la de exito
 * despues. Sin deduplicar aca, el runner reanudado, el muestreador y el
 * verificador verian ambas: la de exito se juzgaria dos veces con IDs
 * repetidos, y "hechos" en el runner se calcularia mal.
 *
 * "Ultima fila gana" es correcto porque el runner APPENDEA en el orden en que
 * termina cada llamada: una fila mas nueva siempre reemplaza a una mas vieja
 * del mismo caso, nunca al reves.
 */
export function leerJsonl<T extends { id: string }>(url: URL): T[] {
  if (!existsSync(url)) return [];
  const porId = new Map<string, T>();
  for (const l of readFileSync(url, "utf8").split("\n")) {
    const t = l.trim();
    // Mismo criterio que `cargarCasos` para dataset.jsonl: las lineas de
    // comentario `//` se ignoran. `etiquetas_humanas.jsonl` sigue esa
    // convencion en su cabecera y esta funcion generica no la conocia.
    if (!t || t.startsWith("//")) continue;
    const fila = JSON.parse(t) as T;
    porId.set(fila.id, fila);
  }
  return [...porId.values()];
}

export function abrirSalida(nombre: string): { url: URL; escribir: (o: unknown) => void } {
  mkdirSync(SALIDAS, { recursive: true });
  const url = new URL(nombre, SALIDAS);
  return { url, escribir: (o) => appendFileSync(url, JSON.stringify(o) + "\n", "utf8") };
}

export function claves(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of readFileSync(new URL(".env.local", RAIZ), "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[2].trim()) out[m[1]] = m[2].trim();
  }
  return out;
}

export const dormir = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/**
 * ESPERA a que entre en la ventana de tokens por minuto, en vez de devolver
 * `null` y seguir.
 *
 * La degradacion preventiva de `llm.ts` es la correcta en produccion: si no hay
 * presupuesto, el usuario ve "Leonardo descansa" y no un error. En el eval seria
 * un desastre — se midio corriendo el lote de 20 preguntas de control y a partir
 * del sexto caso TODAS devolvian null, asi que 14 de 20 respuestas no existian y
 * el resumen igual daba un numero. Un eval que se saltea casos en silencio
 * cuando se acaba la cuota no mide nada.
 *
 * A 6.000 TPM (D-023) y ~1.100 tokens por request esto son ~30 minutos de reloj
 * por corrida completa. Es el costo real de medir, y por eso el runner escribe
 * cada fila apenas la tiene y se puede reanudar.
 */
export async function esperarCapacidad(
  p: PresupuestoTpm, estimado: number, avisar?: (s: number) => void,
): Promise<void> {
  let avisado = false;
  while (!p.disponible(estimado)) {
    if (!avisado && avisar) { avisar(p.usoActual()); avisado = true; }
    await dormir(3000);
  }
}

/** Barra de progreso mínima, para una corrida que dura media hora. */
export function progreso(i: number, n: number, extra = ""): void {
  const pct = ((i / n) * 100).toFixed(0).padStart(3);
  process.stdout.write(`\r  [${pct}%] ${String(i).padStart(3)}/${n} ${extra}`.padEnd(100));
  if (i === n) process.stdout.write("\n");
}
