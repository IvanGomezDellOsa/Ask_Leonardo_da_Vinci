"use client";

/**
 * La pregunta asistida: el mapa de lo que Leonardo escribió, al costado del
 * códice.
 *
 * POR QUE EXISTE. El corpus tiene 22 secciones y 423 temas, y **345 de 375 se
 * recuperan bien cuando se pregunta por su propio nombre** — pero nada se lo
 * decía al visitante, que tenía que adivinar el vocabulario. Medido con siete
 * preguntas reales del dueño: una sola salió bien. El problema no era la
 * cobertura sino que no hay forma de saber qué se puede preguntar.
 *
 * ══════════════════════════════════════════════════════════════════════
 * EL ROTULO QUE SE VE NO ES LA CONSULTA QUE SE MANDA.
 * ══════════════════════════════════════════════════════════════════════
 *
 * Se muestra `tema.visible` —limpio, sin los rangos de Richter— y se manda
 * `tema.consulta`, que es el título ORIGINAL. `alcance.json` midió el 345/375
 * con los originales: mandar otro texto invalida esa medición entera. Ver
 * `tools/mapa_temas.ts`.
 *
 * NO GASTA NADA. `MAPA` viaja en el bundle, igual que la caché de portada
 * (D-132): sin red, sin modelo y sin cuota. El filtro corre en el navegador.
 */

import { useMemo, useRef, useState } from "react";

import { MAPA, type SeccionDelMapa } from "../data/mapa.js";
import { FUENTE, T } from "./estilos.js";

type Idioma = "es" | "en";

const TXT = {
  es: {
    titulo: "Pregunta asistida",
    bajada: "Buscá un tema del que Leonardo sí escribió: al clickearlo se genera la pregunta.",
    buscar: "Buscar un tema…",
    buscarAria: "Buscar un tema",
    nada: "Ningún tema con esas palabras. Leonardo escribió sobre lo que escribió: probá con «agua», «sombra», «caballo» o «vuelo».",
    abrir: "Abrir la pregunta asistida",
    cerrar: "Cerrar",
    nav: "Temas de los cuadernos",
    pasajes: (n: number) => `${n} pasaje${n === 1 ? "" : "s"}`,
  },
  en: {
    titulo: "Guided questions",
    bajada: "Find a subject Leonardo did write about: clicking it asks the question for you.",
    buscar: "Search a subject…",
    buscarAria: "Search a subject",
    nada: "No subject matches. Leonardo wrote about what he wrote about — try “water”, “shadow”, “horse” or “flight”.",
    abrir: "Open guided questions",
    cerrar: "Close",
    nav: "Subjects in the notebooks",
    pasajes: (n: number) => `${n} passage${n === 1 ? "" : "s"}`,
  },
} as const;

/** Sin acentos y en minúsculas, para que «musica» encuentre «música». */
const plano = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

export const ANCHO_MAPA = 300;

export function MapaTemas({
  lang, onPreguntar, angosto = false, onCerrarCajon,
}: {
  lang: Idioma;
  /** `(consulta, comoSeVe)`: se busca lo primero y se muestra lo segundo. */
  onPreguntar: (consulta: string, comoSeVe: string) => void;
  angosto?: boolean;
  onCerrarCajon?: () => void;
}) {
  const t = TXT[lang];
  const [filtro, setFiltro] = useState("");
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  /**
   * ⚠ EL FILTRO MIRA EL ROTULO **Y** EL TITULO ORIGINAL. Sin lo segundo,
   * limpiar los rótulos haría desaparecer términos que sí están en el corpus:
   * «perdimenti» ya no se muestra en ningún lado, pero quien lo busque tiene que
   * seguir encontrando su tema.
   */
  const visibles = useMemo(() => {
    const f = plano(filtro.trim());
    if (!f) return MAPA;
    return MAPA
      .map((s) => ({
        ...s,
        temas: plano(s.seccion).includes(f) || plano(s.glosa).includes(f)
          ? s.temas
          : s.temas.filter((x) => plano(x.visible).includes(f) || plano(x.consulta).includes(f)),
      }))
      .filter((s) => s.temas.length > 0);
  }, [filtro]);

  const filtrando = filtro.trim().length > 0;

  const alternar = (nombre: string) =>
    setAbiertas((prev) => {
      const s = new Set(prev);
      s.has(nombre) ? s.delete(nombre) : s.add(nombre);
      return s;
    });

  const elegir = (consulta: string, comoSeVe: string) => {
    onPreguntar(consulta, comoSeVe);
    onCerrarCajon?.();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div
        style={{
          padding: angosto ? "16px 16px 13px" : "17px 15px 13px",
          borderBottom: `1px solid ${T.headerLinea}`,
          flexShrink: 0,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <p style={{
            margin: "0 0 4px", fontFamily: FUENTE.manuscrita, fontSize: angosto ? 17 : 19,
            lineHeight: 1.15, color: T.titulo,
          }}>
            {t.titulo}
          </p>
          <p style={{
            margin: 0, fontFamily: FUENTE.lectura, fontSize: 12.5, lineHeight: 1.45,
            color: T.tenue,
          }}>
            {t.bajada}
          </p>
        </div>
        {onCerrarCajon && (
          <button
            type="button"
            onClick={onCerrarCajon}
            aria-label={t.cerrar}
            style={{
              flex: "0 0 44px", width: 44, height: 44, padding: 0, background: "none",
              border: 0, cursor: "pointer", color: T.tenue, fontFamily: FUENTE.lectura,
              fontSize: 20, lineHeight: 1, marginRight: -10, marginTop: -8,
            }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ padding: "13px 15px 8px", flexShrink: 0 }}>
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder={t.buscar}
          aria-label={t.buscarAria}
          autoComplete="off"
          spellCheck={false}
          style={{
            width: "100%", boxSizing: "border-box", background: T.cajaBg,
            border: `1px solid ${T.campoBorde}`, borderRadius: 6, color: T.campoTexto,
            fontFamily: FUENTE.lectura,
            // ⚠ 16 px o Safari hace zoom solo al enfocar en teléfono.
            fontSize: 16,
            padding: "9px 11px", outline: "none",
          }}
        />
      </div>

      <nav
        className="alv-scroll"
        aria-label={t.nav}
        style={{ flex: "1 1 0", minHeight: 0, overflowY: "auto", padding: "4px 8px 20px" }}
      >
        {visibles.length === 0 ? (
          <p style={{
            margin: 0, padding: "18px 12px", fontFamily: FUENTE.lectura, fontSize: 13,
            lineHeight: 1.5, color: T.notaEtiqueta,
          }}>
            {t.nada}
          </p>
        ) : (
          visibles.map((s) => (
            <Seccion
              key={s.seccion}
              s={s}
              /** Cerradas de entrada; al filtrar se abren para mostrar lo que encontró. */
              abierta={filtrando || abiertas.has(s.seccion)}
              onAlternar={() => alternar(s.seccion)}
              onElegir={elegir}
              pasajes={t.pasajes}
            />
          ))
        )}
      </nav>
    </div>
  );
}

function Seccion({
  s, abierta, onAlternar, onElegir, pasajes,
}: {
  s: SeccionDelMapa;
  abierta: boolean;
  onAlternar: () => void;
  onElegir: (consulta: string, comoSeVe: string) => void;
  pasajes: (n: number) => string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div style={{ margin: "1px 0" }}>
      <button
        ref={ref}
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className="alv-mapa-sec"
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "11px 1fr auto",
          gap: "4px 8px",
          alignItems: "baseline",
          background: "none",
          border: 0,
          borderRadius: 6,
          padding: "9px",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: FUENTE.lectura,
          fontSize: 14.5,
          lineHeight: 1.3,
          color: T.cuerpo,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: 9, lineHeight: 1.6, color: T.notaEtiqueta,
            transform: abierta ? "rotate(90deg)" : "none",
            transition: "transform .18s ease",
            display: "inline-block",
          }}
        >
          ▶
        </span>
        <span style={{ color: abierta ? T.titulo : T.cuerpo }}>{s.seccion}</span>
        <span style={{
          fontFamily: FUENTE.manuscrita, fontSize: 11, color: T.notaEtiqueta,
          fontVariantNumeric: "tabular-nums",
        }}>
          {s.pasajes}
        </span>
        <span style={{
          gridColumn: "2 / 4", marginTop: 3, fontSize: 12, lineHeight: 1.4,
          color: T.notaEtiqueta,
        }}>
          {s.glosa}
        </span>
      </button>

      {abierta && (
        <div style={{
          padding: "3px 0 10px 19px", marginLeft: 9,
          borderLeft: `1px solid ${T.headerLinea}`,
        }}>
          {s.temas.map((x) => (
            <button
              key={x.consulta}
              type="button"
              onClick={() => onElegir(x.consulta, x.visible)}
              title={pasajes(x.pasajes)}
              className="alv-mapa-tema"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: 0,
                borderRadius: 5,
                // ⚠ 44 px de alto en teléfono: es una lista larga y se toca con
                // el dedo. En escritorio 32 alcanza y no despega tanto la lista.
                minHeight: 32,
                padding: "7px 9px",
                cursor: "pointer",
                fontFamily: FUENTE.lectura,
                fontSize: 13.5,
                lineHeight: 1.35,
                /** Los cinco imanes están, pero no se destacan. Ver `28` §5. */
                color: x.iman ? T.notaEtiqueta : T.tenue,
              }}
            >
              {x.visible}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
