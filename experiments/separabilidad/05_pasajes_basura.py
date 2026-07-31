"""
¿Cuanto del solapamiento lo causan los pasajes basura?

Entre los que mas atraen consultas 'fuera' aparecen fragmentos que no son prosa
de Leonardo: latin, griego mal escaneado, listas peladas de topónimos, apuntes
de contabilidad. Un embedding de esos textos no significa nada, pero igual
compite en el argmax y sube el piso del grupo 'fuera'.

Filtro deliberadamente simple y auditable: la tasa de palabras funcionales
inglesas (the, of, and, to...). La prosa de Richter las tiene; el latin, el
griego y las listas no. No usa el resultado del experimento para decidir que
sacar, asi que no hay circularidad.

Mide AUC, margen y umbral antes y despues, por idioma.
"""

import json
import re
import sys
from pathlib import Path

import numpy as np

from consultas import TODAS

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AQUI = Path(__file__).parent
DATA = AQUI / "data"
RES = AQUI / "resultados"

FUNCIONALES = {
    "the", "of", "and", "to", "in", "is", "that", "it", "a", "which", "as", "by",
    "with", "for", "this", "be", "on", "from", "will", "are", "or", "you", "not",
    "at", "its", "if", "so", "when", "they", "these", "was", "their", "have",
}
MIN_TASA = 0.18   # prosa inglesa normal ronda 0,35-0,45
MIN_PALABRAS = 15


def tasa_funcional(texto: str) -> float:
    toks = re.findall(r"[a-z']+", texto.lower())
    if not toks:
        return 0.0
    return sum(t in FUNCIONALES for t in toks) / len(toks)


def mejor_umbral(d, f):
    v = np.unique(np.concatenate([d, f]))
    cortes = np.concatenate([[v[0] - 1e-4], (v[:-1] + v[1:]) / 2, [v[-1] + 1e-4]])
    acc = 0.5 * ((d[None, :] >= cortes[:, None]).mean(1) + (f[None, :] < cortes[:, None]).mean(1))
    return float(cortes[np.flatnonzero(acc == acc.max())[-1]]), float(acc.max())


def auc(d, f):
    return float((np.sign(d[:, None] - f[None, :]) / 2 + 0.5).mean())


def main() -> None:
    pasajes = [json.loads(l) for l in (DATA / "pasajes.jsonl").open(encoding="utf-8")]
    z = np.load(DATA / "emb_cache.npz", allow_pickle=True)
    emb_pas, emb_con = z["emb_pas"], z["emb_con"]

    tasas = np.array([tasa_funcional(p["texto"]) for p in pasajes])
    largos = np.array([p["n_palabras"] for p in pasajes])
    limpio = (tasas >= MIN_TASA) & (largos >= MIN_PALABRAS)

    grupos = np.array([g for g, _, _, _ in TODAS])
    idiomas = np.array([i for _, i, _, _ in TODAS])

    L = ["=" * 78,
         "PASAJES BASURA — cuanto del solapamiento causan",
         "=" * 78,
         f"filtro: tasa de palabras funcionales inglesas >= {MIN_TASA}"
         f" y >= {MIN_PALABRAS} palabras",
         f"corpus: {len(pasajes):,} pasajes  ->  {int(limpio.sum()):,} se conservan,"
         f" {int((~limpio).sum()):,} se descartan ({(~limpio).mean():.1%})",
         ""]

    L.append("--- muestra de lo que se descarta ---")
    for j in np.flatnonzero(~limpio)[:8]:
        L.append(f"  R-{pasajes[j]['num']:<5} tasa={tasas[j]:.2f} pal={largos[j]:<4}"
                 f" {pasajes[j]['texto'][:95]}")
    L.append("")
    L.append("--- muestra de lo que se conserva ---")
    for j in np.flatnonzero(limpio)[:4]:
        L.append(f"  R-{pasajes[j]['num']:<5} tasa={tasas[j]:.2f} pal={largos[j]:<4}"
                 f" {pasajes[j]['texto'][:95]}")
    L.append("")

    for etq, mascara in [("ANTES — los 1.504", np.ones(len(pasajes), bool)),
                         (f"DESPUES — los {int(limpio.sum()):,} limpios", limpio)]:
        cos = (emb_con @ emb_pas[mascara].T).max(axis=1)
        L += ["-" * 78, etq, "-" * 78]
        for idi, nom in [("es", "espanol"), ("en", "ingles")]:
            m = idiomas == idi
            d, f = cos[m & (grupos == "dentro")], cos[m & (grupos == "fuera")]
            t, acc = mejor_umbral(d, f)
            L.append(f"  {nom:8s}  AUC={auc(d, f):.4f}  margen={d.min() - f.max():+.4f}"
                     f"  tau={t:.4f}  exactitud={acc:.1%}"
                     f"   (media dentro={d.mean():.4f}  fuera={f.mean():.4f})")
        d, f = cos[grupos == "dentro"], cos[grupos == "fuera"]
        L.append(f"  {'global':8s}  AUC={auc(d, f):.4f}  margen={d.min() - f.max():+.4f}")
        L.append("")

    texto = "\n".join(L)
    (RES / "pasajes_basura.txt").write_text(texto + "\n", encoding="utf-8")
    print(texto)


if __name__ == "__main__":
    main()
