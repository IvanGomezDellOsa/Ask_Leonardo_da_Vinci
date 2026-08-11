# Tarea de evaluación — 20 respuestas

Sos un evaluador. Tenés que decidir, para cada afirmación de cada respuesta, si lo
que afirma está sostenido por los pasajes que el sistema tenía a la vista.

**Los pasajes son la ÚNICA evidencia admisible.** Cualquier otra cosa —incluidos
hechos verdaderos sobre el Leonardo real— cuenta como no fundamentada.

Tomate el tiempo que haga falta. La calidad importa más que la velocidad.

---

# La rúbrica

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


---

# Formato de salida — OBLIGATORIO

Devolvé **un bloque de código** con una línea JSON por afirmación, sin nada más
alrededor. Una línea por afirmación, no por respuesta:

```
{"id":"A-01es","n":1,"texto":"los primeros 60 caracteres de la afirmación","paso1":"qué afirma sobre el mundo","etiqueta":"F"}
{"id":"A-01es","n":2,"texto":"...","paso1":"...","etiqueta":"N"}
```

- `paso1` es obligatorio y va **antes** de decidir: escribí qué afirma la frase sobre
  el mundo, sin la figura retórica. Si no queda ninguna proposición, poné `"-"` y
  etiquetá `X`.
- `etiqueta` es exactamente `F`, `N` o `X`.
- Segmentá la respuesta en afirmaciones vos mismo, una por oración con contenido.

Al final del bloque, agregá una última línea con la procedencia:

```
{"meta":true,"plataforma":"<qué usaste: Gemini web, ChatGPT, etc.>","modelo":"<si lo sabés>","fecha":"AAAA-MM-DD"}
```

Esa línea no es opcional: sin ella el resultado no se puede citar en la publicación.

---

# Las respuestas a evaluar


## 1. `B-01es`

**PREGUNTA:** ¿Cómo se aprende de verdad un oficio?

**PASAJES disponibles:**

> **[1]** El libro de Pandolfino, -cuchillos, -una pluma para reglar, -teñir el chaleco, -La biblioteca en San Marcos, -La biblioteca en Santo Spirito, -Lactancio de los Daldi, -Antonio Covoni, -Un libro del Maestro Paolo Infermieri, -Botas, zapatos y medias, -(Goma)laca, -Un aprendiz para hacer los modelos para mí. Gramática, de Lorenzo de Medici, -Giovanni del Sodo, -Sansovino, -una regla, -un cuchillo muy afilado, -Anteojos, -fracciones…., -reparar………, -el libro de Tomaso, -la cadenita de Michelagnolo; Aprende la multiplicación de raíces del Maestro Luca; -mi mapa del mundo que tiene Giovanni Benci; -Calcetines, -ropa de la aduana -oficial, -Cuero rojo de Córdoba, -El mapa del mundo, de Giovanni Benci, -una impresión, los distritos alrededor de Milán -Libro de mercado.

> **[2]** DE LA MANERA DE APRENDER A COMPONER FIGURAS [EN GRUPOS] EN PINTURAS HISTÓRICAS. Cuando hayas aprendido bien la perspectiva y tengas de memoria las partes y formas de los objetos, debes ir por ahí, y constantemente, mientras vas, observar, notar y considerar las circunstancias y comportamientos de los hombres al hablar, pelear o reír o luchar juntos: la acción de los hombres mismos y las acciones de los espectadores, que los separan o que miran. Y toma nota de ellos con trazos ligeros así, en un librito que siempre debes llevar contigo. Y debe ser de papel teñido, para que no se borre, sino cambia el viejo [cuando esté lleno] por uno nuevo; ya que estas cosas no deben borrarse sino conservarse con gran cuidado; porque las formas y posiciones de los objetos son tan infinitas que la memoria es incapaz de retenerlas, por lo tanto guarda estos [bocetos] como tus guías y maestros.

> **[3]** DEL ESTUDIO Y DEL ORDEN DEL ESTUDIO. Digo que primero debes aprender los miembros y su mecanismo, y teniendo este conocimiento, sus acciones deben venir después, según las circunstancias en que ocurren en el hombre. Y tercero componer temas, los estudios para los cuales deben ser tomados de acciones naturales y hechos de vez en cuando, como las circunstancias lo permitan; y presta atención a ellos en las calles y plazas y campos, y anótalos con una breve indicación de las formas; así para una cabeza haz una o, y para un brazo una línea recta o doblada, y lo mismo para las piernas y el cuerpo, y cuando vuelvas a casa elabora estas notas en forma completa. El Adversario dice que para adquirir práctica y hacer mucho trabajo es mejor que el primer período de estudio se emplee en dibujar varias composiciones hechas en papel o en paredes por diversos maestros, y que de esta manera la práctica se gana rápidamente, y buenos métodos; a lo cual respondo que el método será bueno, si está basado en obras de buena composición y de maestros hábiles. Pero como tales maestros son tan raros que hay pocos de ellos que se […]

**RESPUESTA DEL SISTEMA:**

| Para aprender, primero es necesario conocer la estructura y el funcionamiento de aquello que se estudia. Sobre esto dejé escrito: «primero debes aprender los miembros y su mecanismo, y teniendo este conocimiento, sus acciones deben venir después, según las circunstancias en que ocurren en el hombre».
| El estudio requiere orden y una observación constante de la naturaleza. Es preciso llevar siempre consigo un registro donde anotar lo que se ve en la vida diaria, pues «las formas y posiciones de los objetos son tan infinitas que la memoria es incapaz de retenerlas, por lo tanto guarda estos bocetos como tus guías y maestros».
| Al observar a los hombres en las plazas, las calles o los campos, conviene registrar los movimientos con brevedad. Sobre este método anoté: «haz una o, y para un brazo una línea recta o doblada, y lo mismo para las piernas y el cuerpo, y cuando vuelvas a casa elabora estas notas en forma completa». La práctica verdadera se nutre de estas acciones naturales, pues son ellas las que otorgan al maestro la capacidad de componer con destreza.


## 2. `D-04en`

**PREGUNTA:** What do you think of the theory of evolution?

**PASAJES disponibles:**

> **[1]** You must first explain the theory and then the practice. First you must describe the shadows and lights on opaque objects, and then on transparent bodies.

> **[2]** If the object in front of the eye sends its image to the eye, the eye, on the other hand, sends its image to the object, and no portion whatever of the object is lost in the images it throws off, for any reason either in the eye or the object. Therefore we may rather believe it to be the nature and potency of our luminous atmosphere which absorbs the images of the objects existing in it, than the nature of the objects, to send their images through the air. If the object opposite to the eye were to send its image to the eye, the eye would have to do the same to the object, whence it might seem that these images were an emanation. But, if so, it would be necessary [to admit] that every object became rapidly smaller; because each object appears by its images in the surrounding atmosphere. That is: the whole object in the whole atmosphere, and in each part; and all the objects in the whole atmosphere and all of them in each part; speaking of that atmosphere which is able to contain in itself the straight and radiating lines of the images projected […]

> **[3]** Remember that to be certain of the point of origin of any muscle, you must pull the sinew from which the muscle springs in such a way as to see that muscle move, and where it is attached to the ligaments of the bones. NOTE. You will never get any thing but confusion in demonstrating the muscles and their positions, origin, and termination, unless you first make a demonstration of thin muscles after the manner of linen threads; and thus you can represent them, one over another as nature has placed them; and thus, too, you can name them according to the limb they serve; for instance the motor of the point of the great toe, of its middle bone, of its first bone, &c. And when you have the knowledge you will draw, by the side of this, the true form and size and position of each muscle. But remember to give the threads which explain the situation of the muscles in the position which corresponds to the central line of each muscle; and so these threads will demonstrate the form of the leg and their distance in a plain and clear manner. I have removed the skin from […]

**RESPUESTA DEL SISTEMA:**

| On that I set nothing down. I have concerned myself primarily with the mechanics of the body and the nature of light.
| Regarding the study of the form of the body, «you will never get any thing but confusion in demonstrating the muscles and their positions, origin, and termination, unless you first make a demonstration of thin muscles after the manner of linen threads; and thus you can represent them, one over another as nature has placed them». 
| In my investigations, «you must first explain the theory and then the practice. First you must describe the shadows and lights on opaque objects, and then on transparent bodies». This is where my labors are directed.


## 3. `B-02es`

**PREGUNTA:** ¿Qué relación hay entre la pintura y las matemáticas?

**PASAJES disponibles:**

> **[1]** DE LA VIDA DEL PINTOR EN EL CAMPO. Un pintor necesita tales matemáticas como pertenecen a la pintura. Y la ausencia de todos los compañeros que están alejados de sus estudios; su cerebro debe ser fácilmente impresionado por la variedad de objetos que sucesivamente se le presentan, y también libre de otros cuidados. Y si, al considerar y definir un tema, un segundo tema interviene—como sucede cuando un objeto ocupa la mente, entonces debe decidir cuál de estos casos es el más difícil de resolver, y seguirlo hasta que se aclare por completo, y luego resolver la explicación del otro. Y sobre todo debe mantener su mente tan clara como la superficie de un espejo, que asume colores tan variados como los de los diferentes objetos. Y sus compañeros deberían ser como él en cuanto a sus estudios, y si no se pueden encontrar tales, debe mantener sus especulaciones solo para sí mismo, de modo que al final no encontrará compañía más útil [que la suya propia].

> **[2]** EL QUE DESPRECIA LA PINTURA NO AMA NI LA FILOSOFÍA NI LA NATURALEZA. Si condenas la pintura, que es la única imitadora de todas las obras visibles de la naturaleza, ciertamente despreciarás una invención sutil que lleva la filosofía y la especulación sutil a la consideración de la naturaleza de todas las formas—mares y llanuras, árboles, animales, plantas y flores—que están rodeadas de sombra y luz. Y esto es verdadero conocimiento y legítimo fruto de la naturaleza; pues la pintura nace de la naturaleza—o, para hablar más correctamente, diremos que es la nieta de la naturaleza; pues todas las cosas visibles son producidas por la naturaleza, y estos sus hijos han dado a luz a la pintura. De ahí que con justicia podamos llamarla nieta de la naturaleza y pariente de Dios.

> **[3]** CÓMO EL ESPEJO ES EL MAESTRO [Y GUÍA] DE LOS PINTORES. Cuando quieras ver si tu cuadro corresponde en todo con los objetos que has dibujado del natural, toma un espejo y mira en él el reflejo de las cosas reales, y compara la imagen reflejada con tu cuadro, y considera si el sujeto de las dos imágenes corresponde debidamente en ambas, estudiando particularmente el espejo. Debes tomar el espejo por tu guía—es decir, un espejo plano—porque en su superficie los objetos aparecen en muchos aspectos como en una pintura. Así ves, en una pintura hecha sobre una superficie plana, objetos que aparecen en relieve, y en el espejo—también una superficie plana—se ven igual. El cuadro tiene una superficie plana y lo mismo el espejo. El cuadro es intangible, en cuanto que lo que parece redondo y prominente no puede ser asido con las manos; y lo mismo ocurre con el espejo. Y ya que puedes ver que el espejo, por medio de contornos, sombras y luces, hace que los objetos aparezcan en relieve, tú, que tienes en tus colores luces y sombras mucho más fuertes que las del espejo, ciertamente puedes, si compones bien tu cuadro, hacer que también […]

**RESPUESTA DEL SISTEMA:**

| Sobre la relación entre ambas disciplinas dejé escrito: «Un pintor necesita tales matemáticas como pertenecen a la pintura». Esta necesidad no es caprichosa, pues la pintura es una invención sutil que nos permite llevar la especulación a la consideración de todas las formas visibles.
| Al trabajar, la mente del pintor debe actuar como un espejo, asumiendo la variedad de los objetos que la naturaleza produce. La pintura, al ser «la única imitadora de todas las obras visibles de la naturaleza», requiere de ese conocimiento matemático para ordenar y definir los temas que observamos en los mares, las llanuras, los árboles y las flores que nos rodean.


## 4. `A-13es`

**PREGUNTA:** ¿Cuál es la mejor luz para pintar?

**PASAJES disponibles:**

> **[1]** DE LA CALIDAD DE LA LUZ. Una luz ancha, alta y no demasiado fuerte hará los detalles de los objetos muy agradables.

> **[2]** ¿Qué luz es mejor para dibujar del natural; si alta o baja, o grande o pequeña, o fuerte y ancha, o fuerte y pequeña, o ancha y débil o pequeña y débil?

> **[3]** DE LA CALIDAD DE LA LUZ. En proporción al número de veces que una b cabe en c d será más luminosa que c d. Y similarmente, en proporción como el punto e cabe en c d será más luminoso que c d; y esta luz es útil para talladores de trabajo delicado.

**RESPUESTA DEL SISTEMA:**

| Sobre la mejor luz para pintar dejé escrito: «Una luz ancha, alta y no demasiado fuerte hará los detalles de los objetos muy agradables».
| Al considerar qué luz conviene para dibujar del natural, me he planteado «¿qué luz es mejor para dibujar del natural; si alta o baja, o grande o pequeña, o fuerte y ancha, o fuerte y pequeña, o ancha y débil o pequeña y débil?».
| Por otra parte, cuando el trabajo requiere una precisión mayor, como sucede con los talladores, «esta luz es útil para talladores de trabajo delicado».


## 5. `C-02en`

**PREGUNTA:** What do you think of the Gothic architecture of the north?

**PASAJES disponibles:**

> **[1]** OF JUDGING YOUR OWN PICTURES. We know very well that errors are better recognised in the works of others than in our own; and that often, while reproving little faults in others, you may ignore great ones in yourself. To avoid such ignorance, in the first place make yourself a master of perspective, then acquire perfect knowledge of the proportions of men and other animals, and also, study good architecture, that is so far as concerns the forms of buildings and other objects which are on the face of the earth; these forms are infinite, and the better you know them the more admirable will your work be. And in cases where you lack experience do not shrink from drawing them from nature. But, to carry out my promise above [in the title]—I say that when you paint you should have a flat mirror and often look at your work as reflected in it, when you will see it reversed, and it will appear to you like some other painter's work, so you will be better able to judge of its faults than in any other way. Again, it is well that you should often leave off work and take […]

> **[2]** The landscape has a finer azure [tone] when, in fine weather the sun is at noon than at any other time of the day, because the air is purified of moisture; and looking at it under that aspect you will see the trees of a beautiful green at the outside and the shadows dark towards the middle; and in the remoter distance the atmosphere which comes between you and them looks more beautiful when there is something dark beyond. And still the azure is most beautiful. The objects seen from the side on which the sun shines will not show you their shadows. But, if you are lower than the sun, you can see what is not seen by the sun and that will be all in shade. The leaves of the trees, which come between you and the sun are of two principal colours which are a splendid lustre of green, and the reflection of the atmosphere which lights up the objects which cannot be seen by the sun, and the shaded portions which only face the earth, and the darkest which are surrounded by something that is not dark. The trees in the landscape which are between you […]

> **[3]** Vitruvius, the architect, says in his work on architecture that the measurements of the human body are distributed by Nature as follows: that is that 4 fingers make 1 palm, and 4 palms make 1 foot, 6 palms make 1 cubit; 4 cubits make a man's height. And 4 cubits make one pace and 24 palms make a man; and these measures he used in his buildings. If you open your legs so much as to decrease your height 1/14 and spread and raise your arms till your middle fingers touch the level of the top of your head you must know that the centre of the outspread limbs will be in the navel and the space between the legs will be an equilateral triangle. The length of a man's outspread arms is equal to his height. From the roots of the hair to the bottom of the chin is the tenth of a man's height; from the bottom of the chin to the top of his head is one eighth of his height; from the top of the breast to the top of his head will be one sixth of a man. From the top of the breast to […]

**RESPUESTA DEL SISTEMA:**

| On that I set nothing down. My own counsel is to «study good architecture, that is so far as concerns the forms of buildings and other objects which are on the face of the earth; these forms are infinite, and the better you know them the more admirable will your work be.»
| I find that the measure of all things is found in the human form, for as I have noted, «the measurements of the human body are distributed by Nature as follows: that is that 4 fingers make 1 palm, and 4 palms make 1 foot, 6 palms make 1 cubit; 4 cubits make a man's height.»


## 6. `A-01en`

**PREGUNTA:** What is the difference between light and lustre?

**PASAJES disponibles:**

> **[1]** Of the difference between light and lustre; and that lustre is not included among colours, but is saturation of whiteness, and derived from the surface of wet bodies; light partakes of the colour of the object which reflects it (to the eye) as gold or silver or the like.

> **[2]** OF PAINTING. Heigh light or lustre on any object is not situated [necessarily] in the middle of an illuminated object, but moves as and where the eye moves in looking at it.

> **[3]** OF THE HIGHEST LIGHTS WHICH TURN AND MOVE AS THE EYE MOVES WHICH SEES THE OBJECT. Suppose the body to be the round object figured here and let the light be at the point a, and let the illuminated side of the object be b c and the eye at the point d: I say that, as lustre is every where and complete in each part, if you stand at the point d the lustre will appear at c, and in proportion as the eye moves from d to a, the lustre will move from c to n.

**RESPUESTA DEL SISTEMA:**

| «The difference between light and lustre; and that lustre is not included among colours, but is saturation of whiteness, and derived from the surface of wet bodies; light partakes of the colour of the object which reflects it (to the eye) as gold or silver or the like.»
| When you observe a body, know that the lustre is not fixed, for «lustre on any object is not situated [necessarily] in the middle of an illuminated object, but moves as and where the eye moves in looking at it.»
| It is a curious motion, for «as lustre is every where and complete in each part, if you stand at the point d the lustre will appear at c, and in proportion as the eye moves from d to a, the lustre will move from c to n.»


## 7. `A-01es`

**PREGUNTA:** ¿Qué diferencia hay entre la luz y el lustre?

**PASAJES disponibles:**

> **[1]** De la diferencia entre luz y lustre; y que el lustre no se incluye entre los colores, sino que es saturación de blancura, y derivado de la superficie de los cuerpos húmedos; la luz participa del color del objeto que la refleja (al ojo), como oro o plata o similar.

> **[2]** DE LAS LUCES MÁS ALTAS QUE GIRAN Y SE MUEVEN COMO SE MUEVE EL OJO QUE VE EL OBJETO. Supón que el cuerpo es el objeto redondo figurado aquí y que la luz está en el punto a, y que el lado iluminado del objeto es b c y el ojo en el punto d: digo que, como el lustre está en todas partes y completo en cada parte, si te paras en el punto d, el lustre aparecerá en c, y en proporción a como el ojo se mueve de d a a, el lustre se moverá de c a n.

> **[3]** DE LA PINTURA. La luz alta o lustre en cualquier objeto no está situado [necesariamente] en el medio de un objeto iluminado, sino que se mueve como y donde se mueve el ojo al mirarlo.

**RESPUESTA DEL SISTEMA:**

| Sobre la diferencia entre luz y lustre dejé escrito: «el lustre no se incluye entre los colores, sino que es saturación de blancura, y derivado de la superficie de los cuerpos húmedos; la luz participa del color del objeto que la refleja (al ojo), como oro o plata o similar».
| La posición de estos elementos también varía, pues la luz alta o lustre en cualquier objeto no siempre se encuentra en el medio de la parte iluminada. Sobre esto anoté: «la luz alta o lustre en cualquier objeto no está situado [necesariamente] en el medio de un objeto iluminado, sino que se mueve como y donde se mueve el ojo al mirarlo».


## 8. `A-08es`

**PREGUNTA:** ¿Cómo se pinta el efecto del viento sobre los árboles?

**PASAJES disponibles:**

> **[1]** DE REPRESENTAR EL VIENTO. Al representar el viento, además de la curvatura de las ramas y la inversión de sus hojas hacia el cuarto de donde viene el viento, también debes representarlas en medio de nubes de polvo fino mezclado con el aire turbado.

> **[2]** La tremenda furia del viento impulsado por el derrumbamiento de las colinas sobre las cuevas del interior—por la caída de las colinas que servían de techos a estas cavernas. Una piedra lanzada por el aire deja en el ojo que la ve la impresión de su movimiento, y el mismo efecto producen las gotas de agua que caen de las nubes cuando llueve [16]. [17] Una montaña que cae sobre una ciudad levantará polvo en forma de nubes; pero el color de este polvo diferirá del de las nubes. Donde la lluvia sea más espesa, que el color del polvo sea menos visible, y donde el polvo sea más espeso, que la lluvia sea menos visible. Y donde la lluvia se mezcle con el viento y con el polvo, las nubes creadas por la lluvia deben ser más transparentes que las de polvo [solo]. Y cuando llamas de fuego se mezclen con nubes de humo y agua, se formarán nubes muy opacas y oscuras. Y el resto de este tema se tratará en detalle en el libro sobre pintura.

> **[3]** Describe paisajes con el viento, y el agua, y la puesta y la salida del sol. EL VIENTO. Todas las hojas que colgaban hacia la tierra por la curvatura de los brotes con sus ramas, son vueltas al revés por las ráfagas de viento, y aquí su perspectiva está invertida; porque, si el árbol está entre ti y el cuarto del viento, las hojas que están hacia ti permanecen en su aspecto natural, mientras que las del lado opuesto que deberían tener sus puntas en dirección contraria tienen, por ser vueltas, sus puntas vueltas hacia ti.

**RESPUESTA DEL SISTEMA:**

| Para representar el viento, «además de la curvatura de las ramas y la inversión de sus hojas hacia el cuarto de donde viene el viento, también debes representarlas en medio de nubes de polvo fino mezclado con el aire turbado».
| Al pintar los árboles, considera que «todas las hojas que colgaban hacia la tierra por la curvatura de los brotes con sus ramas, son vueltas al revés por las ráfagas de viento, y aquí su perspectiva está invertida». Debes prestar atención a la posición del árbol respecto al observador, pues «si el árbol está entre ti y el cuarto del viento, las hojas que están hacia ti permanecen en su aspecto natural, mientras que las del lado opuesto que deberían tener sus puntas en dirección contraria tienen, por ser vueltas, sus puntas vueltas hacia ti».


## 9. `F-08en`

**PREGUNTA:** Why did you write from right to left?

**PASAJES disponibles:**

> **[1]** This other hindered me in anatomy, blaming it before the Pope; and likewise at the hospital; and he has filled [*4] this whole Belvedere with workshops for mirrors; and he did the same thing in Maestro Giorgio's room. He said that he had been promised [*7] eight ducats every month, beginning with the first day, when he set out, or at latest when he spoke with you; and that you agreed. Seeing that he seldom stayed in the workshop, and that he ate a great deal, I sent him word that, if he liked I could deal with him separately for each thing that he might make, and would give him what we might agree to be a fair valuation. He took counsel with his neighbour and gave up his room, selling every thing, and went to find…

> **[2]** When you draw the nude always sketch the whole figure and then finish those limbs which seem to you the best, but make them act with the other limbs; otherwise you will get a habit of never putting the limbs well together on the body. Never make the head turn the same way as the torso, nor the arm and leg move together on the same side. And if the face is turned to the right shoulder, make all the parts lower on the left side than on the right; and when you turn the body with the breast outwards, if the head turns to the left side make the parts on the right side higher than those on the left.

> **[3]** OF THE DISPOSITION OF LIMBS. As regards the disposition of limbs in movement you will have to consider that when you wish to represent a man who, by some chance, has to turn backwards or to one side, you must not make him move his feet and all his limbs towards the side to which he turns his head. Rather must you make the action proceed by degrees and through the different joints; that is, those of the foot, the knee and the hip and the neck. And if you set him on the right leg, you must make the left knee bend inwards, and let his foot be slightly raised on the outside, and the left shoulder be somewhat lower than the right, while the nape of the neck is in a line directly over the outer ancle of the left foot. And the left shoulder will be in a perpendicular line above the toes of the right foot. And always set your figures so that the side to which the head turns is not the side to which the breast faces, since nature for our convenience has made us with a neck which bends with ease in many […]

**RESPUESTA DEL SISTEMA:**

| On that I set nothing down. 
| When you seek to understand the movement of the human form, you must observe how the body shifts its weight and balance. On the disposition of limbs, I set down: «And if you set him on the right leg, you must make the left knee bend inwards, and let his foot be slightly raised on the outside, and the left shoulder be somewhat lower than the right, while the nape of the neck is in a line directly over the outer ancle of the left foot.»
| To achieve grace in your work, you must avoid making the parts of the figure move in unison. I noted: «Never make the head turn the same way as the torso, nor the arm and leg move together on the same side.»


## 10. `F-09es`

**PREGUNTA:** ¿Cómo era tu relación con Miguel Ángel?

**PASAJES disponibles:**

> **[1]** negaría, si no tuviera el escrito firmado por mí y por el intérprete. Y yo, viendo que no trabajaba para mí a menos que no tuviera trabajo que hacer para otros, lo cual solicitaba con mucho cuidado, lo invité a cenar conmigo, y a trabajar después cerca de mí, porque, además del ahorro de gasto, él *1351. 1353. adquiriría la lengua italiana. Siempre prometía, pero nunca lo hacía. Y esto lo hice también, porque ese Giovanni, el alemán que hace los espejos, estaba siempre allí en el taller, y quería ver y saber todo lo que se hacía allí y lo daba a conocer fuera… criticándolo fuertemente; y porque cenaba con los de la guardia del Papa, y luego salían con escopetas matando pájaros entre las ruinas; y esto continuaba desde después de la cena hasta la tarde; y cuando enviaba a Lorenzo a apremiarlo para que trabajara, decía que no tendría tantos amos sobre él, y que su trabajo era para la Guardarropa de vuestra Excelencia; y así pasaron dos meses y así continuó; y un día, encontrando a Gian Niccolò de la Guardarropa y preguntándole si el alemán había terminado el trabajo para vuestra Magnificencia, me dijo que […]

> **[2]** [Ilustrísimo Señor. Me alegro grandemente, Ilustrísimo Señor, de vuestra…] Me alegré tanto, Ilustrísimo Señor, por la deseada restauración de vuestra salud, que casi tuvo el efecto de que [mi propia salud se recuperó]—[he superado mi enfermedad]—mi enfermedad me dejó— —de la casi restaurada salud de vuestra Excelencia. Pero estoy extremadamente molesto por no haber podido satisfacer completamente los deseos de vuestra Excelencia, por la maldad de ese engañador, por quien no dejé nada sin hacer que pudiera hacerse por él por mí y con lo que pudiera serle útil; y en primer lugar sus estipendios le fueron pagados antes de tiempo, lo que creo que negaría de buena gana, si no tuviera el escrito firmado por mí y por el intérprete. Y yo, viendo que no trabajaba para mí a menos que no tuviera trabajo que hacer para otros, lo cual solicitaba con mucho cuidado, lo invité a cenar conmigo, y a trabajar después cerca de mí, porque, además del ahorro de gasto, él *1351. 1353.

> **[3]** Este otro me estorbó en la anatomía, culpándome ante el Papa; y asimismo en el hospital; y ha llenado [*4] todo este Belvedere de talleres para espejos; e hizo lo mismo en la habitación de Maestro Giorgio. Dijo que le habían prometido [*7] ocho ducados cada mes, comenzando desde el primer día, cuando partió, o a más tardar cuando habló con vos; y que vos estuvisteis de acuerdo. Viendo que rara vez permanecía en el taller, y que comía mucho, le envié recado de que, si quería, podía tratar con él separadamente por cada cosa que hiciera, y le daría lo que acordáramos que fuera una justa valoración. Tomó consejo con su vecino y renunció a su habitación, vendiendo todo, y fue a buscar...

**RESPUESTA DEL SISTEMA:**

| Sobre ese asunto no dejé nada escrito. 
| En mis anotaciones, sin embargo, sí he dejado constancia de las dificultades que enfrenté en el taller con otros hombres, como aquel alemán que hacía espejos y cuya presencia me resultó una carga. Sobre la falta de compromiso en el trabajo, anoté: «viendo que rara vez permanecía en el taller, y que comía mucho, le envié recado de que, si quería, podía tratar con él separadamente por cada cosa que hiciera, y le daría lo que acordáramos que fuera una justa valoración». 
| Aquel individuo también me causó molestias en mis estudios, pues «este otro me estorbó en la anatomía, culpándome ante el Papa; y asimismo en el hospital».


## 11. `B-11en`

**PREGUNTA:** What would you say to someone just beginning to paint?

**PASAJES disponibles:**

> **[1]** WHAT RULES SHOULD BE GIVEN TO BOYS LEARNING TO PAINT. We know for certain that sight is one of the most rapid actions we can perform. In an instant we see an infinite number of forms, still we only take in thoroughly one object at a time. Supposing that you, Reader, were to glance rapidly at the whole of this written page, you would instantly perceive that it was covered with various letters; but you could not, in the time, recognise what the letters were, nor what they were meant to tell. Hence you would need to see them word by word, line by line to be able to understand the letters. Again, if you wish to go to the top of a building you must go up step by step; otherwise it will be impossible that you should reach the top. Thus I say to you, whom nature prompts to pursue this art, if you wish to have a sound knowledge of the forms of objects begin with the details of them, and do not go on to the second [step] till you have the first well fixed in memory and in practice. And if you do otherwise you […]

> **[2]** OF THE LIFE OF THE PAINTER IN HIS STUDIO. To the end that well-being of the body may not injure that of the mind, the painter or draughtsman must remain solitary, and particularly when intent on those studies and reflections which will constantly rise up before his eye, giving materials to be well stored in the memory. While you are alone you are entirely your own [master] and if you have one companion you are but half your own, and the less so in proportion to the indiscretion of his behaviour. And if you have many companions you will fall deeper into the same trouble. If you should say: "I will go my own way and withdraw apart, the better to study the forms of natural objects", I tell you, you will not be able to help often listening to their chatter. And so, since one cannot serve two masters, you will badly fill the part of a companion, and carry out your studies of art even worse. And if you say: "I will withdraw so far that their words cannot reach me and they cannot disturb me", I can tell you that you will be thought mad. But, you […]

> **[3]** And if the poet gratifies the sense by means of the ear, the painter does so by the eye—the worthier sense; but I will say no more of this but that, if a good painter represents the fury of a battle, and if a poet describes one, and they are both together put before the public, you will see where most of the spectators will stop, to which they will pay most attention, on which they will bestow most praise, and which will satisfy them best. Undoubtedly painting being by a long way the more intelligible and beautiful, will please most. Write up the name of God [Christ] in some spot and setup His image opposite and you will see which will be most reverenced. Painting comprehends in itself all the forms of nature, while you have nothing but words, which are not universal as form is, and if you have the effects of the representation, we have the representation of the effects. Take a poet who describes the beauty of a lady to her lover and a painter who represents her and you will see to which nature guides the enamoured critic. Certainly the proof should be allowed to […]

**RESPUESTA DEL SISTEMA:**

| To one who feels the urge to pursue this art, I say that industry and thoroughness are the first conditions. If you wish to have a sound knowledge of the forms of objects, «begin with the details of them, and do not go on to the second [step] till you have the first well fixed in memory and in practice.»
| To master the sight, which is a rapid action, one must proceed with patience, for «if you wish to go to the top of a building you must go up step by step; otherwise it will be impossible that you should reach the top.» Just as one cannot read a page without taking in the letters word by word, you must not rush your hand or your eye.
| Furthermore, ensure that the well-being of your mind remains undisturbed. On that I set down: «the painter or draughtsman must remain solitary, and particularly when intent on those studies and reflections which will constantly rise up before his eye, giving materials to be well stored in the memory.» While you are alone you are entirely your own master, whereas the chatter of companions will only serve to hinder your progress in art.


## 12. `A-09en`

**PREGUNTA:** How is a night scene to be painted?

**PASAJES disponibles:**

> **[1]** OF THE WAY TO REPRESENT A NIGHT [SCENE]. That which is entirely bereft of light is all darkness; given a night under these conditions and that you want to represent a night scene,—arrange that there shall be a great fire, then the objects which are nearest to this fire will be most tinged with its colour; for those objects which are nearest to a coloured light participate most in its nature; as therefore you give the fire a red colour, you must make all the objects illuminated by it ruddy; while those which are farther from the fire are more tinted by the black hue of night. The figures which are seen against the fire look dark in the glare of the firelight because that side of the objects which you see is tinged by the darkness of the night and not by the fire; and those who stand at the side are half dark and half red; while those who are visible beyond the edges of the flame will be fully lighted by the ruddy glow against a black background. As to their gestures, make those which are near it screen themselves with their hands and cloaks as a […]

> **[2]** A PICTURE OF OBJECTS IN PERSPECTIVE WILL LOOK MORE LIFELIKE WHEN SEEN FROM THE POINT FROM WHICH THE OBJECTS WERE DRAWN. If you want to represent an object near to you which is to have the effect of nature, it is impossible that your perspective should not look wrong, with every false relation and disagreement of proportion that can be imagined in a wretched work, unless the spectator, when he looks at it, has his eye at the very distance and height and direction where the eye or the point of sight was placed in doing this perspective. Hence it would be necessary to make a window, or rather a hole, of the size of your face through which you can look at the work; and if you do this, beyond all doubt your work, if it is correct as to light and shade, will have the effect of nature; nay you will hardly persuade yourself that those objects are painted; otherwise do not trouble yourself about it, unless indeed you make your view at least 20 times as far off as the greatest width or height of the objects represented, and this will satisfy any spectator placed anywhere opposite […]

> **[3]** A METHOD OF DRAWING AN OBJECT IN RELIEF AT NIGHT. Place a sheet of not too transparent paper between the relievo and the light and you can draw thus very well.

**RESPUESTA DEL SISTEMA:**

| «OF THE WAY TO REPRESENT A NIGHT [SCENE]. That which is entirely bereft of light is all darkness; given a night under these conditions and that you want to represent a night scene,—arrange that there shall be a great fire, then the objects which are nearest to this fire will be most tinged with its colour; for those objects which are nearest to a coloured light participate most in its nature; as therefore you give the fire a red colour, you must make all the objects illuminated by it ruddy; while those which are farther from the fire are more tinted by the black hue of night.»
| The figures presented in such a scene require careful placement of light and shadow to appear true. «The figures which are seen against the fire look dark in the glare of the firelight because that side of the objects which you see is tinged by the darkness of the night and not by the fire; and those who stand at the side are half dark and half red; while those who are visible beyond the edges of the flame will be fully lighted by the ruddy glow against a black background.»
| For the execution of such work, one may find utility in simple aids. On that I set down: «Place a sheet of not too transparent paper between the relievo and the light and you can draw thus very well.»


## 13. `B-13es`

**PREGUNTA:** ¿Por qué conviene estudiar muchas artes y no una sola?

**PASAJES disponibles:**

> **[1]** El joven debe aprender primero perspectiva, luego las proporciones de los objetos. Después puede copiar de algún buen maestro, para acostumbrarse a las formas finas. Luego de la naturaleza, para confirmar con la práctica las reglas que ha aprendido. Luego ver por un tiempo las obras de varios maestros. Luego adquirir el hábito de poner su arte en práctica y trabajar.

> **[2]** DE JUZGAR TUS PROPIOS CUADROS. Sabemos muy bien que los errores se reconocen mejor en las obras de otros que en las nuestras; y que a menudo, mientras reprendes pequeñas faltas en otros, puedes ignorar grandes en ti mismo. Para evitar tal ignorancia, en primer lugar hazte maestro de la perspectiva, luego adquiere perfecto conocimiento de las proporciones de los hombres y otros animales, y también, estudia buena arquitectura, es decir en cuanto concierne a las formas de los edificios y otros objetos que están sobre la faz de la tierra; estas formas son infinitas, y cuanto mejor las conozcas más admirable será tu obra. Y en los casos en que te falte experiencia no te encogas de dibujarlas del natural. Pero, para cumplir mi promesa arriba [en el título]—digo que cuando pintes debes tener un espejo plano y mirar a menudo tu obra reflejada en él, cuando la verás invertida, y te parecerá como obra de algún otro pintor, así podrás juzgar mejor sus faltas que de cualquier otra manera. Otra vez, es bueno que a menudo dejes el trabajo y tomes un poco de relajación, porque, cuando vuelves a él eres mejor juez; pues sentarse demasiado cerca del […]

> **[3]** DE LA VIDA DEL PINTOR EN SU ESTUDIO. Para que el bienestar del cuerpo no dañe el de la mente, el pintor o dibujante debe permanecer solitario, y particularmente cuando está atento a esos estudios y reflexiones que constantemente se levantarán ante su ojo, dando materiales para ser bien almacenados en la memoria. Mientras estás solo eres enteramente tuyo [maestro] y si tienes un compañero eres solo medio tuyo, y menos en proporción a la indiscreción de su comportamiento. Y si tienes muchos compañeros caerás más profundamente en el mismo problema. Si dijeras: "Iré por mi propio camino y me retiraré aparte, para estudiar mejor las formas de los objetos naturales", te digo que no podrás evitar escuchar a menudo su charla. Y así, ya que uno no puede servir a dos amos, llenarás mal el papel de compañero, y llevarás a cabo tus estudios de arte aún peor. Y si dices: "Me retiraré tan lejos que sus palabras no puedan alcanzarme y no puedan perturbarme", puedo decirte que serás considerado loco. Pero, ves, al menos estarás solo. Y si debes tener compañía, búscala en tu estudio. Esto puede ayudarte a tener las ventajas que surgen de varias especulaciones. Toda […]

**RESPUESTA DEL SISTEMA:**

| Sobre los conocimientos que debe poseer quien aspira a la excelencia, dejé escrito: «en primer lugar hazte maestro de la perspectiva, luego adquiere perfecto conocimiento de las proporciones de los hombres y otros animales, y también, estudia buena arquitectura, es decir en cuanto concierne a las formas de los edificios y otros objetos que están sobre la faz de la tierra; estas formas son infinitas, y cuanto mejor las conozcas más admirable será tu obra».
| La naturaleza de nuestro oficio exige que el entendimiento se nutra de diversas disciplinas. Al dominar estas materias, el artista se vuelve capaz de comprender la variedad de las formas que nos rodean. Sobre esto, anoté que «el joven debe aprender primero perspectiva, luego las proporciones de los objetos». Solo mediante este estudio riguroso y variado es que uno puede confirmar con la práctica las reglas del arte y alcanzar la maestría.


## 14. `A-03en`

**PREGUNTA:** Where do the colours of the rainbow come from?

**PASAJES disponibles:**

> **[1]** The colours in the middle of the rainbow mingle together. The bow in itself is not in the rain nor in the eye that sees it; though it is generated by the rain, the sun, and the eye. The rainbow is always seen by the eye that is between the rain and the body of the sun; hence if the sun is in the East and the rain is in the West it will appear on the rain in the West.

> **[2]** Treat of the rainbow in the last book on Painting, but first write the book on colours produced by the mixture of other colours, so as to be able to prove by those painters' colours how the colours of the rainbow are produced.

> **[3]** WHETHER THE COLOURS OF THE RAINBOW ARE PRODUCED BY THE SUN. The colours of the rainbow are not produced by the sun, for they occur in many ways without the sunshine; as may be seen by holding a glass of water up to the eye; when, in the glass—where there are those minute bubbles always seen in coarse glass—each bubble, even though the sun does not fall on it, will produce on one side all the colours of the rainbow; as you may see by placing the glass between the day light and your eye in such a way as that it is close to the eye, while on one side the glass admits the [diffused] light of the atmosphere, and on the other side the shadow of the wall on one side of the window; either left or right, it matters not which. Then, by turning the glass round you will see these colours all round the bubbles in the glass &c. And the rest shall be said in its place. THAT THE EYE HAS NO PART IN PRODUCING THE COLOURS OF THE RAINBOW. In the experiment just described, the eye would seem to have some share in the […]

**RESPUESTA DEL SISTEMA:**

| The origin of these colours is not found in the sun alone, for they may appear in many other ways. On that I set down: «The colours of the rainbow are not produced by the sun, for they occur in many ways without the sunshine».
| One may observe this by holding a glass of water to the eye, where minute bubbles catch the light. As I noted: «each bubble, even though the sun does not fall on it, will produce on one side all the colours of the rainbow». 
| While some might suggest the eye itself creates them, I have observed that «the bow in itself is not in the rain nor in the eye that sees it; though it is generated by the rain, the sun, and the eye». The colours in the middle of the bow mingle together, and I intend to prove how they are produced by comparing them to the mixtures used by painters.


## 15. `B-10en`

**PREGUNTA:** What do water and air have in common in the way you study them?

**PASAJES disponibles:**

> **[1]** THE ORDER OF THE FIRST BOOK ON WATER. Define first what is meant by height and depth; also how the elements are situated one inside another. Then, what is meant by solid weight and by liquid weight; but first what weight and lightness are in themselves. Then describe why water moves, and why its motion ceases; then why it becomes slower or more rapid; besides this, how it always falls, being in contact with the air but lower than the air. And how water rises in the air by means of the heat of the sun, and then falls again in rain; again, why water springs forth from the tops of mountains; and if the water of any spring higher than the ocean can pour forth water higher than the surface of that ocean. And how all the water that returns to the ocean is higher than the sphere of waters. And how the waters of the equatorial seas are higher than the waters of the North, and higher beneath the body of the sun than in any part of the equatorial circle; for experiment shows that under the heat of a burning brand the water near the brand boils, […]

> **[2]** That the brightness of the air is occasioned by the water which has dissolved itself in it into imperceptible molecules. These, being lighted by the sun from the opposite side, reflect the brightness which is visible in the air; and the azure which is seen in it is caused by the darkness that is hidden beyond the air.

> **[3]** OF THE NATURE OF SIGHT. I say that sight is exercised by all animals, by the medium of light; and if any one adduces, as against this, the sight of nocturnal animals, I must say that this in the same way is subject to the very same natural laws. For it will easily be understood that the senses which receive the images of things do not project from themselves any visual virtue . On the contrary the atmospheric medium which exists between the object and the sense incorporates in itself the figure of things, and by its contact with the sense transmits the object to it. If the object—whether by sound or by odour—presents its spiritual force to the ear or the nose, then light is not required and does not act. The forms of objects do not send their images into the air if they are not illuminated [8]; and the eye being thus constituted cannot receive that from the air, which the air does not possess, although it touches its surface. If you choose to say that there are many animals that prey at night, I answer that when the little light which suffices the nature of their […]

**RESPUESTA DEL SISTEMA:**

| On the motion and nature of these elements, I set down: «the atmospheric medium which exists between the object and the sense incorporates in itself the figure of things, and by its contact with the sense transmits the object to it.» Just as the air serves as a medium to convey the forms of objects to the eye, water possesses its own weight and motion, being «in contact with the air but lower than the air.»
| Furthermore, the two are bound by the influence of the sun. Concerning the air, I noted: «the brightness of the air is occasioned by the water which has dissolved itself in it into imperceptible molecules.» This same heat of the sun causes the movement of water, for I have observed «how water rises in the air by means of the heat of the sun, and then falls again in rain.»


## 16. `C-05en`

**PREGUNTA:** What do you think of the Flemish painters?

**PASAJES disponibles:**

> **[1]** OF THE MISERABLE PRETENCES MADE BY THOSE WHO FALSELY AND UNWORTHILY ACQUIRE THE NAME OF PAINTERS. Now there is a certain race of painters who, having studied but little, must need take as their standard of beauty mere gold and azure, and these, with supreme conceit, declare that they will not give good work for miserable payment, and that they could do as well as any other if they were well paid. But, ye foolish folks! cannot such artists keep some good work, and then say: this is a costly work and this more moderate and this is average work and show that they can work at all prices?

> **[2]** PAINTING. The mind of the painter must resemble a mirror, which always takes the colour of the object it reflects and is completely occupied by the images of as many objects as are in front of it. Therefore you must know, Oh Painter! that you cannot be a good one if you are not the universal master of representing by your art every kind of form produced by nature. And this you will not know how to do if you do not see them, and retain them in your mind. Hence as you go through the fields, turn your attention to various objects, and, in turn look now at this thing and now at that, collecting a store of divers facts selected and chosen from those of less value. But do not do like some painters who, when they are wearied with exercising their fancy dismiss their work from their thoughts and take exercise in walking for relaxation, but still keep fatigue in their mind which, though they see various objects [around them], does not apprehend them; but, even when they meet friends or relations and are saluted by them, although they see and hear them, take no more cognisance […]

> **[3]** And if the poet gratifies the sense by means of the ear, the painter does so by the eye—the worthier sense; but I will say no more of this but that, if a good painter represents the fury of a battle, and if a poet describes one, and they are both together put before the public, you will see where most of the spectators will stop, to which they will pay most attention, on which they will bestow most praise, and which will satisfy them best. Undoubtedly painting being by a long way the more intelligible and beautiful, will please most. Write up the name of God [Christ] in some spot and setup His image opposite and you will see which will be most reverenced. Painting comprehends in itself all the forms of nature, while you have nothing but words, which are not universal as form is, and if you have the effects of the representation, we have the representation of the effects. Take a poet who describes the beauty of a lady to her lover and a painter who represents her and you will see to which nature guides the enamoured critic. Certainly the proof should be allowed to […]

**RESPUESTA DEL SISTEMA:**

| On that I set nothing down. I have, however, concerned myself with the duties of those who take up the brush and the necessity of mastering the forms of nature.
| «The mind of the painter must resemble a mirror, which always takes the colour of the object it reflects and is completely occupied by the images of as many objects as are in front of it.» To be a master, one must possess the capacity to represent every form produced by nature, and this is only achieved by those who diligently observe and retain such sights in their mind.
| Those who lack this dedication often fall into error, or as I have observed: «there is a certain race of painters who, having studied but little, must need take as their standard of beauty mere gold and azure». True skill lies in the intelligible representation of nature, for «painting comprehends in itself all the forms of nature, while you have nothing but words, which are not universal as form is».


## 17. `B-06en`

**PREGUNTA:** Why look at nature rather than copy other masters?

**PASAJES disponibles:**

> **[1]** The youth should first learn perspective, then the proportions of objects. Then he may copy from some good master, to accustom himself to fine forms. Then from nature, to confirm by practice the rules he has learnt. Then see for a time the works of various masters. Then get the habit of putting his art into practice and work.

> **[2]** THAT PAINTING DECLINES AND DETERIORATES FROM AGE TO AGE, WHEN PAINTERS HAVE NO OTHER STANDARD THAN PAINTING ALREADY DONE. Hence the painter will produce pictures of small merit if he takes for his standard the pictures of others. But if he will study from natural objects he will bear good fruit; as was seen in the painters after the Romans who always imitated each other and so their art constantly declined from age to age. After these came Giotto the Florentine who—not content with imitating the works of Cimabue his master—being born in the mountains and in a solitude inhabited only by goats and such beasts, and being guided by nature to his art, began by drawing on the rocks the movements of the goats of which he was keeper. And thus he began to draw all the animals which were to be found in the country, and in such wise that after much study he excelled not only all the masters of his time but all those of many bygone ages. Afterwards this art declined again, because everyone imitated the pictures that were already done; thus it went on from century to century until Tomaso, of Florence, nicknamed Masaccio, […]

> **[3]** It is better to imitate [copy] the antique than modern work.

**RESPUESTA DEL SISTEMA:**

| «THAT PAINTING DECLINES AND DETERIORATES FROM AGE TO AGE, WHEN PAINTERS HAVE NO OTHER STANDARD THAN PAINTING ALREADY DONE.» When a painter relies solely on the works of others, he produces pictures of small merit, for he follows a path that leads only to imitation.
| If one studies from natural objects, however, he will bear good fruit. It is by observing nature that a student confirms the rules he has learnt by practice. Even the masters of the past who achieved great excellence did so because they were «guided by nature to his art» rather than content with the works of those who came before them.
| While it is better to imitate the antique than modern work, the true way to advance is to turn one’s eyes toward the world itself. By studying the movements and forms of nature, the artist moves beyond the cycle of decline that haunts those who only look to the paintings already done.


## 18. `C-04es`

**PREGUNTA:** ¿Cómo se pinta el vidrio de una ventana de colores?

**PASAJES disponibles:**

> **[1]** Encuentra a Longhi y dile que lo esperas en Roma e irás con él a Nápoles; haz que te paguen la donación y toma el libro de Vitolone, y las medidas de los edificios públicos. [3] Haz hacer dos cajas cubiertas para llevar en mulas, pero las cubiertas de cama serán mejores; esto hace tres, de las cuales dejarás una en Vinci. [4] Obtén el………….. de Giovanni Lombardo, el pañero de lino de Verona. Compra pañuelos y toallas,…. y zapatos, 4 pares de medias, un jubón de… y pieles, para hacer otros nuevos; el lago de Alessandro. Vende lo que no puedas llevar contigo. Obtén de Jean de París el método de pintar al temple y la manera de hacer blanco C.19b

> **[2]** El verdigrís con áloe, o goma guta, o cúrcuma, hace un verde fino, y también con azafrán o oropimente quemado; pero dudo que en poco tiempo no se vuelvan negros. El azul ultramar y el amarillo de vidrio mezclados hacen un hermoso verde para fresco, es decir, pintura mural. La laca y el verdigrís hacen una buena sombra para el azul en pintura al óleo.

> **[3]** Usa negro en la sombra, y en las luces blanco, amarillo, verde, bermellón y laca. Sombras medias; toma la sombra como arriba y mézclala con los tonos de carne recién mencionados, añadiendo un poco de amarillo y un poco de verde y ocasionalmente un poco de laca; para las sombras toma verde y laca para los tonos medios.

**RESPUESTA DEL SISTEMA:**

| Sobre el uso de los colores y sus mezclas dejé escrito: «el azul ultramar y el amarillo de vidrio mezclados hacen un hermoso verde para fresco, es decir, pintura mural».
| Sobre cómo pintar el vidrio de una ventana no he dejado nada escrito. En mis notas solo he considerado el uso de ciertos pigmentos para la pintura al óleo o al fresco, como cuando anoté: «usa negro en la sombra, y en las luces blanco, amarillo, verde, bermellón y laca».


## 19. `A-04en`

**PREGUNTA:** What proportion does the foot bear to the face?

**PASAJES disponibles:**

> **[1]** The foot, from where it is attached to the leg, to the tip of the great toe is as long as the space between the upper part of the chin and the roots of the hair a b; and equal to five sixths of the face.

> **[2]** a d is a head's length, c b is a head's length. The four smaller toes are all equally thick from the nail at the top to the bottom, and are 1/13 of the foot.

> **[3]** The whole length of the foot will lie between the elbow and the wrist and between the elbow and the inner angle of the arm towards the breast when the arm is folded. The foot is as long as the whole head of a man, that is from under the chin to the topmost part of the head in the way here figured.

**RESPUESTA DEL SISTEMA:**

| On the relative proportions of the foot and of the face I set down: «The foot, from where it is attached to the leg, to the tip of the great toe is as long as the space between the upper part of the chin and the roots of the hair a b; and equal to five sixths of the face.»
| Furthermore, it is useful to note the scale of the toes in relation to this measure, for «the four smaller toes are all equally thick from the nail at the top to the bottom, and are 1/13 of the foot.»


## 20. `C-03en`

**PREGUNTA:** What do you think of the painters' guild in Florence?

**PASAJES disponibles:**

> **[1]** There is one whom his Lordship invited from Florence to do this work and who is a worthy master, but with so very much business he will never finish it; and you may imagine that a difference there is to be seen between a beautiful object and an ugly one. Quote Pliny.

> **[2]** Magnificent Commissioners of Buildings I, understanding that your Magnificencies have made up your minds to make certain great works in bronze, will remind you of certain things: first that you should not be so hasty or so quick to give the commission, lest by this haste it should become impossible to select a good model and a good master; and some man of small merit may be chosen, who by his insufficiency may cause you to ** be abused by your descendants, judging that this age was but ill supplied with men of good counsel and with good masters; seeing that other cities, and chiefly the city of the Florentines, has been as it were in these very days, endowed with beautiful and grand works in bronze; among which are the doors of their Baptistery. And this town of Florence, like Piacenza, is a place of intercourse, through which many foreigners pass; who, seeing that the works are fine and of good quality, carry away a good impression, and will say that that city is well filled with worthy inhabitants, seeing the works which bear witness to their opinion; and on the other hand, I say seeing so much metal […]

> **[3]** A picture or representation of human figures, ought to be done in such a way as that the spectator may easily recognise, by means of their attitudes, the purpose in their minds. Thus, if you have to represent a man of noble character in the act of speaking, let his gestures be such as naturally accompany good words; and, in the same way, if you wish to depict a man of a brutal nature, give him fierce movements; as with his arms flung out towards the listener, and his head and breast thrust forward beyond his feet, as if following the speaker's hands. Thus it is with a deaf and dumb person who, when he sees two men in conversation—although he is deprived of hearing—can nevertheless understand, from the attitudes and gestures of the speakers, the nature of their discussion. I once saw in Florence a man who had become deaf who, when you spoke very loud did not understand you, but if you spoke gently and without making any sound, understood merely from the movement of the lips. Now perhaps you will say that the lips of a man who speaks loudly do not move like those of one […]

**RESPUESTA DEL SISTEMA:**

| On the city of Florence and its works I set down: «And this town of Florence, like Piacenza, is a place of intercourse, through which many foreigners pass; who, seeing that the works are fine and of good quality, carry away a good impression, and will say that that city is well filled with worthy inhabitants, seeing the works which bear witness to their opinion».
| On that I set nothing down concerning the guild itself. I have observed, however, that the city is «endowed with beautiful and grand works in bronze; among which are the doors of their Baptistery». Such works serve as a testament to the skill of the masters who reside there.
