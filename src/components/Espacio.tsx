"use client";

/**
 * Cuarta y última sección: el espacio vectorial del índice, dibujado.
 *
 * Las tres de arriba muestran lo que el proyecto hace; ésta, cómo lo hace, y lo
 * muestra antes de explicarlo. Es la única que no habla desde el cuaderno sino
 * desde la máquina que lo lee: de ahí el negro y la grotesca.
 *
 * Es además la casa de «Cómo funciona» — el botón del hero baja hasta acá en
 * vez de abrir el panel allá arriba.
 *
 * INVARIANTES
 * · Three y los 144 KB de la proyección entran por `import()` y `fetch` cuando
 *   la sección se acerca. Hasta entonces esto es una columna de texto (D-162).
 * · La proyección la genera `pipeline/08_proyeccion.py` DESDE EL ÍNDICE. Si el
 *   índice se reconstruye y eso no, el dibujo miente en silencio.
 * · ⚠ LA RUEDA SOLA SCROLLEA LA PÁGINA. Es lo último de una página larga: si el
 *   lienzo se quedara con el gesto, quien baja hasta acá no podría volver a
 *   subir. El zoom son los botones, el pellizco y `⌘`/`Ctrl` + rueda.
 *
 * El diseño está comentado en `globals.css`, junto al CSS que lo sostiene.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAngosto } from "../hooks/useAngosto.js";
import type { Idioma } from "../lib/cliente-chat.js";
import type { DatosEspacio, Espacio as Motor } from "./espacio-motor.js";
import { Explainer } from "./Explainer.js";

const COPY = {
  firma: { es: "Espacio vectorial", en: "Vector space" },
  titulo: "Ask Leonardo da Vinci",
  bajada: {
    es: "El espacio vectorial de la red neuronal",
    en: "The vector space of the neural network",
  },
  /**
   * CUATRO FRASES, NINGÚN NÚMERO Y NINGUNA EXPLICACIÓN. No se le explica nada a
   * nadie: se dice lo que hay, en el orden en que ocurre —el vector, la
   * cercanía, la pregunta, la respuesta— y la última cae encima de todo eso
   * como su rótulo. Llano no es coloquial.
   *
   * ⚠ «VECTORES», NUNCA «FLECHAS». La flecha es el dibujo; el vector es la
   * cosa. Llamarlo por el dibujo es explicarlo hacia abajo.
   *
   * ⚠ NO DICE QUE EL SISTEMA USE LAS 7.500 PÁGINAS (R2). Lo que hay adentro son
   * los pasajes de Richter, no los cuadernos enteros. Por eso dice «los
   * cuadernos» y no un número: es verdad de los dos lados.
   */
  tesis: {
    es: [
      "Una red neuronal convierte cada pasaje de los cuadernos en un vector. La cercanía entre dos es la medida de lo que comparten, y ninguna posición se asignó manualmente: las calcula el modelo a partir del texto. Una pregunta entra al mismo espacio vectorial como un vector más, y la respuesta son los pasajes que quedaron a su alrededor. ",
      "Así funciona Ask Leonardo da Vinci.",
    ],
    en: [
      "A neural network turns every passage of the notebooks into a vector. How close two of them sit is the measure of what they share, and no position was assigned by hand: the model computes them from the text. A question enters that same vector space as one more vector, and the answer is the passages that ended up around it. ",
      "That is how Ask Leonardo da Vinci works.",
    ],
  },
  mas: {
    es: "El porqué y el cómo del proyecto",
    en: "The why and the how of the project",
  },
  pie: {
    es: ["1.402", " pasajes · ", "22", " temas · PCA a 3 dimensiones"],
    en: ["1,402", " passages · ", "22", " themes · PCA to 3 dimensions"],
  },
  pausar: { es: "Pausar", en: "Pause" },
  girar: { es: "Girar", en: "Rotate" },
  colorear: { es: "Colorear", en: "Colour" },
  sinColor: { es: "Sin color", en: "No colour" },
  temas: { es: "Vectores por temas", en: "Vectors by theme" },
  zoom: { es: "Zoom", en: "Zoom" },
  acercar: { es: "Acercar", en: "Zoom in" },
  alejar: { es: "Alejar", en: "Zoom out" },
  pista: { es: "Arrastrá para girar", en: "Drag to rotate" },
  cuantosTemas: { es: "22 temas", en: "22 themes" },
  railAyuda: {
    es: "Tocá uno y se enciende dónde vive en la esfera.",
    en: "Tap one and it lights up where it lives in the sphere.",
  },
  sinNumero: { es: "sin número", en: "no number" },
  sinTitulo: { es: "Sin título", en: "Untitled" },
} as const;

/** Cuánto entra o sale cada toque de los botones de zoom. */
const PASO = 0.12;

type Ficha = { i: number; x: number; y: number } | null;

export function Espacio({
  lang,
  onExplicando,
}: {
  lang: Idioma;
  /** El hero traba el scroll del `body` y esconde su flecha mientras
   *  «Cómo funciona» está abierto, así que tiene que enterarse. */
  onExplicando?: (v: boolean) => void;
}) {
  const seccionRef = useRef<HTMLElement | null>(null);
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);
  const motorRef = useRef<Motor | null>(null);

  const [datos, setDatos] = useState<DatosEspacio | null>(null);
  const [listo, setListo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [porSeccion, setPorSeccion] = useState(false);
  const [encendida, setEncendida] = useState<number | null>(null);
  const [railAbierto, setRailAbierto] = useState(false);
  const [railTocado, setRailTocado] = useState(false);
  const [hondura, setHondura] = useState(0);
  const [ficha, setFicha] = useState<Ficha>(null);
  const [explicando, setExplicando] = useState(false);

  const angosto = useAngosto();

  /*
    SE ARMA CUANDO SE ACERCA, no al cargar la página. `rootMargin` de media
    pantalla: empieza a bajar los 144 KB y el trozo de Three mientras el museo
    todavía ocupa la ventana, así que para cuando la sección entra ya está.
  */
  useEffect(() => {
    const nodo = seccionRef.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return;
    let cancelado = false;
    const ojo = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting) return;
        ojo.disconnect();
        try {
          const r = await fetch("/proyeccion.json");
          const d = (await r.json()) as DatosEspacio;
          if (!cancelado) setDatos(d);
        } catch {
          // Sin datos no hay dibujo, y la columna de texto se sostiene sola.
        }
      },
      { rootMargin: "50% 0px" },
    );
    ojo.observe(nodo);
    return () => {
      cancelado = true;
      ojo.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!datos) return;
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    let vivo = true;
    let motor: Motor | null = null;

    (async () => {
      // ⚠ El import vive acá adentro: es lo que mantiene a Three fuera del
      // bundle de la portada.
      const { construirEspacio } = await import("./espacio-motor.js");
      if (!vivo) return;
      motor = construirEspacio({
        lienzo,
        datos,
        alApuntar: (i, x, y) => setFicha(i === null ? null : { i, x, y }),
        alHundir: setHondura,
        quieto: matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      motorRef.current = motor;
      setListo(true);
    })();

    return () => {
      vivo = false;
      motor?.destruir();
      motorRef.current = null;
      setListo(false);
    };
  }, [datos]);

  useEffect(() => {
    motorRef.current?.pintar(encendida, porSeccion);
  }, [encendida, porSeccion, listo]);

  useEffect(() => {
    motorRef.current?.pausar(pausado);
  }, [pausado, listo]);

  /*
    LA LISTA EMPIEZA ABIERTA donde sobra ancho: los 22 temas son la prueba de
    que la nube no es decoración —tienen nombre, cuenta y un lugar donde se
    encienden— y esconderlos era esconder lo único que explica qué se mira.
    En teléfono no: el cajón ocupa 78vw y taparía la esfera antes de verla.
  */
  useEffect(() => {
    if (railTocado) return;
    setRailAbierto(!angosto);
  }, [angosto, railTocado]);

  const alternarRail = useCallback(() => {
    setRailTocado(true);
    setRailAbierto((v) => !v);
  }, []);

  const cerrarExplicacion = useCallback(() => setExplicando(false), []);

  // Un solo lugar que avisa, y la limpieza avisa que se cerró: si el aviso
  // viviera en cada handler, el que desmonta la sección con el panel abierto
  // dejaría al hero creyendo que sigue abierto.
  useEffect(() => {
    onExplicando?.(explicando);
  }, [explicando, onExplicando]);
  useEffect(() => () => onExplicando?.(false), [onExplicando]);

  const cuenta = datos
    ? datos.sec.reduce<number[]>((acc, s) => {
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, new Array(datos.secciones.length).fill(0))
    : [];

  const colores = motorRef.current?.colores ?? [];
  const t = <K extends keyof typeof COPY>(k: K) =>
    (COPY[k] as Record<Idioma, string>)[lang];

  return (
    <section
      id="espacio"
      ref={seccionRef}
      aria-label={COPY.firma[lang]}
      className="alv-espacio"
    >
      <div className="alv-esp-cab">
        <h2>{COPY.titulo}</h2>
        {/*
          El logo va EN EL MEDIO y no arriba: lo primero que se lee es de
          quién es esto. `alt=""` porque el nombre está escrito al lado — un
          lector de pantalla lo diría dos veces.
        */}
        <img
          className="alv-esp-marca"
          src="/espacio-marca.webp"
          alt=""
          width={360}
          height={300}
          loading="lazy"
          decoding="async"
        />
        <p className="alv-esp-bajada">{COPY.bajada[lang]}</p>
        <p className="alv-esp-tesis">
          {COPY.tesis[lang][0]}
          <b>{COPY.tesis[lang][1]}</b>
        </p>

        <button
          className="alv-esp-mas"
          type="button"
          onClick={() => setExplicando(true)}
        >
          <span>{COPY.mas[lang]}</span>
          {/* Flecha derecha y no diagonal: la diagonal dice «te vas del
              sitio» y esto abre acá mismo. */}
          <svg viewBox="0 0 11 10" aria-hidden="true">
            <path d="M6.1 0 4.7 1.4l2.1 2.1H0v2h6.8L4.7 7.6 6.1 9l4.5-4.5z" />
          </svg>
        </button>

        <p className="alv-esp-pie">
          <b>{COPY.pie[lang][0]}</b>
          {COPY.pie[lang][1]}
          <b>{COPY.pie[lang][2]}</b>
          {COPY.pie[lang][3]}
        </p>
      </div>

      {/*
        LA ESCENA ES UNA CAJA, NO EL FONDO DE LA SECCION. En escritorio ocupa
        todo y la columna se le apoya encima; en teléfono se separan y quedan
        una arriba de la otra. Que sean hermanas —y no una adentro de la otra—
        es lo que deja hacer las dos cosas con `order` y sin duplicar marcado.
      */}
      <div className="alv-esp-escena">
        <canvas ref={lienzoRef} className="alv-esp-lienzo" aria-hidden="true" />
        <div className="alv-esp-vineta" aria-hidden="true" />


        {listo && (
          <p className="alv-esp-pista" data-ver={hondura > 0.1 ? "no" : "si"}>
            {t("pista")}
          </p>
        )}

        {listo && (
          <div className="alv-esp-mandos">
            <button
              type="button"
              aria-pressed={pausado}
              onClick={() => setPausado((v) => !v)}
            >
              <svg viewBox="0 0 9 11" aria-hidden="true">
                {pausado ? (
                  <path d="M0 0.6v9.8a.6.6 0 0 0 .93.5l7.4-4.9a.6.6 0 0 0 0-1L.93.1A.6.6 0 0 0 0 .6z" />
                ) : (
                  <>
                    <rect x="0" y="0" width="3" height="11" rx="1" />
                    <rect x="6" y="0" width="3" height="11" rx="1" />
                  </>
                )}
              </svg>
              {pausado ? t("girar") : t("pausar")}
            </button>

            <span className="alv-esp-sep" />
            <button
              type="button"
              aria-pressed={porSeccion}
              onClick={() => setPorSeccion((v) => !v)}
            >
              {porSeccion ? t("sinColor") : t("colorear")}
            </button>

            <span className="alv-esp-sep" />
            <button
              type="button"
              aria-expanded={railAbierto}
              aria-controls="alv-esp-temas"
              onClick={alternarRail}
            >
              {t("temas")}
            </button>

            <span className="alv-esp-sep" />
            <span className="alv-esp-zoom">
              <button
                type="button"
                className="alv-esp-paso"
                aria-label={t("alejar")}
                onClick={() => motorRef.current?.hundir(-PASO)}
              >
                −
              </button>
              <span aria-live="off">
                {t("zoom")} {Math.round(hondura * 100)}%
              </span>
              <button
                type="button"
                className="alv-esp-paso"
                aria-label={t("acercar")}
                onClick={() => motorRef.current?.hundir(PASO)}
              >
                +
              </button>
            </span>
          </div>
        )}

      {listo && datos && (
        <nav
          className="alv-esp-rail"
          data-abierto={railAbierto ? "si" : "no"}
          aria-label={COPY.cuantosTemas[lang]}
        >
          {/* La lengüeta es el canto del cajón y el botón de la barra es donde
              alguien busca los mandos. Ninguno es redundante mientras los dos
              digan lo mismo: el estado vive acá y los dos lo reflejan. */}
          <button
            className="alv-esp-lengueta"
            type="button"
            aria-expanded={railAbierto}
            aria-controls="alv-esp-temas"
            onClick={alternarRail}
          >
            <span>{COPY.temas[lang]}</span>
          </button>

          <div className="alv-esp-rail-cab">
            <p className="alv-esp-rail-t">{COPY.cuantosTemas[lang]}</p>
          </div>
          <p className="alv-esp-rail-a">{COPY.railAyuda[lang]}</p>

          <div className="alv-esp-temas" id="alv-esp-temas">
            {datos.secciones.map((nombre, i) => {
              const vivo = encendida === null || encendida === i;
              return (
                <button
                  key={nombre}
                  className="alv-esp-tema"
                  type="button"
                  aria-pressed={encendida === i}
                  onClick={() => setEncendida((v) => (v === i ? null : i))}
                >
                  <span
                    className="alv-esp-punto"
                    style={{
                      background: !vivo
                        ? "#2b2926"
                        : porSeccion
                          ? colores[i]
                          : "#e8dfcd",
                    }}
                  />
                  <span className="alv-esp-txt">{nombre}</span>
                  <span className="alv-esp-n">{cuenta[i]}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* La ficha sólo con puntero: en táctil no hay hover y el dedo tapa
          justo lo que la ficha describiría. */}
      {!angosto && datos && (
        <div
          className="alv-esp-ficha"
          role="status"
          aria-live="polite"
          data-ver={ficha ? "si" : "no"}
          style={{
            left: ficha ? Math.min(ficha.x + 18, window.innerWidth - 330) : 0,
            top: ficha ? Math.min(ficha.y + 18, window.innerHeight - 140) : 0,
          }}
        >
          {ficha && (
            <>
              <span className="alv-esp-r">
                {datos.richter[ficha.i] === null
                  ? COPY.sinNumero[lang]
                  : `Richter ${datos.richter[ficha.i]}`}
              </span>
              <span className="alv-esp-t">
                {datos.titulo[ficha.i] || COPY.sinTitulo[lang]}
              </span>
              <span className="alv-esp-s">
                {datos.secciones[datos.sec[ficha.i]]}
              </span>
            </>
          )}
        </div>
      )}

      </div>

      {explicando && <Explainer lang={lang} onCerrar={cerrarExplicacion} />}
    </section>
  );
}
