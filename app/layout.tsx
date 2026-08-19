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

export const metadata: Metadata = {
  title: "Ask Leonardo da Vinci",
  description:
    "Conversá con Leonardo da Vinci fundado exclusivamente en sus cuadernos: " +
    "la traducción de J. P. Richter (1888), de dominio público. Cada respuesta " +
    "trae los pasajes que la sostienen. Si no está en sus cuadernos, lo dice.",
  icons: { icon: "/favicon-64.webp", apple: "/logo-180.webp" },
};

export const viewport: Viewport = {
  themeColor: "oklch(13% 0.02 45)",
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
