"use client";

/**
 * Tercera sección: portada dibujada a línea + sala 3D caminable.
 *
 * INVARIANTES
 * · Three y las nueve texturas entran por `import()` DENTRO del handler de
 *   entrar. La portada no puede crecer un byte por existir la sala (D-162).
 * · Dos entradas, no una: teclado + puntero bloqueado, o joystick + arrastre
 *   del dedo (D-194). `tactil` las separa y se decide con `(pointer: coarse)`.
 * · Salir con teclado son dos `Escape`: el navegador se come el primero para
 *   soltar el puntero. En táctil no hay pausa —no hay puntero que soltar— y la
 *   salida es el botón de la esquina, que por eso NO puede desaparecer.
 *
 * Diseño y medidas: D-162, D-174 a D-176, D-189 a D-194.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BIBLIOTECA } from "../data/biblioteca.js";
import { useAngosto, useChata, useSinMouse } from "../hooks/useAngosto.js";
import type { Idioma } from "../lib/cliente-chat.js";
import type { Museo as MotorMuseo, ObraMuseo } from "./museo-motor.js";
import { FUENTE } from "./estilos.js";
import medidas from "../../public/biblioteca/medidas.json" with { type: "json" };

const COPY = {
  firma: { es: "Museo", en: "Museum" },
  titulo: {
    es: "Museo virtual Leonardo da Vinci",
    en: "Leonardo da Vinci Virtual Museum",
  },
  /** Dice dos cosas y ninguna más: que se camina y de quién son las obras. */
  bajada: {
    es: "Un museo virtual que se recorre a pie, con obras de Leonardo.",
    en: "A virtual museum you walk through, with works by Leonardo.",
  },
  entrar: { es: "Entrar al museo", en: "Enter the museum" },
  volver: { es: "Salir", en: "Leave" },
  cargando: { es: "Levantando los telones", en: "Raising the cloth" },
  /**
   * Único cartel de teclas del sitio. Correr con `Shift` anda y NO se anuncia:
   * es decisión del dueño, no un olvido.
   */
  hudMover: { es: "Moverse", en: "Move" },
  hudSalir: { es: "Salir", en: "Leave" },

  /** La ayuda del HUD en táctil, donde no hay teclas que dibujar. */
  hudMirar: { es: "Arrastrar para mirar", en: "Drag to look" },
  joystick: { es: "Control de movimiento", en: "Movement control" },
  sinWebgl: {
    es: "Este navegador no tiene WebGL disponible, así que la sala no puede dibujarse.",
    en: "This browser has no WebGL available, so the room cannot be drawn.",
  },
} as const;

/** Se pregunta una vez, con un canvas que se descarta enseguida. */
function hayWebgl(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

type Estado = "cerrado" | "cargando" | "adentro" | "pausado" | "sinWebgl";

/**
 * El umbral, en dos trazos. `viewBox` 360 × 480 = la proporción de puerta 3 : 4
 * con la cabeza del arco al 34% del alto (D-174).
 *
 * Son DOS caminos y no uno para que cada jamba se dibuje desde el piso y las dos
 * se encuentren en la clave: el arco se levanta en vez de recorrerse. El medio
 * píxel de los extremos alinea el pelo con la grilla.
 */
const JAMBA_IZQ = "M0.5 480 V163 A179.5 162.5 0 0 1 180 0.5";
const JAMBA_DER = "M359.5 480 V163 A179.5 162.5 0 0 0 180 0.5";

/**
 * Suela y talón de una huella, `viewBox` 100 × 260 (1 : 2,6, la razón real).
 * Van SEPARADAS: el hueco del arco del pie es lo que la hace leer «zapato»; una
 * silueta continua se lee como pie descalzo o como mancha.
 */
const SUELA =
  "M55 13 C75 13 87 35 90 64 C93 95 86 132 79 160 C77 169 76 176 76 182 C60 181 42 180 27 179 C27 171 26 161 24 149 C19 119 8 92 11 62 C14 32 35 13 55 13 Z";
const TALON =
  "M28 197 C44 198 60 199 76 200 C77 216 76 231 70 241 C63 252 50 255 41 249 C31 242 27 226 27 210 C27 205 27 200 28 197 Z";

/**
 * ms que tarda la portada en terminar de levantarse. ⚠ Es el último retraso del
 * CSS (2,25 s, el botón) + su duración (0,6 s) + margen: si cambian los tiempos
 * de `alv-museo-*` en `globals.css`, este número se mueve con ellos.
 */
const DURACION_REVELADO = 3100;

/**
 * Una huella en el piso, apuntando a la puerta. Van dos: la de atrás maciza —el
 * paso real, ya dado— y la de adelante deshaciéndose en píxeles hacia la punta
 * —la virtual, la que cruza—. El orden no es intercambiable (D-190).
 *
 * · La celda del patrón mide 13 de 100 de ancho. ⚠ Más fina que eso, al tamaño
 *   real (~46 px), deja de leerse pixelada y se vuelve una mancha gris.
 * · La disolución va de talón a punta, no de abajo hacia arriba: la huella está
 *   girada y lo que tiene que deshacerse es lo que apunta al vano.
 * · `espejo` invierte el pie DENTRO del SVG. ⚠ No usar `transform` de CSS: ahí
 *   afuera lo usa la animación y una de las dos se pierde.
 */
function Huella({
  pie,
  espejo = false,
}: {
  pie: "real" | "virtual";
  espejo?: boolean;
}) {
  const vuelta = espejo ? "translate(100 0) scale(-1 1)" : undefined;
  return (
    <div className="alv-museo-huella" data-pie={pie} aria-hidden="true">
      <svg viewBox="0 0 100 260">
        {pie === "virtual" && (
          <defs>
            <pattern id="alv-museo-px" width="13" height="13" patternUnits="userSpaceOnUse">
              <rect width="10" height="10" />
            </pattern>
            <linearGradient id="alv-museo-disuelve" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0.02" stopColor="#fff" stopOpacity="1" />
              <stop offset="1" stopColor="#fff" stopOpacity="0.3" />
            </linearGradient>
            <mask id="alv-museo-hacia-el-vano">
              <rect width="100" height="260" fill="url(#alv-museo-disuelve)" />
            </mask>
          </defs>
        )}
        <g
          transform={vuelta}
          mask={pie === "virtual" ? "url(#alv-museo-hacia-el-vano)" : undefined}
        >
          <path d={SUELA} fill={pie === "virtual" ? "url(#alv-museo-px)" : undefined} />
          <path d={TALON} fill={pie === "virtual" ? "url(#alv-museo-px)" : undefined} />
        </g>
      </svg>
    </div>
  );
}

/**
 * EL JOYSTICK ANALOGICO. Un aro, una cruz de referencia y un pomo.
 *
 * ANALOGICO Y NO DE OCHO DIRECCIONES: lo que sale para el motor es el vector
 * crudo dividido por el radio, así que inclinar poco camina despacio. Un pad de
 * ocho direcciones habría sido más fácil y camina siempre a la misma velocidad,
 * que en una sala que se recorre mirando es justo lo que no se quiere.
 *
 * · `setPointerCapture` para que el dedo pueda salirse del aro sin que el
 *   gesto se corte — es lo que hace que el pomo se quede pegado al borde en vez
 *   de soltarse a mitad de camino.
 * · El área que escucha es más grande que el dibujo (`padding` en el CSS): un
 *   pulgar no acierta un aro de 128 px, acierta una zona.
 * · ⚠ `z` sale NEGATIVO hacia arriba porque en el motor −z es el frente de la
 *   cámara. Invertirlo acá camina para atrás.
 */
function Joystick({
  etiqueta,
  alEmpujar,
}: {
  etiqueta: string;
  alEmpujar: (x: number, z: number) => void;
}) {
  const aroRef = useRef<HTMLDivElement | null>(null);
  const [pomo, setPomo] = useState<{ x: number; y: number } | null>(null);

  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const aro = aroRef.current;
    if (!aro) return;
    const c = aro.getBoundingClientRect();
    const dx = e.clientX - (c.left + c.width / 2);
    const dy = e.clientY - (c.top + c.height / 2);
    // El pomo llega hasta el borde interno del aro y no más.
    const radio = c.width / 2 - RADIO_POMO;
    const d = Math.hypot(dx, dy);
    const f = d > radio ? radio / d : 1;
    setPomo({ x: dx * f, y: dy * f });
    alEmpujar((dx * f) / radio, (dy * f) / radio);
  };

  const soltar = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setPomo(null);
    alEmpujar(0, 0);
  };

  return (
    <div
      className="alv-museo-joystick"
      role="application"
      aria-label={etiqueta}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        mover(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) mover(e);
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      <div className="alv-museo-joystick-aro" ref={aroRef} data-on={pomo ? "si" : "no"}>
        <span className="alv-museo-joystick-cruz" aria-hidden="true" />
        <span
          className="alv-museo-joystick-pomo"
          style={pomo ? { transform: `translate(calc(-50% + ${pomo.x}px), calc(-50% + ${pomo.y}px))` } : undefined}
        />
      </div>
    </div>
  );
}

/** El radio del pomo, en px. Lo necesitan el CSS y la cuenta del tope. */
const RADIO_POMO = 26;

/**
 * LA PANTALLA DE CARGA: los nueve telones descolgándose del barral.
 *
 * NO ES UNA METAFORA, ES EL DATO. `alCargar` reporta `texturas / obras.length`,
 * así que cada tela que baja es una obra que terminó de bajar: la pantalla
 * muestra literalmente lo que está pasando. Una barra de progreso dice lo mismo
 * y no dice qué se está esperando.
 *
 * Las que faltan quedan dibujadas en fantasma, así que se ve cuántas vienen —
 * un indeterminado no deja saber si falta poco.
 *
 * El vaivén es un `<g>` aparte del `<rect>` que baja: son dos transformaciones
 * y una sola propiedad `transform`, así que anidarlas es la única forma de que
 * no se pisen.
 */
function Telones({ hechos, total }: { hechos: number; total: number }) {
  const ANCHO = 15;
  const HUECO = 8;
  const w = total * ANCHO + (total - 1) * HUECO;
  return (
    <svg
      className="alv-museo-telones"
      viewBox={`0 0 ${w} 74`}
      width={w * 1.5}
      aria-hidden="true"
    >
      {/* El barral: la línea de la que cuelgan. */}
      <line className="alv-museo-barral" x1="0" y1="4.5" x2={w} y2="4.5" />
      {Array.from({ length: total }, (_, i) => {
        const x = i * (ANCHO + HUECO);
        return (
          <g
            key={i}
            className="alv-museo-telon-vaiven"
            style={{ transformOrigin: `${x + ANCHO / 2}px 4.5px`, animationDelay: `${i * 0.24}s` }}
          >
            {/* Ruedo curvo en vez de borde recto: es la diferencia entre nueve
                barras y nueve telas colgadas. */}
            <path
              className="alv-museo-telon"
              data-on={i < hechos ? "si" : "no"}
              d={`M${x} 4.5 H${x + ANCHO} V63 C${x + ANCHO * 0.72} 67 ${x + ANCHO * 0.26} 61.5 ${x} 65.5 Z`}
              style={{ transformOrigin: `${x + ANCHO / 2}px 4.5px` }}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** `no` todavía no se vio · `si` se está levantando · `ya` hecha. */
type Revelado = "no" | "si" | "ya";

export function Museo({
  lang,
  onDentro,
}: {
  lang: Idioma;
  /**
   * Avisa cuando la sala ocupa la pantalla. Hoy sólo lo escucha la flecha de
   * «volver arriba» del hero. Opcional: el museo anda igual sin oyente.
   */
  onDentro?: (v: boolean) => void;
}) {
  const angosto = useAngosto();
  /*
   * ⚠ ES LA ENTRADA, NO EL TAMAÑO. Decide si se camina con teclado y puntero
   * bloqueado o con joystick y arrastre — una tablet mide 1024 px y no tiene
   * teclas, un portátil táctil mide lo mismo y sí las tiene. `(pointer: coarse)`
   * es la única pregunta que separa las dos (D-192, D-194).
   */
  const tactil = useSinMouse();
  const chata = useChata();
  /**
   * `sala` el umbral dibujado · `apilada` texto y botón en una pila · `chata`
   * además sin dibujo, porque debajo de 540 px de alto no entra. Es una
   * decisión de TAMAÑO: la sala abre en las tres.
   */
  const maqueta = chata ? "chata" : angosto ? "apilada" : "sala";
  const [estado, setEstado] = useState<Estado>("cerrado");
  const [progreso, setProgreso] = useState(0);
  const [enfocada, setEnfocada] = useState<number | null>(null);
  const [revelado, setRevelado] = useState<Revelado>("no");
  const seccionRef = useRef<HTMLElement | null>(null);
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);
  const motorRef = useRef<MotorMuseo | null>(null);

  /**
   * Las obras salen del catálogo, no de una lista aparte: agregar una lámina al
   * tomo «obras» la cuelga acá sin tocar este archivo. La proporción de cada
   * telón sale de `medidas.json` (`npm run biblioteca`); sin ella la tela
   * deforma el cuadro.
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
    // ⚠ El import vive acá adentro: es lo que mantiene a Three fuera del
    // bundle de la portada.
    const { construirMuseo } = await import("./museo-motor.js");
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    motorRef.current = construirMuseo({
      lienzo,
      obras,
      alEnfocar: setEnfocada,
      alSoltarPuntero: () => setEstado((v) => (v === "adentro" ? "pausado" : v)),
      alCargar: setProgreso,
      tactil,
    });
    motorRef.current.andar();
    setEstado("adentro");
    motorRef.current.tomarPuntero();
  }, [obras, tactil]);

  const salir = useCallback(() => {
    motorRef.current?.destruir();
    motorRef.current = null;
    setEstado("cerrado");
    setEnfocada(null);
    setProgreso(0);
  }, []);

  /**
   * «La sala ocupa la pantalla», en una sola definición: gobierna el lienzo, el
   * scroll de la página y la flecha del hero. ⚠ Declarada antes de los efectos
   * porque tres de ellos la leen.
   */
  const dentro = estado === "adentro" || estado === "pausado" || estado === "cargando";

  /*
   * La portada se levanta al asomar, no al montar: es la tercera pantalla y una
   * obra que corre al cargar ya terminó cuando el visitante llega. El observador
   * se desconecta al primer disparo — una vez por visita.
   *
   * ⚠ Arranca en `no` en servidor y cliente: el servidor no sabe dónde está
   * scrolleado nadie y divergir en el primer render rompe la hidratación.
   */
  useEffect(() => {
    if (revelado !== "no") return;
    const nodo = seccionRef.current;
    if (!nodo) return;
    // Sin observador, mostrarla hecha: una sección invisible es peor que una
    // sin animación.
    if (typeof IntersectionObserver === "undefined") {
      setRevelado("ya");
      return;
    }
    const ojo = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        ojo.disconnect();
        setRevelado("si");
      },
      // Un cuarto: el dibujo llega a la vista ya empezado, que es cuando se
      // lee como gesto.
      { threshold: 0.25 },
    );
    ojo.observe(nodo);
    return () => ojo.disconnect();
  }, [revelado]);

  /*
   * Terminada la obra, la portada pasa a `ya` y pierde las animaciones. Sin esto
   * el arco se redibuja entero cada vez que alguien sale de la sala.
   */
  useEffect(() => {
    if (revelado !== "si") return;
    const t = window.setTimeout(() => setRevelado("ya"), DURACION_REVELADO);
    return () => window.clearTimeout(t);
  }, [revelado]);

  // El motor se va con el componente, pase lo que pase.
  useEffect(() => () => motorRef.current?.destruir(), []);

  useEffect(() => {
    const alRedimensionar = () => motorRef.current?.redimensionar();
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, []);

  /*
   * ⚠ La condición es `dentro`, no `estado === "adentro"`: en pausa y durante la
   * carga la sala también ocupa la pantalla, y con el puntero suelto la rueda
   * scrolleaba la página por debajo de ella (D-191).
   */
  useEffect(() => {
    if (!dentro) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [dentro]);

  /*
   * `Escape` en pausa sale de la sala. El primero no llega acá —el navegador lo
   * intercepta para soltar el puntero—, así que salir son dos.
   *
   * ⚠ No convertir el primero en salida directa: la pausa es la red para cuando
   * el puntero se suelta sin pedirlo (cambio de pestaña, navegador que lo niega).
   */
  useEffect(() => {
    if (estado !== "pausado") return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") salir();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [estado, salir]);

  const obra = enfocada !== null ? obras[enfocada] : null;

  // En un efecto y no en cada `setEstado`: los cinco estados entran y salen de
  // «dentro» por caminos distintos y avisar en cada uno se olvida de alguno.
  useEffect(() => {
    onDentro?.(dentro);
  }, [dentro, onDentro]);
  useEffect(() => () => onDentro?.(false), [onDentro]);

  return (
    <section
      id="museo"
      ref={seccionRef}
      aria-label={COPY.firma[lang]}
      className="alv-museo"
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        /*
         * Blanco de galería: el ambiente «galería» de `docs/20-branding.md`.
         * El corte con la biblioteca no lo da la claridad —las dos son claras—
         * sino el croma, la superficie y el contenido (D-189).
         *
         * ⚠ El alto vive en `globals.css`: la reserva `100vh` / `100dvh` son dos
         * declaraciones y un `style={{}}` sólo admite una.
         */
        background: "oklch(97.6% 0.003 85)",
        color: "oklch(24% 0.008 70)",
        fontFamily: FUENTE.lectura,
      }}
    >
      <canvas
        ref={lienzoRef}
        className="alv-museo-lienzo"
        // No es contenido: lo que hay adentro lo describe la lista oculta del
        // final, que un lector de pantalla sí puede recorrer.
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: dentro ? "block" : "none",
          // `grab` y no `none`: con el puntero bloqueado el navegador esconde
          // el cursor solo, y si lo niega el paseo se hace arrastrando.
          cursor: estado === "adentro" ? "grab" : "default",
        }}
      />

      {/* ---- La portada: el umbral ------------------------------------------
       *
       * ⚠ ESTO ES LA PUERTA, NO LA SALA. Tres versiones se cayeron por
       * representar la sala y adelantar lo que existe para mostrarse adentro
       * (D-171 a D-173). Una puerta no se parece al cuarto: se parece a una
       * puerta. Cualquier pieza nueva acá tiene que pasar esa prueba.
       *
       * Lo que hay es geometría sola: dos planos, una línea, un arco y dos
       * huellas. Sin foto y sin capas de ambiente (D-189, D-190).
       */}
      {!dentro && (
        <div className="alv-museo-portada" data-revelado={revelado} data-maqueta={maqueta}>
          {/* El cuarto: muro, piso y el encuentro de los dos. ⚠ Sin textura ni
              perspectiva — un piso en fuga vuelve a representar la sala. */}
          <div className="alv-museo-suelo" aria-hidden="true" />
          <div className="alv-museo-linea-piso" aria-hidden="true" />

          {/* Las huellas son lo que vuelve piso al piso: una pisada sólo puede
              estar apoyada en el suelo, y además señalan la puerta. El orden en
              el DOM es el de la caminata: primero el pie de atrás. */}
          <Huella pie="real" />
          <Huella pie="virtual" espejo />

          {/*
            `pathLength={1}` normaliza el trazo: el `stroke-dasharray` del CSS es
            1 y nadie mide el camino con JS. ⚠ Una medida en píxeles quedaría
            vieja al primer `resize`.

            `vectorEffect` mantiene el pelo en 1 px a cualquier tamaño; sin eso
            el arco engorda al agrandarse y deja de leerse como dibujo.
          */}
          <div className="alv-museo-umbral" aria-hidden="true">
            <svg viewBox="0 0 360 480" fill="none">
              <path className="alv-museo-arco" d={JAMBA_IZQ} pathLength={1} vectorEffect="non-scaling-stroke" />
              <path className="alv-museo-arco" d={JAMBA_DER} pathLength={1} vectorEffect="non-scaling-stroke" />
            </svg>
          </div>

          {/*
            El texto y la puerta son dos objetos, no una pila (D-176): el botón
            vive dentro del vano porque la acción de la sección es cruzarlo.
            Rótulo, vano, botón y el medio de las huellas caen sobre un solo eje.

            ⚠ En el DOM van en orden de lectura —título, bajada, acción— y por eso
            el botón está dentro de `.alv-museo-frente` aunque en pantalla quede
            lejos. La posición la da el CSS; el orden de tabulación, esto.
          */}
          <div className="alv-museo-frente">
            <div className="alv-museo-columna">
              {/* Sin la etiqueta «MUSEO» que el resto del sitio usa como rótulo:
                  encima de este título diría dos veces lo mismo. Sigue viva en el
                  `aria-label` de la sección. */}
              <h2 className="alv-museo-titulo" style={{ fontFamily: FUENTE.titulo }}>
                {COPY.titulo[lang]}
              </h2>
              <p className="alv-museo-nota">{COPY.bajada[lang]}</p>
              {estado === "sinWebgl" && <p className="alv-museo-nota">{COPY.sinWebgl[lang]}</p>}
            </div>

            {/* Sin lista de teclas: se leía antes de tener con qué probarla. El
                recuadro de la esquina lo dice adentro, cuando sirve. */}
            {estado !== "sinWebgl" && (
              <button
                type="button"
                className="alv-museo-boton alv-museo-boton-vano"
                onClick={entrar}
              >
                {COPY.entrar[lang]}
              </button>
            )}
          </div>

          {/* El equivalente accesible de la sala: una sala 3D no lo tiene, y no
              ofrecer nada sería peor que ofrecer la lista. */}
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
        <div className="alv-museo-capa" data-modo="cargando">
          <Telones hechos={Math.round(progreso * obras.length)} total={obras.length} />
          <span className="alv-museo-firma">{COPY.cargando[lang]}</span>
        </div>
      )}

      {/* ---- Pausado: el puntero se soltó ---- */}
      {estado === "pausado" && (
        <div className="alv-museo-capa" data-tocable="si">
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
          {/* En `<kbd>` de verdad: el lector de pantalla la anuncia como tecla y
              no como una palabra pegada a «Salir». */}
          <kbd className="alv-museo-tecla">Esc</kbd>
        </button>
      )}

      {/*
        El teclado dibujado, no escrito: cuatro teclas en cruz se reconocen sin
        leerlas. La cruz la arma el grid del CSS, no un carácter de dibujo.

        `aria-hidden` porque la sala ya es inaccesible para quien no ve: el
        equivalente es la lista de obras de la portada, no estas teclas.
      */}
      {estado === "adentro" && !tactil && (
        <div className="alv-museo-hud" aria-hidden="true">
          <div className="alv-museo-hud-cruz">
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd>
          </div>
          <span className="alv-museo-hud-pie">{COPY.hudMover[lang]}</span>
          <span className="alv-museo-hud-salir">
            <kbd>Esc</kbd> {COPY.hudSalir[lang]}
          </span>
        </div>
      )}

      {/* En táctil el HUD no dibuja teclas: el joystick se explica solo y lo
          único que hay que enseñar es que la cámara se arrastra. */}
      {estado === "adentro" && tactil && (
        <>
          <div className="alv-museo-hud" data-tactil="si" aria-hidden="true">
            <span className="alv-museo-hud-pie">{COPY.hudMirar[lang]}</span>
          </div>
          <Joystick
            etiqueta={COPY.joystick[lang]}
            alEmpujar={(x, z) => motorRef.current?.empujar(x, z)}
          />
        </>
      )}
    </section>
  );
}
