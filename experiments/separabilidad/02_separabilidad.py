"""
Experimento de separabilidad para el gate de abstencion (capa 1 de 05-anti-alucinacion).

Pregunta que responde: el coseno maximo entre la consulta y los pasajes, ¿separa
las preguntas que el corpus puede contestar de las que no? Si las dos
distribuciones se pisan, el gate por umbral no es viable y hay que rediseñar.

  - 200 pasajes al azar (semilla fija) de los 1.504 utilizables
  - multilingual-e5-small, prefijos "passage: " y "query: " que el modelo exige
  - 40 consultas: 20 dentro / 20 fuera, mitad es / mitad en
  - por consulta: coseno MAXIMO contra los 200 pasajes

Salidas en resultados/:
  separabilidad.png     las dos distribuciones superpuestas
  consultas.csv         las 40 consultas, su coseno max y el pasaje recuperado
  informe.txt           medias, desvios, solapamiento, umbral optimo, corte por idioma
"""

import json
import random
import sys
from pathlib import Path

import numpy as np

# la consola de Windows es cp1252 y no traga la tau del informe
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from consultas import CONSULTAS

AQUI = Path(__file__).parent
DATA = AQUI / "data"
RES = AQUI / "resultados"

SEMILLA = 42
N_PASAJES = 200
MODELO = "intfloat/multilingual-e5-small"


# --------------------------------------------------------------------------
# datos
# --------------------------------------------------------------------------

def cargar_pasajes() -> tuple[list[dict], list[dict]]:
    todos = [json.loads(l) for l in (DATA / "pasajes.jsonl").open(encoding="utf-8")]
    muestra = random.Random(SEMILLA).sample(todos, N_PASAJES)
    print(f"pasajes utilizables: {len(todos):,}  ->  muestra: {len(muestra)} (semilla {SEMILLA})")
    return muestra, todos


def embeber(pasajes: list[dict], todos: list[dict]):
    from sentence_transformers import SentenceTransformer

    modelo = SentenceTransformer(MODELO)
    print(f"modelo: {MODELO}  dim={modelo.get_embedding_dimension()}")

    def enc(textos):
        return np.asarray(modelo.encode(textos, normalize_embeddings=True,
                                        batch_size=32, show_progress_bar=False))

    # e5 exige los prefijos; sin ellos la calidad cae mucho
    emb_pas = enc(["passage: " + p["texto"] for p in pasajes])
    emb_con = enc(["query: " + c[2] for c in CONSULTAS])
    print(f"control: embebiendo los {len(todos):,} pasajes completos...")
    emb_todos = enc(["passage: " + p["texto"] for p in todos])
    return emb_pas, emb_con, emb_todos


# --------------------------------------------------------------------------
# metricas
# --------------------------------------------------------------------------

def mejor_umbral(dentro: np.ndarray, fuera: np.ndarray) -> tuple[float, float]:
    """Umbral que maximiza la exactitud balanceada. Ante empates, el mas alto
    (lado conservador: abstenerse de mas es preferible a inventar, D-020)."""
    candidatos = np.unique(np.concatenate([dentro, fuera]))
    cortes = np.concatenate([[candidatos[0] - 1e-4],
                             (candidatos[:-1] + candidatos[1:]) / 2,
                             [candidatos[-1] + 1e-4]])
    mejor_t, mejor_acc = None, -1.0
    for t in cortes:
        acc = 0.5 * ((dentro >= t).mean() + (fuera < t).mean())
        if acc > mejor_acc or (acc == mejor_acc and t > mejor_t):
            mejor_t, mejor_acc = float(t), float(acc)
    return mejor_t, mejor_acc


def auc(dentro: np.ndarray, fuera: np.ndarray) -> float:
    """AUC-ROC = P(un 'dentro' puntua mas alto que un 'fuera'). 0,5 = azar."""
    comp = dentro[:, None] - fuera[None, :]
    return float((np.sign(comp) / 2 + 0.5).mean())


def solapamiento(dentro: np.ndarray, fuera: np.ndarray) -> dict:
    lo, hi = float(dentro.min()), float(fuera.max())
    hay = lo < hi
    return {
        "hay": hay,
        "lo": lo,
        "hi": hi,
        "brecha": float(lo - hi),  # negativa si se pisan
        "n_dentro_en_zona": int(((dentro >= lo) & (dentro <= hi)).sum()) if hay else 0,
        "n_fuera_en_zona": int(((fuera >= lo) & (fuera <= hi)).sum()) if hay else 0,
    }


def cohen_d(a: np.ndarray, b: np.ndarray) -> float:
    s = np.sqrt(((len(a) - 1) * a.var(ddof=1) + (len(b) - 1) * b.var(ddof=1))
                / (len(a) + len(b) - 2))
    return float((a.mean() - b.mean()) / s)


# --------------------------------------------------------------------------
# grafico
# --------------------------------------------------------------------------

C_D, C_F = "#1f6f4a", "#b03030"


def _panel(ax, d, f, x, ancho, titulo, umbral, leyenda=False):
    from scipy.stats import gaussian_kde

    bins = np.linspace(x[0], x[-1], 34)
    ax.hist(d, bins=bins, color=C_D, alpha=0.28)
    ax.hist(f, bins=bins, color=C_F, alpha=0.28)
    for datos, color, etq in [(d, C_D, f"DENTRO del corpus (n={len(d)})"),
                              (f, C_F, f"FUERA del corpus (n={len(f)})")]:
        ax.plot(x, gaussian_kde(datos)(x) * len(datos) * ancho, color=color, lw=2.2,
                label=etq if leyenda else None)
        ax.plot(datos, np.full_like(datos, -0.20), "|", color=color, ms=10, mew=1.6)

    ax.axvline(umbral, color="#222", ls="--", lw=1.5)
    tope = ax.get_ylim()[1]
    ax.text(umbral, tope * 0.97, f"  τ = {umbral:.4f}", fontsize=9, va="top", color="#222")
    ax.set_title(titulo, fontsize=10.5, loc="left", pad=6)
    ax.set_ylim(bottom=-0.55)
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.16)
    if leyenda:
        ax.legend(frameon=False, fontsize=9.5, loc="upper left")


def graficar(cos, grupos, idiomas, t_glob, t_es, t_en, destino: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    lo, hi = cos.min() - 0.025, cos.max() + 0.025
    x = np.linspace(lo, hi, 400)
    ancho = (hi - lo) / 33

    fig, axes = plt.subplots(3, 1, figsize=(10.5, 10.6), dpi=160, sharex=True)
    es_d = grupos == "dentro"

    _panel(axes[0], cos[es_d], cos[~es_d], x, ancho,
           "A · Las 40 consultas juntas — las distribuciones se pisan", t_glob, leyenda=True)

    for ax, idi, nom, t in [(axes[1], "es", "B · Solo español (20)", t_es),
                            (axes[2], "en", "C · Solo inglés (20)", t_en)]:
        m = idiomas == idi
        _panel(ax, cos[m & es_d], cos[m & ~es_d], x, ancho, f"{nom} — τ propio", t)

    axes[2].set_xlabel("coseno máximo contra los 200 pasajes", fontsize=10.5)
    axes[1].set_ylabel("consultas", fontsize=10.5)
    fig.suptitle("Separabilidad del gate de abstención — multilingual-e5-small\n"
                 "Leonardo da Vinci, Notebooks (Richter 1888) · 200 pasajes · 40 consultas",
                 fontsize=12, y=0.985)
    fig.tight_layout(rect=(0, 0, 1, 0.955))
    fig.savefig(destino)
    plt.close(fig)
    print(f"grafico -> {destino}")


# --------------------------------------------------------------------------

def bloque_stats(nombre: str, d: np.ndarray, f: np.ndarray) -> list[str]:
    t, acc = mejor_umbral(d, f)
    sol = solapamiento(d, f)
    L = [
        f"  {nombre}",
        f"    dentro  n={len(d):2d}  media={d.mean():.4f}  desvio={d.std(ddof=1):.4f}"
        f"  min={d.min():.4f}  max={d.max():.4f}",
        f"    fuera   n={len(f):2d}  media={f.mean():.4f}  desvio={f.std(ddof=1):.4f}"
        f"  min={f.min():.4f}  max={f.max():.4f}",
        f"    separacion de medias = {d.mean() - f.mean():+.4f}   Cohen d = {cohen_d(d, f):.2f}"
        f"   AUC = {auc(d, f):.4f}",
    ]
    if sol["hay"]:
        L.append(f"    SOLAPAMIENTO en [{sol['lo']:.4f}, {sol['hi']:.4f}]"
                 f"  ancho={sol['hi'] - sol['lo']:.4f}"
                 f"  ({sol['n_dentro_en_zona']} dentro y {sol['n_fuera_en_zona']} fuera en la zona)")
    else:
        L.append(f"    SIN SOLAPAMIENTO — brecha limpia de {sol['brecha']:.4f}"
                 f"  (max fuera={sol['hi']:.4f} < min dentro={sol['lo']:.4f})")
    L.append(f"    umbral optimo τ = {t:.4f}   exactitud balanceada = {acc:.1%}"
             f"   |  dentro bien = {(d >= t).mean():.0%}   fuera bien = {(f < t).mean():.0%}")
    return L


def main() -> None:
    RES.mkdir(exist_ok=True)
    pasajes, todos = cargar_pasajes()
    emb_pas, emb_con, emb_todos = embeber(pasajes, todos)

    # vectores normalizados => producto punto = coseno
    sim = emb_con @ emb_pas.T                    # (40, 200)
    idx_max = sim.argmax(axis=1)
    cos_max = sim.max(axis=1)

    grupos = np.array([c[0] for c in CONSULTAS])
    idiomas = np.array([c[1] for c in CONSULTAS])
    d = cos_max[grupos == "dentro"]
    f = cos_max[grupos == "fuera"]

    t_glob, acc_glob = mejor_umbral(d, f)
    t_es, _ = mejor_umbral(cos_max[(idiomas == "es") & (grupos == "dentro")],
                           cos_max[(idiomas == "es") & (grupos == "fuera")])
    t_en, _ = mejor_umbral(cos_max[(idiomas == "en") & (grupos == "dentro")],
                           cos_max[(idiomas == "en") & (grupos == "fuera")])
    graficar(cos_max, grupos, idiomas, t_glob, t_es, t_en, RES / "separabilidad.png")

    # ---------------- tabla ----------------
    import csv
    ruta_csv = RES / "consultas.csv"
    with ruta_csv.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(["grupo", "idioma", "consulta", "cos_max", "clasifica_bien",
                    "pasaje_num", "pasaje_palabras", "pasaje_recuperado",
                    "cos_max_1504", "pasaje_num_1504", "pasaje_recuperado_1504"])
        sim_t = emb_con @ emb_todos.T
        cos_t, idx_t = sim_t.max(axis=1), sim_t.argmax(axis=1)
        for i, (g, idi, txt) in enumerate(CONSULTAS):
            p, q = pasajes[idx_max[i]], todos[idx_t[i]]
            ok = (cos_max[i] >= t_glob) if g == "dentro" else (cos_max[i] < t_glob)
            w.writerow([g, idi, txt, f"{cos_max[i]:.4f}", "si" if ok else "NO",
                        p["num"], p["n_palabras"], p["texto"][:400],
                        f"{cos_t[i]:.4f}", q["num"], q["texto"][:400]])
    print(f"tabla   -> {ruta_csv}")

    # ---------------- informe ----------------
    L = ["=" * 78,
         "EXPERIMENTO DE SEPARABILIDAD — gate de abstencion por coseno maximo",
         "=" * 78,
         f"corpus   : PG #5000, Notebooks of Leonardo da Vinci (Richter, 1888)",
         f"pasajes  : 1.504 utilizables (>= 8 palabras, sin las 864 notas de Richter)",
         f"muestra  : {N_PASAJES} al azar, semilla {SEMILLA}",
         f"modelo   : {MODELO}, prefijos 'passage: ' / 'query: '",
         f"consultas: 40 (20 dentro / 20 fuera, mitad es / mitad en)",
         "",
         "-" * 78,
         "GLOBAL",
         "-" * 78]
    L += bloque_stats("las 40 consultas", d, f)

    L += ["", "-" * 78, "POR IDIOMA", "-" * 78]
    for idi, nom in [("es", "ESPANOL"), ("en", "INGLES")]:
        m = idiomas == idi
        L += bloque_stats(nom, cos_max[m & (grupos == "dentro")],
                          cos_max[m & (grupos == "fuera")])
        L.append("")

    L += ["-" * 78,
          "EL UMBRAL GLOBAL APLICADO A CADA IDIOMA",
          "-" * 78,
          f"  (usando el mismo τ = {t_glob:.4f} para todos, que es lo que hara el sistema)"]
    for idi, nom in [("es", "espanol"), ("en", "ingles")]:
        m = idiomas == idi
        dd = cos_max[m & (grupos == "dentro")]
        ff = cos_max[m & (grupos == "fuera")]
        L.append(f"    {nom:8s}  dentro bien = {(dd >= t_glob).mean():5.0%} ({(dd >= t_glob).sum()}/{len(dd)})"
                 f"   fuera bien = {(ff < t_glob).mean():5.0%} ({(ff < t_glob).sum()}/{len(ff)})")

    L += ["", "-" * 78, "CONSULTAS MAL CLASIFICADAS CON EL UMBRAL GLOBAL", "-" * 78]
    fallos = 0
    for i, (g, idi, txt) in enumerate(CONSULTAS):
        ok = (cos_max[i] >= t_glob) if g == "dentro" else (cos_max[i] < t_glob)
        if not ok:
            fallos += 1
            L.append(f"    [{g}/{idi}] {cos_max[i]:.4f}  {txt}")
    if not fallos:
        L.append("    ninguna — las 40 caen del lado correcto")

    # ------- control: los mismos calculos contra los 1.504 pasajes -------
    d_t, f_t = cos_t[grupos == "dentro"], cos_t[grupos == "fuera"]
    t_t, acc_t = mejor_umbral(d_t, f_t)
    L += ["", "-" * 78,
          "CONTROL — los mismos calculos contra los 1.504 pasajes, no contra 200",
          "-" * 78,
          "  La muestra de 200 es el 13% del corpus: muchas consultas 'dentro' no tienen",
          "  material relevante en la muestra y puntuan bajo por eso, no porque el corpus",
          "  no las cubra. El indice real va a tener los 1.504. Este control mide cuanto",
          "  cambia la separabilidad al usarlos todos."]
    L += bloque_stats("los 1.504 pasajes", d_t, f_t)
    L.append(f"    desplazamiento vs. la muestra de 200:"
             f"  dentro {d_t.mean() - d.mean():+.4f}   fuera {f_t.mean() - f.mean():+.4f}")
    for idi, nom in [("es", "espanol"), ("en", "ingles")]:
        m = idiomas == idi
        dd, ff = cos_t[m & (grupos == "dentro")], cos_t[m & (grupos == "fuera")]
        tt, aa = mejor_umbral(dd, ff)
        L.append(f"    {nom:8s}  AUC={auc(dd, ff):.4f}  τ={tt:.4f}  exactitud={aa:.0%}"
                 f"   (media dentro={dd.mean():.4f}  fuera={ff.mean():.4f})"
                 f"   MARGEN={dd.min() - ff.max():+.4f}")
    L += ["",
          "  El margen es la distancia entre el 'fuera' mas alto y el 'dentro' mas bajo:",
          "  cuanto aire tiene el umbral antes de equivocarse. Un AUC de 1,00 con margen",
          "  de milesimas separa perfecto en ESTAS 40 consultas y no garantiza nada sobre",
          "  las siguientes 40."]

    # los pasajes iman: los que absorben muchas consultas 'fuera'
    from collections import Counter
    iman = Counter(idx_max[i] for i in range(len(CONSULTAS)) if CONSULTAS[i][0] == "fuera")
    L += ["", "-" * 78,
          "PASAJES IMAN — los que absorben varias consultas 'fuera' (muestra de 200)",
          "-" * 78]
    for j, n in iman.most_common(4):
        if n >= 2:
            L.append(f"    {n:2d} consultas -> R-{pasajes[j]['num']}"
                     f" ({pasajes[j]['n_palabras']} palabras): {pasajes[j]['texto'][:150]}...")

    L += ["", "-" * 78, "LOS EXTREMOS", "-" * 78,
          f"    'fuera' mas alto  : {f.max():.4f}",
          f"    'dentro' mas bajo : {d.min():.4f}"]
    i_f = int(np.where(cos_max == f.max())[0][0])
    i_d = int(np.where(cos_max == d.min())[0][0])
    for etq, i in [("fuera mas alto ", i_f), ("dentro mas bajo", i_d)]:
        L += [f"    {etq}: \"{CONSULTAS[i][2]}\"",
              f"      -> R-{pasajes[idx_max[i]]['num']}: {pasajes[idx_max[i]]['texto'][:220]}..."]

    texto = "\n".join(L)
    (RES / "informe.txt").write_text(texto + "\n", encoding="utf-8")
    print(f"informe -> {RES / 'informe.txt'}\n")
    print(texto, flush=True)


if __name__ == "__main__":
    main()
