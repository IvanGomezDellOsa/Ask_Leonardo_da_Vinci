"use client";

/**
 * El contacto del hero: la dirección, y las dos formas de usarla.
 *
 * POR QUE NO ES UN `mailto:` Y NADA MAS (D-267).
 *
 * Un `mailto:` le pide al sistema operativo que abra el cliente de correo
 * configurado. En un teléfono siempre hay uno; en un escritorio, casi nunca
 * —quien usa Gmail o Outlook en el navegador no tiene cliente puesto— y
 * entonces no pasa NADA: ni error, ni pestaña, ni aviso. El visitante toca
 * «Contacto», ve la misma pantalla de antes y se va convencido de que el botón
 * está roto. Es la peor falla posible en el único botón que sirve para que
 * alguien escriba.
 *
 * Así que el botón no lleva a ningún lado: abre un panel con la dirección
 * ESCRITA —a la vista, seleccionable y con un botón de copiar— y debajo el
 * `mailto:` para quien sí puede tomarlo. **La dirección a la vista es el camino
 * que funciona siempre; el `mailto:` es el atajo de quien tiene con qué.** Por
 * eso copiar es el botón lleno y abrir el correo es el enlace de texto: el peso
 * lo lleva lo que no puede fallar.
 *
 * IGUAL EN TELEFONO QUE EN ESCRITORIO, y es a propósito. Se podría detectar
 * `(any-pointer: coarse)` y mandar el `mailto:` derecho en un teléfono, donde
 * siempre abre. Dos razones para no hacerlo: copiar también sirve ahí —quien
 * usa Gmail en el navegador del teléfono pega la dirección y listo— y un botón
 * que hace dos cosas distintas según el aparato es un botón que no se puede
 * explicar.
 *
 * NO ES UN `<dialog>` COMO «Cómo funciona», Y NO ES UN OLVIDO. `showModal()`
 * trae el foco encerrado y el resto de la página inerte, que es lo correcto
 * para una pantalla de lectura. Esto es una pastilla de 300 px colgada del
 * botón que la abre: encerrar el foco y apagar la página detrás para mostrar un
 * renglón de texto es desproporcionado, y además un `<dialog>` vive en la capa
 * superior, o sea suelto de su botón — habría que repetir acá los `clamp()` de
 * la esquina del hero para que cayera en su lugar. Colgado del botón en el DOM,
 * cae solo. Lo que el modal daba gratis se pone a mano y son tres cosas: Esc,
 * el clic afuera y el foco que vuelve al botón.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Idioma } from "../lib/cliente-chat.js";
import { FUENTE } from "./estilos.js";

const MAIL = "ivangomezdellosa@gmail.com";

const COPY = {
  es: {
    boton: "Contacto",
    asunto: "Consulta sobre Ask Leonardo da Vinci",
    copiar: "Copiar",
    copiado: "Copiado",
    fallo: "No se copió",
    abrir: "Abrir en tu correo",
    cerrar: "Cerrar",
  },
  en: {
    boton: "Contact",
    asunto: "About Ask Leonardo da Vinci",
    copiar: "Copy",
    copiado: "Copied",
    fallo: "Not copied",
    abrir: "Open in your mail app",
    cerrar: "Close",
  },
} as const;

const CRUZ = (
  <svg viewBox="0 0 11 11" width="9" height="9" fill="currentColor" aria-hidden="true">
    <path d="M9.5.1 5.5 4.1 1.5.1.1 1.5l4 4-4 4 1.4 1.4 4-4 4 4 1.4-1.4-4-4 4-4z" />
  </svg>
);

/** Lo que dura el acuse de «Copiado» antes de volver a ofrecer copiar. */
const ACUSE = 2200;

type Acuse = "quieto" | "copiado" | "fallo";

/**
 * ⚠ LOS VALORES DE LA PASTILLA VIVEN EN LOS DOS LADOS: acá y en el selector de
 * idioma de `Hero.tsx`. Si cambian allá, cambian acá — las dos pastillas
 * comparten esquina y tienen que leerse como una sola pieza de cristal, no como
 * dos que se parecen. No se extrajeron a `estilos.ts` porque los números del
 * selector los fijó D-158 con su propio razonamiento, y mudarlos de archivo era
 * tocar esa decisión para resolver ésta.
 */
const CRISTAL = {
  padding: 4,
  background: "oklch(12% 0.02 40 / 0.4)",
  border: "1px solid oklch(88% 0.04 85 / 0.22)",
  borderRadius: 999,
  // `-webkit-` para Safari anterior a la 18.
  WebkitBackdropFilter: "blur(10px)",
  backdropFilter: "blur(10px)",
} as const;

/** El crema tenue del idioma que no está elegido. Mismo origen que `CRISTAL`. */
const TENUE = "oklch(92% 0.02 85 / 0.62)";

export function Contacto({ lang, angosto }: { lang: Idioma; angosto: boolean }) {
  const t = COPY[lang];
  const [abierto, setAbierto] = useState(false);
  const [acuse, setAcuse] = useState<Acuse>("quieto");
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const copiar = useRef<HTMLButtonElement>(null);
  const direccion = useRef<HTMLParagraphElement>(null);
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cerrar = useCallback((devolverFoco: boolean) => {
    setAbierto(false);
    setAcuse("quieto");
    // Al cerrar con Esc o con la cruz el foco vuelve al botón; al cerrar
    // tocando otra parte, NO: ahí el visitante ya eligió dónde está mirando, y
    // traerle el foco de vuelta a esta esquina se lo saca de encima.
    if (devolverFoco) boton.current?.focus();
  }, []);

  useEffect(() => {
    if (!abierto) return;

    copiar.current?.focus();

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(true);
    };
    // `pointerdown` y no `click`: el panel tiene que irse cuando el visitante
    // empieza a tocar otra cosa, no cuando la suelta. Con `click`, además, el
    // propio botón volvería a abrirlo en el mismo gesto que lo cerró.
    const alTocarAfuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) cerrar(false);
    };

    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alTocarAfuera);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alTocarAfuera);
    };
  }, [abierto, cerrar]);

  // El acuse se borra solo, y el temporizador se limpia al desmontar: el hero
  // se va entero cuando alguien entra a la sala del museo.
  useEffect(() => () => clearTimeout(reloj.current), []);

  /**
   * CUANDO COPIAR FALLA, LA DIRECCION QUEDA SELECCIONADA. `navigator.clipboard`
   * no existe fuera de un contexto seguro y además puede rechazar sin motivo
   * visible —permiso denegado, pestaña sin foco—; comprobado en el navegador
   * integrado, que devuelve `NotAllowedError`. Avisar del fallo y nada más
   * sería dejar al visitante en el mismo callejón que el `mailto:` muerto, así
   * que el fallo hace el trabajo a medias por él: deja la dirección marcada y
   * lista para un Ctrl+C. Si ni eso anda, sigue teniendo `user-select: all`
   * —un triple clic, o un toque sostenido en el teléfono, la toma entera.
   */
  function alCopiar() {
    clearTimeout(reloj.current);

    const fallar = () => {
      setAcuse("fallo");
      const nodo = direccion.current;
      if (!nodo) return;
      const rango = document.createRange();
      rango.selectNodeContents(nodo);
      const seleccion = window.getSelection();
      seleccion?.removeAllRanges();
      seleccion?.addRange(rango);
    };

    // El `try` no sobra: además de rechazar la promesa, `writeText` puede
    // tirar en el acto —o no existir— según el navegador y el contexto.
    try {
      const pedido = navigator.clipboard?.writeText(MAIL);
      if (pedido) pedido.then(() => setAcuse("copiado"), fallar);
      else fallar();
    } catch {
      fallar();
    }

    reloj.current = setTimeout(() => setAcuse("quieto"), ACUSE);
  }

  return (
    <div
      ref={raiz}
      /*
       * ⚠ SIN `position`, Y ES LO QUE HACE QUE EL PANEL CAIGA EN SU LUGAR.
       *
       * El panel es `absolute` y busca al antepasado posicionado más cercano.
       * Si esta caja fuera `relative`, sería ella: el panel colgaría alineado
       * con el BOTON, que no está en el canto de la pantalla —a su derecha
       * queda el selector de idioma—. Con 300 px de ancho y el botón a 128 del
       * borde, en un teléfono de 375 el panel arrancaba en −53 y el hero, que
       * tiene `overflow: hidden`, le cortaba la dirección por la mitad.
       * Comprobado a 375 × 812.
       *
       * Sin `position`, el antepasado pasa a ser la esquina del hero, y el
       * panel queda a plomo con el canto de las dos pastillas: cae adentro en
       * cualquier ancho y se lee como la esquina abriéndose, no como un menú
       * colgado del medio. `top: 100%` mide esa misma caja, que tiene el alto
       * de las pastillas — o sea, lo mismo que medía antes.
       */
      style={{ display: "flex", alignItems: "center" }}
      /* Un clic en cualquier parte del hero saltea la intro, y abrir el
         contacto no es saltearla. Es el mismo `stopPropagation` que lleva el
         selector de idioma, y acá cubre también el panel. */
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ ...CRISTAL, display: "flex", alignItems: "center" }}>
        <button
          ref={boton}
          type="button"
          className="alv-contacto-boton"
          aria-haspopup="dialog"
          aria-expanded={abierto}
          onClick={() => (abierto ? cerrar(true) : setAbierto(true))}
          style={{
            display: "inline-block",
            padding: angosto ? "7px 12px" : "6px 14px",
            background: "none",
            border: "none",
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: FUENTE.lectura,
            fontSize: angosto ? 11 : 13,
            fontWeight: 500,
            letterSpacing: ".12em",
            color: TENUE,
            /*
             * ⚠ `color` Y NO `all`, QUE ES LO QUE USA EL SELECTOR DE IDIOMA.
             *
             * Con `all`, el `outline` del `:focus-visible` entra en la lista de
             * propiedades que transicionan: el anillo del teclado aparecía
             * desvaneciéndose y con el grosor moviéndose de los 3 px del
             * navegador a los 2 nuestros. Medido en el navegador —tres
             * transiciones corriendo, `outline-color`, `outline-offset` y
             * `outline-width`—: quien navega sin mouse tiene que ver dónde está
             * parado en el acto, no dentro de un cuarto de segundo.
             *
             * Acá lo único que cambia al pasar por encima es el color, así que
             * nombrarlo no pierde nada. El selector de al lado sí necesita más
             * de uno —fondo, color y peso a la vez—, y por eso allá quedó `all`.
             */
            transition: "color .25s ease",
          }}
        >
          {t.boton}
        </button>
      </div>

      {abierto && (
        <div
          role="dialog"
          aria-label={t.boton}
          className="alv-contacto-panel"
          style={{
            position: "absolute",
            // Colgado del borde de abajo de la esquina y a plomo con su canto
            // derecho: si la esquina del hero se mueve, el panel se mueve con
            // ella y no hay ni un `clamp()` repetido. Ver el ⚠ de la raíz.
            top: "calc(100% + 10px)",
            right: 0,
            // Nunca más ancho que la ventana menos los márgenes del hero.
            // ⚠ `border-box` no es global en este proyecto: sin esto los 300 px
            // son los del CONTENIDO y la caja termina midiendo 338, con lo cual
            // el tope de `100vw - 44px` deja de ser un tope.
            boxSizing: "border-box",
            width: "min(300px, calc(100vw - 44px))",
            padding: "16px 18px 18px",
            background: "oklch(13% 0.018 45 / 0.94)",
            border: CRISTAL.border,
            borderRadius: 14,
            WebkitBackdropFilter: "blur(16px)",
            backdropFilter: "blur(16px)",
            // El filo de luz de arriba es lo que lo apoya sobre la escena en vez
            // de pegarlo encima. Mismo recurso que el panel de «Cómo funciona».
            boxShadow:
              "0 24px 60px oklch(5% 0.02 40 / 0.55), inset 0 1px 0 oklch(96% 0.03 85 / 0.08)",
            textAlign: "left",
          }}
        >
          <button
            type="button"
            className="alv-contacto-cerrar"
            aria-label={t.cerrar}
            onClick={() => cerrar(true)}
          >
            {CRUZ}
          </button>

          {/* El volado repite el rótulo del botón que abrió esto: quien entró
              sabe que llegó adonde quería antes de leer nada. */}
          <p
            style={{
              margin: 0,
              fontFamily: FUENTE.lectura,
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: "oklch(88% 0.03 85 / 0.5)",
            }}
          >
            {t.boton}
          </p>

          <p
            ref={direccion}
            style={{
              margin: "9px 0 15px",
              fontFamily: FUENTE.lectura,
              fontSize: angosto ? 14 : 15,
              lineHeight: 1.35,
              letterSpacing: ".01em",
              color: "oklch(96% 0.014 85)",
              // Si copiar falla, esto es el plan B: un triple clic la toma
              // entera. Y `anywhere` en vez de `break-all`, para que la
              // dirección se parta sólo cuando de verdad no entra.
              userSelect: "all",
              overflowWrap: "anywhere",
            }}
          >
            {MAIL}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button
              ref={copiar}
              type="button"
              className="alv-contacto-copiar"
              onClick={alCopiar}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 36,
                /*
                 * ⚠ EL ANCHO ES EL DEL ROTULO MAS LARGO DE LOS SEIS, medido en
                 * el navegador con la fuente puesta: «No se copió» da 107 px con
                 * el relleno incluido, contra 100 de «Copiado ✓», 92 de
                 * «Copied ✓» y 76 de «Copiar». Sin esto el botón se ensancha al
                 * acusar y empuja al enlace de al lado —y en el caso del fallo
                 * lo tiraba al renglón de abajo—, o sea que el panel se sacudía
                 * justo cuando hay que leer lo que dice.
                 *
                 * Si alguno de los rótulos de `COPY` crece, este número crece.
                 */
                minWidth: 108,
                padding: "0 16px",
                background: "oklch(95% 0.024 85)",
                border: "none",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: FUENTE.lectura,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: ".03em",
                color: "oklch(21% 0.03 45)",
                transition: "background .25s ease",
              }}
            >
              {/* El acuse es el rótulo, y por eso lleva `aria-live`: cambiar el
                  nombre accesible de un botón que YA tiene el foco no se anuncia
                  solo. */}
              <span aria-live="polite">
                {acuse === "copiado" ? `${t.copiado} ✓` : acuse === "fallo" ? t.fallo : t.copiar}
              </span>
            </button>

            <a
              className="alv-contacto-mailto"
              href={`mailto:${MAIL}?subject=${encodeURIComponent(t.asunto)}`}
              style={{
                fontFamily: FUENTE.lectura,
                fontSize: 12.5,
                letterSpacing: ".01em",
                color: TENUE,
                textDecoration: "underline",
                textUnderlineOffset: 3,
                textDecorationColor: "oklch(92% 0.02 85 / 0.3)",
                transition: "color .25s ease, text-decoration-color .25s ease",
              }}
            >
              {t.abrir}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
