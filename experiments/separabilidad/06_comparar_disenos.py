"""
Compara los disenos posibles del gate sobre las MISMAS 190 consultas.

  1. crudo + umbral unico          — lo que estaba planteado al principio
  2. crudo + umbral por idioma     — detectar idioma y asignar tau
  3. score normalizado + umbral unico — cancelar el desplazamiento en vez de
                                        compensarlo con dos numeros
  4. traducir la consulta al ingles + umbral unico

El (4) se mide sin traductor automatico: las consultas en es y en en son
paralelas (la misma pregunta en los dos idiomas), asi que usar el embedding
de la version inglesa ES el resultado de una traduccion perfecta. Da la COTA
SUPERIOR de lo que puede rendir traducir: un traductor real solo puede empeorarla.

La normalizacion parte de que el desplazamiento por idioma es aproximadamente
un corrimiento aditivo sobre TODAS las similitudes de esa consulta. Si es asi,
comparar el mejor pasaje contra el fondo de esa misma consulta lo cancela solo.
"""

import json
import sys
from pathlib import Path

import numpy as np

from consultas import TANDA_1, TANDA_2, TODAS

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AQUI = Path(__file__).parent
DATA = AQUI / "data"
RES = AQUI / "resultados"


def mejor_umbral(d, f):
    v = np.unique(np.concatenate([d, f]))
    cortes = np.concatenate([[v[0] - 1e-4], (v[:-1] + v[1:]) / 2, [v[-1] + 1e-4]])
    acc = 0.5 * ((d[None, :] >= cortes[:, None]).mean(1) + (f[None, :] < cortes[:, None]).mean(1))
    return float(cortes[np.flatnonzero(acc == acc.max())[-1]]), float(acc.max())


def auc(d, f):
    return float((np.sign(d[:, None] - f[None, :]) / 2 + 0.5).mean())


# --------------------------------------------------------------------------
# emparejar las consultas paralelas es <-> en
# --------------------------------------------------------------------------

def pares_paralelos():
    """Devuelve [(idx_es, idx_en)] para las consultas que son la misma pregunta.
    Dentro de cada (tanda, grupo) las listas es/en van en el mismo orden; las
    sobrantes del final no tienen pareja y se descartan."""
    pos = {}
    for i, (g, idi, _, tn) in enumerate(TODAS):
        pos.setdefault((tn, g, idi), []).append(i)
    pares = []
    for tn in (1, 2):
        for g in ("dentro", "fuera"):
            a, b = pos[(tn, g, "es")], pos[(tn, g, "en")]
            pares += list(zip(a, b))
    return pares


# --------------------------------------------------------------------------

def evaluar(nombre, punt, grupos, idiomas, L, por_idioma=True):
    d, f = punt[grupos == "dentro"], punt[grupos == "fuera"]
    t_g, acc_g = mejor_umbral(d, f)
    L.append(f"  {nombre}")
    L.append(f"    umbral UNICO   : AUC={auc(d, f):.4f}  exactitud={acc_g:.1%}"
             f"  tau={t_g:.4f}")
    if por_idioma:
        taus = {}
        aciertos = 0
        for idi in ("es", "en"):
            m = idiomas == idi
            dd, ff = punt[m & (grupos == "dentro")], punt[m & (grupos == "fuera")]
            t, a = mejor_umbral(dd, ff)
            taus[idi] = t
            aciertos += (dd >= t).sum() + (ff < t).sum()
            L.append(f"      {idi}: AUC={auc(dd, ff):.4f}  exactitud={a:.1%}  tau={t:.4f}"
                     f"  margen={dd.min() - ff.max():+.4f}")
        L.append(f"    umbral POR IDIOMA: exactitud global={aciertos / len(punt):.1%}"
                 f"   distancia entre taus={abs(taus['en'] - taus['es']):.4f}")
    L.append("")
    return acc_g


def main():
    pasajes = [json.loads(l) for l in (DATA / "pasajes.jsonl").open(encoding="utf-8")]
    z = np.load(DATA / "emb_cache.npz", allow_pickle=True)
    sim = z["emb_con"] @ z["emb_pas"].T          # (190, 1504)

    grupos = np.array([g for g, _, _, _ in TODAS])
    idiomas = np.array([i for _, i, _, _ in TODAS])

    crudo = sim.max(axis=1)
    media = sim.mean(axis=1)
    desvio = sim.std(axis=1)
    p50 = np.percentile(sim, 50, axis=1)
    p99 = np.percentile(sim, 99, axis=1)

    L = ["=" * 78,
         "COMPARACION DE DISENOS DEL GATE — mismas 190 consultas, mismo corpus",
         "=" * 78,
         f"pasajes: {len(pasajes):,}   consultas: {len(TODAS)}",
         "",
         "-" * 78,
         "1-2 · SCORE CRUDO (coseno maximo)",
         "-" * 78]
    evaluar("coseno maximo, tal cual", crudo, grupos, idiomas, L)

    L += ["-" * 78,
          "3 · SCORE NORMALIZADO — comparar el mejor pasaje contra el fondo",
          "-" * 78,
          "  Si el idioma corre TODAS las similitudes de una consulta por igual,",
          "  medir cuanto se despega el mejor del resto cancela ese corrimiento.",
          ""]
    variantes = [
        ("z-score  (max - media) / desvio", (crudo - media) / desvio),
        ("delta    max - media", crudo - media),
        ("delta99  max - percentil 99", crudo - p99),
        ("robusta  (max - p50) / (p99 - p50)", (crudo - p50) / (p99 - p50)),
    ]
    mejores = []
    for nom, punt in variantes:
        mejores.append((evaluar(nom, punt, grupos, idiomas, L), nom))

    L += ["-" * 78,
          "4 · TRADUCIR LA CONSULTA AL INGLES — cota superior",
          "-" * 78]
    pares = pares_paralelos()
    idx_es = np.array([a for a, _ in pares])
    idx_en = np.array([b for _, b in pares])
    L.append(f"  {len(pares)} consultas en espanol tienen su equivalente exacto en ingles.")
    L.append("  Se compara, sobre ESE mismo subconjunto, el score de la version")
    L.append("  espanola contra el de la version inglesa.")
    L.append("")

    g_par = grupos[idx_es]
    for etq, punt in [("sin traducir (embebida en espanol)", crudo[idx_es]),
                      ("traducida al ingles (cota superior)", crudo[idx_en])]:
        d, f = punt[g_par == "dentro"], punt[g_par == "fuera"]
        t, a = mejor_umbral(d, f)
        L.append(f"    {etq:38s}  AUC={auc(d, f):.4f}  exactitud={a:.1%}"
                 f"  tau={t:.4f}  margen={d.min() - f.max():+.4f}")

    # y el sistema entero si TODO se embebe en ingles
    todo_en = crudo.copy()
    todo_en[idx_es] = crudo[idx_en]
    L += ["", "  Sistema completo con todas las consultas llevadas a ingles:"]
    evaluar("    todo en ingles, umbral unico", todo_en, grupos, idiomas, L, por_idioma=False)

    L += ["-" * 78, "RESUMEN — exactitud con UN SOLO umbral", "-" * 78,
          f"    {'crudo':38s} {mejor_umbral(crudo[grupos == 'dentro'], crudo[grupos == 'fuera'])[1]:.1%}"]
    for acc, nom in mejores:
        L.append(f"    {nom:38s} {acc:.1%}")
    L.append(f"    {'todo traducido a ingles':38s} "
             f"{mejor_umbral(todo_en[grupos == 'dentro'], todo_en[grupos == 'fuera'])[1]:.1%}")

    texto = "\n".join(L)
    (RES / "comparacion_disenos.txt").write_text(texto + "\n", encoding="utf-8")
    print(texto)


if __name__ == "__main__":
    main()
