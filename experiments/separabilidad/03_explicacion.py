"""
Version explicativa del resultado: una sola recta numerica con las 40 consultas
como puntos, partidas en cuatro filas (idioma x grupo).

El objetivo es que se vea de un vistazo POR QUE no hay un umbral unico posible:
el bloque del ingles esta corrido a la derecha respecto del espanol, en los dos
grupos, asi que "ingles-malo" se solapa con "espanol-bueno".

Lee resultados/consultas.csv, no recalcula embeddings.
"""

import csv
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

AQUI = Path(__file__).parent
RES = AQUI / "resultados"

C_D, C_F = "#1f6f4a", "#b03030"


def main() -> None:
    filas = list(csv.DictReader((RES / "consultas.csv").open(encoding="utf-8-sig"),
                                delimiter=";"))

    def sel(idi, grp):
        return np.array([float(r["cos_max"]) for r in filas
                         if r["idioma"] == idi and r["grupo"] == grp])

    # de arriba hacia abajo
    pistas = [
        ("inglés · SÍ contestables", sel("en", "dentro"), C_D),
        ("inglés · NO contestables", sel("en", "fuera"), C_F),
        ("español · SÍ contestables", sel("es", "dentro"), C_D),
        ("español · NO contestables", sel("es", "fuera"), C_F),
    ]

    fig, ax = plt.subplots(figsize=(11, 5.2), dpi=160)

    for i, (etq, datos, color) in enumerate(pistas):
        y = len(pistas) - 1 - i
        ax.hlines(y, datos.min(), datos.max(), color=color, lw=3, alpha=0.28)
        ax.plot(datos, np.full_like(datos, y), "o", color=color, ms=9,
                mec="white", mew=1.2, zorder=3)
        ax.text(0.7345, y + 0.30, etq, fontsize=10, color=color, va="bottom")

    # la zona donde ingles-malo pisa a espanol-bueno
    a = sel("es", "dentro").min()
    b = sel("en", "fuera").max()
    ax.axvspan(a, b, color="#c8a415", alpha=0.13, zorder=0)
    ax.text((a + b) / 2, 3.72,
            "zona imposible\naquí conviven preguntas contestables en español\ny basura en inglés",
            fontsize=9, ha="center", va="top", color="#7a6100")

    # los dos casos que lo resumen
    ax.annotate("«¿Cuáles son las proporciones\ndel cuerpo humano?»  0,8239",
                xy=(0.8239, 1), xytext=(0.8239, 0.42), fontsize=8.5, ha="center",
                color=C_D, arrowprops=dict(arrowstyle="->", color=C_D, lw=1.2))
    ax.annotate("«How does artificial\nintelligence work?»  0,8458",
                xy=(0.8458, 2), xytext=(0.8620, 2.42), fontsize=8.5, ha="center",
                color=C_F, arrowprops=dict(arrowstyle="->", color=C_F, lw=1.2))

    ax.set_yticks([])
    ax.set_ylim(-0.55, 4.25)
    ax.set_xlim(0.730, 0.900)
    ax.set_xlabel("coseno máximo contra los 200 pasajes  →  parecido con el mejor pasaje del corpus",
                  fontsize=10.5)
    ax.set_title("Por qué no hay un umbral único posible\n"
                 "El bloque del inglés está corrido a la derecha — en los dos grupos",
                 fontsize=12, pad=12)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.grid(axis="x", alpha=0.2)
    fig.tight_layout()
    destino = RES / "explicacion.png"
    fig.savefig(destino)
    print(f"-> {destino}")


if __name__ == "__main__":
    main()
