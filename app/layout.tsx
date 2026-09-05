/**
 * El layout raíz. Primer archivo visual del proyecto: hasta acá no existía
 * `app/page.tsx` ni una línea de CSS, y era a propósito (el diseño lo decide
 * el dueño del proyecto, no se genera solo).
 *
 * LAS TRES TIPOGRAFIAS SE SIRVEN DESDE EL PROPIO DOMINIO, no desde
 * fonts.googleapis.com como traía el boceto. `next/font` las descarga en build
 * y las emite como assets estáticos: se ahorran dos conexiones a un tercero en
 * el momento más caro de la página —el mismo en que ya arranca la descarga de
 * 129 MB del modelo (D-118)— y desaparece el flash de texto sin estilar, que
 * en una intro que se escribe letra por letra sería fatal.
 *
 * `display: "swap"` igual: si la fuente tardara, la intro arranca con la
 * serif del sistema antes que no arrancar.
 */

// SIN ".js", al revés que el resto de los imports de "next" en este repo
// (D-121). No es un olvido: `next/font/google` no es un módulo que se importe,
// es un specifier que Turbopack intercepta para descargar las fuentes en build.
// Con `/index.js` el interceptor no lo reconoce y el archivo real no exporta
// nada — el build falla con "the module has no exports at all".
import { Cormorant_Garamond, IM_Fell_English, Source_Serif_4 } from "next/font/google";
import type { Metadata, Viewport } from "next/types.js";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--fuente-titulo",
  display: "swap",
});

/** La de la intro y los títulos: es la que tiene que parecer escrita a mano. */
const imFell = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--fuente-manuscrita",
  display: "swap",
});

/** La de lectura larga: las respuestas y los pasajes de Richter. */
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--fuente-lectura",
  display: "swap",
});

const TITULO = "Ask Leonardo da Vinci";
const DESCRIPCION =
  "Conversá con Leonardo da Vinci fundado exclusivamente en sus cuadernos: " +
  "la traducción de J. P. Richter (1888), de dominio público. Cada respuesta " +
  "trae los pasajes que la sostienen. Si no está en sus cuadernos, lo dice.";

export const metadata: Metadata = {
  metadataBase: new URL("https://askleonardodavinci.online"),
  title: TITULO,
  description: DESCRIPCION,
  /**
   * Las cuatro medidas del juego de iconos, no dos. `logo-256` y `logo-512`
   * estaban en `public/` sin que nada las nombrara (D-196): declaradas, el
   * navegador elige la que le sirve y en una pestaña a 2× o en un marcador de
   * escritorio deja de escalar los 64 px.
   */
  icons: {
    icon: [
      { url: "/favicon-64.webp", sizes: "64x64", type: "image/webp" },
      { url: "/logo-256.webp", sizes: "256x256", type: "image/webp" },
      { url: "/logo-512.webp", sizes: "512x512", type: "image/webp" },
    ],
    apple: "/logo-180.webp",
  },
  /**
   * SIN ESTO, EL LINK COMPARTIDO NO MUESTRA NADA. No había `openGraph` ni
   * `twitter`: en LinkedIn, WhatsApp o Slack el sitio salía como una tira de
   * texto sin imagen. Para un proyecto de portfolio, que se comparte por link,
   * es la primera pantalla que ve la mayoría.
   *
   * `logo-600x312.png` es 1,92:1 —la razón que pide Open Graph— y estaba en
   * `public/` sin que nada lo usara: se hizo para esto y nunca se conectó.
   * 600 × 312 es el mínimo que las tarjetas grandes aceptan; si alguna vez se
   * exporta a 1200 × 630 se ve más nítido y no hay que tocar nada más acá.
   *
   * Los textos salen de las mismas dos constantes que `title` y `description`:
   * tres copias del mismo texto se desincronizan a la primera edición.
   */
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: TITULO,
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: "/logo-600x312.png", width: 600, height: 312, alt: TITULO }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
    images: ["/logo-600x312.png"],
  },
};

export const viewport: Viewport = {
  /**
   * EN HEXA Y NO EN OKLCH, que es la única excepción a la paleta del proyecto.
   * `theme-color` lo parsea el navegador fuera de la hoja de estilos, y los que
   * no entienden `oklch()` descartan la etiqueta entera y pintan su barra con el
   * color por omisión. `#0e0503` es el mismo color, calculado, no elegido.
   */
  themeColor: "#0e0503",
  colorScheme: "dark",
  /**
   * `cover`: el hero es una escena a pantalla completa y tiene que llegar
   * hasta abajo de todo, por debajo del indicador de inicio del teléfono. El
   * precio es que a partir de acá **el contenido que no puede quedar tapado
   * necesita `env(safe-area-inset-*)` explícito** — sin `cover` esos valores
   * son siempre 0 y el navegador reserva la franja por su cuenta.
   *
   * `resizes-content`: cuando se abre el teclado, la ventana **se achica** en
   * vez de que el teclado se monte encima. Es lo que mantiene el botón
   * «Consultar» a la vista mientras se escribe; con el comportamiento por
   * omisión el composer queda debajo del teclado y hay que scrollear a ciegas.
   */
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${cormorant.variable} ${imFell.variable} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
