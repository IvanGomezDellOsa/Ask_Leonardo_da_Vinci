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
  ADELANTO_VIDEO, APERTURA, DUR_CH, ESCRITURA, LINEAS, fasesDe,
  RESPETAR_MOVIMIENTO_REDUCIDO,
} from "../lib/intro.js";
import { modeloEnCache, useEmbedder } from "../hooks/useEmbedder.js";
import { useAngosto } from "../hooks/useAngosto.js";
import { elegirEncuadre, focoEnPantalla, type Encuadre } from "../lib/encuadre.js";
import type { Idioma } from "../lib/cliente-chat.js";
import { RUTA } from "../lib/rutas.js";
import { FUENTE } from "./estilos.js";
import { Biblioteca } from "./Biblioteca.js";
import { Museo } from "./Museo.js";
import { Codice } from "./Codice.js";
import { Explainer } from "./Explainer.js";

type Fase = "escribiendo" | "brasa" | "abriendo" | "listo";

/**
 * CAMBIAR DE IDIOMA NO ES LLEGAR AL SITIO, y desde que cada idioma tiene su URL
 * eso dejó de ser obvio: el selector navega, o sea recarga, o sea que la intro
 * volvía a escribirse entera —siete segundos— cada vez que alguien tocaba EN.
 *
 * La marca la deja el propio enlace y se consume al leerla, así que **sólo
 * saltea el viaje entre idiomas**: recargar a mano sigue mostrando la intro,
 * que es lo que el dueño decidió que se vea al llegar (D-136, D-139).
 *
 * `sessionStorage` y no `localStorage`: muere con la pestaña. Y va en
 * `try/catch` porque Safari en privado tira al escribir.
 */
const SALTAR_INTRO = "alv-cambio-idioma";

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
 * LA ESCALERA TIPOGRAFICA, EXPLICITA. Ver D-147 y D-158.
 *
 * En escritorio el orden decreciente sale de los valores del diseño:
 * título 30 → bajada 18,5 → botón 15 → cómo funciona 18 (más chico de peso, va
 * en fina y sin fondo) → pastilla 14. En un teléfono se rompía: el título
 * bajaba a 22,5 con el `clamp`, la bajada caía al piso de 13,5 y «Cómo
 * funciona» se quedaba en 18 px fijos — o sea **más grande que los botones y
 * que la bajada**, justo al revés de la jerarquía.
 *
 * Acá está la escala de teléfono escrita como escala, no repartida en cinco
 * lugares: cada renglón es más chico que el anterior, y se lee de una si algún
 * día alguien la vuelve a tocar.
 */

/**
 * ESTE HERO NO TIENE TITULAR, Y ESO GOBIERNA TODOS LOS NUMEROS DE ABAJO.
 *
 * El elemento principal es el video del taller. Las dos líneas de la intro no
 * son título y bajada: son **una descripción del producto**, o sea material de
 * apoyo. Un segundo elemento principal compitiendo con el video no hace falta,
 * y a 35 y a 30 px la primera línea se leía como titular — que es exactamente
 * la sensación que la delató (D-160).
 *
 * D-160 puso el techo en 26 leyendo la escala de Apple: `display-md` arranca en
 * 34 y `lead` —su tagline de apoyo— está en 28, así que debajo de 28 la línea
 * deja de leerse como titular. **D-173 lo subió a 30 por pedido del dueño**, o
 * sea justo por encima de ese umbral. La tensión es real y queda anotada: a 30
 * la primera línea empuja contra la lectura de titular que D-160 quiso evitar.
 * Lo que sostiene que siga sin serlo es que el video sigue ocupando la pantalla
 * entera detrás, y que la segunda línea subió con ella —a 18— en vez de quedarse
 * atrás; el bloque creció, no se le abrió un escalón adentro.
 *
 * LO QUE MANDA NO ES EL NUMERO, ES QUE LAS DOS CAJAS SALGAN CASI IGUALES.
 * Medidas las dos frases en la ventana con la fuente cargada, la línea 1 ocupa
 * 22,270 em y la línea 2, 35,156. Con 30 y 18 eso da 668,1 y 632,8 px: un 5,6%
 * de diferencia. Un bloque de dos renglones parejos es lo que tiene que parecer
 * una DESCRIPCION, que es lo que estas dos líneas son.
 *
 * Y si algún día se quiere el empate exacto, el número está medido: **la línea
 * 2 a 19 px da 668,0 contra los 668,1 de la línea 1.** No se puso porque 18 fue
 * lo que se pidió.
 *
 * Lo que sí importa es que la razón NO SE ROMPA en un teléfono: si una línea
 * se achica con un `vw` y la otra con otro, en algún ancho dejan de guardarla.
 * Por eso los tres números del `clamp` de la segunda salen de los de la primera
 * divididos por el mismo paso, y se escriben calculados.
 */
const PHI = 1.618;

/*
 * 26 → 30 y 16,07 → 18, POR PEDIDO DEL DUEÑO (D-173). Con eso el paso entre las
 * dos líneas deja de ser φ y pasa a ser 30/18 = 5/3 = 1,667 — un 3% por encima
 * de 1,618.
 *
 * LO QUE φ COMPRABA SIGUE COMPRADO, Y ESA ERA LA PARTE QUE IMPORTABA. El punto
 * de D-160 no era el número: era que a este paso las dos líneas SALEN CASI DEL
 * MISMO ANCHO, que es lo que tiene que parecer un bloque de descripción de dos
 * renglones. Medido en la ventana con la fuente cargada:
 *
 *   línea 1   22,270 em × 30 px = 668,1 px
 *   línea 2   35,156 em × 18 px = 632,8 px   → 5,6% más angosta
 *
 * (Con φ eran 26 y 16,07: 579,0 contra 564,9, un 2,4%. O sea que el paso nuevo
 * separa un poco más las cajas, y sigue lejos de leerse como escalón.)
 *
 * ⚠ EL PASO SE ESCRIBE UNA VEZ Y LOS TRES NUMEROS DEL `clamp` SALEN DE EL. Si
 * la línea 1 se achicara con un `vw` y la línea 2 con otro, en algún ancho de
 * pantalla dejarían de guardar la razón y el bloque se partiría en dos tamaños
 * que no se hablan. Esa restricción es de D-159 y sigue en pie.
 */
const TITULO_MAX = 30;
const TITULO_VW = 6.8;
const TITULO_MIN = 23;
const BAJADA_MAX = 18;
/** El paso entre las dos líneas. Era φ (D-158); es 5/3 desde D-173. */
const PASO = TITULO_MAX / BAJADA_MAX;
const menor = (n: number) => +(n / PASO).toFixed(2);

const ESCALA_MOVIL = {
  titulo: `clamp(${TITULO_MIN}px,${TITULO_VW}vw,${TITULO_MAX}px)`,
  bajada: `clamp(${menor(TITULO_MIN)}px,${menor(TITULO_VW)}vw,${BAJADA_MAX}px)`,
  boton: 14,
  como: 13,
  pastilla: 11,
} as const;

/**
 * El aire entre las dos líneas: la bajada dividida por el paso otra vez, o sea
 * el título sobre el paso al cuadrado (30 / 2,778 = 10,8).
 *
 * VA CON `vw` COMO EL TEXTO, y no con `vh`. Primero se escribió
 * `clamp(7px,1.25vh,11.46px)` y en una ventana de 861 px de alto daba 10,76:
 * correcto de casualidad. Un `gap` que escala con el ALTO entre dos textos que
 * escalan con el ANCHO guarda la proporción sólo en las ventanas donde las dos
 * cuentas se cruzan. Con la misma unidad y el mismo divisor, la razón se cumple
 * en todos los anchos, que es lo único que hace que esto sea una escala y no
 * tres números que hoy coinciden.
 */
const AIRE_INTRO = `clamp(${menor(menor(TITULO_MIN))}px,${menor(menor(TITULO_VW))}vw,${menor(menor(TITULO_MAX))}px)`;

/*
 * ACA VIVIA `MEDIDA_INTRO` / `TECHO_INTRO` (D-159): una medida compartida en
 * `em` que obligaba a la segunda línea a partirse en dos renglones más
 * angostos, para que la razón de ANCHOS diera φ. Se fue en D-160 junto con el
 * encuadre que la justificaba.
 *
 * Dos motivos, y el segundo es el que manda. El primero: partía la frase al
 * medio —«…para conversar / con él…»— y un lector no tiene forma de saber por
 * qué esa línea baja, así que paga una incomodidad de lectura por una
 * proporción que no puede ver. El segundo: la razón de anchos sólo llega a φ
 * con un paso de cuerpo de 2,554, o sea con una primera línea de 44 px. Eso es
 * un titular, y este hero no tiene titular.
 */


const COPY = {
  preguntar: { es: "Preguntar a Leonardo", en: "Ask Leonardo" },
  biblioteca: { es: "Biblioteca", en: "Library" },
  museo: { es: "Museo virtual", en: "Virtual museum" },
  como: { es: "Cómo funciona", en: "How it works" },
  cargando: { es: "Ordenando cuadernos", en: "Sorting notebooks" },
  subir: { es: "Volver al inicio", en: "Back to the top" },
} as const;

/**
 * EL IDIOMA ENTRA POR PROP Y NO SE DETECTA. Ver `src/lib/rutas.ts`.
 *
 * Era `useState<Idioma>("es")` corregido al montar con `navigator.language`
 * (D-150). Andaba para el visitante y **no para un buscador**: el HTML servido
 * decía siempre `lang="es"`, con título y descripción en castellano, y la
 * versión inglesa del sitio no existía para nadie que no ejecutara JavaScript.
 * Ahora lo decide la ruta —`/` y `/en`—, que es lo único que un `hreflang`
 * puede declarar, y las dos páginas siguen siendo estáticas.
 *
 * Lo que se pierde: quien llega a `/` con el navegador en inglés ya no ve el
 * sitio en inglés solo. Lo tiene a un clic, en el mismo selector de siempre, y
 * el buscador lo manda directo a `/en` cuando busca en inglés.
 */
export function Hero({ lang }: { lang: Idioma }) {
  const angosto = useAngosto();
  const [fase, setFase] = useState<Fase>("escribiendo");
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
  /**
   * QUE TAN LEJOS DEL HERO ESTAMOS. Gobierna la flecha de volver arriba: no
   * tiene sentido ofrecer «volver al inicio» cuando el inicio está en pantalla.
   * El corte son 60vh —más de media pantalla de distancia— y no un píxel, que
   * haría aparecer la flecha con el hero todavía a la vista.
   */
  const [lejosDelHero, setLejosDelHero] = useState(false);
  useEffect(() => {
    const alScrollear = () => {
      if (window.scrollY > 24) setPistaScroll(false);
      setLejosDelHero(window.scrollY > window.innerHeight * 0.6);
    };
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, []);

  /*
   * CON UN PANEL ABIERTO, LA PAGINA DE ATRAS NO SE MUEVE (D-195).
   *
   * `overscroll-behavior: contain` corta el encadenado DENTRO de los scrollers;
   * esto cubre el resto, que es más de lo que parece: la rueda sobre el
   * encabezado, las pestañas, el composer o el velo —que no scrollean— movía la
   * web de atrás igual.
   *
   * ⚠ UN SOLO EFECTO PARA LOS DOS PANELES, y por eso vive acá y no adentro de
   * cada uno: los dos pueden estar abiertos a la vez, y dos efectos guardando y
   * restaurando `previo` por su cuenta dejan el `body` trabado si se cierran en
   * orden distinto al que se abrieron.
   */
  useEffect(() => {
    if (!codiceAbierto && !explainerAbierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [codiceAbierto, explainerAbierto]);

  /**
   * LAS DOS SALAS QUE SE TRAGAN LA PANTALLA. Un tomo abierto en la biblioteca y
   * la sala del museo no son secciones que se scrollean: son pantallas
   * completas con sus propios controles. La flecha de volver arriba flotando
   * encima de cualquiera de las dos sería un botón de un sitio distinto pegado
   * sobre una pantalla que ya tiene su «Volver» y su «Salir».
   *
   * Cada sección avisa la suya. `useCallback` no es cosmético: sin él, la
   * función nueva de cada render dispara el efecto que las escucha en bucle.
   */
  const [leyendoTomo, setLeyendoTomo] = useState(false);
  const [dentroDelMuseo, setDentroDelMuseo] = useState(false);
  const alLeer = useCallback((v: boolean) => setLeyendoTomo(v), []);
  const alEntrarAlMuseo = useCallback((v: boolean) => setDentroDelMuseo(v), []);

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
    // EL CRONOGRAMA ES POR IDIOMA y el idioma ya está resuelto: viene de la
    // ruta. Antes se detectaba en este mismo efecto para que los
    // temporizadores no quedaran armados sobre el cronograma del idioma
    // equivocado; ahora no hay carrera posible porque no hay nada que
    // resolver.
    setMontado(true);

    // Se viene del otro idioma: el taller ya se abrió una vez en esta pestaña.
    try {
      if (sessionStorage.getItem(SALTAR_INTRO)) {
        sessionStorage.removeItem(SALTAR_INTRO);
        setFase("listo");
        arrancarVideo();
        return;
      }
    } catch { /* sessionStorage bloqueado: se ve la intro, que es el default */ }

    const quieto =
      RESPETAR_MOVIMIENTO_REDUCIDO &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto) {
      setFase("listo");
      arrancarVideo();
      return;
    }

    const fases = fasesDe(lang);
    temporizadores.current = [
      setTimeout(arrancarVideo, Math.max(0, fases.escritura - ADELANTO_VIDEO)),
      setTimeout(() => setFase("brasa"), fases.escritura),
      setTimeout(() => setFase("abriendo"), fases.escritura + fases.brasa),
      setTimeout(() => setFase("listo"), fases.escritura + fases.brasa + fases.apertura),
    ];

    const pendientes = temporizadores.current;
    return () => pendientes.forEach(clearTimeout);
  }, [arrancarVideo, lang]);

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

  /**
   * CUANDO SE VE LA FLECHA DE VOLVER ARRIBA. Las cuatro condiciones en una
   * línea, y no repartidas en el JSX: es una sola pregunta —¿hay algo más
   * importante en pantalla que volver al inicio?— y se lee de una.
   */
  const mostrarSubir =
    lejosDelHero && !leyendoTomo && !dentroDelMuseo && !codiceAbierto && !explainerAbierto;

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
                // El piso baja de 0,68 a 0,24 (D-158). Ver el bloque de abajo:
                // esta capa y la otra se multiplican, y entre las dos dejaban
                // pasar el 2,5% de la luz.
                "linear-gradient(to bottom, oklch(6% 0.02 40 / 0.6) 0%, transparent 24%, transparent 68%, oklch(6% 0.02 40 / 0.24) 100%)",
          }}
        />

        {/*
          EL OSCURECIDO SIGUE AL TEXTO, NO AL MARCO (D-158).
          
          Antes esto era una franja negra que subía desde el borde de abajo, y
          entre ella y la viñeta de la capa 1 —que se multiplican— al pie del
          cuadro llegaba el 2,5% de la luz del video: (1−0,30)(1−0,68)(1−0,89).
          O sea negro. Y justo ahí abajo están las rodillas de Leonardo y el
          sillón, que es la parte del plano que dice que hay alguien sentado.

          El problema es que oscurecer el MARCO para que se lea el TEXTO paga
          el precio en todo el ancho del cuadro, incluso donde no hay una letra.
          Ahora son dos capas con trabajos distintos:

            1. UN LECHO ELIPTICO centrado en la copia (50%, 68%), que es donde
               están el título, la bajada y los dos botones. Ahí adentro el
               oscurecido es MAS fuerte que antes —0,62 contra 0,56—, así que
               el texto se lee mejor, no peor.
            2. UN PISO FLOJO, 0,30 en el borde de abajo contra 0,89: lo justo
               para que el corte del video no encandile y empalme con la
               sección clara que sigue.

          Al pie pasa ahora ~37% de la luz en vez de 2,5%: quince veces más.
          Lo que queda expuesto —«Cómo funciona» y la flecha de scroll, que
          caen sobre las rodillas— se defiende con su propia sombra de texto,
          que es exactamente donde corresponde ponerla: en la letra.
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
              : // 1. El lecho de la copia.
                "radial-gradient(52% 26% at 50% 68%, oklch(7% 0.02 40 / 0.62) 0%, oklch(7% 0.02 40 / 0.34) 52%, transparent 82%), " +
                // 2. La mancha chica de «Cómo funciona». Ese renglón cae sobre
                //    la página abierta del libro, que es lo más CLARO de todo
                //    el cuadro, y es texto claro: el único punto donde destapar
                //    el fondo lo dejaba peleando contra papel iluminado.
                //    Angosta a propósito —14% de ancho— para no volver a tapar
                //    las rodillas, que están a los costados y no en el medio.
                "radial-gradient(14% 7% at 50% 86%, oklch(7% 0.02 40 / 0.5) 0%, transparent 100%), " +
                // 3. El piso, apenas.
                "linear-gradient(to top, oklch(7% 0.02 40 / 0.3) 0%, oklch(7% 0.02 40 / 0.18) 10%, oklch(7% 0.02 40 / 0.07) 22%, transparent 40%)",
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
            // −10% (D-158): la pastilla de idioma es lo único que se ve durante
            // toda la intro y a 112 px de ancho pesaba como un botón de acción,
            // que no es. Se achicó de a partes iguales —cuerpo, relleno y
            // separación— para que siga siendo la misma pastilla y no otra.
            gap: 3,
            padding: 4,
            background: "oklch(12% 0.02 40 / 0.4)",
            border: "1px solid oklch(88% 0.04 85 / 0.22)",
            borderRadius: 999,
            // `-webkit-` para Safari anterior a la 18.
            WebkitBackdropFilter: "blur(10px)",
            backdropFilter: "blur(10px)",
            opacity: uiOpacity,
            pointerEvents: uiPointer,
            transition: TRANSICION_APERTURA,
          }}
        >
          {/*
            SON ENLACES, NO BOTONES, desde que cada idioma tiene su URL. Tres
            cosas que un `onClick` no daba: el rastreador encuentra la otra
            versión siguiendo el enlace —que es lo que el `hreflang` declara y
            esto confirma—, se puede abrir en otra pestaña, y el `lang` del
            documento llega bien desde el servidor en vez de corregirse por JS.

            `stopPropagation` sigue haciendo falta: un click en cualquier parte
            del hero saltea la intro, y elegir idioma no es saltearla.
          */}
          {(["es", "en"] as const).map((codigo) => (
            <a
              key={codigo}
              href={RUTA[codigo]}
              hrefLang={codigo}
              aria-current={lang === codigo ? "page" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (codigo === lang) return;
                try { sessionStorage.setItem(SALTAR_INTRO, "1"); } catch { /* ídem */ }
              }}
              style={{
                display: "inline-block",
                textDecoration: "none",
                fontFamily: FUENTE.lectura,
                fontSize: angosto ? ESCALA_MOVIL.pastilla : 13,
                fontWeight: lang === codigo ? 600 : 500,
                padding: angosto ? "7px 12px" : "6px 14px",
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
            </a>
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
              // Ver `AIRE_INTRO`: el título sobre el paso al cuadrado.
              gap: AIRE_INTRO,
              marginBottom: "clamp(6px,1.2vh,12px)",
              maxWidth: "96vw",
              textAlign: "center",
            }}
          >
            {LINEAS[lang].map((texto, li) => {
              const estilo = {
                margin: 0,
                // El único tope es la ventana: las dos líneas se miden solas y
                // la razón entre ellas la sostiene la escala, no un ancho
                // compartido — eso último fue `MEDIDA_INTRO` y se fue en D-160.
                maxWidth: "96vw",
                fontFamily: FUENTE.manuscrita,
                fontWeight: 400,
                // El segundo número manda en móvil y el tercero en escritorio;
                // con 3.4vw un teléfono caía siempre al piso del clamp y el
                // título quedaba del tamaño de la bajada.
                fontSize: li === 0 ? ESCALA_MOVIL.titulo : ESCALA_MOVIL.bajada,
                /*
                 * La primera va apretada —1,25— porque se mira; la segunda va a
                 * φ —1,618— porque es la única línea del hero que se LEE, y en
                 * un teléfono son tres renglones. Acá φ sigue siendo φ y no el
                 * paso de la escala: son dos cosas distintas que antes daban el
                 * mismo número. El interlineado no persigue la razón entre los
                 * cuerpos — es lo que vuelve cómoda la lectura en el ancho
                 * angosto, que es donde hacía falta.
                 */
                lineHeight: li === 0 ? 1.25 : PHI,
                /*
                 * SIN VIUDAS. En la franja donde el titular ya no entra en un
                 * renglón —alrededor de 660 px— se partía en 593 + 78: una
                 * palabra sola colgando abajo. Venía de antes, pero se ve
                 * ahora que el escalón entre las dos líneas quedó a la vista.
                 * `pretty` mueve una palabra para emparejar el final y no
                 * toca nada cuando el texto ya entra limpio, que es el caso
                 * de escritorio.
                 */
                textWrap: "pretty" as const,
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
              /*
                LA PRIMERA LINEA ES EL <h1> DE LA PAGINA, y es la única que hay.
                No cambia un píxel —`estilo` ya fija cuerpo, peso y `margin: 0`,
                así que los estilos por omisión del `h1` no llegan a aplicarse—
                pero el documento pasa a tener encabezado de primer nivel: hasta
                acá había siete `<h2>` colgando de nada. Sigue siendo el mismo
                texto que se escribe a mano; sólo cambia la etiqueta.
              */
              const Etiqueta = li === 0 ? "h1" : "p";

              if (!escribiendo) {
                return (
                  <Etiqueta key={li} style={estilo}>
                    {texto}
                  </Etiqueta>
                );
              }

              return (
                <Etiqueta key={li} aria-label={texto} style={estilo}>
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
                </Etiqueta>
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

            {/*
              DOS FILAS, Y LAS TRES PIEZAS APLOMADAS SOBRE EL ROMBO (D-173).

              El separador de arriba tiene un rombo en el medio, y ese rombo es
              el eje del hero. Antes los tres botones iban en una sola fila, así
              que sobre el eje no caía ninguno: caía el borde entre «Preguntar a
              Leonardo» y «Biblioteca», que no es una pieza, es una juntura.

              Ahora hay dos filas y las dos se aploman sobre el mismo eje:

                ── ◆ ──          el rombo del separador
                [ Preguntar a Leonardo ]      su MITAD cae en el eje
                [ Biblioteca ] │ [ Museo ]    el HUECO cae en el eje

              Los dos aplomos salen del mismo `align-items: center` de la
              columna: la fila de dos, centrada como grupo, deja el hueco en el
              centro por construcción. No hay ningún número que mantener.

              Y de paso ordena la jerarquía por posición además de por relleno:
              la acción principal ya no comparte renglón con dos destinos.

              LOS ANCHOS SIGUEN SIENDO LOS QUE DICE CADA TEXTO (D-161).

              Antes era una grilla de `1fr 1fr` dentro de un ancho fijo, así que
              «Biblioteca» —cuyo texto mide 77 px— ocupaba los mismos 210 que
              «Preguntar a Leonardo», que mide 167. Un botón secundario del
              mismo tamaño que el primario no es un botón secundario: la
              jerarquía la estaba dando sólo el relleno.

              Antes eran una grilla de `1fr 1fr` dentro de un ancho fijo, así
              que «Biblioteca» —cuyo texto mide 77 px— ocupaba los mismos 210 que
              «Preguntar a Leonardo», que mide 167. Un botón secundario del mismo
              tamaño que el primario no es un botón secundario: la jerarquía la
              estaba dando sólo el relleno. Con anchos naturales miden 211 · 123 ·
              151, y la diferencia la dice la geometría.

              ⚠ ACA VIVIA UNA COINCIDENCIA AUREA y ya no vale la pena repetirla:
              con dos botones la fila daba 348 px contra los 565 de la segunda
              línea, y 565 / φ = 349,2. D-161 ya la había anotado como
              coincidencia del castellano —en inglés la razón se iba a 2,09— y
              D-172 la rompió al sumar el tercer botón. El aplomo sobre el rombo
              reemplaza esa relación por una que sí se sostiene en los dos
              idiomas, porque no depende de cuánto miden las palabras.

              EN TELEFONO LA SEGUNDA FILA VA A `1fr 1fr` Y NO A ANCHO NATURAL.
              Con anchos naturales los dos botones quedarían de tamaños distintos
              —127 y 109— y el hueco entre ellos ya no caería en el centro del
              grupo. Repartidos en mitades, el hueco vuelve al eje y además se
              cumple lo que pedía D-161 para móvil: dos botones del mismo ancho.
            */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                width: angosto ? "min(86vw,340px)" : undefined,
                maxWidth: "92vw",
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
                  padding: angosto ? "0 16px" : "0 22px",
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

              {/*
                LA SEGUNDA FILA, EN DOS MITADES EXACTAS — Y ESO NO ES COSMETICA,
                ES LA UNICA FORMA DE QUE EL HUECO CAIGA EN EL EJE.

                Primero se hizo centrando el GRUPO y alcanzaba en teoría. Medido
                en la ventana, no: el grupo quedaba centrado en 953 y el hueco en
                938,5, catorce píxeles y medio a la izquierda. La causa es
                aritmética y vale dejarla escrita —**el hueco sólo cae en el
                centro del grupo si los dos botones miden lo mismo**; con 123 y
                151 se corre (151 − 123) / 2 = 14 px hacia el más angosto—.

                `1fr 1fr` sobre una grilla de ancho automático iguala las dos
                columnas al ancho del contenido más largo, así que los dos miden
                151 y el hueco vuelve al eje sin ningún número escrito a mano.

                Y es lo correcto por otra razón: acá los dos botones son PARES
                —dos destinos, los dos fantasma—, no un primario y un secundario.
                La regla de anchos naturales de D-161 separaba jerarquías; entre
                iguales, lo que corresponde es que se vean iguales.
              */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 14,
                  width: angosto ? "100%" : undefined,
                }}
              >
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
                  padding: angosto ? "0 10px" : "0 22px",
                  whiteSpace: "nowrap",
                  background: "oklch(16% 0.02 40 / 0.2)",
                  border: "1px solid oklch(92% 0.03 85 / 0.32)",
                  borderRadius: 999,
                  // `-webkit-` para Safari anterior a la 18.
                  WebkitBackdropFilter: "blur(10px)",
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

              {/*
                EL MUSEO, EL TERCER DESTINO. Los tres botones son las tres
                cosas que el sitio tiene, en el mismo orden en que están en la
                página: preguntar, leer, caminar.

                UN PRIMARIO Y DOS FANTASMAS, no tres iguales. La jerarquía no se
                reparte: preguntarle a Leonardo es lo que el sitio hace, y las
                otras dos son lugares adonde ir. Sumar un tercer botón lleno
                habría convertido la fila en un menú.

                ⚠ Y ROMPE LA COINCIDENCIA DE D-161. Con dos botones la fila
                medía 348 px en castellano y caía en razón áurea con la línea de
                arriba (565 / φ = 349,2) por un 0,3%. Con el tercero la fila pasa
                a ~512 y esa coincidencia se termina. No se pierde nada que
                estuviera decidido: D-161 ya la había anotado como coincidencia
                del castellano y no como criterio —en inglés nunca cerró—. Lo que
                sí sigue en pie es lo que ese cambio justificaba, que era la
                jerarquía por ancho natural: 211 · 123 · 150.
              */}
              <button
                type="button"
                className="alv-btn-fantasma"
                onClick={(e) => {
                  e.stopPropagation();
                  document
                    .getElementById("museo")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: angosto ? 44 : 46,
                  padding: angosto ? "0 10px" : "0 22px",
                  whiteSpace: "nowrap",
                  background: "oklch(16% 0.02 40 / 0.2)",
                  border: "1px solid oklch(92% 0.03 85 / 0.32)",
                  borderRadius: 999,
                  // `-webkit-` para Safari anterior a la 18.
                  WebkitBackdropFilter: "blur(10px)",
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
                {COPY.museo[lang]}
              </button>
              </div>
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
                /*
                 * SU PROPIA SOMBRA, porque su fondo se lo llevaron (D-158).
                 * Este botón cae al 86% del alto, justo sobre las rodillas, que
                 * es la parte del cuadro que se destapó a propósito. La sombra
                 * hace acá el trabajo que antes hacía la franja negra, pero
                 * sólo en el contorno de la letra en vez de en todo el ancho.
                 */
                textShadow: "0 1px 10px oklch(6% 0.02 40 / 0.95), 0 0 22px oklch(6% 0.02 40 / 0.8)",
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
      <Biblioteca lang={lang} onLectura={alLeer} />

      {/*
        EL MUSEO VA DESPUES DE LA BIBLIOTECA, y montarlo tampoco cuesta nada:
        hasta que alguien toca «Entrar a la sala» esto es una portada de texto.
        Three.js y las nueve texturas viven detrás de un `import()` dinámico
        dentro del handler del botón (D-162).
      */}
      <Museo lang={lang} onDentro={alEntrarAlMuseo} />

      {/*
        LA VUELTA AL PRINCIPIO (D-172).

        Una flecha, abajo a la derecha, discreta. El sitio es una página larga
        de tres pantallas completas y hasta ahora la única forma de volver al
        hero era scrollear hacia arriba todo lo que se había bajado.

        CUANDO NO ESTA, Y POR QUE:
        · con el hero todavía a la vista — no hay adonde volver;
        · con un tomo abierto o dentro de la sala — son pantallas completas con
          su propio «Volver» y su propio «Salir», y una flecha de la página
          encima de ellas es una pieza de otro sitio;
        · con el códice o «Cómo funciona» abiertos — son capas sobre todo lo
          demás, y la flecha les quedaría flotando encima.

        Se desvanece en vez de desaparecer: `position: fixed` con `opacity`
        animada no mueve nada de la página cuando entra o sale.
      */}
      <button
        type="button"
        className="alv-subir"
        aria-label={COPY.subir[lang]}
        data-on={mostrarSubir ? "si" : "no"}
        /* No basta con `opacity: 0`: un botón invisible sigue recibiendo el
           click y sigue estando en el orden de tabulación. */
        tabIndex={mostrarSubir ? 0 : -1}
        aria-hidden={!mostrarSubir}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <svg width="15" height="9" viewBox="0 0 15 9" fill="none" aria-hidden="true">
          <path
            d="M1 8 L7.5 1.5 L14 8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </>
  );
}
