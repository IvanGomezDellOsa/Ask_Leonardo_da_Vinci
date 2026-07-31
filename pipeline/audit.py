"""Auditoria del corpus parseado. No es una etapa del pipeline: es el arnes.

Corre despues de 02 y 03 y busca la clase de error que no hace ruido. Cada
chequeo es una pregunta que, si se contesta mal, corrompe el corpus en silencio.

    A. Conservacion   ¿se perdio texto entre el HTML y las unidades?
    B. Higiene        ¿quedaron restos del parseo dentro del texto?
    C. Pasajes iman   los que D-044 dejo pendientes para la Fase 1
    D. Anclas         ¿la URL de citacion apunta al pasaje correcto?
    E. Duplicados     ¿hay unidades repetidas o texto duplicado?
    F. Titulos        ¿los del Volumen II resisten una mirada?
    G. Voz            ¿quedo algo de Richter con voz de Leonardo?

Salida: reports/audit.md  ·  devuelve 1 si algun chequeo es duro y falla.
"""

from __future__ import annotations

import re
import sys
from collections import Counter

from bs4 import BeautifulSoup

from common import HTML, OUT, REPORTS, asegurar_carpetas, leer_jsonl, utf8_stdout

L = []          # lineas del reporte
DUROS = []      # fallos que rompen la corrida


def seccion(t):
    L.extend(["", f"## {t}", ""])


def ok(cond, texto, duro=False):
    L.append(f"- {'ok' if cond else '**FALLA**'} — {texto}")
    if not cond and duro:
        DUROS.append(texto)
    return cond


# --------------------------------------------------------------------------

def main() -> int:
    utf8_stdout()
    asegurar_carpetas()

    unidades = leer_jsonl(OUT / "units.jsonl")
    bloques = leer_jsonl(OUT / "blocks.jsonl")
    pasajes = leer_jsonl(OUT / "passages.jsonl")
    titulos = leer_jsonl(OUT / "titles.jsonl")
    indice = leer_jsonl(OUT / "toc.jsonl")
    leo = [u for u in unidades if u["voice"] == "leonardo"]

    crudo = HTML.read_text(encoding="utf-8")
    cuerpo_html = crudo[crudo.index("*** START OF THE PROJECT GUTENBERG"):
                        crudo.index("*** END OF THE PROJECT GUTENBERG")]
    sopa = BeautifulSoup(cuerpo_html, "html.parser")
    texto_html = "\n".join(b.get_text() for b in
                           sopa.find_all(["h1", "h2", "h4", "h5", "p", "blockquote", "li"]))

    L.extend(["# Auditoria del corpus", "",
              f"Fuente: `pg5000-images.html` · {len(crudo):,} bytes"])

    # ---------------------------------------------------------------- A
    seccion("A. Conservacion de texto")
    pal_html = len(texto_html.split())
    pal_unidades = sum(u["nWords"] for u in unidades)
    pal_titulos = sum(len(t["titulo"].split()) for t in titulos)
    # lo que legitimamente no es una unidad: portada, prefacio, indice de
    # contenidos y los encabezados de seccion, todos anteriores al pasaje 1 o
    # consumidos como jerarquia
    m = re.search(r"(?m)^[ \t]*1\.[ \t]*$", texto_html)
    pal_preliminar = len(texto_html[:m.start()].split()) if m else 0
    contabilizado = pal_unidades + pal_titulos + pal_preliminar
    falta = pal_html - contabilizado
    L.extend([f"- palabras en el HTML (cuerpo): **{pal_html:,}**",
              f"- en unidades: {pal_unidades:,} · en titulos: {pal_titulos:,} · "
              f"preliminares (portada, prefacio, indice): {pal_preliminar:,}",
              f"- **sin contabilizar: {falta:,} ({falta/pal_html:.1%})**"])
    ok(abs(falta) / pal_html < 0.06,
       f"la fuga de texto se mantiene por debajo del 6% (es {falta/pal_html:.1%})", duro=True)

    # ---------------------------------------------------------------- B
    seccion("B. Higiene del texto")
    restos = {
        "marca `[Footnote` sin eliminar": r"\[Footnote",
        "centinela de bloque sin limpiar": r"[-]",
        "guion bajo suelto (marca de cursiva del .txt)": r"_",
        "marcador de transcriptor `***`": r"\*\*\*",
        "espacios multiples": r"  +",
        "corchete de nota sin abrir": r"^\s*\]",
    }
    for nombre, patron in restos.items():
        rx = re.compile(patron, re.M)
        n = sum(1 for u in unidades if rx.search(u["text"]))
        duro = "Footnote" in nombre or "centinela" in nombre or "guion" in nombre
        ok(n == 0 if duro else n < 20, f"{nombre}: {n} unidades", duro=duro)

    # ---------------------------------------------------------------- C
    seccion("C. Pasajes iman y material sin contenido (pendiente de D-044)")
    GRIEGO = re.compile(r"[Ͱ-Ͽἀ-῿]")

    def alfabetico(t):
        letras = sum(c.isalpha() for c in t)
        return letras / max(1, len(t))

    def riqueza(t):
        p = re.findall(r"[A-Za-z]{2,}", t.lower())
        return len(set(p)) / max(1, len(p))

    sospechosos = []
    for u in leo:
        if u["nWords"] < 8:
            continue
        motivos = []
        if alfabetico(u["text"]) < 0.62:
            motivos.append(f"alfabetico {alfabetico(u['text']):.0%}")
        if GRIEGO.search(u["text"]):
            motivos.append("caracteres griegos")
        if riqueza(u["text"]) < 0.45 and u["nWords"] >= 20:
            motivos.append(f"riqueza lexica {riqueza(u['text']):.0%}")
        if len(re.findall(r"\b[a-z]\.", u["text"])) >= 6:
            motivos.append("lista de items de una letra")
        if motivos:
            sospechosos.append((u, motivos))
    L.append(f"- unidades de Leonardo sin contenido util: **{len(sospechosos)}** "
             f"({sum(u['nWords'] for u, _ in sospechosos):,} palabras)")
    conocidos = {1382, 1560, 1069, 1558, 1565}
    hallados = {u["richterNo"] for u, _ in sospechosos} & conocidos
    L.append(f"- de los imanes que D-044 nombra {sorted(conocidos)}, "
             f"detectados: **{sorted(hallados)}**")
    L.append("")
    for u, motivos in sorted(sospechosos, key=lambda x: -x[0]["nWords"])[:12]:
        L.append(f"  - `{u['id']}` ({u['nWords']} pal · {', '.join(motivos)}): "
                 f"{' '.join(u['text'].split())[:110]}")

    # ---------------------------------------------------------------- D
    seccion("D. Anclas de citacion")
    ids_html = set(re.findall(r'id="(id\d+)"', crudo))
    sin_ancla = [u for u in leo if not u.get("anchorId")]
    rotas = [u for u in leo if u.get("anchorId") and u["anchorId"] not in ids_html]
    ok(len(sin_ancla) == 0, f"unidades de Leonardo sin ancla: {len(sin_ancla)}", duro=True)
    ok(len(rotas) == 0, f"anclas que no existen en el HTML: {len(rotas)}", duro=True)
    # el ancla tiene que ser el parrafo que contiene el numero del pasaje
    malas = []
    for p in pasajes[:2000]:
        if not p["anchorId"]:
            continue
        m = re.search(rf'id="{p["anchorId"]}"[^>]*>([^<]{{0,40}})', crudo)
        if m and not re.search(rf'\b{p["richterNo"]}\.', m.group(1)):
            malas.append((p["richterNo"], m.group(1).strip()[:40]))
    ok(len(malas) < 30, f"anclas cuyo parrafo no contiene el numero del pasaje: "
                        f"{len(malas)} de {len(pasajes)}")
    for n, t in malas[:6]:
        L.append(f"  - R-{n} apunta a un parrafo que empieza con {t!r}")

    # ---------------------------------------------------------------- E
    seccion("E. Duplicados")
    ids = Counter(u["id"] for u in unidades)
    ok(all(v == 1 for v in ids.values()),
       f"ids repetidos: {[k for k, v in ids.items() if v > 1][:5]}", duro=True)
    nums = Counter(p["richterNo"] for p in pasajes)
    ok(all(v == 1 for v in nums.values()),
       f"numeros de pasaje repetidos: {[k for k, v in nums.items() if v > 1][:5]}", duro=True)
    textos = Counter(" ".join(u["text"].split())[:200] for u in leo if u["nWords"] >= 20)
    reps = [t for t, v in textos.items() if v > 1]
    ok(len(reps) < 15, f"textos de Leonardo duplicados (primeros 200 caracteres): {len(reps)}")
    for t in reps[:5]:
        L.append(f"  - {t[:110]}")

    # ---------------------------------------------------------------- F
    seccion("F. Titulos")
    sin_titulo = [u for u in leo if not u.get("richterTitle")]
    ok(len(sin_titulo) == 0, f"unidades de Leonardo sin titulo: {len(sin_titulo)}")
    # los rangos del indice tienen que coincidir con lo asignado
    por_num = {p["richterNo"]: p for p in pasajes}
    # Richter comparte el pasaje del borde entre dos entradas consecutivas
    # ("52--55" seguido de "55--56"), asi que un pasaje puede pertenecer
    # legitimamente a dos titulos. Se cuenta solo lo que no es un solape.
    solapados = {e["hasta"] for i, e in enumerate(indice[:-1])
                 if e["hasta"] >= indice[i + 1]["desde"]}
    desalineados = [n for e in indice for n in range(e["desde"], e["hasta"] + 1)
                    if n not in solapados and por_num.get(n)
                    and por_num[n]["richterTitle"] != e["titulo"]]
    L.append(f"- entradas del indice con rango solapado (del propio Richter): "
             f"{len(solapados)} → {sorted(solapados)}")
    ok(not desalineados,
       f"pasajes del Volumen I cuyo titulo no coincide con el indice: "
       f"{len(desalineados)} {desalineados[:6]}", duro=True)
    largos = [u for u in leo if u.get("richterTitle") and len(u["richterTitle"].split()) > 18]
    ok(len(largos) < 25, f"titulos de mas de 18 palabras (probable falso positivo): {len(largos)}")
    for u in largos[:6]:
        L.append(f"  - R-{u['richterNo']}: {u['richterTitle'][:110]}")

    # ---------------------------------------------------------------- G
    seccion("G. Voz")
    RE_3A = re.compile(r"\bLeonardo\b")
    RE_YO = re.compile(r"\b(?:I|me|my|mine)\b[^.]{0,60}\bLeonardo\b", re.I)
    fugas = [u for u in leo if RE_3A.search(u["text"]) and not RE_YO.search(u["text"])]
    ok(len(fugas) < 12, f"unidades de Leonardo que lo nombran sin marca de primera "
                        f"persona: {len(fugas)}")
    for u in fugas[:8]:
        m = RE_3A.search(u["text"])
        L.append(f"  - `{u['id']}`: …{' '.join(u['text'][max(0, m.start()-90):m.start()+70].split())}…")
    baja = [u for u in leo if u.get("quality") == "low"]
    L.append(f"- unidades de Leonardo marcadas `quality: low`: **{len(baja)}** "
             f"({sum(u['nWords'] for u in baja):,} palabras) — fuera del indice denso")
    faltan = {1382, 1560, 1069, 1558, 1565} - {u["richterNo"] for u in baja}
    ok(not faltan, f"los imanes que D-044 nombra quedan todos marcados "
                   f"(sin marcar: {sorted(faltan)})", duro=True)
    con_bandera = [u for u in leo if u["flags"]]
    L.append(f"- unidades con bandera pendientes de revision: **{len(con_bandera)}**")

    # ----------------------------------------------------------------
    L.extend(["", "## Resumen", "",
              f"- chequeos duros fallados: **{len(DUROS)}**"])
    for d in DUROS:
        L.append(f"  - {d}")
    (REPORTS / "audit.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(l for l in L if l.startswith(("- ok", "- **", "#", "  - "))))
    print(f"\nreporte -> {REPORTS / 'audit.md'}")
    if DUROS:
        print(f"\n{len(DUROS)} chequeos duros fallaron", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
