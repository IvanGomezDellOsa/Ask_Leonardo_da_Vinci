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
  /**
   * Carpeta de origen dentro de `contenido biblioteca/`, y de destino dentro
   * de `public/biblioteca/`. Las dos faltan en el volumen de texto, que no
   * tiene láminas que optimizar: por eso son opcionales y por eso existe
   * `esDeLaminas()` — el pipeline de imágenes tiene que saltearlo, y que el
   * tipo lo obligue a decidirlo es mejor que un `if` que alguien puede omitir.
   */
  carpeta?: string;
  destino?: string;
  titulo: Bilingue;
  /**
   * EL TITULO ABREVIADO DEL LOMO, cuando el largo no entra.
   *
   * El lomo escribe en vertical dentro de un solo entrepaño —entre el segundo
   * nervio y el tercero— y ahí caben unos veinte caracteres a cuerpo legible.
   * Un libro de verdad hace exactamente esto: la tapa lleva el título entero y
   * el lomo lleva la forma corta, porque el lomo tiene el ancho que tiene.
   * Si falta, el lomo usa `titulo`.
   */
  tituloLomo?: Bilingue;
  /** El cuero del tomo. Ver §EL CUERO. */
  tinte: Tinte;
  laminas: Lamina[];
  /**
   * Sólo el volumen de texto (D-155). El cuerpo no vive acá: se baja de
   * `public/biblioteca/<archivo>` recién cuando se abre el tomo, igual que las
   * láminas. Acá queda lo que hace falta para pintarlo cerrado.
   */
  texto?: {
    /** El JSON generado, dentro de `public/biblioteca/`. */
    archivo: string;
    /**
     * Cuántos capítulos tiene, POR IDIOMA — y son distintos, porque son dos
     * artículos escritos por gente distinta y no una traducción.
     *
     * Un solo número acá lo destapó la primera corrida contra el navegador: el
     * lomo decía «4 chapters» con el sitio en inglés y el índice de abajo
     * listaba ocho. Es otra vez el patrón de 00-README §Las lecciones, 1 —un
     * componente informando sobre una dimensión distinta de la que gobierna lo
     * que se ve— y el número era perfectamente plausible: es el correcto, del
     * artículo equivocado.
     *
     * Se escriben a mano y `npm run wikipedia` FALLA si alguno no coincide con
     * lo que trajo el artículo.
     */
    capitulos: Bilingue<number>;
  };
};

export type LibroId = "anatomia" | "maquinas" | "obras" | "dibujos" | "wikipedia";

/**
 * EL CUERO DE UN TOMO, EN TRES NUMEROS.
 *
 * `luz` es explícita y no derivada del `hue`. Antes salía de una cuenta
 * —`30 + (hue - 28) * 0.105`— y esa cuenta es exactamente lo que hacía que los
 * cuatro tomos se leyeran como el mismo libro teñido cuatro veces: con los
 * hues apretados en la ventana cálida, las luces caían todas entre 30% y 36%.
 * Una estantería de verdad no varía de tono, varía de MATERIAL: hay un becerro
 * casi negro al lado de un tafilete rojo al lado de una badana color miel. Eso
 * se dice moviendo la luz y el croma, no el hue.
 */
export type Tinte = { hue: number; croma: number; luz: number };

/** Un volumen con láminas en disco: los que pasa `npm run biblioteca`. */
export type LibroLaminas = Libro & { carpeta: string; destino: string };

/** Si este tomo tiene láminas que optimizar. Ver el comentario de `carpeta`. */
export const esDeLaminas = (l: Libro): l is LibroLaminas =>
  l.carpeta !== undefined && l.destino !== undefined;

/**
 * Lo mismo en los dos idiomas. Casi siempre es texto —de ahí el `string` por
 * defecto—, pero el volumen de contexto necesita un par de números: los dos
 * artículos de Wikipedia no tienen la misma cantidad de capítulos.
 */
export type Bilingue<T = string> = { es: T; en: T };

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
 * y tipografía sobre estos tres números — es la lección de §4.7 del doc 19
 * («lo procedural sembrado gana a los assets»), y acá no es una preferencia
 * estética: la primera carga del sitio ya cuesta ~133 MB por el modelo de
 * embeddings, así que cinco portadas en PNG serían cinco megas que compiten
 * con eso.
 *
 * LOS TITULOS DICEN LO QUE HAY ADENTRO, Y NADA MAS (D-155).
 *
 * «Obras destacadas» afirmaba algo —que son las destacadas— que nadie midió;
 * «Dibujos» nombraba ocho hojas de trabajo con la misma palabra que ya
 * describía a dos de las nueve láminas del tomo vecino (el Vitruvio y el
 * rostro de muchacha son dibujos y viven en Obras); y «Máquinas y mecanismos»
 * llamaba máquinas a cuatro folios que son piezas sueltas —un trinquete, unos
 * resortes, una batería de husillos, unas vigas telescópicas—, con dos
 * palabras casi sinónimas para decir una sola cosa.
 *
 * Quedaron cuatro nombres de una palabra, sin adjetivos y sin solapamiento:
 *
 *   Anatomía   el cuerpo
 *   Mecánica   las piezas de máquina
 *   Obras      lo que existe como obra terminada, pintada o dibujada
 *   Estudios   la hoja de trabajo: lo que dibujó para pensar
 *
 * Obras / Estudios es el corte real —obra frente a apunte— y es el par que
 * usa cualquier catálogo razonado. Además caben: el lomo escribe el título en
 * vertical dentro de un solo entrepaño, y «Máquinas y mecanismos» no entraba
 * ahí sin recortarse.
 *
 * LOS CUEROS. Cinco materiales distintos, no cinco tintes del mismo. Ver
 * `Tinte`: la luz manda más que el hue. El único que se sale de la ventana
 * cálida del hero (40-85) es el oliva de Estudios, y se sale a propósito —una
 * estantería toda del mismo tono se lee como un render—; con croma 0.045 no
 * llega a leerse verde, llega a leerse encuadernación vieja. Volverlo a la
 * ventana es cambiar un número.
 */
export const BIBLIOTECA: Libro[] = [
  {
    id: "anatomia",
    carpeta: "Anatomia",
    destino: "anatomia",
    titulo: { es: "Anatomía", en: "Anatomy" },
    // Tafilete rojo oscuro: el tomo más saturado de la fila.
    tinte: { hue: 32, croma: 0.082, luz: 30 },
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
    titulo: { es: "Mecánica", en: "Mechanics" },
    // Becerro casi negro: el ancla oscura de la fila.
    tinte: { hue: 58, croma: 0.028, luz: 24 },
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
    titulo: { es: "Obras", en: "Works" },
    // Badana color miel: el único tomo claro, y el único con tinta oscura.
    tinte: { hue: 74, croma: 0.068, luz: 52 },
    laminas: [
      {
        slug: "mona-lisa",
        origen: "Mona Lisa.webp",
        titulo: { es: "La Gioconda", en: "Mona Lisa" },
        nota: {
          es: "Óleo sobre tabla de álamo, 77 × 53 cm, pintado entre 1503 y 1516. El esfumado disuelve los contornos en capas finísimas, y es lo que vuelve la expresión imposible de fijar. Museo del Louvre, París.",
          en: "Oil on poplar panel, 77 × 53 cm, painted between 1503 and 1516. The sfumato dissolves the outlines into the faintest layers, and that is what makes the expression impossible to pin down. Musée du Louvre, Paris.",
        },
      },
      {
        slug: "ultima-cena",
        origen: "Ultima cena.webp",
        titulo: { es: "La última cena", en: "The Last Supper" },
        nota: {
          es: "Mural de 4,6 × 8,8 m en el refectorio de Santa Maria delle Grazie, Milán, pintado entre 1495 y 1498. Leonardo trabajó al temple sobre pared seca en vez de al fresco: por eso empezó a descascararse en vida suya.",
          en: "A 4.6 × 8.8 m wall painting in the refectory of Santa Maria delle Grazie, Milan, made between 1495 and 1498. Leonardo worked in tempera on a dry wall instead of true fresco, which is why it began to flake in his own lifetime.",
        },
      },
      {
        slug: "dama-del-armino",
        origen: "La dama del armiño.webp",
        titulo: { es: "La dama del armiño", en: "Lady with an Ermine" },
        nota: {
          es: "Óleo sobre nogal de 54 × 39 cm, hacia 1489-1491. Se la identifica con Cecilia Gallerani, de la corte de Ludovico Sforza en Milán. Museo Czartoryski, Cracovia.",
          en: "Oil on walnut, 54 × 39 cm, around 1489–1491. The sitter is identified as Cecilia Gallerani, of Ludovico Sforza's court in Milan. Czartoryski Museum, Kraków.",
        },
      },
      {
        slug: "ginevra-de-benci",
        origen: "Ginevra de Benci.webp",
        titulo: { es: "Ginevra de' Benci", en: "Ginevra de' Benci" },
        nota: {
          es: "Óleo y temple sobre álamo de 38,8 × 36,7 cm, pintado en Florencia entre 1474 y 1478. Es el único cuadro de Leonardo expuesto al público en América. National Gallery of Art, Washington.",
          en: "Oil and tempera on poplar, 38.8 × 36.7 cm, painted in Florence between 1474 and 1478. It is the only Leonardo painting on public view in the Americas. National Gallery of Art, Washington.",
        },
      },
      {
        slug: "virgen-de-las-rocas",
        origen: "Virgen de las rocas.webp",
        titulo: { es: "La Virgen de las rocas", en: "Virgin of the Rocks" },
        nota: {
          es: "Óleo sobre tabla trasladado a lienzo, 199 × 122 cm, hacia 1483-1493. Hay dos versiones del cuadro: ésta es la del Louvre —el ángel señala a Juan y nadie lleva aureola—; la otra está en la National Gallery de Londres.",
          en: "Oil on panel transferred to canvas, 199 × 122 cm, around 1483–1493. There are two versions of the painting: this is the Louvre one — the angel points at John and no one wears a halo — while the other is in the National Gallery, London.",
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
          es: "Óleo sobre tabla de 168 × 112 cm. Leonardo lo empezó hacia 1501 y lo siguió trabajando hasta el final de su vida sin darlo por terminado. Tres generaciones encajadas en una sola pirámide. Museo del Louvre, París.",
          en: "Oil on panel, 168 × 112 cm. Leonardo began it around 1501 and kept working on it until the end of his life without ever calling it finished. Three generations locked into a single pyramid. Musée du Louvre, Paris.",
        },
      },
      {
        slug: "hombre-de-vitruvio",
        origen: "Hombre de vitruvio.webp",
        titulo: { es: "El hombre de Vitruvio", en: "Vitruvian Man" },
        nota: {
          es: "Pluma y tinta parda sobre papel, 34,4 × 24,5 cm, hacia 1490. Ilustra las proporciones del cuerpo que describió el arquitecto romano Vitruvio, con las notas escritas en espejo. Gallerie dell'Accademia, Venecia, donde casi no se expone por lo frágil que es.",
          en: "Pen and brown ink on paper, 34.4 × 24.5 cm, around 1490. It illustrates the bodily proportions described by the Roman architect Vitruvius, with the notes written in mirror script. Gallerie dell'Accademia, Venice, where it is rarely shown because of its fragility.",
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
          es: "Tierra, ámbar y albayalde sobre tabla, 24,7 × 21 cm, hacia 1506-1508. Quedó sin terminar: el rostro está modelado y el pelo apenas esbozado alrededor. Galleria Nazionale, Parma.",
          en: "Earth, amber and white lead on panel, 24.7 × 21 cm, around 1506–1508. It was left unfinished: the face is modelled and the hair barely sketched around it. Galleria Nazionale, Parma.",
        },
      },
      {
        slug: "volto-di-fanciulla",
        origen: "volto-fanciulla.jpg",
        titulo: { es: "Rostro de muchacha", en: "Head of a Young Girl" },
        nota: {
          es: "Punta de plata realzada con blanco sobre papel preparado, 18,1 × 15,9 cm, hacia 1483-1485. Es el estudio para el ángel de la Virgen de las rocas, que también está en esta sala. Biblioteca Reale, Turín.",
          en: "Silverpoint heightened with white on prepared paper, 18.1 × 15.9 cm, around 1483–1485. It is the study for the angel in the Virgin of the Rocks, which is also in this room. Biblioteca Reale, Turin.",
        },
      },
    ],
  },
  {
    id: "dibujos",
    carpeta: "Dibujos",
    destino: "dibujos",
    titulo: { es: "Estudios", en: "Studies" },
    // Oliva apagado: el que rompe la fila de marrones. Ver §LOS CUEROS.
    tinte: { hue: 108, croma: 0.045, luz: 34 },
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
        /*
         * El archivo llegó como «Cesar Borgia.jpg» y el slug repetía esa
         * atribución en una URL que se ve en el DOM. Son tres cabezas de
         * hombres barbados y mayores; quien las dibujó no las nombró. Nombrar
         * al retratado en la ruta del archivo es la misma afirmación sin
         * respaldo que la hoja evita en pantalla, así que el slug dice lo que
         * se ve y el nombre original queda en `origen`, que es un dato de
         * archivo y no una afirmación.
         */
        slug: "tres-cabezas",
        origen: "Cesar Borgia.jpg",
        titulo: { es: "Tres cabezas barbadas", en: "Three bearded heads" },
        nota: {
          es: "Tres cabezas de hombres barbados a sanguina sobre una misma hoja: dos de perfil —una con gorro— y la tercera casi de frente.",
          en: "Three bearded men's heads in red chalk on a single sheet: two in profile — one wearing a cap — and the third nearly frontal.",
        },
      },
    ],
  },
  /*
   * EL VOLUMEN DE CONTEXTO (D-155). El único que no es de Leonardo.
   *
   * QUE PROBLEMA RESUELVE. El corpus son los cuadernos y nada más (D-018), así
   * que la pregunta más obvia que va a llegar —quién fue este tipo— es
   * exactamente la que el chat NO contesta, y contesta bien al abstenerse. Ese
   * hueco no se tapa aflojando la compuerta: se tapa poniendo la biografía en
   * otro lado, donde se lea como lo que es. La biblioteca ya era ese otro lado.
   *
   * POR QUE NO ENSUCIA LA TESIS. No entra al corpus, no se indexa, no se
   * recupera y `responder()` no lo ve. Es un tomo de la estantería, como las
   * láminas: material que se mira, no material que Leonardo cita. Y el tomo lo
   * dice de dos maneras: el aviso de la portadilla, que es la primera hoja que
   * se ve, y el cuero —es el único tomo frío de una fila de cueros cálidos—.
   * El riesgo acá no es técnico: es que alguien crea que el chat lee de una
   * enciclopedia.
   *
   * POR QUE NO SE LLAMA «WIKIPEDIA» (D-156). Se llamó así un rato, con el
   * argumento de que el nombre de la fuente en el lomo es la advertencia más
   * barata que existe. Pero un lomo que dice «Wikipedia» en una estantería de
   * Leonardo nombra al editor y no al contenido, que es lo único que hacen los
   * otros cuatro. El título dice de qué trata el tomo; la procedencia la dicen
   * la portadilla y el índice, que es donde corresponde.
   *
   * LA LICENCIA NO ES LA DEL REPO. El texto es CC BY-SA 4.0 y el repo es MIT.
   * El alcance está en `LICENSE-CORPUS.md` y la atribución viaja DENTRO del
   * JSON generado —autor, revisión, fecha y enlace— para que no haya forma de
   * servir el texto sin ella.
   */
  {
    id: "wikipedia",
    titulo: {
      es: "Sobre Leonardo (Vida y Obras)",
      en: "About Leonardo (Life and Works)",
    },
    /*
     * El lomo lleva la forma corta. El paréntesis es lo primero que sobra
     * cuando hay que elegir: dice lo mismo que el título entero ya dice más
     * abajo, en la tapa, donde sí hay lugar.
     */
    tituloLomo: { es: "Sobre Leonardo", en: "About Leonardo" },
    /*
     * TELA GRIS AZULADA, Y ES EL UNICO FRIO DE LA FILA.
     *
     * Los cuatro tomos de Leonardo son cueros cálidos sobre un estante cálido.
     * Este es de otro material y de otra temperatura, y esa diferencia hace
     * sola el trabajo que si no habría que hacer con un cartel: se ve, antes
     * de leer nada, que este tomo no pertenece a la misma mano.
     */
    tinte: { hue: 250, croma: 0.032, luz: 33 },
    laminas: [],
    texto: { archivo: "wikipedia.json", capitulos: { es: 4, en: 8 } },
  },
];

/*
 * `LAMINAS` y `rutaLamina()` vivían acá y no los usaba nadie: `Biblioteca.tsx`
 * arma sus rutas con `rutaHoja`/`rutaIndice`. Se fueron en D-155 en vez de
 * arrastrarlos al tipo nuevo — `rutaLamina` habría necesitado un `destino` que
 * el volumen de texto no tiene, y eso es adaptar código muerto.
 */
