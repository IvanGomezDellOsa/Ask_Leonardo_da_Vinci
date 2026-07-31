"""Rutas y utilidades compartidas por los scripts del pipeline.

El pipeline es offline: no se despliega, no usa ninguna API key y no depende de
la red mas alla del paso 01.

Disposicion de carpetas:
    pipeline/raw/       fuentes de Project Gutenberg (las dos, commiteadas)
    pipeline/out/       intermedios regenerables (gitignoreado)
    pipeline/reports/   reportes de control (commiteados: son la evidencia)
    pipeline/review/    decisiones humanas versionadas (commiteadas)
    artifacts/          artefactos finales que consume la app (commiteados)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PIPELINE = RAIZ / "pipeline"
RAW = PIPELINE / "raw"
OUT = PIPELINE / "out"
REPORTS = PIPELINE / "reports"
REVIEW = PIPELINE / "review"
ARTIFACTS = RAIZ / "artifacts"

HTML = RAW / "pg5000-images.html"
TXT = RAW / "pg5000.txt"

# URL publica de citacion: el HTML de Gutenberg trae un ancla id por parrafo,
# asi que la cita enlaza al pasaje exacto y no al libro entero (D-024).
URL_BASE = "https://www.gutenberg.org/cache/epub/5000/pg5000-images.html"


def utf8_stdout() -> None:
    """La consola de Windows no es UTF-8 por defecto y el corpus tiene acentos."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def asegurar_carpetas() -> None:
    for c in (RAW, OUT, REPORTS, REVIEW, ARTIFACTS):
        c.mkdir(parents=True, exist_ok=True)


def escribir_jsonl(destino: Path, filas) -> int:
    destino.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with destino.open("w", encoding="utf-8") as f:
        for fila in filas:
            f.write(json.dumps(fila, ensure_ascii=False) + "\n")
            n += 1
    return n


def leer_jsonl(origen: Path) -> list[dict]:
    with origen.open(encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


class FalloDeControl(RuntimeError):
    """Un conteo de control quedo fuera de banda.

    El pipeline falla ruidosamente en vez de seguir con un corpus corrompido:
    el modo de fallo que importa (D-043) es silencioso por naturaleza.
    """


def verificar(nombre: str, valor: int, esperado: int, tolerancia: int,
              alertas: list[str]) -> bool:
    """Registra un conteo de control. Devuelve True si esta dentro de banda."""
    delta = valor - esperado
    ok = abs(delta) <= tolerancia
    if not ok:
        alertas.append(
            f"{nombre}: {valor:,} — esperado {esperado:,} +/- {tolerancia} "
            f"(desvio {delta:+,})"
        )
    return ok
