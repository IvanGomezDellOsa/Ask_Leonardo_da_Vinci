/**
 * La portada. Server component a propósito y casi vacío: todo el hero es
 * cliente (video, temporizadores, el modelo de embeddings), y dejarlo en un
 * componente aparte mantiene esta página como el único lugar donde se decide
 * qué se monta en la raíz.
 */

import { Hero } from "../src/components/Hero.js";

export default function Portada() {
  return <Hero />;
}
