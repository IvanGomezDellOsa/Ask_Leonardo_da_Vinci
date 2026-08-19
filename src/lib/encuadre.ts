/**
 * Qué archivo de video va, y dónde cae el punto de interés en pantalla.
 * Ver D-147.
 *
 * DOS PREGUNTAS DISTINTAS QUE ANTES USABAN LA MISMA RESPUESTA. «¿La maqueta es
 * de teléfono?» (tipografías, botón «Volver», sangrías) se contesta con un
 * ancho: `useAngosto`, 640 px. «¿Qué encuadre de video entra acá?» NO se
 * contesta con un ancho sino con una **proporción**: una tablet en vertical
 * mide 768 px —o sea, no es angosta— y sin embargo es más alta que ancha, y
 * ahí el archivo apaisado se recorta hasta quedar en nada. Mezclar las dos
 * preguntas fue el bug: en una ventana de tablet el hero mostraba el archivo
 * vertical estirado.
 *
 * EL PUNTO DE LA BRASA SE CALCULA, NO SE ESCRIBE. El hueco del segundo velo
 * tiene que caer sobre el mismo lugar de la escena en cualquier pantalla, y
 * dónde queda ese lugar depende de tres cosas que cambian: qué archivo se está
 * usando, cuánto recorta `object-fit: cover` y desde qué borde. Dos porcentajes
 * a mano aciertan en un tamaño y fallan en todos los demás — que es
 * exactamente lo que pasó al pasar de teléfono a tablet.
 */

export interface Encuadre {
  src: string;
  /** Tamaño intrínseco del archivo. */
  w: number;
  h: number;
  /**
   * El punto de la escena sobre el que se abre el hueco de la brasa, en
   * fracción del archivo. En el apaisado es el valor del diseño original
   * (50%, 66%): no es el fuego en sí, es el resplandor sobre la mesa. En el
   * vertical es **el mismo punto de la escena**, recalculado: la banda nítida
   * ocupa de 187 a 592 de 1560, así que (187 + 0,66 × 405) / 1560.
   */
  foco: { x: number; y: number };
  /** El `object-position` con el que se monta, en fracción (0 = borde, .5 = centro). */
  anclaje: { x: number; y: number };
}

const APAISADO: Encuadre = {
  src: "/hero-taller.mp4",
  w: 1280,
  h: 720,
  foco: { x: 0.5, y: 0.66 },
  anclaje: { x: 0.5, y: 0.5 },
};

const VERTICAL: Encuadre = {
  src: "/hero-taller-vertical.mp4",
  w: 720,
  h: 1560,
  foco: { x: 0.5, y: 0.291 },
  // ANCLADO ARRIBA, NO AL CENTRO. En un teléfono 19,5:9 da igual —el archivo
  // entra justo—, pero en una tablet vertical `cover` recorta alto, y centrado
  // el recorte se come la banda nítida por arriba. Anclando al borde superior,
  // lo que se pierde es relleno desenfocado de abajo, que es de lo que sobra.
  anclaje: { x: 0.5, y: 0 },
};

/**
 * PROPORCION, NO ANCHO — y el corte no está en 1, está en 1,15.
 *
 * La pregunta real es cuánto ancho se pierde. `cover` con el archivo apaisado
 * (1,78) en una ventana de proporción `p` deja a la vista `p / 1,78` del cuadro:
 * en 1,78 se ve todo, en 1,3 se ve el 73% —Leonardo todavía entra—, en 1,15 el
 * 65%, y en 1,0 ya sólo el 56% y el plano queda en el hogar y nada más. Debajo
 * de 1,15 conviene el archivo vertical, que muestra la escena entera aunque
 * tenga que rellenar con desenfoque.
 *
 * Por eso no alcanzaba con «¿es un teléfono?»: una ventana de 1.100 × 840 no es
 * angosta y una tablet vertical de 768 tampoco, y sin embargo cada una necesita
 * un archivo distinto.
 */
const CORTE = 1.15;

export const elegirEncuadre = (ancho: number, alto: number): Encuadre =>
  ancho / alto < CORTE ? VERTICAL : APAISADO;

/**
 * Dónde cae `foco` en la pantalla, en porcentaje, replicando la cuenta que hace
 * `object-fit: cover` con su `object-position`. Sale listo para un
 * `radial-gradient(... at X% Y%)`.
 */
export function focoEnPantalla(e: Encuadre, ancho: number, alto: number): { x: number; y: number } {
  const escala = Math.max(ancho / e.w, alto / e.h);
  const dibujado = { w: e.w * escala, h: e.h * escala };
  // Con `cover` el sobrante es negativo: `anclaje` reparte cuánto se va de cada
  // lado, igual que `object-position`.
  const izquierda = (ancho - dibujado.w) * e.anclaje.x;
  const arriba = (alto - dibujado.h) * e.anclaje.y;
  return {
    x: ((izquierda + e.foco.x * dibujado.w) / ancho) * 100,
    y: ((arriba + e.foco.y * dibujado.h) / alto) * 100,
  };
}
