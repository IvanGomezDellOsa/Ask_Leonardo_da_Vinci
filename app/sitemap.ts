/**
 * `sitemap.xml`, generado. Antes daba 404.
 *
 * SON DOS URLS, UNA POR IDIOMA. No hay más: el códice, la biblioteca y el
 * museo son secciones de la misma página, no rutas, y ninguna navegación
 * cambia la dirección (medido en D-250, que es por lo que la analítica no
 * puede contar nada). Un sitemap corto sigue valiendo la pena: es donde se
 * declara cuáles son las direcciones buenas, sobre todo con el apex
 * redirigiendo al `www.`.
 *
 * ⚠ CADA ENTRADA REPITE EL MAPA DE IDIOMAS, incluido el suyo. Es lo mismo que
 * hacen los `hreflang` del `<head>` y por el mismo motivo: un mapa que no es
 * recíproco se ignora entero. Sale de `ALTERNATIVAS`, así que las dos
 * declaraciones no se pueden separar.
 *
 * ⚠ SIN `lastModified`. Se pondría con la fecha del build, que se mueve en cada
 * despliegue aunque no cambie una palabra del sitio: sería declarar un cambio
 * de contenido que no ocurrió. Google la ignora cuando no le cierra, y acá no
 * le cerraría con razón.
 */

import type { MetadataRoute } from "next/types.js";
import { ALTERNATIVAS, RUTA, SITIO, type Idioma } from "../src/lib/rutas.js";

const absolutas = Object.fromEntries(
  Object.entries(ALTERNATIVAS).map(([k, v]) => [k, SITIO + v]),
);

export default function sitemap(): MetadataRoute.Sitemap {
  return (["es", "en"] as Idioma[]).map((lang) => ({
    url: SITIO + RUTA[lang],
    changeFrequency: "monthly",
    priority: 1,
    alternates: { languages: absolutas },
  }));
}
