/**
 * El cronograma de la intro escrita a mano. Ver D-136.
 *
 * NO ES UNA ANIMACION CSS CON UN `animation-delay` POR LETRA ESCRITO A MANO,
 * y tampoco una librería de handwriting. Es un cálculo: cada carácter dura en
 * proporción al ancho de su trazo, así la pluma mantiene **velocidad
 * constante** en vez de velocidad por letra. Una `l` (0,3 em) no puede tardar
 * lo mismo que una `m` (0,95 em) — con tiempo fijo por carácter la mano
 * parece frenar en las letras anchas y acelerar en las finas, que es
 * exactamente lo que delata a un typewriter.
 *
 * POR QUE VIVE ACA Y NO ADENTRO DEL COMPONENTE. `fin` —el instante en que se
 * termina de escribir la última letra— es el reloj del que cuelga todo lo
 * demás: cuándo cae el primer velo, cuándo se disuelve el segundo y, sobre
 * todo, cuándo arranca el video (`fin - ADELANTO_VIDEO`). Si el texto cambia
 * una palabra, las cuatro cosas se recalculan solas. Un número hardcodeado en
 * el componente habría desincronizado el fuego con el revelado sin que nada
 * fallara visiblemente en desarrollo.
 *
 * Es una función pura, sin React ni DOM: se puede correr en Node y verificar
 * que el total dé lo que se espera.
 */

/**
 * Las dos líneas de la intro, tal como se escriben.
 *
 * LA INTRO SE ESCRIBE SIEMPRE EN CASTELLANO, y no es un olvido: el selector de
 * idioma es explícito y no hay autodetección (decisión vieja del proyecto), así
 * que cuando la intro arranca todavía nadie eligió nada. Lo que sí tiene que
 * pasar es que al elegir «EN» esas dos líneas —que quedan de titular del hero—
 * se traduzcan, y para eso está la versión inglesa.
 */
export const LINEAS: Record<"es" | "en", readonly string[]> = {
  es: [
    "Leonardo da Vinci dejó más de 7.500 páginas escritas.",
    "Por primera vez, un software las utiliza para conversar con él sin inventar respuestas.",
  ],
  en: [
    "Leonardo da Vinci left more than 7,500 written pages.",
    "For the first time, software uses them to speak with him without inventing answers.",
  ],
};

/**
 * Ancho de trazo en "em", sólo para lo que se aparta del promedio. La tabla es
 * corta a propósito: no hace falta medir la fuente al píxel, hace falta que la
 * `i` y la `m` no tarden lo mismo. Lo no listado cae en los dos valores de
 * abajo (0,88 para mayúsculas, 0,6 para el resto).
 */
const ANCHO: Record<string, number> = {
  " ": 0.3, i: 0.34, "í": 0.34, l: 0.3, j: 0.36, t: 0.44, f: 0.42, r: 0.46,
  ".": 0.28, ",": 0.28, m: 0.95, w: 0.86, M: 1.1, W: 1.15,
  "5": 0.62, "7": 0.62, "0": 0.62,
};

/**
 * Las pausas humanas, en ms. No son ancho de trazo: son el instante en que la
 * mano levanta la pluma. Sin esto la línea sale pareja y mecánica aunque los
 * anchos estén bien — la coma y el punto son lo que da la respiración.
 *
 * LA COMA NO PAUSA (D-142). Se probó con 210 ms y se leía como un freno, no
 * como una respiración: en una línea corta la coma cae demasiado seguido y el
 * ojo la registra como tropiezo. El punto y el punto y coma sí cortan, porque
 * ahí la frase efectivamente termina. La coma queda con su ancho de trazo y
 * nada más.
 */
const PAUSA: Record<string, number> = {
  " ": 78, ".": 280, ";": 180, ":": 180,
};

const esDigito = (ch: string | undefined): boolean => ch !== undefined && ch >= "0" && ch <= "9";

/**
 * La pausa que le toca a un carácter EN SU CONTEXTO. Ver D-141.
 *
 * UN PUNTO ENTRE DIGITOS NO ES UN PUNTO. En «7.500» es separador de miles, y
 * en «0,6» la coma es decimal: la tabla de arriba les cobraba la pausa entera
 * de final de frase y la pluma frenaba 280 ms en el medio de un número. Se
 * notaba como un tirón, y era lo único de la intro que no venía de una razón.
 */
function pausaDe(chars: readonly string[], j: number): number {
  const ch = chars[j]!;
  const pausa = PAUSA[ch];
  if (pausa === undefined) return 0;
  if ((ch === "." || ch === ",") && esDigito(chars[j - 1]) && esDigito(chars[j + 1])) return 0;
  return pausa;
}

/** Cuánto vale un "em" de trazo. Es la única perilla de velocidad global. */
const MS_EM = 54;
/** Aire entre el final de la primera línea y el arranque de la segunda. */
const GAP_LINEA = 300;
/** Lo que tarda una letra en materializarse, una vez que le toca su turno. */
export const DUR_CH = 230;
/** Un respiro antes del primer trazo: la pantalla en negro no arranca de golpe. */
const ARRANQUE = 200;

export interface CaracterIntro {
  ch: string;
  /** ms desde el montaje. Va derecho a `animationDelay`. */
  retraso: number;
}

/** Una palabra es la unidad de corte de línea, no el carácter. Ver abajo. */
export type PalabraIntro = CaracterIntro[];

export interface Cronograma {
  /** Una lista de palabras por línea. */
  lineas: PalabraIntro[][];
  /** ms desde el montaje hasta que la última letra terminó de aparecer. */
  fin: number;
}

const anchoDe = (ch: string): number =>
  ANCHO[ch] ?? (/[A-ZÁÉÍÓÚÑ]/.test(ch) ? 0.88 : 0.6);

/**
 * AGRUPADO POR PALABRA, NO POR CARACTER SUELTO. Cada palabra se renderiza como
 * un `inline-block`: si fuera un `<span>` por letra al ras del párrafo, el
 * navegador podría cortar el renglón en medio de una palabra en pantallas
 * angostas, porque para él cada letra es una caja independiente.
 */
function construirCronograma(lineas: readonly string[] = LINEAS.es): Cronograma {
  let t = ARRANQUE;

  const out = lineas.map((linea, i) => {
    if (i) t += GAP_LINEA;

    // Se recorre la línea ENTERA de una, no palabra por palabra: `pausaDe`
    // necesita mirar el carácter anterior y el siguiente, y partiendo primero
    // en palabras los vecinos de los bordes se pierden.
    const chars = Array.from(linea);
    const tiempos = chars.map((ch) => ({ ch, retraso: 0 }));
    chars.forEach((ch, j) => {
      tiempos[j]!.retraso = Math.round(t);
      t += anchoDe(ch) * MS_EM + pausaDe(chars, j);
    });

    // Recién ahora se agrupa. El espacio cierra la palabra que lo precede: así
    // también consume su tiempo de pluma en vez de ser un salto gratis.
    const palabras: PalabraIntro[] = [];
    let actual: CaracterIntro[] = [];
    for (const c of tiempos) {
      actual.push(c);
      if (c.ch === " ") {
        palabras.push(actual);
        actual = [];
      }
    }
    if (actual.length) palabras.push(actual);
    return palabras;
  });

  return { lineas: out, fin: Math.round(t + DUR_CH) };
}

/**
 * Un cronograma por idioma, los dos calculados al importar. Ver D-150.
 *
 * Desde que hay autodetección, la intro se escribe en el idioma del visitante,
 * y el inglés no mide lo mismo que el castellano: 6.646 ms contra 6.832. Es
 * exactamente por esto que el cronograma se calcula y no se escribe — cada
 * idioma trae su propio reloj y todo lo demás se acomoda solo.
 */
export const ESCRITURA: Record<"es" | "en", Cronograma> = {
  es: construirCronograma(LINEAS.es),
  en: construirCronograma(LINEAS.en),
};

/**
 * Cuánto ANTES del final de la escritura arranca el video. Ver D-136.
 *
 * El video está montado y precargado desde el principio, pero **pausado**: si
 * corriera bajo el velo, para cuando el velo se levanta el fuego ya habría
 * dado media vuelta de loop, y el revelado agarraría un cuadro cualquiera. Si
 * en cambio arrancara junto con el velo, se vería el primer cuadro congelado
 * durante los ~200 ms que tarda `play()` en producir imagen, y la brasa
 * "prendería" a la vista. Estos 1,3 s son el punto medio medido: el fuego ya
 * está vivo cuando el velo se abre, y todavía no completó un ciclo.
 */
export const ADELANTO_VIDEO = 1300;

/**
 * `brasa` es el corazón de la idea: un segundo largo en que ya no hay velo
 * negro pleno pero tampoco taller — sólo el texto y el fuego asomando por el
 * hueco radial del segundo velo. Sin esa pausa el revelado se lee como un
 * fundido común; con ella, el fuego llega antes que el resto de la escena.
 */
const BRASA = 1150;
/** Lo que tarda el segundo velo en disolverse. Ver D-136 y D-143. */
export const APERTURA = 2400;

/** Las tres fases del revelado, en ms, para el idioma que toque. */
export const fasesDe = (lang: "es" | "en") => ({
  escritura: ESCRITURA[lang].fin,
  brasa: BRASA,
  apertura: APERTURA,
});

/**
 * Si la intro respeta `prefers-reduced-motion`. Ver D-139.
 *
 * EN `false` A PEDIDO DEL DUEÑO DEL PROYECTO: la intro es la puerta de entrada
 * y se muestra a todo el mundo. La decisión se toma sabiendo qué se cede — la
 * preferencia existe para gente a la que el movimiento le produce mareo o
 * malestar, no es un gusto— y apoyada en dos cosas concretas: el movimiento de
 * esta intro es de bajo riesgo (no hay paralaje, ni zoom, ni desplazamiento
 * grande: son letras que se descubren y dos fundidos de opacidad), y **un click
 * en cualquier parte la saltea entera**, que es la salida que la pauta pide.
 *
 * PONERLO EN `true` ALCANZA PARA VOLVER ATRAS, pero no basta: el bloque
 * `@media (prefers-reduced-motion: reduce)` de `app/globals.css` se sacó junto
 * con esto y hay que reponerlo, o las letras aparecerían de golpe igual.
 */
export const RESPETAR_MOVIMIENTO_REDUCIDO = false;

/**
 * El idioma del visitante. Ver D-150.
 *
 * SE REVIERTE UNA DECISION VIEJA DEL PROYECTO —«bilingüe con selector
 * explícito, sin autodetección»— a pedido del dueño. El motivo original de esa
 * regla era el momento de la espera del modelo: se prefería ofrecer el idioma
 * como popout para llenar un tiempo que igual se estaba gastando. Esa
 * estrategia se descartó: hacerlo esperar sin popouts encima es mejor
 * experiencia, y entonces preguntar el idioma pierde su excusa. Se detecta, y
 * el selector queda a la vista para corregir.
 *
 * CASTELLANO SOLO SI EL NAVEGADOR PIDE CASTELLANO; TODO LO DEMAS, INGLES. No es
 * arbitrario: el corpus es la traducción inglesa de Richter, así que el inglés
 * es el idioma en que el proyecto está más cerca de su fuente.
 */
export function detectarIdioma(): "es" | "en" {
  if (typeof navigator === "undefined") return "es";
  const preferidos = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const etiqueta of preferidos) {
    const base = (etiqueta || "").toLowerCase().split("-")[0];
    if (base === "es") return "es";
    if (base === "en") return "en";
  }
  // Ni castellano ni inglés entre las preferencias: gana la lengua de la fuente.
  return "en";
}
