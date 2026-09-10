/**
 * UNA URL POR IDIOMA. Ver el cambio de D-150.
 *
 * Hasta acá el idioma era estado de React: el sitio se servía en una sola
 * dirección, arrancaba en castellano y el cliente lo corregía al montar según
 * `navigator.language`. Funcionaba para el visitante y **no para un buscador**,
 * que lee el HTML servido: `<html lang="es">`, título y descripción en
 * castellano, una sola URL. El sitio entero estaba traducido y era invisible en
 * inglés.
 *
 * Ahora el idioma lo decide la ruta, que es lo que un `hreflang` puede
 * declarar. Las dos páginas siguen siendo **estáticas** —se prerenderizan en el
 * build y las sirve el borde—, que era la condición: `generateMetadata` leyendo
 * `Accept-Language` habría dado lo mismo en SEO al precio de convertir cada
 * visita en una invocación de función, y de perder el `X-Vercel-Cache: HIT` que
 * hoy sostiene la portada aunque la función esté caída (D-222).
 *
 * ⚠ NO HAY REDIRECCION AUTOMATICA POR IDIOMA, y no es un olvido. Mandar a
 * alguien a otra URL por su `Accept-Language` deja al visitante sin forma de
 * volver y confunde al rastreador, que llega con las cabeceras de otro país.
 * El `hreflang` de abajo hace el trabajo bien: el buscador elige la versión que
 * corresponde y la persona tiene el selector a la vista.
 */

export type Idioma = "es" | "en";

/** El host canónico. El apex devuelve 308 hacia él. */
export const SITIO = "https://www.askleonardodavinci.online";

/** Dónde vive cada idioma. El castellano es la raíz: es la lengua del proyecto. */
export const RUTA: Record<Idioma, string> = { es: "/", en: "/en" };

export const OTRO: Record<Idioma, Idioma> = { es: "en", en: "es" };

/**
 * El mapa que `alternates.languages` necesita, más `x-default`.
 *
 * `x-default` apunta al castellano porque es la raíz y la lengua del proyecto:
 * es lo que se le sirve a quien no cae en ninguno de los dos idiomas.
 */
export const ALTERNATIVAS: Record<string, string> = {
  es: RUTA.es,
  en: RUTA.en,
  "x-default": RUTA.es,
};
