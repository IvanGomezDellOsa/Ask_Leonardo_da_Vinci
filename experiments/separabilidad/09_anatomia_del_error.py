"""
¿Que TIPO de consulta rompe el umbral?

Si las que se cuelan fueran todas del mismo tipo, una regla explicita las
saca del camino y el gate solo tiene que cubrir el resto. Si estan repartidas
parejo entre todos los tipos, no hay atajo y el gate tiene que mejorar si o si.

Agrupa las 95 consultas 'fuera' en categorias puestas a mano y mide el coseno
por categoria, con el umbral por idioma de 04 como referencia.
"""

import json
import sys
from pathlib import Path

import numpy as np

from consultas import TODAS

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AQUI = Path(__file__).parent
DATA = AQUI / "data"
RES = AQUI / "resultados"

TAU = {"es": 0.8017, "en": 0.8592}   # los umbrales optimos medidos en 04

# categorias de las consultas 'fuera', por palabra clave en la consulta
CATEGORIAS = [
    ("obra famosa",   ["mona lisa", "gioconda", "salvator", "última cena", "last supper",
                       "sistine", "sixtina", "michelangelo", "miguel ángel", "rafael",
                       "raphael"]),
    ("biografia",     ["salai", "salaì", "hijos", "children", "casaste", "married",
                       "padre", "father", "juzgaron", "trial", "enterrado", "buried",
                       "moriste", "die of", "edad tenías", "old were you", "muerte",
                       "death", "enamorado", "in love"]),
    ("politica",      ["elecciones", "election", "presidente", "president", "ucrania",
                       "ukraine", "unión europea", "european union", "migratoria",
                       "immigration"]),
    ("tecnologia",    ["internet", "criptomoneda", "cryptocurrency", "teléfono",
                       "smartphone", "phone", "red social", "social network",
                       "inteligencia artificial", "artificial intelligence", "vacuna",
                       "vaccine", "auto me conviene", "car should", "marte", "mars",
                       "luna" , "moon", "cambio climático", "climate change"]),
    ("deporte",       ["mundial", "world cup", "messi", "maradona", "tenis", "tennis",
                       "olímpicos", "olympic", "fútbol", "football"]),
    ("vida moderna",  ["película", "film", "pizza", "netflix", "serie", "alquiler",
                       "rent", "impuestos", "tax", "pasaje de avión", "plane ticket",
                       "weather"]),
]


def categorizar(txt: str) -> str:
    t = txt.lower()
    for nombre, claves in CATEGORIAS:
        if any(c in t for c in claves):
            return nombre
    return "sin clasificar"


def main():
    pasajes = [json.loads(l) for l in (DATA / "pasajes.jsonl").open(encoding="utf-8")]
    z = np.load(DATA / "emb_cache.npz", allow_pickle=True)
    sim = z["emb_con"] @ z["emb_pas"].T
    cos = sim.max(axis=1)
    idx = sim.argmax(axis=1)

    filas = []
    for i, (g, idi, txt, _) in enumerate(TODAS):
        if g != "fuera":
            continue
        filas.append({"cat": categorizar(txt), "idi": idi, "cos": cos[i],
                      "txt": txt, "cuela": cos[i] >= TAU[idi], "j": idx[i]})

    L = ["=" * 78, "ANATOMIA DEL ERROR — que tipo de consulta 'fuera' se cuela", "=" * 78,
         f"umbral por idioma: es={TAU['es']:.4f}  en={TAU['en']:.4f}",
         f"consultas 'fuera': {len(filas)}", "",
         f"  {'categoria':16s} {'n':>3}  {'se cuelan':>10}  {'cos medio':>10}  {'cos max':>8}",
         "  " + "-" * 56]

    cats = sorted({f["cat"] for f in filas},
                  key=lambda c: -np.mean([f["cuela"] for f in filas if f["cat"] == c]))
    total_cuela = 0
    for c in cats:
        sub = [f for f in filas if f["cat"] == c]
        cuelan = sum(f["cuela"] for f in sub)
        total_cuela += cuelan
        L.append(f"  {c:16s} {len(sub):3d}  {cuelan:4d} ({cuelan / len(sub):4.0%})"
                 f"  {np.mean([f['cos'] for f in sub]):10.4f}"
                 f"  {max(f['cos'] for f in sub):8.4f}")
    L.append("  " + "-" * 56)
    L.append(f"  {'TOTAL':16s} {len(filas):3d}  {total_cuela:4d} ({total_cuela / len(filas):4.0%})")
    L.append("")

    L.append("--- las que se cuelan, una por una ---")
    for f in sorted([f for f in filas if f["cuela"]], key=lambda f: -f["cos"]):
        L.append(f"  {f['cos']:.4f} [{f['idi']}/{f['cat']:14s}] {f['txt']}")
        L.append(f"          -> R-{pasajes[f['j']]['num']}: {pasajes[f['j']]['texto'][:120]}")
    L.append("")

    # que pasaria si una lista curada saca 'obra famosa' + 'biografia'
    curable = {"obra famosa", "biografia"}
    resto = [f for f in filas if f["cat"] not in curable]
    sacadas = [f for f in filas if f["cat"] in curable]
    L += ["-" * 78,
          "SI UNA LISTA CURADA RESUELVE 'obra famosa' + 'biografia'",
          "-" * 78,
          f"  esas dos categorias son {len(sacadas)} de {len(filas)} consultas 'fuera'"
          f" ({len(sacadas) / len(filas):.0%})",
          f"  y aportan {sum(f['cuela'] for f in sacadas)} de las {total_cuela} filtraciones"
          f" ({sum(f['cuela'] for f in sacadas) / max(total_cuela, 1):.0%})",
          f"  al gate le quedarian {len(resto)} consultas 'fuera',"
          f" con {sum(f['cuela'] for f in resto)} filtraciones"
          f" ({sum(f['cuela'] for f in resto) / len(resto):.0%})"]

    texto = "\n".join(L)
    (RES / "anatomia_del_error.txt").write_text(texto + "\n", encoding="utf-8")
    print(texto)


if __name__ == "__main__":
    main()
