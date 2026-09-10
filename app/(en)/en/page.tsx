/**
 * La portada en inglés. Misma página que `/`, con el idioma puesto por la ruta.
 *
 * ⚠ NO ES UNA TRADUCCION APARTE. Es el mismo `Hero` con los mismos
 * componentes: todo el copy del sitio ya viaja en las tablas bilingües de cada
 * componente, auditadas par por par en D-188. Lo que faltaba era una URL que
 * lo declarara.
 */

import { Hero } from "../../../src/components/Hero.js";

export default function PortadaEn() {
  return <Hero lang="en" />;
}
