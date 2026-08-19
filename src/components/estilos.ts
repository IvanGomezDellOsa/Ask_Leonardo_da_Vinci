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
  tenue: "oklch(63% 0.007 75)",
  bordeIzq: "oklch(30% 0.006 70)",
  cajaBg: "oklch(18% 0.005 70)",
  cajaBorde: "oklch(28% 0.006 70)",
  usuarioBg: "oklch(20% 0.005 70)",
  sistemaBg: "oklch(18% 0.004 70)",
  sistemaTexto: "oklch(70% 0.006 75)",
  notaBorde: "oklch(28% 0.006 70)",
  notaEtiqueta: "oklch(56% 0.008 75)",
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
} as const;

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
