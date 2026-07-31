"""
¿Rompe el techo un cross-encoder?

Los diseños de 06 y 07 se amontonan todos entre 88% y 90%. Ese techo no es del
modelo (e5-base no lo movio) ni de la formula del score (ninguna normalizacion
lo movio). La hipotesis es que el techo es del BI-ENCODER: comprime pregunta y
pasaje en dos vectores por separado y despues los compara. Nunca los lee juntos.

Un CROSS-ENCODER si los lee juntos y emite un juicio de relevancia. Es el
mismo salto que hay entre "estos dos textos se parecen" y "este texto responde
esta pregunta", que es la pregunta que el gate necesita contestar.

Diseño de la prueba: e5 propone los K mejores pasajes (barato), el
cross-encoder los juzga (caro pero solo K veces), y el gate usa el MAXIMO
puntaje del cross-encoder.

Importa tambien si el cross-encoder sufre el mismo desplazamiento por idioma.
Si no lo sufre, ademas de subir la exactitud elimina la necesidad de dos
umbrales, y el diseño entero se simplifica.
"""

import json
import sys
import time
from pathlib import Path

import numpy as np

from consultas import TODAS

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AQUI = Path(__file__).parent
DATA = AQUI / "data"
RES = AQUI / "resultados"

K = 10                       # candidatos que e5 le pasa al cross-encoder
RERANKERS = [
    "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1",   # ~120 MB, multilingue, rapido
    "BAAI/bge-reranker-v2-m3",                      # ~2,2 GB, multilingue, fuerte
]


def mejor_umbral(d, f):
    v = np.unique(np.concatenate([d, f]))
    cortes = np.concatenate([[v[0] - 1e-4], (v[:-1] + v[1:]) / 2, [v[-1] + 1e-4]])
    acc = 0.5 * ((d[None, :] >= cortes[:, None]).mean(1) + (f[None, :] < cortes[:, None]).mean(1))
    return float(cortes[np.flatnonzero(acc == acc.max())[-1]]), float(acc.max())


def auc(d, f):
    return float((np.sign(d[:, None] - f[None, :]) / 2 + 0.5).mean())


def informe(nombre, punt, grupos, idiomas, L):
    d, f = punt[grupos == "dentro"], punt[grupos == "fuera"]
    t_u, acc_u = mejor_umbral(d, f)
    L.append(f"  {nombre}")
    L.append(f"    umbral UNICO : AUC={auc(d, f):.4f}  exactitud={acc_u:.1%}  tau={t_u:.4f}")
    aciertos, taus = 0, {}
    for idi in ("es", "en"):
        m = idiomas == idi
        dd, ff = punt[m & (grupos == "dentro")], punt[m & (grupos == "fuera")]
        t, a = mejor_umbral(dd, ff)
        taus[idi] = t
        aciertos += int((dd >= t).sum() + (ff < t).sum())
        L.append(f"      {idi}: AUC={auc(dd, ff):.4f}  exactitud={a:.1%}  tau={t:+.4f}"
                 f"  margen={dd.min() - ff.max():+.4f}")
    L.append(f"    umbral POR IDIOMA: exactitud={aciertos / len(punt):.1%}"
             f"   distancia entre taus={abs(taus['en'] - taus['es']):.4f}")
    # con el umbral unico, cuanto se cuela y cuanto se bloquea de mas
    L.append(f"    con el umbral unico: pasan {(d >= t_u).mean():.1%} de las 'dentro',"
             f" se cuelan {(f >= t_u).mean():.1%} de las 'fuera'")
    L.append("")
    return acc_u, aciertos / len(punt)


def main():
    pasajes = [json.loads(l) for l in (DATA / "pasajes.jsonl").open(encoding="utf-8")]
    z = np.load(DATA / "emb_cache.npz", allow_pickle=True)
    sim = z["emb_con"] @ z["emb_pas"].T

    grupos = np.array([g for g, _, _, _ in TODAS])
    idiomas = np.array([i for _, i, _, _ in TODAS])

    # los K candidatos que propone e5 para cada consulta
    top = np.argsort(-sim, axis=1)[:, :K]

    L = ["=" * 78,
         "¿ROMPE EL TECHO UN CROSS-ENCODER?",
         "=" * 78,
         f"e5-small propone K={K} candidatos por consulta; el cross-encoder los juzga.",
         f"consultas: {len(TODAS)}   pasajes: {len(pasajes):,}",
         "",
         "-" * 78, "LINEA DE BASE — el bi-encoder solo", "-" * 78]
    informe("e5-small, coseno maximo", sim.max(axis=1), grupos, idiomas, L)

    from sentence_transformers import CrossEncoder

    for nombre in RERANKERS:
        cache = DATA / f"ce_{nombre.split('/')[-1]}.npy"
        if cache.exists():
            puntajes = np.load(cache)
        else:
            print(f"cargando {nombre}...")
            try:
                ce = CrossEncoder(nombre, max_length=512)
            except Exception as e:
                L += [f"  {nombre}: NO SE PUDO CARGAR ({type(e).__name__}: {e})", ""]
                print(f"  fallo: {e}")
                continue
            pares, t0 = [], time.time()
            for i in range(len(TODAS)):
                for j in top[i]:
                    pares.append((TODAS[i][2], pasajes[j]["texto"][:1800]))
            print(f"  juzgando {len(pares):,} pares...")
            crudo = np.asarray(ce.predict(pares, batch_size=32, show_progress_bar=False))
            puntajes = crudo.reshape(len(TODAS), K)
            np.save(cache, puntajes)
            print(f"  {time.time() - t0:.1f}s  ({(time.time() - t0) / len(TODAS) * 1000:.0f} ms/consulta)")

        L += ["-" * 78, f"CROSS-ENCODER — {nombre}", "-" * 78]
        informe("puntaje maximo del cross-encoder", puntajes.max(axis=1), grupos, idiomas, L)

    # ---- que consultas siguen fallando con el mejor diseño ----
    mejores = [f for f in [DATA / f"ce_{n.split('/')[-1]}.npy" for n in RERANKERS] if f.exists()]
    if mejores:
        punt = np.load(mejores[-1]).max(axis=1)
        t, _ = mejor_umbral(punt[grupos == "dentro"], punt[grupos == "fuera"])
        L += ["-" * 78,
              f"LAS QUE SIGUEN FALLANDO — {mejores[-1].stem}, umbral unico {t:.4f}",
              "-" * 78]
        for i, (g, idi, txt, _) in enumerate(TODAS):
            ok = (punt[i] >= t) if g == "dentro" else (punt[i] < t)
            if not ok:
                j = top[i][int(np.argmax(np.load(mejores[-1])[i]))]
                L.append(f"  [{g}/{idi}] {punt[i]:+.3f}  {txt}")
                L.append(f"        -> R-{pasajes[j]['num']}: {pasajes[j]['texto'][:130]}")

    texto = "\n".join(L)
    (RES / "cross_encoder.txt").write_text(texto + "\n", encoding="utf-8")
    print(texto)


if __name__ == "__main__":
    main()
