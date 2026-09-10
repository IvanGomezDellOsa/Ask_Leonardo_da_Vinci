/**
 * LO QUE LOS DOS LAYOUTS RAIZ COMPARTEN. Ver `src/lib/rutas.ts`.
 *
 * Desde que hay una URL por idioma hay **dos layouts raíz** —`(es)` y `(en)`—,
 * porque cada uno tiene que emitir su propio `<html lang>`. Todo lo demás
 * —fuentes, metadatos, `viewport`, datos estructurados, las dos mediciones de
 * Vercel— es idéntico y vive acá: dos copias de esto se desincronizan a la
 * primera edición, que es el defecto que el proyecto lleva doce entradas
 * nombrando.
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
/**
 * LAS DOS MEDICIONES DE VERCEL, y las dos obligaron a corregir el aviso de
 * privacidad en el mismo commit (D-221). Su primera línea decía «no hay
 * cuentas, ni cookies, ni analítica» y `21-privacidad.md` avisaba desde D-215
 * que esa frase caducaba el día que entrara analítica. Entró: se corrigió.
 *
 * Analytics no usa cookies ni identifica al visitante, pero **sí manda a Vercel
 * la URL, el referrer y el país** en cada visita. Que no haya cookie no lo
 * vuelve invisible, y en un proyecto cuya tesis es «no me creas, está medido»
 * omitirlo sería exactamente el tipo de silencio que el proyecto le reprocha a
 * los demás.
 *
 * SpeedInsights mide las Core Web Vitals reales, que es lo que R10 fija como
 * meta (LCP < 2,5 s en móvil de gama media con 4G) y que hasta ahora no se
 * había medido nunca contra visitantes de verdad, sólo en local.
 */
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ALTERNATIVAS, RUTA, SITIO, type Idioma } from "../src/lib/rutas.js";
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

const FUENTES = `${cormorant.variable} ${imFell.variable} ${sourceSerif.variable}`;

const TITULO = "Ask Leonardo da Vinci";

/**
 * DOS TEXTOS POR IDIOMA, NO UNO, y lo que los separa es cuánto muestra cada
 * superficie.
 *
 * `DESCRIPCION` la recorta Google cerca de los 155 caracteres: las dos miden
 * menos de 150 y entran enteras también en teléfono. `SOCIAL` la ven LinkedIn,
 * WhatsApp y Slack, que muestran bastante más — ahí el museo puede decir lo
 * único que hay que saber de él, que se recorre a pie.
 *
 * ⚠ NINGUNA DICE QUE EL SISTEMA USE LAS 7.500 PAGINAS. Esas páginas están en
 * escritura especular y sin transcribir; lo que el sistema lee son los 1.504
 * pasajes de la edición de Richter. La primera frase es un dato sobre
 * LEONARDO, no sobre el software: dice por qué esto se puede hacer con él y
 * casi con ningún otro personaje histórico, que es el encuadre del primer
 * párrafo de «Cómo funciona» (D-180) y el de la intro del hero.
 *
 * ⚠ Y NINGUNA DICE «de dominio público». Salió de la versión corta en D-182
 * por ser el permiso legal del proyecto y no una propiedad del texto que el
 * lector va a leer; la description era el último lugar donde seguía vivo,
 * gastando justo los caracteres que Google recorta.
 */
const DESCRIPCION: Record<Idioma, string> = {
  es:
    "Leonardo dejó más de 7.500 páginas. Por primera vez, un software permite " +
    "conversar con él sin inventar nada. Además, biblioteca y museo virtual.",
  en:
    "Leonardo left more than 7,500 written pages. For the first time, software " +
    "lets you speak with him without inventing anything. Plus library and museum.",
};

const SOCIAL: Record<Idioma, string> = {
  es:
    "Leonardo da Vinci dejó más de 7.500 páginas escritas. Por primera vez, un " +
    "software permite conversar con él sin inventar nada. Además, una biblioteca " +
    "y un museo virtual que se recorre a pie.",
  en:
    "Leonardo da Vinci left more than 7,500 written pages. For the first time, " +
    "software lets you speak with him without inventing anything. Plus a library " +
    "and a virtual museum you walk through.",
};

/** Lo que Open Graph llama «locale». Es el idioma, con región. */
const LOCALE: Record<Idioma, string> = { es: "es_AR", en: "en_US" };

export function metadatosDe(lang: Idioma): Metadata {
  const otro: Idioma = lang === "es" ? "en" : "es";
  return {
    /**
     * ⚠ CON `www.`, QUE ES EL HOST CANONICO. Medido contra producción: el apex
     * (`askleonardodavinci.online`) devuelve **308 a `www.`**, así que el que
     * indexa Google y el que abre la gente es el segundo.
     *
     * `metadataBase` es la raíz contra la que se resuelven las URLs absolutas
     * de `openGraph` y `alternates`. Con el apex acá, `og:image` salía
     * apuntando a una URL que redirige: los scrapers que no siguen redirects
     * —los hay— se quedan sin imagen, que es la causa más común de «compartí el
     * link y no mostró nada».
     */
    metadataBase: new URL(SITIO),
    title: TITULO,
    description: DESCRIPCION[lang],
    /**
     * LA CANONICA Y EL `hreflang`, que son la mitad del punto de tener dos
     * rutas. `canonical` colapsa las variantes con query —el `?utm_source=` de
     * cada link compartido— en una sola dirección; `languages` le dice al
     * buscador que estas dos URLs son la misma página en dos idiomas, así no
     * compiten entre sí y le muestra a cada uno la suya.
     *
     * ⚠ LAS DOS PAGINAS DECLARAN EL MISMO MAPA, incluida la propia. Es lo que
     * pide la especificación: un `hreflang` que no se lista a sí mismo, o que
     * no es recíproco, se ignora entero.
     */
    alternates: { canonical: RUTA[lang], languages: ALTERNATIVAS },
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
     * texto sin imagen. Para un proyecto de portfolio, que se comparte por
     * link, es la primera pantalla que ve la mayoría.
     *
     * `og-1200x630.png` lo genera `npm run marca` desde el original de
     * `brand/`. 1200 × 630 es la medida que LinkedIn, WhatsApp y X sirven sin
     * reescalar; el `logo-600x312.png` anterior era el MINIMO que una tarjeta
     * grande acepta y se veía blando en pantallas densas. La imagen no se
     * recorta a mano: el logo es cuadrado y el script lo encaja centrado sobre
     * el mismo fondo, así que la composición es la que decidió el dueño y no un
     * recorte nuevo.
     *
     * El título sale de la misma constante que `title`. La descripción NO: acá
     * va la larga, porque estas tarjetas muestran ~200 caracteres y la de
     * Google está recortada a 150. Son dos textos con dos destinos, no una
     * copia.
     */
    openGraph: {
      type: "website",
      locale: LOCALE[lang],
      alternateLocale: [LOCALE[otro]],
      url: RUTA[lang],
      siteName: TITULO,
      title: TITULO,
      description: SOCIAL[lang],
      images: [{ url: "/og-1200x630.png", width: 1200, height: 630, alt: TITULO }],
    },
    twitter: {
      card: "summary_large_image",
      title: TITULO,
      description: SOCIAL[lang],
      images: ["/og-1200x630.png"],
    },
  };
}

export const VIEWPORT: Viewport = {
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

/**
 * DATOS ESTRUCTURADOS. Es lo que leen Google, LinkedIn y las herramientas de
 * archivo cuando quieren saber QUE es esto sin adivinarlo del texto.
 *
 * Todo lo que se declara acá es comprobable en el propio sitio o en la fuente:
 * el precio (no hay), el idioma de ESTA página, y sobre todo `isBasedOn`, que
 * dice de qué libro sale cada respuesta con su edición, su traductor y su URL.
 * Es la misma tesis del proyecto en formato de máquina — la procedencia viaja
 * con el dato, no en una promesa aparte.
 *
 * ⚠ NO SE DECLARA NADA QUE NO SE PUEDA VERIFICAR. Nada de `aggregateRating`
 * inventado ni `datePublished` aproximado: un dato estructurado falso es una
 * afirmación que el sitio hace sobre sí mismo y que nadie lee antes de
 * publicarla, que es exactamente el modo de fallo que este proyecto persigue.
 */
function datosEstructurados(lang: Idioma) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: TITULO,
    url: SITIO + RUTA[lang],
    description: SOCIAL[lang],
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: lang,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: {
      "@type": "Person",
      name: "Iván Gómez Dell’Osa",
      url: "https://github.com/IvanGomezDellOsa",
    },
    isBasedOn: {
      "@type": "Book",
      name: "The Notebooks of Leonardo Da Vinci",
      author: { "@type": "Person", name: "Leonardo da Vinci" },
      translator: { "@type": "Person", name: "Jean Paul Richter" },
      datePublished: "1888",
      url: "https://www.gutenberg.org/ebooks/5000",
    },
    about: { "@type": "Person", name: "Leonardo da Vinci" },
  };
}

/**
 * El documento entero. Lo llaman los dos layouts raíz con su idioma, y es lo
 * único que cambia entre ellos: `<html lang>` y los metadatos.
 */
export function Documento({ lang, children }: { lang: Idioma; children: React.ReactNode }) {
  return (
    <html lang={lang} className={FUENTES}>
      <body>
        {/*
          `\u003c` en vez de `<`: es lo único que puede cerrar el `</script>`
          antes de tiempo. Los datos son constantes de este archivo y no vienen
          de ningún usuario, pero el escape cuesta nada y la regla vale igual.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(datosEstructurados(lang)).replace(/</g, "\\u003c"),
          }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
