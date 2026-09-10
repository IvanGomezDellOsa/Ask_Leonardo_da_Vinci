/**
 * `robots.txt`, generado. Hasta acá el sitio devolvía **404** en esta ruta.
 *
 * No es que sin él no se indexe —Google rastrea igual—, pero es donde vive la
 * referencia al sitemap y donde se dice qué no vale la pena visitar. Next lo
 * emite estático en el build, así que no cuesta una invocación de función.
 *
 * ⚠ EL HOST VA CON `www.`: el apex devuelve 308 hacia él (medido contra
 * producción), y un sitemap declarado en el host que redirige es una
 * indirección gratis. Mismo motivo que el `metadataBase` de `layout.tsx`.
 */

import type { MetadataRoute } from "next/types.js";

const SITIO = "https://www.askleonardodavinci.online";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /**
       * `/api/chat` es POST y no devuelve nada a un GET, así que un rastreador
       * no saca nada de ahí — pero cada visita suya gasta una invocación de la
       * función y cuenta contra la cuota de Vercel (R17). Se pide que no pase.
       */
      disallow: "/api/",
    },
    sitemap: `${SITIO}/sitemap.xml`,
    host: SITIO,
  };
}
