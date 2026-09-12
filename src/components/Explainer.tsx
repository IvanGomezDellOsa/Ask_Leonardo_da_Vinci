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

import { useEffect, useRef, useState } from "react";
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
    ojal: "El porqué y el cómo",
    volver: "Volver",
    pestanaSimple: "Lo esencial",
    pestanaTecnica: "Explicación técnica",
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
    ojal: "The why and the how",
    volver: "Back",
    pestanaSimple: "The short version",
    pestanaTecnica: "Technical",
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
/** El icono de la cruz y el de la flecha de volver, que no cambian nunca. */
const CRUZ = (
  <svg viewBox="0 0 11 11" aria-hidden="true">
    <path d="M9.5.1 5.5 4.1 1.5.1.1 1.5l4 4-4 4 1.4 1.4 4-4 4 4 1.4-1.4-4-4 4-4z" />
  </svg>
);
const ATRAS = (
  <svg viewBox="0 0 11 10" aria-hidden="true">
    <path d="M4.9 0 6.3 1.4 4.2 3.5H11v2H4.2l2.1 2.1L4.9 9 .4 4.5z" />
  </svg>
);

export function Explainer({ lang, onCerrar }: { lang: Idioma; onCerrar: () => void }) {
  const t = COPY[lang];
  const dialogo = useRef<HTMLDialogElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const solapas = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Arranca SIEMPRE en la corta, incluso si ya se vio la técnica en esta sesión.
   * Quien abre esto quiere saber qué es, no volver a donde estaba leyendo: la
   * versión técnica es un desvío que se pide, no un estado que se recuerda.
   */
  const [tecnico, setTecnico] = useState(false);
  /**
   * EL AVISO DE PRIVACIDAD ES OTRA VISTA, NO UNA TERCERA SOLAPA (D-215).
   *
   * Las dos solapas son dos versiones de LA MISMA explicación: meter ahí algo
   * que habla de otra cosa rompe esa promesa. Y darle solapa le da además un
   * peso que no tiene — es lo que nadie viene a leer. Un enlace al pie lo deja
   * accesible sin ocuparle sitio a lo que la gente sí lee, que es el mismo
   * calibre de D-178: no mentir no es declarar cada contra en la primera
   * pantalla.
   */
  const [aviso, setAviso] = useState(false);

  // `showModal` y no `show`: es lo que trae el foco encerrado, la capa de fondo
  // y el resto de la página inerte para un lector de pantalla.
  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  const parrafos = aviso ? t.privacidad : tecnico ? t.tecnico : t.parrafos;
  // La última línea de cada versión dice qué pasa con tus datos: es de otra
  // clase que el resto y por eso va al pie, cruzando las dos columnas.
  const cuerpoTexto = aviso ? parrafos : parrafos.slice(0, -1);
  const nota = aviso ? null : parrafos[parrafos.length - 1];

  function elegir(v: boolean, mover: boolean) {
    setTecnico(v);
    if (cuerpo.current) cuerpo.current.scrollTop = 0;
    if (mover) solapas.current[v ? 1 : 0]?.focus();
  }

  /**
   * ⚠ UN TABLIST SE MANEJA CON LAS FLECHAS, no con el tabulador. El tabulador
   * entra una vez al grupo y sale; adentro se cambia de solapa con ← y →, y por
   * eso la que no está elegida lleva `tabIndex={-1}`. Sin esto el grupo se
   * recorre de a una, que no es lo que espera nadie que navegue sin mouse.
   */
  function alTeclaSolapa(e: React.KeyboardEvent) {
    const salto = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    const fin = { Home: 0, End: 1 }[e.key];
    if (salto === undefined && fin === undefined) return;
    e.preventDefault();
    elegir(fin !== undefined ? fin === 1 : !tecnico, true);
  }

  return (
    <dialog
      ref={dialogo}
      className="alv-dlg"
      aria-labelledby="alv-dlg-t"
      // Escape cierra, pero primero el aviso si está abierto: `onCancel` es el
      // evento que el navegador dispara ANTES de cerrar, y cancelarlo lo frena.
      onCancel={(e) => {
        if (!aviso) return;
        e.preventDefault();
        setAviso(false);
      }}
      onClose={onCerrar}
      // El clic en el velo no tiene evento propio: se detecta porque el blanco
      // cae en el <dialog> y no en su contenido.
      onClick={(e) => {
        if (e.target === dialogo.current) dialogo.current?.close();
      }}
    >
      <div className="alv-dlg-cab">
          <div className="alv-dlg-fila">
            <button
              className="alv-dlg-atras"
              type="button"
              hidden={!aviso}
              onClick={() => setAviso(false)}
            >
              {ATRAS} {t.volver}
            </button>
            <button
              className="alv-dlg-cerrar"
              type="button"
              aria-label={t.cerrarAviso}
              onClick={() => dialogo.current?.close()}
            >
              {CRUZ}
            </button>
          </div>

          <p className="alv-dlg-ojal">{aviso ? t.avisoPrivacidad : t.ojal}</p>
          <h2 id="alv-dlg-t">{aviso ? t.tituloPrivacidad : t.titulo}</h2>

          <div
            className="alv-dlg-solapas"
            role="tablist"
            hidden={aviso}
            aria-label={t.titulo}
          >
            {[t.pestanaSimple, t.pestanaTecnica].map((rotulo, k) => (
              <button
                key={rotulo}
                ref={(el) => {
                  solapas.current[k] = el;
                }}
                type="button"
                role="tab"
                aria-selected={tecnico === (k === 1)}
                tabIndex={tecnico === (k === 1) ? 0 : -1}
                onClick={() => elegir(k === 1, false)}
                onKeyDown={alTeclaSolapa}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {/*
          CUERPO QUE SCROLLEA Y CABECERA FIJA, y no un panel entero con
          `overflow`. Con el panel scrolleando de una pieza la acción quedaba
          debajo del pliegue cada vez que el texto crecía: pasó en D-177 y
          volvió a pasar al sumar el párrafo de apertura. **El arreglo no es
          recortar la copia hasta que entre** —eso se rompe con la próxima
          edición y encima empuja a escribir corto por el motivo equivocado—:
          es que la salida no dependa del largo del texto. Por eso la cruz vive
          arriba y no hay botón «Entendido» al final.
        */}
        <div className="alv-dlg-cuerpo" ref={cuerpo}>
          <div
            className="alv-dlg-prosa"
            role={aviso ? undefined : "tabpanel"}
            aria-label={aviso ? undefined : t.titulo}
          >
            <div className="alv-dlg-cols">
              {cuerpoTexto.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>

            {nota && (
              <div className="alv-dlg-pie">
                <p className="alv-dlg-nota">{nota}</p>
                <button
                  className="alv-dlg-priv"
                  type="button"
                  onClick={() => {
                    setAviso(true);
                    if (cuerpo.current) cuerpo.current.scrollTop = 0;
                  }}
                >
                  {t.avisoPrivacidad}
                </button>
              </div>
            )}
          </div>
        </div>
    </dialog>
  );
}
