"""04 — Arma los chunks que van al indice.

Tres operaciones, todas dimensionadas con numeros medidos (`02` v3, `14` O4):

  1. Agrupar los pasajes cortos. Los de menos de 15 palabras son casi
     inembebibles solos; se juntan con sus vecinos del MISMO titulo tematico,
     que es la unidad semantica que Richter definio (D-025).
  2. Partir los pasajes largos. Los de mas de 500 palabras se cortan por limite
     de parrafo con solape, para que ninguna idea quede cortada al medio.
  3. Dejar afuera lo que no aporta: el aparato de Richter (`utility:
     apparatus`) y el material sin contenido recuperable (`quality: low`).

Se embebe `richterTitle + text`, no solo el texto (D-025). El titulo se guarda
en su propio campo y el texto tambien, para que la tarjeta de cita muestre el
pasaje limpio y el indice vea las dos cosas.

Los chunks de Richter mantienen su propio indice y nunca hablan en primera
persona (D-010, D-042).

Salidas:
    artifacts/chunks.json       lo que consume la app
    reports/chunk_report.md
"""

from __future__ import annotations

import json
import re

from common import (ARTIFACTS, OUT, REPORTS, asegurar_carpetas, escribir_jsonl,
                    leer_jsonl, utf8_stdout, verificar)

MIN_AGRUPAR = 15        # 178 pasajes medidos por debajo de esto
MAX_PARTIR = 500        # 60 pasajes medidos por encima
OBJETIVO_PARTE = 350    # palabras por parte al partir
SOLAPE = 60             # palabras de solape entre partes
CTRL_CHUNKS = (1700, 2200)


def partir(texto: str, titulo: str) -> list[str]:
    """Corta por limite de parrafo, con solape, sin cortar una oracion."""
    parrafos = [p for p in texto.split("\n") if p.strip()]
    # un parrafo mas largo que el objetivo no se puede empaquetar entero: se
    # baja a oraciones. Sin esto quedan chunks de 847 palabras, que es casi el
    # triple del presupuesto de contexto de D-020.
    finos: list[str] = []
    for p in parrafos:
        if len(p.split()) > OBJETIVO_PARTE:
            finos.extend(x for x in re.split(r"(?<=[.;:])\s+", p) if x.strip())
        else:
            finos.append(p)
    parrafos = finos
    partes, actual, n = [], [], 0
    for p in parrafos:
        w = len(p.split())
        if n + w > OBJETIVO_PARTE and actual:
            partes.append(" ".join(actual))
            # solape: se arrastran las ultimas palabras de la parte anterior
            cola = " ".join(actual).split()[-SOLAPE:]
            actual, n = [" ".join(cola)], len(cola)
        actual.append(p)
        n += w
    if actual:
        partes.append(" ".join(actual))
    return partes


def main() -> int:
    utf8_stdout()
    asegurar_carpetas()
    alertas: list[str] = []

    unidades = leer_jsonl(OUT / "units.jsonl")
    fuera_aparato = [u for u in unidades if u.get("utility") == "apparatus"]
    fuera_calidad = [u for u in unidades if u.get("quality") == "low"]
    excluidos = {u["id"] for u in fuera_aparato} | {u["id"] for u in fuera_calidad}
    utiles = [u for u in unidades if u["id"] not in excluidos]

    leo = [u for u in utiles if u["voice"] == "leonardo"]
    ric = [u for u in utiles if u["voice"] == "richter"]
    leo.sort(key=lambda u: u["richterNo"])

    chunks: list[dict] = []
    n_agrupados = n_partidos = 0

    # -- 1 y 2: agrupar cortos por titulo, partir largos
    i = 0
    while i < len(leo):
        u = leo[i]
        if u["nWords"] >= MIN_AGRUPAR:
            grupo = [u]
            i += 1
        else:
            grupo = [u]
            i += 1
            while (i < len(leo) and leo[i]["richterTitle"] == u["richterTitle"]
                   and sum(x["nWords"] for x in grupo) < MIN_AGRUPAR * 3
                   and leo[i]["nWords"] < MIN_AGRUPAR * 3):
                grupo.append(leo[i])
                i += 1
            if len(grupo) > 1:
                n_agrupados += len(grupo)

        texto = "\n".join(x["text"] for x in grupo)
        base = grupo[0]
        nums = [x["richterNo"] for x in grupo]
        partes = partir(texto, base["richterTitle"]) if len(texto.split()) > MAX_PARTIR else [texto]
        if len(partes) > 1:
            n_partidos += 1
        for k, parte in enumerate(partes):
            chunks.append({
                "id": f"rt-{base['richterNo']:04d}" + (f"-{k}" if len(partes) > 1 else ""),
                "richterNo": base["richterNo"],
                "richterNos": nums,
                "richterTitle": base["richterTitle"],
                "section": base["section"],
                "subsection": base["subsection"],
                "voice": "leonardo",
                "text": parte,
                "annotatesPassage": None,
                "sourceManuscript": None,
                "url": base["url"],
                "nWords": len(parte.split()),
                "part": k if len(partes) > 1 else None,
            })

    # -- los de Richter: sin agrupar (no forman una serie), pero si se parten
    for u in ric:
        partes = partir(u["text"], "") if u["nWords"] > MAX_PARTIR else [u["text"]]
        if len(partes) > 1:
            n_partidos += 1
        for k, parte in enumerate(partes):
            chunks.append({
                "id": u["id"] + (f"-{k}" if len(partes) > 1 else ""),
                "richterNo": None, "richterNos": [],
                "richterTitle": None,
                "section": u["section"], "subsection": None,
                "voice": "richter",
                "text": parte,
                "annotatesPassage": u["annotatesPassage"],
                "utility": u["utility"],
                "sourceManuscript": None,
                "url": u["url"],
                "nWords": len(parte.split()),
                "part": k if len(partes) > 1 else None,
            })

    # el texto que se embebe: titulo + texto (D-025)
    for c in chunks:
        c["embedText"] = ((c["richterTitle"] + ". ") if c.get("richterTitle") else "") + c["text"]

    n_leo = sum(1 for c in chunks if c["voice"] == "leonardo")
    n_ric = len(chunks) - n_leo
    ns = sorted(c["nWords"] for c in chunks)
    print(f"chunks                : {len(chunks):>6,}   esperado {CTRL_CHUNKS[0]:,}-{CTRL_CHUNKS[1]:,}")
    print(f"  leonardo            : {n_leo:>6,}")
    print(f"  richter             : {n_ric:>6,}")
    print(f"  pasajes agrupados   : {n_agrupados:>6,}")
    print(f"  chunks partidos     : {n_partidos:>6,}")
    print(f"  excluidos           : {len(fuera_aparato):>6,} aparato + "
          f"{len(fuera_calidad)} sin contenido")
    print(f"  mediana {ns[len(ns)//2]} palabras · p90 {ns[int(len(ns)*0.9)]} · max {ns[-1]}")

    verificar("chunks", len(chunks), sum(CTRL_CHUNKS) // 2,
              (CTRL_CHUNKS[1] - CTRL_CHUNKS[0]) // 2, alertas)
    largos = [c for c in chunks if c["nWords"] > MAX_PARTIR + SOLAPE]
    if largos:
        alertas.append(f"{len(largos)} chunks siguen por encima de "
                       f"{MAX_PARTIR + SOLAPE} palabras")

    (ARTIFACTS / "chunks.json").write_text(
        json.dumps(chunks, ensure_ascii=False), encoding="utf-8")
    escribir_jsonl(OUT / "chunks.jsonl", chunks)

    rep = ["# Reporte de chunking", "",
           "| | |", "|---|---:|",
           f"| Chunks totales | **{len(chunks):,}** |",
           f"| de Leonardo | {n_leo:,} |",
           f"| de Richter | {n_ric:,} |",
           f"| Pasajes cortos agrupados por titulo | {n_agrupados:,} |",
           f"| Chunks partidos con solape | {n_partidos:,} |",
           f"| Excluidos por aparato | {len(fuera_aparato):,} |",
           f"| Excluidos por falta de contenido | {len(fuera_calidad):,} |",
           "",
           f"Longitud: mediana **{ns[len(ns)//2]}** · p90 {ns[int(len(ns)*0.9)]} · "
           f"max {ns[-1]} palabras.", "",
           f"Se embebe `richterTitle + text` (D-025). Tamano de `chunks.json`: "
           f"{(ARTIFACTS / 'chunks.json').stat().st_size/1024:.0f} KB.", ""]
    if alertas:
        rep += ["## Alertas", ""] + [f"- {a}" for a in alertas]
    (REPORTS / "chunk_report.md").write_text("\n".join(rep) + "\n", encoding="utf-8")
    print(f"\nartefacto -> {ARTIFACTS / 'chunks.json'}")
    for a in alertas:
        print("  alerta:", a)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
