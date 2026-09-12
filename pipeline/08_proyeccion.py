"""08 — La sombra del indice denso, para la ultima pantalla del sitio.

QUE ES. El motor busca en un espacio de 384 dimensiones: cada pasaje es un
vector de norma 1 y lo unico que se mide entre dos es el angulo. Eso no se
puede dibujar. Esto lo baja a 3 dimensiones con PCA y guarda el resultado para
que la seccion `Espacio` lo dibuje sin recalcular nada en el navegador.

⚠ ES UN DERIVADO DEL INDICE, Y POR ESO VIVE ACA Y NO EN UN CUADERNO SUELTO.
Sale de `artifacts/index.bin` + `chunks.json` + `curaduria.json`. Si el indice
se reconstruye y esto no, el dibujo miente en silencio: sigue mostrando la
forma del indice viejo y nadie se entera. Correr despues de `npm run indexar`.

QUE GUARDA, y por que cada cosa:
    pos   la posicion en 3D. Es el PCA CRUDO, escalado para que el percentil 98
          del radio valga 1 — no renormalizado a la esfera. Sin normalizar, la
          nube conserva su interior y se puede entrar; normalizada seria una
          cascara hueca y el zoom no tendria adonde ir.
    dir   hacia donde apunta cada vector: a su vecino mas cercano MEDIDO EN LAS
          384 DIMENSIONES, no en la sombra. Es lo que hace que las flechas
          digan algo en vez de decorar.
    sim   cuanto se parece a ese vecino. Decide el largo de la flecha.
    sec   a que seccion de Richter pertenece, por indice en `secciones`.

Y SE MIDE CUANTO MIENTE. Bajar de 384 a 3 pierde informacion siempre; la
pregunta util no es si pierde sino cuanto. Se compara el orden de los cosenos
reales contra el de la sombra sobre una muestra de pares (Spearman) y se
imprime. Sin ese numero, un dibujo lindo es una afirmacion sin respaldo.

SIN DEPENDENCIAS NUEVAS: el PCA es una SVD de numpy y el Spearman es una
correlacion sobre rangos. Nada de sklearn ni scipy para cuatro cuentas.

⚠ SALE A `public/` Y NO A `artifacts/`. La pantalla lo pide con `fetch` cuando
alguien llega hasta ella, no lo importa: 144 KB dentro de un bundle los paga
todo el mundo al entrar al sitio, y esto lo usa solo quien baja hasta el final.

Salida: public/proyeccion.json
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from common import ARTIFACTS, RAIZ, utf8_stdout

SEMILLA = 42
# Las mismas tres utilidades que el motor excluye de la busqueda: el aparato de
# Richter, los inventarios y lo que no se pudo traducir no son voz de Leonardo.
FUERA = {"inventory", "no_traducible", "aparato"}
PARES = 60_000


def cargar() -> tuple[np.ndarray, list[dict]]:
    """Lee el indice tal como lo lee `src/lib/retrieval.ts`."""
    meta = json.loads((ARTIFACTS / "index_meta.json").read_text(encoding="utf-8"))
    chunks = json.loads((ARTIFACTS / "chunks.json").read_text(encoding="utf-8"))
    curaduria = json.loads((ARTIFACTS / "curaduria.json").read_text(encoding="utf-8"))["chunks"]

    n, d, escala = meta["count"], meta["dims"], meta["scale"]
    crudo = np.fromfile(ARTIFACTS / "index.bin", dtype=np.int8)
    vecs = crudo.astype(np.float32).reshape(n, d) / escala
    # ⚠ Renormalizar, igual que `Corpus` en TS: sin esto el redondeo del int8
    # deja las normas apenas fuera de 1 y el producto punto deja de ser coseno.
    vecs /= np.linalg.norm(vecs, axis=1, keepdims=True)

    por_id = {c["id"]: c for c in chunks}
    filas, info = [], []
    for i, (cid, voz) in enumerate(zip(meta["ids"], meta["voice"])):
        c = por_id[cid]
        util = (curaduria.get(cid) or {}).get("utility", c.get("utility"))
        if voz != "leonardo" or util in FUERA:
            continue
        filas.append(i)
        info.append({
            "seccion": c.get("section") or "—",
            "titulo": c.get("richterTitle") or "",
            "richter": (c.get("richterNos") or [None])[0],
        })
    return vecs[filas], info


def pca3(x: np.ndarray) -> tuple[np.ndarray, float]:
    """Las tres direcciones en que la nube esta mas estirada, por SVD."""
    centrado = x - x.mean(axis=0)
    _, s, vt = np.linalg.svd(centrado, full_matrices=False)
    # ⚠ EL SIGNO DE UNA SVD ES ARBITRARIO. Sin fijarlo, dos corridas de la misma
    # matriz pueden devolver ejes espejados y la nube «cambia» sin que nada haya
    # cambiado. Se fija como lo hace sklearn: el componente de mayor valor
    # absoluto de cada eje queda positivo.
    for k in range(3):
        if vt[k][np.argmax(np.abs(vt[k]))] < 0:
            vt[k] = -vt[k]
    varianza = float((s[:3] ** 2).sum() / (s ** 2).sum())
    return centrado @ vt[:3].T, varianza


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    """Correlacion de Pearson sobre los rangos, que es lo que Spearman es."""
    def rangos(v: np.ndarray) -> np.ndarray:
        orden = v.argsort()
        r = np.empty(len(v), dtype=np.float64)
        r[orden] = np.arange(len(v))
        return r
    ra, rb = rangos(a), rangos(b)
    ra -= ra.mean(); rb -= rb.mean()
    return float((ra @ rb) / np.sqrt((ra @ ra) * (rb @ rb)))


def fidelidad(alto: np.ndarray, bajo: np.ndarray) -> float:
    rng = np.random.default_rng(SEMILLA)
    a = rng.integers(0, len(alto), PARES)
    b = rng.integers(0, len(alto), PARES)
    ok = a != b
    a, b = a[ok], b[ok]
    u = bajo / np.linalg.norm(bajo, axis=1, keepdims=True)
    return spearman(np.einsum("ij,ij->i", alto[a], alto[b]),
                    np.einsum("ij,ij->i", u[a], u[b]))


def main() -> None:
    utf8_stdout()
    vecs, info = cargar()
    n = len(vecs)
    print(f"filas que el motor busca: {n} x {vecs.shape[1]}")

    xyz, varianza = pca3(vecs)
    # El p98 y no el maximo: una sola fila lejos no puede decidir la escala de
    # las otras 1.401. Lo que sobresale queda afuera de la esfera unidad, que es
    # justo lo que le da borde a la nube.
    xyz = xyz / float(np.percentile(np.linalg.norm(xyz, axis=1), 98))

    # El vecino mas cercano de cada uno, en las 384 dimensiones.
    cos = vecs @ vecs.T
    np.fill_diagonal(cos, -np.inf)
    vecino = cos.argmax(axis=1)
    sim = cos[np.arange(n), vecino]

    # La direccion es la que va de uno a su vecino, ya en la sombra. Si los dos
    # cayeron en el mismo punto no hay direccion que dibujar: se usa el radio.
    delta = xyz[vecino] - xyz
    largo = np.linalg.norm(delta, axis=1, keepdims=True)
    rescate = xyz / np.maximum(np.linalg.norm(xyz, axis=1, keepdims=True), 1e-9)
    direccion = np.where(largo > 1e-9, delta / np.maximum(largo, 1e-9), rescate)

    nombres = [i["seccion"] for i in info]
    cuenta: dict[str, int] = {}
    for s in nombres:
        cuenta[s] = cuenta.get(s, 0) + 1
    # Ordenadas por tamano: es el orden en que las lee el rail de la pantalla.
    secciones = [s for s, _ in sorted(cuenta.items(), key=lambda kv: (-kv[1], kv[0]))]
    indice = {s: k for k, s in enumerate(secciones)}

    datos = {
        "n": n,
        "secciones": secciones,
        "pos": [round(float(v), 4) for v in xyz.ravel()],
        "dir": [round(float(v), 4) for v in direccion.ravel()],
        "sim": [round(float(v), 2) for v in sim],
        "sec": [indice[i["seccion"]] for i in info],
        "titulo": [i["titulo"] for i in info],
        "richter": [i["richter"] for i in info],
        "varianza": round(varianza, 4),
    }
    destino = RAIZ / "public" / "proyeccion.json"
    destino.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")

    sp = fidelidad(vecs, xyz)
    print(f"secciones: {len(secciones)}")
    print(f"varianza explicada por 3 ejes: {varianza:.1%}")
    print(f"orden de cosenos conservado (Spearman): {sp:.3f}")
    print(f"escrito: {destino.relative_to(RAIZ)} "
          f"({destino.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
