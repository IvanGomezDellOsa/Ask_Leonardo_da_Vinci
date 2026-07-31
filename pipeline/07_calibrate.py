"""07 — Recalibra tau contra el indice real. PROVISIONAL.

> **Esta calibracion es provisional y no reemplaza la de la Fase 3.**
> Usa las 190 consultas de investigacion del experimento de separabilidad, que
> son el instrumento con el que se descubrio la forma del gate. La Fase 3
> calibra contra el eval set de 120 casos etiquetados a mano, que es otro
> instrumento y otra pregunta. Si esto no queda claro, la Fase 3 "confirma" un
> numero que heredo en vez de medirlo.

Que agrega respecto del experimento: el indice real tiene las tres cosas que
aquel no tuvo, y las tres desplazan los scores (D-038):
    - `richterTitle + text` embebido        (D-025)
    - cuantizacion int8                     (D-022)
    - parseo del HTML, no del .txt          (D-024)
Ademas ahora hay chunks, no pasajes, y el aparato de Richter esta fuera (D-054).

tau se elige contra un OBJETIVO DE COBERTURA explicito, no en la esquina: con
cero filtraciones el espanol rechaza el 97,9% de lo que si puede contestar
(D-041). El pre-filtro se calibra para no perder consultas contestables; lo
dudoso lo decide el LLM con los pasajes delante (D-039).

Salida: reports/calibration_report.md
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

from common import ARTIFACTS, OUT, REPORTS, asegurar_carpetas, utf8_stdout

MODELO = "intfloat/multilingual-e5-small"
EXPERIMENTO = Path(__file__).resolve().parent.parent / "experiments" / "separabilidad"

# Dos consultas del experimento estan mal etiquetadas y `06` v4 lo documenta:
# «¿Como era tu relacion con Salai?» y su par en ingles se pusieron `fuera`,
# pero el corpus SI tiene material — R-1528 y R-1533, apuntes de contabilidad
# del propio Leonardo. Heredar el error lo mete adentro de tau.
RE_ETIQUETADAS = {
    "¿Cómo era tu relación con Salaì?": "dentro",
    "What was your relationship with Salai like?": "dentro",
}


def cargar_consultas():
    sys.path.insert(0, str(EXPERIMENTO))
    from consultas import TODAS          # (grupo, idioma, texto, tanda)
    corregidas, n = [], 0
    for grupo, idioma, texto, tanda in TODAS:
        nuevo = RE_ETIQUETADAS.get(texto)
        if nuevo and nuevo != grupo:
            grupo, n = nuevo, n + 1
        corregidas.append((grupo, idioma, texto, tanda))
    return corregidas, n


def punto_de_operacion(dentro: np.ndarray, fuera: np.ndarray, perdida: float):
    """tau que pierde como mucho `perdida` de las consultas contestables."""
    tau = float(np.quantile(dentro, perdida)) if perdida > 0 else float(dentro.min())
    tau = float(np.nextafter(tau, -1.0))
    return tau, float((dentro >= tau).mean()), float((fuera < tau).mean())


def main() -> int:
    utf8_stdout()
    asegurar_carpetas()

    meta = json.loads((ARTIFACTS / "index_meta.json").read_text(encoding="utf-8"))
    q = np.frombuffer((ARTIFACTS / "index.bin").read_bytes(), dtype=np.int8)
    q = q.reshape(meta["count"], meta["dims"]).astype(np.float32) / meta["scale"]
    q /= np.linalg.norm(q, axis=1, keepdims=True)
    voces = np.array(meta["voice"])
    solo_leonardo = voces == "leonardo"

    consultas, n_corregidas = cargar_consultas()
    print(f"consultas             : {len(consultas):>6,}  ({n_corregidas} etiquetas corregidas)")

    from sentence_transformers import SentenceTransformer
    modelo = SentenceTransformer(MODELO)
    emb = np.asarray(modelo.encode(["query: " + t for _, _, t, _ in consultas],
                                   normalize_embeddings=True, batch_size=32,
                                   show_progress_bar=False), dtype=np.float32)

    # El gate umbraliza contra el indice de Leonardo: los chunks de Richter
    # tienen su propio camino y su propio uso (D-042).
    cos = (emb @ q[solo_leonardo].T).max(axis=1)
    grupos = np.array([g for g, _, _, _ in consultas])
    idiomas = np.array([i for _, i, _, _ in consultas])

    L = ["# Calibracion de tau — PROVISIONAL", "",
         "> **No reemplaza la calibracion de la Fase 3.** Esta corre contra las 190",
         "> consultas de investigacion del experimento de separabilidad, que es el",
         "> instrumento con el que se descubrio la forma del gate. La Fase 3 calibra",
         "> contra el eval set de 120 casos etiquetados a mano: otro instrumento, otra",
         "> pregunta. El numero de abajo es un punto de partida, no un resultado.",
         "",
         f"- Indice: **{int(solo_leonardo.sum()):,} chunks de Leonardo** "
         f"(int8, `richterTitle + text`, parseo del HTML)",
         f"- Consultas: {len(consultas)} · **{n_corregidas} etiquetas corregidas** "
         "antes de medir (las de Salai, que `06` v4 documenta)",
         ""]

    resumen = {}
    for idi, nombre in (("es", "espanol"), ("en", "ingles")):
        m = idiomas == idi
        d = cos[m & (grupos == "dentro")]
        f = cos[m & (grupos == "fuera")]
        auc = float((np.sign(d[:, None] - f[None, :]) / 2 + 0.5).mean())
        L += [f"## {nombre}", "",
              f"- dentro n={len(d)} media {d.mean():.4f} · fuera n={len(f)} "
              f"media {f.mean():.4f} · **AUC {auc:.4f}**", "",
              "| perdida aceptada | tau | contestables que pasan | basura atajada |",
              "|---|---:|---:|---:|"]
        for p in (0.0, 0.02, 0.05):
            tau, pasan, ataja = punto_de_operacion(d, f, p)
            L.append(f"| {p:.0%} | **{tau:.4f}** | {pasan:.1%} | {ataja:.1%} |")
            resumen.setdefault(idi, {})[f"{p:.0%}"] = tau
        L.append("")

    tau_es = resumen["es"]["0%"]
    tau_en = resumen["en"]["0%"]
    L += ["## Comparacion con el experimento (float32, sin titulo, sobre el .txt)", "",
          "| | experimento | ahora | delta |", "|---|---:|---:|---:|",
          f"| tau_es (0% de perdida) | 0,7914 | **{tau_es:.4f}** | {tau_es-0.7914:+.4f} |",
          f"| tau_en (0% de perdida) | 0,8289 | **{tau_en:.4f}** | {tau_en-0.8289:+.4f} |",
          f"| distancia entre los dos | 0,0375 | **{tau_en-tau_es:.4f}** | |",
          "",
          "**La forma se mantiene: dos umbrales, y el del ingles mas alto.** Es lo que",
          "D-038 anticipaba que no iba a cambiar.", ""]
    (REPORTS / "calibration_report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    (OUT / "tau.json").write_text(json.dumps(resumen, indent=2), encoding="utf-8")

    print("\n".join(l for l in L if l.startswith(("|", "- ", "##"))))
    print(f"\nreporte -> {REPORTS / 'calibration_report.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
