"""05 — Embebe los chunks y cuantiza el indice denso a int8.

Modelo: `intfloat/multilingual-e5-small`, 384 dimensiones. No es una opcion
entre varias: esta medido contra e5-base y la diferencia es +0,5 puntos por 2,4
veces los parametros (D-022, D-044). El MISMO modelo corre offline para el
corpus y en el navegador para la consulta — vectores de modelos distintos no
comparten espacio vectorial, asi que no es un cambio que se pueda hacer despues.

Prefijos obligatorios de e5: `passage: ` para el corpus, `query: ` para la
consulta. Sin ellos el modelo trabaja fuera de su entrenamiento.

Cuantizacion: escala global sobre vectores ya L2-normalizados (`03` v3). Con la
norma en 1, cada componente cae en [-1, 1] y basta multiplicar por 127. Una
escala por vector destruiria la comparabilidad del coseno entre chunks, que es
justo lo que el gate necesita.

Se emite tambien el float32 (gitignoreado) para poder medir cuanto desplaza la
cuantizacion los cosenos: si mueve tau mas de ~0,005, la Fase 2 tiene que
saberlo antes de escribir el gate, no despues.

Salidas:
    artifacts/index.bin         int8, 384 dims, una fila por chunk
    artifacts/index_meta.json   dimension, escala, orden de ids, mascara de voz
    out/index_f32.npy           float32, solo para medir la deriva
    reports/embed_report.md
"""

from __future__ import annotations

import json

import numpy as np

from common import (ARTIFACTS, OUT, REPORTS, asegurar_carpetas, leer_jsonl,
                    utf8_stdout)

MODELO = "intfloat/multilingual-e5-small"
DIMS = 384
ESCALA = 127.0


def main() -> int:
    utf8_stdout()
    asegurar_carpetas()

    chunks = leer_jsonl(OUT / "chunks.jsonl")
    textos = ["passage: " + c["embedText"] for c in chunks]
    print(f"chunks a embeber      : {len(chunks):>6,}")

    from sentence_transformers import SentenceTransformer
    modelo = SentenceTransformer(MODELO)
    vecs = np.asarray(modelo.encode(textos, normalize_embeddings=True,
                                    batch_size=64, show_progress_bar=True),
                      dtype=np.float32)
    assert vecs.shape == (len(chunks), DIMS), vecs.shape

    # -- cuantizacion int8 con escala global
    q = np.clip(np.rint(vecs * ESCALA), -127, 127).astype(np.int8)
    recon = q.astype(np.float32) / ESCALA
    # renormalizar la reconstruccion: el redondeo mueve la norma
    recon /= np.linalg.norm(recon, axis=1, keepdims=True)

    # -- cuanto desplaza la cuantizacion el coseno
    muestra = np.random.default_rng(42).choice(len(chunks), min(400, len(chunks)),
                                               replace=False)
    cos_f32 = vecs[muestra] @ vecs.T
    cos_i8 = recon[muestra] @ recon.T
    dif = np.abs(cos_f32 - cos_i8)
    # El maximo de cada fila es el chunk consigo mismo, que da 1,0 exacto en las
    # dos representaciones y haria parecer que la cuantizacion no mueve nada.
    # Se excluye la diagonal: lo que el gate umbraliza es el maximo contra OTRO
    # chunk, que es lo que hace una consulta real.
    for fila, idx in enumerate(muestra):
        cos_f32[fila, idx] = -np.inf
        cos_i8[fila, idx] = -np.inf
    maxima_f32 = cos_f32.max(axis=1)
    maxima_i8 = cos_i8.max(axis=1)
    dif_max = np.abs(maxima_f32 - maxima_i8)
    cambio_argmax = float(np.mean(cos_f32.argmax(axis=1) != cos_i8.argmax(axis=1)))

    print(f"deriva de la cuantizacion:")
    print(f"  |cos_f32 - cos_int8|   media {dif.mean():.6f}  p99 {np.percentile(dif, 99):.6f}"
          f"  max {dif.max():.6f}")
    print(f"  sobre el cos_max       media {dif_max.mean():.6f}  max {dif_max.max():.6f}")
    print(f"  el vecino mas cercano cambia en {cambio_argmax:.1%} de los casos")
    critico = dif_max.max() > 0.005

    ARTIFACTS.joinpath("index.bin").write_bytes(q.tobytes())
    np.save(OUT / "index_f32.npy", vecs)
    meta = {
        "model": MODELO, "dims": DIMS, "dtype": "int8", "scale": ESCALA,
        "count": len(chunks),
        "queryPrefix": "query: ", "passagePrefix": "passage: ",
        "ids": [c["id"] for c in chunks],
        "voice": [c["voice"] for c in chunks],
        "quantizationDrift": {"meanAbs": float(dif.mean()),
                              "maxAbs": float(dif.max()),
                              "maxOnCosMax": float(dif_max.max()),
                              "argmaxChangeRate": cambio_argmax},
    }
    ARTIFACTS.joinpath("index_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    tam = ARTIFACTS.joinpath("index.bin").stat().st_size
    n_leo = sum(1 for c in chunks if c["voice"] == "leonardo")
    print(f"index.bin             : {tam/1024:>6.0f} KB  ({len(chunks):,} x {DIMS} int8)")

    rep = ["# Reporte de embeddings", "",
           f"- Modelo: `{MODELO}` · {DIMS} dimensiones · prefijos `passage: ` / `query: `",
           f"- Chunks: **{len(chunks):,}** ({n_leo:,} de Leonardo, "
           f"{len(chunks)-n_leo:,} de Richter)",
           f"- `index.bin`: **{tam/1024:.0f} KB** — esperado ~0,8 MB (`02` v3)",
           "",
           "## Deriva de la cuantizacion int8", "",
           "Escala global sobre vectores ya L2-normalizados, y renormalizacion de la",
           "reconstruccion. Medido sobre 400 chunks al azar contra el corpus completo:",
           "",
           "| | media | p99 | max |", "|---|---:|---:|---:|",
           f"| `abs(cos_f32 - cos_int8)` | {dif.mean():.6f} | "
           f"{np.percentile(dif, 99):.6f} | {dif.max():.6f} |",
           f"| sobre el `cos_max` (lo que umbraliza el gate) | {dif_max.mean():.6f} | — | "
           f"{dif_max.max():.6f} |",
           "",
           f"El vecino mas cercano cambia en **{cambio_argmax:.1%}** de los casos. La "
           "diagonal se excluye: cada chunk se encuentra a si mismo con coseno 1,0 "
           "exacto en las dos representaciones, y dejarla adentro hace parecer que la "
           "cuantizacion no mueve nada.",
           "",
           ("> **Atencion:** la deriva sobre `cos_max` supera 0,005. La Fase 2 tiene "
            "que calibrar tau sobre el int8 final, no sobre el float32."
            if critico else
            "La deriva sobre `cos_max` se mantiene por debajo de 0,005, que es un orden "
            "de magnitud menor que la distancia entre los dos umbrales por idioma "
            "(0,0575). **Cuantizar no mueve la decision del gate.** Aun asi tau se "
            "calibra sobre el int8 final (D-038), porque es lo que corre en produccion."),
           ""]
    (REPORTS / "embed_report.md").write_text("\n".join(rep) + "\n", encoding="utf-8")
    print(f"\nartefactos -> {ARTIFACTS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
