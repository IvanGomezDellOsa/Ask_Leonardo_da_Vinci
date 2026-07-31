"""
Las consultas del experimento de separabilidad, en dos tandas.

  grupo:  "dentro" = el corpus de Richter deberia tener material
          "fuera"  = el corpus no tiene material (o el material es de Richter,
                     no de Leonardo, que a efectos del gate es lo mismo)
  idioma: "es" | "en"

TANDA 1 (40) — la exploratoria. Mostro que las dos distribuciones separan
dentro de cada idioma pero en escalas distintas, asi que no hay umbral unico.

TANDA 2 (150) — para medir el MARGEN, que es lo que la tanda 1 no pudo:
con 10 consultas por celda, el margen del espanol dio +0,0008 y ese numero
no se sostiene con esa muestra. 75 dentro / 75 fuera y 75 es / 75 en.

En total 190: 95 dentro / 95 fuera, 95 es / 95 en.

Las consultas son mayormente paralelas entre idiomas (la misma pregunta en
es y en en). Es deliberado: mantiene el idioma como unica variable que cambia
y es lo que permitio atribuir el desplazamiento al idioma y no al tema.
"""

TANDA_1 = [
    # ---------------- DENTRO DEL CORPUS - espanol ----------------
    ("dentro", "es", "¿Cómo se deben pintar las sombras sobre una figura?"),
    ("dentro", "es", "¿Por qué las montañas lejanas se ven azuladas?"),
    ("dentro", "es", "¿Cómo se mueve el agua de un río cuando encuentra un obstáculo?"),
    ("dentro", "es", "¿Cómo hacen los pájaros para sostenerse en el aire sin batir las alas?"),
    ("dentro", "es", "¿Cuáles son las proporciones del cuerpo humano?"),
    ("dentro", "es", "¿Qué debe estudiar un joven que quiere aprender a pintar?"),
    ("dentro", "es", "¿Cómo se representa la luz sobre un rostro?"),
    ("dentro", "es", "¿Cómo están dispuestos los músculos del brazo?"),
    ("dentro", "es", "¿Qué le pasa al color de las cosas cuando están muy lejos?"),
    ("dentro", "es", "¿Cómo se forman los remolinos en el agua?"),
    # ---------------- DENTRO DEL CORPUS - ingles ----------------
    ("dentro", "en", "How should shadows be painted upon a figure?"),
    ("dentro", "en", "Why do distant mountains appear blue?"),
    ("dentro", "en", "How does the water of a river move when it meets an obstacle?"),
    ("dentro", "en", "How do birds stay aloft without beating their wings?"),
    ("dentro", "en", "What are the proportions of the human body?"),
    ("dentro", "en", "What should a young man study who wants to learn to paint?"),
    ("dentro", "en", "How is light rendered upon a face?"),
    ("dentro", "en", "How are the muscles of the arm arranged?"),
    ("dentro", "en", "What happens to the colour of things when they are very far away?"),
    ("dentro", "en", "How are eddies and whirlpools formed in water?"),
    # ---------------- FUERA DEL CORPUS - espanol ----------------
    ("fuera", "es", "¿Qué opinás de la Mona Lisa y de su sonrisa?"),
    ("fuera", "es", "¿Qué pensás de Miguel Ángel como rival?"),
    ("fuera", "es", "¿Estuviste enamorado alguna vez?"),
    ("fuera", "es", "¿Cómo fue tu muerte en Francia?"),
    ("fuera", "es", "¿Qué opinás de las elecciones presidenciales de este año?"),
    ("fuera", "es", "¿Cómo funciona la inteligencia artificial?"),
    ("fuera", "es", "¿Quién va a ganar el Mundial de fútbol?"),
    ("fuera", "es", "¿Cuál es el mejor teléfono celular del mercado?"),
    ("fuera", "es", "¿Qué te parece la política migratoria de la Unión Europea?"),
    ("fuera", "es", "¿Cuánto sale un pasaje de avión a Madrid?"),
    # ---------------- FUERA DEL CORPUS - ingles ----------------
    ("fuera", "en", "What do you think of the Mona Lisa and her smile?"),
    ("fuera", "en", "What did you think of Michelangelo as a rival?"),
    ("fuera", "en", "Were you ever in love with anyone?"),
    ("fuera", "en", "Tell me about your death in France."),
    ("fuera", "en", "What is your opinion on this year's presidential election?"),
    ("fuera", "en", "How does artificial intelligence work?"),
    ("fuera", "en", "Who is going to win the football World Cup?"),
    ("fuera", "en", "What is the best mobile phone on the market?"),
    ("fuera", "en", "What do you make of the European Union's immigration policy?"),
    ("fuera", "en", "How much does a plane ticket to Madrid cost?"),
]

# ==========================================================================
# TANDA 2 — 150 consultas para medir el margen
# ==========================================================================

TANDA_2 = [
    # ---------------- DENTRO - espanol (38) ----------------
    ("dentro", "es", "¿Cómo logro que una figura pintada parezca tener relieve?"),
    ("dentro", "es", "¿Qué es la perspectiva aérea?"),
    ("dentro", "es", "¿Por qué el aire lejano se vuelve azul?"),
    ("dentro", "es", "¿Cómo se debe representar el humo en un cuadro?"),
    ("dentro", "es", "¿De qué manera hay que estudiar el movimiento del agua?"),
    ("dentro", "es", "¿Qué forma toman las olas cuando el viento sopla sobre un lago?"),
    ("dentro", "es", "¿Cómo cae el agua desde una gran altura?"),
    ("dentro", "es", "¿Por qué se encuentran conchas marinas en la cima de las montañas?"),
    ("dentro", "es", "¿Cómo se forman y se deshacen las nubes?"),
    ("dentro", "es", "¿Por qué brilla la luna de noche?"),
    ("dentro", "es", "¿Cómo funciona el ojo humano?"),
    ("dentro", "es", "¿Qué ocurre dentro de una cámara oscura con un agujero pequeño?"),
    ("dentro", "es", "¿Cómo se comporta la luz al pasar por una abertura estrecha?"),
    ("dentro", "es", "¿Cómo debe el pintor estudiar la sombra?"),
    ("dentro", "es", "¿Qué diferencia hay entre la sombra primitiva y la derivada?"),
    ("dentro", "es", "¿Cómo se pintan los pliegues de los paños?"),
    ("dentro", "es", "¿Cómo se dibuja el cabello cuando está en movimiento?"),
    ("dentro", "es", "¿Qué proporción hay entre la cabeza y el cuerpo entero?"),
    ("dentro", "es", "¿Cuántas cabezas mide un hombre bien proporcionado?"),
    ("dentro", "es", "¿Cuáles son las proporciones del caballo?"),
    ("dentro", "es", "¿Cómo se mueven los tendones de la mano?"),
    ("dentro", "es", "¿Qué debe saber el pintor de los huesos para dibujar el cuerpo?"),
    ("dentro", "es", "¿Cómo se representa el rostro de un anciano?"),
    ("dentro", "es", "¿Cómo se pintan las expresiones del rostro?"),
    ("dentro", "es", "¿Cómo debe componerse una escena de batalla?"),
    ("dentro", "es", "¿Es la pintura superior a la escultura?"),
    ("dentro", "es", "¿Qué debe hacer el pintor cuando está solo?"),
    ("dentro", "es", "¿Conviene juzgar la propia obra mirándola en un espejo?"),
    ("dentro", "es", "¿Por qué es importante dibujar del natural?"),
    ("dentro", "es", "¿Cómo se ejercita la memoria visual?"),
    ("dentro", "es", "¿Cómo vuelan las aves contra el viento?"),
    ("dentro", "es", "¿Qué hace el ave con la cola cuando gira en el aire?"),
    ("dentro", "es", "¿Se puede construir una máquina para que el hombre vuele?"),
    ("dentro", "es", "¿Cómo se reparte el peso en un arco?"),
    ("dentro", "es", "¿Cómo se levanta un peso por medio de poleas?"),
    ("dentro", "es", "¿Cómo se debe fortificar una ciudad?"),
    ("dentro", "es", "¿Cómo crecen las ramas de un árbol?"),
    ("dentro", "es", "¿Por qué las hojas se disponen así alrededor del tallo?"),
    # ---------------- DENTRO - ingles (37) ----------------
    ("dentro", "en", "How do I make a painted figure appear to have relief?"),
    ("dentro", "en", "What is aerial perspective?"),
    ("dentro", "en", "Why does the distant air turn blue?"),
    ("dentro", "en", "How should smoke be represented in a picture?"),
    ("dentro", "en", "In what manner should the motion of water be studied?"),
    ("dentro", "en", "What shape do waves take when the wind blows over a lake?"),
    ("dentro", "en", "How does water fall from a great height?"),
    ("dentro", "en", "Why are sea shells found on the tops of mountains?"),
    ("dentro", "en", "How are clouds formed and how do they dissolve?"),
    ("dentro", "en", "Why does the moon shine at night?"),
    ("dentro", "en", "How does the human eye work?"),
    ("dentro", "en", "What happens inside a dark chamber with a small hole?"),
    ("dentro", "en", "How does light behave when it passes through a narrow opening?"),
    ("dentro", "en", "How should the painter study shadow?"),
    ("dentro", "en", "What is the difference between primary and derived shadow?"),
    ("dentro", "en", "How should the folds of drapery be painted?"),
    ("dentro", "en", "How is hair drawn when it is in motion?"),
    ("dentro", "en", "What is the proportion between the head and the whole body?"),
    ("dentro", "en", "How many heads tall is a well proportioned man?"),
    ("dentro", "en", "What are the proportions of a horse?"),
    ("dentro", "en", "How do the tendons of the hand move?"),
    ("dentro", "en", "What must a painter know of bones to draw the body?"),
    ("dentro", "en", "How should the face of an old man be represented?"),
    ("dentro", "en", "How are the expressions of the face painted?"),
    ("dentro", "en", "How should a battle scene be composed?"),
    ("dentro", "en", "Is painting superior to sculpture?"),
    ("dentro", "en", "What should the painter do when he is alone?"),
    ("dentro", "en", "Is it good to judge one's own work in a mirror?"),
    ("dentro", "en", "Why is it important to draw from nature?"),
    ("dentro", "en", "How does one train the visual memory?"),
    ("dentro", "en", "How do birds fly against the wind?"),
    ("dentro", "en", "What does a bird do with its tail when it turns in the air?"),
    ("dentro", "en", "Can a machine be built that allows a man to fly?"),
    ("dentro", "en", "How is weight distributed in an arch?"),
    ("dentro", "en", "How is a weight raised by means of pulleys?"),
    ("dentro", "en", "How should a city be fortified?"),
    ("dentro", "en", "How do the branches of a tree grow?"),
    # ---------------- FUERA - espanol (37) ----------------
    ("fuera", "es", "¿Por qué sonríe así la Gioconda?"),
    ("fuera", "es", "¿Dónde está hoy la Mona Lisa?"),
    ("fuera", "es", "¿Cuánto vale el Salvator Mundi?"),
    ("fuera", "es", "¿Qué sentiste al pintar La Última Cena?"),
    ("fuera", "es", "¿Peleaste con Miguel Ángel en Florencia?"),
    ("fuera", "es", "¿Qué opinás de la Capilla Sixtina?"),
    ("fuera", "es", "¿Qué pensás de Rafael?"),
    ("fuera", "es", "¿Cómo era tu relación con Salaì?"),
    ("fuera", "es", "¿Tuviste hijos?"),
    ("fuera", "es", "¿Te casaste alguna vez?"),
    ("fuera", "es", "¿Cómo era tu padre?"),
    ("fuera", "es", "¿Es cierto que te juzgaron en Florencia?"),
    ("fuera", "es", "¿Dónde estás enterrado?"),
    ("fuera", "es", "¿De qué moriste?"),
    ("fuera", "es", "¿Qué edad tenías cuando moriste?"),
    ("fuera", "es", "¿Quién ganó las últimas elecciones en Argentina?"),
    ("fuera", "es", "¿Qué opinás del presidente de los Estados Unidos?"),
    ("fuera", "es", "¿Qué está pasando con la guerra en Ucrania?"),
    ("fuera", "es", "¿Qué te parece la Unión Europea?"),
    ("fuera", "es", "¿Cómo funciona internet?"),
    ("fuera", "es", "¿Qué es una criptomoneda?"),
    ("fuera", "es", "¿Cómo funciona un teléfono inteligente?"),
    ("fuera", "es", "¿Qué red social me conviene usar?"),
    ("fuera", "es", "¿Qué auto me conviene comprar?"),
    ("fuera", "es", "¿Cómo funciona una vacuna?"),
    ("fuera", "es", "¿Qué es el cambio climático?"),
    ("fuera", "es", "¿Cuándo llegó el hombre a la Luna?"),
    ("fuera", "es", "¿Cómo se llega a Marte?"),
    ("fuera", "es", "¿Quién ganó el último Mundial?"),
    ("fuera", "es", "¿Quién es mejor, Messi o Maradona?"),
    ("fuera", "es", "¿Cómo se juega al tenis?"),
    ("fuera", "es", "¿Cuándo son los próximos Juegos Olímpicos?"),
    ("fuera", "es", "¿Qué película me recomendás ver?"),
    ("fuera", "es", "¿Cómo se hace una pizza?"),
    ("fuera", "es", "¿Cuál es la mejor serie de Netflix?"),
    ("fuera", "es", "¿Cuánto cuesta el alquiler en Buenos Aires?"),
    ("fuera", "es", "¿Me ayudás con mi declaración de impuestos?"),
    # ---------------- FUERA - ingles (38) ----------------
    ("fuera", "en", "Why does the Mona Lisa smile like that?"),
    ("fuera", "en", "Where is the Mona Lisa kept today?"),
    ("fuera", "en", "How much is the Salvator Mundi worth?"),
    ("fuera", "en", "What did you feel while painting the Last Supper?"),
    ("fuera", "en", "Did you quarrel with Michelangelo in Florence?"),
    ("fuera", "en", "What do you think of the Sistine Chapel?"),
    ("fuera", "en", "What is your opinion of Raphael?"),
    ("fuera", "en", "What was your relationship with Salai like?"),
    ("fuera", "en", "Did you have any children?"),
    ("fuera", "en", "Were you ever married?"),
    ("fuera", "en", "What was your father like?"),
    ("fuera", "en", "Is it true that you were put on trial in Florence?"),
    ("fuera", "en", "Where are you buried?"),
    ("fuera", "en", "What did you die of?"),
    ("fuera", "en", "How old were you when you died?"),
    ("fuera", "en", "Who won the last election in Argentina?"),
    ("fuera", "en", "What do you think of the president of the United States?"),
    ("fuera", "en", "What is happening with the war in Ukraine?"),
    ("fuera", "en", "What do you think of the European Union?"),
    ("fuera", "en", "How does the internet work?"),
    ("fuera", "en", "What is a cryptocurrency?"),
    ("fuera", "en", "How does a smartphone work?"),
    ("fuera", "en", "Which social network should I use?"),
    ("fuera", "en", "What car should I buy?"),
    ("fuera", "en", "How does a vaccine work?"),
    ("fuera", "en", "What is climate change?"),
    ("fuera", "en", "When did man land on the Moon?"),
    ("fuera", "en", "How do we get to Mars?"),
    ("fuera", "en", "Who won the last World Cup?"),
    ("fuera", "en", "Who is better, Messi or Maradona?"),
    ("fuera", "en", "How do you play tennis?"),
    ("fuera", "en", "When are the next Olympic Games?"),
    ("fuera", "en", "What film should I watch?"),
    ("fuera", "en", "How do you make a pizza?"),
    ("fuera", "en", "What is the best series on Netflix?"),
    ("fuera", "en", "How much is rent in Buenos Aires?"),
    ("fuera", "en", "Can you help me with my tax return?"),
    ("fuera", "en", "What is the weather forecast for tomorrow?"),
]

# la tanda 1 sigue disponible sola, para reproducir el resultado exploratorio
CONSULTAS = TANDA_1
TODAS = [(g, i, t, 1) for g, i, t in TANDA_1] + [(g, i, t, 2) for g, i, t in TANDA_2]


def _control() -> None:
    from collections import Counter
    c = Counter((g, i) for g, i, _, _ in TODAS)
    assert len(TANDA_2) == 150, len(TANDA_2)
    assert sum(v for (g, _), v in c.items() if g == "dentro") == 95
    assert sum(v for (_, i), v in c.items() if i == "es") == 95
    assert len({t for _, _, t, _ in TODAS}) == len(TODAS), "hay consultas repetidas"


_control()

