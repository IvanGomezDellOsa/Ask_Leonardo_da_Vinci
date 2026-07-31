# Experimento de separabilidad — Fase 0.5

**Ejecutado el 2026-07-31.** Decide si la arquitectura anti-alucinación del proyecto es
viable antes de construir nada.

**Veredicto: es viable, con dos correcciones.** Decisiones `D-038` a `D-044`.

---

## La pregunta

El sistema responde solo con material del corpus y se **abstiene** cuando la pregunta cae
fuera. La abstención se decide con un umbral sobre el coseno máximo entre la consulta y los
pasajes. Eso funciona **solo si** las preguntas dentro y fuera del corpus producen
distribuciones separables.

## El resultado, en cuatro líneas

| Pregunta | Respuesta medida |
|---|---|
| ¿Separan las distribuciones? | **Sí**, dentro de cada idioma. AUC 0,9207 (es) y 0,9388 (en) |
| ¿Alcanza un solo umbral? | **No.** 70,5% contra 88,4% con uno por idioma |
| ¿Se degrada el español? | **No.** Separa igual de bien; el corte va en otro lado |
| ¿Alcanza el umbral solo? | **No.** Topa en 88,4% y seis diseños distintos no lo mueven |

### El caso que lo resume

| Consulta | Coseno |
|---|---|
| *«¿Se puede construir una máquina para que el hombre vuele?»* → recupera **R-1122**, el pasaje exacto | **0,8002** |
| *«How do you make a pizza?»* → recupera una receta para **fabricar papel** | **0,8639** |

Una consulta legítima que acertó el pasaje puntúa **por debajo** de una broma, solo por
estar en otro idioma. Ese es el hallazgo central.

---

## Cómo correrlo

```bash
pip install sentence-transformers matplotlib scipy numpy
python 01_extraer_pasajes.py     # descarga ya hecha; produce data/pasajes.jsonl
python 02_separabilidad.py       # el experimento original de 40 consultas
python 04_umbral.py              # 190 consultas + bootstrap  ← el que manda
python 05_pasajes_basura.py
python 06_comparar_disenos.py
python 07_modelo_mas_grande.py
python 08_cross_encoder.py       # baja ~2,3 GB de rerankers
python 09_anatomia_del_error.py
python 10_prefiltro.py
```

`03_explicacion.py` genera solo un gráfico didáctico y no aporta números nuevos.
Los scripts `05` a `10` reutilizan `data/emb_cache.npz`, que produce `04`.

## Los archivos

| Script | Qué contesta |
|---|---|
| `01_extraer_pasajes.py` | Extrae los 1.504 pasajes utilizables del `.txt` |
| `02_separabilidad.py` | El experimento exploratorio: 40 consultas, 200 pasajes |
| `03_explicacion.py` | Gráfico didáctico del desplazamiento por idioma |
| `04_umbral.py` | **El principal.** 190 consultas, corpus completo, bootstrap |
| `05_pasajes_basura.py` | ¿Cuánto del solapamiento causan los pasajes basura? |
| `06_comparar_disenos.py` | Compara los cuatro diseños posibles del gate |
| `07_modelo_mas_grande.py` | ¿El techo es el modelo o la arquitectura? |
| `08_cross_encoder.py` | ¿Rompe el techo un cross-encoder? |
| `09_anatomia_del_error.py` | ¿Qué **tipo** de consulta se cuela? |
| `10_prefiltro.py` | El coseno como pre-filtro en vez de juez |
| `consultas.py` | Las 190 consultas etiquetadas, en dos tandas |

---

## Lo que hay que saber para la Fase 1

### 1. Los umbrales son un resultado, no una configuración

```
              pre-filtro (0% pérdida)   óptimo por exactitud
  español            0,7914                    0,8017
  inglés             0,8289                    0,8592
```

Medidos con `e5-small`, **float32**, embebiendo **solo `text`**, sobre el `.txt`.
El índice real va a tener tres cosas que esto no tuvo, y **las tres desplazan los scores**:

- `richterTitle + text` embebido (D-025)
- cuantización **int8** (D-022)
- parseo del **HTML** (D-024)

**Hay que recalibrar.** Lo que no cambia es la forma: dos umbrales, y el del inglés más alto.

### 2. La trampa del parser (D-043)

El `.txt` tiene los corchetes **desbalanceados**: **1.516 `[` contra 1.605 `]`**.

Un extractor de notas al pie que empareje **contando profundidad de corchetes** —la solución
obvia— produce bloques de 38.876 y 75.658 caracteres que se tragan pasajes enteros de
Leonardo y borran 160 líneas de numeración, **en silencio**.

| método | bloques | numeración | pasajes ≥8 palabras |
|---|---|---|---|
| profundidad de corchetes | 792 | 1.405 ❌ | 1.349 ❌ |
| **plano `\[Footnote[^\[\]]*\]`** | **864** ✅ | **1.565** ✅ | **1.504** ✅ |

Los tres conteos de control que la Fase 1 debe verificar: **864 / 1.565 / 1.504**.

### 3. No reabrir lo ya descartado (D-044)

Medido sobre las mismas 190 consultas:

| Alternativa | Resultado |
|---|---|
| Cross-encoder (`bge-reranker-v2-m3`) | 87,4% — no mejora. Sí elimina la necesidad de dos τ. Plan B |
| Normalizar el score (4 variantes) | 54,7% a 82,1% — **peor** |
| Traducir la consulta a inglés | 90,0%, y es la **cota superior con traducción perfecta** |
| `multilingual-e5-base` | 88,9% — +0,5 puntos por 2,4× de parámetros |
| Promediar el top-3 | 87,9% — sin efecto |
| Filtrar pasajes basura | +2 puntos de AUC en español, nada en inglés |

### 4. Aviso sobre las etiquetas

Dos consultas del experimento estaban **mal etiquetadas**: *«¿Cómo era tu relación con
Salaì?»* se puso como `fuera`, pero el corpus **sí tiene material** (R-1528, apuntes de
contabilidad del propio Leonardo). `resultados/revision_etiquetas.txt` lista las candidatas
a revisar. Vale lo mismo para el eval set de `06`.

---

## Salidas

Todo en `resultados/`:

| Archivo | Contenido |
|---|---|
| `umbral.png` | **El gráfico principal**: distribuciones por idioma con los dos umbrales |
| `umbral_informe.txt` | Medias, desvíos, AUC, márgenes, bootstrap, puntos de operación |
| `umbral_consultas.csv` | Las 190 consultas con su coseno y el pasaje recuperado |
| `separabilidad.png` | El gráfico exploratorio de 40 consultas, en tres paneles |
| `explicacion.png` | Versión didáctica del desplazamiento por idioma |
| `cross_encoder.txt` | Comparación bi-encoder contra cross-encoder |
| `comparacion_disenos.txt` | Los cuatro diseños del gate, lado a lado |
| `prefiltro.txt` | Rendimiento del coseno como pre-filtro |
| `anatomia_del_error.txt` | Qué tipo de consulta se cuela |
| `revision_etiquetas.txt` | Consultas cuya etiqueta conviene revisar a mano |
| `modelo_mas_grande.txt` | `e5-small` contra `e5-base` |
| `pasajes_basura.txt` | Efecto de filtrar pasajes sin contenido |

## Reproducibilidad

- Semilla fija (`42`) para el muestreo de pasajes y para el bootstrap.
- Los embeddings se cachean en `data/`, que está gitignoreado por tamaño.
- El corpus se baja de `https://www.gutenberg.org/cache/epub/5000/pg5000.txt`
  (**1.433.832 bytes**). La URL `ebooks/5000.txt.utf-8` del prompt original redirige
  a HTTP y PowerShell la rechaza; esta es la directa.
