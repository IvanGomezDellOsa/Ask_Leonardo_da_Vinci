"""02 — Parseo estructural de PG #5000 (Richter, 1888) desde el HTML.

Que extrae:
    - los pasajes numerados, con su ancla id para la URL de citacion
    - los titulos tematicos de Richter (D-025), propagados al rango que cubren
    - las notas al pie, con annotatesPassage (D-042)
    - la jerarquia seccion / subseccion

Tres cosas medidas sobre el archivo que contradicen la documentacion y que
gobiernan el diseno de este script:

 1. En el HTML las notas al pie NO son parrafo propio. `14` O2 y D-024 dicen
    que si. Medido: de los 881 marcadores `[Footnote`, solo 455 abren un bloque;
    366 estan inline en medio del texto del pasaje y 41 no cierran dentro de su
    propio bloque. Los corchetes estan igual de desbalanceados que en el .txt
    (1.516 `[` contra 1.605 `]`), asi que la trampa de D-043 aplica identica:
    emparejar por profundidad se traga pasajes enteros en silencio. Se usa el
    patron plano, que da exactamente los 864 bloques de control.

 2. Los 651 titulos de Richter no son los <h5>. Los 826 <h5> son numerales
    romanos, titulos de seccion y —sobre todo— los encabezados en mayusculas que
    escribio el propio Leonardo en sus manuscritos ("OF PAINTING."), que van
    DENTRO del cuerpo del pasaje. Los titulos de Richter son parrafos <p> en
    caja mixta inmediatamente anteriores a una linea de numeracion, sin ninguna
    marca tipografica que los distinga de un pasaje corto de Leonardo.

    Como no hay senal tipografica, el titulo se resuelve con dos fuentes:

    a) El INDICE DE CONTENIDOS del Volumen I, que lista cada titulo con su rango
       de pasajes ("Of representing the emotions (584)"). Parseado da 219
       entradas que cubren los pasajes 1..702 sin un solo hueco: es fuente
       autoritativa, no heuristica. El Volumen II no tiene indice.

    b) Para el Volumen II, una regla medida contra (a): un titulo de Richter es
       un sintagma nominal —no lleva verbo conjugado— y es corto. Medida sobre
       el Volumen I contra el indice: precision 87%, recall 98%. Toda decision
       del Volumen II queda listada en reports/titulos_volumen2.txt para
       revision, porque ahi la regla corre sin red.

 3. La numeracion hay que detectarla a nivel de LINEA, no de bloque: hay 1.544
    bloques que son solo "N." pero 1.563 lineas, porque el HTML de Gutenberg
    envuelve las lineas del .txt sin reestructurarlas y algunos numeros quedan
    pegados al final de una linea de nota.

Salidas:
    out/passages.jsonl   out/footnotes.jsonl   out/titles.jsonl   out/toc.jsonl
    reports/parse_report.md
    reports/footnotes_multibloque.txt   las notas que cruzan bloques, enteras
    reports/numeracion_residuo.txt      los numeros que estan en el .txt y no aca
    reports/titulos_volumen2.txt        los titulos sin indice que los respalde
"""

from __future__ import annotations

import difflib
import re
import sys
from collections import Counter

from bs4 import BeautifulSoup

from common import (HTML, OUT, REPORTS, TXT, URL_BASE, FalloDeControl,
                    asegurar_carpetas, escribir_jsonl, utf8_stdout, verificar)

# --------------------------------------------------------------------------
# conteos de control (medidos; D-043 y `10`)
# --------------------------------------------------------------------------
CTRL_NOTAS = 864
CTRL_NUMERACION = 1565
CTRL_PASAJES_8 = 1504
CTRL_TITULOS = 651
MIN_PALABRAS = 8

BLOQUES = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "li"]

# Centinela de fin de bloque en el area de uso privado de Unicode: no aparece
# en el corpus y sobrevive a los regex de limpieza.
S_A, S_B = "", ""
RE_SENT = re.compile(f"{S_A}(\\d+){S_B}")

RE_NUM_LINEA = re.compile(r"(?m)^[ \t]*(\d+)\.[ \t]*$")
RE_SOLO_NUM = re.compile(r"^\s*(\d+)\.\s*$")
RE_FOOTNOTE_PLANA = re.compile(r"\[Footnote[^\[\]]*\]", re.S)

# Marcas de proteccion de corchetes que NO son notas al pie (ver quitar_notas).
P_A, P_B = "", ""
RE_PROT = re.compile(f"{P_A}(\\d+){P_B}")
RE_MARCADOR = re.compile(r"\[\s*\*?\d+\s*\]")                     # [*65], [13]
RE_INSERCION = re.compile(r"\[(?!Footnote)[^\[\]]{1,60}\]", re.S)
# Algunos encabezados de seccion conservan el guion bajo del .txt que el
# generador de HTML de Gutenberg no limpio: `<h5 id="id02565">_X.</h5>`. Sin
# tolerarlo, la seccion X queda sin detectar y su introduccion entera —prosa de
# Richter en primera persona— se queda dentro del cuerpo de R-662.
RE_ROMANO = re.compile(r"^\s*[_*]*([IVXLC]+)\.?[_*]*\s*$")

# Siglas de manuscrito que Richter deja sueltas al final de un pasaje
# ("C.A. 94b; 271b]", "W. XXIII.]"). No son titulos.
RE_SIGLA = re.compile(
    r"^(C\.\s?A\.|W\.|Br\.\s?M\.|Ash\.|Tr\.|S\.\s?K\.\s?M\.|Mss?\.|MS\.|"
    r"Cod\.|L\.|H\.|G\.|F\.|E\.|K\.|M\.|I\.)\s*[IVXLC0-9]",
    re.I)


# --------------------------------------------------------------------------
# 1. bloques
# --------------------------------------------------------------------------

def cargar_bloques() -> list[dict]:
    """Bloques de nivel de parrafo, en orden de documento, entre START y END."""
    crudo = HTML.read_text(encoding="utf-8")
    try:
        ini = crudo.index("*** START OF THE PROJECT GUTENBERG")
        fin = crudo.index("*** END OF THE PROJECT GUTENBERG")
    except ValueError as e:
        raise FalloDeControl("no se encontraron los marcadores START/END") from e

    sopa = BeautifulSoup(crudo[ini:fin], "html.parser")
    bloques = []
    for i, el in enumerate(sopa.find_all(BLOQUES)):
        # texto con los saltos de linea originales: la numeracion vive en ellos
        bloques.append({
            "i": i,
            "tag": el.name,
            "id": el.get("id"),
            "texto": el.get_text(),
            "italico": sum(len(x.get_text()) for x in el.find_all("i")),
        })
    return bloques


def unir(bloques: list[dict]) -> str:
    return "".join(f"\n{S_A}{b['i']}{S_B}\n{b['texto']}" for b in bloques)


def sin_centinelas(t: str) -> str:
    return RE_SENT.sub(" ", t)


# --------------------------------------------------------------------------
# 2. notas al pie
# --------------------------------------------------------------------------

def _borrar(texto: str, ini: int, fin: int) -> str:
    """Borra [ini, fin) conservando los centinelas que caigan adentro.

    Sin esto, una nota que cruza bloques se llevaria puestos los limites de
    bloque y el resto del parrafo quedaria atribuido al bloque anterior.
    """
    dentro = [m.group(0) for m in RE_SENT.finditer(texto, ini, fin)]
    relleno = " " if not dentro else "\n" + "\n".join(dentro) + "\n"
    return texto[:ini] + relleno + texto[fin:]


def quitar_notas(texto: str) -> tuple[str, list[dict], list[str]]:
    """Elimina las notas de Richter y devuelve lo eliminado.

    Paso 0 — proteger. El corpus usa corchetes para tres cosas distintas:
    864 notas al pie, 182 marcadores de linea (`[*65]`) y 406 inserciones
    editoriales cortas (`[eye]`, `[in a picture]`). Los dos ultimos aparecen
    DENTRO del texto de Leonardo y tambien dentro de las notas, y son los que
    hacen que los corchetes esten desbalanceados (1.516 `[` contra 1.605 `]`).
    Se sustituyen por marcas sin corchetes antes de tocar las notas.

    Sin este paso, la nota de R-1336 (la carta al Diodario de Siria) no cierra
    con el patron plano —su cuerpo tiene marcadores— y cualquier busqueda del
    cierre "mas lejano" se lleva 13.701 caracteres, incluida prosa de Leonardo.
    Es el fallo de D-043 a menor escala, y ocurre igual en el HTML.

    Paso 1 — patron plano `\\[Footnote[^\\[\\]]*\\]`. Cruza bloques a proposito
    (las notas largas ocupan varios <p>) pero ya no puede cruzar un corchete.

    Paso 2 — las notas que el original nunca cierra. Son 7 y son defectos de la
    fuente. Se cierran al llegar al final de su bloque o a la proxima linea de
    numeracion, lo que ocurra primero: nunca se atraviesa un numero de pasaje.
    Quedan listadas para revision.
    """
    notas: list[dict] = []
    alertas: list[str] = []

    # -- paso 0
    protegidos: list[str] = []

    def _guardar(m: re.Match) -> str:
        protegidos.append(m.group(0))
        return f"{P_A}{len(protegidos) - 1}{P_B}"

    texto = RE_MARCADOR.sub(_guardar, texto)
    texto = RE_INSERCION.sub(_guardar, texto)

    def _restaurar(s: str) -> str:
        return RE_PROT.sub(lambda m: protegidos[int(m.group(1))], s)

    def registrar(bruto: str, pos: int, tipo: str) -> None:
        idxs = [int(m.group(1)) for m in RE_SENT.finditer(bruto)]
        bruto = _restaurar(bruto)
        limpio = re.sub(r"\s+", " ", sin_centinelas(bruto)).strip()
        num_adentro = RE_NUM_LINEA.findall(sin_centinelas(bruto))
        notas.append({
            "tipo": tipo,
            "pos": pos,
            "texto": limpio,
            "chars": len(bruto),
            "cruza_bloques": len(idxs) > 0,
            "bloques_cruzados": idxs,
            "numeracion_adentro": num_adentro,
        })

    # -- pasada 1, de atras hacia adelante para no invalidar indices
    spans = [(m.start(), m.end()) for m in RE_FOOTNOTE_PLANA.finditer(texto)]
    n_planas = len(spans)
    for ini, fin in reversed(spans):
        registrar(texto[ini:fin], ini, "plana")
        texto = _borrar(texto, ini, fin)

    # -- pasada 2: las que el original nunca cierra
    n_sin_cerrar = 0
    while True:
        m = re.search(r"\[Footnote", texto)
        if m is None:
            break
        ini = m.start()
        sig_num = RE_NUM_LINEA.search(texto, ini)
        sig_bloque = RE_SENT.search(texto, m.end())
        # el tope es lo mas cercano: nunca se atraviesa un numero de pasaje
        topes = [x.start() for x in (sig_num, sig_bloque) if x]
        fin = min(topes) if topes else len(texto)
        registrar(texto[ini:fin], ini, "sin cerrar")
        texto = _borrar(texto, ini, fin)
        n_sin_cerrar += 1
        if n_sin_cerrar > 100:
            raise FalloDeControl("bucle en la segunda pasada de notas al pie")

    notas.reverse()  # volver al orden del documento
    texto = _restaurar(texto)

    # -- el detector de D-043: ninguna nota puede contener una linea de numeracion
    comiendo = [n for n in notas if n["numeracion_adentro"]]
    if comiendo:
        alertas.append(
            f"{len(comiendo)} notas contienen una linea de numeracion adentro: "
            "se estarian tragando pasajes (ver reports/footnotes_multibloque.txt)")
    enormes = [n for n in notas if n["chars"] > 8000]
    if enormes:
        alertas.append(
            f"{len(enormes)} notas de mas de 8.000 caracteres — la firma del "
            f"fallo de D-043 (mayor: {max(n['chars'] for n in enormes):,} chars)")

    return texto, notas, alertas


# --------------------------------------------------------------------------
# 3. secciones y titulos
# --------------------------------------------------------------------------

def mapa_bloques_limpios(texto: str) -> dict[int, str]:
    """indice de bloque -> su texto ya sin notas, colapsado."""
    partes = RE_SENT.split(texto)
    limpio: dict[int, str] = {}
    # partes = [pre, idx, txt, idx, txt, ...]
    for k in range(1, len(partes) - 1, 2):
        i = int(partes[k])
        limpio[i] = re.sub(r"\s+", " ", partes[k + 1]).strip()
    return limpio


def es_titulo_richter(txt: str) -> bool:
    """Candidato estructural: bloque en caja mixta, corto y sin marcas de aparato.

    Filtra lo que con seguridad NO es un titulo. NO decide todavia: sobre estos
    candidatos corren despues el indice (Vol I) y la regla nominal (Vol II).
    """
    if not txt or RE_SOLO_NUM.match(txt):
        return False
    if not (1 <= len(txt.split()) <= 25):
        return False
    if txt.isupper():                      # encabezado del propio Leonardo o de seccion
        return False
    if not (txt[0].isupper() or txt[0] in "'‘“("):
        return False
    if txt.startswith("[") or txt.endswith("]"):
        return False
    if RE_SIGLA.match(txt):
        return False
    if re.search(r"\b\d+[ab]\b", txt):      # "94b; 271b" — foliacion
        return False
    return True


# Un titulo de Richter es un sintagma nominal: no lleva verbo conjugado.
# Los falsos positivos del detector estructural son, sin excepcion, oraciones
# de Leonardo ("A point is not part of a line", "Perspective is the best guide
# to the art of Painting"). La lista se midio contra el indice del Volumen I.
RE_VERBO = re.compile(
    r"\b(is|are|was|were|be|been|being|will|shall|would|should|must|can|cannot|"
    r"could|may|might|do|does|did|has|have|had|appears?|seems?|becomes?|makes?|"
    r"takes?|gives?|sees?|says?|comes?|goes|lies|falls?|shows?|displays?|"
    r"reaches?|remains?|stands?|occurs?|happens?|receives?|produces?|requires?|"
    r"needs?|looks?|turns?|moves?|strikes?|passes?|serves?|forms?|begins?|"
    r"ends?|holds?|keeps?|let|it)\b", re.I)
RE_RANGO_FIN = re.compile(r"\(\s*\d+[\d\s.,–—-]*\)\s*\.?\s*$")
MAX_PALABRAS_TITULO = 10


def es_sintagma_nominal(txt: str) -> bool:
    if RE_RANGO_FIN.search(txt):    # "(153-157)" — Richter solo lo pone en titulos
        return True
    if len(txt.split()) > MAX_PALABRAS_TITULO:
        return False
    if RE_VERBO.search(txt):
        return False
    return not txt.rstrip().endswith((",", ";", ":"))


def normalizar(s: str) -> str:
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower())
    return " ".join(s.split())


# --------------------------------------------------------------------------
# indice de contenidos del Volumen I — fuente autoritativa de titulo y rango
# --------------------------------------------------------------------------

RE_TOC_RANGO = re.compile(r"\((\d+)\s*(?:--|—|-|\.|,)\s*(\d+)\.?\)|\((\d+)\.?\)")
RE_ALLCAPS = re.compile(r"(?:\b[A-Z][A-Z'’.\-]{2,}\b[ .,:]*){2,}")
RE_ROMANO_INLINE = re.compile(r"\b[IVX]{1,5}\.\s*")


def parsear_indice() -> list[dict]:
    """Titulos del Volumen I con su rango de pasajes, desde el .txt.

    Se parsea el .txt y no el HTML solo porque el indice es un bloque de prosa
    corrida y ahi el marcado no aporta nada. Los rangos se recorren en orden y
    el titulo es el texto que va antes de cada uno: pedir que el rango cierre la
    entrada pierde 14 titulos, porque Richter intercala encabezados de seccion.
    """
    t = TXT.read_text(encoding="utf-8")
    ini = t.index("CONTENTS OF VOLUME I.")
    fin = re.search(r"(?m)^\s*1\.\s*$", t[ini:])
    plano = re.sub(r"\s+", " ", t[ini:ini + fin.start()])

    entradas, pos = [], 0
    for m in RE_TOC_RANGO.finditer(plano):
        bruto = plano[pos:m.start()]
        pos = m.end()
        bruto = re.sub(r"^\s*[.\-—]+\s*", "", bruto)
        bruto = RE_ALLCAPS.sub(" ", bruto)          # encabezados de seccion
        bruto = RE_ROMANO_INLINE.sub(" ", bruto)
        titulo = " ".join(bruto.replace("_", "").split()).strip(" .-—")
        g = m.groups()
        a, b = (int(g[2]), int(g[2])) if g[2] else (int(g[0]), int(g[1]))
        if titulo and a <= b and b - a < 60:
            entradas.append({"titulo": titulo, "desde": a, "hasta": b})
    return entradas


def detectar_secciones(bloques: list[dict], limpio: dict[int, str],
                       primer_num_bloque: int) -> tuple[dict[int, tuple[str, str]], set[int]]:
    """Recorre la jerarquia y devuelve, por bloque, (seccion, subseccion).

    Estructura medida en el cuerpo del libro:
        <h5>XIV.</h5> + <p>Anatomy, Zoology and Physiology.</p>   -> seccion
        <h5>I.</h5>   + <h5>ANATOMY.</h5>                          -> subseccion

    El indice de contenidos usa la segunda forma tambien, asi que se ignora
    todo lo anterior al primer pasaje numerado.
    """
    vigente: dict[int, tuple[str, str]] = {}
    consumidos: set[int] = set()
    seccion = "Prolegomena and General Introduction to the Book on Painting"
    subseccion = ""

    for k, b in enumerate(bloques):
        i = b["i"]
        txt = limpio.get(i, "")
        if i >= primer_num_bloque and b["tag"] in ("h1", "h5") and RE_ROMANO.match(txt):
            # buscar el siguiente bloque con texto
            j = k + 1
            while j < len(bloques) and not limpio.get(bloques[j]["i"], ""):
                j += 1
            if j < len(bloques):
                sig, stxt = bloques[j], limpio[bloques[j]["i"]]
                if stxt.isupper():
                    subseccion = stxt.rstrip(".")
                    consumidos.update({i, sig["i"]})
                elif es_titulo_richter(stxt):
                    seccion = stxt.rstrip(".")
                    subseccion = ""
                    consumidos.update({i, sig["i"]})
        vigente[i] = (seccion, subseccion)
    return vigente, consumidos


# --------------------------------------------------------------------------
# 4. segmentacion
# --------------------------------------------------------------------------

def filtrar_numeracion(lineas: list[re.Match]) -> tuple[list[re.Match], list[int]]:
    """Separa los numeros de pasaje de las lineas que solo parecen serlo.

    No toda linea que dice "N." es un numero de pasaje. Hay anios sueltos
    ("1478."), importes de las cuentas de Leonardo ("725.") y referencias
    cruzadas a otros pasajes ("1489."), todos en su propia linea. `14` O3 ya lo
    habia medido: 31 transiciones no consecutivas. Sin filtrarlas aparecen
    pasajes fantasma —R-3046 y R-57000, ambos de cero palabras— y se parten
    pasajes reales por la mitad.

    Richter numera 1..1566 en orden estricto, asi que la numeracion verdadera es
    la subsecuencia creciente mas larga. Se resuelve exacto y sin ningun umbral;
    un maximo corriente no sirve, porque una referencia cruzada alta que entre
    temprano rechaza todo lo que viene despues.
    """
    validas = [(i, int(m.group(1))) for i, m in enumerate(lineas)
               if 1 <= int(m.group(1)) <= CTRL_NUMERACION + 1]

    # LIS estricta por parches de paciencia, O(n log n)
    import bisect
    colas: list[int] = []          # ultimo valor de cada parche
    de_donde: list[int] = []       # indice en `validas` del ultimo de cada parche
    previo = [-1] * len(validas)
    for k, (_, n) in enumerate(validas):
        j = bisect.bisect_left(colas, n)
        if j > 0:
            previo[k] = de_donde[j - 1]
        if j == len(colas):
            colas.append(n)
            de_donde.append(k)
        else:
            colas[j] = n
            de_donde[j] = k

    elegidos: list[int] = []
    k = de_donde[-1] if de_donde else -1
    while k != -1:
        elegidos.append(k)
        k = previo[k]
    elegidos.reverse()

    conservados = {validas[k][0] for k in elegidos}
    marcas = [m for i, m in enumerate(lineas) if i in conservados]
    descartadas = [int(m.group(1)) for i, m in enumerate(lineas) if i not in conservados]
    return marcas, descartadas


def bloque_de(pos: int, anclas: list[tuple[int, int]]) -> int:
    """indice de bloque vigente en una posicion del texto unido."""
    lo, hi = 0, len(anclas) - 1
    r = anclas[0][1] if anclas else -1
    while lo <= hi:
        mid = (lo + hi) // 2
        if anclas[mid][0] <= pos:
            r = anclas[mid][1]
            lo = mid + 1
        else:
            hi = mid - 1
    return r


def cuerpo(texto: str, ini: int, fin: int, saltar: set[int]) -> str:
    """Texto del pasaje, sin los bloques marcados (titulos y encabezados)."""
    trozo = texto[ini:fin]
    partes = RE_SENT.split(trozo)
    salida = [re.sub(r"\s+", " ", partes[0]).strip()] if partes else []
    for k in range(1, len(partes) - 1, 2):
        i = int(partes[k])
        if i in saltar:
            continue
        salida.append(re.sub(r"\s+", " ", partes[k + 1]).strip())
    return "\n".join(p for p in salida if p)


# --------------------------------------------------------------------------
# 5. el .txt, solo para nombrar el residuo
# --------------------------------------------------------------------------

def numeracion_del_txt() -> list[tuple[int, str]]:
    t = TXT.read_text(encoding="utf-8")
    a = re.search(r"^\*\*\* START OF THE PROJECT GUTENBERG EBOOK.*\*\*\*$", t, re.M)
    b = re.search(r"^\*\*\* END OF THE PROJECT GUTENBERG EBOOK.*\*\*\*$", t, re.M)
    cuerpo_txt = RE_FOOTNOTE_PLANA.sub(" ", t[a.end():b.start()])
    salida = []
    marcas = list(RE_NUM_LINEA.finditer(cuerpo_txt))
    for k, m in enumerate(marcas):
        fin = marcas[k + 1].start() if k + 1 < len(marcas) else len(cuerpo_txt)
        ctx = re.sub(r"\s+", " ", cuerpo_txt[m.end():fin]).strip()
        salida.append((int(m.group(1)), ctx))
    return salida


# --------------------------------------------------------------------------

def main() -> int:
    utf8_stdout()
    asegurar_carpetas()
    alertas: list[str] = []

    bloques = cargar_bloques()
    print(f"bloques de nivel parrafo : {len(bloques):>7,}")

    texto = unir(bloques)

    # El control de D-043 son 864 bloques con el patron plano INGENUO, sin
    # proteger los corchetes que no son notas. Se reproduce aparte para poder
    # verificarlo, porque el extractor real ya no da ese numero: al proteger
    # marcadores e inserciones, las 17 notas con corchetes anidados pasan a
    # cerrar bien y el total sube. 881 marcadores = 874 que cierran + 7 que el
    # original nunca cierra.
    control_ingenuo = len(RE_FOOTNOTE_PLANA.findall(texto))
    marcadores = texto.count("[Footnote")

    texto, notas, al_notas = quitar_notas(texto)
    alertas += al_notas
    n_planas = sum(1 for n in notas if n["tipo"] == "plana")
    n_abiertas = sum(1 for n in notas if n["tipo"] == "sin cerrar")
    print(f"marcadores [Footnote     : {marcadores:>7,}")
    print(f"  patron plano ingenuo   : {control_ingenuo:>7,}   control D-043 {CTRL_NOTAS:,}")
    print(f"  extraidas (cierran)    : {n_planas:>7,}")
    print(f"  sin cerrar en el fuente: {n_abiertas:>7,}")

    lineas_num = list(RE_NUM_LINEA.finditer(texto))
    print(f"lineas de numeracion     : {len(lineas_num):>7,}   control {CTRL_NUMERACION:,}")

    marcas, descartadas = filtrar_numeracion(lineas_num)
    print(f"  numeros de pasaje      : {len(marcas):>7,}   "
          f"({len(descartadas)} lineas descartadas por romper la monotonia)")

    anclas = [(m.start(), int(m.group(1))) for m in RE_SENT.finditer(texto)]
    limpio = mapa_bloques_limpios(texto)
    por_indice = {b["i"]: b for b in bloques}

    primer_num_bloque = bloque_de(marcas[0].start(), anclas) if marcas else 0
    secciones, consumidos = detectar_secciones(bloques, limpio, primer_num_bloque)

    # -- indice de contenidos del Volumen I: titulo y rango, sin heuristica
    indice = parsear_indice()
    ult_vol1 = max(e["hasta"] for e in indice)
    titulo_del_indice: dict[int, str] = {}
    for e in indice:
        for n in range(e["desde"], e["hasta"] + 1):
            titulo_del_indice[n] = e["titulo"]
    claves_indice = [normalizar(e["titulo"]) for e in indice]
    huecos_vol1 = [n for n in range(1, ult_vol1 + 1) if n not in titulo_del_indice]
    print(f"indice Vol I             : {len(indice):>7,} entradas, "
          f"pasajes 1-{ult_vol1}, {len(huecos_vol1)} sin cubrir")

    # -- candidatos a titulo: bloque en caja mixta justo antes de una numeracion
    candidatos: dict[int, tuple[str, int]] = {}   # bloque -> (texto, richterNo)
    unico_contenido: set[int] = set()             # bloques que son TODO el pasaje previo
    b_previo = -1
    for m in marcas:
        b_num = bloque_de(m.start(), anclas)
        b_anterior, b_previo = b_previo, b_num
        # solo si la linea de numeracion abre el bloque; si viene pegada a otra
        # cosa, el bloque anterior no es su titulo sino texto del pasaje previo
        if not RE_SOLO_NUM.match(limpio.get(b_num, "")):
            continue
        j = b_num - 1
        while j >= 0 and not limpio.get(j, ""):
            j -= 1
        if j < 0 or j in consumidos or j in candidatos:
            continue
        cand = limpio[j]
        if es_titulo_richter(cand) and por_indice.get(j, {}).get("tag") in ("p", "h5"):
            candidatos[j] = (cand.rstrip("."), int(m.group(1)))
            # ¿es este bloque TODO el cuerpo del pasaje anterior? Richter titula
            # grupos de pasajes: un titulo nunca se come el pasaje que lo precede.
            # Si lo hiciera, lo que hay ahi es un pasaje corto de Leonardo
            # ("A bird, for a comedy.", R-703) y no un titulo.
            if b_anterior >= 0 and not any(
                    limpio.get(x, "") for x in range(b_anterior + 1, j)):
                unico_contenido.add(j)

    # -- decision, distinta por volumen
    titulos: dict[int, str] = {}
    decisiones_vol2: list[tuple[int, str, bool, str]] = []
    metrica = {"tp": 0, "fp": 0, "fn": 0}
    for j, (cand, n) in sorted(candidatos.items()):
        nominal = es_sintagma_nominal(cand)
        if n <= ult_vol1:
            # Volumen I: manda el indice. Un candidato es titulo solo si el
            # indice lo respalda; asi se descartan los pasajes de una linea de
            # la seccion "Mottoes and Emblems", que son sintagmas nominales
            # legitimos de Leonardo y no titulos de Richter.
            respaldo = bool(difflib.get_close_matches(
                normalizar(cand), claves_indice, n=1, cutoff=0.82))
            if respaldo and j not in unico_contenido:
                titulos[j] = cand
            if nominal and respaldo:
                metrica["tp"] += 1
            elif nominal and not respaldo:
                metrica["fp"] += 1
            elif respaldo and not nominal:
                metrica["fn"] += 1
        else:
            # Volumen II: no hay indice. Manda la regla nominal, y ademas no se
            # acepta un titulo que dejaria al pasaje anterior sin cuerpo.
            solo = j in unico_contenido
            acepta = nominal and not solo
            if acepta:
                titulos[j] = cand
            decisiones_vol2.append(
                (n, cand, acepta,
                 "regla nominal" if not solo else "rechazado: es todo el cuerpo de R-%d" % (n - 1)))

    prec = metrica["tp"] / max(1, metrica["tp"] + metrica["fp"])
    rec = metrica["tp"] / max(1, metrica["tp"] + metrica["fn"])
    print(f"titulos de Richter       : {len(titulos):>7,}   "
          f"(Vol I {sum(1 for j in titulos if candidatos[j][1] <= ult_vol1)} por indice, "
          f"resto por regla)")
    print(f"regla nominal en Vol I   : precision {prec:.1%}  recall {rec:.1%}")

    # -- introducciones de seccion: prosa editorial de Richter que el parseo
    # ingenuo mete al final del pasaje ANTERIOR. Es lo que `14` O4 detecto al
    # ver pasajes de mas de 2.000 palabras, y es la mitad del riesgo R1: R-662
    # terminaba con el encabezado "X. Studies and Sketches for Pictures and
    # Decorations" y la introduccion entera de Richter a esa seccion, en primera
    # persona y sin una sola cursiva que lo delatara.
    #
    # Entre un encabezado de seccion y el proximo numero de pasaje no puede
    # haber texto de Leonardo: todo pasaje empieza en su numero.
    b_num_set = {bloque_de(m.start(), anclas) for m in marcas}
    intros: dict[int, str] = {}
    for h in sorted(consumidos):
        j = h + 1
        while j < len(bloques) and j not in b_num_set:
            if limpio.get(j) and j not in consumidos and j not in titulos:
                intros[j] = secciones.get(j, ("", ""))[0]
            j += 1

    # -- pasajes
    saltar = set(titulos) | consumidos | set(intros)
    pasajes = []
    titulo_vigente = ""
    for k, m in enumerate(marcas):
        fin = marcas[k + 1].start() if k + 1 < len(marcas) else len(texto)
        b_num = bloque_de(m.start(), anclas)
        n_pas = int(m.group(1))
        # el titulo que precede a este pasaje pasa a ser el vigente (se propaga
        # hasta el proximo, que es como Richter titula rangos: "(153-157)")
        j = b_num - 1
        while j >= 0 and not limpio.get(j, ""):
            j -= 1
        if j in titulos:
            titulo_vigente = titulos[j]
        # en el Volumen I el rango del indice manda sobre la propagacion
        titulo_final = titulo_del_indice.get(n_pas, titulo_vigente)

        cuerpo_txt = cuerpo(texto, m.end(), fin, saltar)
        # el cuerpo con el titulo adentro, solo para comparar con el control
        cuerpo_crudo = cuerpo(texto, m.end(), fin, consumidos)
        sec, sub = secciones.get(b_num, ("", ""))
        ancla = por_indice.get(b_num, {}).get("id")
        pasajes.append({
            "richterNo": n_pas,
            "orden": k,
            "anchorId": ancla,
            "url": f"{URL_BASE}#{ancla}" if ancla else None,
            "section": sec,
            "subsection": sub,
            "richterTitle": titulo_final,
            "titleSource": "indice" if n_pas in titulo_del_indice else "regla",
            "text": cuerpo_txt,
            "nWords": len(cuerpo_txt.split()),
            "nWordsConTitulo": len(cuerpo_crudo.split()),
        })

    utiles = [p for p in pasajes if p["nWords"] >= MIN_PALABRAS]
    control8 = sum(1 for p in pasajes if p["nWordsConTitulo"] >= MIN_PALABRAS)
    print(f"pasajes >= {MIN_PALABRAS} palabras  : {len(utiles):>7,}   "
          f"control {CTRL_PASAJES_8:,} (comparable: {control8:,})")

    # -- notas -> annotatesPassage
    filas_notas = []
    for idx, n in enumerate(notas):
        antes = [m for m in marcas if m.start() < n["pos"]]
        filas_notas.append({
            "id": f"fn-{idx:04d}",
            "annotatesPassage": int(antes[-1].group(1)) if antes else None,
            "text": n["texto"],
            "tipo": n["tipo"],
            "crossesBlocks": n["cruza_bloques"],
            "chars": n["chars"],
        })

    # ---------------- conteos de control ----------------
    verificar("notas al pie (patron ingenuo, control D-043)",
              control_ingenuo, CTRL_NOTAS, 0, alertas)
    verificar("lineas de numeracion", len(lineas_num), CTRL_NUMERACION, 10, alertas)
    verificar("pasajes >= 8 palabras", control8, CTRL_PASAJES_8, 15, alertas)
    # Los 651 titulos de D-025 no se pueden reproducir con esta definicion y el
    # control no se fuerza: se mide la hipotesis y se reporta la diferencia.
    h5_leonardo = sum(1 for b in bloques
                      if b["tag"] == "h5" and b["i"] not in consumidos
                      and limpio.get(b["i"], "").isupper())

    # ---------------- salidas ----------------
    escribir_jsonl(OUT / "passages.jsonl", pasajes)
    escribir_jsonl(OUT / "footnotes.jsonl", filas_notas)
    escribir_jsonl(OUT / "titles.jsonl",
                   [{"bloque": i, "richterNo": candidatos[i][1], "titulo": t}
                    for i, t in sorted(titulos.items())])
    escribir_jsonl(OUT / "toc.jsonl", indice)
    escribir_jsonl(OUT / "intros.jsonl", [
        {"id": f"intro-{k:03d}", "bloque": i, "section": sec,
         "anchorId": por_indice.get(i, {}).get("id"),
         "precedeAlPasaje": min((int(m.group(1)) for m in marcas
                                 if bloque_de(m.start(), anclas) > i), default=None),
         "text": limpio[i], "nWords": len(limpio[i].split())}
        for k, (i, sec) in enumerate(sorted(intros.items()))])

    # los titulos del Volumen II corren sin indice que los respalde
    V = ["Titulos del Volumen II: decididos por la regla nominal, sin indice.",
         "",
         "El Volumen I tiene indice de contenidos y ahi el titulo es un dato, no",
         "una inferencia. El Volumen II no lo tiene. Estos son todos los candidatos",
         "estructurales del Volumen II con el veredicto de la regla, para revision",
         "ocular: un ACEPTA equivocado se lleva puesto el cuerpo de un pasaje.",
         "",
         f"aceptados {sum(1 for _, _, ok, _ in decisiones_vol2 if ok)} de "
         f"{len(decisiones_vol2)} candidatos", ""]
    for n, cand, ok, _ in decisiones_vol2:
        V.append(f"  [{'ACEPTA' if ok else 'rechaza'}] R-{n:<5} {cand[:110]}")
    (REPORTS / "titulos_volumen2.txt").write_text("\n".join(V) + "\n", encoding="utf-8")

    # las notas que cruzan bloques: el codigo mas peligroso de la fase, enteras
    cruzan = [n for n in notas if n["cruza_bloques"]]
    L = ["Notas al pie cuyo texto atraviesa mas de un bloque del HTML.",
         "",
         "Son el punto donde un error del extractor borra texto de Leonardo sin",
         "hacer ruido (D-043). Cada bloque va entero para revision ocular: lo que",
         "hay que confirmar es que todo lo listado es aparato de Richter y que no",
         "quedo adentro ni una linea del pasaje que la nota anota.",
         "",
         f"total: {len(cruzan)} de {len(notas)} notas", ""]
    for n in cruzan:
        L += [f"--- {n['chars']:,} chars · bloques {n['bloques_cruzados']} · {n['tipo']}"
              + ("  <<< CONTIENE NUMERACION" if n["numeracion_adentro"] else ""),
              n["texto"], ""]
    (REPORTS / "footnotes_multibloque.txt").write_text("\n".join(L) + "\n", encoding="utf-8")

    # el residuo de numeracion, nombrado
    del_txt = numeracion_del_txt()
    nums_html = Counter(int(m.group(1)) for m in marcas)
    nums_txt = Counter(n for n, _ in del_txt)
    falta = nums_txt - nums_html
    sobra = nums_html - nums_txt
    R = ["Residuo de numeracion: HTML contra .txt.", "",
         f"lineas de numeracion en el HTML : {sum(nums_html.values()):,}",
         f"lineas de numeracion en el .txt : {sum(nums_txt.values()):,}", "",
         "--- en el .txt y NO en el HTML ---"]
    ctx_txt = dict(del_txt)
    for n in sorted(falta):
        R += [f"  {n}. -> {ctx_txt.get(n, '')[:300]}", ""]
    R += ["--- en el HTML y NO en el .txt ---"]
    for n in sorted(sobra):
        p = next((p for p in pasajes if p["richterNo"] == n), None)
        R += [f"  {n}. -> {(p['text'] if p else '')[:300]}", ""]
    huecos = [n for n in range(1, CTRL_NUMERACION + 1)
              if n not in nums_txt and n not in nums_html]
    R += ["--- numeros que no existen en NINGUNO de los dos archivos ---",
          "    (huecos de la propia numeracion de Richter o numeros absorbidos por",
          "     una nota que el fuente no cierra; no son perdida del parser)",
          "    " + ", ".join(str(n) for n in huecos), "",
          "--- lineas 'N.' descartadas por romper la monotonia ---",
          "    (anios, importes y referencias cruzadas sueltos en su propia linea)"]
    for n in descartadas:
        R.append(f"    {n}.")
    R.append("")
    (REPORTS / "numeracion_residuo.txt").write_text("\n".join(R) + "\n", encoding="utf-8")

    # ---------------- reporte ----------------
    ns = sorted(p["nWords"] for p in pasajes)
    def pct(q): return ns[int(q * (len(ns) - 1))]
    cortos = [p for p in pasajes if p["nWords"] < 15]
    largos = [p for p in pasajes if p["nWords"] > 500]
    sin_ancla = [p for p in pasajes if not p["anchorId"]]
    sin_titulo = [p for p in pasajes if not p["richterTitle"]]

    rep = [
        "# Reporte de parseo — PG #5000 (Richter, 1888)",
        "",
        f"Fuente: `pipeline/raw/pg5000-images.html` · {HTML.stat().st_size:,} bytes",
        "",
        "## Conteos de control",
        "",
        "| Control | Medido | Esperado | |",
        "|---|---:|---:|---|",
        f"| Notas al pie con el patron plano ingenuo (control D-043) | "
        f"{control_ingenuo:,} | {CTRL_NOTAS:,} | "
        f"{'ok' if control_ingenuo == CTRL_NOTAS else 'REVISAR'} |",
        f"| Marcadores `[Footnote` en el cuerpo | {marcadores:,} | 881 | "
        f"{'ok' if marcadores == 881 else 'revisar'} |",
        f"| Notas efectivamente extraidas (cierran) | {n_planas:,} | — | |",
        f"| Notas que el fuente nunca cierra | {n_abiertas:,} | — | ver abajo |",
        f"| Lineas de numeracion | {len(lineas_num):,} | {CTRL_NUMERACION:,} | "
        f"desvio {len(lineas_num) - CTRL_NUMERACION:+,} |",
        f"| Numeros de pasaje tras el filtro de monotonia | {len(marcas):,} | — | "
        f"{len(descartadas)} descartados |",
        f"| Pasajes >= 8 palabras (con titulo adentro, comparable al control) | "
        f"{control8:,} | {CTRL_PASAJES_8:,} | desvio {control8 - CTRL_PASAJES_8:+,} |",
        f"| Pasajes >= 8 palabras (con el titulo ya extraido) | {len(utiles):,} | — | |",
        f"| Titulos tematicos de Richter | {len(titulos):,} | {CTRL_TITULOS:,} | "
        f"desvio {len(titulos) - CTRL_TITULOS:+,} |",
        "",
        "El control de 1.504 se midio con los titulos en mayuscula de Leonardo y los",
        "titulos de Richter dentro de los cuerpos. Se reportan las dos cifras para que",
        "el numero siga siendo comparable despues de extraer los titulos.",
        "",
        "## Titulos: de donde sale cada uno",
        "",
        f"- Indice de contenidos del Volumen I: **{len(indice)} entradas**, cubren los "
        f"pasajes 1-{ult_vol1} con **{len(huecos_vol1)} huecos**. Es un dato del libro, "
        "no una inferencia.",
        f"- Volumen II ({ult_vol1 + 1} en adelante): no hay indice. Decide la regla "
        f"nominal sobre {len(decisiones_vol2)} candidatos, "
        f"**{sum(1 for _, _, ok, _ in decisiones_vol2 if ok)} aceptados** "
        "→ `reports/titulos_volumen2.txt`, para revision ocular.",
        f"- **Precision de la regla medida contra el indice del Volumen I: "
        f"{prec:.1%} · recall {rec:.1%}** ({metrica['tp']} aciertos, "
        f"{metrica['fp']} falsos positivos, {metrica['fn']} falsos negativos).",
        "",
        f"**Discrepancia con D-025.** El documento dice 651 titulos; con esta "
        f"definicion son {len(titulos)}. La hipotesis medida: los encabezados `<h5>` en "
        f"mayuscula que NO son de seccion —los que escribio el propio Leonardo en sus "
        f"manuscritos, tipo `OF PAINTING.`— son **{h5_leonardo}**. "
        + (f"Coincide con los 651 de D-025, asi que ese conteo estaba midiendo los "
           f"titulos de Leonardo, no los de Richter."
           if abs(h5_leonardo - CTRL_TITULOS) <= 10 else
           f"No coincide exactamente con 651; la diferencia queda anotada y sin forzar.")
        + " Aca esos encabezados quedan dentro del cuerpo del pasaje, que es lo que "
          "mantiene comparable el control de 1.504.",
        "",
        "## Distribucion de longitud",
        "",
        "| | palabras | doc |",
        "|---|---:|---:|",
        f"| mediana | {pct(0.5)} | 68 |",
        f"| media | {sum(ns) / len(ns):.1f} | 129,5 |",
        f"| p10 / p90 | {pct(0.10)} / {pct(0.90)} | 14 / 272 |",
        f"| maximo | {ns[-1]:,} | 3.339 |",
        f"| total en cuerpos | {sum(ns):,} | ~202.728 |",
        "",
        f"- Pasajes < 15 palabras: **{len(cortos)}** (doc: 178) — se agrupan en `04_chunk.py`",
        f"- Pasajes > 500 palabras: **{len(largos)}** (doc: 60) — se parten con solape",
        f"- Pasajes sin ancla `id`: **{len(sin_ancla)}**",
        f"- Pasajes sin titulo de Richter asignado: **{len(sin_titulo)}**",
        "",
        "## Notas al pie",
        "",
        f"- Total extraidas: **{len(notas)}** ({n_planas} que cierran + "
        f"{n_abiertas} que el fuente deja abiertas, acotadas al bloque)",
        f"- Que atraviesan mas de un bloque del HTML: **{len(cruzan)}** "
        "→ `reports/footnotes_multibloque.txt`, para revision ocular",
        f"- Con una linea de numeracion adentro (se estarian comiendo un pasaje): "
        f"**{sum(1 for n in notas if n['numeracion_adentro'])}**",
        f"- Mas larga: {max(n['chars'] for n in notas):,} caracteres",
        "",
        "## Secciones detectadas",
        "",
    ]
    vistas, orden = set(), []
    for p in pasajes:
        clave = (p["section"], p["subsection"])
        if clave not in vistas:
            vistas.add(clave)
            orden.append((p["richterNo"], *clave))
    for n, s, sub in orden:
        rep.append(f"- desde R-{n}: **{s}**" + (f" › {sub}" if sub else ""))
    rep += ["", "## Alertas", ""]
    rep += [f"- {a}" for a in alertas] or ["- ninguna"]
    rep.append("")
    (REPORTS / "parse_report.md").write_text("\n".join(rep), encoding="utf-8")

    print(f"\nreporte -> {REPORTS / 'parse_report.md'}")
    if alertas:
        print("\nALERTAS:", file=sys.stderr)
        for a in alertas:
            print("  - " + a, file=sys.stderr)
        return 1
    print("todos los conteos de control dentro de banda")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
