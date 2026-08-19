"use client";

/**
 * «Cómo funciona». Es el lugar donde el proyecto declara lo que es y lo que
 * no, antes de que el usuario escriba nada.
 *
 * DICE EL NUMERO Y DICE COMO COMPROBARLO. El 96,9% → 0% no va acá como
 * eslogan: va con el nombre del comando que lo reproduce, porque la tesis del
 * proyecto es «no me creas, está medido» y un número sin la forma de
 * verificarlo pide exactamente la confianza que este proyecto dice no
 * necesitar.
 *
 * NO SE PONE LA TASA DE ALUCINACION COMO TITULAR (D-094): su intervalo de
 * confianza al 95% es [0% — 12,8%], y un «1-2%» suelto suena a precisión que
 * la muestra no da.
 */

import { useEffect } from "react";
import { useAngosto } from "../hooks/useAngosto.js";
import { FUENTE, T } from "./estilos.js";
import type { Idioma } from "../lib/cliente-chat.js";

const COPY = {
  es: {
    ceja: "Antes de empezar",
    titulo: "No es un chatbot genérico",
    parrafos: [
      "Leonardo dejó más de 7.500 páginas escritas: anotaciones, bocetos, estudios. Cada respuesta está fundada en esos cuadernos reales —la traducción de J. P. Richter, 1888, de dominio público— y viene con el pasaje y el enlace a la fuente.",
      "Si algo no está en sus cuadernos, lo dice, en vez de inventarlo. Ese es el mejor momento del sistema, no una falla: cuando el corpus calla y el editor Richter lo confirma, eso es un hecho histórico verificable.",
      "Las frases entre comillas son transcripción literal de los cuadernos, sin retocar. Por eso a veces el lenguaje suena antiguo o cuesta leerlo: suavizarlo sería inventarle a Leonardo una voz que no eligió.",
      "Sobre 120 casos de control, con el mismo modelo y el mismo prompt, las citas atribuidas a Leonardo que no existen en sus cuadernos pasan de 96,9% sin recuperación a 0% con ella. Se comprueba cita por cita contra el corpus entero, en los dos idiomas, con «npm run evals:citas-corpus».",
      "Privacidad: no se guarda ninguna consulta. Sólo un contador por IP hasheada, nunca junto al texto de lo que preguntaste.",
    ],
    boton: "Empecemos",
  },
  en: {
    ceja: "Before we begin",
    titulo: "Not a generic chatbot",
    parrafos: [
      "Leonardo left more than 7,500 written pages: notes, sketches, studies. Every answer is grounded in those real notebooks — J. P. Richter's 1888 translation, public domain — and comes with the passage and a link to the source.",
      "If something is not in his notebooks, it says so instead of inventing it. That is the system at its best, not a failure: when the corpus is silent and Richter's editorial note confirms it, that is a verifiable historical fact.",
      "Quoted phrases are literal transcriptions from the notebooks, untouched. That is why the language sometimes sounds archaic or reads with difficulty: smoothing it would invent a voice Leonardo did not choose.",
      "Across 120 control cases, with the same model and the same prompt, quotations attributed to Leonardo that do not exist in his notebooks go from 96.9% without retrieval to 0% with it. Every quotation is checked against the whole corpus, in both languages, with «npm run evals:citas-corpus».",
      "Privacy: no query is stored. Only a counter per hashed IP, never alongside the text of what you asked.",
    ],
    boton: "Let us begin",
  },
} as const;

export function Explainer({ lang, onCerrar }: { lang: Idioma; onCerrar: () => void }) {
  const t = COPY[lang];
  const angosto = useAngosto();

  // Escape cierra, igual que el códice.
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [onCerrar]);

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
        backdropFilter: "blur(4px)",
        padding: angosto ? 12 : 20,
      }}
    >
      <div
        className="alv-in alv-scroll"
        role="dialog"
        aria-modal="true"
        aria-label={t.titulo}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px,94vw)",
          maxHeight: angosto ? "82dvh" : "86vh",
          overflowY: "auto",
          boxSizing: "border-box",
          background: T.explainerBg,
          border: `1px solid ${T.explainerBorde}`,
          borderRadius: 14,
          padding: angosto ? "22px 20px" : "32px 34px",
          color: T.explainerTexto,
          boxShadow: "0 30px 70px oklch(6% 0.02 40 / 0.6)",
        }}
      >
        <p
          style={{
            margin: "0 0 6px",
            fontFamily: FUENTE.manuscrita,
            fontSize: 12,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: T.nombre,
          }}
        >
          {t.ceja}
        </p>
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

        {t.parrafos.map((p, i) => (
          <p
            key={i}
            style={{
              margin: "0 0 12px",
              fontFamily: FUENTE.lectura,
              fontSize: angosto ? 15.5 : 17,
              lineHeight: angosto ? 1.65 : 1.75,
            }}
          >
            {p}
          </p>
        ))}

        <button
          type="button"
          onClick={onCerrar}
          style={{
            width: "100%",
            marginTop: 12,
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
      </div>
    </div>
  );
}
