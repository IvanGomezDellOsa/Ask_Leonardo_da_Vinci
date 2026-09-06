"use client";

/**
 * «Cómo funciona». Se abre ANTES de que el usuario escriba nada.
 *
 * ============================================================
 * DOS VERSIONES, Y LA CORTA ES LA QUE SE VE (D-178, D-180)
 * ============================================================
 *
 * LA CORTA es para cualquiera, y «cualquiera» incluye a quien no sabe qué es un
 * modelo de lenguaje (D-186). De ahí su vocabulario: **«una IA común» y «en
 * este proyecto»**, nunca «un modelo» y «este». La diferencia entre dos modelos
 * no le dice nada a alguien que no tiene por qué saber que existen.
 *
 * Su primer párrafo es el argumento del proyecto y no una advertencia, y salió
 * del texto con el que el dueño lo explica en LinkedIn — que decía en dos
 * frases lo que a mí me costaba cinco:
 *
 * > Leonardo dejó más de 7.500 páginas de manuscritos personales. **No hace
 * > falta adivinar cómo respondería: ya lo contestó él.**
 *
 * Eso es el proyecto entero. Las versiones anteriores abrían explicando lo que
 * el sistema NO hace —no inventa, no es Leonardo, no lee los manuscritos
 * originales—, o sea tres negaciones antes de la primera afirmación. Ahora abre
 * diciendo por qué esto es posible con Leonardo y casi con nadie más.
 *
 * LA TECNICA es para quien vino por el cómo. Y **vive en la web, no en el
 * repositorio** — la distinción decide qué entra (D-184):
 *
 * > Su trabajo es ser **creíble**, no **reproducible**. Lo reproducible está en
 * > GitHub, que es donde alguien que quiere correrlo va a ir igual.
 *
 * De ahí tres cosas que NO van, aunque sean ciertas e interesantes:
 *
 * - **la receta** — nombres de modelos, fórmulas, dimensiones, comandos, los
 *   números de la calibración. Explica el QUÉ y el POR QUÉ; el CÓMO exacto no.
 * - **la autocrítica de diseño** — «las clases de defecto atacadas por prompt
 *   mutan» era una lección de ingeniería contándose a sí misma.
 * - **las contras que nadie preguntó**, que es la regla del boleto de avión de
 *   acá abajo aplicada también a esta pestaña, no sólo a la corta.
 *
 * ============================================================
 * EL CRITERIO DE QUE ENTRA EN CADA UNA
 * ============================================================
 *
 * De la Nota ética de `05-anti-alucinacion.md`, reescrita en D-179: **son
 * obligaciones de RESULTADO, no de redacción.** Ninguna de estas cuatro cosas
 * puede quedar oculta —que del otro lado no hay una persona, qué corpus usa y
 * qué no cubre, que la selección es de 1888 y tiene sesgo, y que el resultado
 * principal es comprobable— pero **la forma es libre y se reparte entre las dos
 * versiones**.
 *
 * Y el calibre, que es lo que hizo falta aprender dos veces:
 *
 * > **No mentir no es lo mismo que declarar cada contra.**
 * > «Es como que reservás un boleto de avión y te escriben: tenés un 10% de
 * > chances de morir.» — el dueño, D-178
 *
 * Es la misma lección que la Capa 1 ya tenía escrita para el gate: la
 * sobre-abstención entra como costo medido, no como virtud gratuita (D-041).
 *
 * NO SE PONE LA TASA DE ALUCINACION COMO TITULAR (D-094): su IC 95% es
 * [0% — 12,8%], y un «1-2%» suelto suena a una precisión que la muestra no da.
 * Lo que se publica es el conteo, y con el signo de aproximado: **≈0% de citas
 * inventadas.** El conteo es exacto y sin intervalo —0 sobre 187, comprobadas
 * una por una—, pero un «0%» pelado promete un absoluto sobre la próxima
 * pregunta que 187 casos verificados no demuestran. **Lo que el «≈» cubre es la
 * generalización, no el error de medición** (D-183).
 *
 * Ese razonamiento **no se explica en pantalla** (D-185): la corta dice «≈ 0%»
 * y la técnica dice «0 sobre 187», y las dos son honestas por separado. Poner
 * por qué una lleva el signo era enseñar cómo funciona la probabilidad a quien
 * no lo preguntó.
 *
 * ============================================================
 * PUNTUACION: LA RAYA SUELTA ES DEL INGLES (D-182)
 * ============================================================
 *
 * En español la raya de inciso va **en par y pegada al texto** («hay temas —su
 * vida privada, sobre todo— de los que…»). Una raya SOLA y espaciada para
 * introducir una explicación es calco del em dash inglés: acá van dos puntos,
 * punto y coma o punto. El paréntesis queda para el dato puro y prescindible
 * —«Richter (1888)»—, que es donde suena natural.
 *
 * El texto en inglés conserva sus « — » porque ahí sí son correctos.
 */

import { useEffect, useState } from "react";
import { useAngosto } from "../hooks/useAngosto.js";
import { FUENTE, T } from "./estilos.js";
import type { Idioma } from "../lib/cliente-chat.js";

const COPY = {
  es: {
    titulo: "Responde sólo con lo que Leonardo escribió",
    parrafos: [
      "Una IA común, si le pedís que actúe de Leonardo, se inventa una personalidad y habla por él. En este proyecto lo hicimos distinto: Leonardo dejó más de 7.500 páginas de manuscritos personales, algo que casi ningún personaje histórico dejó. No hay que adivinar cómo respondería, porque ya lo contestó él.",
      "Debajo de cada respuesta vas a ver los pasajes que la sostienen, con el enlace a la fuente: la edición de J. P. Richter (1888).",
      "Si algo no está en sus cuadernos, lo dice en vez de inventarlo. Escribió casi siempre de ciencia y de su trabajo, así que hay temas —su vida privada, por ejemplo— de los que no hay tanto material.",
      "Las frases entre comillas no están reescritas: salen textuales de esos pasajes. Por eso a veces suenan antiguas; modernizarlas sería ponerle palabras que no son suyas.",
      "Que no invente no es una promesa: está medido. Si a una IA común le pedís que hable como Leonardo, se inventa las citas: sobre 120 preguntas de prueba, el 96,9% de las frases que le atribuyó no existen en ninguna parte. En este proyecto, ≈ 0% inventado. El código que lo comprueba es público.",
      "No se guarda ninguna de tus preguntas.",
    ],
    pestanaSimple: "Lo esencial",
    pestanaTecnica: "Explicación técnica",
    boton: "Entendido",
    avisoPrivacidad: "Aviso de privacidad",
    cerrarAviso: "Cerrar",
    tituloPrivacidad: "Qué pasa con lo que escribís",
    privacidad: [
      "No hay cuentas ni cookies: este sitio no guarda nada en tu navegador. Las visitas sí se cuentan, y más abajo está explicado cómo.",
      "Tus preguntas no se guardan. Se usan para buscar en los cuadernos y para armar la respuesta, y ahí terminan: no quedan en ningún registro, ni acá ni en ningún lado.",
      "Para responder, tu pregunta y los pasajes encontrados se le envían a Google, que es quien redacta la respuesta a partir de ese material. Si Google no está disponible, se envían a Groq. Ninguno de los dos recibe tu nombre ni nada que te identifique, porque el sitio no te lo pide.",
      "Se cuenta cuántas consultas llegan desde cada conexión, para que nadie agote el servicio. Tu dirección IP se convierte en un código irreversible antes de contarla y se descarta al cabo de un día. La dirección tal cual no se guarda nunca, y nunca junto a lo que preguntaste.",
      "La primera vez que abrís la consulta, tu navegador descarga desde Hugging Face el modelo que busca en los cuadernos. Es una descarga única y ocurre en tu equipo. Si reproducís el video de la biblioteca, YouTube lo sirve en su versión sin cookies de seguimiento.",
      "Para comprobar que del otro lado hay una persona y no un programa, cada consulta pasa por Cloudflare Turnstile, que recibe tu dirección IP. No hay casilla que marcar ni imágenes que resolver: en la enorme mayoría de los casos no vas a ver nada.",
      "Para saber cuánta gente entra, Vercel —donde el sitio está alojado— registra cada visita: qué página abriste, desde dónde llegaste y de qué país. No usa cookies, no te sigue por otros sitios y no guarda nada que te identifique. También mide cuánto tarda la página en cargar en tu equipo.",
      "La conversación se borra al recargar la página. No hay forma de recuperarla, tampoco para nosotros.",
    ],
    tecnico: [
      "La forma directa de hacer que una IA responda como Leonardo es pedírselo: se le explica quién fue y escribe como si fuera él. Suena bien y es casi todo inventado. Sobre 120 preguntas de prueba, un modelo así citó a Leonardo 161 veces, y 156 de esas frases no existen en ninguna parte de sus cuadernos: el 96,9%.",
      "Acá busca primero. La pregunta se compara contra el corpus entero —202.000 palabras de Leonardo en 1.504 pasajes de Richter, troceados en 2.062 fragmentos— y se mide cuánto se parece a lo más cercano que haya. Si no llega a un umbral calibrado, Leonardo se abstiene y al modelo ni se lo llama. Si llega, el modelo escribe con esos pasajes delante.",
      "Ordenar resultados y decidir si hay respuesta son dos cosas distintas, y confundirlas es el error de fondo. Cualquier método de ranking pone siempre algo en el primer puesto, exista o no material pertinente, así que estar primero no es evidencia de nada. Quien decide es la medida de parecido contra el umbral, calibrado con preguntas que el corpus cubre y preguntas que no.",
      "Un prompt es una instrucción, no una garantía: se le puede pedir que no invente y desobedecer igual. Por eso lo que sale pasa por comprobaciones mecánicas, fuera del modelo: cada frase entre comillas se coteja contra el pasaje original antes de mostrarse, y la respuesta aparece terminada y verificada en vez de irse escribiendo mientras se genera.",
      "Lo que está medido, sobre las 187 citas de la corrida con búsqueda: 0 inventadas y 100% literales contra los pasajes originales, comprobadas una por una contra el corpus entero en los dos idiomas. Es el mismo modelo y el mismo prompt del 96,9%; lo único que cambia es que busca antes de responder. La decisión de abstenerse acierta el 88%.",
      "No se guarda ninguna consulta, y el contador de pedidos ve tu IP el tiempo justo para hashearla, sin la pregunta.",
    ],
  },
  en: {
    titulo: "It answers only with what Leonardo wrote",
    parrafos: [
      "Ask an ordinary AI to act as Leonardo and it invents a personality and speaks for him. In this project we did it differently: Leonardo left more than 7,500 pages of personal manuscripts, which almost no historical figure did. There is no need to guess how he would answer, because he already answered.",
      "Under each answer you will see the passages behind it, with a link to the source: J. P. Richter's edition of 1888.",
      "If something is not in his notebooks, it says so instead of inventing it. He wrote mostly about science and his own work, so there are subjects — his private life, for one — with less material.",
      "The phrases in quotation marks are not rewritten: they come straight out of those passages. That is why they sometimes sound old; modernising them would put words in his mouth that are not his.",
      "That it does not invent is not a promise: it is measured. Ask an ordinary AI to speak as Leonardo and it invents the quotations: across 120 test questions, 96.9% of the phrases it attributed to him exist nowhere. In this project, ≈ 0% invented. The code that checks it is public.",
      "No question of yours is stored.",
    ],
    pestanaSimple: "The short version",
    pestanaTecnica: "Technical",
    boton: "Got it",
    avisoPrivacidad: "Privacy notice",
    cerrarAviso: "Close",
    tituloPrivacidad: "What happens to what you write",
    privacidad: [
      "No accounts and no cookies: this site stores nothing in your browser. Visits are counted, and how is explained below.",
      "Your questions are not kept. They are used to search the notebooks and to compose the answer, and that is where they end: they go into no log, here or anywhere.",
      "To answer, your question and the passages found are sent to Google, which writes the reply from that material. If Google is unavailable, they are sent to Groq. Neither receives your name or anything identifying you, because the site never asks for it.",
      "The number of queries arriving from each connection is counted, so that no one can exhaust the service. Your IP address is turned into an irreversible code before being counted and is discarded within a day. The address itself is never stored, and never alongside what you asked.",
      "The first time you open the consultation, your browser downloads the search model from Hugging Face. It is a one-time download and it happens on your device. If you play the video in the library, YouTube serves it in its no-tracking-cookie version.",
      "To check that there is a person and not a program on the other side, each query passes through Cloudflare Turnstile, which receives your IP address. There is no box to tick and no images to solve: in the vast majority of cases you will see nothing at all.",
      "To know how many people visit, Vercel — where the site is hosted — records each visit: which page you opened, where you arrived from and which country. It uses no cookies, does not follow you across other sites and stores nothing that identifies you. It also measures how long the page takes to load on your device.",
      "The conversation is erased when you reload the page. There is no way to recover it — not for us either.",
    ],
    tecnico: [
      "The direct way to make an AI answer as Leonardo is to ask it to: you tell it who he was and it writes as if it were him. It reads well, and it is mostly invented. Across 120 test questions, a model set up that way quoted Leonardo 161 times, and 156 of those phrases exist nowhere in his notebooks: 96.9%.",
      "Here it searches first. The question is compared against the whole corpus — 202,000 words of Leonardo across 1,504 Richter passages, cut into 2,062 fragments — and how closely it matches the nearest one is measured. Below a calibrated threshold, Leonardo declines and the model is never called. Above it, the model writes with those passages in front of it.",
      "Ordering results and deciding whether there is an answer are two different things, and confusing them is the underlying mistake. Any ranking method always puts something in first place, whether or not relevant material exists, so ranking first is evidence of nothing. What decides is the similarity measure against the threshold, calibrated on questions the corpus covers and questions it does not.",
      "A prompt is an instruction, not a guarantee: you can ask a model not to invent and it can disobey anyway. So what comes out passes mechanical checks, outside the model: every quoted phrase is matched against the original passage before it is shown, and the answer appears finished and verified rather than typing itself out as it is generated.",
      "What is measured, across the 187 quotations of the run with search: 0 invented and 100% literal against the original passages, checked one by one against the whole corpus in both languages. It is the same model and the same prompt behind that 96.9%; the only change is that it searches before answering. The decision to decline is right 88% of the time.",
      "No query is stored, and the request counter sees your IP just long enough to hash it, without the question.",
    ],
  },
} as const;

export function Explainer({ lang, onCerrar }: { lang: Idioma; onCerrar: () => void }) {
  const t = COPY[lang];
  const angosto = useAngosto();
  /**
   * Arranca SIEMPRE en la corta, incluso si ya se vio la técnica en esta sesión.
   * Quien abre esto quiere saber qué es, no volver a donde estaba leyendo: la
   * versión técnica es un desvío que se pide, no un estado que se recuerda.
   */
  const [tecnico, setTecnico] = useState(false);
  const parrafos = tecnico ? t.tecnico : t.parrafos;
  /**
   * EL AVISO DE PRIVACIDAD VA EN UN POPOUT, NO EN UNA PESTAÑA (D-215).
   *
   * La obligación de informar existe —el sitio trata la IP y manda la consulta a
   * Google— pero **darle una pestaña le da un peso que no tiene**: es lo que
   * nadie viene a leer. Un enlace al pie lo deja accesible sin ocuparle sitio a
   * lo que la gente sí lee, que es el mismo calibre de D-178: no mentir no es
   * declarar cada contra en la primera pantalla.
   */
  const [aviso, setAviso] = useState(false);

  // Escape cierra: primero el aviso si está abierto, y recién después el panel.
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (aviso) setAviso(false);
      else onCerrar();
    };
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [onCerrar, aviso]);

  return (
    <div
      onClick={onCerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "oklch(6% 0.02 40 / 0.72)",
        // `-webkit-` para Safari anterior a la 18.
        WebkitBackdropFilter: "blur(4px)",
        backdropFilter: "blur(4px)",
        padding: angosto ? 12 : 20,
      }}
    >
      <div
        className="alv-in"
        role="dialog"
        aria-modal="true"
        aria-label={t.titulo}
        onClick={(e) => e.stopPropagation()}
        /*
         * CUERPO QUE SCROLLEA + PIE FIJO, y no un panel entero con `overflow`.
         *
         * Con el panel scrolleando de una pieza, «Entendido» quedaba debajo del
         * pliegue cada vez que el texto crecía: pasó en D-177 y volvió a pasar
         * al sumar el párrafo de apertura. **El arreglo no es recortar la copia
         * hasta que entre** —eso se rompe con la próxima edición y encima empuja
         * a escribir corto por el motivo equivocado—: es que la acción no
         * dependa del largo del texto.
         *
         * Y lo necesita de todas formas la versión técnica, que scrollea siempre
         * y por diseño.
         */
        style={{
          display: "flex",
          flexDirection: "column",
          width: "min(520px,94vw)",
          maxHeight: angosto ? "82dvh" : "86vh",
          boxSizing: "border-box",
          background: T.explainerBg,
          border: `1px solid ${T.explainerBorde}`,
          borderRadius: 14,
          color: T.explainerTexto,
          boxShadow: "0 30px 70px oklch(6% 0.02 40 / 0.6)",
        }}
      >
        {/*
          EL SELECTOR, ARRIBA Y COMO PESTAÑAS (D-181).
          Antes era un enlace de texto al pie del cuerpo: chico, apagado y
          debajo del pliegue justo cuando el texto crecía — o sea invisible
          cuando más falta hacía. Y sobre todo **no dejaba ver que había dos
          versiones**: había que leer hasta el final para enterarse.

          Como par de pestañas dice de entrada que hay una elección y cuál está
          puesta. Va en la cabecera fija, no en el cuerpo, para que siga a la
          vista mientras se scrollea la versión técnica.

          `role="tablist"` y no dos botones sueltos: para un lector de pantalla
          esto es una elección entre dos vistas del mismo contenido, y las
          flechas ← → lo recorren como corresponde.
        */}
        <div
          role="tablist"
          aria-label={t.titulo}
          style={{
            flexShrink: 0,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
            margin: angosto ? "16px 20px 0" : "20px 34px 0",
            padding: 4,
            background: T.cajaBg,
            border: `1px solid ${T.cajaBorde}`,
            borderRadius: 999,
          }}
        >
          {([false, true] as const).map((esTecnica) => {
            const activa = tecnico === esTecnica;
            return (
              <button
                key={String(esTecnica)}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setTecnico(esTecnica)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    setTecnico((v) => !v);
                  }
                }}
                style={{
                  /* En teléfono, 14 px de relleno y no 8: con 8 la pastilla
                     medía 33 px de alto y el objetivo táctil mínimo es 44. */
                  padding: angosto ? "14px 6px" : "9px 8px",
                  border: "none",
                  borderRadius: 999,
                  cursor: "pointer",
                  background: activa ? T.enviarBg : "transparent",
                  color: activa ? T.enviarTexto : T.tenue,
                  fontFamily: FUENTE.lectura,
                  fontSize: angosto ? 13 : 13.5,
                  fontWeight: activa ? 600 : 400,
                  letterSpacing: ".02em",
                  transition: "background .2s ease, color .2s ease",
                }}
              >
                {esTecnica ? t.pestanaTecnica : t.pestanaSimple}
              </button>
            );
          })}
        </div>

        <div
          className="alv-scroll"
          style={{
            overflowY: "auto",
            padding: angosto ? "16px 20px 4px" : "20px 34px 6px",
          }}
        >
        {/* Sin ceja: decía «Antes de empezar» y el diálogo se abre sólo
            cuando alguien lo pide, así que ya se sabe que es el antes. */}
        <h2
          style={{
            margin: "0 0 14px",
            fontFamily: FUENTE.manuscrita,
            fontSize: angosto ? 21 : 25,
            fontWeight: 400,
            color: T.titulo,
          }}
        >
          {t.titulo}
        </h2>

        {parrafos.map((p, i) => (
          <p
            key={i}
            style={{
              margin: "0 0 11px",
              fontFamily: FUENTE.lectura,
              fontSize: angosto ? 15.5 : 17,
              lineHeight: angosto ? 1.65 : 1.75,
            }}
          >
            {p}
          </p>
        ))}

        </div>

        {/* El pie. `flexShrink: 0` es lo que lo mantiene entero cuando el cuerpo
            se pasa de largo.

            Y el degradé de arriba no es adorno: con el cuerpo cortado a ras, la
            última línea queda partida al medio y parece el final del texto. El
            desvanecido dice «sigue» sin gastar una flecha ni un renglón. */}
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            padding: angosto ? "14px 20px 18px" : "16px 34px 24px",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 1,
              right: 1,
              top: -34,
              height: 34,
              pointerEvents: "none",
              background: `linear-gradient(to bottom, transparent, ${T.explainerBg})`,
            }}
          />
        <button
          type="button"
          onClick={onCerrar}
          style={{
            display: "block",
            width: "100%",
            padding: 14,
            background: T.enviarBg,
            color: T.enviarTexto,
            border: "none",
            borderRadius: 8,
            fontFamily: FUENTE.manuscrita,
            fontSize: 17,
            letterSpacing: ".02em",
            cursor: "pointer",
          }}
        >
          {t.boton}
        </button>

        {/* El enlace de línea del sistema, en su versión oscura. Relleno para
            que el área táctil no sea la altura de una versalita de 10 px. */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setAviso(true)}
            className="alv-codice-linea"
            style={{
              background: "none",
              border: "none",
              padding: "10px 12px",
              margin: "-4px 0 -8px",
              cursor: "pointer",
              fontFamily: FUENTE.lectura,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              color: T.tenue,
            }}
          >
            <span style={{ borderBottom: "1px solid currentColor", paddingBottom: 2 }}>
              {t.avisoPrivacidad}
            </span>
          </button>
        </div>
        </div>
      </div>

      {/*
        EL AVISO, ENCIMA DEL PANEL Y NO EN LUGAR DE EL (D-215).
        Se abre sobre «Cómo funciona» y al cerrarlo se vuelve exactamente a donde
        se estaba: quien fue a mirar qué pasa con sus datos no perdió la lectura.

        `stopPropagation` en el velo y en la caja: sin eso, un clic acá adentro
        burbujea hasta el `onClick={onCerrar}` del velo de afuera y cierra los dos
        paneles de una — el mismo defecto que el códice ya tuvo que atajar.
      */}
      {aviso && (
        <div
          onClick={(e) => { e.stopPropagation(); setAviso(false); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: angosto ? 16 : 28,
            background: "oklch(6% 0.02 40 / 0.72)",
          }}
        >
          <div
            className="alv-in"
            role="dialog"
            aria-modal="true"
            aria-label={t.tituloPrivacidad}
            onClick={(e) => e.stopPropagation()}
            style={{
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              width: "min(640px, 100%)",
              maxHeight: "min(82dvh, 720px)",
              background: T.explainerBg,
              border: `1px solid ${T.explainerBorde}`,
              borderRadius: 14,
              color: T.explainerTexto,
              boxShadow: "0 30px 70px oklch(6% 0.02 40 / 0.6)",
            }}
          >
            <div
              className="alv-scroll"
              style={{ overflowY: "auto", padding: angosto ? "20px 20px 4px" : "26px 34px 6px" }}
            >
              <h2
                style={{
                  margin: "0 0 14px",
                  fontFamily: FUENTE.manuscrita,
                  fontSize: angosto ? 20 : 23,
                  fontWeight: 400,
                  color: T.titulo,
                }}
              >
                {t.tituloPrivacidad}
              </h2>
              {t.privacidad.map((p, i) => (
                <p
                  key={i}
                  style={{
                    margin: "0 0 11px",
                    fontFamily: FUENTE.lectura,
                    fontSize: angosto ? 14.5 : 15.5,
                    lineHeight: angosto ? 1.65 : 1.7,
                  }}
                >
                  {p}
                </p>
              ))}
            </div>

            <div style={{ flexShrink: 0, padding: angosto ? "10px 20px 18px" : "12px 34px 22px" }}>
              <button
                type="button"
                onClick={() => setAviso(false)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: 12,
                  background: "transparent",
                  color: T.explainerTexto,
                  border: `1px solid ${T.cajaBorde}`,
                  borderRadius: 8,
                  fontFamily: FUENTE.lectura,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                {t.cerrarAviso}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
