"""06 — Precomputa el indice BM25 y lo emite como artefacto.

`03` declara como principio rector "todo lo que se pueda precomputar se
precomputa offline", y despues proponia construir el BM25 en TypeScript en cada
arranque. Tokenizar ~170.000 palabras por cold start cuesta 1-2 s de CPU, y
Vercel Hobby da 4 CPU-hours/mes (D-030, R17).

El BM25 solo ORDENA el top-k que va al prompt. Nunca se umbraliza sobre el: sus
scores no son comparables entre consultas, y esta medido — "how should one study
anatomy" (dentro del corpus) puntua 8,94 y "what do you think about the Mona
Lisa" (fuera) puntua 13,14 con un resultado basura. Quien decide es el coseno
denso, pre-fusion (D-021).

Se indexa el mismo texto que se embebe (`richterTitle + text`), para que las dos
mitades de la busqueda hibrida vean lo mismo.

Salida: artifacts/bm25.json  —  postings, df, longitudes y promedio.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict

from common import ARTIFACTS, OUT, REPORTS, asegurar_carpetas, leer_jsonl, utf8_stdout

K1, B = 1.5, 0.75

# Stopwords del ingles. El corpus esta en el ingles de Richter, asi que la lista
# es corta a proposito: sacar demasiado perjudica a los pasajes cortos, que son
# justo los que mas necesitan el lexico (178 pasajes de menos de 15 palabras).
STOP = set(
    "a an the and or but if of to in on at by for with from as is are was were "
    "be been being it its this that these those there here which who whom whose "
    "what when where why how all any both each few more most other some such no "
    "nor not only own same so than too very can will just should now".split())

RE_TOKEN = re.compile(r"[a-z][a-z'\-]*")


def tokenizar(texto: str) -> list[str]:
    """Minusculas, sin acentos raros, sin numeros sueltos.

    No se hace stemming: en un corpus de 170.000 palabras el ahorro es marginal
    y un stemmer mal elegido junta terminos que en Leonardo significan cosas
    distintas ("light" / "lighting" pasa, "sole" / "sol" no).
    """
    return [t for t in RE_TOKEN.findall(texto.lower())
            if t not in STOP and len(t) > 1]


def main() -> int:
    utf8_stdout()
    asegurar_carpetas()

    chunks = leer_jsonl(OUT / "chunks.jsonl")
    docs = [tokenizar(c["embedText"]) for c in chunks]
    longitudes = [len(d) for d in docs]
    promedio = sum(longitudes) / len(longitudes)

    postings: dict[str, list[list[int]]] = defaultdict(lambda: [[], []])
    for i, d in enumerate(docs):
        for termino, tf in Counter(d).items():
            postings[termino][0].append(i)
            postings[termino][1].append(tf)

    # idf de Robertson con el ajuste habitual, precomputado: la funcion no
    # cambia entre consultas y calcularla en el runtime es trabajo repetido
    n = len(docs)
    idf = {t: math.log(1 + (n - len(p[0]) + 0.5) / (len(p[0]) + 0.5))
           for t, p in postings.items()}

    # Los terminos que aparecen en casi todos los documentos no discriminan y
    # solo engordan el artefacto. Se podan por encima del 60% de los documentos.
    frecuentes = [t for t, p in postings.items() if len(p[0]) > 0.6 * n]
    for t in frecuentes:
        del postings[t], idf[t]

    artefacto = {
        "k1": K1, "b": B, "docCount": n, "avgDocLength": round(promedio, 3),
        "docLengths": longitudes,
        "ids": [c["id"] for c in chunks],
        "idf": {t: round(v, 5) for t, v in idf.items()},
        "postings": {t: {"docs": p[0], "tfs": p[1]} for t, p in postings.items()},
        "stopwords": sorted(STOP),
        "prunedTerms": sorted(frecuentes),
    }
    ruta = ARTIFACTS / "bm25.json"
    ruta.write_text(json.dumps(artefacto, ensure_ascii=False), encoding="utf-8")
    tam = ruta.stat().st_size

    df = sorted((len(p[0]) for p in postings.values()), reverse=True)
    print(f"documentos            : {n:>7,}")
    print(f"terminos              : {len(postings):>7,}   (podados {len(frecuentes)})")
    print(f"postings              : {sum(len(p[0]) for p in postings.values()):>7,}")
    print(f"longitud media        : {promedio:>7.1f} tokens")
    print(f"bm25.json             : {tam/1024:>7.0f} KB")

    rep = ["# Reporte del indice BM25", "",
           f"- Documentos: **{n:,}** · terminos: **{len(postings):,}** · "
           f"postings: {sum(len(p[0]) for p in postings.values()):,}",
           f"- Longitud media: {promedio:.1f} tokens · `k1={K1}`, `b={B}`",
           f"- `bm25.json`: **{tam/1024:.0f} KB**",
           f"- Terminos podados por aparecer en mas del 60% de los documentos: "
           f"{len(frecuentes)} {frecuentes[:10]}",
           "",
           "Se indexa el mismo texto que se embebe (`richterTitle + text`), para que",
           "las dos mitades de la busqueda hibrida vean lo mismo.",
           "",
           "> **El BM25 solo ordena.** Nunca se umbraliza sobre su score: no es "
           "comparable entre consultas (D-021). Quien decide es el coseno denso.", ""]
    (REPORTS / "bm25_report.md").write_text("\n".join(rep) + "\n", encoding="utf-8")
    print(f"\nartefacto -> {ruta}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
