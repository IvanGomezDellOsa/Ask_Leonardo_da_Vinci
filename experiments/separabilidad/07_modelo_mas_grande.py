"""
¿El techo es el modelo o es la arquitectura?

Repite la medicion con multilingual-e5-base (278M, 768 dim) contra
multilingual-e5-small (118M, 384 dim). Si el modelo grande arregla el
solapamiento, el problema es de capacidad y se resuelve pagando computo.
Si no lo arregla, el problema es de diseno y ningun modelo lo va a tapar.

Mide tambien top-3 promedio en vez de maximo, por si el maximo es
demasiado ruidoso como estadistico.
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

MODELOS = ["intfloat/multilingual-e5-small", "intfloat/multilingual-e5-base"]


def mejor_umbral(d, f):
    v = np.unique(np.concatenate([d, f]))
    cortes = np.concatenate([[v[0] - 1e-4], (v[:-1] + v[1:]) / 2, [v[-1] + 1e-4]])
    acc = 0.5 * ((d[None, :] >= cortes[:, None]).mean(1) + (f[None, :] < cortes[:, None]).mean(1))
    return float(cortes[np.flatnonzero(acc == acc.max())[-1]]), float(acc.max())


def auc(d, f):
    return float((np.sign(d[:, None] - f[None, :]) / 2 + 0.5).mean())


def main():
    pasajes = [json.loads(l) for l in (DATA / "pasajes.jsonl").open(encoding="utf-8")]
    grupos = np.array([g for g, _, _, _ in TODAS])
    idiomas = np.array([i for _, i, _, _ in TODAS])

    from sentence_transformers import SentenceTransformer

    L = ["=" * 78, "¿EL TECHO ES EL MODELO O LA ARQUITECTURA?", "=" * 78, ""]

    for nombre in MODELOS:
        cache = DATA / f"emb_{nombre.split('/')[-1]}.npz"
        if cache.exists():
            z = np.load(cache)
            sim = z["emb_con"] @ z["emb_pas"].T
        else:
            print(f"embebiendo con {nombre}...")
            m = SentenceTransformer(nombre)
            enc = lambda xs: np.asarray(m.encode(xs, normalize_embeddings=True,
                                                 batch_size=32, show_progress_bar=False))
            ep = enc(["passage: " + p["texto"] for p in pasajes])
            ec = enc(["query: " + t for _, _, t, _ in TODAS])
            np.savez(cache, emb_pas=ep, emb_con=ec)
            sim = ec @ ep.T

        orden = np.sort(sim, axis=1)
        for etq, punt in [("max     ", sim.max(axis=1)),
                          ("top3 med", orden[:, -3:].mean(axis=1))]:
            d, f = punt[grupos == "dentro"], punt[grupos == "fuera"]
            t_u, acc_u = mejor_umbral(d, f)
            linea = [f"  {nombre.split('/')[-1]:24s} {etq}  umbral unico: AUC={auc(d, f):.4f}"
                     f" exactitud={acc_u:.1%}"]
            aciertos, taus = 0, {}
            for idi in ("es", "en"):
                mk = idiomas == idi
                dd, ff = punt[mk & (grupos == "dentro")], punt[mk & (grupos == "fuera")]
                t, a = mejor_umbral(dd, ff)
                taus[idi] = t
                aciertos += (dd >= t).sum() + (ff < t).sum()
                linea.append(f"      {idi}: AUC={auc(dd, ff):.4f} exactitud={a:.1%}"
                             f" margen={dd.min() - ff.max():+.4f}")
            linea.append(f"      por idioma: exactitud={aciertos / len(punt):.1%}"
                         f"  distancia taus={abs(taus['en'] - taus['es']):.4f}")
            L += linea + [""]

    texto = "\n".join(L)
    (RES / "modelo_mas_grande.txt").write_text(texto + "\n", encoding="utf-8")
    print(texto)


if __name__ == "__main__":
    main()
