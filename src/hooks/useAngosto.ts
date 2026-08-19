"use client";

/**
 * `true` cuando la ventana es de teléfono. Ver D-144.
 *
 * POR QUE HACE FALTA UN HOOK Y NO ALCANZA CON CSS. Todo el diseño vive en
 * `style={{}}` —así salió de Claude Design y así se integró— y una regla de
 * hoja de estilos no le gana en especificidad a un estilo inline sin
 * `!important`. Las medidas fluidas se resuelven con `clamp()`, que no necesita
 * nada de esto; lo que sí lo necesita son las decisiones que **no son de
 * escala**: que el botón «Volver» pase a ser una flecha sola, que el panel deje
 * de reservar 126 px de cada lado para el encabezado, que las tarjetas de
 * pasaje pierdan la sangría. Eso es otra maqueta, no la misma más chica.
 *
 * ARRANCA EN `false` Y SE CORRIGE EN EL EFECTO. El servidor no tiene forma de
 * saber el ancho de la ventana; devolver algo distinto de lo que el cliente
 * calcula en el primer render rompe la hidratación. Se paga un cuadro con la
 * maqueta ancha, que en un teléfono es imperceptible y siempre preferible a un
 * error de hidratación.
 */

import { useEffect, useState } from "react";

/** El corte. Debajo de esto la maqueta cambia, no sólo encoge. */
const ANGOSTO = "(max-width: 640px)";

export function useAngosto(): boolean {
  const [angosto, setAngosto] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(ANGOSTO);
    const avisar = () => setAngosto(mq.matches);
    avisar();
    // Rotar el teléfono cambia la respuesta: hay que escuchar, no medir una vez.
    mq.addEventListener("change", avisar);
    return () => mq.removeEventListener("change", avisar);
  }, []);

  return angosto;
}
