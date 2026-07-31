"""
Extrae los cuerpos de pasaje de PG #5000 (Richter, 1888).

Pasos:
  1. Recorta entre los marcadores *** START / *** END de Project Gutenberg.
  2. Elimina los bloques [Footnote: ...] (notas del editor Richter, no de Leonardo).

     Nota sobre el metodo: el texto tiene corchetes genuinamente desbalanceados
     (1.516 "[" contra 1.605 "]" entre START y END), asi que emparejar corchetes
     contando profundidad NO funciona: produce bloques de 38k y 75k caracteres que
     se tragan pasajes enteros de Leonardo y eliminan 160 lineas de numeracion.
     El patron plano `\[Footnote[^\[\]]*\]` da exactamente los 864 bloques
     esperados y conserva las 1.565 lineas de numeracion. Quedan 17 notas con
     corchetes anidados dentro (p. ej. "_ochio_ [eye]"), que se limpian en una
     segunda pasada acotada: nunca cruza el limite del pasaje siguiente.
  3. Segmenta por las lineas que contienen solo "N." (numeracion de Richter).
     El cuerpo de cada pasaje es el texto entre un numero y el siguiente.
  4. Descarta los pasajes de menos de 8 palabras.

Salida: data/pasajes.jsonl  (uno por linea: {num, n_palabras, texto})
"""

import json
import re
from pathlib import Path

AQUI = Path(__file__).parent
DATA = AQUI / "data"

MIN_PALABRAS = 8


def recortar_gutenberg(texto: str) -> str:
    inicio = re.search(r"^\*\*\* START OF THE PROJECT GUTENBERG EBOOK.*\*\*\*$", texto, re.M)
    fin = re.search(r"^\*\*\* END OF THE PROJECT GUTENBERG EBOOK.*\*\*\*$", texto, re.M)
    if not inicio or not fin:
        raise RuntimeError("no se encontraron los marcadores START/END de Gutenberg")
    return texto[inicio.end() : fin.start()]


# la numeracion de Richter: una linea que contiene solo "N."
RE_NUMERO = re.compile(r"^[ \t]*(\d+)\.[ \t]*$", re.M)

# bloque de nota plano: sin ningun corchete adentro
RE_FOOTNOTE = re.compile(r"\[Footnote[^\[\]]*\]", re.S)


def quitar_footnotes(texto: str) -> tuple[str, int, int]:
    """Elimina los bloques [Footnote ...] en dos pasadas.

    Devuelve (texto_limpio, n_bloques_planos, n_restos_anidados).
    """
    planos = len(RE_FOOTNOTE.findall(texto))
    texto = RE_FOOTNOTE.sub(" ", texto)

    # Segunda pasada: notas con corchetes anidados. Se corta en el "]" mas lejano
    # que quede ANTES del proximo limite de pasaje, para no invadir texto util.
    anidados = 0
    while True:
        m = re.search(r"\[Footnote", texto)
        if m is None:
            break
        ini = m.start()
        sig = RE_NUMERO.search(texto, ini)
        tope = sig.start() if sig else len(texto)
        cierre = texto.rfind("]", ini, tope)
        if cierre == -1:  # nada que cerrar dentro del pasaje: solo la marca
            texto = texto[:ini] + " " + texto[ini + len("[Footnote"):]
        else:
            texto = texto[:ini] + " " + texto[cierre + 1:]
        anidados += 1
    return texto, planos, anidados


def segmentar(texto: str) -> list[dict]:
    marcas = list(RE_NUMERO.finditer(texto))
    pasajes = []
    for idx, m in enumerate(marcas):
        fin = marcas[idx + 1].start() if idx + 1 < len(marcas) else len(texto)
        cuerpo = texto[m.end() : fin]
        cuerpo = re.sub(r"[ \t]*\n[ \t]*", " ", cuerpo)  # colapsar saltos de linea
        cuerpo = re.sub(r"\s+", " ", cuerpo).strip()
        pasajes.append({"num": int(m.group(1)), "orden": idx, "texto": cuerpo})
    return pasajes


def main() -> None:
    crudo = (DATA / "pg5000.txt").read_text(encoding="utf-8")
    print(f"archivo crudo:            {len(crudo):>9,} caracteres")

    cuerpo = recortar_gutenberg(crudo)
    print(f"entre START y END:        {len(cuerpo):>9,} caracteres")

    sin_notas, n_planos, n_anidados = quitar_footnotes(cuerpo)
    print(f"bloques [Footnote] planos:{n_planos:>9,}   (esperados 864)")
    print(f"restos con anidamiento:   {n_anidados:>9,}")
    print(f"texto sin notas:          {len(sin_notas):>9,} caracteres")

    marcas = len(RE_NUMERO.findall(sin_notas))
    print(f"lineas de numeracion:     {marcas:>9,}")

    pasajes = segmentar(sin_notas)
    for p in pasajes:
        p["n_palabras"] = len(p["texto"].split())

    utiles = [p for p in pasajes if p["n_palabras"] >= MIN_PALABRAS]
    print(f"pasajes >= {MIN_PALABRAS} palabras:  {len(utiles):>9,}  (de {len(pasajes):,})")

    destino = DATA / "pasajes.jsonl"
    with destino.open("w", encoding="utf-8") as f:
        for p in utiles:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"escrito -> {destino}")


if __name__ == "__main__":
    main()
