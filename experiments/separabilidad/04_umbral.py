"""
Medicion del umbral con las 190 consultas, contra los 1.504 pasajes.

Que agrega respecto de 02_separabilidad.py:
  - las 190 consultas (tanda 1 + tanda 2), no 40
  - el corpus COMPLETO, que es el escenario real; la muestra de 200 era una
    limitacion del experimento exploratorio y deprimia el grupo "dentro"
  - intervalo de confianza por bootstrap sobre el umbral y sobre el margen,
    que es lo que la tanda 1 no podia dar
  - puntos de operacion: cuanto cuesta en abstenciones llevar los falsos
    aceptados a cero (D-020: del lado conservador)
  - revision de etiquetas: las consultas cuyo resultado sugiere que la
    etiqueta dentro/fuera puesta a mano podria estar mal

Salidas en resultados/:
  umbral.png            distribuciones por idioma con los umbrales
  umbral_consultas.csv  las 190 con su coseno y el pasaje recuperado
  umbral_informe.txt
  revision_etiquetas.txt
"""

import csv
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
MODELO = "intfloat/multilingual-e5-small"
N_BOOT = 4000
SEMILLA = 42


# --------------------------------------------------------------------------

def cargar():
    pasajes = [json.loads(l) for l in (DATA / "pasajes.jsonl").open(encoding="utf-8")]
    cache = DATA / "emb_cache.npz"
    textos_q = [t for _, _, t, _ in TODAS]

    if cache.exists():
        z = np.load(cache, allow_pickle=True)
        if len(z["consultas"]) == len(textos_q) and list(z["consultas"]) == textos_q:
            print(f"embeddings desde cache ({len(pasajes):,} pasajes, {len(textos_q)} consultas)")
            return pasajes, z["emb_pas"], z["emb_con"]

    from sentence_transformers import SentenceTransformer
    modelo = SentenceTransformer(MODELO)

    def enc(xs):
        return np.asarray(modelo.encode(xs, normalize_embeddings=True,
                                        batch_size=32, show_progress_bar=False))

    print(f"embebiendo {len(pasajes):,} pasajes y {len(textos_q)} consultas...")
    emb_pas = enc(["passage: " + p["texto"] for p in pasajes])
    emb_con = enc(["query: " + t for t in textos_q])
    np.savez(cache, emb_pas=emb_pas, emb_con=emb_con, consultas=np.array(textos_q, dtype=object))
    return pasajes, emb_pas, emb_con


# --------------------------------------------------------------------------
# metricas
# --------------------------------------------------------------------------

def mejor_umbral(d, f):
    """Umbral que maximiza la exactitud balanceada; ante empates, el mas alto."""
    v = np.unique(np.concatenate([d, f]))
    cortes = np.concatenate([[v[0] - 1e-4], (v[:-1] + v[1:]) / 2, [v[-1] + 1e-4]])
    acc = 0.5 * ((d[None, :] >= cortes[:, None]).mean(1) + (f[None, :] < cortes[:, None]).mean(1))
    mejores = np.flatnonzero(acc == acc.max())
    return float(cortes[mejores[-1]]), float(acc.max())


def auc(d, f):
    return float((np.sign(d[:, None] - f[None, :]) / 2 + 0.5).mean())


def margen(d, f):
    return float(d.min() - f.max())


def bootstrap(d, f, rng):
    """IC del 95% sobre umbral, margen y AUC remuestreando consultas."""
    ts, ms, aa = [], [], []
    for _ in range(N_BOOT):
        dd = rng.choice(d, len(d), replace=True)
        ff = rng.choice(f, len(f), replace=True)
        ts.append(mejor_umbral(dd, ff)[0])
        ms.append(margen(dd, ff))
        aa.append(auc(dd, ff))
    q = lambda x: (float(np.percentile(x, 2.5)), float(np.percentile(x, 97.5)))
    return {"umbral": q(ts), "margen": q(ms), "auc": q(aa)}


def tau_conservador(d, f):
    """El umbral mas bajo que NO deja pasar ninguna consulta 'fuera' (D-020),
    y lo que cuesta: cuantas 'dentro' quedan bloqueadas."""
    t = float(np.nextafter(f.max(), 1.0))
    return t, float((d >= t).mean())


# --------------------------------------------------------------------------
# grafico
# --------------------------------------------------------------------------

C_D, C_F = "#1f6f4a", "#b03030"


def graficar(cos, grupos, idiomas, taus, destino):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from scipy.stats import gaussian_kde

    lo, hi = cos.min() - 0.02, cos.max() + 0.02
    x = np.linspace(lo, hi, 500)
    bins = np.linspace(lo, hi, 46)
    ancho = bins[1] - bins[0]

    fig, axes = plt.subplots(2, 1, figsize=(11, 8.4), dpi=160, sharex=True)
    for ax, idi, nom in [(axes[0], "es", "ESPAÑOL"), (axes[1], "en", "INGLÉS")]:
        m = idiomas == idi
        d, f = cos[m & (grupos == "dentro")], cos[m & (grupos == "fuera")]
        ax.hist(d, bins=bins, color=C_D, alpha=0.30)
        ax.hist(f, bins=bins, color=C_F, alpha=0.30)
        for datos, color, etq in [(d, C_D, f"DENTRO del corpus (n={len(d)})"),
                                  (f, C_F, f"FUERA del corpus (n={len(f)})")]:
            ax.plot(x, gaussian_kde(datos)(x) * len(datos) * ancho, color=color, lw=2.2,
                    label=etq)
            ax.plot(datos, np.full_like(datos, -0.6), "|", color=color, ms=9, mew=1.3)

        t_opt, t_cons = taus[idi]
        tope = ax.get_ylim()[1]
        ax.axvline(t_opt, color="#222", ls="--", lw=1.5)
        ax.text(t_opt, tope * 0.98, f" τ óptimo {t_opt:.4f}", fontsize=8.8, va="top")
        ax.axvline(t_cons, color="#1a4f8a", ls=":", lw=1.8)
        ax.text(t_cons, tope * 0.80, f" τ conservador {t_cons:.4f}", fontsize=8.8,
                va="top", color="#1a4f8a")

        mg = margen(d, f)
        estado = f"margen {mg:+.4f}" if mg > 0 else f"SOLAPAN {-mg:.4f}"
        ax.set_title(f"{nom} — AUC {auc(d, f):.4f} · {estado}",
                     fontsize=11, loc="left", pad=6)
        ax.legend(frameon=False, fontsize=9, loc="upper left")
        ax.set_ylim(bottom=-1.4)
        ax.spines[["top", "right"]].set_visible(False)
        ax.grid(axis="y", alpha=0.16)

    axes[1].set_xlabel("coseno máximo contra los 1.504 pasajes", fontsize=10.5)
    axes[0].set_ylabel("consultas", fontsize=10.5)
    fig.suptitle("Umbral de abstención con 190 consultas · corpus completo\n"
                 "multilingual-e5-small · Notebooks de Leonardo (Richter 1888)",
                 fontsize=12, y=0.985)
    fig.tight_layout(rect=(0, 0, 1, 0.945))
    fig.savefig(destino)
    plt.close(fig)
    print(f"grafico -> {destino}")


# --------------------------------------------------------------------------

def bloque(nom, d, f, rng, L):
    t_opt, acc = mejor_umbral(d, f)
    t_con, rec_con = tau_conservador(d, f)
    ic = bootstrap(d, f, rng)
    mg = margen(d, f)
    L += [f"  {nom}",
          f"    dentro  n={len(d):3d}  media={d.mean():.4f}  desvio={d.std(ddof=1):.4f}"
          f"  min={d.min():.4f}  max={d.max():.4f}",
          f"    fuera   n={len(f):3d}  media={f.mean():.4f}  desvio={f.std(ddof=1):.4f}"
          f"  min={f.min():.4f}  max={f.max():.4f}",
          f"    AUC    = {auc(d, f):.4f}   IC95% [{ic['auc'][0]:.4f}, {ic['auc'][1]:.4f}]",
          f"    MARGEN = {mg:+.4f}   IC95% [{ic['margen'][0]:+.4f}, {ic['margen'][1]:+.4f}]"
          + ("   (positivo = separacion limpia)" if mg > 0 else "   (NEGATIVO = se pisan)"),
          f"    tau optimo      = {t_opt:.4f}  IC95% [{ic['umbral'][0]:.4f}, {ic['umbral'][1]:.4f}]"
          f"   exactitud balanceada = {acc:.1%}",
          f"      -> deja pasar {(d >= t_opt).mean():.1%} de las 'dentro'"
          f" y bloquea {(f < t_opt).mean():.1%} de las 'fuera'",
          f"    tau conservador = {t_con:.4f}   0 falsos aceptados",
          f"      -> cuesta abstenerse en {1 - rec_con:.1%} de las 'dentro'"
          f" ({int(round((1 - rec_con) * len(d)))} de {len(d)})"]

    L.append("    puntos de operacion:")
    L.append("        tau      'dentro' que pasan     'fuera' que se cuelan")
    for pct in [100, 99, 97, 95, 90]:
        t = float(np.percentile(f, pct))
        L.append(f"      {t:.4f}         {(d >= t).mean():6.1%}                  {(f >= t).mean():6.1%}"
                 f"   (percentil {pct} de 'fuera')")
    L.append("")
    return t_opt, t_con


def main():
    RES.mkdir(exist_ok=True)
    rng = np.random.default_rng(SEMILLA)
    pasajes, emb_pas, emb_con = cargar()

    sim = emb_con @ emb_pas.T
    cos = sim.max(axis=1)
    idx = sim.argmax(axis=1)

    grupos = np.array([g for g, _, _, _ in TODAS])
    idiomas = np.array([i for _, i, _, _ in TODAS])
    tandas = np.array([n for _, _, _, n in TODAS])

    L = ["=" * 78,
         "UMBRAL DE ABSTENCION — 190 consultas contra los 1.504 pasajes",
         "=" * 78,
         f"modelo   : {MODELO}, prefijos 'passage: ' / 'query: '",
         f"consultas: 190 (95 dentro / 95 fuera, 95 es / 95 en)",
         f"           tanda 1 = 40 exploratorias, tanda 2 = 150 nuevas",
         f"corpus   : los 1.504 pasajes completos (no la muestra de 200)",
         f"bootstrap: {N_BOOT:,} remuestreos, semilla {SEMILLA}",
         "",
         "-" * 78, "GLOBAL — un solo umbral para los dos idiomas", "-" * 78]
    bloque("las 190 juntas", cos[grupos == "dentro"], cos[grupos == "fuera"], rng, L)

    L += ["-" * 78, "POR IDIOMA — un umbral para cada uno", "-" * 78]
    taus = {}
    for idi, nom in [("es", "ESPAÑOL (95)"), ("en", "INGLES (95)")]:
        m = idiomas == idi
        taus[idi] = bloque(nom, cos[m & (grupos == "dentro")],
                           cos[m & (grupos == "fuera")], rng, L)

    L += ["-" * 78, "EL DESPLAZAMIENTO ENTRE IDIOMAS", "-" * 78]
    for g in ["dentro", "fuera"]:
        e = cos[(idiomas == "es") & (grupos == g)].mean()
        n = cos[(idiomas == "en") & (grupos == g)].mean()
        L.append(f"    media {g:6s}:  es={e:.4f}   en={n:.4f}   diferencia={n - e:+.4f}")
    L += [f"    distancia entre los dos tau optimos = {taus['en'][0] - taus['es'][0]:+.4f}",
          "    Esa distancia es el motivo por el que un umbral unico no sirve.", ""]

    L += ["-" * 78, "TANDA 1 vs TANDA 2 — ¿se sostiene el resultado exploratorio?", "-" * 78]
    for t in (1, 2):
        m = tandas == t
        for idi in ("es", "en"):
            mm = m & (idiomas == idi)
            d, f = cos[mm & (grupos == "dentro")], cos[mm & (grupos == "fuera")]
            L.append(f"    tanda {t} · {idi}:  n={len(d)}+{len(f)}  AUC={auc(d, f):.4f}"
                     f"  margen={margen(d, f):+.4f}  tau={mejor_umbral(d, f)[0]:.4f}")
    L.append("")

    # ---------------- pasajes iman ----------------
    from collections import Counter
    iman = Counter(idx[i] for i in range(len(TODAS)) if grupos[i] == "fuera")
    L += ["-" * 78, "PASAJES IMAN — absorben consultas 'fuera' y comen margen", "-" * 78]
    for j, n in iman.most_common(6):
        if n >= 3:
            L.append(f"    {n:3d} consultas -> R-{pasajes[j]['num']}"
                     f" ({pasajes[j]['n_palabras']} palabras): {pasajes[j]['texto'][:130]}...")
    L.append("")

    graficar(cos, grupos, idiomas, taus, RES / "umbral.png")

    # ---------------- tabla ----------------
    ruta = RES / "umbral_consultas.csv"
    with ruta.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(["tanda", "grupo", "idioma", "consulta", "cos_max",
                    "tau_idioma", "clasifica_bien", "pasaje_num", "pasaje_recuperado"])
        for i, (g, idi, txt, tn) in enumerate(TODAS):
            t = taus[idi][0]
            ok = (cos[i] >= t) if g == "dentro" else (cos[i] < t)
            w.writerow([tn, g, idi, txt, f"{cos[i]:.4f}", f"{t:.4f}",
                        "si" if ok else "NO", pasajes[idx[i]]["num"],
                        pasajes[idx[i]]["texto"][:400]])
    print(f"tabla   -> {ruta}")

    # ---------------- revision de etiquetas ----------------
    R = ["Consultas a revisar a mano: el resultado sugiere que la etiqueta puesta",
         "a mano podria estar mal. Si una 'dentro' recupera un pasaje que no tiene",
         "nada que ver, el corpus quiza no cubra ese tema y la etiqueta es optimista.",
         "Si una 'fuera' recupera algo pertinente, quiza el corpus si lo cubra.",
         "Esto NO se corrigio automaticamente: los numeros de arriba usan las",
         "etiquetas originales.", ""]
    for idi in ("es", "en"):
        m = idiomas == idi
        d = cos[m & (grupos == "dentro")]
        f = cos[m & (grupos == "fuera")]
        R.append(f"--- {idi} · las 8 'dentro' mas bajas -------------------------------")
        ord_d = [i for i in np.argsort(cos) if idiomas[i] == idi and grupos[i] == "dentro"][:8]
        for i in ord_d:
            R.append(f"  {cos[i]:.4f}  {TODAS[i][2]}")
            R.append(f"          -> R-{pasajes[idx[i]]['num']}: {pasajes[idx[i]]['texto'][:150]}")
        R.append(f"--- {idi} · las 8 'fuera' mas altas --------------------------------")
        ord_f = [i for i in np.argsort(-cos) if idiomas[i] == idi and grupos[i] == "fuera"][:8]
        for i in ord_f:
            R.append(f"  {cos[i]:.4f}  {TODAS[i][2]}")
            R.append(f"          -> R-{pasajes[idx[i]]['num']}: {pasajes[idx[i]]['texto'][:150]}")
        R.append("")
    (RES / "revision_etiquetas.txt").write_text("\n".join(R) + "\n", encoding="utf-8")
    print(f"revision-> {RES / 'revision_etiquetas.txt'}")

    texto = "\n".join(L)
    (RES / "umbral_informe.txt").write_text(texto + "\n", encoding="utf-8")
    print(f"informe -> {RES / 'umbral_informe.txt'}\n")
    print(texto, flush=True)


if __name__ == "__main__":
    main()
