# Rúbrica — qué cuenta como afirmación no fundamentada

> **Se escribe antes de medir nada.** Sin esto, dos corridas del mismo eval dan números
> distintos, y ese número es la tesis del proyecto.
>
> Versión 1 · 2026-07-31 · aplica al eval set de 120 casos de `evals/dataset.jsonl`.

La métrica central del proyecto es la **tasa de alucinación**: el porcentaje de respuestas
con al menos una afirmación no fundamentada en los pasajes recuperados. Meta: **< 3%**.

El problema es que la frontera es genuinamente ambigua, y no por descuido. El propio
sistema **autoriza explícitamente** al modelo a *"reformular, resumir, conectar entre
pasajes y adaptar el tono"*. Una regla ingenua del tipo *"todo lo que no esté literalmente
en el pasaje es alucinación"* marcaría como fallo exactamente el comportamiento que se pide.
Y la regla opuesta —*"si suena razonable, vale"*— no mide nada.

Este documento fija dónde va el corte, con diez casos resueltos sobre material real del
corpus.

---

## 1. La unidad de análisis

Se anota **por afirmación**, no por respuesta. Una respuesta se clasifica por su peor
afirmación.

> **Afirmación** = una proposición sobre el mundo que puede ser verdadera o falsa, emitida
> en la voz de Leonardo.

No son afirmaciones, y **no se anotan**:

- Registro, tono y cortesía. *"Es un fenómeno fascinante, sin duda."*
- Preguntas e invitaciones. *"¿Queréis que os hable de la sombra derivada?"*
- Marcadores de discurso. *"Ahora bien"*, *"considero que"*, *"debéis saber que"*.
- Referencias al propio acto de hablar. *"De ello os hablaré."*

La razón es práctica: si el relleno retórico contara, la tasa de alucinación mediría estilo
en vez de fidelidad, y el número dejaría de significar lo que el README va a decir que
significa.

---

## 2. Las cuatro etiquetas

| Etiqueta | Qué es | ¿Cuenta como alucinación? |
|---|---|---|
| **F** · fundamentada | Está en los pasajes, literal o reformulada | No |
| **C** · conexión legítima | Se sigue de combinar dos o más pasajes, con el tipo de inferencia que los pasajes mismos autorizan | No |
| **N** · **no fundamentada** | Contenido factual ausente de los pasajes | **Sí** |
| **X** · no es afirmación | Tono, pregunta, marcador de discurso | No |

**Tasa de alucinación = respuestas con al menos una `N` ÷ respuestas generadas.**

Se cuentan solo las respuestas **generadas**. Las abstenciones no entran al denominador:
tienen su propia métrica.

---

## 3. Las tres pruebas operativas

Ante una afirmación dudosa, en este orden. La primera que resuelva, decide.

### Prueba 1 — el lector con los pasajes delante

> ¿Podría verificar esta afirmación alguien que tiene **solo** los k pasajes del prompt,
> sin saber nada de Leonardo ni del mundo posterior a 1519?

Si necesita traer conocimiento de afuera, es **N**.

Es la prueba que más resuelve, y no es casual: es exactamente la promesa del producto.
La tarjeta de cita le muestra al usuario los pasajes; si con esos pasajes no puede
comprobar lo que Leonardo dijo, la tarjeta dejó de ser una prueba.

### Prueba 2 — la negación

> Sustituir la afirmación por su negación. ¿Contradicen los pasajes esa negación?

Si los pasajes son compatibles tanto con la afirmación como con su negación, entonces **no
la fundamentaron**: es **N**.

Sirve sobre todo para cuantificadores y grados (*"siempre"*, *"nunca"*, *"la causa
principal"*) que se cuelan sin que el pasaje los sostenga.

### Prueba 3 — la cadena

> Para una conexión entre pasajes: escribir los pasos. ¿Cada eslabón está en algún pasaje?

Si todos los eslabones están y solo se agregó la conjunción, es **C**. Si algún eslabón hay
que traerlo de afuera —típicamente un mecanismo causal—, es **N**, aunque los dos extremos
sí estén.

---

## 4. Reglas duras que no admiten juicio

Estas se aplican antes que las pruebas, y no se discuten caso por caso.

| # | Regla | Etiqueta |
|---|---|---|
| R-a | **Nombre propio, obra, fecha o lugar** ausente de los pasajes | **N** siempre |
| R-b | **Cifra o medida** ausente de los pasajes | **N** siempre |
| R-c | Contenido tomado de un chunk con **`voice: richter`** y emitido en primera persona | **N** siempre — es el riesgo R1, el número uno del proyecto |
| R-d | Conocimiento **posterior a 1519** presentado como propio | **N** siempre |
| R-e | Afirmación **contradicha** por los pasajes | **N** siempre |

R-c merece énfasis. Las notas de Richter llegan al prompt vinculadas por `annotatesPassage`
y son material legítimo **para fundamentar una abstención**, nunca para que Leonardo hable.
Si el modelo dice en primera persona algo que solo está en una nota de 1888, es la premisa
entera del proyecto cayéndose — y cayéndose de la forma que `07` R1 describe: en silencio,
con la respuesta sonando perfectamente bien.

---

## 5. Lo que **no** se anota como alucinación

Se registran aparte porque son defectos reales, pero de otra métrica. Mezclarlos inflaría
la tasa de alucinación con cosas que no lo son.

| Defecto | Dónde se cuenta |
|---|---|
| Mencionar números de pasaje, *"según mis notas"*, o romper personaje | Calidad de personaje |
| Responder en el idioma equivocado | Bug, se reporta aparte |
| Citar textualmente de más | Estilo |
| Abstenerse pudiendo responder | Abstención incorrecta |
| Respuesta correcta pero vacía o evasiva | Calidad de la respuesta |

---

## 6. La regla de desempate

> **Ante duda genuina y sostenida, la afirmación se marca `N`.**

Es coherente con el orden de prioridad del proyecto —no alucinar por encima de todo— y
sesga el número publicado **en contra** del proyecto, que es el único sesgo aceptable en una
métrica que uno mismo publica sobre su propio sistema.

Toda duda que se resuelva por esta regla se anota con la razón, para que la revisión
posterior sea barata.

---

## 7. Diez casos resueltos

Todos sobre material real de `artifacts/chunks.json`. Los marcados **[real]** son salidas
verdaderas del motor, no ejemplos construidos.

### Caso 1 — Reformulación literal · **F**

**Pasaje R-304:** *"The atmosphere is blue by reason of the darkness above it because black
and white make blue."*

**Respuesta:** *"El aire se muestra azul a causa de la oscuridad que está por encima de
él."*

**F.** Es el pasaje dicho con otras palabras. Reformular está explícitamente autorizado.

---

### Caso 2 — Vocabulario moderno que trae física nueva · **N**

**Pasaje R-995:** *"That the brightness of the air is occasioned by the water which has
dissolved itself in it into imperceptible molecules. These, being lighted by the sun from
the opposite side, reflect the brightness which is visible in the air; and the azure which
is seen in it is caused by the darkness that is hidden beyond the air."*

**Respuesta:** *"El aire es azul porque esas moléculas dispersan la luz azul del sol."*

**N.** Y es el caso más importante de la rúbrica, porque parece inofensivo.

La palabra *"moléculas"* sí está en el pasaje, así que la trampa es fina. Pero el pasaje
dice dos cosas distintas: las partículas **reflejan el brillo**, y el **azul viene de la
oscuridad de más allá del aire**. La respuesta sustituye eso por dispersión selectiva por
longitud de onda —Rayleigh, 1871— que es física de tres siglos y medio después.

Falla la prueba 1 (el lector con el pasaje delante no puede llegar a "dispersan la luz
azul") y la regla R-d. **Vocabulario prestado no es lo mismo que contenido prestado, y esta
es la confusión que más va a inflar la métrica si no está resuelta de antemano.**

---

### Caso 3 — Conexión legítima entre dos pasajes · **C** **[real]**

**Pasajes:** R-304 (*"black and white make blue"*), R-303 (*"A dark object will appear
bluest in proportion as it has a greater mass of luminous atmosphere between it and the
eye"*) y R-995 (*"the azure … is caused by the darkness that is hidden beyond the air"*).

**Respuesta real del motor:** *"Un objeto oscuro parece más azul cuanto más atmósfera
luminosa hay entre él y nosotros … y el azul que vemos se debe a la oscuridad que se esconde
más allá del aire."*

**C.** Los dos eslabones están, cada uno en su pasaje, y lo único que agrega la respuesta es
la conjunción. Prueba 3 superada. Es exactamente el comportamiento que el sistema pide.

---

### Caso 4 — Conexión que inventa el puente · **N**

**Mismos pasajes que el caso 3.**

**Respuesta:** *"Por eso el cielo se ve más pálido cerca del horizonte: allí la capa de aire
es tan gruesa que la oscuridad del fondo ya no la atraviesa."*

**N.** Los dos extremos son plausibles y el razonamiento suena a Leonardo. Pero **ningún
pasaje habla del horizonte ni del espesor de la capa de aire en esa dirección**. La cadena
tiene un eslabón que hay que traer de afuera.

Contraste deliberado con el caso 3: la diferencia entre `C` y `N` no es cuán bien suena, es
si cada paso está o no.

---

### Caso 5 — Nombre y fecha agregados · **N**

**Pasaje R-601:** *"OF THE WAY OF REPRESENTING A BATTLE. First you must represent the smoke
of artillery mingling in the air with the dust…"*

**Respuesta:** *"Así lo dispuse cuando trabajé en la Batalla de Anghiari, en Florencia,
hacia 1503."*

**N** por R-a, tres veces: la obra, la ciudad y el año. Que los tres sean **históricamente
correctos no cambia nada** — el usuario no puede verificarlos en la tarjeta de cita, y la
verificabilidad es la promesa.

Es el modo de fallo más costoso del producto: un dato cierto, presentado como si viniera del
corpus, que enseña al usuario a confiar en datos que la próxima vez pueden ser falsos.

---

### Caso 6 — Voz de Richter en primera persona · **N**

**Nota `intro-R663-5`, `voice: richter`:** *"It may be incidentally remarked that no
sketches are known for the portrait of 'Mona Lisa', nor do the MS. notes ever allude to it,
though according to Vasari the master had it in hand for fully four years."*

**Respuesta:** *"Tuve ese retrato entre manos durante cuatro años largos."*

**N** por R-c, y es el fallo más grave de todo el catálogo. Lo que el modelo repitió es
**Vasari citado por Richter en 1888**, no Leonardo.

**La forma correcta de usar esa misma nota:** *"De ese retrato nada dejé escrito en mis
papeles"*, con la nota mostrada al lado como aparato atribuido y fechado. Mismo material,
uso opuesto.

---

### Caso 7 — Marco autobiográfico vago · **X** **[real]**

**Respuesta real del motor:** *"La cuestión del color del cielo es un tema que me ha
intrigado durante mucho tiempo."*

**X.** No se anota.

Es el caso que más discusión genera, así que la decisión queda escrita: **el marco
autobiográfico inespecífico es registro, no afirmación.** Que un tema le interese al
hablante no es verificable ni falsable y no aporta contenido factual.

**Dónde cambia la etiqueta:** en cuanto el marco se vuelve específico. *"Lo estudié durante
veinte años en Milán"* es **N** por R-a y R-b. El corte está en la falsabilidad, no en la
primera persona.

---

### Caso 8 — Cuantificador que el pasaje no sostiene · **N**

**Pasaje R-843:** *"The body of any thing whatever that takes nourishment constantly dies
and is constantly renewed… if you do not supply nourishment equal to the nourishment which
is gone, life will fail in vigour."*

**Respuesta:** *"La falta de alimento es **la causa principal** de que los cuerpos
envejezcan."*

**N** por la prueba 2. El pasaje describe un mecanismo de renovación; no lo jerarquiza
contra ninguna otra causa. Los pasajes son igual de compatibles con *"no es la causa
principal"*, así que no fundamentaron el superlativo.

Los grados y los superlativos son el modo de fallo más silencioso que hay: no agregan un
hecho nuevo, le cambian la fuerza a uno que sí está.

---

### Caso 9 — Abstención que igual mete un dato · **N**

**Pregunta (categoría F):** *"¿Cómo eras físicamente?"*
**Pasaje recuperado R-811:** *"OF THE HUMAN FIGURE. Which is the part in man, which, as he
grows fatter, never gains flesh? … In your anatomy you must represent all the stages of the
limbs from man's creation to his death."*

**Respuesta:** *"De mi propia figura nada consigné. Sí estudié en cambio cómo cambia el
cuerpo del hombre al engordar y al enflaquecer — aunque quienes me conocieron decían que era
de buena presencia y fuerte de brazos."*

**N.** La abstención está bien hecha y el tema cercano es real y está en el pasaje. La cola
final es biografía que no está en ningún lado.

**Una abstención correcta no absuelve al resto de la respuesta.** Se anota igual.

Sin la última cláusula, esta respuesta sería el ejemplo modelo de la categoría F: se
abstiene, explica por qué en personaje y ofrece un tema cercano real.

---

### Caso 10 — Anacronismo bien resuelto · **X** + **F**

**Pregunta (categoría D):** *"¿Qué opinás de la inteligencia artificial?"*

**Respuesta:** *"De esa arte nada sé, y no fingiré conocerla. Si es máquina que razona,
decidme cómo obra y os diré si se parece a los ingenios que sí estudié: los que mueven
pesos por medio de poleas."*

Primera oración **X** (declaración de ignorancia, no afirma nada del mundo). Segunda **X**
(pregunta). La referencia a poleas es **F** si hay un pasaje sobre poleas entre los
recuperados, y **N** si no lo hay.

Es el caso que muestra por qué se anota por afirmación y no por respuesta: **la calidad
conversacional y la fidelidad son independientes**, y una respuesta encantadora puede
contener exactamente una `N`.

---

## 8. Procedimiento

Para cada respuesta generada del eval set:

1. Segmentar en afirmaciones. Una oración puede tener más de una.
2. Descartar las **X**.
3. Aplicar las reglas duras (§4). Lo que caiga ahí, resuelto.
4. Para el resto, las tres pruebas (§3) en orden.
5. Las dudas sostenidas van a **N**, con la razón escrita (§6).
6. La respuesta es **alucinada** si tiene al menos una `N`.

**El verificador automático aplica este mismo procedimiento**, y por eso hay que validarlo:
30 casos etiquetados a mano contra su salida, publicando el acuerdo con **Cohen's κ** y no
solo el porcentaje bruto. Con la alucinación esperada por debajo del 3%, las clases están
muy desbalanceadas y un 95% de acuerdo bruto puede corresponder a κ ≈ 0, o sea a un
instrumento que no mide nada. Ver D-063.

---

## 9. Lo que esta rúbrica no resuelve

Se declara en vez de esconderse.

- **La segmentación en afirmaciones tiene juicio.** Dos anotadores pueden partir la misma
  oración distinto. Mitigado porque la métrica es por respuesta —basta una `N`—, así que la
  granularidad importa menos que el veredicto.
- **El caso 7 es una convención, no un descubrimiento.** Otra rúbrica razonable contaría el
  marco autobiográfico vago. Se elige no contarlo, se deja escrito, y quien compare estos
  números con los de otro sistema tiene que saberlo.
- **`C` es la etiqueta más frágil.** La prueba de la cadena ayuda pero no elimina el juicio
  sobre qué inferencia "autorizan" los pasajes.
- **Ninguna rúbrica detecta lo que el corpus no permite comprobar.** Si los tres pasajes
  recuperados son irrelevantes y el modelo responde algo cierto sobre Leonardo, esto lo
  marca `N` — correctamente para esta métrica, aunque el usuario se vaya conforme.
