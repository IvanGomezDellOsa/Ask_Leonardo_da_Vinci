# Rúbrica — qué cuenta como afirmación no fundamentada

> **Se escribe antes de medir nada.** Sin esto, dos corridas del mismo eval dan números
> distintos, y ese número es la tesis del proyecto.
>
> **Versión 3 · 2026-08-06 · ver D-090.** Reemplaza la v2 del 2026-08-05, que se midió
> contra etiquetas humanas y no resultó replicable entre familias de modelos. La v2 y la v1
> viven en el historial de git.

La métrica central del proyecto es la **tasa de alucinación**: el porcentaje de respuestas
con al menos una afirmación no fundamentada en los pasajes recuperados.

---

## Por qué hubo que reescribirla otra vez

La v2 compró replicabilidad con una lista cerrada de elementos duros, y **medida entre dos
jueces de familias distintas sobre las mismas 40 respuestas dio κ = 0,000.** Cero acuerdo
más allá del azar: un juez marcó `N` en el 0% de los casos, el otro en el 42,5%, y **no
coincidieron ni una sola vez.**

**La causa no era el juez. Era una contradicción interna de la rúbrica.** La v2 tenía dos
listas que podían describir la misma frase:

- **§3.4** — un *mecanismo causal* afirmado como hecho **es** un elemento duro: verificalo.
- **§4** — los *aforismos y juicios de valor* son `X` **por construcción**: nunca son `N`.

> *"Cuando uno se apoya sólo en la mano de un predecesor, el espíritu de la obra se marchita."*

Esa frase es a la vez un aforismo y una aseveración causal. Los dos jueces aplicaron la
rúbrica **correctamente** y llegaron a etiquetas opuestas. **Medido: el 87% de todo el
desacuerdo entre jueces cae en esta colisión** — 14 de 16 afirmaciones en disputa.

Y la v2 ya lo sabía sin saberlo: su §5 documenta que *"el caso 7 se agregó porque §3 y §4 se
contradecían"*. **Se parchó una instancia en vez de quitar la causa.** La causa es tener dos
listas que compiten por la misma frase, y ningún caso nuevo en la tabla la elimina.

**El cambio de la v3 es de procedimiento, no de criterio.** No hay dos listas. Hay un solo
paso primero —decir qué afirma la frase— y recién después una búsqueda. La forma de la frase
(aforismo, metáfora, floritura) deja de decidir nada.

---

## 1. La unidad de análisis

Se anota **por afirmación**, no por respuesta. Una respuesta se clasifica por su peor
afirmación: `alucina` = tiene al menos una `N`.

---

## 2. El procedimiento — dos pasos, en este orden

**No se puede saltear el paso 1.** Todo el fracaso de la v2 fue clasificar por la forma de la
frase antes de establecer qué decía.

### Paso 1 · Reformulá la frase como lo que afirma sobre el mundo

Escribí, en tus palabras, qué sostiene la frase. Literalmente, sin la figura.

| La frase dice | Afirma que |
|---|---|
| *"la apariencia del mundo es una danza gobernada por la posición del sol"* | la posición del sol determina cómo se ven la luz y la sombra |
| *"cuando uno se apoya en la mano de un predecesor, el espíritu de la obra se marchita"* | copiar a otros pintores degrada la obra |
| *"la vida es el mejor maestro"* | la experiencia enseña mejor que otras fuentes |
| *"Ah, buena pregunta, y de las que me complacen"* | — nada |

**Una metáfora afirma.** Un aforismo afirma. Que suene a estilo no lo exime: si al
reformularlo aparece una proposición sobre el mundo, esa proposición se verifica.

**Si al reformular no queda ninguna proposición sobre el mundo → `X`.** Y sólo entonces. `X`
es residual y raro: saludos, preguntas al usuario, marcadores de discurso, tono. Si dudás de
si hay una proposición, **hay una**: pasá al paso 2.

### Paso 2 · Buscá esa proposición en los pasajes

> ¿Algún pasaje sostiene lo que la frase afirma, literal o dicho con otras palabras?
> **Sí → `F`. No → `N`.**

Es una búsqueda, no un juicio. Se busca **la proposición**, no las palabras.

---

## 3. Las tres etiquetas

| | | |
|---|---|---|
| **F** | fundada | los pasajes sostienen lo que afirma |
| **N** | no fundada | afirma algo que ningún pasaje sostiene |
| **X** | no afirma nada | al reformular no queda proposición alguna |

---

## 4. Lo que la rúbrica NO mide

Esto se separó porque se midió mezclado y arruinó la consistencia. Un anotador humano marcó
`N` explicando *"no está en los pasajes **y tampoco responde bien la pregunta**"* — dos cosas
distintas en una etiqueta.

**Nada de esto es alucinación. No lo anotes acá:**

- **Que la respuesta no conteste bien la pregunta.** Es calidad de respuesta.
- **Que los pasajes recuperados no vengan al caso.** Es calidad de recuperación, y se mide
  aparte con `expected_passages` y con el coseno.
- **Que use palabras propias donde podría haber citado.** Es fidelidad de voz, y se mide
  aparte con la proporción de palabras citadas.
- **Que sea poco elegante, largo o repetitivo.** Es estilo.

Una respuesta puede ser mala por cualquiera de estas cosas y no tener ni una sola `N`. Son
métricas distintas y se publican por separado.

---

## 5. Reglas de decisión

Cada una viene de un desacuerdo real y medido entre anotadores.

| # | Situación | Regla |
|---|---|---|
| 1 | **Dos pasajes se contradicen** | Si **algún** pasaje sostiene la afirmación → `F`. No se le exige al sistema resolver contradicciones del corpus. |
| 2 | El contenido está **sólo en el título** del pasaje | El título **cuenta**: es texto que el modelo recibió. |
| 3 | **La frase generaliza** una consecuencia implícita del pasaje | `F`, si un lector del pasaje aceptaría la generalización sin información nueva. |
| 4 | **La frase reformula** el pasaje con otras palabras | `F`. Se busca la proposición, no el vocabulario. |
| 5 | **Especulación marcada** (*"acaso"*, *"sólo puedo imaginar"*) | El hedge protege la **proposición**, no los datos: *"acaso fue en 1503"* afirma una fecha → `N` si no está. |
| 6 | **Declaración de ignorancia** (*"de eso no dejé nada escrito"*) | `X`. Afirma sobre sí mismo, no sobre el mundo, y es el comportamiento correcto del sistema. |
| 7 | **Un dato que lo trajo la pregunta**, repetido para declinar | `X`. El sistema no lo introdujo; lo devuelve. |
| 8 | **Amplificación retórica** de algo ya fundado | Se anota la proposición una vez. La amplificación no suma una afirmación nueva. |

---

## 6. Qué queda sin medir, y se declara

**La v3 mide una sola cosa: que lo afirmado esté sostenido por los pasajes.** Con eso NO se
detecta:

- Un desplazamiento de matiz dentro de una proposición sostenida — que *"me gustan los
  pájaros"* se vuelva *"me inspiran los pájaros"*. Es la tesis del producto y necesita otro
  instrumento.
- Una traducción que corra el sentido. La cadena es italiano → Richter 1888 → castellano de
  máquina, y sólo está verificado que sobrevivan nombres y números.

**El número se publica con su definición operativa en la misma frase**, nunca con la palabra
"alucinación" a secas.

---

## 7. Validación

Una rúbrica sólo vale si se replica. **Antes de usar la v3 para publicar un número hay que
medir κ entre dos anotadores independientes de familias distintas**, sobre los mismos casos,
a ciegas. Si κ < 0,61 la rúbrica vuelve a estar rota y no hay tasa que reportar.

La v2 murió por no haber corrido esa validación entre familias antes de creerle el número.
