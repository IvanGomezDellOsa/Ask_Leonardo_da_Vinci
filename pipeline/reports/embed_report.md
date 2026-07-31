# Reporte de embeddings

- Modelo: `intfloat/multilingual-e5-small` · 384 dimensiones · prefijos `passage: ` / `query: `
- Chunks: **2,068** (1,447 de Leonardo, 621 de Richter)
- `index.bin`: **776 KB** — esperado ~0,8 MB (`02` v3)

## Deriva de la cuantizacion int8

Escala global sobre vectores ya L2-normalizados, y renormalizacion de la
reconstruccion. Medido sobre 400 chunks al azar contra el corpus completo:

| | media | p99 | max |
|---|---:|---:|---:|
| `abs(cos_f32 - cos_int8)` | 0.002034 | 0.006101 | 0.010808 |
| sobre el `cos_max` (lo que umbraliza el gate) | 0.001829 | — | 0.005745 |

El vecino mas cercano cambia en **7.2%** de los casos. La diagonal se excluye: cada chunk se encuentra a si mismo con coseno 1,0 exacto en las dos representaciones, y dejarla adentro hace parecer que la cuantizacion no mueve nada.

> **Atencion:** la deriva sobre `cos_max` supera 0,005. La Fase 2 tiene que calibrar tau sobre el int8 final, no sobre el float32.

