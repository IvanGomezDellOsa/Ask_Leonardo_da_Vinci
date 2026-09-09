/**
 * La paleta y las fuentes, tal como salieron del boceto de Claude Design.
 *
 * SON LOS VALORES DEL DISEÑO, NO UNA REINTERPRETACION. Están en oklch porque
 * así se decidieron: dos grises con el mismo lightness se ven igual de claros
 * aunque tengan croma distinto, que es lo que sostiene el contraste del códice
 * sobre el video. Traducirlos a hex habría corrido los tonos.
 *
 * El hero y el códice son dos ambientes distintos a propósito: el hero es
 * cálido (croma sobre el naranja del fuego, hue ~40-85); el códice es casi
 * neutro (croma ~0.006), porque ahí se lee texto largo y el color compite.
 */

/** Las tres familias, vía las variables que planta `app/layout.tsx`. */
export const FUENTE = {
  /** Cormorant Garamond: la voz del hero. */
  titulo: "var(--fuente-titulo), Georgia, serif",
  /** IM Fell English: la intro escrita y los títulos. La que parece pluma. */
  manuscrita: "var(--fuente-manuscrita), Georgia, serif",
  /** Source Serif 4: lectura larga — respuestas y pasajes de Richter. */
  lectura: "var(--fuente-lectura), Georgia, serif",
} as const;

/** Los tonos del códice. */
export const T = {
  panelBg: "oklch(14% 0.004 70)",
  panelGradFrom: "oklch(15% 0.004 70)",
  panelGradTo: "oklch(13% 0.004 70)",
  panelBorde: "oklch(28% 0.006 70)",
  headerLinea: "oklch(26% 0.006 70)",
  titulo: "oklch(89% 0.005 75)",
  nombre: "oklch(58% 0.008 75)",
  cuerpo: "oklch(84% 0.006 75)",
  /**
   * ⚠ ESTOS DOS SUBIERON EN D-255, Y NO POR GUSTO. `tenue` y `notaEtiqueta` se
   * midieron contra el panel (14%), pero el rail del mapa y el cajón de
   * teléfono son `sistemaBg` (18%): ahí los mismos grises valen ~6% menos.
   * `notaEtiqueta` daba **4,04:1** sobre el rail, debajo del 4,5:1 de AA.
   *
   * Los nuevos valores: `tenue` 6,04:1 y `notaEtiqueta` 5,59:1 sobre el rail;
   * 6,40 y 5,91 sobre el panel. **El escalón entre los dos baja de 7 puntos a
   * 2 a propósito**: desde D-255 la jerarquía del rail la da la familia
   * —Cormorant en las secciones— y no un salto de gris.
   */
  tenue: "oklch(66% 0.007 75)",
  bordeIzq: "oklch(30% 0.006 70)",
  cajaBg: "oklch(18% 0.005 70)",
  cajaBorde: "oklch(28% 0.006 70)",
  usuarioBg: "oklch(20% 0.005 70)",
  sistemaBg: "oklch(18% 0.004 70)",
  sistemaTexto: "oklch(70% 0.006 75)",
  notaBorde: "oklch(28% 0.006 70)",
  notaEtiqueta: "oklch(64% 0.008 75)",
  notaTexto: "oklch(78% 0.006 75)",
  pasajeBg: "oklch(17% 0.005 70)",
  pasajeBorde: "oklch(27% 0.006 70)",
  pasajeToggle: "oklch(72% 0.006 75)",
  pasajeTexto: "oklch(80% 0.006 75)",
  cargaBorde: "oklch(26% 0.006 70)",
  cargaEtiqueta: "oklch(60% 0.007 75)",
  pista: "oklch(26% 0.006 70)",
  barra: "oklch(72% 0.006 75)",
  punto: "oklch(60% 0.008 75)",
  campoBorde: "oklch(30% 0.006 70)",
  campoTexto: "oklch(92% 0.005 75)",
  enviarBg: "oklch(90% 0.005 75)",
  enviarTexto: "oklch(15% 0.005 70)",
  explainerBg: "oklch(17% 0.005 70)",
  explainerBorde: "oklch(30% 0.006 70)",
  explainerTexto: "oklch(82% 0.006 75)",
  /**
   * LA SEGUNDA VOZ (D-239). Es el único lugar del códice con un tinte que no
   * pertenece a la paleta del taller —todo lo demás vive en el eje 70-75 de
   * matiz, tierra sobre tierra—. Este se corre al azul: no es una elección
   * decorativa, es la señal de que quien habla no es Leonardo. Si combinara,
   * no cumpliría su función.
   */
  otraVozBg: "oklch(19% 0.014 250)",
  otraVozBarra: "oklch(52% 0.055 250)",
  otraVozEtiqueta: "oklch(66% 0.035 250)",
  otraVozTexto: "oklch(84% 0.018 250)",
} as const;

/**
 * EL ANILLO DE FOCO DEL CODICE (D-255). Vive acá y en `globals.css` —el color,
 * una sola vez— porque antes no vivía en ningún lado: había DOS `:focus-visible`
 * en 2.600 líneas de CSS y los dos estaban afuera del códice, así que quien
 * navega con teclado lo atravesaba entero a ciegas.
 *
 * Es el crema del taller con croma, no un azul de sistema: tiene que leerse
 * como parte del ambiente y no como un contorno del navegador.
 */
export const FOCO = "oklch(72% 0.05 80)";

/**
 * EL ANCHO DE LA COMPOSICION (D-255). El rail y la columna de lectura se topan
 * y se centran JUNTOS. Antes el rail se pegaba al borde izquierdo y la lectura
 * —topada en 760— se centraba en lo que sobraba: a 1.916 px quedaban dos
 * objetos sueltos con 428 px de vacío por lado.
 *
 * ⚠ La lectura sigue en 760 y eso no se toca: es lo que mantiene el largo de
 * línea. Lo que cambia es contra qué se centra.
 */
export const ANCHO_COMPOSICION = 1140;

/**
 * El margen lateral del códice. La columna de lectura tiene 760 px de tope;
 * cuando la ventana da de más, este cálculo mantiene el composer y la barra de
 * carga alineados con el texto en vez de pegados al borde del panel.
 */
export const CANAL = "max(24px, calc((100% - 760px) / 2 + max(5vw, 24px)))";

/** Estilo de lectura base: el de las respuestas y los pasajes. */
export const TEXTO_LECTURA = {
  margin: 0,
  fontFamily: FUENTE.lectura,
  fontSize: 18,
  lineHeight: 1.75,
  fontWeight: 400,
  letterSpacing: ".005em",
  color: T.cuerpo,
} as const;
