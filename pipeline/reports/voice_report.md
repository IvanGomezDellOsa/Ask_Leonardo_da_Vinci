# Reporte de voz

## Reparto

| | unidades | palabras |
|---|---:|---:|
| **Leonardo** (indice T1) | 1,549 | 169,757 |
| Richter · `absence` | 36 | 9,385 |
| Richter · `substantive` | 563 | 55,240 |
| Richter · `apparatus` (fuera del indice) | 474 | 6,187 |

## Comentario de Richter extraido de adentro de los pasajes

- **49 tiradas · 10,895 palabras**, el 6.0% de lo que el parseo daba como cuerpo de pasaje.

| pasaje | palabras | excindidas | |
|---|---:|---:|---:|
| R-755 | 3,338 | 2,548 | **76%** |
| R-795 | 2,016 | 1,807 | **90%** |
| R-768 | 289 | 240 | **83%** |
| R-769 | 149 | 0 | **0%** |

## Validacion del clasificador de bloque

Pesos medidos sobre 131 introducciones de seccion (Richter conocido) contra
990 pasajes de secciones sin sospecha:

| rasgo | Richter | Leonardo | ratio |
|---|---:|---:|---:|
| nombra a Leonardo en 3.a persona | 73% | 0,4% | **180x** |
| artista posterior como comparacion | 16% | 0,2% | 79x |
| anio posterior a 1519 | 8% | 0,4% | 19x |
| sigla de manuscrito o lamina | 32% | 3,7% | 8,6x |
| meta-discurso editorial | 56% | 6,5% | 8,6x |

Umbral de semilla 2.0: **77% de recall con 0,4% de falsos positivos**. La expansion a bloques contiguos (>= 0.5) recupera el resto de cada tirada.

- Bloques en el limite, sin excindir: **157** → `voice_flags.md`
- Unidades `leonardo` con bandera: **18**

