/**
 * Lo que hace falta para que un turno entienda al anterior. Ver D-197.
 *
 * EL PROBLEMA QUE RESUELVE. `construirPrompt` aceptaba un `historial` desde
 * D-020 y nadie lo llenaba nunca: `responder()` pasaba `[]` literal, la ruta no
 * lo recibía y el cliente no lo mandaba. El códice mostraba una conversación de
 * hasta 20 turnos donde cada turno era una consulta suelta, y encima no fallaba
 * hacia la abstención: «¿Y por qué?» daba cos_max 0,8523 contra τ_es 0,841,
 * pasaba el gate y traía tres pasajes sin relación con lo que se venía hablando.
 *
 * ================================================================
 * EL CONTEXTO ENTRA AL VECTOR, NUNCA AL TEXTO DE LA CONSULTA.
 * ================================================================
 *
 * Medido en `npm run evals:multiturno` sobre los 120 casos del dataset puestos
 * como segundo turno, con tres contextos cada uno. Concatenar el turno anterior
 * a la consulta y dejar que eso gobierne todo —capa 0, BM25, coseno y gate—
 * arregla las repreguntas y **abre 16 filtraciones nuevas del gate y rompe 25 de
 * los 30 casos de categoría A**. La prioridad 1 del proyecto es no alucinar
 * (D-020), así que esa variante está descartada y medida.
 *
 * Lo que sí se gana el lugar reparte las tres responsabilidades:
 *
 *   el TEXTO de la consulta   sigue siendo el del turno actual → la capa 0 no
 *                             hereda el patrón curado del turno anterior y BM25
 *                             no puntúa con términos viejos
 *   el VECTOR                 lleva el contexto, y sólo cuando hace falta
 *   el GATE                   umbraliza el coseno de la consulta SOLA, así que
 *                             no puede abrirse por arrastre: 0 fugas nuevas
 *
 * ⚠ Si alguna vez el gate pasa a umbralizar el coseno del vector con contexto,
 * vuelven las 16 filtraciones. Es la razón por la que `responder()` recibe los
 * dos vectores y no uno.
 */

import type { Turno } from "./llm.js";

/**
 * Se re-exporta para que el cliente no tenga que importar de `llm.ts`, que trae
 * los proveedores y el system prompt. Es sólo un tipo y desaparece al compilar,
 * pero un import del módulo de las claves desde un componente `"use client"` es
 * la clase de línea que después alguien copia sin el `type`.
 */
export type { Turno };

/**
 * PALABRAS QUE NO NOMBRAN NINGUN TEMA: interrogativos, pronombres, deícticos,
 * preposiciones, auxiliares y los verbos con los que se pide continuar.
 *
 * EL ERROR ES ASIMETRICO Y CAE DEL LADO SEGURO, y eso es lo único que hace
 * defendible una lista escrita a mano. Una consulta se declara dependiente sólo
 * si TODOS sus tokens están acá:
 *
 *   - lista corta → una repregunta con un sustantivo suelto («¿y en qué
 *     cuaderno?») se toma por autónoma y el sistema se comporta EXACTAMENTE
 *     como antes de D-197. Se pierde la mejora; no se rompe nada.
 *   - para equivocarse en la otra dirección haría falta una pregunta real
 *     compuesta íntegramente por estas palabras, o sea una que tampoco nombra
 *     ningún tema.
 *
 * Verificado en `evals/multiturno.ts` contra las 156 consultas reales que hay en
 * el repo —los 120 casos del dataset, las 12 de portada y los 24 ejemplos de
 * `LISTA_CURADA`—: **cero clasificadas como dependientes.** Ese es el número a
 * vigilar si la lista crece.
 *
 * ⚠ NO SALE DE LAS STOPWORDS DE BM25: ésas son inglesas —el índice lo es— y
 * contra una consulta castellana no filtran nada.
 */
const FUNCIONALES = new Set([
  // castellano
  "y", "o", "pero", "que", "qué", "cual", "cuál", "quien", "quién", "como", "cómo",
  "cuando", "cuándo", "donde", "dónde", "por", "para", "porque", "de", "del", "a", "al",
  "en", "con", "sin", "sobre", "eso", "esa", "ese", "esto", "esta", "este", "aquello",
  "lo", "la", "el", "los", "las", "un", "una", "unos", "unas", "me", "te", "se", "le",
  "yo", "vos", "tu", "tú", "mi", "su", "es", "era", "fue", "son", "ser", "estar",
  "hay", "ha", "he", "has", "haber", "mas", "más", "menos", "otra", "otro", "otras",
  "otros", "mismo", "misma", "tanto", "asi", "así", "entonces", "ademas", "además",
  "tambien", "también", "decis", "decís", "dice", "dices", "decir", "dijiste",
  "contame", "conta", "cuenta", "explicame", "explica", "explicar", "ampliar",
  "ampliame", "hace", "hacer", "haces", "pasa", "pasar", "ocurre", "ocurrir",
  "significa", "significar", "no", "si", "sí", "e", "u", "ni", "cuanto", "cuánto",
  // inglés
  "and", "or", "but", "that", "this", "these", "those", "it", "its", "what", "which",
  "who", "whom", "how", "when", "where", "why", "because", "of", "to", "for", "in",
  "on", "with", "without", "about", "the", "a", "an", "i", "you", "your", "my", "me",
  "is", "was", "were", "are", "be", "been", "do", "does", "did", "done", "have", "has",
  "had", "more", "less", "other", "another", "same", "so", "then", "also", "say",
  "says", "said", "tell", "told", "explain", "mean", "means", "meant", "happen",
  "happens", "elaborate", "further", "not", "no", "yes", "one",
]);

/** La misma lista, ya despojada de acentos, para comparar contra tokens planos. */
const FUNCIONALES_PLANAS = new Set(
  [...FUNCIONALES].map((w) => w.normalize("NFD").replace(/\p{M}/gu, "")));

/**
 * Los tokens que nombran algo. Despoja acentos ANTES de partir, por la misma
 * razón que `Corpus.tokenizar`: sin eso «cómo» se parte en «c» + «mo».
 *
 * A diferencia de aquélla, acepta tokens de una letra: acá el filtro de longitud
 * dejaría pasar basura como contenido.
 */
function contenido(consulta: string): string[] {
  const plano = consulta.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  return (plano.match(/[a-z][a-z'\-]*/g) ?? []).filter((t) => !FUNCIONALES_PLANAS.has(t));
}

/** Si la consulta se sostiene sola. Falso = sólo se entiende con lo anterior. */
export const esAutonoma = (consulta: string): boolean => contenido(consulta).length > 0;

/**
 * QUE TEXTO EMBEBER. Devuelve la consulta tal cual cuando se sostiene sola —el
 * caso normal, y el que deja el sistema idéntico a antes de D-197— y la última
 * pregunta del usuario pegada adelante cuando no.
 *
 * Se toma la última pregunta DEL USUARIO y no la respuesta de Leonardo: la
 * respuesta trae citas de los pasajes, así que embeberla acercaría el vector a
 * los pasajes que ya se mostraron en vez de al tema, que es lo que se busca.
 */
export function consultaParaEmbeber(pregunta: string, historial: Turno[]): string {
  if (esAutonoma(pregunta)) return pregunta;
  const ultima = [...historial].reverse().find((t) => t.rol === "usuario");
  return ultima ? `${ultima.texto} ${pregunta}` : pregunta;
}

/** Turnos que viajan al prompt: 4 intercambios (D-020). */
export const MAX_MENSAJES_HISTORIAL = 8;

/**
 * Palabras por mensaje del historial. Es presupuesto de capacidad, igual que el
 * recorte de pasajes a 200 (D-020): el límite que ata es de tokens por minuto
 * (D-023), y una respuesta de Leonardo puede pasar las 300 palabras. Con cuatro
 * intercambios sin recortar, el historial pesaría más que los tres pasajes.
 */
export const MAX_PALABRAS_TURNO = 120;

/**
 * Normaliza lo que manda el cliente antes de que toque el prompt.
 *
 * ⚠ EL HISTORIAL LO ESCRIBE EL CLIENTE Y NO HAY SESION EN EL SERVIDOR que lo
 * verifique (D-032). O sea que es texto controlado por quien llama, igual que la
 * pregunta, y por eso se acota acá en tamaño y en cantidad. Lo que NO cambia es
 * de dónde sale una cita: las garantías de D-082/D-083 comprueban cada cita
 * contra los pasajes recuperados EN ESTE TURNO, así que un historial fabricado
 * no puede convertirse en una cita con comillas.
 */
export function sanearHistorial(historial: Turno[]): Turno[] {
  return historial
    .filter((t) => (t.rol === "usuario" || t.rol === "leonardo") && t.texto?.trim())
    .slice(-MAX_MENSAJES_HISTORIAL)
    .map((t) => {
      const p = t.texto.trim().split(/\s+/);
      return {
        rol: t.rol,
        texto: p.length <= MAX_PALABRAS_TURNO
          ? t.texto.trim()
          : p.slice(0, MAX_PALABRAS_TURNO).join(" ") + " […]",
      };
    });
}
