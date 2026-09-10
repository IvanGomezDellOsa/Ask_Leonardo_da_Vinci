/**
 * Layout raíz del CASTELLANO, que vive en `/`. Ver `src/lib/rutas.ts`.
 *
 * Son dos layouts raíz —uno por grupo de rutas— porque cada uno emite su
 * propio `<html lang>`, y eso no se puede hacer desde un layout compartido.
 * Todo lo que no es el idioma vive en `app/raiz.tsx`.
 */

import { Documento, VIEWPORT, metadatosDe } from "../raiz.js";

export const metadata = metadatosDe("es");
export const viewport = VIEWPORT;

export default function LayoutEs({ children }: { children: React.ReactNode }) {
  return <Documento lang="es">{children}</Documento>;
}
