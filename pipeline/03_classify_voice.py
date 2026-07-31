"""03 — Clasifica cada unidad como voz de Leonardo o de Richter, y triaja Richter.

Es el paso mas critico del proyecto. Si el comentario editorial de Richter
(1888) se atribuye a Leonardo, el producto entero pierde sentido, y falla en
silencio: las respuestas siguen sonando perfectamente bien (R1).

Tres niveles, en orden de certeza:

  1. ESTRUCTURAL — no es heuristica, sale de donde vive el texto.
        notas al pie              -> richter
        introducciones de seccion -> richter
        titulos tematicos         -> richter (como campo del chunk, D-025)
        cuerpos de pasaje         -> leonardo

  2. POR BLOQUE — porque el comentario de Richter tambien aparece DENTRO de un
     pasaje numerado, despues de su numero, donde ninguna regla estructural
     llega. Medido: R-755 son 3.338 palabras de las cuales ~96% es Richter
     clasificando bocetos de cupulas, y solo el 4% esta en cursiva. Ver D-052.

  3. BANDERAS — sobre lo que quedo como leonardo. No reclasifican solas: arman
     la lista de revision dirigida que R1 exige revisar al 100%.

Ademas se triajan las unidades de Richter por utilidad, porque la mitad no es
contenido sino aparato ("See Footnote 26", "Compare No. 660"). Ver D-053.

Salidas:
    out/units.jsonl                todas las unidades con voz, utilidad y banderas
    reports/voice_report.md        que se movio y por que, con las validaciones
    reports/voice_flags.md         la lista de revision dirigida
    reports/voice_regression.md    el test de `14` E1
    review/review_overrides.jsonl  plantilla para las correcciones humanas
"""

from __future__ import annotations

import random
import re
import sys
from collections import defaultdict

from common import (OUT, REPORTS, REVIEW, URL_BASE, FalloDeControl,
                    asegurar_carpetas, escribir_jsonl, leer_jsonl, utf8_stdout)

SEMILLA = 42
MUESTRA_ALEATORIA = 100

# --------------------------------------------------------------------------
# 2. clasificacion por bloque
# --------------------------------------------------------------------------
# Los pesos salen de medir cada rasgo sobre las 131 introducciones de seccion
# (prosa de Richter conocida, mismo registro que el comentario interleaveado)
# contra 990 pasajes de secciones sin sospecha. La columna "ratio" es cuantas
# veces mas frecuente es el rasgo en Richter que en Leonardo:
#
#     nombra a Leonardo en 3.a persona   73% vs 0,4%   -> 180x
#     artista posterior como comparacion 16% vs 0,2%   ->  79x
#     anio posterior a 1519               8% vs 0,4%   ->  19x
#     sigla de manuscrito o lamina       32% vs 3,7%   -> 8,6x
#     meta-discurso editorial            56% vs 6,5%   -> 8,6x

RASGOS_RICHTER = [
    # Leonardo no escribe su propio nombre en tercera persona. La excepcion
    # medida son los memorandos legales ("I, Leonardo da Vinci, lent to Vante"),
    # que se descuentan aparte.
    (2.0, "nombra_a_leonardo", re.compile(r"\bLeonardo\b|\bthe master\b(?!\s+of\b)")),
    (1.5, "artista_posterior", re.compile(
        r"\b(Bramante|Michael Angelo|Michelangelo|Brunellesco|Raphael|Vasari|"
        r"Alberti|Verrocchio|Perugino|Botticelli)\b")),
    (1.5, "anio_posterior_a_1519", re.compile(r"\b(15[2-9]\d|1[6-9]\d\d)\b")),
    (1.0, "sigla_de_manuscrito", re.compile(
        r"(Pl\.\s*[IVXLC]|\bMSS?\.|C\.\s?A\.\s?\d|S\.\s?K\.\s?M\.|Ash\.\s?[IVX]|"
        r"Br\.\s?M\.|\bfol\.)")),
    # El HTML conserva el guion bajo del .txt como marca de cursiva en la
    # seccion de arquitectura, donde <i> no se uso. Medido: 23 bloques lo llevan
    # y los 23 son catalogo de Richter ("_III. Castles and Villas.").
    (2.0, "cursiva_literal", re.compile(r"^\s*_")),
    (1.0, "meta_discurso_editorial", re.compile(
        r"\b(we (?:find|see|have|know|may|shall|must|possess|often meet)"
        r"|it seems to me|the reader|in the following pages"
        r"|as (?:we|I) have (?:already )?(?:seen|said|observed)"
        r"|I have (?:already)?[^.]{0,30}(?:pointed out|shown|described|mentioned)"
        r"|this (?:drawing|sketch|plan|page|note|passage|chapter|volume)"
        r"|the (?:drawing|sketch|original|facsimile|editor)"
        r"|reproduced|is (?:shown|given|indicated|drawn|sketched|engraved) "
        r"(?:in|on|by|here|above|below))\b", re.I)),
]

# Evidencia A FAVOR de Leonardo: el registro del cuaderno. Richter escribe
# *sobre* el texto; Leonardo instruye, demuestra e interpela.
RASGOS_LEONARDO = [
    (1.5, "segunda_persona", re.compile(r"\b(if you|you must|you will|you should|"
                                        r"you may|thou|thy)\b", re.I)),
    (1.0, "imperativo", re.compile(
        r"(?m)^(Take|Let|Make|Note|Put|Place|Observe|Remember|Consider|Draw|"
        r"Divide|Suppose)\b")),
    (1.0, "demostracion", re.compile(r"\b(I say that|it follows that|is proved|"
                                     r"the experiment|therefore|hence it)\b", re.I)),
    (1.0, "encabezado_propio", re.compile(r"\bOF (?:THE|A|PAINTING|PERSPECTIVE|"
                                          r"SHADOW|LIGHT)\b")),
]

# Leonardo SI se nombra, en formulas de apertura y en memorandos legales:
# "Begun by me, Leonardo da Vinci, on the 12th of July 1505", "I, Leonardo da
# Vinci, lent to Vante". Lo que nunca hace es hablar de si mismo en tercera
# persona, que es lo que el rasgo quiere capturar.
# --------------------------------------------------------------------------
# higiene e indicador de calidad
# --------------------------------------------------------------------------

RE_ENVOLTORIO = re.compile(r"^\[Footnote(?:\s*\d+)?\s*:?\s*|\s*\]\s*$")
RE_TRANSCRIPTOR = re.compile(r"\*{2,}[^*]{0,40}\*{2,}|\*{3,}")
RE_GUION_BAJO = re.compile(r"_")

# Ni Leonardo ni Richter: es el transcriptor de Project Gutenberg y las
# cabeceras de pagina del libro. No tiene autor y no va a ningun indice.
RE_TRANSCRIPTOR_BOILER = re.compile(
    r"(?:End of Volume\s*\d+"
    r"|Volume\s*\d+\s*Translated by Jean Paul Richter\s*\d*"
    r"|Translated by Jean Paul Richter"
    r"|The Notebooks of Leonardo Da Vinci"
    r"|There are characters present in the original[^.]*\."
    r"|Section title:.*"
    r"|below must belong to previous page.*"
    r"|from previous page\??)", re.I)


def limpiar(texto: str) -> str:
    """Saca los restos del aparato que no son parte del texto.

    El envoltorio `[Footnote: ... ]` es un delimitador del transcriptor, no
    prosa de Richter; los guiones bajos son marcas de cursiva del .txt que el
    generador de HTML de Gutenberg dejo sin limpiar (97 unidades); y `***` son
    marcas del propio transcriptor ("*** from previous page?***").
    """
    texto = RE_TRANSCRIPTOR_BOILER.sub(" ", texto)
    texto = RE_ENVOLTORIO.sub("", texto)
    texto = RE_TRANSCRIPTOR.sub(" ", texto)
    texto = RE_GUION_BAJO.sub("", texto)
    # cola de aparato pegada al final: "84 and following; compare No. 846."
    texto = re.sub(r"\s*\b(?:\d+ and following[;,]?\s*)?(?:compare|see)\s+Nos?\."
                   r"\s*[\d,.\s]*\.?\s*$", "", texto, flags=re.I)
    texto = re.sub(r"[ \t]+", " ", texto)
    return re.sub(r"\n{2,}", "\n", texto).strip()


# Palabras funcionales del ingles. Un texto de Leonardo traducido por Richter
# las usa; una lista de toponimos, un verso latino o un OCR de griego roto, no.
FUNCIONALES = set(
    "the a an of and or to in on at by for with is are was were be been being it "
    "its this that these those as from not no all any which who when where what "
    "will would shall should may might can could do does did has have had but if "
    "so than then there their they he she we you your his her my me i".split())
RE_NO_LATINO = re.compile(r"[Ͱ-Ͽἀ-῿Ѐ-ӿ]")
UMBRAL_FUNCIONALES = 0.22


def calidad(texto: str, n_palabras: int) -> str:
    """`low` marca material sin contenido recuperable. Ver D-054.

    D-044 dejo esto pendiente para la Fase 1 y advirtio que un filtro por tasa
    de palabras funcionales "se lleva puestos aforismos legitimos y cortos".
    Medido, con el umbral en 0,22 no ocurre: los imanes que D-044 nombra caen
    entre 0,00 y 0,20, y los pasajes legitimos mas pobres estan en 0,36.
    "A point is not part of a line" da 0,71.
    """
    if n_palabras < 8:
        return "low"
    if RE_NO_LATINO.search(texto):
        return "low"
    letras = sum(c.isalpha() for c in texto)
    if letras / max(1, len(texto)) < 0.62:
        return "low"
    palabras = re.findall(r"[A-Za-z']+", texto.lower())
    ratio = sum(1 for w in palabras if w in FUNCIONALES) / max(1, len(palabras))
    if ratio < UMBRAL_FUNCIONALES:
        return "low"
    if len(re.findall(r"[a-z]\.", texto)) >= 6:
        return "low"
    return "ok"


RE_AUTONOMBRE = re.compile(r"\b(?:I|me|my|mine)\b[^.]{0,60}\bLeonardo\b", re.I)

UMBRAL_SEMILLA = 2.0     # 77% de recall con 0,4% de falsos positivos
UMBRAL_EXPANSION = 0.5   # solo para bloques contiguos a una semilla
MAX_HUECO = 3            # bloques que se rellenan entre dos tiradas

# Se evaluo y se descarto una regla de "pasaje dominado por Richter" (si mas del
# 60% de sus palabras eran de Richter, el pasaje entero pasaba a serlo). Medida,
# se llevaba puestas 2.348 palabras de Leonardo: R-740 abre con "OF LUTING THE
# FURNACE WITHIN. The furnace must be luted before you put the metal in it" —
# 1.176 palabras suyas sobre la fundicion del monumento Sforza— y quedaban
# clasificadas como Richter porque el resto del pasaje si lo era. La precision
# tiene que quedarse en el bloque; agregar una regla de pasaje la deshace.


def puntuar(texto: str) -> tuple[float, list[str]]:
    disparados, score = [], 0.0
    autonombre = bool(RE_AUTONOMBRE.search(texto))
    for peso, nombre, rx in RASGOS_RICHTER:
        if rx.search(texto):
            if nombre == "nombra_a_leonardo" and autonombre:
                continue
            score += peso
            disparados.append(nombre)
    for peso, nombre, rx in RASGOS_LEONARDO:
        if rx.search(texto):
            score -= peso
            disparados.append("-" + nombre)
    return score, disparados


def clasificar_bloques(bloques: list[dict]) -> dict[int, list[dict]]:
    """Marca cada bloque como leonardo o richter. Devuelve los bloques por pasaje.

    Semillas de alta precision, y despues expansion a los vecinos contiguos: el
    comentario de Richter no aparece de a un parrafo suelto sino en tiradas
    (R-755 son mas de cien bloques seguidos). Un vecino con cualquier evidencia
    de Richter y ninguna de Leonardo se absorbe en la tirada.
    """
    por_pasaje: dict[int, list[dict]] = defaultdict(list)
    for b in bloques:
        score, disparados = puntuar(b["text"])
        b = dict(b, score=score, rasgos=disparados, voice="leonardo")
        if b["italicRatio"] >= 0.6 and b["nWords"] >= 12:
            b["score"] += 1.0
            b["rasgos"] = b["rasgos"] + ["italica_dominante"]
        por_pasaje[b["richterNo"]].append(b)

    for n, bs in por_pasaje.items():
        bs.sort(key=lambda x: x["orden"])
        semillas = [i for i, b in enumerate(bs) if b["score"] >= UMBRAL_SEMILLA]
        for i in semillas:
            bs[i]["voice"] = "richter"
            bs[i]["voiceSource"] = "bloque: semilla"
        for i in semillas:                       # expansion hacia los dos lados
            for paso in (-1, 1):
                j = i + paso
                while 0 <= j < len(bs) and bs[j]["voice"] == "leonardo" \
                        and bs[j]["score"] >= UMBRAL_EXPANSION:
                    bs[j]["voice"] = "richter"
                    bs[j]["voiceSource"] = "bloque: contiguo a una semilla"
                    j += paso
        # Relleno de huecos: un bloque que queda ENTRE dos tiradas de Richter es
        # de Richter. Su comentario es prosa continua; el texto de Leonardo no
        # reaparece por dos parrafos en medio de un ensayo editorial. Sin esto,
        # R-755 conservaba "I have already, in another place, pointed out the law
        # of construction", que no dispara ningun rasgo y esta rodeado de dos
        # bloques que si. Se exige que el hueco no tenga evidencia clara de
        # Leonardo, para no rellenar sobre texto suyo.
        marcados = [i for i, b in enumerate(bs) if b["voice"] == "richter"]
        for a, z in zip(marcados, marcados[1:]):
            if 1 < z - a <= MAX_HUECO + 1:
                for j in range(a + 1, z):
                    if bs[j]["score"] > -1.0:
                        bs[j]["voice"] = "richter"
                        bs[j]["voiceSource"] = "bloque: hueco entre dos tiradas"
    return por_pasaje


# --------------------------------------------------------------------------
# 3. banderas sobre lo que quedo como leonardo
# --------------------------------------------------------------------------

F_PRIMERA_PERSONA = re.compile(
    r"\b(it is my intention"
    r"|I have (?:here |already |also |thus |not )?(?:reproduced|given|added|omitted"
    r"|copied|inserted|placed|endeavoured|preferred|adopted|selected|arranged)"
    r"|I am unable to (?:find|trace|explain)"
    r"|the reader"
    r"|in my opinion"
    r"|the present (?:work|volume|edition|writer))\b", re.I)
F_LAMINA = re.compile(
    r"(\bsee Pl\.|\bPl\.\s*[IVXLC]|\bcompare (?:No|Nos)\.|\bsee (?:No|Nos)\."
    r"|\bsee Vol\.|\bfacsimile\b)")
F_FECHA = re.compile(r"\b(15[2-9]\d|1[6-9]\d\d|20\d\d)\b")
F_ERUDITO = re.compile(
    r"\b(RICHTER|MULLER|BRAUN|PHILPOT|VASARI|LOMAZZO|AMORETTI|UZIELLI|GOVI"
    r"|LUDWIG|MENDELSON|DIETZ|Windsor Castle|Bibliography of the Manuscripts)\b")
BANDERAS = [("primera_persona_editorial", F_PRIMERA_PERSONA),
            ("referencia_al_aparato", F_LAMINA),
            ("anio_posterior_a_1519", F_FECHA),
            ("erudito_del_XIX", F_ERUDITO)]

E1_FRASES = ["it is my intention to reproduce here", "see Pl.",
             "in the Bibliography of the Manuscripts"]


# --------------------------------------------------------------------------
# triaje de utilidad de las unidades de Richter
# --------------------------------------------------------------------------

# Lo que documenta una AUSENCIA es el material mas valioso del corpus de
# Richter: es lo que fundamenta una abstencion (D-027, D-042). La nota de la
# Mona Lisa —la unica mencion en 1,4 MB— entra por aca.
T_AUSENCIA = re.compile(
    r"(no (?:sketches?|drawings?|other|further|mention|record|trace|allusion"
    r"|information|data|notes?) (?:are|is|of|as to|has|have|about|whatever)?"
    r"|never (?:allude|mention|refer|speak)|nor do the MS|we (?:have|possess) no"
    r"|nothing (?:is known|has been)|not (?:to be found|been preserved|known)"
    r"|is (?:silent|wanting|lost)|unknown to us|we know nothing)", re.I)

# Aparato: remisiones y siglas sin contenido propio.
T_REFERENCIA = re.compile(
    r"(Pl\.\s*[IVXLC]|\bMSS?\.|C\.\s?A\.|S\.\s?K\.\s?M\.|Ash\.|Br\.\s?M\.|"
    r"\bNo\.\s*\d|\bfol\.|\bcompare\b|\bsee\b|\b\d+[ab]\b)", re.I)
MIN_SUSTANCIAL = 25


def utilidad(texto: str, n_palabras: int) -> str:
    if T_AUSENCIA.search(texto) and n_palabras >= 15:
        return "absence"
    if n_palabras < MIN_SUSTANCIAL:
        return "apparatus"
    refs = len(T_REFERENCIA.findall(texto))
    if refs * 8 >= n_palabras:          # dominado por remisiones
        return "apparatus"
    return "substantive"


# --------------------------------------------------------------------------

def main() -> int:
    utf8_stdout()
    asegurar_carpetas()

    pasajes = {p["richterNo"]: p for p in leer_jsonl(OUT / "passages.jsonl")}
    bloques = leer_jsonl(OUT / "blocks.jsonl")
    notas = leer_jsonl(OUT / "footnotes.jsonl")
    intros = leer_jsonl(OUT / "intros.jsonl")

    overrides = {}
    if (REVIEW / "review_overrides.jsonl").exists():
        for o in leer_jsonl(REVIEW / "review_overrides.jsonl"):
            overrides[o["id"]] = o

    por_pasaje = clasificar_bloques(bloques)
    pal_antes = sum(b["nWords"] for b in bloques)
    pal_richter = sum(b["nWords"] for bs in por_pasaje.values()
                      for b in bs if b["voice"] == "richter")

    unidades: list[dict] = []

    def agregar(uid, kind, voice, texto, **extra):
        texto = limpiar(texto)
        if not texto:
            return
        base = {"id": uid, "kind": kind, "voice": voice, "text": texto,
                "nWords": len(texto.split()), "flags": [],
                "richterNo": None, "richterTitle": None, "section": None,
                "subsection": None, "annotatesPassage": None,
                "anchorId": None, "url": None, "utility": None, "quality": None,
                "voiceSource": "estructural"}
        base.update(extra)
        if voice == "richter":
            base["utility"] = utilidad(texto, base["nWords"])
        else:
            base["quality"] = calidad(texto, base["nWords"])
        unidades.append(base)

    for n in notas:
        agregar(n["id"], "footnote", "richter", n["text"],
                annotatesPassage=n["annotatesPassage"],
                voiceSource="estructural: bloque [Footnote]")
    for i in intros:
        agregar(i["id"], "section_intro", "richter", i["text"],
                annotatesPassage=i["precedeAlPasaje"], section=i["section"],
                anchorId=i["anchorId"],
                voiceSource="estructural: entre encabezado de seccion y el proximo pasaje")

    # pasajes, ya sin los bloques de Richter, y el comentario interleaveado aparte
    n_inline = 0
    for num in sorted(por_pasaje):
        p, bs = pasajes[num], por_pasaje[num]
        leo = [b for b in bs if b["voice"] == "leonardo"]
        texto = "\n".join(b["text"] for b in leo)
        if texto.strip():
            agregar(f"rt-{num:04d}", "passage", "leonardo", texto,
                    richterNo=num, richterTitle=p["richterTitle"],
                    section=p["section"], subsection=p["subsection"],
                    anchorId=p["anchorId"], url=p["url"],
                    voiceSource="estructural: cuerpo de pasaje numerado")
        # tiradas contiguas de Richter -> una unidad cada una
        tirada: list[dict] = []
        for b in bs + [None]:
            if b is not None and b["voice"] == "richter":
                tirada.append(b)
                continue
            if tirada:
                t = "\n".join(x["text"] for x in tirada)
                agregar(f"cm-{n_inline:04d}", "inline_commentary", "richter", t,
                        annotatesPassage=num, section=p["section"],
                        anchorId=tirada[0]["anchorId"],
                        url=f"{URL_BASE}#{tirada[0]['anchorId']}"
                            if tirada[0]["anchorId"] else None,
                        voiceSource=tirada[0].get("voiceSource", "bloque"))
                n_inline += 1
                tirada = []

    # banderas + overrides
    for u in unidades:
        if u["voice"] == "leonardo":
            u["flags"] = [n for n, rx in BANDERAS if rx.search(u["text"])]
        o = overrides.get(u["id"])
        if o and o.get("voice") and o["voice"] != u["voice"]:
            u["voice"] = o["voice"]
            u["voiceSource"] = f"revision manual: {o.get('motivo', 'sin motivo')}"
            u["utility"] = utilidad(u["text"], u["nWords"]) if o["voice"] == "richter" else None

    leo = [u for u in unidades if u["voice"] == "leonardo"]
    ric = [u for u in unidades if u["voice"] == "richter"]
    marcadas = [u for u in leo if u["flags"]]
    tri = {k: [u for u in ric if u["utility"] == k]
           for k in ("absence", "substantive", "apparatus")}

    print(f"unidades              : {len(unidades):>6,}")
    print(f"  leonardo            : {len(leo):>6,}  ({sum(u['nWords'] for u in leo):>7,} palabras)")
    print(f"  richter             : {len(ric):>6,}  ({sum(u['nWords'] for u in ric):>7,} palabras)")
    print(f"     absence          : {len(tri['absence']):>6,}  "
          f"({sum(u['nWords'] for u in tri['absence']):>7,} palabras)  -> indice richter, prioridad")
    print(f"     substantive      : {len(tri['substantive']):>6,}  "
          f"({sum(u['nWords'] for u in tri['substantive']):>7,} palabras)  -> indice richter")
    print(f"     apparatus        : {len(tri['apparatus']):>6,}  "
          f"({sum(u['nWords'] for u in tri['apparatus']):>7,} palabras)  -> FUERA del indice")
    print(f"  comentario interleaveado extraido: {n_inline} tiradas, "
          f"{pal_richter:,} palabras ({pal_richter/pal_antes:.1%} del cuerpo)")
    print(f"  con bandera         : {len(marcadas):>6,}")

    # ---------------- validaciones ----------------
    val = []
    for num in (755, 795, 768, 769):
        bs = por_pasaje.get(num, [])
        tot = sum(b["nWords"] for b in bs)
        exc = sum(b["nWords"] for b in bs if b["voice"] == "richter")
        val.append((num, tot, exc, exc / max(1, tot)))

    fallos = []
    reg = ["# Test de regresion — los pasajes de `14` E1", "",
           "Ninguna de las frases que E1 cita textualmente puede sobrevivir como voz",
           "de Leonardo y sin bandera.", ""]
    for frase in E1_FRASES:
        hits = [u for u in unidades if frase.lower() in u["text"].lower()]
        malos = [u for u in hits if u["voice"] == "leonardo" and not u["flags"]]
        reg += [f"- `{frase}` — {len(hits)} unidades · "
                f"{sum(1 for u in hits if u['voice'] == 'richter')} resueltas como richter · "
                f"{sum(1 for u in hits if u['voice'] == 'leonardo' and u['flags'])} con bandera · "
                f"**{len(malos)} escapadas**"]
        fallos += malos
    reg += ["", "## Los cuatro pasajes que la revision del paso 3 dejo abiertos", "",
            "| pasaje | palabras | excindidas | |", "|---|---:|---:|---:|"]
    for num, tot, exc, frac in val:
        reg.append(f"| R-{num} | {tot:,} | {exc:,} | **{frac:.0%}** |")
    reg.append("")
    (REPORTS / "voice_regression.md").write_text("\n".join(reg) + "\n", encoding="utf-8")

    # ---------------- revision dirigida ----------------
    random.seed(SEMILLA)
    muestra = random.sample(leo, min(MUESTRA_ALEATORIA, len(leo)))
    limite = [b for bs in por_pasaje.values() for b in bs
              if b["voice"] == "leonardo" and 0.5 <= b["score"] < UMBRAL_SEMILLA]

    V = ["# Revision dirigida de voz (R1)", "",
         "Revisar **el 100% de lo marcado** mas la muestra aleatoria. Para corregir:",
         "",
         '    {"id": "rt-0795", "voice": "richter", "motivo": "prosa editorial"}',
         "",
         "en `pipeline/review/review_overrides.jsonl`. El pipeline lo vuelve a leer.",
         "",
         f"## Unidades `leonardo` con bandera: {len(marcadas)}", ""]
    for u in marcadas:
        V += [f"- **`{u['id']}`** ({u['nWords']} pal · {'+'.join(u['flags'])})",
              f"  > {' '.join(u['text'].split())[:190]}", ""]
    V += [f"## Bloques en el limite: {len(limite)}", "",
          f"Puntuaron entre {UMBRAL_EXPANSION} y {UMBRAL_SEMILLA} y **no** se excindieron.",
          "Es donde estaria un falso negativo del clasificador de bloque.", ""]
    for b in sorted(limite, key=lambda x: -x["score"])[:60]:
        V += [f"- **R-{b['richterNo']}** bloque {b['orden']} "
              f"(score {b['score']:.1f} · {'+'.join(b['rasgos'])})",
              f"  > {' '.join(b['text'].split())[:190]}", ""]
    V += [f"## Muestra aleatoria de {len(muestra)} (semilla {SEMILLA})", ""]
    for u in muestra:
        V += [f"- **`{u['id']}`** ({u['nWords']} pal)",
              f"  > {' '.join(u['text'].split())[:190]}", ""]
    (REPORTS / "voice_flags.md").write_text("\n".join(V) + "\n", encoding="utf-8")

    # ---------------- reporte ----------------
    rep = ["# Reporte de voz", "",
           "## Reparto", "",
           "| | unidades | palabras |", "|---|---:|---:|",
           f"| **Leonardo** (indice T1) | {len(leo):,} | {sum(u['nWords'] for u in leo):,} |",
           f"| Richter · `absence` | {len(tri['absence']):,} | {sum(u['nWords'] for u in tri['absence']):,} |",
           f"| Richter · `substantive` | {len(tri['substantive']):,} | {sum(u['nWords'] for u in tri['substantive']):,} |",
           f"| Richter · `apparatus` (fuera del indice) | {len(tri['apparatus']):,} | {sum(u['nWords'] for u in tri['apparatus']):,} |",
           "",
           "## Comentario de Richter extraido de adentro de los pasajes", "",
           f"- **{n_inline} tiradas · {pal_richter:,} palabras**, "
           f"el {pal_richter/pal_antes:.1%} de lo que el parseo daba como cuerpo de pasaje.",
           "",
           "| pasaje | palabras | excindidas | |", "|---|---:|---:|---:|"]
    for num, tot, exc, frac in val:
        rep.append(f"| R-{num} | {tot:,} | {exc:,} | **{frac:.0%}** |")
    rep += ["",
            "## Validacion del clasificador de bloque", "",
            "Pesos medidos sobre 131 introducciones de seccion (Richter conocido) contra",
            "990 pasajes de secciones sin sospecha:", "",
            "| rasgo | Richter | Leonardo | ratio |", "|---|---:|---:|---:|",
            "| nombra a Leonardo en 3.a persona | 73% | 0,4% | **180x** |",
            "| artista posterior como comparacion | 16% | 0,2% | 79x |",
            "| anio posterior a 1519 | 8% | 0,4% | 19x |",
            "| sigla de manuscrito o lamina | 32% | 3,7% | 8,6x |",
            "| meta-discurso editorial | 56% | 6,5% | 8,6x |", "",
            f"Umbral de semilla {UMBRAL_SEMILLA}: **77% de recall con 0,4% de falsos "
            f"positivos**. La expansion a bloques contiguos (>= {UMBRAL_EXPANSION}) "
            "recupera el resto de cada tirada.", "",
            f"- Bloques en el limite, sin excindir: **{len(limite)}** → `voice_flags.md`",
            f"- Unidades `leonardo` con bandera: **{len(marcadas)}**", ""]
    (REPORTS / "voice_report.md").write_text("\n".join(rep) + "\n", encoding="utf-8")

    escribir_jsonl(OUT / "units.jsonl", unidades)
    print(f"\nreporte -> {REPORTS / 'voice_report.md'}")

    if fallos:
        for u in fallos[:10]:
            print(f"  ESCAPADA {u['id']}: {' '.join(u['text'].split())[:140]}", file=sys.stderr)
        raise FalloDeControl("el test de regresion de `14` E1 no pasa")
    print("test de regresion de `14` E1: pasa")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
