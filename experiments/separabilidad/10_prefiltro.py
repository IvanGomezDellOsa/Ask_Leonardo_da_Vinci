"""
Si el coseno deja de DECIDIR y pasa a PRE-FILTRAR, ¿cuanto sirve?

La doc pone el gate como juez final: cos_max decide responder o abstenerse
antes de llamar al LLM. Medido, eso topa en 88-90% y el precio de no
equivocarse nunca es abstenerse casi siempre.

Otro reparto posible: el coseno solo descarta lo evidentemente perdido —barato
y sin tocar la cuota— y lo dudoso se lo lleva quien puede juzgarlo de verdad.
Para eso el umbral no se elige por exactitud sino por NO PERDER NADA: se fija
donde practicamente ninguna consulta contestable quede afuera.

Mide, a cada nivel de perdida aceptada, cuanto trafico basura se ataja gratis.
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


def main():
    z = np.load(DATA / "emb_cache.npz", allow_pickle=True)
    cos = (z["emb_con"] @ z["emb_pas"].T).max(axis=1)
    ce = np.load(DATA / "ce_bge-reranker-v2-m3.npy").max(axis=1)

    grupos = np.array([g for g, _, _, _ in TODAS])
    idiomas = np.array([i for _, i, _, _ in TODAS])

    L = ["=" * 78,
         "EL COSENO COMO PRE-FILTRO, NO COMO JUEZ",
         "=" * 78,
         "El umbral no se elige para maximizar exactitud sino para no perder",
         "consultas contestables. Lo que pasa el filtro va a un juicio mejor.",
         ""]

    for etq, punt, porid in [("coseno e5 (por idioma)", cos, True),
                             ("cross-encoder bge (umbral unico)", ce, False)]:
        L += ["-" * 78, etq, "-" * 78,
              "  perdida    tau            basura atajada     trafico que sigue",
              "  " + "-" * 62]
        for perdida in [0.00, 0.01, 0.02, 0.05, 0.10]:
            if porid:
                atajada = bloqueadas = total_f = pasan = total = 0
                taus = []
                for idi in ("es", "en"):
                    m = idiomas == idi
                    d = punt[m & (grupos == "dentro")]
                    f = punt[m & (grupos == "fuera")]
                    t = float(np.percentile(d, perdida * 100)) if perdida > 0 else float(d.min())
                    taus.append(t)
                    atajada += int((f < t).sum())
                    total_f += len(f)
                    bloqueadas += int((d < t).sum())
                    pasan += int((punt[m] >= t).sum())
                    total += int(m.sum())
                tau_txt = f"es {taus[0]:.4f} / en {taus[1]:.4f}"
            else:
                d, f = punt[grupos == "dentro"], punt[grupos == "fuera"]
                t = float(np.percentile(d, perdida * 100)) if perdida > 0 else float(d.min())
                atajada, total_f = int((f < t).sum()), len(f)
                bloqueadas = int((d < t).sum())
                pasan, total = int((punt >= t).sum()), len(punt)
                tau_txt = f"{t:+.4f}"
            L.append(f"  {perdida:5.0%}   {tau_txt:22s} {atajada:3d}/{total_f}"
                     f" ({atajada / total_f:4.0%})      {pasan}/{total} ({pasan / total:4.0%})")
        L.append("")

    # combinar los dos: coseno pre-filtra, cross-encoder juzga
    L += ["-" * 78,
          "LOS DOS EN CASCADA — coseno pre-filtra, cross-encoder juzga",
          "-" * 78]
    for perdida in [0.00, 0.02, 0.05]:
        pasa1 = np.zeros(len(TODAS), bool)
        for idi in ("es", "en"):
            m = idiomas == idi
            d = cos[m & (grupos == "dentro")]
            t = float(np.percentile(d, perdida * 100)) if perdida > 0 else float(d.min())
            pasa1 |= m & (cos >= t)
        # el cross-encoder decide entre las que pasaron
        d2 = ce[pasa1 & (grupos == "dentro")]
        f2 = ce[pasa1 & (grupos == "fuera")]
        if len(d2) == 0 or len(f2) == 0:
            continue
        v = np.unique(np.concatenate([d2, f2]))
        cortes = np.concatenate([[v[0] - 1e-4], (v[:-1] + v[1:]) / 2, [v[-1] + 1e-4]])
        # elegir el corte que maximiza exactitud sobre el TOTAL, contando como
        # acierto lo que el pre-filtro ya bloqueo bien
        mejor = (None, -1.0)
        for t2 in cortes:
            ok_d = int(((ce >= t2) & pasa1 & (grupos == "dentro")).sum())
            ok_f = int((((ce < t2) & pasa1 | ~pasa1) & (grupos == "fuera")).sum())
            acc = 0.5 * (ok_d / (grupos == "dentro").sum() + ok_f / (grupos == "fuera").sum())
            if acc > mejor[1]:
                mejor = (float(t2), acc)
        t2, acc = mejor
        ok_d = ((ce >= t2) & pasa1 & (grupos == "dentro")).mean() * len(TODAS) / (grupos == "dentro").sum()
        cuelan = (((ce >= t2) & pasa1) & (grupos == "fuera")).sum() / (grupos == "fuera").sum()
        L.append(f"  pre-filtro con {perdida:.0%} de perdida  +  cross-encoder tau={t2:+.4f}")
        L.append(f"      exactitud balanceada = {acc:.1%}"
                 f"   responde {ok_d:.1%} de las contestables"
                 f"   se cuela {cuelan:.1%} de la basura")
        L.append(f"      llamadas al juez caro: {int(pasa1.sum())}/{len(TODAS)}"
                 f" ({pasa1.mean():.0%} del trafico)")
    L.append("")

    texto = "\n".join(L)
    (RES / "prefiltro.txt").write_text(texto + "\n", encoding="utf-8")
    print(texto)


if __name__ == "__main__":
    main()
