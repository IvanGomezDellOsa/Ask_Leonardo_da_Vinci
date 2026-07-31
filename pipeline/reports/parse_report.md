# Reporte de parseo — PG #5000 (Richter, 1888)

Fuente: `pipeline/raw/pg5000-images.html` · 1,600,813 bytes

## Conteos de control

| Control | Medido | Esperado | |
|---|---:|---:|---|
| Notas al pie con el patron plano ingenuo (control D-043) | 864 | 864 | ok |
| Marcadores `[Footnote` en el cuerpo | 881 | 881 | ok |
| Notas efectivamente extraidas (cierran) | 874 | — | |
| Notas que el fuente nunca cierra | 7 | — | ver abajo |
| Lineas de numeracion | 1,563 | 1,565 | desvio -2 |
| Numeros de pasaje tras el filtro de monotonia | 1,550 | — | 13 descartados |
| Pasajes >= 8 palabras (con titulo adentro, comparable al control) | 1,494 | 1,504 | desvio -10 |
| Pasajes >= 8 palabras (con el titulo ya extraido) | 1,490 | — | |
| Titulos tematicos de Richter | 343 | 651 | desvio -308 |

El control de 1.504 se midio con los titulos en mayuscula de Leonardo y los
titulos de Richter dentro de los cuerpos. Se reportan las dos cifras para que
el numero siga siendo comparable despues de extraer los titulos.

## Titulos: de donde sale cada uno

- Indice de contenidos del Volumen I: **219 entradas**, cubren los pasajes 1-702 con **0 huecos**. Es un dato del libro, no una inferencia.
- Volumen II (703 en adelante): no hay indice. Decide la regla nominal sobre 395 candidatos, **161 aceptados** → `reports/titulos_volumen2.txt`, para revision ocular.
- **Precision de la regla medida contra el indice del Volumen I: 90.4% · recall 98.4%** (179 aciertos, 19 falsos positivos, 3 falsos negativos).

**Discrepancia con D-025.** El documento dice 651 titulos; con esta definicion son 343. La hipotesis medida: los encabezados `<h5>` en mayuscula que NO son de seccion —los que escribio el propio Leonardo en sus manuscritos, tipo `OF PAINTING.`— son **713**. No coincide exactamente con 651; la diferencia queda anotada y sin forzar. Aca esos encabezados quedan dentro del cuerpo del pasaje, que es lo que mantiene comparable el control de 1.504.

## Distribucion de longitud

| | palabras | doc |
|---|---:|---:|
| mediana | 66 | 68 |
| media | 128.0 | 129,5 |
| p10 / p90 | 13 / 266 | 14 / 272 |
| maximo | 3,338 | 3.339 |
| total en cuerpos | 198,347 | ~202.728 |

- Pasajes < 15 palabras: **183** (doc: 178) — se agrupan en `04_chunk.py`
- Pasajes > 500 palabras: **57** (doc: 60) — se parten con solape
- Pasajes sin ancla `id`: **0**
- Pasajes sin titulo de Richter asignado: **0**

## Notas al pie

- Total extraidas: **881** (874 que cierran + 7 que el fuente deja abiertas, acotadas al bloque)
- Que atraviesan mas de un bloque del HTML: **71** → `reports/footnotes_multibloque.txt`, para revision ocular
- Con una linea de numeracion adentro (se estarian comiendo un pasaje): **0**
- Mas larga: 6,481 caracteres

## Secciones detectadas

- desde R-1: **Prolegomena and General Introduction to the Book on Painting**
- desde R-110: **Six books on Light and Shade**
- desde R-222: **Perspective of Disappearance**
- desde R-263: **Theory of colours**
- desde R-289: **'Prospettiva de' colri' (Perspective of Colour)**
- desde R-308: **On the Proportions and on the Movements of the Human Figure**
- desde R-393: **Botany for Painters and Elements of Landscape Painting**
- desde R-482: **The Practice of Painting** › MORAL PRECEPTS FOR THE STUDENT OF PAINTING
- desde R-509: **The Practice of Painting** › THE ARTIST'S STUDIO.—INSTRUMENTS AND HELPS FOR THE APPLICATION OF PERSPECTIVE.—ON JUDGING OF A PICTURE
- desde R-548: **The Practice of Painting** › THE PRACTICAL METHODS OF LIGHT AND SHADE AND AERIAL PERSPECTIVE
- desde R-571: **The Practice of Painting** › OF PORTRAIT AND FIGURE PAINTING
- desde R-601: **The Practice of Painting** › SUGGESTIONS FOR COMPOSITIONS
- desde R-612: **The Practice of Painting** › THE ARTIST'S MATERIALS
- desde R-651: **The Practice of Painting** › PHILOSOPHY AND HISTORY OF THE ART OF PAINTING
- desde R-707: **The notes on Sculpture**
- desde R-741: **Architectural Designs**
- desde R-770: **Architectural Designs** › ON FISSURES IN WALLS
- desde R-777: **Architectural Designs** › ON FISSURES IN NICHES
- desde R-779: **Architectural Designs** › ON THE NATURE OF THE ARCH
- desde R-789: **Architectural Designs** › ON FOUNDATIONS, THE NATURE OF THE GROUND AND SUPPORTS
- desde R-793: **Architectural Designs** › ON THE RESISTANCE OF BEAMS
- desde R-796: **Anatomy, Zoology and Physiology** › ANATOMY
- desde R-816: **Anatomy, Zoology and Physiology** › ZOOLOGY AND COMPARATIVE ANATOMY
- desde R-827: **Anatomy, Zoology and Physiology** › PHYSIOLOGY
- desde R-857: **Astronomy** › THE EARTH AS A PLANET
- desde R-879: **Astronomy** › THE SUN
- desde R-892: **Astronomy** › THE MOON
- desde R-919: **Astronomy** › INTRODUCTION
- desde R-930: **Astronomy** › OF THE NATURE OF WATER
- desde R-946: **Astronomy** › ON THE OCEAN
- desde R-961: **Astronomy** › SUBTERRANEAN WATER COURSES
- desde R-970: **Astronomy** › OF RIVERS
- desde R-979: **Astronomy** › ON MOUNTAINS
- desde R-985: **Astronomy** › GEOLOGICAL PROBLEMS
- desde R-995: **Astronomy** › ON THE ATMOSPHERE
- desde R-1001: **Topographical Notes** › ITALY
- desde R-1069: **Topographical Notes** › FRANCE
- desde R-1083: **Topographical Notes** › THE COUNTRIES OF THE WESTERN END OF THE MEDITERRANEAN
- desde R-1090: **Topographical Notes** › THE LEVANT
- desde R-1113: **Naval Warfare.—Mechanical Appliances.—Music**
- desde R-1132: **Philosophical Maxims. Morals. Polemics and Speculations** › PHILOSOPHICAL MAXIMS
- desde R-1162: **Philosophical Maxims. Morals. Polemics and Speculations** › MORALS
- desde R-1205: **Philosophical Maxims. Morals. Polemics and Speculations** › POLEMICS.—SPECULATION
- desde R-1220: **Humorous Writings** › STUDIES ON THE LIFE AND HABITS OF ANIMALS
- desde R-1265: **Humorous Writings** › FABLES
- desde R-1280: **Humorous Writings** › JESTS AND TALES
- desde R-1293: **Humorous Writings** › PROPHECIES
- desde R-1314: **Humorous Writings** › DRAUGHTS AND SCHEMES FOR THE HUMOROUS WRITINGS
- desde R-1336: **Letters. Personal Records. Dated Notes**
- desde R-1379: **Miscellaneous Notes**

## Alertas

- ninguna
