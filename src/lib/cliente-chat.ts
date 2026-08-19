/**
 * El cliente de `POST /api/chat` y —sobre todo— la redacción de los rechazos.
 *
 * POR QUE LA PROSA DE LOS ERRORES VIVE ACA Y NO EN EL SERVIDOR. La ruta
 * devuelve códigos y un `motivo`, nunca una frase en personaje, y es
 * deliberado: la tesis del proyecto es que lo que Leonardo dice se comprueba
 * contra sus cuadernos, y una frase inventada para un error 429 no se puede
 * comprobar contra nada. Entonces el texto es del frontend, se escribe una
 * sola vez, y queda claro —para cualquiera que lea el código— que estas
 * palabras son de la interfaz y no del corpus. Por eso el chat las muestra
 * como mensaje de sistema, con otro tratamiento visual que las de Leonardo.
 *
 * LAS 6 PREGUNTAS DE PORTADA NO PASAN POR ACA (D-132): están bundleadas en
 * `src/data/portada.ts` y se sirven sin red ni modelo.
 */

import type { RespuestaPublica } from "./respuesta.js";

export type Idioma = "es" | "en";

/** Lo mismo que acepta el textarea. Muy por debajo del máximo de 500 de la ruta. */
export const MAX_CARACTERES = 160;

/** Los 20 turnos que la ruta corta con un 429 `turnos`. */
export const MAX_TURNOS = 20;

export type ResultadoChat =
  | { ok: true; respuesta: RespuestaPublica }
  /** `descansa`: no es un error del usuario, es la cuota del día. Se dice distinto. */
  | { ok: false; texto: string; descansa: boolean };

interface CuerpoError {
  error?: string;
  motivo?: string;
  descansa?: boolean;
}

/**
 * La redacción de cada rechazo, en los dos idiomas. En personaje pero sin
 * fingir que es una cita: ninguna de estas frases lleva comillas, porque las
 * comillas en este producto significan "verbatim de los cuadernos" (D-082) y
 * eso no se puede diluir ni siquiera acá.
 */
const RECHAZOS: Record<string, Record<Idioma, string>> = {
  ip_hora: {
    es: "Me has consultado mucho en poco rato, y la mano necesita descanso. Volvé en un rato y seguimos.",
    en: "You have asked much of me in little time, and the hand needs rest. Come back shortly and we shall continue.",
  },
  ip_dia: {
    es: "Por hoy ya conversamos bastante. Mañana los cuadernos siguen abiertos.",
    en: "We have talked enough for today. Tomorrow the notebooks are open again.",
  },
  turnos: {
    es: `Llegamos a los ${MAX_TURNOS} intercambios de esta sesión. Recargá la página para empezar de nuevo.`,
    en: `We have reached the ${MAX_TURNOS} exchanges of this session. Reload the page to begin anew.`,
  },
  global_dia: {
    es: "Leonardo descansa: se agotó lo que este taller puede responder hoy. Las 6 preguntas de la portada siguen andando — están guardadas acá mismo y no dependen de eso.",
    en: "Leonardo rests: what this workshop can answer today is spent. The 6 questions on the cover still work — they are kept right here and depend on none of this.",
  },
  cuota_proveedor: {
    es: "Leonardo descansa: se agotó lo que este taller puede responder hoy. Las 6 preguntas de la portada siguen andando — están guardadas acá mismo y no dependen de eso.",
    en: "Leonardo rests: what this workshop can answer today is spent. The 6 questions on the cover still work — they are kept right here and depend on none of this.",
  },
  turnstile: {
    es: "No pude confirmar que del otro lado hay una persona. Recargá la página y probá otra vez.",
    en: "I could not confirm a person on the other side. Reload the page and try again.",
  },
  red: {
    es: "No llegué al taller — puede ser tu conexión. Probá de nuevo en un momento.",
    en: "I could not reach the workshop — it may be your connection. Try again in a moment.",
  },
  desconocido: {
    es: "Algo falló de este lado, y prefiero decírtelo antes que inventarte una respuesta.",
    en: "Something failed on this side, and I would rather tell you than invent an answer for you.",
  },
};

const texto = (clave: string, idioma: Idioma): string =>
  (RECHAZOS[clave] ?? RECHAZOS.desconocido)[idioma];

export async function consultar(
  pregunta: string,
  idioma: Idioma,
  vector: Float32Array,
  turno: number,
): Promise<ResultadoChat> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pregunta,
        idioma,
        // El vector viaja como array común: `Float32Array` no sobrevive a
        // `JSON.stringify` (sale como objeto con claves numéricas).
        vector: Array.from(vector),
        turno,
      }),
    });
  } catch {
    return { ok: false, texto: texto("red", idioma), descansa: false };
  }

  if (res.ok) {
    return { ok: true, respuesta: (await res.json()) as RespuestaPublica };
  }

  // El cuerpo del error puede no ser JSON (un 502 del borde, por ejemplo): que
  // eso no tire una excepción encima del error que ya estamos manejando.
  let cuerpo: CuerpoError = {};
  try {
    cuerpo = (await res.json()) as CuerpoError;
  } catch {
    /* se cae al motivo por código de abajo */
  }

  // Un 400 trae `{ error }` y no `motivo`, así que cae solo en "desconocido":
  // significa que el cliente mandó algo inválido, y eso es un bug nuestro, no
  // algo que el usuario pueda corregir con una frase distinta.
  const motivo = cuerpo.motivo ?? "desconocido";
  return {
    ok: false,
    texto: texto(motivo, idioma),
    descansa: cuerpo.descansa === true || res.status === 503,
  };
}
