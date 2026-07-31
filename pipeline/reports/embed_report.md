# Reporte de embeddings

- Modelo: `intfloat/multilingual-e5-small` · 384 dimensiones · prefijos `passage: ` / `query: `
- Chunks: **2,064** (1,444 de Leonardo, 620 de Richter)
- `index.bin`: **774 KB** — esperado ~0,8 MB (`02` v3)

## Deriva de la cuantizacion int8

Escala global sobre vectores ya L2-normalizados, y renormalizacion de la
reconstruccion. Medido sobre 400 chunks al azar contra el corpus completo:

| | media | p99 | max |
|---|---:|---:|---:|
| `abs(cos_f32 - cos_int8)` | 0.002038 | 0.006139 | 0.010438 |
| sobre el `cos_max` (lo que umbraliza el gate) | 0.001881 | — | 0.006559 |

El vecino mas cercano cambia en **8.8%** de los casos. La diagonal se excluye: cada chunk se encuentra a si mismo con coseno 1,0 exacto en las dos representaciones, y dejarla adentro hace parecer que la cuantizacion no mueve nada.

> **Atencion:** la deriva sobre `cos_max` supera 0,005. La Fase 2 tiene que calibrar tau sobre el int8 final, no sobre el float32.

