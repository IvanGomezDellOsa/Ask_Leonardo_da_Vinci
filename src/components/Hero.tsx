"use client";

/**
 * El hero: la escena del taller con la intro escrita a mano.
 *
 * LAS TRES PIEZAS Y POR QUE ESTAN ASI (ver D-136):
 *
 * 1. LA ESCRITURA. El cronograma se calcula en `src/lib/intro.ts` —duración
 *    por letra proporcional al ancho de trazo, pausas en espacios y
 *    puntuación— y de ahí sale `ESCRITURA.fin`, que es el reloj del que
 *    cuelga todo lo demás. Acá sólo se reparte cada `retraso` a su `<span>`.
 *
 * 2. EL REVELADO EN DOS VELOS. `velo1` es negro pleno y tapa el taller entero
 *    mientras se escribe; cae de golpe (1,1 s) cuando la última letra
 *    termina. `velo2` está debajo y tiene un hueco radial recortado con
 *    `mask-image` sobre el centro-bajo, justo donde arde el fuego: durante
 *    `FASES.brasa` queda opaco, así que por ese hueco se ve el fuego y nada
 *    más. Recién después se disuelve en 2,4 s y aparece el taller. Un solo
 *    velo habría dado un fundido común; son dos porque el fuego tiene que
 *    llegar antes que el resto de la escena.
 *
 * 3. EL VIDEO. Montado con `preload="auto"` pero SIN `autoPlay`: descarga y
 *    decodifica bajo el velo, quieto. `play()` se llama a `fin - 1300 ms`
 *    para que, cuando el velo se abra, el fuego ya esté vivo y no se lo vea
 *    prender ni se lo agarre a mitad de loop.
 *
 * El click en cualquier parte saltea la intro. La intro es linda una vez;
 * quien vuelve no debería tener que esperarla.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ADELANTO_VIDEO, APERTURA, DUR_CH, ESCRITURA, LINEAS, detectarIdioma, fasesDe,
  RESPETAR_MOVIMIENTO_REDUCIDO,
} from "../lib/intro.js";
import { modeloEnCache, useEmbedder } from "../hooks/useEmbedder.js";
import { useAngosto } from "../hooks/useAngosto.js";
import { elegirEncuadre, focoEnPantalla, type Encuadre } from "../lib/encuadre.js";
import type { Idioma } from "../lib/cliente-chat.js";
import { FUENTE } from "./estilos.js";
import { Biblioteca } from "./Biblioteca.js";
import { Codice } from "./Codice.js";
import { Explainer } from "./Explainer.js";

type Fase = "escribiendo" | "brasa" | "abriendo" | "listo";

/**
 * La apertura, en una sola definición. La usan el velo que se disuelve y todo
 * lo que tiene que aparecer con él: si divergen, la escena se parte en dos
 * tiempos y se nota.
 */
const TRANSICION_APERTURA = `opacity ${APERTURA}ms cubic-bezier(.4,.05,.35,1)`;

/** El hueco por el que asoma la brasa, abierto sobre el punto que le pasen. */
const MASCARA_BRASA = (foco: { x: number; y: number }) =>
  `radial-gradient(46vmin 34vmin at ${foco.x.toFixed(1)}% ${foco.y.toFixed(1)}%, transparent 0%, transparent 22%, black 78%)`;

/**
 * LA ESCALERA TIPOGRAFICA, EXPLICITA. Ver D-147.
 *
 * En escritorio el orden decreciente sale solo de los valores del diseño:
 * título 35 → bajada 19,5 → botón 15 → cómo funciona 18 (más chico de peso, va
 * en fina y sin fondo) → pastilla 14. En un teléfono se rompía: el título
 * bajaba a 22,5 con el `clamp`, la bajada caía al piso de 13,5 y «Cómo
 * funciona» se quedaba en 18 px fijos — o sea **más grande que los botones y
 * que la bajada**, justo al revés de la jerarquía.
 *
 * Acá está la escala de teléfono escrita como escala, no repartida en cinco
 * lugares: cada renglón es más chico que el anterior, y se lee de una si algún
 * día alguien la vuelve a tocar.
 */
const ESCALA_MOVIL = {
  // La razón entre titular y bajada es lo que hace la jerarquía, no su tamaño
  // absoluto: en escritorio es 35 / 19,5 = **1,79**. En teléfono había quedado
  // en 1,53 —22,9 sobre 15— y las dos líneas se leían casi como una sola. Con
  // 6,8vw y 3,8vw da 25,5 / 14,25 a 375 px: 1,79, la misma de escritorio.
  titulo: "clamp(23px,6.8vw,35px)",
  bajada: "clamp(13.5px,3.8vw,19.5px)",
  boton: 14,
  como: 13,
  pastilla: 12,
} as const;

const COPY = {
  preguntar: { es: "Preguntar a Leonardo", en: "Ask Leonardo" },
  biblioteca: { es: "Biblioteca", en: "Library" },
  como: { es: "Cómo funciona", en: "How it works" },
  cargando: { es: "Ordenando cuadernos", en: "Sorting notebooks" },
} as const;

export function Hero() {
  const angosto = useAngosto();
  const [fase, setFase] = useState<Fase>("escribiendo");
  const [lang, setLang] = useState<Idioma>("es");
  const [explainerAbierto, setExplainerAbierto] = useState(false);
  /**
   * `false` en el servidor y en el primer render del cliente. Ver D-150.
   *
   * El servidor no sabe el idioma del visitante, así que pinta el titular en
   * castellano como texto plano —queda en el HTML, que es lo que un buscador
   * lee—. Las 140 letras animadas aparecen recién cuando el cliente montó y ya
   * sabe qué idioma escribir. Si el primer render del cliente no coincidiera
   * con el del servidor, la hidratación se rompe.
   */
  const [montado, setMontado] = useState(false);
  const [codiceAbierto, setCodiceAbierto] = useState(false);
  /** La flecha de «hay más abajo». Se apaga al primer scroll. */
  const [pistaScroll, setPistaScroll] = useState(true);
  useEffect(() => {
    const alScrollear = () => {
      if (window.scrollY > 24) setPistaScroll(false);
    };
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, []);

  /**
   * EL ENCUADRE SE RECALCULA EN CADA `resize`, NO UNA VEZ AL MONTAR. Ver D-147.
   *
   * Estaba resuelto con un `useEffect` de dependencias vacías: la fuente
   * quedaba clavada en la que correspondía al primer render y no volvía a
   * mirarse nunca. Agrandar la ventana desde un tamaño de teléfono dejaba el
   * archivo vertical —con su relleno desenfocado— estirado en una pantalla
   * ancha. Se veía roto, y lo estaba.
   *
   * `null` hasta la primera medición: sin `src`, el elemento no arranca a bajar
   * el archivo equivocado para tener que descartarlo un tick después.
   */
  const [encuadre, setEncuadre] = useState<Encuadre | null>(null);
  const [foco, setFoco] = useState({ x: 50, y: 66 });
  useEffect(() => {
    const medir = () => {
      const { innerWidth: a, innerHeight: h } = window;
      const e = elegirEncuadre(a, h);
      // SOLO SI CAMBIO DE ARCHIVO. `elegirEncuadre` devuelve una de dos
      // constantes, así que comparar por identidad alcanza — y sin esta guarda
      // cada evento de `resize` (decenas por segundo al arrastrar un borde)
      // disparaba el efecto que vuelve a llamar `play()` sobre un video que ya
      // estaba corriendo.
      setEncuadre((anterior) => (anterior === e ? anterior : e));
      setFoco((anterior) => {
        const f = focoEnPantalla(e, a, h);
        return anterior.x === f.x && anterior.y === f.y ? anterior : f;
      });
    };
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
    };
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);

  /**
   * `null` mientras se averigua. Ver D-140.
   *
   * ARMAR LA SESION ONNX BLOQUEA EL HILO PRINCIPAL, Y CON EL MODELO YA EN
   * CACHE ESO PASA A LOS ~950 ms — justo en el medio de la escritura. Medido
   * con `PerformanceObserver('longtask')`: 863 ms de bloqueo en el primer
   * segundo y medio, uno solo de 555 ms. Es lo que se veía como tirones en las
   * letras: la animación no se estira —CSS va por reloj, no por cuadros—, se
   * saltea los cuadros que el hilo no dejó pintar.
   *
   * Con el caché FRIO no hace falta esperar: esos ~15 s son red, que no toca
   * el hilo principal, y la sesión se arma mucho después de que la intro
   * terminó. Ahí conviene arrancar ya, porque cada segundo de ventaja cuenta.
   */
  const [enCache, setEnCache] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    void modeloEnCache().then((r) => { if (vivo) setEnCache(r); });
    return () => { vivo = false; };
  }, []);

  /** Si ya se pidió reproducir: un cambio de archivo tiene que retomarlo. */
  const enMarcha = useRef(false);

  const arrancarVideo = useCallback(() => {
    enMarcha.current = true;
    const v = videoRef.current;
    if (!v) return;
    // `play()` rechaza si el navegador bloquea la reproducción; el hero se ve
    // bien igual sobre el primer cuadro, así que no hay nada que hacer con el
    // error salvo no romper.
    void v.play().catch(() => {});
  }, []);

  useEffect(() => {
    // La intro corre para todos: `RESPETAR_MOVIMIENTO_REDUCIDO` está en
    // `false` a pedido del dueño del proyecto (D-139), y el click que la
    // saltea es la salida. Con la perilla en `true`, quien pidió menos
    // movimiento entra directo al taller con el fuego ya corriendo.
    //
    // Se chequea en el efecto y no en el estado inicial porque el servidor no
    // tiene forma de saberlo, y un estado inicial distinto entre servidor y
    // cliente rompe la hidratación.
    // EL IDIOMA SE RESUELVE ACA, EN EL MISMO EFECTO QUE ARMA EL RELOJ. Ver
    // D-150. Si viviera en su propio efecto habría un orden entre los dos que
    // nadie garantiza, y los temporizadores podrían quedar armados sobre el
    // cronograma del idioma equivocado — la escritura terminaría antes o
    // después de que caiga el velo.
    const idioma = detectarIdioma();
    setLang(idioma);
    setMontado(true);

    const quieto =
      RESPETAR_MOVIMIENTO_REDUCIDO &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto) {
      setFase("listo");
      arrancarVideo();
      return;
    }

    const fases = fasesDe(idioma);
    temporizadores.current = [
      setTimeout(arrancarVideo, Math.max(0, fases.escritura - ADELANTO_VIDEO)),
      setTimeout(() => setFase("brasa"), fases.escritura),
      setTimeout(() => setFase("abriendo"), fases.escritura + fases.brasa),
      setTimeout(() => setFase("listo"), fases.escritura + fases.brasa + fases.apertura),
    ];

    const pendientes = temporizadores.current;
    return () => pendientes.forEach(clearTimeout);
  }, [arrancarVideo]);

  // Cambiar el `src` descarta el elemento cargado y lo deja en pausa: si el
  // fuego ya estaba corriendo cuando la ventana cambió de forma, se retoma.
  useEffect(() => {
    if (enMarcha.current) arrancarVideo();
  }, [encuadre, arrancarVideo]);

  // Chrome pausa el video de una pestaña oculta —comprobado: quedaba en 0,5 s
  // con `visibilityState: "hidden"`—. Al volver, el taller tiene que estar
  // encendido, no congelado.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === "visible" && enMarcha.current) {
        videoRef.current?.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  // El `lang` del documento tiene que decir la verdad: es lo que usan el
  // lector de pantalla para elegir voz y el navegador para ofrecer traducir.
  // Se planta "es" en el servidor y se corrige acá cuando el usuario elige.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const saltear = () => {
    if (fase === "listo") return;
    temporizadores.current.forEach(clearTimeout);
    arrancarVideo();
    setFase("listo");
  };

  // Estables: los dos viajan a componentes que los usan como dependencia de un
  // efecto (el Escape). Sin `useCallback` cambian de identidad en cada render
  // —y el hero renderiza una vez por cada punto de la barra de progreso—, así
  // que el listener se desengancha y reengancha ~100 veces por carga.
  const cerrarCodice = useCallback(() => setCodiceAbierto(false), []);
  const cerrarExplainer = useCallback(() => setExplainerAbierto(false), []);

  // Frío: ya. Caliente: cuando la intro terminó. Mientras no se sabe, se espera
  // —son unos pocos ms de leer la Cache API.
  const { estado, progreso } = useEmbedder({
    arrancar: enCache === false || fase === "listo",
  });

  const introVisible = fase !== "listo";
  const escribiendo = montado && fase === "escribiendo";
  /**
   * LA UI ENTRA CON EL TALLER, NO DESPUES. Ver D-143.
   *
   * Antes esperaba a `listo` —o sea, a que el segundo velo terminara de
   * disolverse— y recién ahí encendía, con su propia transición. El resultado
   * era una escena en dos actos: primero aparecía el taller, y un rato después
   * llegaban los botones flotando encima, como si fueran otra cosa pegada.
   *
   * Ahora enciende en `abriendo`, con la MISMA duración y la MISMA curva que el
   * velo (`TRANSICION_APERTURA`): la UI emerge del negro junto con el fuego,
   * en un solo movimiento.
   */
  const uiVisible = fase === "abriendo" || fase === "listo";
  const uiOpacity = uiVisible ? 1 : 0;
  // Clickeable ya durante la apertura: si algo se ve y se puede leer, tiene que
  // poder tocarse. El `stopPropagation` de cada botón evita que ese click caiga
  // además en el `saltear` del contenedor.
  const uiPointer = uiVisible ? "auto" : "none";
  const modeloListo = estado === "listo";
  /**
   * La barra y su rótulo aparecen cuando hay algo que contar, no antes.
   *
   * Desde D-140 la carga arranca al terminar la intro cuando el modelo ya está
   * en caché, así que justo al abrirse el taller el progreso todavía es 0: se
   * veía «Ordenando cuadernos · 0%» clavado un segundo, que es peor que no
   * decir nada. Un 0% no informa —no distingue «no arrancó» de «no avanza»—;
   * el primer número real sí.
   */
  const hayProgreso = !modeloListo && progreso > 0;

  return (
    <>
      <div
        onClick={saltear}
        className="alv-hero"
        style={{
          position: "relative",
          width: "100%",
          overflow: "hidden",
          background: "oklch(13% 0.02 45)",
          fontFamily: FUENTE.titulo,
          color: "oklch(95% 0.01 85)",
        }}
      >
        {/*
          Sin `autoPlay`: arranca por código a `fin - ADELANTO_VIDEO`. `muted` y
          `playsInline` son la condición para que un `play()` programático no lo
          bloquee el navegador; sin ellos la escena se queda en el primer cuadro.
        */}
        <video
          ref={videoRef}
          preload="auto"
          muted
          loop
          playsInline
          aria-hidden="true"
          src={encuadre?.src}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // El mismo anclaje que usa el cálculo del foco: si divergen, el hueco
            // de la brasa apunta a un lugar donde la escena no está.
            objectPosition: `${(encuadre?.anclaje.x ?? 0.5) * 100}% ${(encuadre?.anclaje.y ?? 0.5) * 100}%`,
            zIndex: 0,
          }}
        />

        {/*
          Viñeta: cierra los bordes para que el texto no compita con el fuego. En
          vertical se afloja —el archivo ya trae su propio relleno oscurecido, así
          que la viñeta se sumaba encima y apagaba la escena entera.
        */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            background: angosto
              ? `radial-gradient(ellipse at ${foco.x.toFixed(1)}% ${foco.y.toFixed(1)}%, transparent 46%, oklch(8% 0.02 40 / 0.3) 86%, oklch(6% 0.02 40 / 0.6) 100%)`
              : "radial-gradient(ellipse at 50% 55%, transparent 36%, oklch(8% 0.02 40 / 0.55) 80%, oklch(6% 0.02 40 / 0.88) 100%), " +
                "linear-gradient(to bottom, oklch(6% 0.02 40 / 0.6) 0%, transparent 24%, transparent 68%, oklch(6% 0.02 40 / 0.68) 100%)",
          }}
        />

        {/*
          Piso oscuro: es lo que hace legibles los botones y la bajada sobre la
          llama. Se subió una pizca en la franja del 26–48%, que es exactamente
          donde cae «Por primera vez, un software…»: ahí el fuego es más claro
          que en el resto del cuadro y esa línea, más chica que el título,
          perdía contraste contra las chispas.
        */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            background: angosto
              // El texto de la intro cae sobre el tercio central, que en vertical
              // es la escena nítida y no la mesa: alcanza con menos.
              ? "linear-gradient(to top, oklch(7% 0.02 40 / 0.86) 0%, oklch(7% 0.02 40 / 0.66) 22%, oklch(7% 0.02 40 / 0.34) 46%, oklch(7% 0.02 40 / 0.12) 70%, transparent 100%)"
              : "linear-gradient(to top, oklch(7% 0.02 40 / 0.78) 0%, oklch(7% 0.02 40 / 0.7) 26%, oklch(7% 0.02 40 / 0.52) 48%, oklch(7% 0.02 40 / 0.26) 72%, transparent 100%), " +
                "radial-gradient(105% 46% at 50% 104%, oklch(6% 0.02 40 / 0.5) 0%, transparent 72%)",
          }}
        />

        {introVisible && (
          <>
            {/*
              EL HUECO VA DONDE ESTA EL FUEGO, Y EL FUEGO SE MUEVE. En apaisado
              arde en el centro-bajo del cuadro; en el archivo vertical —que trae
              la escena entera, más chica y centrada— queda al 66% del ancho y a
              media altura. Con la máscara fija, la brasa de la intro asomaba por
              un pedazo de pared.
            */}
            {/*
              VELO 2 — el del hueco. La máscara radial deja un óvalo transparente
              sobre el centro-bajo (donde arde el fuego): mientras este velo está
              opaco, por ahí y sólo por ahí se ve la llama.
            */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 5,
                pointerEvents: "none",
                background: "oklch(6.5% 0.012 40)",
                opacity: fase === "abriendo" ? 0 : 1,
                transition: TRANSICION_APERTURA,
                WebkitMaskImage: MASCARA_BRASA(foco),
                maskImage: MASCARA_BRASA(foco),
              }}
            />
            {/* VELO 1 — negro pleno, sin hueco. Cae cuando termina la escritura. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 5,
                pointerEvents: "none",
                background: "oklch(6.5% 0.012 40)",
                opacity: fase === "escribiendo" ? 1 : 0,
                transition: "opacity 1.1s ease-out",
              }}
            />
          </>
        )}

        {/* Selector de idioma. Oculto durante la intro: no hay nada que elegir todavía. */}
        <div
          style={{
            position: "absolute",
            top: "calc(clamp(20px,3vw,38px) + env(safe-area-inset-top))",
            right: "calc(clamp(20px,3.4vw,46px) + env(safe-area-inset-right))",
            zIndex: 6,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 4,
            background: "oklch(12% 0.02 40 / 0.4)",
            border: "1px solid oklch(88% 0.04 85 / 0.22)",
            borderRadius: 999,
            backdropFilter: "blur(10px)",
            opacity: uiOpacity,
            pointerEvents: uiPointer,
            transition: TRANSICION_APERTURA,
          }}
        >
          {(["es", "en"] as const).map((codigo) => (
            <button
              key={codigo}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLang(codigo);
              }}
              style={{
                fontFamily: FUENTE.lectura,
                fontSize: angosto ? ESCALA_MOVIL.pastilla : 14,
                fontWeight: lang === codigo ? 600 : 500,
                padding: angosto ? "8px 13px" : "7px 15px",
                background: lang === codigo ? "oklch(93% 0.03 85 / 0.92)" : "none",
                border: "none",
                borderRadius: 999,
                color: lang === codigo ? "oklch(20% 0.025 45)" : "oklch(92% 0.02 85 / 0.62)",
                cursor: "pointer",
                letterSpacing: ".12em",
                transition: "all .25s ease",
              }}
            >
              {codigo.toUpperCase()}
            </button>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            // Con `viewport-fit=cover` el hero llega al borde vivo: los botones
            // tienen que subir lo que mida el indicador de inicio, o quedan
            // debajo de él.
            bottom: "calc(clamp(26px,7vh,86px) + env(safe-area-inset-bottom))",
            zIndex: 6,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "clamp(14px,2vh,20px)",
            padding: "0 clamp(20px,5vw,40px)",
          }}
        >
          {/*
            LA INTRO. Va por encima de los dos velos (z-index 6 contra 5): eso es
            lo que hace que durante la escritura se lea texto blanco sobre negro
            pleno, sin taller detrás.

            `aria-label` con la frase entera y el resto oculto: para un lector de
            pantalla, 140 `<span>` sueltos son 140 fragmentos sin sentido.
          */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "clamp(6px,1vh,11px)",
              marginBottom: "clamp(6px,1.2vh,12px)",
              maxWidth: "96vw",
              textAlign: "center",
            }}
          >
            {LINEAS[lang].map((texto, li) => {
              const estilo = {
                margin: 0,
                maxWidth: "96vw",
                fontFamily: FUENTE.manuscrita,
                fontWeight: 400,
                // El segundo número manda en móvil y el tercero en escritorio;
                // con 3.4vw un teléfono caía siempre al piso del clamp y el
                // título quedaba del tamaño de la bajada.
                fontSize: li === 0 ? ESCALA_MOVIL.titulo : ESCALA_MOVIL.bajada,
                lineHeight: li === 0 ? 1.4 : 1.6,
                letterSpacing: ".012em",
                color: li === 0 ? "oklch(98% 0.012 85)" : "oklch(96% 0.014 85 / 0.93)",
                textShadow:
                  li === 0
                    ? "0 2px 14px oklch(6% 0.02 40 / 0.9), 0 0 44px oklch(6% 0.02 40 / 0.7)"
                    : "0 2px 12px oklch(6% 0.02 40 / 0.85)",
              } as const;

              /*
                MIENTRAS SE ESCRIBE, 140 `<span>`; DESPUES, TEXTO Y NADA MAS.
                No es sólo higiene de DOM: las dos líneas quedan de titular del
                hero, así que tienen que seguir al selector de idioma. Con los
                spans puestos, cambiar a inglés reemplazaba el juego entero de
                letras y todas volvían a animarse — la intro se re-escribía sola
                a mitad de la página. Cuando ya no hay nada que animar, es un
                párrafo común y el cambio de idioma es instantáneo.
              */
              if (!escribiendo) {
                return (
                  <p key={li} style={estilo}>
                    {texto}
                  </p>
                );
              }

              return (
                <p key={li} aria-label={texto} style={estilo}>
                  {ESCRITURA[lang].lineas[li]!.map((palabra, wi) => (
                    <span key={wi} aria-hidden="true" style={{ display: "inline-block", whiteSpace: "pre" }}>
                      {palabra.map((c, ci) => (
                        <span
                          key={ci}
                          className="alv-ch"
                          style={{
                            animation: `alv-ink ${DUR_CH}ms cubic-bezier(.3,.7,.4,1) ${c.retraso}ms both`,
                          }}
                        >
                          {c.ch}
                        </span>
                      ))}
                    </span>
                  ))}
                </p>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "clamp(14px,2vh,20px)",
              opacity: uiOpacity,
              pointerEvents: uiPointer,
              transition: TRANSICION_APERTURA,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                width: angosto ? "min(44vw,170px)" : "min(70vw,220px)",
                marginBottom: "clamp(4px,1vh,10px)",
              }}
            >
              <span style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, oklch(84% 0.06 85 / 0.35))" }} />
              <span style={{ width: 4, height: 4, transform: "rotate(45deg)", background: "oklch(84% 0.10 85 / 0.6)" }} />
              <span style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, oklch(84% 0.06 85 / 0.35))" }} />
            </span>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: angosto ? "1fr" : "repeat(auto-fit,minmax(205px,1fr))",
                justifyContent: "center",
                alignItems: "center",
                gap: 14,
                width: angosto ? "min(86vw,340px)" : "min(92vw,434px)",
              }}
            >
              <button
                type="button"
                className="alv-btn-primario"
                onClick={(e) => {
                  e.stopPropagation();
                  setCodiceAbierto(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  height: angosto ? 44 : 46,
                  padding: "0 16px",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                  background: "oklch(95% 0.024 85)",
                  border: "none",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: FUENTE.lectura,
                  fontWeight: 600,
                  fontSize: angosto ? ESCALA_MOVIL.boton : 15,
                  letterSpacing: ".03em",
                  color: "oklch(21% 0.03 45)",
                  boxShadow: "0 8px 22px oklch(5% 0.02 40 / 0.38)",
                  transition: "background .25s ease, box-shadow .25s ease",
                }}
              >
                {COPY.preguntar[lang]}
              </button>

              <button
                type="button"
                className="alv-btn-fantasma"
                onClick={(e) => {
                  e.stopPropagation();
                  document
                    .getElementById("biblioteca")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: angosto ? 44 : 46,
                  padding: "0 16px",
                  whiteSpace: "nowrap",
                  background: "oklch(16% 0.02 40 / 0.2)",
                  border: "1px solid oklch(92% 0.03 85 / 0.32)",
                  borderRadius: 999,
                  backdropFilter: "blur(10px)",
                  cursor: "pointer",
                  fontFamily: FUENTE.lectura,
                  fontWeight: 500,
                  fontSize: angosto ? ESCALA_MOVIL.boton : 15,
                  letterSpacing: ".03em",
                  color: "oklch(96% 0.02 85 / 0.85)",
                  transition: "border-color .25s ease, color .25s ease, background .25s ease",
                }}
              >
                {COPY.biblioteca[lang]}
              </button>
            </div>

            <button
              type="button"
              className="alv-btn-texto"
              onClick={(e) => {
                e.stopPropagation();
                setExplainerAbierto(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                marginTop: "clamp(4px,1vh,10px)",
                background: "none",
                border: "none",
                padding: "8px 4px",
                cursor: "pointer",
                fontFamily: FUENTE.titulo,
                fontSize: angosto ? ESCALA_MOVIL.como : 18,
                letterSpacing: ".03em",
                color: "oklch(93% 0.02 85 / 0.72)",
                transition: "color .25s ease",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: angosto ? 16 : 19,
                  height: angosto ? 16 : 19,
                  border: "1px solid oklch(88% 0.06 85 / 0.5)",
                  borderRadius: 999,
                  fontFamily: FUENTE.lectura,
                  fontSize: angosto ? 9.5 : 11,
                  letterSpacing: 0,
                }}
              >
                ?
              </span>
              {COPY.como[lang]}
            </button>


            {/*
              El progreso de los 129 MB del modelo (D-118): arranca solo, no
              detrás de un botón. Se desvanece al llegar a listo en vez de
              desaparecer, así el hero no da un salto de layout.
            */}
            <p
              style={{
                margin: "clamp(10px,1.6vh,18px) 0 0",
                height: 14,
                lineHeight: "14px",
                fontFamily: FUENTE.lectura,
                fontSize: 11,
                letterSpacing: ".22em",
                textTransform: "uppercase",
                color: "oklch(84% 0.03 85 / 0.5)",
                opacity: hayProgreso ? 1 : 0,
                transition: "opacity .6s ease",
              }}
            >
              <span style={{ animation: "alv-breathe 3.4s ease-in-out infinite" }}>
                {COPY.cargando[lang]} · {progreso}%
              </span>
            </p>
          </div>
        </div>

        {hayProgreso && (
          <div
            style={{
              position: "absolute",
              left: "clamp(14px,2.2vw,30px)",
              right: "clamp(14px,2.2vw,30px)",
              bottom: "calc(clamp(14px,2.2vw,30px) + env(safe-area-inset-bottom))",
              zIndex: 7,
              height: 1,
              background: "oklch(72% 0.06 85 / 0.14)",
              opacity: uiOpacity,
              transition: TRANSICION_APERTURA,
            }}
          >
            <div
              style={{
                height: "100%",
                background: "oklch(76% 0.11 85 / 0.75)",
                transition: "width .3s linear",
                width: `${progreso}%`,
              }}
            />
          </div>
        )}

        {explainerAbierto && <Explainer lang={lang} onCerrar={cerrarExplainer} />}

        {codiceAbierto && <Codice lang={lang} onCerrar={cerrarCodice} />}

        <button
          type="button"
          className="alv-hero-scroll"
          aria-label={COPY.biblioteca[lang]}
          onClick={(e) => {
            e.stopPropagation();
            document
              .getElementById("biblioteca")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          style={{
            opacity: fase === "listo" && pistaScroll ? 1 : 0,
            pointerEvents: fase === "listo" && pistaScroll ? "auto" : "none",
          }}
        >
          <svg width="17" height="10" viewBox="0 0 17 10" fill="none" aria-hidden="true">
            <path
              d="M1 1 L8.5 8.5 L16 1"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/*
        LA BIBLIOTECA ES LA SECCIÓN DE ABAJO, no una ventana encima del hero.
        Se llega scrolleando, y el botón «Biblioteca» es un atajo a lo mismo.
        Montarla siempre no cuesta nada: la estantería no descarga una sola
        imagen —los tomos son gradientes— y las láminas recién se piden cuando
        se abre un volumen.
      */}
      <Biblioteca lang={lang} />
    </>
  );
}
