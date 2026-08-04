"""01 — Descarga las dos fuentes de Project Gutenberg #5000 (Richter, 1888).

Se guardan las dos y se commitean las dos (D-024):

    pg5000-images.html  fuente de parseo. Cursivas balanceadas (2.714 <i>) y un
                        ancla id por parrafo, que es lo que hace posible la URL
                        de citacion profunda.
    pg5000.txt          NO se parsea. Se guarda porque produce diffs legibles en
                        Git y permite reproducir las mediciones del experimento
                        de la Fase 0.5.

La cabecera y la licencia de Project Gutenberg se conservan intactas: el camino
limpio para uso no comercial es redistribuir con la marca y respetarla (R20).

Verificacion: tamano exacto en bytes y SHA-256. Si Project Gutenberg re-publica
el libro (la ficha dice "most recently updated"), el checksum cambia y el script
falla en vez de dejar que el corpus se mueva bajo los pies del indice.
"""

from __future__ import annotations

import hashlib
import json
import sys

import requests

from common import HTML, RAW, TXT, asegurar_carpetas, utf8_stdout

# Medidos el 2026-07-31 sobre los archivos efectivamente usados.
FUENTES = [
    {
        "nombre": "pg5000-images.html",
        "url": "https://www.gutenberg.org/cache/epub/5000/pg5000-images.html",
        "destino": HTML,
        "bytes": 1_600_813,
        "sha256": "110a9d1b0e88fdf0f0c0cabf04d603a9c63f521685aa3b3ef9befaf45b177803",
        "rol": "fuente de parseo",
    },
    {
        "nombre": "pg5000.txt",
        "url": "https://www.gutenberg.org/cache/epub/5000/pg5000.txt",
        "destino": TXT,
        "bytes": 1_433_832,
        "sha256": "83e79e107270ea7cbbc4b478913978738ae3d763081e54bc173a663d08ca5b10",
        "rol": "diffs legibles en Git; no se parsea",
    },
]

# La URL ebooks/5000.txt.utf-8 redirige a HTTP y algunos clientes la rechazan.
# Las de cache/epub/ son las directas. (Nota del README del experimento.)
UA = "ask-leonardo-da-vinci/0.1 (pipeline de ingesta, uso no comercial)"


def sha256(datos: bytes) -> str:
    return hashlib.sha256(datos).hexdigest()


def descargar(url: str) -> bytes:
    r = requests.get(url, headers={"User-Agent": UA}, timeout=120)
    r.raise_for_status()
    return r.content


def main() -> int:
    utf8_stdout()
    asegurar_carpetas()

    registro = {}
    fallos = []

    for f in FUENTES:
        destino = f["destino"]
        if destino.exists():
            datos = destino.read_bytes()
            if len(datos) == f["bytes"] and sha256(datos) == f["sha256"]:
                print(f"[ok  ] {f['nombre']:<20} ya presente y verificado")
                registro[f["nombre"]] = {"bytes": len(datos), "sha256": sha256(datos),
                                         "url": f["url"], "rol": f["rol"]}
                continue
            print(f"[warn] {f['nombre']:<20} presente pero no coincide; se vuelve a bajar")

        print(f"[bajar] {f['nombre']:<19} {f['url']}")
        datos = descargar(f["url"])
        real_bytes, real_sha = len(datos), sha256(datos)

        if real_bytes != f["bytes"] or real_sha != f["sha256"]:
            fallos.append(
                f"{f['nombre']}: esperado {f['bytes']:,} bytes / {f['sha256'][:16]}..., "
                f"recibido {real_bytes:,} bytes / {real_sha[:16]}..."
            )
            # Se guarda igual, con otro nombre, para poder diffear que cambio.
            (RAW / (f["nombre"] + ".nuevo")).write_bytes(datos)
            continue

        destino.write_bytes(datos)
        print(f"[ok  ] {f['nombre']:<20} {real_bytes:,} bytes  sha256 {real_sha[:16]}...")
        registro[f["nombre"]] = {"bytes": real_bytes, "sha256": real_sha,
                                 "url": f["url"], "rol": f["rol"]}

    if fallos:
        print("\nFALLO DE VERIFICACION — el corpus de origen cambio:", file=sys.stderr)
        for x in fallos:
            print("  " + x, file=sys.stderr)
        print("\nSe guardo la version nueva con sufijo .nuevo para poder diffearla.\n"
              "No sigas con el pipeline hasta decidir si se adopta la version nueva:\n"
              "cambiar el corpus invalida el indice, los umbrales y las metricas.",
              file=sys.stderr)
        return 1

    (RAW / "checksums.json").write_text(
        json.dumps(registro, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nchecksums -> {RAW / 'checksums.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
