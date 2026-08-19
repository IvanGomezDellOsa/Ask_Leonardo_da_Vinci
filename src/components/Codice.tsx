"use client";

/**
 * El códice: el panel de conversación.
 *
 * DOS CAMINOS DISTINTOS, Y ESO ES EL DISEÑO (D-132):
 *
 *   · Las 6 preguntas sugeridas salen de `src/data/portada.ts`, que está
 *     bundleado en el cliente. CERO red, CERO espera al modelo de 129 MB.
 *     Alguien puede tener su primera conversación completa mientras la barra
 *     de carga todavía va por la mitad — y con el backend entero caído.
 *   · Cualquier pregunta escrita a mano sí necesita el vector del navegador y
 *     `POST /api/chat`.
 *
 * EL TEXTO SE REVELA DE A POCO PERO YA LLEGO ENTERO. No es streaming del
 * proveedor y no puede serlo (D-120): las garantías —verificar cada cita
 * contra el pasaje, sacarle las comillas a la que no verifica— corren sobre el
 * texto terminado. Transmitir tokens crudos mostraría texto que después se
 * corrige, que es justo lo que este proyecto existe para no hacer. El efecto
 * de escritura es puro cliente sobre algo ya verificado.
 *
 * LAS TRES DECISIONES SE VEN DISTINTO. `responde` trae pasajes; `curada` trae
 * la nota de Richter como prueba de que el silencio es real; `abstiene` no
 * trae nada que mostrar. En `curada` y `abstiene` el servidor manda `texto`
 * vacío a propósito: la redacción es de la interfaz, no del modelo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PORTADA } from "../data/portada.js";
import { useEmbedder } from "../hooks/useEmbedder.js";
import { useAngosto } from "../hooks/useAngosto.js";
import { consultar, MAX_CARACTERES, type Idioma } from "../lib/cliente-chat.js";
import type { PasajePublico, RespuestaPublica } from "../lib/respuesta.js";
import { CANAL, FUENTE, T, TEXTO_LECTURA } from "./estilos.js";

const GUTENBERG = "https://www.gutenberg.org/files/5000/5000-h/5000-h.htm";

/** Ritmo del revelado. ~215 caracteres por segundo. */
const MS_POR_CARACTER = 14 / 3;

interface PasajeAbrible extends PasajePublico {
  abierto: boolean;
}

type Mensaje =
  | { id: number; tipo: "usuario"; texto: string }
  /** Rechazos y avisos de la interfaz. Nunca se muestran como voz de Leonardo. */
  | { id: number; tipo: "sistema"; texto: string }
  | {
      id: number;
      tipo: "leonardo";
      pendiente: boolean;
      /** Lo revelado hasta ahora. */
      texto: string;
      /** El texto completo, que ya llegó verificado. */
      completo: string;
      /** La nota de Richter que prueba el silencio, en los casos curados. */
      cita: string | null;
      /** Curado sin nota: ni el corpus ni el editor dicen nada. */
      sinNota: boolean;
      /**
       * `true` cuando el revelado terminó. La evidencia —pasajes y nota de
       * Richter— NO se muestra antes: aparecer mientras Leonardo todavía está
       * hablando se lee apurado, como si las pruebas estuvieran esperando de
       * antemano en vez de sostener lo que se acaba de decir.
       */
      revelado: boolean;
      pasajes: PasajeAbrible[];
    };

/**
 * `Omit` sobre una unión la aplasta a las claves comunes; distribuido, cada
 * miembro conserva las suyas. Sin esto, `agregar()` sólo aceptaría `tipo` y
 * `texto`, que es lo único que comparten los tres mensajes.
 */
type SinId<T> = T extends unknown ? Omit<T, "id"> : never;

const COPY = {
  es: {
    titulo: "Consulta a Leonardo da Vinci",
    saludo: "Elegí una de estas preguntas, o escribí la tuya. Responderé con lo que dejé escrito en mis cuadernos.",
    nota: "Lo entrecomillado es cita literal de sus cuadernos: no se modificó, para no perder autenticidad. Por eso a veces el lenguaje suena antiguo o cuesta leerlo.",
    sugeridas: "Preguntas sugeridas",
    otras: "Otras preguntas sugeridas",
    abrir: "Ampliar",
    cerrarLista: "Cerrar",
    placeholder: "Escribí tu consulta a Leonardo da Vinci…",
    // El largo entra en escritorio; en un teléfono el textarea es de un
    // renglón y el placeholder se partía al medio, mostrando una frase cortada.
    placeholderCorto: "Escribí tu consulta…",
    enviar: "Consultar",
    limite: `Llegaste al máximo de ${MAX_CARACTERES} caracteres.`,
    cargando: "Preparando el modelo en tu navegador",
    volver: "Volver",
    cerrar: "Cerrar",
    cuaderno: "cuaderno de Leonardo",
    leerEn: "Leer en gutenberg.org ↗",
    richter: "Richter anota (1888)",
    fuentes: "Fuentes",
    // `curada` y `abstiene` llegan con `texto` vacío del servidor: esta es la
    // redacción del frontend, y por eso vive acá y no en el prompt.
    curada: "De eso no dejé anotación alguna en mis cuadernos.",
    sinNotaAviso: "Mis papeles callan, y Richter, mi editor, tampoco comenta el silencio.",
    abstiene: "Sobre eso no he dejado anotación en mis cuadernos, y prefiero no inventarte una.",
  },
  en: {
    titulo: "Consult Leonardo da Vinci",
    saludo: "Choose one of these questions, or write your own. I shall answer with what I set down in my notebooks.",
    nota: "Quoted phrases are literal transcriptions from his notebooks, unmodified, so as not to lose authenticity. That is why the language sometimes sounds archaic or reads with difficulty.",
    sugeridas: "Suggested questions",
    otras: "Other suggested questions",
    abrir: "Expand",
    cerrarLista: "Close",
    placeholder: "Write your question for Leonardo da Vinci…",
    placeholderCorto: "Write your question…",
    enviar: "Ask",
    limite: `You have reached the ${MAX_CARACTERES}-character limit.`,
    cargando: "Preparing the model in your browser",
    volver: "Back",
    cerrar: "Close",
    cuaderno: "Leonardo's notebook",
    leerEn: "Read on gutenberg.org ↗",
    richter: "Richter notes (1888)",
    fuentes: "Sources",
    curada: "Of that I left no notation at all in my notebooks.",
    sinNotaAviso: "My papers are silent, and Richter, my editor, does not comment on the silence either.",
    abstiene: "On that matter I left no notation in my notebooks, and I would rather not invent one for you.",
  },
} as const;

/**
 * Richter compuso los encabezados de sección EN VERSALES, y ese encabezado
 * viene pegado al principio del pasaje. En pantalla eso grita.
 *
 * SE SEPARA PARA COMPONERLO COMO EL TITULILLO QUE ES: más chico, espaciado,
 * más tenue y en caja baja, con la capital inicial de vuelta.
 *
 * LA CAJA SE CAMBIA ACA Y NO CON CSS. El intento con `text-transform:lowercase`
 * más `::first-letter{text-transform:uppercase}` se ve bien en el 90% del caso
 * y falla justo acá: el párrafo abre con «, y Chrome toma ESA comilla como la
 * primera letra, así que la capital se aplica a un carácter que no tiene caja y
 * el titulillo queda «que la escultura…». Con la comilla afuera del cálculo el
 * resultado es el mismo en cualquier motor.
 *
 * QUE QUEDE CLARO QUE ESTO ES UNA DECISION, NO UN ARREGLO. El texto entre
 * comillas es verbatim verificado por coincidencia exacta contra el original
 * (D-082), y `text-transform` hace que lo que se ve en pantalla no sea, letra
 * por letra, lo que abre el enlace de al lado. **Los caracteres del dato no se
 * tocan** —la caja la pone la hoja de estilos, la verificación sigue corriendo
 * contra el original— así que la garantía está intacta donde se mide; lo que
 * cambia es la presentación. El dueño del proyecto lo pidió sabiendo eso.
 *
 * Costo medido sobre los 367 encabezados en versales del corpus: **dos** traen
 * un nombre propio que la caja baja se lleva puesto («MINT AT ROME.», «CANAL
 * OF FLORENCE.»). Los dos son del corpus inglés.
 */
/** A caja baja, devolviéndole la mayúscula a la primera letra con caja. */
function aCajaBaja(s: string): string {
  return s.toLocaleLowerCase("es").replace(/[a-záéíóúñü]/, (c) => c.toLocaleUpperCase("es"));
}

function partirVersales(texto: string): { encabezado: string | null; cuerpo: string } {
  // Sin la bandera "s" (el target es ES2017): `[\s\S]` hace de punto-que-cruza-renglones.
  const m = /^([^a-záéíóúñü]{12,}?[.:])\s+([\s\S]*)$/.exec(texto);
  if (m) return { encabezado: aCajaBaja(m[1]!), cuerpo: m[2]! };
  // Un pasaje que es SOLO el encabezado (pasa: hay entradas de Richter que son
  // nada más que el título de la sección). Va como titulillo, sin cuerpo.
  if (/^[^a-záéíóúñü]{12,}$/.test(texto)) return { encabezado: aCajaBaja(texto), cuerpo: "" };
  return { encabezado: null, cuerpo: texto };
}

/** Lo que se muestra mientras bajan los 129 MB: no es relleno, es corpus. */
const CURIOSOS = [
  { tag: "corpus", es: "Sobre el color de la atmósfera (R. 300–307)", en: "On the colour of the atmosphere (R. 300–307)" },
  { tag: "historico", es: "Leonardo escribía de derecha a izquierda, en escritura especular.", en: "Leonardo wrote right to left, in mirror script." },
  { tag: "corpus", es: "La función del ojo (R. 19–29)", en: "The function of the eye (R. 19–29)" },
  { tag: "historico", es: "Sus cuadernos suman más de 7.500 páginas conocidas.", en: "His notebooks total more than 7,500 known pages." },
  { tag: "corpus", es: "Seis libros sobre luz y sombra (R. 110–131)", en: "Six books on Light and Shade (R. 110–131)" },
  { tag: "historico", es: "La traducción que funda este proyecto es de 1888, obra de J. P. Richter.", en: "The translation this project is grounded in dates from 1888, by J. P. Richter." },
] as const;

export function Codice({ lang, onCerrar }: { lang: Idioma; onCerrar: () => void }) {
  const t = COPY[lang];
  const angosto = useAngosto();
  const { estado, progreso, embed } = useEmbedder();

  /**
   * La medida de lectura en un teléfono. 18 px en una columna de 340 px da
   * renglones de ~34 caracteres: demasiado cortos, el ojo salta de línea más
   * de lo que lee. Con 16,5 quedan ~40, que es el piso de una lectura cómoda.
   */
  const lectura = angosto
    ? { ...TEXTO_LECTURA, fontSize: 16.5, lineHeight: 1.7 }
    : TEXTO_LECTURA;
  /** Sangría de la evidencia: en móvil se cede a favor del ancho de texto. */
  const sangria = angosto ? 8 : 18;

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  /**
   * Las sugeridas ya preguntadas, POR ID Y NO POR CLAVE. La clave del bundle
   * es `"<id>:<idioma>"`: guardando la clave, cambiar a inglés hacía reaparecer
   * en el estante las seis preguntas que el usuario ya había hecho, porque
   * `"pintura:en"` no estaba en la lista aunque `"pintura:es"` sí.
   */
  const [hechas, setHechas] = useState<string[]>([]);
  const [sugAbiertas, setSugAbiertas] = useState(true);
  const [entrada, setEntrada] = useState("");
  const [enVuelo, setEnVuelo] = useState(false);
  const [curioso, setCurioso] = useState(0);

  const seq = useRef(0);
  /**
   * Turnos consumidos en la sesión. NO SE DERIVA DE `mensajes` y no se limpia
   * con «Volver»: la ruta corta en 20 turnos y ese número se lo manda el
   * cliente, así que contando los mensajes en pantalla bastaba con volver al
   * menú —que los borra— para que el contador arrancara de cero otra vez.
   */
  const turnos = useRef(0);
  const finLista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const escrituras = useRef<ReturnType<typeof setTimeout>[]>([]);
  /**
   * UN SOLO id, NO UNA LISTA. Antes se apilaba uno por cuadro: un revelado de
   * 5 s dejaba ~300 números en memoria, y una conversación entera, miles —
   * todos inútiles salvo el último, porque sólo hay un cuadro pendiente a la
   * vez.
   */
  const cuadro = useRef<number | null>(null);

  const modeloListo = estado === "listo";

  useEffect(() => {
    const relojes = escrituras.current;
    return () => {
      relojes.forEach(clearTimeout);
      if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
    };
  }, []);

  // Escape cierra. Un panel a pantalla completa sin salida por teclado obliga
  // a apuntarle a la × con el mouse, que es justo lo que un modal no debería.
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [onCerrar]);

  useEffect(() => {
    if (modeloListo) return;
    const id = setInterval(() => setCurioso((c) => (c + 1) % CURIOSOS.length), 4200);
    return () => clearInterval(id);
  }, [modeloListo]);

  /**
   * DEPENDE DE LA CANTIDAD DE MENSAJES, NO DEL ARREGLO. Con `[mensajes]` esto
   * corría en cada cuadro del revelado —60 veces por segundo—, y cada llamada
   * reiniciaba un scroll suave que nunca llegaba a terminar: la lista
   * temblaba y era imposible subir a releer mientras Leonardo "escribía".
   * Con la longitud, corre una vez por mensaje nuevo, que es cuando hace falta.
   */
  useEffect(() => {
    finLista.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes.length]);

  const parchear = useCallback((id: number, patch: Partial<Extract<Mensaje, { tipo: "leonardo" }>>) => {
    setMensajes((ms) => ms.map((m) => (m.id === id && m.tipo === "leonardo" ? { ...m, ...patch } : m)));
  }, []);

  /**
   * El revelado progresivo, a ~215 caracteres por segundo: más rápido que
   * cualquier escritura humana, lento como para que se lea llegando. El texto
   * ya está entero en `completo` — esto no espera nada de la red.
   *
   * VA POR TIEMPO TRANSCURRIDO Y POR `requestAnimationFrame`, NO POR UN
   * CONTADOR CON `setTimeout`. Un navegador clampea los temporizadores de una
   * pestaña en segundo plano a ~1 por segundo: con el contador, quien cambiaba
   * de pestaña a la mitad volvía a encontrar la respuesta arrastrándose de a 3
   * caracteres por segundo, y —desde que la evidencia espera al final del
   * revelado— los pasajes tardaban minutos en aparecer. Calculando la posición
   * desde `t0`, al volver a la pestaña el texto **se pone al día de un salto**,
   * que es lo que cualquiera esperaría.
   *
   * Y si la pestaña ya está oculta cuando llega la respuesta, no hay nada que
   * mirar: se muestra entera, con su evidencia, sin animación ninguna.
   */
  const revelar = useCallback(
    (id: number, completo: string) => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        parchear(id, { texto: completo, revelado: true });
        return;
      }
      const t0 = performance.now();
      const paso = () => {
        const i = Math.min(completo.length, Math.ceil((performance.now() - t0) / MS_POR_CARACTER));
        parchear(id, { texto: completo.slice(0, i) });
        if (i < completo.length) cuadro.current = requestAnimationFrame(paso);
        else {
          cuadro.current = null;
          parchear(id, { revelado: true });
        }
      };
      cuadro.current = requestAnimationFrame(paso);
    },
    [parchear],
  );

  const agregar = (m: SinId<Mensaje>): number => {
    const id = ++seq.current;
    setMensajes((ms) => [...ms, { ...m, id } as Mensaje]);
    return id;
  };

  const abrirLeonardo = (): number =>
    agregar({
      tipo: "leonardo",
      pendiente: true,
      texto: "",
      completo: "",
      cita: null,
      sinNota: false,
      revelado: false,
      pasajes: [],
    });

  /** Traduce las tres decisiones del servidor a lo que se ve en pantalla. */
  const asentar = (id: number, r: RespuestaPublica) => {
    if (r.decision === "responde") {
      parchear(id, {
        pendiente: false,
        completo: r.texto,
        pasajes: r.pasajes.map((p) => ({ ...p, abierto: false })),
      });
      revelar(id, r.texto);
      return;
    }
    if (r.decision === "curada") {
      const cita = r.cita ?? null;
      parchear(id, { pendiente: false, completo: t.curada, cita, sinNota: !cita, pasajes: [] });
      revelar(id, t.curada);
      return;
    }
    parchear(id, { pendiente: false, completo: t.abstiene, pasajes: [] });
    revelar(id, t.abstiene);
  };

  /** Camino corto: la respuesta ya está en el bundle. Ni red ni modelo. */
  const preguntarSugerida = (clave: string, pregunta: string) => {
    const fija = PORTADA[clave];
    if (!fija) return;
    setHechas((h) => (h.includes(fija.id) ? h : [...h, fija.id]));
    setSugAbiertas(false);
    agregar({ tipo: "usuario", texto: pregunta });
    const id = abrirLeonardo();
    // Un respiro antes de contestar: sin él, una respuesta instantánea delata
    // que estaba guardada y se lee como un truco en vez de como una respuesta.
    escrituras.current.push(setTimeout(() => asentar(id, fija), 420));
  };

  /** Camino largo: vector en el navegador y `POST /api/chat`. */
  const preguntarLibre = async (texto: string) => {
    agregar({ tipo: "usuario", texto });
    const id = abrirLeonardo();
    setEnVuelo(true);
    // El turno cuenta lo que el usuario dijo, incluido este. La ruta corta en
    // 20 con un 429; el mensaje de ese corte lo escribe `cliente-chat.ts`.
    const turno = ++turnos.current;
    try {
      // `embed` espera solo a que el modelo esté listo si todavía no lo está.
      const vector = await embed(texto);
      const r = await consultar(texto, lang, vector, turno);
      if (r.ok) asentar(id, r.respuesta);
      else {
        setMensajes((ms) => ms.filter((m) => m.id !== id));
        agregar({ tipo: "sistema", texto: r.texto });
      }
    } catch {
      setMensajes((ms) => ms.filter((m) => m.id !== id));
      agregar({
        tipo: "sistema",
        texto:
          lang === "es"
            ? "No pude preparar la consulta en tu navegador. Recargá la página y probá de nuevo."
            : "I could not prepare the query in your browser. Reload the page and try again.",
      });
    } finally {
      setEnVuelo(false);
    }
  };

  const enviar = () => {
    const v = entrada.trim();
    if (!v || enVuelo) return;
    setEntrada("");
    if (campo.current) campo.current.style.height = "auto";
    void preguntarLibre(v);
  };

  const sugerencias = Object.keys(PORTADA)
    .filter((k) => k.endsWith(`:${lang}`))
    .map((clave) => ({ clave, id: PORTADA[clave]!.id, pregunta: PORTADA[clave]!.pregunta }));
  const restantes = sugerencias.filter((s) => !hechas.includes(s.id));

  const sinMensajes = mensajes.length === 0;
  const c = CURIOSOS[curioso]!;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        onClick={onCerrar}
        style={{ position: "absolute", inset: 0, background: "oklch(6% 0.02 40 / 0.55)" }}
      />

      <div
        className="alv-in alv-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t.titulo}
        style={{
          position: "relative",
          // Con el borde de 1 px y la altura en `dvh`, sin esto el panel mide
          // 2 px MAS que la pantalla: se iba 2 px por arriba del borde.
          boxSizing: "border-box",
          width: angosto ? "100vw" : "min(1320px,96vw)",
          marginBottom: angosto ? 0 : "clamp(12px,2.4vh,26px)",
          background: T.panelBg,
          backgroundImage: `radial-gradient(circle at 50% 0%, ${T.panelGradFrom} 0%, ${T.panelGradTo} 100%)`,
          border: `1px solid ${T.panelBorde}`,
          // Despegado del piso: apoyado contra el borde de la ventana el panel
          // se lee como una hoja cortada, no como algo que flota sobre el
          // taller. Por eso además redondea las cuatro esquinas, no dos.
          // Sin esquinas en teléfono: a pantalla completa, un radio sólo deja
          // ver cuatro cachitos del hero por las puntas.
          borderRadius: angosto ? 0 : 16,
          boxShadow: "0 20px 60px oklch(6% 0.02 40 / 0.55)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            boxSizing: "border-box",
            // El claro lateral tiene que despejar los dos botones absolutos.
            // En escritorio el de la izquierda dice «← Volver» y ocupa ~124 px;
            // en un teléfono eso se come el título, así que ahí queda la flecha
            // sola y alcanza con 52.
            padding: angosto
              ? "calc(13px + env(safe-area-inset-top)) 52px 11px"
              : "19px clamp(126px,15vw,170px) 17px",
            textAlign: "center",
            position: "relative",
            borderBottom: `1px solid ${T.headerLinea}`,
            flexShrink: 0,
          }}
        >
          {!sinMensajes && (
            <button
              type="button"
              className="alv-cerrar"
              onClick={() => {
                setMensajes([]);
                setHechas([]);
                setSugAbiertas(true);
              }}
              aria-label={t.volver}
              title={t.volver}
              style={{
                position: "absolute",
                top: angosto ? "calc(11px + env(safe-area-inset-top))" : 14,
                left: angosto ? 12 : 16,
                height: 34,
                width: angosto ? 34 : undefined,
                padding: angosto ? 0 : "0 14px",
                boxSizing: "border-box",
                borderRadius: 8,
                border: "1px solid oklch(34% 0.006 70)",
                background: "none",
                cursor: "pointer",
                fontFamily: FUENTE.lectura,
                fontSize: 13,
                letterSpacing: ".04em",
                color: T.cuerpo,
                transition: "color .2s ease, border-color .2s ease, background .2s ease",
              }}
            >
              {angosto ? "←" : `← ${t.volver}`}
            </button>
          )}

          <h2
            style={{
              margin: 0,
              fontFamily: FUENTE.manuscrita,
              fontSize: angosto ? 16 : 20,
              fontWeight: 400,
              letterSpacing: ".01em",
              color: T.titulo,
            }}
          >
            {t.titulo}
          </h2>

          <button
            type="button"
            className="alv-cerrar"
            onClick={onCerrar}
            aria-label={t.cerrar}
            title={t.cerrar}
            style={{
              position: "absolute",
              top: angosto ? "calc(11px + env(safe-area-inset-top))" : 14,
              right: angosto ? 12 : 16,
              width: 34,
              height: 34,
              boxSizing: "border-box",
              padding: 0,
              borderRadius: 8,
              border: "1px solid oklch(34% 0.006 70)",
              background: "none",
              cursor: "pointer",
              fontFamily: FUENTE.lectura,
              fontSize: 20,
              lineHeight: 1,
              color: "oklch(74% 0.006 75)",
              transition: "color .2s ease, border-color .2s ease, background .2s ease",
            }}
          >
            ×
          </button>
        </div>

        <div
          className="alv-scroll"
          style={{
            flex: "1 1 0",
            minHeight: "clamp(120px,22vh,240px)",
            boxSizing: "border-box",
            overflowY: "auto",
            padding: angosto ? "16px 16px" : "clamp(14px,3vh,30px) max(5vw,24px)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            maxWidth: 760,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {sinMensajes && (
            <div style={{ paddingTop: "clamp(4px,2.5vh,26px)" }}>
              <div style={{ borderLeft: `2px solid ${T.bordeIzq}`, padding: "2px 0 2px 16px" }}>
                <p style={{ margin: "0 0 6px", fontFamily: FUENTE.lectura, fontSize: 13, color: T.nombre }}>
                  Leonardo da Vinci
                </p>
                <p style={lectura}>{t.saludo}</p>
                {/*
                  §5-ter: la aclaración sobre el lenguaje arcaico va en la UI,
                  nunca en lo que genera el modelo. Tocar el generador obligaría
                  a rehacer `evals:citas-corpus` sobre los 120 casos de control;
                  un cuadro estático no toca el pipeline en absoluto.
                */}
                <p
                  style={{
                    margin: "16px 0 0",
                    maxWidth: "62ch",
                    fontFamily: FUENTE.lectura,
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: T.tenue,
                  }}
                >
                  {t.nota}
                </p>
              </div>
            </div>
          )}

          {mensajes.map((m) => {
            if (m.tipo === "usuario") {
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: "76%",
                    marginTop: 12,
                    background: T.usuarioBg,
                    border: `1px solid ${T.cajaBorde}`,
                    borderRadius: 10,
                    padding: "12px 16px",
                  }}
                >
                  <p style={{ ...lectura, fontSize: angosto ? 15.5 : 16, lineHeight: 1.6 }}>{m.texto}</p>
                </div>
              );
            }

            if (m.tipo === "sistema") {
              return (
                <div
                  key={m.id}
                  role="status"
                  style={{
                    alignSelf: "center",
                    maxWidth: "88%",
                    background: T.sistemaBg,
                    border: `1px solid ${T.cajaBorde}`,
                    borderRadius: 8,
                    padding: "10px 16px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontFamily: FUENTE.lectura,
                      fontSize: 14,
                      lineHeight: 1.45,
                      color: T.sistemaTexto,
                      textAlign: "center",
                    }}
                  >
                    {m.texto}
                  </p>
                </div>
              );
            }

            return (
              <div key={m.id} style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ borderLeft: `2px solid ${T.bordeIzq}`, padding: "2px 0 2px 16px" }}>
                  <p style={{ margin: "0 0 6px", fontFamily: FUENTE.lectura, fontSize: 13, color: T.nombre }}>
                    Leonardo da Vinci
                  </p>
                  {m.pendiente ? (
                    <div style={{ display: "flex", gap: 5, padding: "4px 0" }}>
                      {[0, 0.15, 0.3].map((d) => (
                        <span
                          key={d}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: T.punto,
                            animation: `alv-blink 1.1s infinite ${d}s`,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p style={{ ...lectura, whiteSpace: "pre-line" }}>{m.texto}</p>
                  )}
                </div>

                {m.revelado && m.cita && (
                  <div
                    style={{
                      border: `1px solid ${T.notaBorde}`,
                      borderRadius: 8,
                      padding: "12px 14px",
                      marginLeft: sangria,
                    }}
                  >
                    <p style={{ margin: "0 0 5px", fontFamily: FUENTE.lectura, fontSize: 13, color: T.notaEtiqueta }}>
                      {t.richter}
                    </p>
                    <p
                      style={{
                        ...lectura,
                        fontSize: angosto ? 15 : 16,
                        lineHeight: 1.65,
                        color: T.notaTexto,
                        fontStyle: "italic",
                      }}
                    >
                      «{m.cita}»
                    </p>
                  </div>
                )}

                {m.revelado && m.sinNota && (
                  <p
                    style={{
                      margin: 0,
                      paddingLeft: 2,
                      fontFamily: FUENTE.lectura,
                      fontSize: 14,
                      fontStyle: "italic",
                      color: T.nombre,
                    }}
                  >
                    {t.sinNotaAviso}
                  </p>
                )}

                {m.revelado && m.pasajes.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/*
                      Un rótulo sobrio: sin él las tarjetas quedan como tres
                      controles sueltos, y lo que son es la prueba de lo que se
                      acaba de leer. Nombrarlas es la mitad del argumento.
                    */}
                    <p
                      style={{
                        margin: `2px 0 2px ${sangria}px`,
                        fontFamily: FUENTE.lectura,
                        fontSize: 11,
                        letterSpacing: ".16em",
                        textTransform: "uppercase",
                        color: T.nombre,
                      }}
                    >
                      {t.fuentes}
                    </p>
                    {m.pasajes.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          background: T.pasajeBg,
                          border: `1px solid ${T.pasajeBorde}`,
                          borderRadius: 8,
                          overflow: "hidden",
                          marginLeft: sangria,
                        }}
                      >
                        <button
                          type="button"
                          className="alv-pasaje-toggle"
                          aria-expanded={p.abierto}
                          onClick={() =>
                            parchear(m.id, {
                              pasajes: m.pasajes.map((pp, j) => (j === i ? { ...pp, abierto: !pp.abierto } : pp)),
                            })
                          }
                          style={{
                            display: "flex",
                            width: "100%",
                            boxSizing: "border-box",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            background: "none",
                            border: "none",
                            padding: "11px 14px",
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: FUENTE.lectura,
                            fontSize: 13,
                            letterSpacing: ".02em",
                            color: T.pasajeToggle,
                          }}
                        >
                          <span>
                            R. {p.richterNo}{" "}
                            <span style={{ opacity: 0.6, fontSize: 13 }}>— {p.titulo ?? t.cuaderno}</span>
                          </span>
                          <span aria-hidden="true" style={{ width: 22, textAlign: "center", fontSize: 10, opacity: 0.65 }}>
                            {p.abierto ? "▲" : "▼"}
                          </span>
                        </button>
                        {p.abierto && (
                          <div style={{ padding: "0 12px 14px" }}>
                            {(() => {
                              const { encabezado, cuerpo } = partirVersales(p.texto);
                              return (
                                <>
                                  {encabezado && (
                                    <p
                                      style={{
                                        margin: "0 0 8px",
                                        fontFamily: FUENTE.lectura,
                                        fontSize: 13.5,
                                        lineHeight: 1.6,
                                        letterSpacing: ".02em",
                                        color: T.notaEtiqueta,
                                      }}
                                    >
                                      «{encabezado}
                                      {cuerpo ? "" : "»"}
                                    </p>
                                  )}
                                  {cuerpo && (
                                    <p style={{ ...lectura, fontSize: angosto ? 15 : 16, lineHeight: 1.7, color: T.pasajeTexto, margin: "0 0 8px" }}>
                                      {encabezado ? "" : "«"}
                                      {cuerpo}»
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                            <a
                              href={p.url ?? GUTENBERG}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontFamily: FUENTE.lectura, fontSize: 14 }}
                            >
                              {t.leerEn}
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div ref={finLista} />
        </div>

        {restantes.length > 0 && (
          <div
            style={{
              boxSizing: "border-box",
              flex: "0 1 auto",
              minHeight: 0,
              maxHeight: angosto ? "min(230px,30vh)" : "min(300px,34vh)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: angosto
                ? "0 max(12px, env(safe-area-inset-left)) 0 max(12px, env(safe-area-inset-right))"
                : `0 ${CANAL}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, padding: "15px 0 12px" }}>
              <button
                type="button"
                className="alv-btn-texto"
                onClick={() => setSugAbiertas((v) => !v)}
                aria-expanded={sugAbiertas}
                style={{
                  display: "flex",
                  flex: "1 1 auto",
                  minWidth: 0,
                  alignItems: "center",
                  gap: 14,
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: FUENTE.lectura,
                  fontSize: 16,
                  fontWeight: 600,
                  color: "oklch(88% 0.006 75)",
                  transition: "color .18s ease",
                }}
              >
                <span style={{ flex: "1 1 auto", textAlign: "left" }}>
                  {hechas.length === 0 ? t.sugeridas : t.otras}{" "}
                  <span style={{ opacity: 0.55, fontWeight: 400 }}>({restantes.length})</span>
                </span>
                <span
                  aria-hidden="true"
                  title={sugAbiertas ? t.cerrarLista : t.abrir}
                  style={{ width: 22, fontSize: 10, color: "oklch(66% 0.006 75)" }}
                >
                  {sugAbiertas ? "▼" : "▲"}
                </span>
              </button>
            </div>

            {sugAbiertas && (
              <div
                className="alv-scroll"
                style={{ display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto", padding: "0 0 14px" }}
              >
                {restantes.map((s) => (
                  <button
                    key={s.clave}
                    type="button"
                    className="alv-fila"
                    disabled={enVuelo}
                    onClick={() => preguntarSugerida(s.clave, s.pregunta)}
                    style={{
                      textAlign: "left",
                      width: "100%",
                      boxSizing: "border-box",
                      padding: angosto ? "13px 8px" : "15px 12px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid oklch(21% 0.006 70)",
                      borderRadius: 6,
                      fontFamily: FUENTE.lectura,
                      fontSize: angosto ? 15 : 16,
                      lineHeight: 1.5,
                      color: "oklch(82% 0.006 75)",
                      cursor: enVuelo ? "not-allowed" : "pointer",
                      opacity: enVuelo ? 0.45 : 1,
                      textWrap: "pretty",
                      transition: "background .18s ease, color .18s ease",
                    }}
                  >
                    {s.pregunta}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/*
          La barra sólo aplica a lo que se escribe a mano: las 6 sugeridas
          andan igual con el modelo a medio bajar, y por eso la lista de arriba
          nunca se deshabilita.
        */}
        {!modeloListo && (
          <div style={{ boxSizing: "border-box", padding: `10px ${CANAL}`, borderTop: `1px solid ${T.cargaBorde}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: FUENTE.lectura, fontSize: 13, color: T.cargaEtiqueta }}>{t.cargando}</span>
              <span style={{ fontFamily: FUENTE.lectura, fontSize: 13, color: T.cargaEtiqueta }}>{progreso}%</span>
            </div>
            <div style={{ height: 3, borderRadius: 999, background: T.pista, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 999, background: T.barra, width: `${progreso}%`, transition: "width .3s linear" }} />
            </div>
            <p style={{ margin: "7px 0 0", fontFamily: FUENTE.lectura, fontSize: 13, lineHeight: 1.5, color: T.cargaEtiqueta }}>
              <span style={{ fontSize: 13, marginRight: 8, color: "oklch(74% 0.01 80)" }}>
                {c.tag === "corpus"
                  ? lang === "es"
                    ? "De sus cuadernos"
                    : "From his notebooks"
                  : lang === "es"
                    ? "Dato histórico"
                    : "Historical fact"}
              </span>
              {lang === "es" ? c.es : c.en}
            </p>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          style={{
            display: "block",
            boxSizing: "border-box",
            // EL RELLENO DE ABAJO SUMA EL AREA SEGURA. Con `viewport-fit=cover`
            // el panel llega hasta el borde vivo de la pantalla, y en un
            // teléfono con indicador de inicio —o con la barra de gestos de
            // Android— eso deja el botón «Consultar» debajo de un elemento del
            // sistema: se ve, pero el toque se lo lleva el sistema. En un
            // teléfono sin indicador, `env()` vale 0 y no sobra nada.
            padding: angosto
              ? "10px 12px calc(14px + env(safe-area-inset-bottom))"
              : `14px ${CANAL} 20px`,
            borderTop: `1px solid ${T.cargaBorde}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 10,
              boxSizing: "border-box",
              width: "100%",
              border: `1px solid ${T.campoBorde}`,
              borderRadius: 10,
              background: T.cajaBg,
              padding: "9px 9px 9px 6px",
            }}
          >
            <textarea
              ref={campo}
              className="alv-scroll"
              value={entrada}
              onChange={(e) => {
                setEntrada(e.target.value);
                // Crece con el contenido hasta el tope. `field-sizing: content`
                // haría esto solo, pero todavía no está en todos los motores.
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(128, e.target.scrollHeight)}px`;
              }}
              onKeyDown={(e) => {
                // Enter envía, Shift+Enter hace un renglón: lo que ya espera
                // cualquiera que haya usado un chat.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={1}
              maxLength={MAX_CARACTERES}
              spellCheck={false}
              placeholder={angosto ? t.placeholderCorto : t.placeholder}
              aria-label={t.placeholder}
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                resize: "none",
                border: "none",
                padding: "7px 10px",
                fontFamily: FUENTE.lectura,
                fontSize: 16,
                lineHeight: 1.6,
                background: "transparent",
                color: T.campoTexto,
                outline: "none",
                minHeight: 26,
                maxHeight: 128,
                overflowY: "auto",
              }}
            />
            <button
              type="submit"
              className="alv-enviar"
              disabled={!entrada.trim() || enVuelo}
              style={{
                boxSizing: "border-box",
                height: 40,
                padding: angosto ? "0 12px" : "0 18px",
                background: T.enviarBg,
                color: T.enviarTexto,
                border: "none",
                borderRadius: 7,
                fontFamily: FUENTE.lectura,
                fontSize: angosto ? 15 : 16,
                fontWeight: 600,
                cursor: entrada.trim() && !enVuelo ? "pointer" : "not-allowed",
                opacity: entrada.trim() && !enVuelo ? 1 : 0.42,
                flexShrink: 0,
                transition: "opacity .2s ease, filter .2s ease",
              }}
            >
              {t.enviar}
            </button>
          </div>
          {entrada.length >= MAX_CARACTERES && (
            <p style={{ margin: "8px 0 0", paddingLeft: 8, fontFamily: FUENTE.lectura, fontSize: 13, fontStyle: "italic", color: "oklch(60% 0.06 60)" }}>
              {t.limite}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
