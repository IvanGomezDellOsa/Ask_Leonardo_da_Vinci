/**
 * EL CATALOGO DE LA BIBLIOTECA — fuente única.
 *
 * De acá salen, todos a la vez: el orden de los libros en la estantería, el
 * arte de cada lomo, el nombre de archivo de cada lámina, los títulos en los
 * dos idiomas, las etiquetas ARIA y el índice de láminas. Es el patrón de `docs/19-bocetos-biblioteca.md` §4.8: un objeto
 * por entrada alimenta layout, arte, accesibilidad y detalle, y agregar una
 * lámina es agregar una línea acá y nada más.
 *
 * ESTE ARCHIVO SE ESCRIBE A MANO, al revés que `portada.ts`. La diferencia es
 * de dónde sale el contenido: las respuestas de portada salen del pipeline y
 * por eso D-112 prohíbe tocarlas; las láminas son archivos que trajo el dueño
 * del proyecto, y su título y su descripción son datos editoriales que ningún
 * pipeline puede inferir. Lo que sí es derivado —el ancho, el alto y el peso
 * de cada webp— lo estampa `npm run biblioteca` en `medidas.json`.
 */

/** Un libro de la estantería. */
export type Libro = {
  id: LibroId;
  /** Carpeta de origen dentro de `contenido biblioteca/`. */
  carpeta: string;
  /** Carpeta de destino dentro de `public/biblioteca/`. */
  destino: string;
  titulo: Bilingue;
  /** La línea que se lee bajo el título cuando el libro está elegido. */
  bajada: Bilingue;
  /** El color del lomo y de la tapa. Un solo hue por libro; ver §Tapas. */
  tinte: { hue: number; croma: number };
  laminas: Lamina[];
};

export type LibroId = "anatomia" | "maquinas" | "obras" | "dibujos";

export type Bilingue = { es: string; en: string };

/** Una lámina: una hoja del libro. */
export type Lamina = {
  /** Nombre de archivo sin extensión, ya normalizado (ASCII, kebab-case). */
  slug: string;
  /** El archivo tal como llegó, dentro de la carpeta de origen. */
  origen: string;
  /**
   * ⚠ ETIQUETA INTERNA — NO SE MUESTRA EN LA INTERFAZ.
   *
   * No tenemos el título exacto de varias de estas láminas, y poner uno
   * aproximado sobre un dibujo de Leonardo es exactamente el tipo de
   * afirmación sin respaldo que este proyecto existe para no hacer. Así que
   * la biblioteca no titula las hojas: se ven los dibujos, y punto.
   *
   * Este campo queda porque hace falta igual — es el `alt` de la imagen, el
   * texto que lee un lector de pantalla y el nombre con el que se habla del
   * archivo — pero no se pinta en pantalla. Si algún día se verifican los
   * títulos uno por uno, esa es otra decisión y va a `09-decisiones.md`.
   */
  titulo: Bilingue;
  /**
   * Qué se ve en la hoja. DESCRIBE, NO INTERPRETA NI IDENTIFICA: lo que se
   * puede afirmar mirando el dibujo y nada más. Sin nombres de retratados,
   * sin «el primero en», sin para-qué-servía. Es lo que va como descripción
   * accesible de la imagen.
   */
  nota: Bilingue;
  /**
   * Sólo en «Máquinas y mecanismos»: el video que muestra el mecanismo en
   * movimiento. La numeración del bloc de notas del dueño (1-4) es la que
   * ata cada video a su lámina.
   */
  video?: string;
};

/**
 * LAS TAPAS NO SON IMAGENES. Cada lomo y cada tapa se dibujan con gradientes
 * y tipografía sobre este par de números — es la lección de §4.7 del doc 19
 * («lo procedural sembrado gana a los assets»), y acá no es una preferencia
 * estética: la primera carga del sitio ya cuesta ~133 MB por el modelo de
 * embeddings, así que tres portadas en PNG serían tres megas que compiten con
 * eso. Los hues son los tres del ambiente cálido del hero (40-85).
 */
export const BIBLIOTECA: Libro[] = [
  {
    id: "anatomia",
    carpeta: "Anatomia",
    destino: "anatomia",
    titulo: { es: "Anatomía", en: "Anatomy" },
    bajada: {
      es: "El cuerpo abierto y dibujado desde adentro.",
      en: "The body opened and drawn from within.",
    },
    tinte: { hue: 28, croma: 0.055 },
    laminas: [
      {
        slug: "craneo",
        origen: "Craneo.jpg",
        titulo: { es: "Estudios del cráneo", en: "Studies of the skull" },
        nota: {
          es: "El cráneo seccionado en dos planos, con las cavidades y los senos frontales trazados a la vista.",
          en: "The skull sectioned on two planes, with the cavities and frontal sinuses drawn open.",
        },
      },
      {
        slug: "feto",
        origen: "Feto.png",
        titulo: {
          es: "Estudios del feto en el útero",
          en: "Studies of the fetus in the womb",
        },
        nota: {
          es: "El feto acurrucado dentro del útero abierto, rodeado de estudios menores de la misma posición.",
          en: "The fetus curled inside the opened womb, ringed by smaller studies of the same position.",
        },
      },
      {
        slug: "sistema-cardiovascular",
        origen: "Leonardo, Cardiovascular system of a woman.jpg.webp",
        titulo: {
          es: "Sistema cardiovascular de una mujer",
          en: "Cardiovascular system of a woman",
        },
        nota: {
          es: "El árbol de venas y arterias dibujado sobre la figura entera, con los órganos internos situados en su lugar.",
          en: "The tree of veins and arteries drawn over the whole figure, with the internal organs set in place.",
        },
      },
      {
        slug: "columna-vertebral",
        origen: "Leonardo, spines.png.webp",
        titulo: {
          es: "Estudios de la columna vertebral",
          en: "Studies of the spine",
        },
        nota: {
          es: "La columna entera y sus vértebras vistas desde varios ángulos, y las piezas sueltas dibujadas aparte.",
          en: "The whole spine and its vertebrae seen from several angles, with the separate pieces drawn apart.",
        },
      },
      {
        slug: "corazon",
        origen: "Leonardo, studies of the heart.png.webp",
        titulo: { es: "Estudios del corazón", en: "Studies of the heart" },
        nota: {
          es: "El corazón desarmado en sus cámaras y válvulas, con los vasos que entran y salen dibujados por separado.",
          en: "The heart taken apart into its chambers and valves, with the entering and leaving vessels drawn separately.",
        },
      },
      {
        slug: "pie-de-oso",
        origen: "Pie de oso.png",
        titulo: { es: "Pie de oso", en: "Foot of a bear" },
        nota: {
          es: "La pata de un animal desollada hasta los tendones, con el trazado de cada tendón sobre los huesos.",
          en: "An animal paw flayed to the tendons, each tendon traced over the bones.",
        },
      },
    ],
  },
  {
    id: "maquinas",
    carpeta: "Máquinas y mecanismos",
    destino: "maquinas",
    titulo: { es: "Máquinas y mecanismos", en: "Machines and mechanisms" },
    bajada: {
      es: "Los folios mecánicos, y el mismo mecanismo andando.",
      en: "The mechanical folios, and the same mechanism running.",
    },
    tinte: { hue: 62, croma: 0.05 },
    laminas: [
      {
        slug: "mecanismo-01",
        origen: "1.png",
        titulo: {
          es: "Rueda de trinquete con contrapeso",
          en: "Ratchet wheel with counterweight",
        },
        nota: {
          es: "Una rueda dentada de sierra retenida por un gatillo, con un peso colgado del eje que la mantiene cargada.",
          en: "A saw-toothed wheel held by a pawl, with a weight hung from the axle keeping it loaded.",
        },
        video: "B0rM2HcUs0I",
      },
      {
        slug: "mecanismo-02",
        origen: "2.png",
        titulo: {
          es: "Mecanismo de resorte y palancas",
          en: "Spring-and-lever mechanism",
        },
        nota: {
          es: "Un tambor erizado de pivotes movido por brazos con contrapesos, con los resortes helicoidales dibujados aparte abajo.",
          en: "A drum bristling with pivots driven by counterweighted arms, with the helical springs drawn separately below.",
        },
        video: "uvPvD4kjo3k",
      },
      {
        slug: "mecanismo-03",
        origen: "3.png",
        titulo: { es: "Batería de gatos de tornillo", en: "Battery of screw jacks" },
        nota: {
          es: "Seis husillos roscados levantados a la vez por una corona dentada, y abajo la misma máquina vista de frente.",
          en: "Six threaded screws raised at once by a toothed crown, and below, the same machine seen head-on.",
        },
        video: "KRwXLglnM4E",
      },
      {
        slug: "mecanismo-04",
        origen: "4.png",
        titulo: { es: "Vigas telescópicas", en: "Telescoping beams" },
        nota: {
          es: "Dos estudios de vigas que se extienden deslizándose una dentro de otra, con el texto del folio entre medio.",
          en: "Two studies of beams that extend by sliding one inside the other, with the folio's text between them.",
        },
        video: "rv3CUcAVNuI",
      },
    ],
  },
  {
    id: "obras",
    carpeta: "Pinturas",
    destino: "obras",
    titulo: { es: "Obras destacadas", en: "Selected works" },
    bajada: {
      es: "Lo que terminó, y lo que dejó a medio terminar.",
      en: "What he finished, and what he left half-finished.",
    },
    tinte: { hue: 85, croma: 0.045 },
    laminas: [
      {
        slug: "mona-lisa",
        origen: "Mona Lisa.webp",
        titulo: { es: "La Gioconda", en: "Mona Lisa" },
        nota: {
          es: "El retrato de medio cuerpo con las manos cruzadas, el paisaje de puentes y caminos detrás y el esfumado que borra los contornos.",
          en: "The half-length portrait with folded hands, the landscape of bridges and roads behind, and the sfumato that dissolves the outlines.",
        },
      },
      {
        slug: "ultima-cena",
        origen: "Ultima cena.webp",
        titulo: { es: "La última cena", en: "The Last Supper" },
        nota: {
          es: "Los doce repartidos en cuatro grupos de tres, con las líneas de la sala convergiendo en la cabeza de Cristo.",
          en: "The twelve arranged in four groups of three, with the room's lines converging on Christ's head.",
        },
      },
      {
        slug: "dama-del-armino",
        origen: "La dama del armiño.webp",
        titulo: { es: "La dama del armiño", en: "Lady with an Ermine" },
        nota: {
          es: "Una mujer joven girando el torso hacia un lado y la mirada hacia el otro, con el armiño que sostiene siguiendo el mismo giro.",
          en: "A young woman turning her torso one way and her gaze the other, the ermine she holds following the same turn.",
        },
      },
      {
        slug: "ginevra-de-benci",
        origen: "Ginevra de Benci.webp",
        titulo: { es: "Ginevra de' Benci", en: "Ginevra de' Benci" },
        nota: {
          es: "El retrato recortado contra una mata de enebro, con el paisaje de agua y cielo detrás.",
          en: "The portrait set against a juniper bush, with the water and sky landscape behind.",
        },
      },
      {
        slug: "virgen-de-las-rocas",
        origen: "Virgen de las rocas.webp",
        titulo: { es: "La Virgen de las rocas", en: "Virgin of the Rocks" },
        nota: {
          es: "El grupo piramidal dentro de una gruta, con la luz entrando por las aberturas del fondo.",
          en: "The pyramidal group inside a grotto, with light entering through the openings behind.",
        },
      },
      {
        slug: "virgen-nino-santa-ana",
        origen: "La Virgen, el Niño Jesús y Santa Ana.webp",
        titulo: {
          es: "La Virgen, el Niño Jesús y Santa Ana",
          en: "The Virgin and Child with St. Anne",
        },
        nota: {
          es: "Tres generaciones encajadas en una sola figura piramidal: Ana sostiene a María, María se inclina hacia el Niño, el Niño abraza al cordero.",
          en: "Three generations locked into a single pyramidal figure: Anne holds Mary, Mary leans toward the Child, the Child grasps the lamb.",
        },
      },
      {
        slug: "hombre-de-vitruvio",
        origen: "Hombre de vitruvio.webp",
        titulo: { es: "El hombre de Vitruvio", en: "Vitruvian Man" },
        nota: {
          es: "La figura inscrita a la vez en el círculo y en el cuadrado, con las proporciones anotadas en espejo arriba y abajo.",
          en: "The figure inscribed in circle and square at once, the proportions noted in mirror-writing above and below.",
        },
      },
      {
        slug: "cabeza-de-mujer",
        origen: "Cabeza de una mujer.webp",
        titulo: {
          es: "Cabeza de una mujer (La Scapigliata)",
          en: "Head of a Woman (La Scapigliata)",
        },
        nota: {
          es: "El rostro terminado hasta el modelado y el pelo apenas esbozado alrededor: el cuadro quedó en ese estado.",
          en: "The face finished down to the modelling and the hair barely sketched around it: the panel was left in that state.",
        },
      },
      {
        slug: "volto-di-fanciulla",
        origen: "volto-fanciulla.jpg",
        titulo: { es: "Rostro de muchacha", en: "Head of a Young Girl" },
        nota: {
          es: "Estudio de una cabeza inclinada con los ojos bajos, trabajado a punta fina sobre papel preparado.",
          en: "A study of a tilted head with lowered eyes, worked in fine point on prepared paper.",
        },
      },
    ],
  },
  {
    id: "dibujos",
    carpeta: "Dibujos",
    destino: "dibujos",
    titulo: { es: "Dibujos", en: "Drawings" },
    bajada: {
      es: "La hoja suelta: lo que dibujaba para pensar.",
      en: "The loose sheet: what he drew in order to think.",
    },
    tinte: { hue: 46, croma: 0.05 },
    laminas: [
      {
        slug: "plano-de-ciudad",
        origen: "1.jpg",
        titulo: { es: "Plano de una ciudad", en: "Plan of a town" },
        nota: {
          es: "Una ciudad amurallada levantada en planta dentro de un círculo, con las manzanas coloreadas, el foso alrededor y el río serpenteando abajo.",
          en: "A walled town drawn in plan inside a circle, blocks washed in colour, the moat around it and the river winding below.",
        },
      },
      {
        slug: "cabeza-de-mujer-cabellera",
        origen: "2.jpg",
        titulo: { es: "Cabeza de mujer con la cabellera trenzada", en: "Head of a woman with braided hair" },
        nota: {
          es: "Una cabeza inclinada con los ojos bajos, y alrededor una cabellera de trenzas enrolladas y bucles sueltos trabajada mucho más que el rostro.",
          en: "A head tilted with lowered eyes, ringed by coiled braids and loose curls worked far further than the face itself.",
        },
      },
      {
        slug: "cabeza-en-perfil",
        origen: "3.jpg",
        titulo: { es: "Cabeza de muchacha de perfil", en: "Head of a young woman in profile" },
        nota: {
          es: "Un perfil de tres cuartos sobre papel azulado, modelado a tiza negra y blanca, con el pelo y el hombro apenas insinuados a línea.",
          en: "A three-quarter profile on blue-prepared paper, modelled in black and white chalk, hair and shoulder barely indicated in line.",
        },
      },
      {
        slug: "diluvio",
        origen: "4.jpg",
        titulo: { es: "Diluvio", en: "A deluge" },
        nota: {
          es: "Espirales de agua y viento cayendo sobre un valle, con bloques de roca desprendidos y arrastrados en la misma corriente.",
          en: "Spirals of water and wind falling on a valley, with blocks of rock torn loose and carried in the same current.",
        },
      },
      {
        slug: "hoja-de-estudios",
        origen: "5.jpg",
        titulo: { es: "Hoja de estudios", en: "Sheet of studies" },
        nota: {
          es: "Una hoja llena: una figura alada modelada a tiza, caballos encabritados, cuentas y figuras geométricas, y una máquina circular con sus soportes.",
          en: "A crowded sheet: a winged figure in chalk, rearing horses, sums and geometric figures, and a circular machine with its supports.",
        },
      },
      {
        slug: "rayos-y-perfil",
        origen: "6.jpg",
        titulo: { es: "Rayos convergentes y perfil", en: "Converging rays and a profile" },
        nota: {
          es: "Un haz de rectas que sale de un punto y va a dar contra un perfil masculino, rodeado de escritura en espejo y diagramas menores.",
          en: "A fan of straight lines leaving one point and striking a male profile, ringed by mirror writing and smaller diagrams.",
        },
      },
      {
        slug: "monumento-ecuestre",
        origen: "7.png",
        titulo: { es: "Estudios para un monumento ecuestre", en: "Studies for an equestrian monument" },
        nota: {
          es: "Un caballo encabritado con su jinete, repetido en varias versiones, y debajo tres pedestales con arcos y figuras al pie.",
          en: "A rearing horse and rider, repeated in several versions, and below three pedestals with arches and figures at their base.",
        },
      },
      {
        slug: "cesar-borgia",
        origen: "Cesar Borgia.jpg",
        titulo: { es: "Estudios de cabezas de perfil", en: "Profile head studies" },
        nota: {
          es: "Una hoja con varios estudios de cabezas masculinas de perfil, trazadas a lápiz sobre el mismo papel.",
          en: "A sheet of several male heads studied in profile, drawn in pencil on the same paper.",
        },
      },
    ],
  },
];

/** Todas las láminas, aplanadas — para índices y precarga. */
export const LAMINAS = BIBLIOTECA.flatMap((libro) =>
  libro.laminas.map((lamina) => ({ libro: libro.id, ...lamina })),
);

/** La ruta pública de una lámina ya optimizada. */
export const rutaLamina = (libro: Libro, lamina: Lamina, variante: "hoja" | "indice" = "hoja") =>
  `/biblioteca/${libro.destino}/${lamina.slug}${variante === "indice" ? "-indice" : ""}.webp`;
