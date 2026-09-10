/**
 * Layout raíz del INGLES, que vive en `/en`. Ver `src/lib/rutas.ts`.
 *
 * Es el gemelo de `(es)/layout.tsx` y la única diferencia es el idioma: el
 * resto —fuentes, metadatos, `viewport`, datos estructurados— sale de
 * `app/raiz.tsx`, para que no haya dos copias que se separen.
 */

import { Documento, VIEWPORT, metadatosDe } from "../raiz.js";

export const metadata = metadatosDe("en");
export const viewport = VIEWPORT;

export default function LayoutEn({ children }: { children: React.ReactNode }) {
  return <Documento lang="en">{children}</Documento>;
}
