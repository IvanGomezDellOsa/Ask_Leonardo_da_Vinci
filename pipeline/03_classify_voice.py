"""03 — Clasifica cada unidad como voz de Leonardo o de Richter.

Es el paso mas critico del proyecto. Si el comentario editorial de Richter
(1888) se atribuye a Leonardo, el producto entero pierde sentido, y falla en
silencio: las respuestas siguen sonando perfectamente bien (R1).

La clasificacion tiene dos niveles, y el orden importa:

  ESTRUCTURAL — certeza, no heuristica. Sale de donde vive el texto:
      notas al pie          -> richter   (874)
      introducciones de seccion -> richter   (150)
      titulos tematicos     -> richter   (van como campo del chunk, D-025)
      cuerpos de pasaje     -> leonardo

  BANDERAS — sobre lo que quedo como leonardo. NO reclasifican solas: arman la
  lista de revision dirigida que R1 exige revisar al 100%. La decision humana
  se escribe en review/review_overrides.jsonl y el pipeline la vuelve a leer,
  asi la revision queda versionada y el parseo sigue siendo reproducible.

`14` E1 midio que hay 18 pseudo-pasajes con prosa de Richter en primera persona
SIN cursiva, o sea que la tipografia no alcanza y las banderas tampoco pueden
ser la unica defensa. Por eso las frases que E1 cita textualmente se usan como
TEST DE REGRESION: si alguna sobrevive como `leonardo` sin bandera, el
clasificador no esta terminado y el script falla.

Salidas:
    out/units.jsonl              todas las unidades con su voz y sus banderas
    reports/voice_flags.md       la lista de revision dirigida
    reports/voice_regression.md  el test de E1, unidad por unidad
    review/review_overrides.jsonl  plantilla para las correcciones humanas
"""

from __future__ import annotations

import random
import re
import sys

from common import (OUT, REPORTS, REVIEW, FalloDeControl, asegurar_carpetas,
                    escribir_jsonl, leer_jsonl, utf8_stdout)

SEMILLA = 42
MUESTRA_ALEATORIA = 100

# --------------------------------------------------------------------------
# banderas
# --------------------------------------------------------------------------

# Primera persona editorial. Leonardo tambien escribe "I", asi que no alcanza
# con el pronombre: lo que delata a Richter es el objeto editorial (reproducir,
# dar, omitir, copiar) y el destinatario ("the reader").
F_PRIMERA_PERSONA = re.compile(
    r"\b(it is my intention"
    r"|I have (?:here |already |also |thus |not )?(?:reproduced|given|added|omitted"
    r"|copied|inserted|placed|endeavoured|preferred|adopted|selected|arranged"
    r"|thought it|been able)"
    r"|I am unable to (?:find|trace|explain)"
    r"|the reader"
    r"|as (?:has been|I have) (?:said|stated|observed) (?:above|before)"
    r"|in my opinion"
    r"|the present (?:work|volume|edition|writer))\b", re.I)

# Referencias al aparato del libro: laminas, numeros de pasaje, volumenes.
F_LAMINA = re.compile(
    r"(\bsee Pl\.|\bPl\.\s*[IVXLC]|\bcompare (?:No|Nos)\.|\bsee (?:No|Nos)\."
    r"|\bsee Vol\.|\bVol\.\s*[IVX]|\bfacsimile\b)")

# Red de seguridad de R1: Leonardo murio en 1519. Cualquier anio posterior en un
# chunk suyo es, por definicion, alguien mas hablando.
F_FECHA = re.compile(r"\b(15[2-9]\d|1[6-9]\d\d|20\d\d)\b")

# Eruditos, editores y publicaciones del XIX que Richter cita.
F_ERUDITO = re.compile(
    r"\b(RICHTER|MULLER|BRAUN|PHILPOT|VASARI|LOMAZZO|AMORETTI|UZIELLI|GOVI"
    r"|MANZI|LUDWIG|HEYDENREICH|CLARK|MENDELSON|DIETZ|Windsor Castle"
    r"|Bibliography of the Manuscripts|Distributed Proofreaders)\b")

BANDERAS = [
    ("primera_persona_editorial", F_PRIMERA_PERSONA),
    ("referencia_al_aparato", F_LAMINA),
    ("anio_posterior_a_1519", F_FECHA),
    ("erudito_del_XIX", F_ERUDITO),
]

# Las frases que `14` E1 cita textualmente como prueba de que la cursiva no
# alcanza. Ninguna puede sobrevivir como voz de Leonardo y sin bandera.
E1_FRASES = [
    "it is my intention to reproduce here",
    "see Pl.",
    "in the Bibliography of the Manuscripts",
]


def banderas_de(texto: str) -> list[str]:
    return [nombre for nombre, rx in BANDERAS if rx.search(texto)]


# --------------------------------------------------------------------------

def main() -> int:
    utf8_stdout()
    asegurar_carpetas()

    pasajes = leer_jsonl(OUT / "passages.jsonl")
    notas = leer_jsonl(OUT / "footnotes.jsonl")
    intros = leer_jsonl(OUT / "intros.jsonl")

    overrides = {}
    ruta_ov = REVIEW / "review_overrides.jsonl"
    if ruta_ov.exists():
        for o in leer_jsonl(ruta_ov):
            overrides[o["id"]] = o

    unidades: list[dict] = []

    # -- estructural: certeza
    for n in notas:
        unidades.append({
            "id": n["id"], "kind": "footnote", "voice": "richter",
            "voiceSource": "estructural: bloque [Footnote]",
            "annotatesPassage": n["annotatesPassage"],
            "richterNo": None, "richterTitle": None,
            "section": None, "anchorId": None, "url": None,
            "text": n["text"], "nWords": len(n["text"].split()), "flags": [],
        })
    for i in intros:
        unidades.append({
            "id": i["id"], "kind": "section_intro", "voice": "richter",
            "voiceSource": "estructural: entre encabezado de seccion y el proximo pasaje",
            "annotatesPassage": i["precedeAlPasaje"],
            "richterNo": None, "richterTitle": None,
            "section": i["section"], "anchorId": i["anchorId"], "url": None,
            "text": i["text"], "nWords": i["nWords"], "flags": [],
        })
    for p in pasajes:
        unidades.append({
            "id": f"rt-{p['richterNo']:04d}", "kind": "passage", "voice": "leonardo",
            "voiceSource": "estructural: cuerpo de pasaje numerado",
            "annotatesPassage": None,
            "richterNo": p["richterNo"], "richterTitle": p["richterTitle"],
            "section": p["section"], "subsection": p["subsection"],
            "anchorId": p["anchorId"], "url": p["url"],
            "text": p["text"], "nWords": p["nWords"], "flags": [],
        })

    # -- banderas sobre lo que quedo como leonardo
    for u in unidades:
        if u["voice"] == "leonardo":
            u["flags"] = banderas_de(u["text"])

    # -- decisiones humanas, si existen
    n_ov = 0
    for u in unidades:
        o = overrides.get(u["id"])
        if o and o.get("voice") and o["voice"] != u["voice"]:
            u["voice"] = o["voice"]
            u["voiceSource"] = f"revision manual: {o.get('motivo', 'sin motivo')}"
            n_ov += 1

    n_leo = sum(1 for u in unidades if u["voice"] == "leonardo")
    n_ric = sum(1 for u in unidades if u["voice"] == "richter")
    marcadas = [u for u in unidades if u["voice"] == "leonardo" and u["flags"]]
    print(f"unidades            : {len(unidades):>6,}")
    print(f"  voice=leonardo    : {n_leo:>6,}  ({sum(u['nWords'] for u in unidades if u['voice']=='leonardo'):,} palabras)")
    print(f"  voice=richter     : {n_ric:>6,}  ({sum(u['nWords'] for u in unidades if u['voice']=='richter'):,} palabras)")
    print(f"  con bandera       : {len(marcadas):>6,}  (revision dirigida obligatoria)")
    print(f"  overrides humanos : {n_ov:>6,}")

    # ---------------- test de regresion de `14` E1 ----------------
    R = ["# Test de regresion — los pasajes de `14` E1", "",
         "`14` E1 midio 18 pseudo-pasajes con prosa editorial de Richter en primera",
         "persona **sin ninguna marca de cursiva**, y concluyo que un clasificador",
         "tipografico los atribuye a Leonardo. Son la prueba de que la tipografia no",
         "alcanza, asi que se usan como test: ninguna de las frases que E1 cita",
         "textualmente puede sobrevivir como voz de Leonardo y sin bandera.", ""]
    fallos = []
    for frase in E1_FRASES:
        hits = [u for u in unidades if frase.lower() in u["text"].lower()]
        malos = [u for u in hits if u["voice"] == "leonardo" and not u["flags"]]
        R += [f"## `{frase}`", "",
              f"- unidades que la contienen: **{len(hits)}**",
              f"- resueltas como `richter` por estructura: "
              f"**{sum(1 for u in hits if u['voice'] == 'richter')}**",
              f"- quedaron como `leonardo` pero **con bandera**: "
              f"**{sum(1 for u in hits if u['voice'] == 'leonardo' and u['flags'])}**",
              f"- **escapadas** (leonardo y sin bandera): **{len(malos)}**", ""]
        for u in hits:
            estado = ("richter" if u["voice"] == "richter"
                      else f"leonardo + {','.join(u['flags'])}" if u["flags"]
                      else "**ESCAPADA**")
            R.append(f"  - `{u['id']}` ({u['kind']}, {u['nWords']} pal) — {estado}")
        R.append("")
        fallos += malos
    (REPORTS / "voice_regression.md").write_text("\n".join(R) + "\n", encoding="utf-8")

    # ---------------- lista de revision dirigida ----------------
    random.seed(SEMILLA)
    solo_leo = [u for u in unidades if u["voice"] == "leonardo"]
    muestra = random.sample(solo_leo, min(MUESTRA_ALEATORIA, len(solo_leo)))
    ids_marcadas = {u["id"] for u in marcadas}

    V = ["# Revision dirigida de voz (R1)", "",
         "R1 es el riesgo numero uno del proyecto y falla en silencio. Hay que",
         "revisar **el 100% de lo marcado** mas la muestra aleatoria.",
         "",
         "Para corregir una unidad, agregar una linea a `pipeline/review/review_overrides.jsonl`:",
         "",
         '    {"id": "rt-0795", "voice": "richter", "motivo": "prosa editorial de Richter"}',
         "",
         "El pipeline la vuelve a leer, asi que la revision queda versionada y el",
         "parseo sigue siendo reproducible.",
         "",
         f"## Marcadas: {len(marcadas)} unidades", ""]
    for nombre, _ in BANDERAS:
        grupo = [u for u in marcadas if nombre in u["flags"]]
        V += [f"### `{nombre}` — {len(grupo)} unidades", ""]
        for u in grupo:
            frag = " ".join(u["text"].split())[:190]
            V += [f"- **`{u['id']}`** ({u['nWords']} pal · {'+'.join(u['flags'])})",
                  f"  > {frag}", ""]
    V += [f"## Muestra aleatoria de {len(muestra)} (semilla {SEMILLA})", "",
          "Sirve para estimar la tasa de error en lo que NO tiene bandera. `14` E1",
          "advierte que una muestra de 100 sobre ~1.500 tiene ~68% de probabilidad de",
          "no encontrar ninguno de los 18 casos: es complemento, no defensa principal.",
          ""]
    for u in muestra:
        marca = " · YA MARCADA" if u["id"] in ids_marcadas else ""
        V += [f"- **`{u['id']}`** ({u['nWords']} pal{marca})",
              f"  > {' '.join(u['text'].split())[:190]}", ""]
    (REPORTS / "voice_flags.md").write_text("\n".join(V) + "\n", encoding="utf-8")

    if not ruta_ov.exists():
        ruta_ov.write_text(
            '{"id": "ejemplo-borrar-esta-linea", "voice": "richter", '
            '"motivo": "plantilla; el pipeline ignora los ids que no existen"}\n',
            encoding="utf-8")

    escribir_jsonl(OUT / "units.jsonl", unidades)
    print(f"\nregresion -> {REPORTS / 'voice_regression.md'}")
    print(f"revision  -> {REPORTS / 'voice_flags.md'}")

    if fallos:
        print(f"\nFALLO: {len(fallos)} unidades con prosa editorial de Richter "
              f"quedaron como voz de Leonardo y sin bandera:", file=sys.stderr)
        for u in fallos[:10]:
            print(f"  {u['id']}: {' '.join(u['text'].split())[:150]}", file=sys.stderr)
        raise FalloDeControl(
            "el test de regresion de `14` E1 no pasa: las banderas no estan terminadas")

    print("test de regresion de `14` E1: pasa")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
