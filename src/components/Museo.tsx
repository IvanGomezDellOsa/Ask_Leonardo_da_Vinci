"use client";

/**
 * EL MUSEO: una pasarela caminable con las nueve obras colgadas de telones.
 *
 * LAS CUATRO DECISIONES Y POR QUE (D-162):
 *
 * 1. NADA SE CARGA HASTA QUE ALGUIEN ENTRA. Three.js son 99 KB comprimidos y
 *    las nueve texturas ~1,3 MB, y la enorme mayoría de los visitantes no va a
 *    entrar acá. El `import()` dinámico vive dentro del handler del botón, así
 *    que el bundle de la portada no crece un byte. Es la misma regla que la
 *    biblioteca: la estantería no pide una imagen hasta que abrís un volumen.
 *
 * 2. TELONES Y NO CUADROS. Un cuadro colgado es un plano con una textura, y
 *    entonces el 3D no aporta nada que una foto no diera. Una tela que cuelga,
 *    ondea y se aparta cuando pasás al lado sólo existe si hay un espacio y un
 *    cuerpo que lo recorre. La física es el argumento de la sección.
 *
 * 3. SOLO ESCRITORIO, Y SE DICE. Pide teclado, mouse y bloqueo de puntero. En
 *    un teléfono no hay forma honesta de dar esto, así que no se da una versión
 *    peor: se explica y se ofrece la biblioteca, que muestra las mismas obras y
 *    ahí sí funciona con el dedo.
 *
 * 4. LA SALIDA ESTA SIEMPRE. `Escape` suelta el puntero y vuelve el cartel; es
 *    el mismo gesto que el navegador ya impone, y por eso el overlay reaparece
 *    solo en vez de dejar a alguien atrapado adentro.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BIBLIOTECA } from "../data/biblioteca.js";
import { useAngosto } from "../hooks/useAngosto.js";
import type { Idioma } from "../lib/cliente-chat.js";
import type { Museo as MotorMuseo, ObraMuseo } from "./museo-motor.js";
import { FUENTE } from "./estilos.js";
import medidas from "../../public/biblioteca/medidas.json" with { type: "json" };

const COPY = {
  firma: { es: "Museo", en: "Museum" },
  bajada: {
    es: "Nueve obras colgadas de telones, en una sala que se recorre.",
    en: "Nine works hung on cloth, in a room you walk through.",
  },
  entrar: { es: "Entrar a la sala", en: "Enter the room" },
  volver: { es: "Salir", en: "Leave" },
  cargando: { es: "Levantando los telones", en: "Raising the cloth" },
  controles: {
    es: "WASD para caminar · mouse para mirar · Esc para salir",
    en: "WASD to walk · mouse to look · Esc to leave",
  },
  soloEscritorio: {
    es: "La sala necesita teclado y mouse, así que no abre en un teléfono. Las mismas nueve obras están en la biblioteca, hoja a hoja y con lupa.",
    en: "The room needs a keyboard and a mouse, so it does not open on a phone. The same nine works are in the library, leaf by leaf and with a loupe.",
  },
  irBiblioteca: { es: "Ir a la biblioteca", en: "Go to the library" },
  sinWebgl: {
    es: "Este navegador no tiene WebGL disponible, así que la sala no puede dibujarse.",
    en: "This browser has no WebGL available, so the room cannot be drawn.",
  },
} as const;

/** ¿Hay WebGL? Se pregunta una vez y con un canvas que se tira enseguida. */
function hayWebgl(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

type Estado = "cerrado" | "cargando" | "adentro" | "pausado" | "sinWebgl";

export function Museo({ lang }: { lang: Idioma }) {
  const angosto = useAngosto();
  const [estado, setEstado] = useState<Estado>("cerrado");
  const [progreso, setProgreso] = useState(0);
  const [enfocada, setEnfocada] = useState<number | null>(null);
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);
  const motorRef = useRef<MotorMuseo | null>(null);

  /**
   * LAS OBRAS SALEN DEL CATALOGO, NO DE UNA LISTA APARTE. Es el mismo tomo que
   * la biblioteca muestra hoja a hoja: si mañana se agrega una lámina a
   * «Obras», aparece acá sin que nadie toque este archivo. Y la proporción de
   * cada telón sale de `medidas.json`, que lo estampa `npm run biblioteca` —
   * una tela con la forma equivocada deforma el cuadro.
   */
  const obras: ObraMuseo[] = useMemo(() => {
    const tomo = BIBLIOTECA.find((l) => l.id === "obras");
    if (!tomo?.destino) return [];
    return tomo.laminas.map((lamina) => {
      const m = (medidas as Record<string, { ancho: number; alto: number }>)[
        `${tomo.destino}/${lamina.slug}`
      ];
      return {
        slug: lamina.slug,
        url: `/biblioteca/${tomo.destino}/${lamina.slug}.webp`,
        ratio: m ? m.ancho / m.alto : 0.75,
        titulo: lamina.titulo[lang],
        nota: lamina.nota[lang],
      };
    });
  }, [lang]);

  const entrar = useCallback(async () => {
    if (!hayWebgl()) {
      setEstado("sinWebgl");
      return;
    }
    setEstado("cargando");
    setProgreso(0);
    // El import vive acá adentro: es lo que mantiene a Three fuera del bundle
    // de la portada.
    const { construirMuseo } = await import("./museo-motor.js");
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    motorRef.current = construirMuseo({
      lienzo,
      obras,
      alEnfocar: setEnfocada,
      alSoltarPuntero: () => setEstado((v) => (v === "adentro" ? "pausado" : v)),
      alCargar: setProgreso,
    });
    motorRef.current.andar();
    setEstado("adentro");
    motorRef.current.tomarPuntero();
  }, [obras]);

  const salir = useCallback(() => {
    motorRef.current?.destruir();
    motorRef.current = null;
    setEstado("cerrado");
    setEnfocada(null);
    setProgreso(0);
  }, []);

  // El motor se va con el componente, pase lo que pase.
  useEffect(() => () => motorRef.current?.destruir(), []);

  useEffect(() => {
    const alRedimensionar = () => motorRef.current?.redimensionar();
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, []);

  /*
   * Mientras se camina, el scroll de la página se apaga. Sin esto, la rueda
   * del mouse manda la página a la biblioteca mientras el visitante está
   * adentro de la sala.
   */
  useEffect(() => {
    if (estado !== "adentro") return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [estado]);

  const obra = enfocada !== null ? obras[enfocada] : null;
  const dentro = estado === "adentro" || estado === "pausado" || estado === "cargando";

  return (
    <section
      id="museo"
      aria-label={COPY.firma[lang]}
      className="alv-museo"
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "oklch(95.6% 0.006 85)",
        color: "oklch(24% 0.008 70)",
        fontFamily: FUENTE.lectura,
      }}
    >
      <canvas
        ref={lienzoRef}
        className="alv-museo-lienzo"
        // El lienzo no es contenido: lo que hay adentro se describe abajo, en
        // la lista que un lector de pantalla sí puede recorrer.
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: dentro ? "block" : "none",
          // `grab` y no `none`: con el puntero bloqueado el navegador esconde
          // el cursor solo, y cuando lo niega el paseo se hace arrastrando —
          // ahí un cursor invisible dejaría a alguien sin saber qué hacer.
          cursor: estado === "adentro" ? "grab" : "default",
        }}
      />

      {/* ---- La portada de la sección ---- */}
      {!dentro && (
        <div className="alv-museo-portada">
          <span className="alv-museo-firma">{COPY.firma[lang]}</span>
          <h2 className="alv-museo-titulo" style={{ fontFamily: FUENTE.titulo }}>
            {COPY.bajada[lang]}
          </h2>

          {angosto ? (
            <>
              <p className="alv-museo-nota">{COPY.soloEscritorio[lang]}</p>
              <button
                type="button"
                className="alv-museo-boton"
                onClick={() =>
                  document.getElementById("biblioteca")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {COPY.irBiblioteca[lang]}
              </button>
            </>
          ) : estado === "sinWebgl" ? (
            <p className="alv-museo-nota">{COPY.sinWebgl[lang]}</p>
          ) : (
            <>
              <button type="button" className="alv-museo-boton" onClick={entrar}>
                {COPY.entrar[lang]}
              </button>
              <p className="alv-museo-controles">{COPY.controles[lang]}</p>
            </>
          )}

          {/*
            LO QUE HAY ADENTRO, EN TEXTO. Una sala 3D no tiene equivalente para
            quien navega con teclado o con lector de pantalla, y no ofrecerle
            nada sería peor que ofrecerle la lista. Está oculta a la vista y
            disponible para quien la necesita.
          */}
          <ul className="alv-visualmente-oculto">
            {obras.map((o) => (
              <li key={o.slug}>
                {o.titulo}. {o.nota}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Cargando ---- */}
      {estado === "cargando" && (
        <div className="alv-museo-capa">
          <span className="alv-museo-firma">{COPY.cargando[lang]}</span>
          <div className="alv-museo-barra">
            <span style={{ width: `${Math.round(progreso * 100)}%` }} />
          </div>
        </div>
      )}

      {/* ---- Pausado: el puntero se soltó ---- */}
      {estado === "pausado" && (
        <div className="alv-museo-capa" data-tocable="si">
          <p className="alv-museo-controles">{COPY.controles[lang]}</p>
          <button
            type="button"
            className="alv-museo-boton"
            onClick={() => {
              setEstado("adentro");
              motorRef.current?.tomarPuntero();
            }}
          >
            {COPY.entrar[lang]}
          </button>
          <button type="button" className="alv-museo-linea" onClick={salir}>
            {COPY.volver[lang]}
          </button>
        </div>
      )}

      {/* ---- La cartela de la obra que se tiene delante ---- */}
      {estado === "adentro" && obra && (
        <div className="alv-museo-cartela" key={obra.slug}>
          <span className="alv-museo-cartela-titulo" style={{ fontFamily: FUENTE.titulo }}>
            {obra.titulo}
          </span>
          <span className="alv-museo-cartela-nota">{obra.nota}</span>
        </div>
      )}

      {estado === "adentro" && (
        <button type="button" className="alv-museo-salir" onClick={salir}>
          {COPY.volver[lang]}
        </button>
      )}
    </section>
  );
}
