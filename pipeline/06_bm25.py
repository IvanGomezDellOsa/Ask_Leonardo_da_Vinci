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

Salida: artifacts/bm25.json     —  el corpus ingles de Richter
        artifacts/es/bm25.json  —  la traduccion castellana (D-226)

POR QUE HAY DOS. Hasta D-226 habia uno solo, en ingles, y el indice castellano
lo reusaba. Medido, eso no era "aporta poco cross-lingue" como decia el
comentario de `retrieval.ts`: era **aporta exactamente cero**. El vocabulario son
15.252 terminos ingleses y ni "colores" ni "pintura" ni "agua" estan. Los RRF de
una consulta castellana daban 1/61, 1/62, 1/63 — la serie exacta del ranking
denso, o sea BM25 sumando 0 en las tres posiciones.

La mitad lexica de la busqueda hibrida no existia en castellano. Ahora existe.

⚠ EL ORDEN DE LAS FILAS ES EL CONTRATO. `puntuarBm25` devuelve indices que
`buscar` usa DIRECTAMENTE como filas del indice denso. Los dos artefactos se
construyen recorriendo `chunks.json` en su orden, que es el mismo con el que
`indexar.ts` arma los dos indices; la funcion `verificar_alineacion` lo
comprueba contra `index_meta.json` y aborta si se rompio.
"""

from __future__ import annotations

import json
import math
import re
import sys
import unicodedata
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

# Stopwords del castellano. Mismo criterio que la inglesa: corta a proposito,
# porque los pasajes de menos de 15 palabras son los que mas dependen del lexico.
STOP_ES = set(
    "el la los las un una unos unas de del al a en con por para sin sobre tras "
    "y o u e ni que quien quienes cual cuales cuyo cuya como cuando donde "
    "es son era eran fue fueron ser sido siendo estar esta estan este esta estos "
    "estas ese esa esos esas aquel aquella lo le les se su sus mi mis tu tus "
    "yo tu el ella nosotros vosotros ellos ellas me te nos os "
    "no si mas menos muy mucho muchos poco pocos todo todos toda todas otro "
    "otra otros otras mismo misma tan tanto ya pero aunque porque pues "
    "hay ha han he has habia hacer hace hecho puede pueden".split())


def tokenizar(texto: str) -> list[str]:
    """Minusculas, sin acentos raros, sin numeros sueltos.

    No se hace stemming: en un corpus de 170.000 palabras el ahorro es marginal
    y un stemmer mal elegido junta terminos que en Leonardo significan cosas
    distintas ("light" / "lighting" pasa, "sole" / "sol" no).
    """
    return [t for t in RE_TOKEN.findall(texto.lower())
            if t not in STOP and len(t) > 1]


def tokenizar_es(texto: str) -> list[str]:
    """Igual, pero DESPOJANDO ACENTOS ANTES de partir.

    ⚠ Tiene que ser identico a `Corpus.tokenizar` de `retrieval.ts`, que hace
    `normalize("NFD")` y saca las marcas combinantes. Sin esto, la regex `[a-z]`
    parte "cómo" en "c" + "mo" y el indice se llena de tokens basura que ademas
    no matchean con los de la consulta. Es el mismo defecto que ya se corrigio
    del lado de la consulta y que aca habria reaparecido del lado del indice.
    """
    plano = unicodedata.normalize("NFD", texto.lower())
    plano = "".join(c for c in plano if not unicodedata.combining(c))
    return [t for t in RE_TOKEN.findall(plano)
            if t not in STOP_ES and len(t) > 1]


def construir(docs: list[list[str]], ids: list[str], stopwords: set[str],
              destino, etiqueta: str) -> dict:
    """La matematica del BM25, una sola vez para los dos idiomas.

    Recibe los documentos YA tokenizados porque es lo unico que cambia entre
    idiomas: el resto —idf de Robertson, poda del 60%, forma del artefacto— es
    identico y duplicarlo seria pedir que se desincronicen.
    """
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
        "ids": ids,
        "idf": {t: round(v, 5) for t, v in idf.items()},
        "postings": {t: {"docs": p[0], "tfs": p[1]} for t, p in postings.items()},
        "stopwords": sorted(stopwords),
        "prunedTerms": sorted(frecuentes),
    }
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(artefacto, ensure_ascii=False), encoding="utf-8")
    tam = destino.stat().st_size

    print(f"[{etiqueta}] documentos {n:>6,} · terminos {len(postings):>6,} "
          f"(podados {len(frecuentes)}) · postings "
          f"{sum(len(p[0]) for p in postings.values()):>8,} · "
          f"largo medio {promedio:>5.1f} · {tam/1024:>6.0f} KB")
    return {"n": n, "terminos": len(postings), "kb": tam / 1024,
            "promedio": promedio, "podados": frecuentes}


def verificar_alineacion(ids: list[str], meta_path) -> None:
    """⚠ EL CONTRATO QUE NADIE COMPROBABA HASTA D-226.

    `buscar` usa los indices que devuelve `puntuarBm25` DIRECTAMENTE como filas
    del indice denso. Si `bm25.ids` deja de coincidir con `index_meta.ids` en
    las primeras `count` posiciones, cada score lexico se le atribuye a otro
    pasaje **en silencio**: no hay excepcion, solo resultados peores.

    Es exactamente el fallo que D-211 arreglo del lado denso, en el lado que
    quedo sin arreglar.
    """
    if not meta_path.exists():
        print(f"    (sin {meta_path.name}: no se puede verificar la alineacion)")
        return
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    mal = [i for i, x in enumerate(meta["ids"]) if ids[i] != x]
    if mal:
        raise SystemExit(
            f"ALINEACION ROTA con {meta_path}: {len(mal)} filas no coinciden "
            f"(primera: fila {mal[0]}, bm25 dice '{ids[mal[0]]}' y el indice "
            f"'{meta['ids'][mal[0]]}'). Reindexar o regenerar el corpus.")
    print(f"    alineacion contra {meta_path.parent.name}/{meta_path.name}: "
          f"{len(meta['ids'])} filas, todas coinciden")


def main() -> int:
    utf8_stdout()
    asegurar_carpetas()

    # -- ingles: el corpus de Richter, tal como estaba
    chunks = leer_jsonl(OUT / "chunks.jsonl")
    ids = [c["id"] for c in chunks]
    en = construir([tokenizar(c["embedText"]) for c in chunks], ids, STOP,
                   ARTIFACTS / "bm25.json", "en")
    verificar_alineacion(ids, ARTIFACTS / "index_meta.json")

    # -- castellano: mismo orden de filas, texto de la traduccion (D-226)
    #
    # ⚠ NO SE GENERA POR DEFECTO, Y NO ES UN OLVIDO. Construido y medido, el
    # BM25 castellano EMPEORA el recall: categoria A pasa de 1 a 2 fallos y B de
    # 9 a 11. Desplaza del top-3 pasajes correctos que el denso ya tenia —"The
    # effects of morning light", "The function of the eye", "A caution against
    # one-sided study"— a favor de otros con coincidencia lexica generica.
    #
    # Que arregla, y por eso el generador se queda: la consulta real "como
    # elegias los colores en tus cuadros" pasa de traer tres pasajes sobre LUZ a
    # traer tres sobre COLOR, uno de ellos desde el puesto denso 11. El
    # problema es real y la herramienta funciona; el saldo medido, hoy, es
    # negativo.
    #
    # Se regenera con `python pipeline/06_bm25.py --es` para volver a medirlo
    # DESPUES de arreglar los titulos (D-224), que es lo que lo puede dar vuelta.
    if "--es" not in sys.argv:
        print("\n(BM25 castellano: no se genera. Medido, empeora el recall - D-226.")
        print(" Para volver a medirlo: python pipeline/06_bm25.py --es)")
        return 0

    ruta_es = ARTIFACTS / "chunks_es.json"
    if not ruta_es.exists():
        print("\nsin chunks_es.json: no se genera el BM25 castellano")
        return 0

    trad = json.loads(ruta_es.read_text(encoding="utf-8"))
    faltan = [i for i in ids if i not in trad]
    docs_es = []
    for i in ids:
        t = trad.get(i)
        if t is None:
            docs_es.append([])
            continue
        # CON el titulo, igual que el denso (D-025). Se midieron las dos: sin
        # titulo el recall de categoria A empeora MAS (1 -> 4 fallos contra
        # 1 -> 2). La hipotesis de que los titulos falsos envenenarian el lexico
        # es razonable y esta REFUTADA por medicion (D-226).
        titulo = (t.get("titulo") or "").strip()
        docs_es.append(tokenizar_es(f"{titulo}. {t['texto']}" if titulo else t["texto"]))
    es = construir(docs_es, ids, STOP_ES, ARTIFACTS / "es" / "bm25.json", "es")
    verificar_alineacion(ids, ARTIFACTS / "es" / "index_meta.json")
    if faltan:
        print(f"    ⚠ {len(faltan)} chunks sin traduccion: quedan como documento vacio")

    rep = ["# Reporte de los indices BM25", "",
           "| | documentos | terminos | largo medio | tamano |",
           "|---|---:|---:|---:|---:|",
           f"| ingles (`bm25.json`) | {en['n']:,} | {en['terminos']:,} | "
           f"{en['promedio']:.1f} | {en['kb']:.0f} KB |",
           f"| castellano (`es/bm25.json`) | {es['n']:,} | {es['terminos']:,} | "
           f"{es['promedio']:.1f} | {es['kb']:.0f} KB |", "",
           f"- `k1={K1}`, `b={B}` · podados por aparecer en mas del 60% de los",
           f"  documentos: {len(en['podados'])} en ingles, {len(es['podados'])} en castellano",
           "",
           "Se indexa el mismo texto que se embebe (`richterTitle + text`), para que",
           "las dos mitades de la busqueda hibrida vean lo mismo.",
           "",
           "> **Hasta D-226 el castellano no tenia el suyo** y reusaba el ingles, donde",
           "> ninguna palabra castellana existe: la mitad lexica de la busqueda hibrida",
           "> aportaba exactamente cero. Los RRF daban 1/61, 1/62, 1/63.",
           "",
           "> **El BM25 solo ordena.** Nunca se umbraliza sobre su score: no es "
           "comparable entre consultas (D-021). Quien decide es el coseno denso.", ""]
    (REPORTS / "bm25_report.md").write_text("\n".join(rep) + "\n", encoding="utf-8")
    print(f"\nartefactos -> {ARTIFACTS / 'bm25.json'}\n"
          f"              {ARTIFACTS / 'es' / 'bm25.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
