# Calibracion de tau — PROVISIONAL

> **No reemplaza la calibracion de la Fase 3.** Esta corre contra las 190
> consultas de investigacion del experimento de separabilidad, que es el
> instrumento con el que se descubrio la forma del gate. La Fase 3 calibra
> contra el eval set de 120 casos etiquetados a mano: otro instrumento, otra
> pregunta. El numero de abajo es un punto de partida, no un resultado.

- Indice: **1,447 chunks de Leonardo** (int8, `richterTitle + text`, parseo del HTML)
- Consultas: 190 · **2 etiquetas corregidas** antes de medir (las de Salai, que `06` v4 documenta)

## espanol

- dentro n=49 media 0.8146 · fuera n=46 media 0.7796 · **AUC 0.9419**

| perdida aceptada | tau | contestables que pasan | basura atajada |
|---|---:|---:|---:|
| 0% | **0.7808** | 100.0% | 39.1% |
| 2% | **0.7831** | 98.0% | 50.0% |
| 5% | **0.7956** | 93.9% | 84.8% |

## ingles

- dentro n=48 media 0.8757 · fuera n=47 media 0.8285 · **AUC 0.9317**

| perdida aceptada | tau | contestables que pasan | basura atajada |
|---|---:|---:|---:|
| 0% | **0.8263** | 100.0% | 40.4% |
| 2% | **0.8280** | 97.9% | 42.6% |
| 5% | **0.8364** | 93.8% | 59.6% |

## Comparacion con el experimento (float32, sin titulo, sobre el .txt)

| | experimento | ahora | delta |
|---|---:|---:|---:|
| tau_es (0% de perdida) | 0,7914 | **0.7808** | -0.0106 |
| tau_en (0% de perdida) | 0,8289 | **0.8263** | -0.0026 |
| distancia entre los dos | 0,0375 | **0.0455** | |

**La forma se mantiene: dos umbrales, y el del ingles mas alto.** Es lo que
D-038 anticipaba que no iba a cambiar.

