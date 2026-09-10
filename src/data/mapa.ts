/**
 * GENERADO por `npm run mapa` desde `artifacts/chunks.json` y
 * `artifacts/chunks_es.json`. NO EDITAR A MANO: los nombres de sección, sus
 * descripciones y los rótulos rescritos viven en `tools/mapa_temas.ts`.
 *
 * ⚠ `visible` es lo que se muestra; `consulta` es lo que se manda al buscar, y
 * es el título ORIGINAL de Richter **en el idioma de su índice**. Dos reglas que
 * cuestan caro si se rompen:
 *   · `alcance.json` midió 345/375 con los títulos originales: mandar otro
 *     texto invalida esa medición;
 *   · el mapa castellano NO se puede usar en inglés ni al revés — sería la
 *     búsqueda cross-lingüe que D-105 midió como mala.
 */

export interface TemaDelMapa {
  /** El rótulo limpio, para leer. */
  visible: string;
  /** El título original: lo que viaja al buscador. */
  consulta: string;
  pasajes: number;
  /** Aparece como «lo más cercano» a casi cualquier cosa: no se destaca. */
  iman?: boolean;
  /**
   * Términos sacados de los propios pasajes del tema, para los pocos cuyo
   * título no alcanza a encontrarse a sí mismo (D-261). **No se muestra
   * nunca**: viaja pegado a la consulta y el visitante ve sólo `visible`.
   */
  refuerzo?: string;
}

/**
 * ⚠ LO QUE SE MANDA A BUSCAR. Una sola definición, porque la usan el rail, el
 * precalculado del mapa y el medidor de abstenciones: si cada uno armara la
 * consulta por su lado, congelaríamos una respuesta bajo una clave que el clic
 * no vuelve a producir — que es exactamente el agujero que D-112 cerró.
 */
export const consultaDe = (t: TemaDelMapa): string =>
  t.refuerzo ? `${t.consulta}: ${t.refuerzo}` : t.consulta;

export interface SeccionDelMapa {
  seccion: string;
  /** Qué hay adentro, en una línea. */
  glosa: string;
  pasajes: number;
  temas: TemaDelMapa[];
}

export const MAPA: Record<"es" | "en", SeccionDelMapa[]> =
{
 "es": [
  {
   "seccion": "La práctica de la pintura",
   "glosa": "Cómo preparaba los colores, dónde ponía la luz y cómo pintaba gestos y telas",
   "pasajes": 182,
   "temas": [
    {
     "visible": "Sobre materiales químicos",
     "consulta": "Sobre materiales químicos",
     "pasajes": 11
    },
    {
     "visible": "Sobre varias ayudas para preparar un cuadro",
     "consulta": "Sobre varias ayudas para preparar un cuadro",
     "pasajes": 10
    },
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
     "visible": "La posición correcta del artista, al pintar y del espectador",
     "consulta": "La posición correcta del artista, al pintar y del espectador",
     "pasajes": 8,
     "iman": true
    },
    {
     "visible": "De los gestos apropiados",
     "consulta": "De los gestos apropiados",
     "pasajes": 8
    },
    {
     "visible": "De la representación del diluvio",
     "consulta": "De la representación del diluvio",
     "pasajes": 8
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
     "visible": "Del yeso y del papel",
     "consulta": "Del yeso y del papel",
     "pasajes": 6
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
     "visible": "Sobre la capacidad productiva de los artistas menores",
     "consulta": "Sobre la capacidad productiva de los artistas menores",
     "pasajes": 4
    },
    {
     "visible": "Cómo adquirir universalidad",
     "consulta": "Cómo adquirir universalidad",
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
     "visible": "La distribución del tiempo para el estudio",
     "consulta": "La distribución del tiempo para el estudio",
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
     "visible": "Juegos y ejercicios útiles",
     "consulta": "Juegos y ejercicios útiles",
     "pasajes": 2
    },
    {
     "visible": "Sobre el manejo de las obras",
     "consulta": "Sobre el manejo de las obras",
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
     "visible": "Bosquejar figuras y retratos",
     "consulta": "DE Bosquejar figuras y retratos",
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
     "visible": "Sobre la naturaleza de la luz",
     "consulta": "SOBRE Sobre la naturaleza de la luz",
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
     "visible": "Sobre la intensidad de las sombras según la distancia de la luz",
     "consulta": "SOBRE LA INTENSIDAD DE LAS SOMBRAS SEGÚN LA DISTANCIA DE LA LUZ",
     "pasajes": 3
    },
    {
     "visible": "Diferentes clases de sombras derivadas",
     "consulta": "DIFERENTES CLASES DE SOMBRAS DERIVADAS",
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
     "visible": "Las relaciones de los cuerpos luminosos con los iluminados",
     "consulta": "Las relaciones de los cuerpos luminosos con los iluminados",
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
     "visible": "Hierro estañado, -hierro perforado",
     "consulta": "Hierro estañado, -hierro perforado",
     "pasajes": 8
    },
    {
     "visible": "El día 6 de octubre",
     "consulta": "El día 6 de octubre",
     "pasajes": 6
    },
    {
     "visible": "Memoranda sin fecha",
     "consulta": "Memoranda sin fecha (1435-1457)",
     "pasajes": 3
    },
    {
     "visible": "Notas sobre discípulos",
     "consulta": "Notas sobre discípulos (1458-1468.)",
     "pasajes": 2
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
     "pasajes": 7
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
     "visible": "Notas sobre edificios en Milán",
     "consulta": "Notas sobre edificios en Milán (1016-1019)",
     "pasajes": 1
    },
    {
     "visible": "Para colocar la masa v r en el…",
     "consulta": "Para colocar la masa v r en el…",
     "pasajes": 1,
     "refuerzo": "torre, vacio, rayo, credenza"
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
     "pasajes": 1,
     "refuerzo": "egeo, ponto, fluye, siempre"
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
     "pasajes": 1,
     "refuerzo": "hacia, millas, fluye, india"
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
     "visible": "Proporciones de la cabeza y del rostro",
     "consulta": "Proporciones de la cabeza y del rostro",
     "pasajes": 7
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
     "pasajes": 10
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
     "pasajes": 1,
     "refuerzo": "existencia, futuro, nada, presente"
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
     "visible": "La producción de la pirámide de la visión",
     "consulta": "La producción de la pirámide de la visión",
     "pasajes": 7
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
     "visible": "Prueba experimental de la existencia de la pirámide de la vista",
     "consulta": "Prueba experimental de la existencia de la pirámide de la vista",
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
     "visible": "El ángulo de la visión varía con la distancia",
     "consulta": "El ángulo de la visión varía con la distancia",
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
     "visible": "Sobre las manchas en la luna",
     "consulta": "Sobre las manchas en la luna (903-907)",
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
     "visible": "Borradores diversos de cartas y registros personales",
     "consulta": "Borradores diversos de cartas y registros personales (1356—1368)",
     "pasajes": 8
    },
    {
     "visible": "Borradores de cartas e informes referentes a Armenia",
     "consulta": "Borradores de cartas e informes referentes a Armenia (1336. 1337)",
     "pasajes": 6
    },
    {
     "visible": "Borradores de cartas a Lodovico il Moro",
     "consulta": "Borradores de cartas a Lodovico il Moro (1340-1345)",
     "pasajes": 6
    },
    {
     "visible": "Borrador de carta para enviar a Piacenza",
     "consulta": "Borrador de carta para enviar a Piacenza (1346. 1347)",
     "pasajes": 4
    },
    {
     "visible": "Notas con fechas",
     "consulta": "Notas con fechas (1369—1378)",
     "pasajes": 4
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
     "pasajes": 10
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
     "pasajes": 2
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
     "visible": "Introducciones generales al libro sobre pintura",
     "consulta": "Introducciones generales al libro sobre pintura",
     "pasajes": 5
    },
    {
     "visible": "Sugerencias para la disposición de manuscritos que tratan de asuntos particulares",
     "consulta": "Sugerencias para la disposición de manuscritos que tratan de asuntos particulares",
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
     "pasajes": 9
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
     "pasajes": 9
    },
    {
     "visible": "Sobre la reflexión de los colores",
     "consulta": "Sobre la reflexión de los colores",
     "pasajes": 3
    },
    {
     "visible": "Sobre el uso de colores oscuros y claros en la pintura",
     "consulta": "Sobre el uso de colores oscuros y claros en la pintura",
     "pasajes": 3
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
     "pasajes": 1,
     "refuerzo": "brumosos, enfrentan, matiz, bordes, miembros, nieva"
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
 ],
 "en": [
  {
   "seccion": "The practice of painting",
   "glosa": "How he prepared his colours, where he put the light, and how he painted gesture and drapery",
   "pasajes": 182,
   "temas": [
    {
     "visible": "On chemical materials",
     "consulta": "On chemical materials",
     "pasajes": 11
    },
    {
     "visible": "On various helps in preparing a picture",
     "consulta": "On various helps in preparing a picture",
     "pasajes": 10
    },
    {
     "visible": "On the preparation and use of colours",
     "consulta": "On the preparation and use of colours",
     "pasajes": 9
    },
    {
     "visible": "On the best light for painting",
     "consulta": "On the best light for painting",
     "pasajes": 8
    },
    {
     "visible": "The right position of the artist, when painting and of the spectator",
     "consulta": "The right position of the artist, when painting and of the spectator",
     "pasajes": 8,
     "iman": true
    },
    {
     "visible": "Of appropriate gestures",
     "consulta": "Of appropriate gestures",
     "pasajes": 8
    },
    {
     "visible": "Of representing the deluge",
     "consulta": "Of representing the deluge",
     "pasajes": 8
    },
    {
     "visible": "On the choice of light for a picture",
     "consulta": "On the choice of light for a picture",
     "pasajes": 6
    },
    {
     "visible": "The selection of forms",
     "consulta": "The selection of forms",
     "pasajes": 6
    },
    {
     "visible": "Of chalk and paper",
     "consulta": "Of chalk and paper",
     "pasajes": 6
    },
    {
     "visible": "The distribution of light and shade",
     "consulta": "The distribution of light and shade",
     "pasajes": 5
    },
    {
     "visible": "The preparation of oils",
     "consulta": "The preparation of oils",
     "pasajes": 5
    },
    {
     "visible": "On the productive power of minor artists",
     "consulta": "On the productive power of minor artists",
     "pasajes": 4
    },
    {
     "visible": "How to acquire universality",
     "consulta": "How to acquire universality",
     "pasajes": 4
    },
    {
     "visible": "On the lighting of the background",
     "consulta": "On the lighting of the background",
     "pasajes": 4
    },
    {
     "visible": "The methods of aerial perspective",
     "consulta": "The methods of aerial perspective",
     "pasajes": 4
    },
    {
     "visible": "General suggestions for historical pictures",
     "consulta": "General suggestions for historical pictures",
     "pasajes": 4
    },
    {
     "visible": "Of painting battle-pieces",
     "consulta": "Of painting battle-pieces",
     "pasajes": 4
    },
    {
     "visible": "The course of instruction for an artist",
     "consulta": "The course of instruction for an artist",
     "pasajes": 3
    },
    {
     "visible": "The distribution of time for studying",
     "consulta": "The distribution of time for studying",
     "pasajes": 3
    },
    {
     "visible": "On the construction of windows",
     "consulta": "On the construction of windows",
     "pasajes": 3
    },
    {
     "visible": "On the limitations of painting",
     "consulta": "On the limitations of painting",
     "pasajes": 3
    },
    {
     "visible": "Of the light on the face",
     "consulta": "Of the light on the face",
     "pasajes": 3
    },
    {
     "visible": "On varnishes",
     "consulta": "On varnishes",
     "pasajes": 3
    },
    {
     "visible": "Painting is superior to poetry",
     "consulta": "Painting is superior to poetry",
     "pasajes": 3
    },
    {
     "visible": "Aphorisms",
     "consulta": "Aphorisms",
     "pasajes": 3
    },
    {
     "visible": "The study of the antique",
     "consulta": "The study of the antique",
     "pasajes": 2
    },
    {
     "visible": "The necessity of anatomical knowledge",
     "consulta": "The necessity of anatomical knowledge",
     "pasajes": 2
    },
    {
     "visible": "Industry and thoroughness the first conditions",
     "consulta": "Industry and thoroughness the first conditions",
     "pasajes": 2
    },
    {
     "visible": "The artist's private life and choice of company",
     "consulta": "The artist's private life and choice of company",
     "pasajes": 2
    },
    {
     "visible": "Useful games and exercises",
     "consulta": "Useful games and exercises",
     "pasajes": 2
    },
    {
     "visible": "On the management of works",
     "consulta": "On the management of works",
     "pasajes": 2
    },
    {
     "visible": "On the choice of a position",
     "consulta": "On the choice of a position",
     "pasajes": 2
    },
    {
     "visible": "The apparent size of figures in a picture",
     "consulta": "The apparent size of figures in a picture",
     "pasajes": 2
    },
    {
     "visible": "The juxtaposition of light and shade",
     "consulta": "The juxtaposition of light and shade",
     "pasajes": 2
    },
    {
     "visible": "Of sketching figures and portraits",
     "consulta": "OF Of sketching figures and portraits",
     "pasajes": 2
    },
    {
     "visible": "How to represent the differences of age and sex",
     "consulta": "How to represent the differences of age and sex",
     "pasajes": 2
    },
    {
     "visible": "Of depicting a tempest",
     "consulta": "Of depicting a tempest",
     "pasajes": 2
    },
    {
     "visible": "Of depicting natural phenomena",
     "consulta": "Of depicting natural phenomena",
     "pasajes": 2
    },
    {
     "visible": "The relation of art and nature",
     "consulta": "The relation of art and nature",
     "pasajes": 2
    },
    {
     "visible": "Painting is superior to sculpture",
     "consulta": "Painting is superior to sculpture",
     "pasajes": 2
    },
    {
     "visible": "On the history of painting",
     "consulta": "On the history of painting",
     "pasajes": 2
    },
    {
     "visible": "How to ascertain the dispositions for an artistic career",
     "consulta": "How to ascertain the dispositions for an artistic career",
     "pasajes": 1
    },
    {
     "visible": "How to acquire practice",
     "consulta": "How to acquire practice",
     "pasajes": 1
    },
    {
     "visible": "A caution against one-sided study",
     "consulta": "A caution against one-sided study",
     "pasajes": 1
    },
    {
     "visible": "On the size of the studio",
     "consulta": "On the size of the studio",
     "pasajes": 1
    },
    {
     "visible": "Gradations of light and shade",
     "consulta": "OF Gradations of light and shade",
     "pasajes": 1
    },
    {
     "visible": "On the lighting of white objects",
     "consulta": "On the lighting of white objects",
     "pasajes": 1
    },
    {
     "visible": "The position of the head",
     "consulta": "The position of the head",
     "pasajes": 1
    },
    {
     "visible": "Of representing the emotions",
     "consulta": "Of representing the emotions",
     "pasajes": 1
    },
    {
     "visible": "Of representing imaginary animals",
     "consulta": "Of representing imaginary animals",
     "pasajes": 1
    },
    {
     "visible": "How to pose figures",
     "consulta": "How to pose figures",
     "pasajes": 1
    },
    {
     "visible": "Of depicting night-scenes",
     "consulta": "Of depicting night-scenes",
     "pasajes": 1
    },
    {
     "visible": "Of preparing the panel",
     "consulta": "Of preparing the panel",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Humorous writings",
   "glosa": "Fables, riddles, jests and mock prophecies",
   "pasajes": 125,
   "temas": [
    {
     "visible": "Studies on the life and habits of animals",
     "consulta": "STUDIES ON THE LIFE AND HABITS OF ANIMALS",
     "pasajes": 44
    },
    {
     "visible": "Prophecies",
     "consulta": "PROPHECIES",
     "pasajes": 30
    },
    {
     "visible": "Jests and tales",
     "consulta": "JESTS AND TALES",
     "pasajes": 13,
     "iman": true
    },
    {
     "visible": "Fables on plants",
     "consulta": "Fables on plants (1275-1279)",
     "pasajes": 9
    },
    {
     "visible": "Fables on animals",
     "consulta": "Fables on animals (1265-1270)",
     "pasajes": 6
    },
    {
     "visible": "Schemes for fables, etc",
     "consulta": "Schemes for fables, etc. (1314-1323)",
     "pasajes": 6
    },
    {
     "visible": "Schemes for prophecies",
     "consulta": "Schemes for prophecies (1324-1329)",
     "pasajes": 6
    },
    {
     "visible": "Fables on lifeless objects",
     "consulta": "Fables on lifeless objects (1271—1274)",
     "pasajes": 4
    },
    {
     "visible": "Tricks",
     "consulta": "Tricks (1333-1335)",
     "pasajes": 3
    },
    {
     "visible": "Draughts and schemes for the humorous writings",
     "consulta": "DRAUGHTS AND SCHEMES FOR THE HUMOROUS WRITINGS",
     "pasajes": 2
    },
    {
     "visible": "Motion tends towards the centre of gravity",
     "consulta": "Motion tends towards the centre of gravity",
     "pasajes": 1
    },
    {
     "visible": "Irony",
     "consulta": "Irony (1332)",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Light and shade",
   "glosa": "How a shadow falls, how it fades, and how to paint it",
   "pasajes": 113,
   "temas": [
    {
     "visible": "On the shape of derived shadows",
     "consulta": "On the shape of derived shadows",
     "pasajes": 9
    },
    {
     "visible": "On relative proportion of light and shadows",
     "consulta": "On relative proportion of light and shadows",
     "pasajes": 6
    },
    {
     "visible": "Different principles and plans of treatment",
     "consulta": "Different principles and plans of treatment",
     "pasajes": 5
    },
    {
     "visible": "Light and shadow with regard to the position of the eye",
     "consulta": "Light and shadow with regard to the position of the eye",
     "pasajes": 5
    },
    {
     "visible": "On the proportion of light and shadow",
     "consulta": "On the proportion of light and shadow",
     "pasajes": 5
    },
    {
     "visible": "On the relative intensity of derived shadows",
     "consulta": "On the relative intensity of derived shadows",
     "pasajes": 5
    },
    {
     "visible": "Definition of the nature of shadows",
     "consulta": "Definition of the nature of shadows",
     "pasajes": 4
    },
    {
     "visible": "On the nature of light",
     "consulta": "ON On the nature of light",
     "pasajes": 4
    },
    {
     "visible": "The difference between light and lustre",
     "consulta": "The difference between light and lustre",
     "pasajes": 4
    },
    {
     "visible": "Experiments on the relation of light and shadow within a room",
     "consulta": "Experiments on the relation of light and shadow within a room",
     "pasajes": 4
    },
    {
     "visible": "Further complications in the derived shadows",
     "consulta": "Further complications in the derived shadows",
     "pasajes": 4
    },
    {
     "visible": "On the shape of cast shadows",
     "consulta": "ON On the shape of cast shadows",
     "pasajes": 4
    },
    {
     "visible": "On the outlines of cast shadows",
     "consulta": "On the outlines of cast shadows",
     "pasajes": 4
    },
    {
     "visible": "Of the various kinds of shadows",
     "consulta": "Of the various kinds of shadows",
     "pasajes": 3
    },
    {
     "visible": "On the intensity of shadows as dependent on the distance from the light",
     "consulta": "On the intensity of shadows as dependent on the distance from the light",
     "pasajes": 3
    },
    {
     "visible": "Different sorts of derived shadows",
     "consulta": "Different sorts of derived shadows",
     "pasajes": 3
    },
    {
     "visible": "On the relation of derived and primary shadow",
     "consulta": "On the relation of derived and primary shadow",
     "pasajes": 3
    },
    {
     "visible": "On the relative depth of cast shadows",
     "consulta": "On the relative depth of cast shadows",
     "pasajes": 3
    },
    {
     "visible": "Experiments with the mirror",
     "consulta": "Experiments with the mirror",
     "pasajes": 3
    },
    {
     "visible": "Different sorts of light",
     "consulta": "Different sorts of light",
     "pasajes": 2
    },
    {
     "visible": "Of the various kinds of light",
     "consulta": "Of the various kinds of light",
     "pasajes": 2
    },
    {
     "visible": "General remarks",
     "consulta": "General remarks",
     "pasajes": 2
    },
    {
     "visible": "The law of the incidence of light",
     "consulta": "The law of the incidence of light",
     "pasajes": 2
    },
    {
     "visible": "Gradations of strength in the shadows",
     "consulta": "ON Gradations of strength in the shadows",
     "pasajes": 2
    },
    {
     "visible": "Definition of derived shadow",
     "consulta": "ON Definition of derived shadow",
     "pasajes": 2
    },
    {
     "visible": "Shadow as produced by two lights of different size",
     "consulta": "Shadow as produced by two lights of different size",
     "pasajes": 2
    },
    {
     "visible": "On the relative size of cast shadows",
     "consulta": "On the relative size of cast shadows",
     "pasajes": 2
    },
    {
     "visible": "Principles of reflection",
     "consulta": "ON Principles of reflection",
     "pasajes": 2
    },
    {
     "visible": "Reflection on water",
     "consulta": "Reflection on water",
     "pasajes": 2
    },
    {
     "visible": "Appendix:--On shadows in movement",
     "consulta": "Appendix:--On shadows in movement",
     "pasajes": 2
    },
    {
     "visible": "The effect of rays passing through holes",
     "consulta": "ON The effect of rays passing through holes",
     "pasajes": 2
    },
    {
     "visible": "On prolegomena",
     "consulta": "ON Prolegomena",
     "pasajes": 1
    },
    {
     "visible": "Scheme of the books on light and shade",
     "consulta": "Scheme of the books on light and shade",
     "pasajes": 1
    },
    {
     "visible": "The relations of luminous to illuminated bodies",
     "consulta": "The relations of luminous to illuminated bodies",
     "pasajes": 1
    },
    {
     "visible": "The effect of light at different distances",
     "consulta": "The effect of light at different distances",
     "pasajes": 1
    },
    {
     "visible": "Effects on cast shadows by the tone of the back ground",
     "consulta": "Effects on cast shadows by the tone of the back ground",
     "pasajes": 1
    },
    {
     "visible": "A disputed proposition",
     "consulta": "A disputed proposition",
     "pasajes": 1,
     "refuerzo": "triangle, plane, shadow, light"
    },
    {
     "visible": "On reverberation",
     "consulta": "On reverberation",
     "pasajes": 1
    },
    {
     "visible": "On gradation of shadows",
     "consulta": "On gradation of shadows",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Miscellaneous notes",
   "glosa": "Book lists, accounts, reminders and loose notes",
   "pasajes": 97,
   "temas": [
    {
     "visible": "Quotations and notes on books and authors",
     "consulta": "Quotations and notes on books and authors (1469—1508)",
     "pasajes": 28,
     "iman": true
    },
    {
     "visible": "Inventories and accounts",
     "consulta": "Inventories and accounts (1509-1545)",
     "pasajes": 18
    },
    {
     "visible": "Memoranda before 1500",
     "consulta": "Memoranda before 1500 (1379-l413)",
     "pasajes": 16
    },
    {
     "visible": "Memoranda after 1500",
     "consulta": "Memoranda after 1500 (1414—1434)",
     "pasajes": 15
    },
    {
     "visible": "Tinned iron,—pierced iron",
     "consulta": "Tinned iron,—pierced iron",
     "pasajes": 8
    },
    {
     "visible": "On the 6th day of October",
     "consulta": "On the 6th day of October",
     "pasajes": 6
    },
    {
     "visible": "Undated memoranda",
     "consulta": "Undated memoranda (1435-1457)",
     "pasajes": 3
    },
    {
     "visible": "Notes on pupils",
     "consulta": "Notes on pupils (1458-1468.)",
     "pasajes": 2
    },
    {
     "visible": "Benedetto, 24 grossoni",
     "consulta": "Benedetto, 24 grossoni",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Topographical notes",
   "glosa": "The places he travelled: rivers, mountains, cities",
   "pasajes": 93,
   "temas": [
    {
     "visible": "Notes on places in Central Italy, visited in 1502",
     "consulta": "Notes on places in Central Italy, visited in 1502 (1034-1054)",
     "pasajes": 10
    },
    {
     "visible": "France",
     "consulta": "FRANCE",
     "pasajes": 8
    },
    {
     "visible": "Canals in connection with the Arno",
     "consulta": "Canals in connection with the Arno (1001-1008)",
     "pasajes": 7
    },
    {
     "visible": "The Appenins",
     "consulta": "The Appenins (1063-1068)",
     "pasajes": 6
    },
    {
     "visible": "The Nile",
     "consulta": "The Nile (1093-1098)",
     "pasajes": 6
    },
    {
     "visible": "Canals in the Milanese",
     "consulta": "Canals in the Milanese (1009-1013)",
     "pasajes": 5
    },
    {
     "visible": "Notes on the North Italian lake",
     "consulta": "Notes on the North Italian lake. (1029-1033)",
     "pasajes": 5
    },
    {
     "visible": "The Alps",
     "consulta": "The Alps (1057-1062)",
     "pasajes": 5
    },
    {
     "visible": "Notes on the Sforzesca near Vigevano",
     "consulta": "Notes on the Sforzesca near Vigevano (1024-1028)",
     "pasajes": 4
    },
    {
     "visible": "The countries of the western end of the mediterranean",
     "consulta": "THE COUNTRIES OF THE WESTERN END OF THE MEDITERRANEAN",
     "pasajes": 4
    },
    {
     "visible": "The straits of Gibraltar",
     "consulta": "The straits of Gibraltar (1083-1085)",
     "pasajes": 3
    },
    {
     "visible": "The Caspian Sea",
     "consulta": "The Caspian Sea (1105. 1106)",
     "pasajes": 3
    },
    {
     "visible": "Estimates and preparatory studies for canals",
     "consulta": "Estimates and preparatory studies for canals (1014. 1015)",
     "pasajes": 2
    },
    {
     "visible": "The filling of the moats of the Castle of Milan",
     "consulta": "The filling of the moats of the Castle of Milan",
     "pasajes": 2
    },
    {
     "visible": "Remarks on natural phenomena in and near Milan",
     "consulta": "Remarks on natural phenomena in and near Milan (1021. 1022)",
     "pasajes": 2
    },
    {
     "visible": "Alessandria in Piedmont",
     "consulta": "Alessandria in Piedmont (1055. 1056)",
     "pasajes": 2
    },
    {
     "visible": "On the Germans",
     "consulta": "On the Germans (1080. 1081)",
     "pasajes": 2
    },
    {
     "visible": "The Red Sea",
     "consulta": "The Red Sea. (1091. 1092)",
     "pasajes": 2
    },
    {
     "visible": "Customs of Asiatic Nations",
     "consulta": "Customs of Asiatic Nations (1099. 1100)",
     "pasajes": 2
    },
    {
     "visible": "Notes on buildings in Milan",
     "consulta": "Notes on buildings in Milan (1016-1019)",
     "pasajes": 1
    },
    {
     "visible": "To place the mass v r in the…",
     "consulta": "To place the mass v r in the…",
     "pasajes": 1
    },
    {
     "visible": "Note on Pavia",
     "consulta": "Note on Pavia",
     "pasajes": 1
    },
    {
     "visible": "The Danube",
     "consulta": "The Danube",
     "pasajes": 1
    },
    {
     "visible": "The Levantine Sea",
     "consulta": "The Levantine Sea",
     "pasajes": 1
    },
    {
     "visible": "Rhodes",
     "consulta": "Rhodes (1101. 1102)",
     "pasajes": 1
    },
    {
     "visible": "Cyprus",
     "consulta": "Cyprus (1103. 1104)",
     "pasajes": 1
    },
    {
     "visible": "The sea of Azov",
     "consulta": "The sea of Azov",
     "pasajes": 1
    },
    {
     "visible": "The Dardanelles",
     "consulta": "The Dardanelles",
     "pasajes": 1,
     "refuerzo": "egean, pontus, flows, higher"
    },
    {
     "visible": "Constantinople",
     "consulta": "Constantinople",
     "pasajes": 1
    },
    {
     "visible": "The Euphrates",
     "consulta": "The Euphrates",
     "pasajes": 1
    },
    {
     "visible": "Centrae Asia",
     "consulta": "Centrae Asia",
     "pasajes": 1
    },
    {
     "visible": "On the natives of hot countries",
     "consulta": "On the natives of hot countries",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Botany and landscape for painters",
   "glosa": "How branches and leaves grow, and how to paint a landscape",
   "pasajes": 89,
   "temas": [
    {
     "visible": "The insertion of the leaves",
     "consulta": "The insertion of the leaves",
     "pasajes": 8
    },
    {
     "visible": "On the treatment of light for landscapes",
     "consulta": "On the treatment of light for landscapes",
     "pasajes": 7
    },
    {
     "visible": "The law of proportion in the growth of the branches",
     "consulta": "The law of proportion in the growth of the branches",
     "pasajes": 6
    },
    {
     "visible": "The direction of growth",
     "consulta": "The direction of growth",
     "pasajes": 5
    },
    {
     "visible": "The gradations of shade and colour in leaves",
     "consulta": "The gradations of shade and colour in leaves",
     "pasajes": 5
    },
    {
     "visible": "The proportions of light and shade in trees",
     "consulta": "The proportions of light and shade in trees",
     "pasajes": 5
    },
    {
     "visible": "The effects of morning light",
     "consulta": "The effects of morning light",
     "pasajes": 5
    },
    {
     "visible": "On the treatment of light for views of towns",
     "consulta": "On the treatment of light for views of towns",
     "pasajes": 5
    },
    {
     "visible": "The forms of trees",
     "consulta": "The forms of trees",
     "pasajes": 4
    },
    {
     "visible": "The proportions of light and shade in a leaf",
     "consulta": "The proportions of light and shade in a leaf",
     "pasajes": 4
    },
    {
     "visible": "Light and shade on groups of trees",
     "consulta": "Light and shade on groups of trees",
     "pasajes": 4
    },
    {
     "visible": "The effect of wind on trees",
     "consulta": "The effect of wind on trees",
     "pasajes": 4
    },
    {
     "visible": "Light and shade on clouds",
     "consulta": "Light and shade on clouds",
     "pasajes": 4
    },
    {
     "visible": "The relative thickness of the branches to the trunk",
     "consulta": "The relative thickness of the branches to the trunk",
     "pasajes": 3
    },
    {
     "visible": "Light on branches and leaves",
     "consulta": "Light on branches and leaves",
     "pasajes": 3
    },
    {
     "visible": "Of the transparency of leaves",
     "consulta": "Of the transparency of leaves",
     "pasajes": 3
    },
    {
     "visible": "The distribution of light and shade with reference to the position of the spectator",
     "consulta": "The distribution of light and shade with reference to the position of the spectator",
     "pasajes": 3
    },
    {
     "visible": "The appearance of trees in the distance",
     "consulta": "The appearance of trees in the distance",
     "pasajes": 2
    },
    {
     "visible": "The cast shadow of trees",
     "consulta": "The cast shadow of trees",
     "pasajes": 2
    },
    {
     "visible": "Of rainbows and rain",
     "consulta": "Of rainbows and rain",
     "pasajes": 2
    },
    {
     "visible": "Classification of trees",
     "consulta": "OF Classification of trees",
     "pasajes": 1
    },
    {
     "visible": "A classification of trees according to their colours",
     "consulta": "A classification of trees according to their colours",
     "pasajes": 1
    },
    {
     "visible": "The effects of midday light",
     "consulta": "The effects of midday light",
     "pasajes": 1
    },
    {
     "visible": "On images reflected in water",
     "consulta": "On images reflected in water",
     "pasajes": 1
    },
    {
     "visible": "Of flower seeds",
     "consulta": "Of flower seeds",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Physical geography",
   "glosa": "Water, tides, the flood, and how the earth was formed",
   "pasajes": 88,
   "temas": [
    {
     "visible": "Doubts about the deluge",
     "consulta": "Doubts about the deluge",
     "pasajes": 8
    },
    {
     "visible": "Book 15 of matters worn away by water",
     "consulta": "Book 15 of matters worn away by water",
     "pasajes": 7
    },
    {
     "visible": "Observations in support of the hypothesis",
     "consulta": "Observations in support of the hypothesis (963-969)",
     "pasajes": 7
    },
    {
     "visible": "The ebb and flow of the tide",
     "consulta": "The ebb and flow of the tide (955-960)",
     "pasajes": 6
    },
    {
     "visible": "Further researches",
     "consulta": "Further researches (989-991)",
     "pasajes": 6
    },
    {
     "visible": "The formation of mountains",
     "consulta": "The formation of mountains (979-983)",
     "pasajes": 5
    },
    {
     "visible": "Of the surface of the water in relation to the globe",
     "consulta": "Of the surface of the water in relation to the globe (933-936)",
     "pasajes": 4
    },
    {
     "visible": "The relative height of the surface of the sea to that of the land",
     "consulta": "The relative height of the surface of the sea to that of the land (942-945)",
     "pasajes": 4
    },
    {
     "visible": "On the motion of air",
     "consulta": "On the motion of air (996—999)",
     "pasajes": 4
    },
    {
     "visible": "On the encroachments of the sea on the land and vice versa",
     "consulta": "On the encroachments of the sea on the land and vice versa (952-954)",
     "pasajes": 3
    },
    {
     "visible": "On the alterations, caused in the courses of rivers by their confluence",
     "consulta": "On the alterations, caused in the courses of rivers by their confluence (972-974)",
     "pasajes": 3
    },
    {
     "visible": "Other problems",
     "consulta": "Other problems (992-994)",
     "pasajes": 3
    },
    {
     "visible": "Schemes for the arrangement of the materials",
     "consulta": "Schemes for the arrangement of the materials (919-928)",
     "pasajes": 2
    },
    {
     "visible": "Definitions",
     "consulta": "Definitions (931. 932)",
     "pasajes": 2
    },
    {
     "visible": "Of the proportion of the mass of water to that of the earth",
     "consulta": "Of the proportion of the mass of water to that of the earth (937. 938)",
     "pasajes": 2
    },
    {
     "visible": "The theory of Plato",
     "consulta": "The theory of Plato",
     "pasajes": 2
    },
    {
     "visible": "Refutation of Pliny's theory as to the saltness of the sea",
     "consulta": "Refutation of Pliny's theory as to the saltness of the sea (946. 947)",
     "pasajes": 2
    },
    {
     "visible": "The characteristics of sea water",
     "consulta": "The characteristics of sea water (948. 949)",
     "pasajes": 2
    },
    {
     "visible": "On the formation of Gulfs",
     "consulta": "On the formation of Gulfs (950. 951)",
     "pasajes": 2
    },
    {
     "visible": "The origin of the sand in rivers",
     "consulta": "The origin of the sand in rivers (977. 978)",
     "pasajes": 2
    },
    {
     "visible": "General introduction",
     "consulta": "General introduction",
     "pasajes": 1
    },
    {
     "visible": "The arrangement of Book I",
     "consulta": "The arrangement of Book I",
     "pasajes": 1
    },
    {
     "visible": "Theory of the elevation of water within the mountains",
     "consulta": "Theory of the elevation of water within the mountains",
     "pasajes": 1
    },
    {
     "visible": "Theory of the circulation of the waters",
     "consulta": "Theory of the circulation of the waters (961. 962)",
     "pasajes": 1
    },
    {
     "visible": "Of rivers",
     "consulta": "OF RIVERS",
     "pasajes": 1
    },
    {
     "visible": "The tide in estuaries",
     "consulta": "The tide in estuaries",
     "pasajes": 1
    },
    {
     "visible": "Whirlpools",
     "consulta": "Whirlpools",
     "pasajes": 1
    },
    {
     "visible": "On the alterations in the channels of rivers",
     "consulta": "On the alterations in the channels of rivers",
     "pasajes": 1
    },
    {
     "visible": "On mountains",
     "consulta": "ON MOUNTAINS",
     "pasajes": 1
    },
    {
     "visible": "Geological problems",
     "consulta": "GEOLOGICAL PROBLEMS",
     "pasajes": 1
    },
    {
     "visible": "Constituents of the atmosphere",
     "consulta": "Constituents of the atmosphere",
     "pasajes": 1
    },
    {
     "visible": "The globe an organism",
     "consulta": "The globe an organism",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Proportions and movement of the body",
   "glosa": "How long each part of the body is, and how it moves",
   "pasajes": 83,
   "temas": [
    {
     "visible": "On the human body in action",
     "consulta": "On the human body in action",
     "pasajes": 9
    },
    {
     "visible": "Proportions of the head and face",
     "consulta": "Proportions of the head and face",
     "pasajes": 7
    },
    {
     "visible": "Proportions of the arm",
     "consulta": "Proportions of the arm",
     "pasajes": 7
    },
    {
     "visible": "The movement of the torso",
     "consulta": "The movement of the torso",
     "pasajes": 7
    },
    {
     "visible": "The movement of the human figure",
     "consulta": "The movement of the human figure",
     "pasajes": 7
    },
    {
     "visible": "The proportions vary at different ages",
     "consulta": "The proportions vary at different ages",
     "pasajes": 6
    },
    {
     "visible": "The movement of the arm",
     "consulta": "The movement of the arm",
     "pasajes": 5
    },
    {
     "visible": "Of walking up and down",
     "consulta": "Of walking up and down",
     "pasajes": 5
    },
    {
     "visible": "Proportions of the head seen in front",
     "consulta": "Proportions of the head seen in front",
     "pasajes": 3
    },
    {
     "visible": "Relative proportions of the foot and of the face",
     "consulta": "Relative proportions of the foot and of the face",
     "pasajes": 3
    },
    {
     "visible": "Proportions of the leg",
     "consulta": "Proportions of the leg",
     "pasajes": 3
    },
    {
     "visible": "The proportions of the whole figure",
     "consulta": "The proportions of the whole figure",
     "pasajes": 3
    },
    {
     "visible": "On draperies",
     "consulta": "On draperies",
     "pasajes": 3
    },
    {
     "visible": "Preliminary observations",
     "consulta": "ON ON OF Preliminary observations",
     "pasajes": 2
    },
    {
     "visible": "Proportions of the foot",
     "consulta": "Proportions of the foot",
     "pasajes": 2
    },
    {
     "visible": "The relative proportions of the torso and of the leg",
     "consulta": "The relative proportions of the torso and of the leg",
     "pasajes": 2
    },
    {
     "visible": "Relative proportions of the hand and foot",
     "consulta": "Relative proportions of the hand and foot",
     "pasajes": 1
    },
    {
     "visible": "On the central point of the whole body",
     "consulta": "On the central point of the whole body",
     "pasajes": 1
    },
    {
     "visible": "The relative proportions of the torso and of the whole figure",
     "consulta": "The relative proportions of the torso and of the whole figure",
     "pasajes": 1
    },
    {
     "visible": "The relative proportions of the head and of the torso",
     "consulta": "The relative proportions of the head and of the torso",
     "pasajes": 1
    },
    {
     "visible": "The relative proportions of the torso and of the foot",
     "consulta": "The relative proportions of the torso and of the foot",
     "pasajes": 1
    },
    {
     "visible": "The torso from the front and back",
     "consulta": "The torso from the front and back",
     "pasajes": 1
    },
    {
     "visible": "Vitruvius' scheme of proportions",
     "consulta": "Vitruvius' scheme of proportions",
     "pasajes": 1
    },
    {
     "visible": "The arm and head",
     "consulta": "The arm and head",
     "pasajes": 1
    },
    {
     "visible": "On hair falling down in curls",
     "consulta": "On hair falling down in curls",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Maxims, morals and polemics",
   "glosa": "What he thought about science, life and his rivals",
   "pasajes": 75,
   "temas": [
    {
     "visible": "Morals",
     "consulta": "MORALS",
     "pasajes": 14,
     "iman": true
    },
    {
     "visible": "Science, its principles and rules",
     "consulta": "Science, its principles and rules (1148—1161)",
     "pasajes": 10
    },
    {
     "visible": "Rules of Life",
     "consulta": "Rules of Life (1188-1202)",
     "pasajes": 10
    },
    {
     "visible": "Psychology",
     "consulta": "Psychology (1140-1147)",
     "pasajes": 6
    },
    {
     "visible": "The powers of Nature",
     "consulta": "The powers of Nature (1134-1139)",
     "pasajes": 5
    },
    {
     "visible": "On spirits",
     "consulta": "On spirits (1211—1213)",
     "pasajes": 5
    },
    {
     "visible": "Polemics.—speculation",
     "consulta": "POLEMICS.—SPECULATION",
     "pasajes": 4
    },
    {
     "visible": "On riches",
     "consulta": "On riches (1183—1187)",
     "pasajes": 3
    },
    {
     "visible": "Reflections on Nature",
     "consulta": "Reflections on Nature (1217-1219)",
     "pasajes": 3
    },
    {
     "visible": "Prayers to God",
     "consulta": "Prayers to God (1132. 1133)",
     "pasajes": 2
    },
    {
     "visible": "What is life?",
     "consulta": "What is life? (1162. 1163)",
     "pasajes": 2
    },
    {
     "visible": "On foolishness and ignorance",
     "consulta": "On foolishness and ignorance (1180—1182)",
     "pasajes": 2
    },
    {
     "visible": "Politics",
     "consulta": "Politics (1203. 1204)",
     "pasajes": 2
    },
    {
     "visible": "Against Speculators",
     "consulta": "Against Speculators (1205. 1206)",
     "pasajes": 2
    },
    {
     "visible": "Against alchemists",
     "consulta": "Against alchemists (1207. 1208)",
     "pasajes": 2
    },
    {
     "visible": "Death",
     "consulta": "Death",
     "pasajes": 1
    },
    {
     "visible": "Against writers of epitomes",
     "consulta": "Against writers of epitomes",
     "pasajes": 1
    },
    {
     "visible": "Nonentity",
     "consulta": "Nonentity",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Linear perspective",
   "glosa": "Why things look smaller far away, worked out with geometry",
   "pasajes": 69,
   "temas": [
    {
     "visible": "The apparent size of objects denned by calculation",
     "consulta": "The apparent size of objects denned by calculation",
     "pasajes": 8
    },
    {
     "visible": "The production of the pyramid of vision",
     "consulta": "The production of the pyramid of vision",
     "pasajes": 7
    },
    {
     "visible": "The intersection of the rays",
     "consulta": "The intersection of the rays",
     "pasajes": 6
    },
    {
     "visible": "The relative size of objects with regard to their distance from the eye",
     "consulta": "The relative size of objects with regard to their distance from the eye",
     "pasajes": 6
    },
    {
     "visible": "The elements of perspective:--of the point",
     "consulta": "The elements of perspective:--of the point",
     "pasajes": 4
    },
    {
     "visible": "Experimental proof of the existence of the pyramid of sight",
     "consulta": "Experimental proof of the existence of the pyramid of sight",
     "pasajes": 3
    },
    {
     "visible": "Proof by experiment",
     "consulta": "Proof by experiment",
     "pasajes": 3
    },
    {
     "visible": "Demonstration of perspective by means of a vertical glass plane",
     "consulta": "Demonstration of perspective by means of a vertical glass plane",
     "pasajes": 3
    },
    {
     "visible": "The angle of sight varies with the distance",
     "consulta": "The angle of sight varies with the distance",
     "pasajes": 3
    },
    {
     "visible": "On natural perspective",
     "consulta": "On natural perspective",
     "pasajes": 3
    },
    {
     "visible": "Of the line",
     "consulta": "Of the line",
     "pasajes": 2
    },
    {
     "visible": "The relations of the distance point to the vanishing point",
     "consulta": "The relations of the distance point to the vanishing point",
     "pasajes": 2
    },
    {
     "visible": "The function of the eye, as explained by the camera obscura",
     "consulta": "The function of the eye, as explained by the camera obscura",
     "pasajes": 2
    },
    {
     "visible": "The practice of perspective",
     "consulta": "The practice of perspective",
     "pasajes": 2
    },
    {
     "visible": "Refraction of the rays falling upon the eye",
     "consulta": "Refraction of the rays falling upon the eye",
     "pasajes": 2
    },
    {
     "visible": "The proper distance of objects from the eye",
     "consulta": "The proper distance of objects from the eye",
     "pasajes": 2
    },
    {
     "visible": "General remarks on perspective",
     "consulta": "General remarks on perspective",
     "pasajes": 1
    },
    {
     "visible": "The nature of the outline",
     "consulta": "The nature of the outline",
     "pasajes": 1
    },
    {
     "visible": "Definition of perspective",
     "consulta": "Definition of perspective",
     "pasajes": 1
    },
    {
     "visible": "The perception of the object depends on the direction of the eye",
     "consulta": "The perception of the object depends on the direction of the eye",
     "pasajes": 1
    },
    {
     "visible": "How to measure the pyramid of vision",
     "consulta": "How to measure the pyramid of vision",
     "pasajes": 1
    },
    {
     "visible": "General conclusions",
     "consulta": "General conclusions",
     "pasajes": 1
    },
    {
     "visible": "That the contrary is impossible",
     "consulta": "That the contrary is impossible",
     "pasajes": 1
    },
    {
     "visible": "A parallel case",
     "consulta": "A parallel case",
     "pasajes": 1
    },
    {
     "visible": "The inversion of the images",
     "consulta": "The inversion of the images",
     "pasajes": 1
    },
    {
     "visible": "Opposite pyramids in juxtaposition",
     "consulta": "Opposite pyramids in juxtaposition",
     "pasajes": 1
    },
    {
     "visible": "On simple and complex perspective",
     "consulta": "On simple and complex perspective",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Astronomy",
   "glosa": "The moon, the sun, and the Earth seen as one more planet",
   "pasajes": 61,
   "temas": [
    {
     "visible": "On the luminousity of the moon",
     "consulta": "On the luminousity of the moon (892-901)",
     "pasajes": 12
    },
    {
     "visible": "The earth as a planet",
     "consulta": "THE EARTH AS A PLANET",
     "pasajes": 6
    },
    {
     "visible": "On the luminosity of the Earth in the universal space",
     "consulta": "On the luminosity of the Earth in the universal space (874-878)",
     "pasajes": 5
    },
    {
     "visible": "On the spots in the moon",
     "consulta": "On the spots in the moon (903-907)",
     "pasajes": 5
    },
    {
     "visible": "The fundamental laws of the solar system",
     "consulta": "The fundamental laws of the solar system (859-864)",
     "pasajes": 4
    },
    {
     "visible": "Marcellus and many others praise the sun",
     "consulta": "Marcellus and many others praise the sun",
     "pasajes": 4
    },
    {
     "visible": "Considerations as to the size of the sun",
     "consulta": "Considerations as to the size of the sun (886-891)",
     "pasajes": 4
    },
    {
     "visible": "Explanation of the lumen cinereum in the moon",
     "consulta": "Explanation of the lumen cinereum in the moon",
     "pasajes": 4
    },
    {
     "visible": "On instruments for observing the moon",
     "consulta": "On instruments for observing the moon (909. 910)",
     "pasajes": 3
    },
    {
     "visible": "The earth's place in the universe",
     "consulta": "The earth's place in the universe (857. 858)",
     "pasajes": 2
    },
    {
     "visible": "And the rocks with their various strata?",
     "consulta": "And the rocks with their various strata?",
     "pasajes": 2
    },
    {
     "visible": "How to prove that the earth is a planet",
     "consulta": "How to prove that the earth is a planet (865-867)",
     "pasajes": 2
    },
    {
     "visible": "The question of the true and of the apparent size of the sun",
     "consulta": "The question of the true and of the apparent size of the sun (879-884)",
     "pasajes": 2
    },
    {
     "visible": "Of time and its divisions",
     "consulta": "Of time and its divisions (916-918)",
     "pasajes": 2
    },
    {
     "visible": "Of the nature of Sunlight",
     "consulta": "Of the nature of Sunlight",
     "pasajes": 1
    },
    {
     "visible": "On the moon's halo",
     "consulta": "On the moon's halo",
     "pasajes": 1
    },
    {
     "visible": "Observations on the stars",
     "consulta": "Observations on the stars",
     "pasajes": 1
    },
    {
     "visible": "On history of astronomy",
     "consulta": "On history of astronomy",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Anatomy, zoology and physiology",
   "glosa": "Bones, muscles, organs, and how the body works",
   "pasajes": 57,
   "temas": [
    {
     "visible": "Plans and suggestions for the arrangement of materials",
     "consulta": "Plans and suggestions for the arrangement of materials (797-802)",
     "pasajes": 6
    },
    {
     "visible": "Plans for the representation of muscles by drawings",
     "consulta": "Plans for the representation of muscles by drawings (803-809)",
     "pasajes": 6
    },
    {
     "visible": "Comparative study of the structure of bones and of the action of muscles",
     "consulta": "Comparative study of the structure of bones and of the action of muscles (822-826)",
     "pasajes": 5
    },
    {
     "visible": "The laws of nutrition and the support of life",
     "consulta": "The laws of nutrition and the support of life (843-848)",
     "pasajes": 5
    },
    {
     "visible": "Physiology",
     "consulta": "PHYSIOLOGY",
     "pasajes": 4,
     "iman": true
    },
    {
     "visible": "Advantages in the structure of the eye in certain animals",
     "consulta": "Advantages in the structure of the eye in certain animals (828-831)",
     "pasajes": 4
    },
    {
     "visible": "Some notes on medicine",
     "consulta": "Some notes on medicine (851-855)",
     "pasajes": 4
    },
    {
     "visible": "On corpulency and leanness",
     "consulta": "On corpulency and leanness (809-811)",
     "pasajes": 3
    },
    {
     "visible": "Miscellaneous physiological observations",
     "consulta": "Miscellaneous physiological observations (840-842)",
     "pasajes": 3
    },
    {
     "visible": "On the circulation of the blood",
     "consulta": "On the circulation of the blood (848-850)",
     "pasajes": 3
    },
    {
     "visible": "Physiological problems",
     "consulta": "Physiological problems (814. 815)",
     "pasajes": 2
    },
    {
     "visible": "The divisions of the animal kingdom",
     "consulta": "The divisions of the animal kingdom (816. 817)",
     "pasajes": 2
    },
    {
     "visible": "Miscellaneous notes on the study of Zoology",
     "consulta": "Miscellaneous notes on the study of Zoology (818-821)",
     "pasajes": 2
    },
    {
     "visible": "On the conditions of sight",
     "consulta": "On the conditions of sight (834. 835)",
     "pasajes": 2
    },
    {
     "visible": "On the origin of the soul",
     "consulta": "On the origin of the soul",
     "pasajes": 2
    },
    {
     "visible": "Anatomy",
     "consulta": "ANATOMY",
     "pasajes": 1
    },
    {
     "visible": "The divisions of the head",
     "consulta": "The divisions of the head (812. 813)",
     "pasajes": 1
    },
    {
     "visible": "The seat of the common sense",
     "consulta": "The seat of the common sense",
     "pasajes": 1
    },
    {
     "visible": "On involuntary muscular action",
     "consulta": "On involuntary muscular action",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Letters and personal records",
   "glosa": "Letters to his patrons, dates and records of his own life",
   "pasajes": 43,
   "temas": [
    {
     "visible": "Draft of Letter to the Governor of Milan",
     "consulta": "Draft of Letter to the Governor of Milan",
     "pasajes": 9
    },
    {
     "visible": "Miscellaneous drafts of letters and personal records",
     "consulta": "Miscellaneous drafts of letters and personal records (1356—1368)",
     "pasajes": 8
    },
    {
     "visible": "Drafts of Letters and Reports referring to Armenia",
     "consulta": "Drafts of Letters and Reports referring to Armenia (1336. 1337)",
     "pasajes": 6
    },
    {
     "visible": "Drafts of Letters to Lodovico il Moro",
     "consulta": "Drafts of Letters to Lodovico il Moro (1340-1345)",
     "pasajes": 6
    },
    {
     "visible": "Draft of letter to be sent to Piacenza",
     "consulta": "Draft of letter to be sent to Piacenza (1346. 1347)",
     "pasajes": 4
    },
    {
     "visible": "Notes bearing Dates",
     "consulta": "Notes bearing Dates (1369—1378)",
     "pasajes": 4
    },
    {
     "visible": "Notes about events observed abroad",
     "consulta": "Notes about events observed abroad (1338-1339)",
     "pasajes": 2
    },
    {
     "visible": "Miscellaneous Records (1354. 1355)-",
     "consulta": "Miscellaneous Records (1354. 1355)-",
     "pasajes": 2
    },
    {
     "visible": "Letter to the Cardinal Ippolito d' Este",
     "consulta": "Letter to the Cardinal Ippolito d' Este",
     "pasajes": 1
    },
    {
     "visible": "Draft of letter written at Rome",
     "consulta": "Draft of letter written at Rome",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Perspective of disappearance",
   "glosa": "Why distant things look blurred and lose their colour",
   "pasajes": 40,
   "temas": [
    {
     "visible": "How sharpness is lost with distance",
     "consulta": "Propositions on Prospettiva de' perdimenti from MS. C",
     "pasajes": 13
    },
    {
     "visible": "The effect of light or dark backgrounds on the apparent size of objects",
     "consulta": "The effect of light or dark backgrounds on the apparent size of objects",
     "pasajes": 10
    },
    {
     "visible": "The part light and shade play in what is seen far off",
     "consulta": "The importance of light and shade in the Prospettiva de' perdimenti",
     "pasajes": 5
    },
    {
     "visible": "On indistinctness at short distances",
     "consulta": "On indistinctness at short distances",
     "pasajes": 4
    },
    {
     "visible": "On indistinctness at great distances",
     "consulta": "On indistinctness at great distances",
     "pasajes": 3
    },
    {
     "visible": "What the perspective of disappearance is",
     "consulta": "PERSPECTIVE OF DISAPPEARANCE Definition",
     "pasajes": 2
    },
    {
     "visible": "An illustration by experiment",
     "consulta": "An illustration by experiment",
     "pasajes": 1
    },
    {
     "visible": "A guiding rule",
     "consulta": "A guiding rule",
     "pasajes": 1
    },
    {
     "visible": "An experiment",
     "consulta": "An experiment",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Prolegomena to the book on painting",
   "glosa": "How he meant to order his treatise, and what seeing is",
   "pasajes": 39,
   "temas": [
    {
     "visible": "The comparative size of the image depends on the amount of light",
     "consulta": "The comparative size of the image depends on the amount of light",
     "pasajes": 10
    },
    {
     "visible": "General introductions to the book on painting",
     "consulta": "General introductions to the book on painting",
     "pasajes": 5
    },
    {
     "visible": "Suggestions for the arrangement of MSS. treating of particular subjects",
     "consulta": "Suggestions for the arrangement of MSS. treating of particular subjects",
     "pasajes": 4
    },
    {
     "visible": "The plan of the book on painting",
     "consulta": "The plan of the book on painting",
     "pasajes": 4
    },
    {
     "visible": "Differences of perception by one eye and by both eyes",
     "consulta": "Differences of perception by one eye and by both eyes",
     "pasajes": 4
    },
    {
     "visible": "The function of the eye",
     "consulta": "The function of the eye",
     "pasajes": 3
    },
    {
     "visible": "Necessity of theoretical knowledge",
     "consulta": "Necessity of theoretical knowledge",
     "pasajes": 2
    },
    {
     "visible": "The author's intention to publish his MSS",
     "consulta": "The author's intention to publish his MSS",
     "pasajes": 1
    },
    {
     "visible": "The preparation of the MSS. for publication",
     "consulta": "The preparation of the MSS. for publication",
     "pasajes": 1
    },
    {
     "visible": "Admonition to readers",
     "consulta": "Admonition to readers",
     "pasajes": 1
    },
    {
     "visible": "The disorder in the MSS",
     "consulta": "The disorder in the MSS",
     "pasajes": 1
    },
    {
     "visible": "The use of the book on painting",
     "consulta": "The use of the book on painting",
     "pasajes": 1
    },
    {
     "visible": "Variability of the eye",
     "consulta": "Variability of the eye",
     "pasajes": 1
    },
    {
     "visible": "Focus of sight",
     "consulta": "Focus of sight",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Notes on sculpture",
   "glosa": "Casting bronze, and the two horse monuments he designed",
   "pasajes": 31,
   "temas": [
    {
     "visible": "On bronze casting generally",
     "consulta": "On bronze casting generally (731-740)",
     "pasajes": 10
    },
    {
     "visible": "The project of the Trivulzio monument",
     "consulta": "The project of the Trivulzio monument",
     "pasajes": 8
    },
    {
     "visible": "Occasional references to the Sforza monument",
     "consulta": "Occasional references to the Sforza monument (719-724)",
     "pasajes": 5
    },
    {
     "visible": "Notes on the casting of the Sforza monument",
     "consulta": "Notes on the casting of the Sforza monument (710-715)",
     "pasajes": 4
    },
    {
     "visible": "The notes on Sculpture",
     "consulta": "The notes on Sculpture",
     "pasajes": 2
    },
    {
     "visible": "Degree—point—minute—minim",
     "consulta": "Degree—point—minute—minim",
     "pasajes": 1
    },
    {
     "visible": "Messer Galeazzo's big genet",
     "consulta": "Messer Galeazzo's big genet",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Writings on architecture",
   "glosa": "Arches, beams, foundations, and why walls crack",
   "pasajes": 30,
   "temas": [
    {
     "visible": "On the nature of the arch",
     "consulta": "ON THE NATURE OF THE ARCH",
     "pasajes": 14
    },
    {
     "visible": "On fissures in walls",
     "consulta": "ON FISSURES IN WALLS",
     "pasajes": 7
    },
    {
     "visible": "On foundations, the nature of the ground and supports",
     "consulta": "ON FOUNDATIONS, THE NATURE OF THE GROUND AND SUPPORTS",
     "pasajes": 4
    },
    {
     "visible": "On the resistance of beams",
     "consulta": "ON THE RESISTANCE OF BEAMS",
     "pasajes": 3
    },
    {
     "visible": "On fissures in niches",
     "consulta": "ON FISSURES IN NICHES",
     "pasajes": 2
    }
   ]
  },
  {
   "seccion": "Studies and sketches for pictures",
   "glosa": "Notes for the Last Supper, the battle of Anghiari, and allegories",
   "pasajes": 28,
   "temas": [
    {
     "visible": "Mottoes and Emblems",
     "consulta": "Mottoes and Emblems",
     "pasajes": 9
    },
    {
     "visible": "Allegorical representations",
     "consulta": "Allegorical representations",
     "pasajes": 5
    },
    {
     "visible": "Notes on the Last Supper",
     "consulta": "Notes on the Last Supper",
     "pasajes": 3
    },
    {
     "visible": "Allegorical representations referring to the duke of Milan",
     "consulta": "Allegorical representations referring to the duke of Milan",
     "pasajes": 3
    },
    {
     "visible": "On the battle of Anghiari",
     "consulta": "On the battle of Anghiari",
     "pasajes": 2
    },
    {
     "visible": "Ornaments and Decorations for feasts",
     "consulta": "Ornaments and Decorations for feasts (703-705)",
     "pasajes": 2
    },
    {
     "visible": "On pictures of the Madonna",
     "consulta": "On pictures of the Madonna",
     "pasajes": 1
    },
    {
     "visible": "Bernardo di Bandino's portrait",
     "consulta": "Bernardo di Bandino's portrait",
     "pasajes": 1
    },
    {
     "visible": "Arrangement of a picture",
     "consulta": "Arrangement of a picture",
     "pasajes": 1
    },
    {
     "visible": "List of drawings",
     "consulta": "List of drawings",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Architectural designs",
   "glosa": "Plans for temples, stairs, stables and festival sets",
   "pasajes": 26,
   "temas": [
    {
     "visible": "Architectural Designs",
     "consulta": "Architectural Designs",
     "pasajes": 11
    },
    {
     "visible": "General observations on architecture",
     "consulta": "A. General Observations._",
     "pasajes": 6
    },
    {
     "visible": "Decorations for feasts",
     "consulta": "Decorations for feasts",
     "pasajes": 6
    },
    {
     "visible": "Description of an unidentified temple",
     "consulta": "G. Description of an unknown Temple",
     "pasajes": 2
    },
    {
     "visible": "On the dispositions of a stable",
     "consulta": "On the dispositions of a stable",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Theory of colours",
   "glosa": "How colours affect one another, and what happens to them in shadow",
   "pasajes": 25,
   "temas": [
    {
     "visible": "The reciprocal effects of colours on objects placed opposite each other",
     "consulta": "THEORY OF COLOURS The reciprocal effects of colours on objects placed opposite each other",
     "pasajes": 9
    },
    {
     "visible": "On the reflection of colours",
     "consulta": "On the reflection of colours",
     "pasajes": 3
    },
    {
     "visible": "On the use of dark and light colours in painting",
     "consulta": "On the use of dark and light colours in painting",
     "pasajes": 3
    },
    {
     "visible": "The effect of colours in the camera obscura",
     "consulta": "The effect of colours in the camera obscura",
     "pasajes": 2
    },
    {
     "visible": "On the colours of derived shadows",
     "consulta": "On the colours of derived shadows",
     "pasajes": 2
    },
    {
     "visible": "On gradations in the depth of colours",
     "consulta": "On gradations in the depth of colours",
     "pasajes": 2
    },
    {
     "visible": "On the colours of the rainbow",
     "consulta": "On the colours of the rainbow",
     "pasajes": 2
    },
    {
     "visible": "Combination of different colours in cast shadows",
     "consulta": "Combination of different colours in cast shadows",
     "pasajes": 1
    },
    {
     "visible": "On the nature of colours",
     "consulta": "On the nature of colours",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Perspective of colour",
   "glosa": "Why distance looks blue: the colour of the air",
   "pasajes": 20,
   "temas": [
    {
     "visible": "On the colour of the atmosphere",
     "consulta": "On the colour of the atmosphere",
     "pasajes": 9
    },
    {
     "visible": "General rules of the perspective of colour",
     "consulta": "PERSPECTIVE OF General rules",
     "pasajes": 3
    },
    {
     "visible": "The rules of aerial perspective",
     "consulta": "The rules of aerial perspective",
     "pasajes": 3
    },
    {
     "visible": "On the relative density of the atmosphere",
     "consulta": "On the relative density of the atmosphere",
     "pasajes": 2
    },
    {
     "visible": "An exceptional case",
     "consulta": "An exceptional case",
     "pasajes": 1
    },
    {
     "visible": "An experiment",
     "consulta": "An experiment",
     "pasajes": 1
    },
    {
     "visible": "How the perspective of colour is applied",
     "consulta": "The practice of the Prospettiva de' colori",
     "pasajes": 1
    }
   ]
  },
  {
   "seccion": "Naval warfare, machines and music",
   "glosa": "Flying machines, breathing underwater, and instruments",
   "pasajes": 17,
   "temas": [
    {
     "visible": "On Flying machines",
     "consulta": "On Flying machines (1122-1126)",
     "pasajes": 5
    },
    {
     "visible": "Of Music",
     "consulta": "Of Music (1129. 1130)",
     "pasajes": 3
    },
    {
     "visible": "On naval warfare",
     "consulta": "On naval warfare (1115. 1116)",
     "pasajes": 2
    },
    {
     "visible": "His notebooks and those of Vitruvius and Alberti",
     "consulta": "The ship's logs of Vitruvius, of Alberti and of Leonardo",
     "pasajes": 1
    },
    {
     "visible": "Methods of staying and moving in water",
     "consulta": "Methods of staying and moving in water",
     "pasajes": 1
    },
    {
     "visible": "The use of swimming belts",
     "consulta": "The use of swimming belts",
     "pasajes": 1
    },
    {
     "visible": "On the gravity of water",
     "consulta": "On the gravity of water",
     "pasajes": 1
    },
    {
     "visible": "Diving apparatus and Skating",
     "consulta": "Diving apparatus and Skating (1119-1121)",
     "pasajes": 1
    },
    {
     "visible": "Of mining",
     "consulta": "Of mining",
     "pasajes": 1
    },
    {
     "visible": "Of Greek fire",
     "consulta": "Of Greek fire",
     "pasajes": 1
    }
   ]
  }
 ]
};
