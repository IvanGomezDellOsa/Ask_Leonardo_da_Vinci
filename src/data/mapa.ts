/**
 * GENERADO por `npm run mapa` desde `artifacts/chunks.json` y
 * `artifacts/chunks_es.json`. NO EDITAR A MANO: los nombres de sección, sus
 * descripciones y los rótulos rescritos viven en `tools/mapa_temas.ts`.
 *
 * ⚠ `visible` es lo que se muestra; `consulta` es lo que se manda al buscar, y
 * es el título ORIGINAL de Richter. `alcance.json` midió que ese título
 * recupera sus propios pasajes en 345 de 375 casos: mandar otro texto invalida
 * esa medición.
 */

export interface TemaDelMapa {
  /** El rótulo limpio, para leer. */
  visible: string;
  /** El título original: lo que viaja al buscador. */
  consulta: string;
  pasajes: number;
  /** Aparece como «lo más cercano» a casi cualquier cosa: no se destaca. */
  iman?: boolean;
}

export interface SeccionDelMapa {
  seccion: string;
  /** Qué hay adentro, en una línea. */
  glosa: string;
  pasajes: number;
  temas: TemaDelMapa[];
}

export const MAPA: SeccionDelMapa[] =
[
 {
  "seccion": "La práctica de la pintura",
  "glosa": "Cómo preparaba los colores, dónde ponía la luz y cómo pintaba gestos y telas",
  "pasajes": 182,
  "temas": [
   {
    "visible": "Sobre la preparación y uso de los colores",
    "consulta": "Sobre la preparación y uso de los colores",
    "pasajes": 9
   },
   {
    "visible": "Sobre la mejor luz para pintar",
    "consulta": "Sobre la mejor luz para pintar",
    "pasajes": 8
   },
   {
    "visible": "De los gestos apropiados",
    "consulta": "De los gestos apropiados",
    "pasajes": 8
   },
   {
    "visible": "Sobre materiales químicos",
    "consulta": "Sobre materiales químicos",
    "pasajes": 8
   },
   {
    "visible": "Sobre varias ayudas para preparar un cuadro",
    "consulta": "Sobre varias ayudas para preparar un cuadro",
    "pasajes": 6
   },
   {
    "visible": "Sobre la elección de la luz para un cuadro",
    "consulta": "Sobre la elección de la luz para un cuadro",
    "pasajes": 6
   },
   {
    "visible": "La selección de las formas",
    "consulta": "La selección de las formas",
    "pasajes": 6
   },
   {
    "visible": "De la representación del diluvio",
    "consulta": "De la representación del diluvio",
    "pasajes": 6
   },
   {
    "visible": "Del yeso y del papel",
    "consulta": "Del yeso y del papel",
    "pasajes": 6
   },
   {
    "visible": "La posición correcta del artista, al pintar y del espectador",
    "consulta": "La posición correcta del artista, al pintar y del espectador",
    "pasajes": 5,
    "iman": true
   },
   {
    "visible": "La distribución de la luz y la sombra",
    "consulta": "La distribución de la luz y la sombra",
    "pasajes": 5
   },
   {
    "visible": "La preparación de los aceites",
    "consulta": "La preparación de los aceites",
    "pasajes": 5
   },
   {
    "visible": "Cómo adquirir universalidad",
    "consulta": "Cómo adquirir universalidad",
    "pasajes": 4
   },
   {
    "visible": "Sobre varias ayudas en la preparación de un cuadro",
    "consulta": "Sobre varias ayudas en la preparación de un cuadro",
    "pasajes": 4
   },
   {
    "visible": "Sobre la iluminación del fondo",
    "consulta": "Sobre la iluminación del fondo",
    "pasajes": 4
   },
   {
    "visible": "Los métodos de la perspectiva aérea",
    "consulta": "Los métodos de la perspectiva aérea",
    "pasajes": 4
   },
   {
    "visible": "Sugerencias generales para cuadros históricos",
    "consulta": "Sugerencias generales para cuadros históricos",
    "pasajes": 4
   },
   {
    "visible": "De pintar batallas",
    "consulta": "De pintar batallas",
    "pasajes": 4
   },
   {
    "visible": "El curso de instrucción para un artista",
    "consulta": "El curso de instrucción para un artista",
    "pasajes": 3
   },
   {
    "visible": "Sobre la capacidad productiva de los artistas menores",
    "consulta": "Sobre la capacidad productiva de los artistas menores",
    "pasajes": 3
   },
   {
    "visible": "Sobre la construcción de ventanas",
    "consulta": "Sobre la construcción de ventanas",
    "pasajes": 3
   },
   {
    "visible": "Sobre las limitaciones de la pintura",
    "consulta": "Sobre las limitaciones de la pintura",
    "pasajes": 3
   },
   {
    "visible": "La posición correcta del artista, al pintar, y del espectador",
    "consulta": "La posición correcta del artista, al pintar, y del espectador",
    "pasajes": 3
   },
   {
    "visible": "De la luz en el rostro",
    "consulta": "De la luz en el rostro",
    "pasajes": 3
   },
   {
    "visible": "Sobre los barnices",
    "consulta": "Sobre los barnices",
    "pasajes": 3
   },
   {
    "visible": "Sobre los materiales químicos",
    "consulta": "Sobre los materiales químicos",
    "pasajes": 3
   },
   {
    "visible": "La pintura es superior a la poesía",
    "consulta": "La pintura es superior a la poesía",
    "pasajes": 3
   },
   {
    "visible": "Aforismos",
    "consulta": "Aforismos",
    "pasajes": 3
   },
   {
    "visible": "El estudio de lo antiguo",
    "consulta": "El estudio de lo antiguo",
    "pasajes": 2
   },
   {
    "visible": "La necesidad del conocimiento anatómico",
    "consulta": "La necesidad del conocimiento anatómico",
    "pasajes": 2
   },
   {
    "visible": "Industria y minuciosidad las primeras condiciones",
    "consulta": "Industria y minuciosidad las primeras condiciones",
    "pasajes": 2
   },
   {
    "visible": "La vida privada del artista y la elección de compañía",
    "consulta": "La vida privada del artista y la elección de compañía",
    "pasajes": 2
   },
   {
    "visible": "La distribución del tiempo para el estudio",
    "consulta": "La distribución del tiempo para el estudio",
    "pasajes": 2
   },
   {
    "visible": "Juegos y ejercicios útiles",
    "consulta": "Juegos y ejercicios útiles",
    "pasajes": 2
   },
   {
    "visible": "Sobre la elección de una posición",
    "consulta": "Sobre la elección de una posición",
    "pasajes": 2
   },
   {
    "visible": "El tamaño aparente de las figuras en un cuadro",
    "consulta": "El tamaño aparente de las figuras en un cuadro",
    "pasajes": 2
   },
   {
    "visible": "La yuxtaposición de la luz y la sombra",
    "consulta": "La yuxtaposición de la luz y la sombra",
    "pasajes": 2
   },
   {
    "visible": "Cómo representar las diferencias de edad y sexo",
    "consulta": "Cómo representar las diferencias de edad y sexo",
    "pasajes": 2
   },
   {
    "visible": "De cómo representar una tempestad",
    "consulta": "De cómo representar una tempestad",
    "pasajes": 2
   },
   {
    "visible": "De cómo representar el diluvio",
    "consulta": "De cómo representar el diluvio",
    "pasajes": 2
   },
   {
    "visible": "De la representación de fenómenos naturales",
    "consulta": "De la representación de fenómenos naturales",
    "pasajes": 2
   },
   {
    "visible": "La relación del arte y la naturaleza",
    "consulta": "La relación del arte y la naturaleza",
    "pasajes": 2
   },
   {
    "visible": "La pintura es superior a la escultura",
    "consulta": "La pintura es superior a la escultura",
    "pasajes": 2
   },
   {
    "visible": "Sobre la historia de la pintura",
    "consulta": "Sobre la historia de la pintura",
    "pasajes": 2
   },
   {
    "visible": "Cómo determinar las disposiciones para una carrera artística",
    "consulta": "Cómo determinar las disposiciones para una carrera artística",
    "pasajes": 1
   },
   {
    "visible": "Cómo adquirir práctica",
    "consulta": "Cómo adquirir práctica",
    "pasajes": 1
   },
   {
    "visible": "La distribución del tiempo para estudiar",
    "consulta": "La distribución del tiempo para estudiar",
    "pasajes": 1
   },
   {
    "visible": "Sobre el poder productivo de los artistas menores",
    "consulta": "Sobre el poder productivo de los artistas menores",
    "pasajes": 1
   },
   {
    "visible": "Una advertencia contra el estudio unilateral",
    "consulta": "Una advertencia contra el estudio unilateral",
    "pasajes": 1
   },
   {
    "visible": "Sobre el tamaño del estudio",
    "consulta": "Sobre el tamaño del estudio",
    "pasajes": 1
   },
   {
    "visible": "Sobre el manejo de las obras",
    "consulta": "Sobre el manejo de las obras",
    "pasajes": 1
   },
   {
    "visible": "Sobre la gestión de las obras",
    "consulta": "Sobre la gestión de las obras",
    "pasajes": 1
   },
   {
    "visible": "De las gradaciones de luz y sombra",
    "consulta": "De las gradaciones de luz y sombra",
    "pasajes": 1
   },
   {
    "visible": "Sobre la iluminación de los objetos blancos",
    "consulta": "Sobre la iluminación de los objetos blancos",
    "pasajes": 1
   },
   {
    "visible": "De dibujar figuras y retratos",
    "consulta": "DE De dibujar figuras y retratos",
    "pasajes": 1
   },
   {
    "visible": "Bosquejar figuras y retratos",
    "consulta": "DE Bosquejar figuras y retratos",
    "pasajes": 1
   },
   {
    "visible": "La posición de la cabeza",
    "consulta": "La posición de la cabeza",
    "pasajes": 1
   },
   {
    "visible": "De representar las emociones",
    "consulta": "De representar las emociones",
    "pasajes": 1
   },
   {
    "visible": "De representar animales imaginarios",
    "consulta": "De representar animales imaginarios",
    "pasajes": 1
   },
   {
    "visible": "Cómo posar figuras",
    "consulta": "Cómo posar figuras",
    "pasajes": 1
   },
   {
    "visible": "De cómo representar escenas nocturnas",
    "consulta": "De cómo representar escenas nocturnas",
    "pasajes": 1
   },
   {
    "visible": "Sobre la preparación del panel",
    "consulta": "Sobre la preparación del panel",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Escritos humorísticos",
  "glosa": "Fábulas, adivinanzas, chistes y profecías burlonas",
  "pasajes": 125,
  "temas": [
   {
    "visible": "Estudios sobre la vida y las costumbres de los animales",
    "consulta": "Estudios sobre la vida y las costumbres de los animales",
    "pasajes": 44
   },
   {
    "visible": "Profecías",
    "consulta": "Profecías",
    "pasajes": 30
   },
   {
    "visible": "Chanzas y cuentos",
    "consulta": "Chanzas y cuentos",
    "pasajes": 13,
    "iman": true
   },
   {
    "visible": "Fábulas sobre plantas",
    "consulta": "Fábulas sobre plantas (1275-1279)",
    "pasajes": 9
   },
   {
    "visible": "Fábulas sobre animales",
    "consulta": "Fábulas sobre animales (1265-1270)",
    "pasajes": 6
   },
   {
    "visible": "Esquemas para fábulas, etc",
    "consulta": "Esquemas para fábulas, etc. (1314-1323)",
    "pasajes": 6
   },
   {
    "visible": "Esquemas para profecías",
    "consulta": "Esquemas para profecías (1324-1329)",
    "pasajes": 6
   },
   {
    "visible": "Fábulas sobre objetos sin vida",
    "consulta": "Fábulas sobre objetos sin vida (1271—1274)",
    "pasajes": 4
   },
   {
    "visible": "Trucos",
    "consulta": "Trucos (1333-1335)",
    "pasajes": 3
   },
   {
    "visible": "Borradores y esquemas para los escritos humorísticos",
    "consulta": "Borradores y esquemas para los escritos humorísticos",
    "pasajes": 2
   },
   {
    "visible": "El movimiento tiende hacia el centro de gravedad",
    "consulta": "El movimiento tiende hacia el centro de gravedad",
    "pasajes": 1
   },
   {
    "visible": "Ironía",
    "consulta": "Ironía (1332)",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Seis libros sobre luz y sombra",
  "glosa": "Cómo cae una sombra, cómo se degrada y cómo se pinta",
  "pasajes": 113,
  "temas": [
   {
    "visible": "Sobre la forma de las sombras derivadas",
    "consulta": "Sobre la forma de las sombras derivadas",
    "pasajes": 9
   },
   {
    "visible": "Sobre la proporción relativa de la luz y las sombras",
    "consulta": "Sobre la proporción relativa de la luz y las sombras",
    "pasajes": 6
   },
   {
    "visible": "Diferentes principios y planes de tratamiento",
    "consulta": "Diferentes principios y planes de tratamiento",
    "pasajes": 5
   },
   {
    "visible": "Luz y sombra con respecto a la posición del ojo",
    "consulta": "Luz y sombra con respecto a la posición del ojo",
    "pasajes": 5
   },
   {
    "visible": "Sobre la proporción de luz y sombra",
    "consulta": "SOBRE LA PROPORCIÓN DE LUZ Y SOMBRA",
    "pasajes": 5
   },
   {
    "visible": "Sobre la intensidad relativa de las sombras derivadas",
    "consulta": "Sobre la intensidad relativa de las sombras derivadas",
    "pasajes": 5
   },
   {
    "visible": "Definición de la naturaleza de las sombras",
    "consulta": "Definición de la naturaleza de las sombras",
    "pasajes": 4
   },
   {
    "visible": "La diferencia entre luz y lustre",
    "consulta": "La diferencia entre luz y lustre",
    "pasajes": 4
   },
   {
    "visible": "Experimentos sobre la relación de la luz y la sombra dentro de una habitación",
    "consulta": "Experimentos sobre la relación de la luz y la sombra dentro de una habitación",
    "pasajes": 4
   },
   {
    "visible": "Complicaciones adicionales en las sombras derivadas",
    "consulta": "Complicaciones adicionales en las sombras derivadas",
    "pasajes": 4
   },
   {
    "visible": "La forma de las sombras proyectadas",
    "consulta": "SOBRE La forma de las sombras proyectadas",
    "pasajes": 4
   },
   {
    "visible": "Sobre los contornos de las sombras proyectadas",
    "consulta": "Sobre los contornos de las sombras proyectadas",
    "pasajes": 4
   },
   {
    "visible": "De las diversas clases de sombras",
    "consulta": "De las diversas clases de sombras",
    "pasajes": 3
   },
   {
    "visible": "Sobre la naturaleza de la luz",
    "consulta": "SOBRE Sobre la naturaleza de la luz",
    "pasajes": 3
   },
   {
    "visible": "Sobre la intensidad de las sombras según la distancia de la luz",
    "consulta": "SOBRE LA INTENSIDAD DE LAS SOMBRAS SEGÚN LA DISTANCIA DE LA LUZ",
    "pasajes": 3
   },
   {
    "visible": "Sobre la relación de la sombra derivada y la primaria",
    "consulta": "Sobre la relación de la sombra derivada y la primaria",
    "pasajes": 3
   },
   {
    "visible": "Sobre la profundidad relativa de las sombras proyectadas",
    "consulta": "Sobre la profundidad relativa de las sombras proyectadas",
    "pasajes": 3
   },
   {
    "visible": "Experimentos con el espejo",
    "consulta": "Experimentos con el espejo",
    "pasajes": 3
   },
   {
    "visible": "Diferentes clases de luz",
    "consulta": "Diferentes clases de luz",
    "pasajes": 2
   },
   {
    "visible": "De las diversas clases de luz",
    "consulta": "De las diversas clases de luz",
    "pasajes": 2
   },
   {
    "visible": "Observaciones generales",
    "consulta": "Observaciones generales",
    "pasajes": 2
   },
   {
    "visible": "La ley de la incidencia de la luz",
    "consulta": "La ley de la incidencia de la luz",
    "pasajes": 2
   },
   {
    "visible": "Sobre las gradaciones de fuerza en las sombras",
    "consulta": "SOBRE LAS GRADACIONES DE FUERZA EN LAS SOMBRAS",
    "pasajes": 2
   },
   {
    "visible": "Sobre la definición de sombra derivada",
    "consulta": "SOBRE LA DEFINICIÓN DE SOMBRA DERIVADA",
    "pasajes": 2
   },
   {
    "visible": "Diferentes clases de sombras derivadas",
    "consulta": "DIFERENTES CLASES DE SOMBRAS DERIVADAS",
    "pasajes": 2
   },
   {
    "visible": "Sombra producida por dos luces de diferente tamaño",
    "consulta": "Sombra producida por dos luces de diferente tamaño",
    "pasajes": 2
   },
   {
    "visible": "Sobre el tamaño relativo de las sombras proyectadas",
    "consulta": "Sobre el tamaño relativo de las sombras proyectadas",
    "pasajes": 2
   },
   {
    "visible": "Principios de reflexión",
    "consulta": "SOBRE Principios de reflexión",
    "pasajes": 2
   },
   {
    "visible": "Reflexión sobre el agua",
    "consulta": "Reflexión sobre el agua",
    "pasajes": 2
   },
   {
    "visible": "Apéndice:--Sobre las sombras en movimiento",
    "consulta": "Apéndice:--Sobre las sombras en movimiento",
    "pasajes": 2
   },
   {
    "visible": "El efecto de los rayos que pasan a través de agujeros",
    "consulta": "SOBRE El efecto de los rayos que pasan a través de agujeros",
    "pasajes": 2
   },
   {
    "visible": "Prolegómenos",
    "consulta": "Prolegómenos",
    "pasajes": 1
   },
   {
    "visible": "Esquema de los libros sobre luz y sombra",
    "consulta": "Esquema de los libros sobre luz y sombra",
    "pasajes": 1
   },
   {
    "visible": "Sobre la naturaleza de la luz",
    "consulta": "Sobre la naturaleza de la luz",
    "pasajes": 1
   },
   {
    "visible": "Las relaciones de los cuerpos luminosos con los iluminados",
    "consulta": "Las relaciones de los cuerpos luminosos con los iluminados",
    "pasajes": 1
   },
   {
    "visible": "Diferentes clases de sombras derivadas",
    "consulta": "Diferentes clases de sombras derivadas",
    "pasajes": 1
   },
   {
    "visible": "El efecto de la luz a diferentes distancias",
    "consulta": "El efecto de la luz a diferentes distancias",
    "pasajes": 1
   },
   {
    "visible": "Efectos en las sombras proyectadas por el tono del fondo",
    "consulta": "Efectos en las sombras proyectadas por el tono del fondo",
    "pasajes": 1
   },
   {
    "visible": "Una proposición disputada",
    "consulta": "Una proposición disputada",
    "pasajes": 1
   },
   {
    "visible": "Sobre reverberación",
    "consulta": "Sobre reverberación",
    "pasajes": 1
   },
   {
    "visible": "Sobre la gradación de las sombras",
    "consulta": "Sobre la gradación de las sombras",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Notas misceláneas",
  "glosa": "Listas de libros, cuentas, recordatorios y apuntes sueltos",
  "pasajes": 97,
  "temas": [
   {
    "visible": "Citas y notas sobre libros y autores",
    "consulta": "Citas y notas sobre libros y autores (1469—1508)",
    "pasajes": 28,
    "iman": true
   },
   {
    "visible": "Inventarios y cuentas",
    "consulta": "Inventarios y cuentas (1509-1545)",
    "pasajes": 18
   },
   {
    "visible": "Memoranda antes de 1500",
    "consulta": "Memoranda antes de 1500 (1379-1413)",
    "pasajes": 16
   },
   {
    "visible": "Memoranda después de 1500",
    "consulta": "Memoranda después de 1500 (1414-1434)",
    "pasajes": 15
   },
   {
    "visible": "El día 6 de octubre",
    "consulta": "El día 6 de octubre",
    "pasajes": 6
   },
   {
    "visible": "Hierro estañado, -hierro perforado",
    "consulta": "Hierro estañado, -hierro perforado",
    "pasajes": 4
   },
   {
    "visible": "Hierro estañado,—hierro perforado",
    "consulta": "Hierro estañado,—hierro perforado",
    "pasajes": 4
   },
   {
    "visible": "Memoranda sin fecha",
    "consulta": "Memoranda sin fecha (1435-1457)",
    "pasajes": 3
   },
   {
    "visible": "Notas sobre discípulos",
    "consulta": "Notas sobre discípulos (1458-1468.)",
    "pasajes": 1
   },
   {
    "visible": "Notas sobre los alumnos",
    "consulta": "Notas sobre los alumnos (1458-1468.)",
    "pasajes": 1
   },
   {
    "visible": "Benedetto, 24 grossoni",
    "consulta": "Benedetto, 24 grossoni",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Notas topográficas",
  "glosa": "Los lugares que recorrió: ríos, montañas, ciudades y viajes",
  "pasajes": 93,
  "temas": [
   {
    "visible": "Notas sobre lugares en Italia central, visitados en 1502",
    "consulta": "Notas sobre lugares en Italia central, visitados en 1502 (1034-1054)",
    "pasajes": 10
   },
   {
    "visible": "Francia",
    "consulta": "Francia",
    "pasajes": 8
   },
   {
    "visible": "Canales en relación con el Arno",
    "consulta": "Canales en relación con el Arno (1001-1008)",
    "pasajes": 6
   },
   {
    "visible": "Los Apeninos",
    "consulta": "Los Apeninos (1063-1068)",
    "pasajes": 6
   },
   {
    "visible": "El Nilo",
    "consulta": "El Nilo (1093-1098)",
    "pasajes": 6
   },
   {
    "visible": "Canales en el Milanesado",
    "consulta": "Canales en el Milanesado (1009-1013)",
    "pasajes": 5
   },
   {
    "visible": "Notas sobre el lago del norte de Italia",
    "consulta": "Notas sobre el lago del norte de Italia. (1029-1033)",
    "pasajes": 5
   },
   {
    "visible": "Los Alpes",
    "consulta": "Los Alpes (1057-1062)",
    "pasajes": 5
   },
   {
    "visible": "Notas sobre la Sforzesca cerca de Vigevano",
    "consulta": "Notas sobre la Sforzesca cerca de Vigevano (1024-1028)",
    "pasajes": 4
   },
   {
    "visible": "Los países del extremo occidental del Mediterráneo",
    "consulta": "Los países del extremo occidental del Mediterráneo",
    "pasajes": 4
   },
   {
    "visible": "El estrecho de Gibraltar",
    "consulta": "El estrecho de Gibraltar (1083-1085)",
    "pasajes": 3
   },
   {
    "visible": "El mar Caspio",
    "consulta": "El mar Caspio (1105. 1106)",
    "pasajes": 3
   },
   {
    "visible": "Cálculos y estudios preparatorios para canales",
    "consulta": "Cálculos y estudios preparatorios para canales (1014. 1015)",
    "pasajes": 2
   },
   {
    "visible": "El llenado de los fosos del Castillo de Milán",
    "consulta": "El llenado de los fosos del Castillo de Milán",
    "pasajes": 2
   },
   {
    "visible": "Observaciones sobre fenómenos naturales en y cerca de Milán",
    "consulta": "Observaciones sobre fenómenos naturales en y cerca de Milán (1021. 1022)",
    "pasajes": 2
   },
   {
    "visible": "Alessandria en Piamonte",
    "consulta": "Alessandria en Piamonte (1055. 1056)",
    "pasajes": 2
   },
   {
    "visible": "Sobre los alemanes",
    "consulta": "Sobre los alemanes (1080. 1081)",
    "pasajes": 2
   },
   {
    "visible": "El mar Rojo",
    "consulta": "El mar Rojo. (1091. 1092)",
    "pasajes": 2
   },
   {
    "visible": "Costumbres de Naciones Asiáticas",
    "consulta": "Costumbres de Naciones Asiáticas (1099. 1100)",
    "pasajes": 2
   },
   {
    "visible": "Canales en conexión con el Arno",
    "consulta": "Canales en conexión con el Arno (1001-1008)",
    "pasajes": 1
   },
   {
    "visible": "Notas sobre edificios en Milán",
    "consulta": "Notas sobre edificios en Milán (1016-1019)",
    "pasajes": 1
   },
   {
    "visible": "Para colocar la masa v r en el…",
    "consulta": "Para colocar la masa v r en el…",
    "pasajes": 1
   },
   {
    "visible": "Nota sobre Pavía",
    "consulta": "Nota sobre Pavía",
    "pasajes": 1
   },
   {
    "visible": "El Danubio",
    "consulta": "El Danubio",
    "pasajes": 1
   },
   {
    "visible": "El mar Levantino",
    "consulta": "El mar Levantino",
    "pasajes": 1
   },
   {
    "visible": "Rodas",
    "consulta": "Rodas (1101. 1102)",
    "pasajes": 1
   },
   {
    "visible": "Chipre",
    "consulta": "Chipre (1103. 1104)",
    "pasajes": 1
   },
   {
    "visible": "El mar de Azov",
    "consulta": "El mar de Azov",
    "pasajes": 1
   },
   {
    "visible": "Los Dardanelos",
    "consulta": "Los Dardanelos",
    "pasajes": 1
   },
   {
    "visible": "Constantinopla",
    "consulta": "Constantinopla",
    "pasajes": 1
   },
   {
    "visible": "El Éufrates",
    "consulta": "El Éufrates",
    "pasajes": 1
   },
   {
    "visible": "Asia Central",
    "consulta": "Asia Central",
    "pasajes": 1
   },
   {
    "visible": "Sobre los nativos de los países cálidos",
    "consulta": "Sobre los nativos de los países cálidos",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Botánica y paisaje para pintores",
  "glosa": "Cómo crecen las ramas y las hojas, y cómo pintar un paisaje",
  "pasajes": 89,
  "temas": [
   {
    "visible": "La inserción de las hojas",
    "consulta": "La inserción de las hojas",
    "pasajes": 8
   },
   {
    "visible": "Sobre el tratamiento de la luz para paisajes",
    "consulta": "Sobre el tratamiento de la luz para paisajes",
    "pasajes": 7
   },
   {
    "visible": "La ley de proporción en el crecimiento de las ramas",
    "consulta": "La ley de proporción en el crecimiento de las ramas",
    "pasajes": 6
   },
   {
    "visible": "La dirección del crecimiento",
    "consulta": "La dirección del crecimiento",
    "pasajes": 5
   },
   {
    "visible": "Las gradaciones de sombra y color en las hojas",
    "consulta": "Las gradaciones de sombra y color en las hojas",
    "pasajes": 5
   },
   {
    "visible": "Las proporciones de luz y sombra en los árboles",
    "consulta": "Las proporciones de luz y sombra en los árboles",
    "pasajes": 5
   },
   {
    "visible": "Los efectos de la luz matinal",
    "consulta": "Los efectos de la luz matinal",
    "pasajes": 5
   },
   {
    "visible": "Sobre el tratamiento de la luz para vistas de ciudades",
    "consulta": "Sobre el tratamiento de la luz para vistas de ciudades",
    "pasajes": 5
   },
   {
    "visible": "Las formas de los árboles",
    "consulta": "Las formas de los árboles",
    "pasajes": 4
   },
   {
    "visible": "Las proporciones de luz y sombra en una hoja",
    "consulta": "Las proporciones de luz y sombra en una hoja",
    "pasajes": 4
   },
   {
    "visible": "Luz y sombra en grupos de árboles",
    "consulta": "Luz y sombra en grupos de árboles",
    "pasajes": 4
   },
   {
    "visible": "El efecto del viento en los árboles",
    "consulta": "El efecto del viento en los árboles",
    "pasajes": 4
   },
   {
    "visible": "Luz y sombra en las nubes",
    "consulta": "Luz y sombra en las nubes",
    "pasajes": 4
   },
   {
    "visible": "El grosor relativo de las ramas respecto al tronco",
    "consulta": "El grosor relativo de las ramas respecto al tronco",
    "pasajes": 3
   },
   {
    "visible": "Luz sobre ramas y hojas",
    "consulta": "Luz sobre ramas y hojas",
    "pasajes": 3
   },
   {
    "visible": "De la transparencia de las hojas",
    "consulta": "De la transparencia de las hojas",
    "pasajes": 3
   },
   {
    "visible": "La distribución de luz y sombra con referencia a la posición del espectador",
    "consulta": "La distribución de luz y sombra con referencia a la posición del espectador",
    "pasajes": 3
   },
   {
    "visible": "La apariencia de los árboles en la distancia",
    "consulta": "La apariencia de los árboles en la distancia",
    "pasajes": 2
   },
   {
    "visible": "La sombra proyectada de los árboles",
    "consulta": "La sombra proyectada de los árboles",
    "pasajes": 2
   },
   {
    "visible": "Del arcoíris y la lluvia",
    "consulta": "Del arcoíris y la lluvia",
    "pasajes": 2
   },
   {
    "visible": "Clasificación de los árboles",
    "consulta": "DE LA Clasificación de los árboles",
    "pasajes": 1
   },
   {
    "visible": "Una clasificación de los árboles según sus colores",
    "consulta": "Una clasificación de los árboles según sus colores",
    "pasajes": 1
   },
   {
    "visible": "Los efectos de la luz del mediodía",
    "consulta": "Los efectos de la luz del mediodía",
    "pasajes": 1
   },
   {
    "visible": "Sobre las imágenes reflejadas en el agua",
    "consulta": "Sobre las imágenes reflejadas en el agua",
    "pasajes": 1
   },
   {
    "visible": "De las semillas de las flores",
    "consulta": "De las semillas de las flores",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Geografía física",
  "glosa": "El agua, las mareas, el diluvio y cómo se formó la tierra",
  "pasajes": 88,
  "temas": [
   {
    "visible": "Dudas sobre el diluvio",
    "consulta": "Dudas sobre el diluvio",
    "pasajes": 8
   },
   {
    "visible": "Libro 15 de las materias desgastadas por el agua",
    "consulta": "Libro 15 de las materias desgastadas por el agua",
    "pasajes": 7
   },
   {
    "visible": "Observaciones en apoyo de la hipótesis",
    "consulta": "Observaciones en apoyo de la hipótesis (963-969)",
    "pasajes": 7
   },
   {
    "visible": "El flujo y reflujo de la marea",
    "consulta": "El flujo y reflujo de la marea (955-960)",
    "pasajes": 6
   },
   {
    "visible": "Investigaciones adicionales",
    "consulta": "Investigaciones adicionales (989-991)",
    "pasajes": 6
   },
   {
    "visible": "La formación de las montañas",
    "consulta": "La formación de las montañas (979-983)",
    "pasajes": 5
   },
   {
    "visible": "De la superficie del agua en relación con el globo",
    "consulta": "De la superficie del agua en relación con el globo (933-936)",
    "pasajes": 4
   },
   {
    "visible": "La altura relativa de la superficie del mar respecto a la de la tierra",
    "consulta": "La altura relativa de la superficie del mar respecto a la de la tierra (942-945)",
    "pasajes": 4
   },
   {
    "visible": "Sobre el movimiento del aire",
    "consulta": "Sobre el movimiento del aire (996—999)",
    "pasajes": 4
   },
   {
    "visible": "Sobre las invasiones del mar en la tierra y viceversa",
    "consulta": "Sobre las invasiones del mar en la tierra y viceversa (952-954)",
    "pasajes": 3
   },
   {
    "visible": "Sobre las alteraciones, causadas en los cursos de los ríos por su confluencia",
    "consulta": "Sobre las alteraciones, causadas en los cursos de los ríos por su confluencia (972-974)",
    "pasajes": 3
   },
   {
    "visible": "Otros problemas",
    "consulta": "Otros problemas (992-994)",
    "pasajes": 3
   },
   {
    "visible": "Esquemas para la disposición de los materiales",
    "consulta": "Esquemas para la disposición de los materiales (919-928)",
    "pasajes": 2
   },
   {
    "visible": "Definiciones",
    "consulta": "Definiciones (931. 932)",
    "pasajes": 2
   },
   {
    "visible": "De la proporción de la masa de agua a la de la tierra",
    "consulta": "De la proporción de la masa de agua a la de la tierra (937. 938)",
    "pasajes": 2
   },
   {
    "visible": "La teoría de Platón",
    "consulta": "La teoría de Platón",
    "pasajes": 2
   },
   {
    "visible": "Refutación de la teoría de Plinio sobre la salinidad del mar",
    "consulta": "Refutación de la teoría de Plinio sobre la salinidad del mar (946. 947)",
    "pasajes": 2
   },
   {
    "visible": "Las características del agua de mar",
    "consulta": "Las características del agua de mar (948. 949)",
    "pasajes": 2
   },
   {
    "visible": "Sobre la formación de los golfos",
    "consulta": "Sobre la formación de los golfos (950. 951)",
    "pasajes": 2
   },
   {
    "visible": "El origen de la arena en los ríos",
    "consulta": "El origen de la arena en los ríos (977. 978)",
    "pasajes": 2
   },
   {
    "visible": "Introducción general",
    "consulta": "Introducción general",
    "pasajes": 1
   },
   {
    "visible": "La disposición del Libro I",
    "consulta": "La disposición del Libro I",
    "pasajes": 1
   },
   {
    "visible": "Teoría de la elevación del agua dentro de las montañas",
    "consulta": "Teoría de la elevación del agua dentro de las montañas",
    "pasajes": 1
   },
   {
    "visible": "Teoría de la circulación de las aguas",
    "consulta": "Teoría de la circulación de las aguas (961. 962)",
    "pasajes": 1
   },
   {
    "visible": "De los ríos",
    "consulta": "De los ríos",
    "pasajes": 1
   },
   {
    "visible": "La marea en los estuarios",
    "consulta": "La marea en los estuarios",
    "pasajes": 1
   },
   {
    "visible": "Remolinos",
    "consulta": "Remolinos",
    "pasajes": 1
   },
   {
    "visible": "Sobre las alteraciones en los canales de los ríos",
    "consulta": "Sobre las alteraciones en los canales de los ríos",
    "pasajes": 1
   },
   {
    "visible": "Sobre las montañas",
    "consulta": "Sobre las montañas",
    "pasajes": 1
   },
   {
    "visible": "Problemas geológicos",
    "consulta": "Problemas geológicos",
    "pasajes": 1
   },
   {
    "visible": "Constituyentes de la atmósfera",
    "consulta": "Constituyentes de la atmósfera",
    "pasajes": 1
   },
   {
    "visible": "El globo un organismo",
    "consulta": "El globo un organismo",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Proporciones y movimiento del cuerpo",
  "glosa": "Cuánto mide cada parte del cuerpo y cómo se mueve",
  "pasajes": 83,
  "temas": [
   {
    "visible": "Sobre el cuerpo humano en acción",
    "consulta": "Sobre el cuerpo humano en acción",
    "pasajes": 9
   },
   {
    "visible": "Proporciones del brazo",
    "consulta": "Proporciones del brazo",
    "pasajes": 7
   },
   {
    "visible": "El movimiento del torso",
    "consulta": "El movimiento del torso",
    "pasajes": 7
   },
   {
    "visible": "El movimiento de la figura humana",
    "consulta": "El movimiento de la figura humana",
    "pasajes": 7
   },
   {
    "visible": "Las proporciones varían a diferentes edades",
    "consulta": "Las proporciones varían a diferentes edades",
    "pasajes": 6
   },
   {
    "visible": "Proporciones de la cabeza y del rostro",
    "consulta": "Proporciones de la cabeza y del rostro",
    "pasajes": 5
   },
   {
    "visible": "El movimiento del brazo",
    "consulta": "El movimiento del brazo",
    "pasajes": 5
   },
   {
    "visible": "De caminar hacia arriba y hacia abajo",
    "consulta": "De caminar hacia arriba y hacia abajo",
    "pasajes": 5
   },
   {
    "visible": "Proporciones de la cabeza vista de frente",
    "consulta": "Proporciones de la cabeza vista de frente",
    "pasajes": 3
   },
   {
    "visible": "Proporciones relativas del pie y de la cara",
    "consulta": "Proporciones relativas del pie y de la cara",
    "pasajes": 3
   },
   {
    "visible": "Proporciones de la pierna",
    "consulta": "Proporciones de la pierna",
    "pasajes": 3
   },
   {
    "visible": "Las proporciones de toda la figura",
    "consulta": "Las proporciones de toda la figura",
    "pasajes": 3
   },
   {
    "visible": "Sobre los drapeados",
    "consulta": "Sobre los drapeados",
    "pasajes": 3
   },
   {
    "visible": "Observaciones preliminares",
    "consulta": "OBSERVACIONES PRELIMINARES",
    "pasajes": 2
   },
   {
    "visible": "Proporciones de la cabeza y la cara",
    "consulta": "Proporciones de la cabeza y la cara",
    "pasajes": 2
   },
   {
    "visible": "Proporciones del pie",
    "consulta": "Proporciones del pie",
    "pasajes": 2
   },
   {
    "visible": "Las proporciones relativas del torso y de la pierna",
    "consulta": "Las proporciones relativas del torso y de la pierna",
    "pasajes": 2
   },
   {
    "visible": "Proporciones relativas de la mano y del pie",
    "consulta": "Proporciones relativas de la mano y del pie",
    "pasajes": 1
   },
   {
    "visible": "Sobre el punto central de todo el cuerpo",
    "consulta": "Sobre el punto central de todo el cuerpo",
    "pasajes": 1
   },
   {
    "visible": "Las proporciones relativas del torso y de toda la figura",
    "consulta": "Las proporciones relativas del torso y de toda la figura",
    "pasajes": 1
   },
   {
    "visible": "Las proporciones relativas de la cabeza y del torso",
    "consulta": "Las proporciones relativas de la cabeza y del torso",
    "pasajes": 1
   },
   {
    "visible": "Las proporciones relativas del torso y del pie",
    "consulta": "Las proporciones relativas del torso y del pie",
    "pasajes": 1
   },
   {
    "visible": "El torso de frente y de espaldas",
    "consulta": "El torso de frente y de espaldas",
    "pasajes": 1
   },
   {
    "visible": "El esquema de proporciones de Vitruvio",
    "consulta": "El esquema de proporciones de Vitruvio",
    "pasajes": 1
   },
   {
    "visible": "El brazo y la cabeza",
    "consulta": "El brazo y la cabeza",
    "pasajes": 1
   },
   {
    "visible": "Sobre el cabello que cae en rizos",
    "consulta": "Sobre el cabello que cae en rizos",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Máximas, moral y polémicas",
  "glosa": "Lo que pensaba sobre la ciencia, la vida y sus adversarios",
  "pasajes": 75,
  "temas": [
   {
    "visible": "Moral",
    "consulta": "Moral",
    "pasajes": 14,
    "iman": true
   },
   {
    "visible": "Ciencia, sus principios y reglas",
    "consulta": "Ciencia, sus principios y reglas (1148—1161)",
    "pasajes": 10
   },
   {
    "visible": "Reglas de Vida",
    "consulta": "Reglas de Vida (1188-1202)",
    "pasajes": 7
   },
   {
    "visible": "Psicología",
    "consulta": "Psicología (1140-1147)",
    "pasajes": 6
   },
   {
    "visible": "Los poderes de la Naturaleza",
    "consulta": "Los poderes de la Naturaleza (1134-1139)",
    "pasajes": 5
   },
   {
    "visible": "Sobre los espíritus",
    "consulta": "Sobre los espíritus (1211—1213)",
    "pasajes": 5
   },
   {
    "visible": "Polémicas y especulación",
    "consulta": "Polémicas y especulación",
    "pasajes": 4
   },
   {
    "visible": "Sobre las riquezas",
    "consulta": "Sobre las riquezas (1183—1187)",
    "pasajes": 3
   },
   {
    "visible": "Reglas de vida",
    "consulta": "Reglas de vida (1188-1202)",
    "pasajes": 3
   },
   {
    "visible": "Reflexiones sobre la Naturaleza",
    "consulta": "Reflexiones sobre la Naturaleza (1217-1219)",
    "pasajes": 3
   },
   {
    "visible": "Oraciones a Dios",
    "consulta": "Oraciones a Dios (1132. 1133)",
    "pasajes": 2
   },
   {
    "visible": "¿Qué es la vida?",
    "consulta": "¿Qué es la vida? (1162. 1163)",
    "pasajes": 2
   },
   {
    "visible": "Sobre la necedad y la ignorancia",
    "consulta": "Sobre la necedad y la ignorancia (1180—1182)",
    "pasajes": 2
   },
   {
    "visible": "Política",
    "consulta": "Política (1203. 1204)",
    "pasajes": 2
   },
   {
    "visible": "Contra los especuladores",
    "consulta": "Contra los especuladores (1205. 1206)",
    "pasajes": 2
   },
   {
    "visible": "Contra los alquimistas",
    "consulta": "Contra los alquimistas (1207. 1208)",
    "pasajes": 2
   },
   {
    "visible": "Muerte",
    "consulta": "Muerte",
    "pasajes": 1
   },
   {
    "visible": "Contra los escritores de epítomes",
    "consulta": "Contra los escritores de epítomes",
    "pasajes": 1
   },
   {
    "visible": "La nada",
    "consulta": "La nada",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Perspectiva lineal",
  "glosa": "Por qué las cosas se ven más chicas de lejos, con geometría",
  "pasajes": 69,
  "temas": [
   {
    "visible": "El tamaño aparente de los objetos definido por cálculo",
    "consulta": "El tamaño aparente de los objetos definido por cálculo",
    "pasajes": 8
   },
   {
    "visible": "La intersección de los rayos",
    "consulta": "La intersección de los rayos",
    "pasajes": 6
   },
   {
    "visible": "El tamaño relativo de los objetos con respecto a su distancia del ojo",
    "consulta": "El tamaño relativo de los objetos con respecto a su distancia del ojo",
    "pasajes": 6
   },
   {
    "visible": "Los elementos de la perspectiva:—del punto",
    "consulta": "Los elementos de la perspectiva:—del punto",
    "pasajes": 4
   },
   {
    "visible": "La producción de la pirámide de la visión",
    "consulta": "La producción de la pirámide de la visión",
    "pasajes": 4
   },
   {
    "visible": "Prueba experimental de la existencia de la pirámide de la vista",
    "consulta": "Prueba experimental de la existencia de la pirámide de la vista",
    "pasajes": 3
   },
   {
    "visible": "La producción de la pirámide de visión",
    "consulta": "La producción de la pirámide de visión",
    "pasajes": 3
   },
   {
    "visible": "Prueba por experimento",
    "consulta": "Prueba por experimento",
    "pasajes": 3
   },
   {
    "visible": "Demostración de la perspectiva mediante un plano de vidrio vertical",
    "consulta": "Demostración de la perspectiva mediante un plano de vidrio vertical",
    "pasajes": 3
   },
   {
    "visible": "Sobre la perspectiva natural",
    "consulta": "Sobre la perspectiva natural",
    "pasajes": 3
   },
   {
    "visible": "De la línea",
    "consulta": "De la línea",
    "pasajes": 2
   },
   {
    "visible": "Las relaciones del punto de distancia con el punto de fuga",
    "consulta": "Las relaciones del punto de distancia con el punto de fuga",
    "pasajes": 2
   },
   {
    "visible": "La función del ojo, explicada por la cámara oscura",
    "consulta": "La función del ojo, explicada por la cámara oscura",
    "pasajes": 2
   },
   {
    "visible": "La práctica de la perspectiva",
    "consulta": "La práctica de la perspectiva",
    "pasajes": 2
   },
   {
    "visible": "Refracción de los rayos que caen sobre el ojo",
    "consulta": "Refracción de los rayos que caen sobre el ojo",
    "pasajes": 2
   },
   {
    "visible": "El ángulo de la visión varía con la distancia",
    "consulta": "El ángulo de la visión varía con la distancia",
    "pasajes": 2
   },
   {
    "visible": "La distancia adecuada de los objetos al ojo",
    "consulta": "La distancia adecuada de los objetos al ojo",
    "pasajes": 2
   },
   {
    "visible": "Observaciones generales sobre la perspectiva",
    "consulta": "Observaciones generales sobre la perspectiva",
    "pasajes": 1
   },
   {
    "visible": "La naturaleza del contorno",
    "consulta": "La naturaleza del contorno",
    "pasajes": 1
   },
   {
    "visible": "Definición de la perspectiva",
    "consulta": "Definición de la perspectiva",
    "pasajes": 1
   },
   {
    "visible": "La percepción del objeto depende de la dirección del ojo",
    "consulta": "La percepción del objeto depende de la dirección del ojo",
    "pasajes": 1
   },
   {
    "visible": "Cómo medir la pirámide de visión",
    "consulta": "Cómo medir la pirámide de visión",
    "pasajes": 1
   },
   {
    "visible": "Conclusiones generales",
    "consulta": "Conclusiones generales",
    "pasajes": 1
   },
   {
    "visible": "Que lo contrario es imposible",
    "consulta": "Que lo contrario es imposible",
    "pasajes": 1
   },
   {
    "visible": "Un caso paralelo",
    "consulta": "Un caso paralelo",
    "pasajes": 1
   },
   {
    "visible": "La inversión de las imágenes",
    "consulta": "La inversión de las imágenes",
    "pasajes": 1
   },
   {
    "visible": "El ángulo de visión varía con la distancia",
    "consulta": "El ángulo de visión varía con la distancia",
    "pasajes": 1
   },
   {
    "visible": "Pirámides opuestas en yuxtaposición",
    "consulta": "Pirámides opuestas en yuxtaposición",
    "pasajes": 1
   },
   {
    "visible": "Sobre la perspectiva simple y compleja",
    "consulta": "Sobre la perspectiva simple y compleja",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Astronomía",
  "glosa": "La luna, el sol y la Tierra vista como un planeta más",
  "pasajes": 61,
  "temas": [
   {
    "visible": "Sobre la luminosidad de la luna",
    "consulta": "Sobre la luminosidad de la luna (892-901)",
    "pasajes": 12
   },
   {
    "visible": "La Tierra como planeta",
    "consulta": "La Tierra como planeta",
    "pasajes": 6
   },
   {
    "visible": "Sobre la luminosidad de la Tierra en el espacio universal",
    "consulta": "Sobre la luminosidad de la Tierra en el espacio universal (874-878)",
    "pasajes": 5
   },
   {
    "visible": "Las leyes fundamentales del sistema solar",
    "consulta": "Las leyes fundamentales del sistema solar (859-864)",
    "pasajes": 4
   },
   {
    "visible": "Marcelo y muchos otros alaban el sol",
    "consulta": "Marcelo y muchos otros alaban el sol",
    "pasajes": 4
   },
   {
    "visible": "Consideraciones sobre el tamaño del sol",
    "consulta": "Consideraciones sobre el tamaño del sol (886-891)",
    "pasajes": 4
   },
   {
    "visible": "Explicación del lumen cinereum en la luna",
    "consulta": "Explicación del lumen cinereum en la luna",
    "pasajes": 4
   },
   {
    "visible": "Sobre las manchas en la luna",
    "consulta": "Sobre las manchas en la luna (903-907)",
    "pasajes": 4
   },
   {
    "visible": "Sobre instrumentos para observar la luna",
    "consulta": "Sobre instrumentos para observar la luna (909. 910)",
    "pasajes": 3
   },
   {
    "visible": "El lugar de la tierra en el universo",
    "consulta": "El lugar de la tierra en el universo (857. 858)",
    "pasajes": 2
   },
   {
    "visible": "¿Y las rocas con sus diversos estratos?",
    "consulta": "¿Y las rocas con sus diversos estratos?",
    "pasajes": 2
   },
   {
    "visible": "Cómo probar que la tierra es un planeta",
    "consulta": "Cómo probar que la tierra es un planeta (865-867)",
    "pasajes": 2
   },
   {
    "visible": "La cuestión del tamaño verdadero y aparente del sol",
    "consulta": "La cuestión del tamaño verdadero y aparente del sol (879-884)",
    "pasajes": 2
   },
   {
    "visible": "Del tiempo y sus divisiones",
    "consulta": "Del tiempo y sus divisiones (916-918)",
    "pasajes": 2
   },
   {
    "visible": "De la naturaleza de la luz del sol",
    "consulta": "De la naturaleza de la luz del sol",
    "pasajes": 1
   },
   {
    "visible": "Sobre las manchas de la luna",
    "consulta": "Sobre las manchas de la luna (903-907)",
    "pasajes": 1
   },
   {
    "visible": "Sobre el halo de la luna",
    "consulta": "Sobre el halo de la luna",
    "pasajes": 1
   },
   {
    "visible": "Observaciones sobre las estrellas",
    "consulta": "Observaciones sobre las estrellas",
    "pasajes": 1
   },
   {
    "visible": "Sobre historia de la astronomía",
    "consulta": "Sobre historia de la astronomía",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Anatomía, zoología y fisiología",
  "glosa": "Huesos, músculos, órganos y cómo funciona el cuerpo",
  "pasajes": 57,
  "temas": [
   {
    "visible": "Planes y sugerencias para la disposición de los materiales",
    "consulta": "Planes y sugerencias para la disposición de los materiales (797-802)",
    "pasajes": 6
   },
   {
    "visible": "Planes para la representación de los músculos por dibujos",
    "consulta": "Planes para la representación de los músculos por dibujos (803-809)",
    "pasajes": 6
   },
   {
    "visible": "Estudio comparativo de la estructura de los huesos y de la acción de los músculos",
    "consulta": "Estudio comparativo de la estructura de los huesos y de la acción de los músculos (822-826)",
    "pasajes": 5
   },
   {
    "visible": "Las leyes de la nutrición y el sostén de la vida",
    "consulta": "Las leyes de la nutrición y el sostén de la vida (843-848)",
    "pasajes": 5
   },
   {
    "visible": "Fisiología",
    "consulta": "Fisiología",
    "pasajes": 4,
    "iman": true
   },
   {
    "visible": "Ventajas en la estructura del ojo en ciertos animales",
    "consulta": "Ventajas en la estructura del ojo en ciertos animales (828-831)",
    "pasajes": 4
   },
   {
    "visible": "Algunas notas sobre medicina",
    "consulta": "Algunas notas sobre medicina (851-855)",
    "pasajes": 4
   },
   {
    "visible": "Sobre la corpulencia y la delgadez",
    "consulta": "Sobre la corpulencia y la delgadez (809-811)",
    "pasajes": 3
   },
   {
    "visible": "Observaciones fisiológicas misceláneas",
    "consulta": "Observaciones fisiológicas misceláneas (840-842)",
    "pasajes": 3
   },
   {
    "visible": "Sobre la circulación de la sangre",
    "consulta": "Sobre la circulación de la sangre (848-850)",
    "pasajes": 3
   },
   {
    "visible": "Problemas fisiológicos",
    "consulta": "Problemas fisiológicos (814. 815)",
    "pasajes": 2
   },
   {
    "visible": "Las divisiones del reino animal",
    "consulta": "Las divisiones del reino animal (816. 817)",
    "pasajes": 2
   },
   {
    "visible": "Notas misceláneas sobre el estudio de la Zoología",
    "consulta": "Notas misceláneas sobre el estudio de la Zoología (818-821)",
    "pasajes": 2
   },
   {
    "visible": "Sobre las condiciones de la vista",
    "consulta": "Sobre las condiciones de la vista (834. 835)",
    "pasajes": 2
   },
   {
    "visible": "Sobre el origen del alma",
    "consulta": "Sobre el origen del alma",
    "pasajes": 2
   },
   {
    "visible": "Anatomía",
    "consulta": "Anatomía",
    "pasajes": 1
   },
   {
    "visible": "Las divisiones de la cabeza",
    "consulta": "Las divisiones de la cabeza (812. 813)",
    "pasajes": 1
   },
   {
    "visible": "La sede del sentido común",
    "consulta": "La sede del sentido común",
    "pasajes": 1
   },
   {
    "visible": "Sobre la acción muscular involuntaria",
    "consulta": "Sobre la acción muscular involuntaria",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Cartas y apuntes personales",
  "glosa": "Cartas a sus mecenas, fechas y registros de su propia vida",
  "pasajes": 43,
  "temas": [
   {
    "visible": "Borrador de carta al Gobernador de Milán",
    "consulta": "Borrador de carta al Gobernador de Milán",
    "pasajes": 9
   },
   {
    "visible": "Borradores de cartas e informes referentes a Armenia",
    "consulta": "Borradores de cartas e informes referentes a Armenia (1336. 1337)",
    "pasajes": 6
   },
   {
    "visible": "Borradores diversos de cartas y registros personales",
    "consulta": "Borradores diversos de cartas y registros personales (1356—1368)",
    "pasajes": 6
   },
   {
    "visible": "Borradores de cartas a Lodovico il Moro",
    "consulta": "Borradores de cartas a Lodovico il Moro (1340-1345)",
    "pasajes": 5
   },
   {
    "visible": "Notas con fechas",
    "consulta": "Notas con fechas (1369—1378)",
    "pasajes": 4
   },
   {
    "visible": "Borrador de carta para enviar a Piacenza",
    "consulta": "Borrador de carta para enviar a Piacenza (1346. 1347)",
    "pasajes": 3
   },
   {
    "visible": "Notas sobre eventos observados en el extranjero",
    "consulta": "Notas sobre eventos observados en el extranjero (1338-1339)",
    "pasajes": 2
   },
   {
    "visible": "Registros varios (1354. 1355)-",
    "consulta": "Registros varios (1354. 1355)-",
    "pasajes": 2
   },
   {
    "visible": "Borradores varios de cartas y registros personales",
    "consulta": "Borradores varios de cartas y registros personales (1356—1368)",
    "pasajes": 2
   },
   {
    "visible": "Borradores de Cartas a Lodovico il Moro",
    "consulta": "Borradores de Cartas a Lodovico il Moro (1340-1345)",
    "pasajes": 1
   },
   {
    "visible": "Borrador de carta para ser enviada a Piacenza",
    "consulta": "Borrador de carta para ser enviada a Piacenza (1346. 1347)",
    "pasajes": 1
   },
   {
    "visible": "Carta al Cardenal Ippolito d'Este",
    "consulta": "Carta al Cardenal Ippolito d'Este",
    "pasajes": 1
   },
   {
    "visible": "Borrador de carta escrita en Roma",
    "consulta": "Borrador de carta escrita en Roma",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Perspectiva de la desaparición",
  "glosa": "Por qué lo lejano se ve borroso y pierde el color",
  "pasajes": 40,
  "temas": [
   {
    "visible": "Cómo se pierde nitidez con la distancia",
    "consulta": "Proposiciones sobre Prospettiva de' perdimenti del MS. C",
    "pasajes": 13
   },
   {
    "visible": "El efecto de fondos claros u oscuros sobre el tamaño aparente de los objetos",
    "consulta": "El efecto de fondos claros u oscuros sobre el tamaño aparente de los objetos",
    "pasajes": 9
   },
   {
    "visible": "El papel de la luz y la sombra en lo que se ve de lejos",
    "consulta": "La importancia de la luz y la sombra en la Prospettiva de' perdimenti",
    "pasajes": 5
   },
   {
    "visible": "Sobre la indistinción a distancias cortas",
    "consulta": "Sobre la indistinción a distancias cortas",
    "pasajes": 4
   },
   {
    "visible": "Sobre la indistinción a grandes distancias",
    "consulta": "Sobre la indistinción a grandes distancias",
    "pasajes": 3
   },
   {
    "visible": "Qué es la perspectiva de la desaparición",
    "consulta": "PERSPECTIVA DE DESAPARICIÓN Definición",
    "pasajes": 1
   },
   {
    "visible": "Qué es la perspectiva de la desaparición",
    "consulta": "PERSPPECTIVA DE LA DESAPARICIÓN Definición",
    "pasajes": 1
   },
   {
    "visible": "Una ilustración por experimento",
    "consulta": "Una ilustración por experimento",
    "pasajes": 1
   },
   {
    "visible": "Una regla guía",
    "consulta": "Una regla guía",
    "pasajes": 1
   },
   {
    "visible": "Un experimento",
    "consulta": "Un experimento",
    "pasajes": 1
   },
   {
    "visible": "El efecto de los fondos claros u oscuros sobre el tamaño aparente de los objetos",
    "consulta": "El efecto de los fondos claros u oscuros sobre el tamaño aparente de los objetos",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Prolegómenos al libro de pintura",
  "glosa": "Cómo pensaba ordenar su tratado, y qué significa ver",
  "pasajes": 39,
  "temas": [
   {
    "visible": "El tamaño comparativo de la imagen depende de la cantidad de luz",
    "consulta": "El tamaño comparativo de la imagen depende de la cantidad de luz",
    "pasajes": 10
   },
   {
    "visible": "Sugerencias para la disposición de manuscritos que tratan de asuntos particulares",
    "consulta": "Sugerencias para la disposición de manuscritos que tratan de asuntos particulares",
    "pasajes": 4
   },
   {
    "visible": "Introducciones generales al libro sobre pintura",
    "consulta": "Introducciones generales al libro sobre pintura",
    "pasajes": 4
   },
   {
    "visible": "El plan del libro de pintura",
    "consulta": "El plan del libro de pintura",
    "pasajes": 4
   },
   {
    "visible": "Diferencias de percepción por un ojo y por ambos ojos",
    "consulta": "Diferencias de percepción por un ojo y por ambos ojos",
    "pasajes": 4
   },
   {
    "visible": "La función del ojo",
    "consulta": "La función del ojo",
    "pasajes": 3
   },
   {
    "visible": "Necesidad del conocimiento teórico",
    "consulta": "Necesidad del conocimiento teórico",
    "pasajes": 2
   },
   {
    "visible": "La intención del autor de publicar sus manuscritos",
    "consulta": "La intención del autor de publicar sus manuscritos",
    "pasajes": 1
   },
   {
    "visible": "La preparación de los manuscritos para la publicación",
    "consulta": "La preparación de los manuscritos para la publicación",
    "pasajes": 1
   },
   {
    "visible": "Advertencia a los lectores",
    "consulta": "Advertencia a los lectores",
    "pasajes": 1
   },
   {
    "visible": "El desorden en los manuscritos",
    "consulta": "El desorden en los manuscritos",
    "pasajes": 1
   },
   {
    "visible": "Introducciones generales al libro de pintura",
    "consulta": "Introducciones generales al libro de pintura",
    "pasajes": 1
   },
   {
    "visible": "El uso del libro de pintura",
    "consulta": "El uso del libro de pintura",
    "pasajes": 1
   },
   {
    "visible": "Variabilidad del ojo",
    "consulta": "Variabilidad del ojo",
    "pasajes": 1
   },
   {
    "visible": "Foco de la vista",
    "consulta": "Foco de la vista",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Notas sobre escultura",
  "glosa": "Fundir bronce y los dos monumentos a caballo que proyectó",
  "pasajes": 31,
  "temas": [
   {
    "visible": "Sobre la fundición de bronce en general",
    "consulta": "Sobre la fundición de bronce en general (731-740)",
    "pasajes": 10
   },
   {
    "visible": "El proyecto del monumento Trivulzio",
    "consulta": "El proyecto del monumento Trivulzio",
    "pasajes": 8
   },
   {
    "visible": "Referencias ocasionales al monumento Sforza",
    "consulta": "Referencias ocasionales al monumento Sforza (719-724)",
    "pasajes": 5
   },
   {
    "visible": "Notas sobre el vaciado del monumento Sforza",
    "consulta": "Notas sobre el vaciado del monumento Sforza (710-715)",
    "pasajes": 4
   },
   {
    "visible": "Las notas sobre escultura",
    "consulta": "Las notas sobre escultura",
    "pasajes": 2
   },
   {
    "visible": "Grado—punto—minuto—mínimo",
    "consulta": "Grado—punto—minuto—mínimo",
    "pasajes": 1
   },
   {
    "visible": "El gran genet de Messer Galeazzo",
    "consulta": "El gran genet de Messer Galeazzo",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Escritos de arquitectura",
  "glosa": "Arcos, vigas, cimientos y por qué se rajan los muros",
  "pasajes": 30,
  "temas": [
   {
    "visible": "Sobre la naturaleza del arco",
    "consulta": "Sobre la naturaleza del arco",
    "pasajes": 14
   },
   {
    "visible": "Sobre las grietas en los muros",
    "consulta": "Sobre las grietas en los muros",
    "pasajes": 7
   },
   {
    "visible": "Sobre los cimientos, la naturaleza del terreno y los soportes",
    "consulta": "Sobre los cimientos, la naturaleza del terreno y los soportes",
    "pasajes": 4
   },
   {
    "visible": "Sobre la resistencia de las vigas",
    "consulta": "Sobre la resistencia de las vigas",
    "pasajes": 3
   },
   {
    "visible": "Sobre las grietas en los nichos",
    "consulta": "Sobre las grietas en los nichos",
    "pasajes": 2
   }
  ]
 },
 {
  "seccion": "Estudios y bocetos para cuadros",
  "glosa": "Notas para la Última Cena, la batalla de Anghiari y alegorías",
  "pasajes": 28,
  "temas": [
   {
    "visible": "Motes y Emblemas",
    "consulta": "Motes y Emblemas",
    "pasajes": 7
   },
   {
    "visible": "Representaciones alegóricas",
    "consulta": "Representaciones alegóricas",
    "pasajes": 5
   },
   {
    "visible": "Notas sobre la Última Cena",
    "consulta": "Notas sobre la Última Cena",
    "pasajes": 3
   },
   {
    "visible": "Representaciones alegóricas referentes al duque de Milán",
    "consulta": "Representaciones alegóricas referentes al duque de Milán",
    "pasajes": 3
   },
   {
    "visible": "Sobre la batalla de Anghiari",
    "consulta": "Sobre la batalla de Anghiari",
    "pasajes": 2
   },
   {
    "visible": "Lemas y Emblemas",
    "consulta": "Lemas y Emblemas",
    "pasajes": 2
   },
   {
    "visible": "Ornamentos y Decoraciones para fiestas",
    "consulta": "Ornamentos y Decoraciones para fiestas (703-705)",
    "pasajes": 2
   },
   {
    "visible": "Sobre cuadros de la Madonna",
    "consulta": "Sobre cuadros de la Madonna",
    "pasajes": 1
   },
   {
    "visible": "Retrato de Bernardo di Bandino",
    "consulta": "Retrato de Bernardo di Bandino",
    "pasajes": 1
   },
   {
    "visible": "Disposición de un cuadro",
    "consulta": "Disposición de un cuadro",
    "pasajes": 1
   },
   {
    "visible": "Lista de dibujos",
    "consulta": "Lista de dibujos",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Diseños arquitectónicos",
  "glosa": "Plantas de templos, escaleras, caballerizas y decorados de fiesta",
  "pasajes": 26,
  "temas": [
   {
    "visible": "Diseños arquitectónicos",
    "consulta": "Diseños arquitectónicos",
    "pasajes": 11
   },
   {
    "visible": "Observaciones generales de arquitectura",
    "consulta": "A. Observaciones Generales._",
    "pasajes": 6
   },
   {
    "visible": "Decoraciones para fiestas",
    "consulta": "Decoraciones para fiestas",
    "pasajes": 6
   },
   {
    "visible": "Descripción de un templo sin identificar",
    "consulta": "G. Descripción de un templo desconocido",
    "pasajes": 2
   },
   {
    "visible": "Sobre las disposiciones de una caballeriza",
    "consulta": "Sobre las disposiciones de una caballeriza",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Teoría de los colores",
  "glosa": "Cómo se afectan los colores entre sí y qué les pasa en la sombra",
  "pasajes": 25,
  "temas": [
   {
    "visible": "Los efectos recíprocos de los colores sobre objetos colocados uno frente a otro",
    "consulta": "TEORÍA DE LOS COLORES Los efectos recíprocos de los colores sobre objetos colocados uno frente a otro",
    "pasajes": 7
   },
   {
    "visible": "Sobre la reflexión de los colores",
    "consulta": "Sobre la reflexión de los colores",
    "pasajes": 3
   },
   {
    "visible": "Los efectos recíprocos de los colores en objetos colocados opuestos entre sí",
    "consulta": "TEORÍA DE LOS COLORES Los efectos recíprocos de los colores en objetos colocados opuestos entre sí",
    "pasajes": 2
   },
   {
    "visible": "El efecto de los colores en la cámara oscura",
    "consulta": "El efecto de los colores en la cámara oscura",
    "pasajes": 2
   },
   {
    "visible": "Sobre los colores de las sombras derivadas",
    "consulta": "Sobre los colores de las sombras derivadas",
    "pasajes": 2
   },
   {
    "visible": "Sobre las gradaciones en la profundidad de los colores",
    "consulta": "Sobre las gradaciones en la profundidad de los colores",
    "pasajes": 2
   },
   {
    "visible": "Sobre el uso de colores oscuros y claros en la pintura",
    "consulta": "Sobre el uso de colores oscuros y claros en la pintura",
    "pasajes": 2
   },
   {
    "visible": "Sobre los colores del arcoíris",
    "consulta": "Sobre los colores del arcoíris",
    "pasajes": 2
   },
   {
    "visible": "Combinación de diferentes colores en sombras proyectadas",
    "consulta": "Combinación de diferentes colores en sombras proyectadas",
    "pasajes": 1
   },
   {
    "visible": "Sobre la naturaleza de los colores",
    "consulta": "Sobre la naturaleza de los colores",
    "pasajes": 1
   },
   {
    "visible": "Sobre el uso de los colores oscuros y claros en la pintura",
    "consulta": "Sobre el uso de los colores oscuros y claros en la pintura",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Perspectiva del color",
  "glosa": "Por qué lo lejano se ve azul: el color del aire",
  "pasajes": 20,
  "temas": [
   {
    "visible": "Sobre el color de la atmósfera",
    "consulta": "Sobre el color de la atmósfera",
    "pasajes": 9
   },
   {
    "visible": "Reglas generales de la perspectiva del color",
    "consulta": "PERSPECTIVA DE Reglas generales",
    "pasajes": 3
   },
   {
    "visible": "Las reglas de la perspectiva aérea",
    "consulta": "Las reglas de la perspectiva aérea",
    "pasajes": 3
   },
   {
    "visible": "Sobre la densidad relativa de la atmósfera",
    "consulta": "Sobre la densidad relativa de la atmósfera",
    "pasajes": 2
   },
   {
    "visible": "Un caso excepcional",
    "consulta": "Un caso excepcional",
    "pasajes": 1
   },
   {
    "visible": "Un experimento",
    "consulta": "Un experimento",
    "pasajes": 1
   },
   {
    "visible": "Cómo se aplica la perspectiva del color",
    "consulta": "La práctica de la Prospettiva de' colori",
    "pasajes": 1
   }
  ]
 },
 {
  "seccion": "Guerra naval, máquinas y música",
  "glosa": "Máquinas de volar, respirar bajo el agua e instrumentos",
  "pasajes": 17,
  "temas": [
   {
    "visible": "Sobre máquinas voladoras",
    "consulta": "Sobre máquinas voladoras (1122-1126)",
    "pasajes": 5
   },
   {
    "visible": "De la música",
    "consulta": "De la música (1129. 1130)",
    "pasajes": 3
   },
   {
    "visible": "Sobre la guerra naval",
    "consulta": "Sobre la guerra naval (1115. 1116)",
    "pasajes": 2
   },
   {
    "visible": "Sus cuadernos y los de Vitruvio y Alberti",
    "consulta": "Los cuadernos de bitácora de Vitruvio, de Alberti y de Leonardo",
    "pasajes": 1
   },
   {
    "visible": "Métodos de permanecer y moverse en el agua",
    "consulta": "Métodos de permanecer y moverse en el agua",
    "pasajes": 1
   },
   {
    "visible": "El uso de cinturones de natación",
    "consulta": "El uso de cinturones de natación",
    "pasajes": 1
   },
   {
    "visible": "Sobre la gravedad del agua",
    "consulta": "Sobre la gravedad del agua",
    "pasajes": 1
   },
   {
    "visible": "Aparato de buceo y patinaje",
    "consulta": "Aparato de buceo y patinaje (1119-1121)",
    "pasajes": 1
   },
   {
    "visible": "De la minería",
    "consulta": "De la minería",
    "pasajes": 1
   },
   {
    "visible": "Del fuego griego",
    "consulta": "Del fuego griego",
    "pasajes": 1
   }
  ]
 }
];
