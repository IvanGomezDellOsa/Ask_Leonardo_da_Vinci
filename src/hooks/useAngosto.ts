"use client";

/**
 * Media queries como estado de React, para las decisiones que NO son de escala.
 *
 * Por qué hace falta un hook y no alcanza con CSS: el diseño vive en
 * `style={{}}` y una hoja de estilos no le gana en especificidad sin
 * `!important`. Las medidas fluidas se resuelven con `clamp()`; esto es para
 * cuando cambia la maqueta o el contenido, no el tamaño.
 *
 * Todos arrancan en `false` y se corrigen en el efecto: el servidor no conoce la
 * ventana, y devolver algo distinto de lo que el cliente calcula en el primer
 * render rompe la hidratación.
 */

import { useEffect, useState } from "react";

/** Debajo de esto la maqueta cambia, no sólo encoge (D-144). */
const ANGOSTO = "(max-width: 640px)";

/**
 * Entrada primaria táctil. Es la pregunta correcta para «¿puede caminar la sala
 * del museo?», que pide teclado y bloqueo de puntero: una tablet mide 1024 px de
 * ancho y no tiene ninguno de los dos. Un portátil con pantalla táctil da
 * `fine`, porque `pointer` describe el dispositivo PRIMARIO.
 */
const SIN_MOUSE = "(pointer: coarse)";

/**
 * Ventana demasiado baja para dibujar la sala del museo. El umbral sale de la
 * cuenta: piso 17% + arco 320 px + aire 30 + rótulo ~98 no entran debajo de
 * 540 px de alto. Es el caso del teléfono en horizontal (390 px de alto).
 */
const CHATA = "(max-height: 540px)";

/** `true` mientras la consulta se cumple. Se resuscribe si la consulta cambia. */
export function useMedia(consulta: string): boolean {
  const [activa, setActiva] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const avisar = () => setActiva(mq.matches);
    avisar();
    // Rotar el teléfono cambia la respuesta: hay que escuchar, no medir una vez.
    mq.addEventListener("change", avisar);
    return () => mq.removeEventListener("change", avisar);
  }, [consulta]);

  return activa;
}

/** Ventana de teléfono. La usan la biblioteca, el códice y el hero. */
export function useAngosto(): boolean {
  return useMedia(ANGOSTO);
}

/** Sin mouse ni teclado: la sala del museo no se puede recorrer. */
export function useSinMouse(): boolean {
  return useMedia(SIN_MOUSE);
}

/** Ventana demasiado baja para que quepa el umbral dibujado. */
export function useChata(): boolean {
  return useMedia(CHATA);
}
