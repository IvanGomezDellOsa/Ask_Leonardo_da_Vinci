/**
 * La portada en castellano. Server component a propósito y casi vacío: todo el
 * hero es cliente (video, temporizadores, el modelo de embeddings).
 *
 * EL IDIOMA ENTRA POR PROP Y NO SE DETECTA. Hasta acá `Hero` arrancaba en
 * castellano y lo corregía al montar con `navigator.language`: el HTML servido
 * decía siempre `lang="es"` y la versión inglesa no existía para nadie que no
 * ejecutara JavaScript. Ahora lo decide la ruta, que es lo único que un
 * `hreflang` puede declarar.
 */

import { Hero } from "../../src/components/Hero.js";

export default function Portada() {
  return <Hero lang="es" />;
}
