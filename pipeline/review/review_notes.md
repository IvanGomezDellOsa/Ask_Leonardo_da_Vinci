# Revisión dirigida de voz (R1) — veredictos

Revisión de las unidades marcadas, una por una, con el razonamiento escrito.
No reemplaza la ratificación del dueño del proyecto: la deja barata.

**Sesgo declarado:** quien revisa es quien escribió el clasificador, así que hay
una tendencia a confirmarlo. Es el mismo problema que `06` v3 §5 señala cuando el
juez y el generador son el mismo modelo. Por eso va el razonamiento por caso, y
no solo el veredicto.

**Estado:** de las 18 marcadas originales, **9 resultaron contaminadas de verdad
y se corrigieron por regla** (ver D-058), **9 son falsos positivos confirmados**
y **2 conservan una cola que el clasificador no puede alcanzar**.

> ✅ **RATIFICADAS EL 2026-09-06 (D-207), por un revisor distinto del que escribió
> el clasificador.** Los 9 falsos positivos se confirman uno por uno leyendo el
> texto completo. **Las 2 colas NO se ratifican:** esta nota las daba por ~15
> palabras de notación y son **476 palabras con 19 remisiones a láminas y
> manuscritos**, dentro del índice y alcanzables por una consulta real. Se
> sacaron del índice por regla medida. El detalle, abajo.

---

## Falsos positivos confirmados — es Leonardo, la bandera se equivoca

| Unidad | Qué es | Por qué disparó | Evidencia de que es suyo |
|---|---|---|---|
| **rt-0004** | Apertura del **Códice Arundel** | `O reader!` | Fecha **1508**, dentro de su vida. Compila *"many papers which I have copied here"* — es el dueño de los papeles, no su editor. Es uno de los pasajes más citados de la literatura leonardesca |
| **rt-0013** | Sobre la luz y la perspectiva | `the reader` | Registro de tratado propio: *"Perspective, therefore, must be preferred to all the discourses and systems of human learning"* |
| **rt-0669** | Notas para la **Batalla de Anghiari** | año | Lista de combatientes y órdenes de composición para su propio cuadro: *"Begin with the address of Niccolo Piccinino to the soldiers"* |
| **rt-0725** | Presupuesto del **monumento Trivulzio** | año | Costos en ducados de su propio encargo |
| **rt-0737** | `HOW CASTS OUGHT TO BE POLISHED` | año | Instrucción técnica en segunda persona, registro de taller |
| **rt-1405** | Tabla de medidas (`24 tavole make 1 perch`) | año | Equivalencias de unidades florentinas |
| **rt-1522** | `EXPENSES OF THE INTERMENT OF CATERINA` | año | Cuentas del entierro de Caterina, probablemente su madre. **Es el único material del corpus sobre ella** |
| **rt-1533** | Cuentas de Salaì | año | *"I gave to Salai 93 lire 6 soldi"*, primera persona |
| **rt-1539** | Precios de pigmentos | año | Su lista de compra de colores |

**Nota sobre la bandera de año:** dispara con `1[6-9]\d\d`, y estos textos traen
números de cuatro cifras que son importes o cantidades, no fechas. Es ruido
esperable y por eso la bandera no reclasifica.

**Las tres últimas son las que D-027 vuelve valiosas.** Una pregunta como
*"¿quién era Salaì para vos?"* o *"¿cómo era tu vida personal?"* no tiene otro
material en todo el corpus. `06` v4 documenta que las consultas sobre Salaì
estaban mal etiquetadas como fuera de corpus justamente por esto.

---

## Cola residual — el límite de granularidad

| Unidad | Cola que sobrevive |
|---|---|
| **rt-0755** | *"…variations. D. by a circular chapel:"* — notación de esquema de Richter |
| **rt-0747** | *"…C. Plans for small castles or Villas."* — ídem |

En los dos casos la voz cambia **dentro de un mismo párrafo**, y la clasificación
trabaja a nivel de bloque (D-052). No es un fallo de las reglas: es su límite
declarado. Quedan marcadas.

**Impacto acotado:** entre las dos son ~15 palabras de notación de esquema, sin
afirmación factual que Leonardo pudiera atribuirse. El riesgo R1 real —que
Leonardo diga en primera persona algo que pensó Richter— no está presente acá.

---

## Cómo ratificar

Si coincidís, no hay nada que hacer: `review_overrides.jsonl` queda vacío y el
pipeline corre igual. Si discrepás en alguna, agregás una línea:

    {"id": "rt-0755", "voice": "richter", "motivo": "..."}

y re-corrés `03` a `07`. Tu decisión queda versionada en Git.


---

## Ratificación del 2026-09-06 (D-207)

Segunda lectura, hecha por un revisor que **no escribió el clasificador** — que es
lo que el sesgo declarado arriba pedía. Se leyó el texto completo de cada unidad,
no sólo el razonamiento.

### Los 9 falsos positivos: ratificados

| unidad | por qué es de Leonardo, leído |
|---|---|
| `rt-0004` | *«Begun at Florence… taken from many papers which I have copied here»*. Es quien copió los papeles, no quien los editó. Fecha 1508, dentro de su vida |
| `rt-0013` | *«Perspective must be preferred to all the discourses and systems of human learning»*. Registro de tratado propio |
| `rt-0669` | Lista de combatientes y *«Begin with the address of Niccolo Piccinino»*: instrucciones para su propio cuadro |
| `rt-0725` | Costos en ducados del monumento Trivulzio, encargo suyo |
| `rt-0737` | *«HOW CASTS OUGHT TO BE POLISHED. Make a bunch of iron wire…»*: instrucción de taller en segunda persona |
| `rt-1405` | Equivalencias de unidades florentinas (*24 tavole make 1 perch*) |
| `rt-1522` | Gastos del entierro de Caterina. **Único material del corpus sobre su madre** |
| `rt-1533` | *«I gave to Salai 93 lire 6 soldi»*, primera persona |
| `rt-1539` | Precios de pigmentos (*20 pounds of German blue, at one ducat the pound*) |

La bandera del año dispara con importes de cuatro cifras, no con fechas. Ruido
esperable, y por eso las banderas marcan en vez de reclasificar.

### Dos ids que ya no resuelven contra el corpus

Los `rt-XXXX` de esta nota son de la etapa de clasificación, **no del corpus
final**. Dos se movieron y conviene saberlo antes de buscarlos:

- **`rt-1405`** existe, pero el agrupamiento lo metió dentro de `rt-1403`.
- **`rt-1539` nunca llegó al corpus**: el pipeline lo marcó `quality: low` —es una
  lista de importes sin prosa— y el chunking excluye esa clase. La exclusión es
  correcta; lo que estaba mal era suponer que ratificarlo cambiaba algo.

### Las 2 colas: NO ratificadas, y corregidas

Esta nota decía que entre `rt-0755` y `rt-0747` eran *«~15 palabras de notación de
esquema, sin afirmación factual»*. **Medido, son 476 palabras y 19 remisiones a
láminas y manuscritos.**

`rt-0755` son 352 palabras que catalogan tipos de cúpula: *«We have eleven
variations of this type. aa) Pl. LXXXVIII, No. 3»* — primera persona del plural
del editor, con referencias a las láminas de su edición.

Y **es alcanzable**: la consulta *«What did you design for churches with domes?»*
lo traía al top-3 y se lo entregaba al modelo como voz de Leonardo. El riesgo de
mezclar a Leonardo con su editor, ocurriendo.

**Corregido sacándolos del índice de recuperación**, con una regla que separa
sola: cuatro o más remisiones marcan **2 chunks de 1.431**, y son exactamente
estos dos. No se cambió la voz en el corpus: `rt-0755` abre con una frase que sí
es de Leonardo, y marcar el bloque entero como Richter la perdería igual.
