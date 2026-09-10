/**
 * Genera el mapa de temas que alimenta la pregunta asistida del códice.
 *
 *   npm run mapa
 *
 * QUE PRODUCE. `src/data/mapa.ts`: las 22 secciones de Richter con una linea que
 * dice que hay adentro, y sus temas con dos textos cada uno —el que se ve y el
 * que se pregunta—, **en los dos idiomas**. Va bundleado y no en `public/`, por
 * lo mismo que la portada (D-132): sin red, sin espera y sin cuota.
 *
 * ══════════════════════════════════════════════════════════════════════
 * EL ROTULO QUE SE VE NO ES LA CONSULTA QUE SE MANDA.
 * ══════════════════════════════════════════════════════════════════════
 *
 * `visible` es un rotulo limpio, para leer. `consulta` es el titulo ORIGINAL de
 * Richter en el idioma del indice que se va a consultar.
 *
 * ⚠ NO SE PUEDE MANDAR EL ROTULO LIMPIO. `alcance.json` mide que el nombre de un
 * tema recupera sus propios pasajes en **345 de 375 casos**, y esa medicion se
 * hizo con los titulos ORIGINALES. Mandar otro texto la invalida entera.
 *
 * ⚠ Y NO SE PUEDE CRUZAR DE IDIOMA. La primera version generaba el mapa solo en
 * castellano (D-233) y el sitio en ingles mostraba secciones y temas
 * castellanos — y al clickear mandaba un titulo castellano al indice INGLES.
 * Eso es exactamente la busqueda cross-lingue que D-105 midio como mala.
 *
 * QUE SE LIMPIA. Medido: de 422 titulos castellanos, 291 ya estaban bien; 108 se
 * arreglan sacando el rango entre parentesis —"Fabulas sobre plantas
 * (1275-1279)" es una referencia cruzada de Richter—, ~24 bajando las mayusculas
 * y solo 9 hubo que rescribirlos a mano. El 90% es mecanico.
 *
 * ⚠ ABORTA SI APARECE UNA SECCION QUE NO ESTA EN LA TABLA, en vez de dejarla sin
 * nombre o sin descripcion. Una seccion nueva es una decision, no un caso limite.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

interface Chunk {
  id: string; richterTitle: string | null; section: string | null; voice: string;
  text: string; richterNos: number[];
}
type Idioma = "es" | "en";

/**
 * Los 22 nombres de seccion. La clave es como viene en el fuente de Gutenberg;
 * el valor, como se muestra. En ingles tambien se retoca: Richter escribe
 * "'Prospettiva de' colri' (Perspective of Colour)".
 */
const SECCION: Record<string, Record<Idioma, string>> = {
  "The Practice of Painting":
    { es: "La práctica de la pintura", en: "The practice of painting" },
  "Humorous Writings":
    { es: "Escritos humorísticos", en: "Humorous writings" },
  "Six books on Light and Shade":
    { es: "Seis libros sobre luz y sombra", en: "Light and shade" },
  "Miscellaneous Notes":
    { es: "Notas misceláneas", en: "Miscellaneous notes" },
  "Topographical Notes":
    { es: "Notas topográficas", en: "Topographical notes" },
  "Botany for Painters and Elements of Landscape Painting":
    { es: "Botánica y paisaje para pintores", en: "Botany and landscape for painters" },
  "Physical Geography":
    { es: "Geografía física", en: "Physical geography" },
  "On the Proportions and on the Movements of the Human Figure":
    { es: "Proporciones y movimiento del cuerpo", en: "Proportions and movement of the body" },
  "Philosophical Maxims. Morals. Polemics and Speculations":
    { es: "Máximas, moral y polémicas", en: "Maxims, morals and polemics" },
  "Linear Perspective":
    { es: "Perspectiva lineal", en: "Linear perspective" },
  "Astronomy":
    { es: "Astronomía", en: "Astronomy" },
  "Anatomy, Zoology and Physiology":
    { es: "Anatomía, zoología y fisiología", en: "Anatomy, zoology and physiology" },
  "Letters. Personal Records. Dated Notes":
    { es: "Cartas y apuntes personales", en: "Letters and personal records" },
  "Perspective of Disappearance":
    { es: "Perspectiva de la desaparición", en: "Perspective of disappearance" },
  "Prolegomena and General Introduction to the Book on Painting":
    { es: "Prolegómenos al libro de pintura", en: "Prolegomena to the book on painting" },
  "The notes on Sculpture":
    { es: "Notas sobre escultura", en: "Notes on sculpture" },
  "Theoretical writings on Architecture":
    { es: "Escritos de arquitectura", en: "Writings on architecture" },
  "Studies and Sketches for Pictures and Decorations":
    { es: "Estudios y bocetos para cuadros", en: "Studies and sketches for pictures" },
  "Architectural Designs":
    { es: "Diseños arquitectónicos", en: "Architectural designs" },
  "Theory of colours":
    { es: "Teoría de los colores", en: "Theory of colours" },
  "'Prospettiva de' colri' (Perspective of Colour)":
    { es: "Perspectiva del color", en: "Perspective of colour" },
  "Naval Warfare.—Mechanical Appliances.—Music":
    { es: "Guerra naval, máquinas y música", en: "Naval warfare, machines and music" },
};

/**
 * De que trata cada seccion, en criollo. **Escritas leyendo sus propios temas**,
 * no inventadas: "Notas miscelaneas" no le dice nada a nadie, y adentro hay
 * listas de libros, cuentas y recordatorios.
 */
const GLOSA: Record<string, Record<Idioma, string>> = {
  "The Practice of Painting": {
    es: "Cómo preparaba los colores, dónde ponía la luz y cómo pintaba gestos y telas",
    en: "How he prepared his colours, where he put the light, and how he painted gesture and drapery" },
  "Humorous Writings": {
    es: "Fábulas, adivinanzas, chistes y profecías burlonas",
    en: "Fables, riddles, jests and mock prophecies" },
  "Six books on Light and Shade": {
    es: "Cómo cae una sombra, cómo se degrada y cómo se pinta",
    en: "How a shadow falls, how it fades, and how to paint it" },
  "Miscellaneous Notes": {
    es: "Listas de libros, cuentas, recordatorios y apuntes sueltos",
    en: "Book lists, accounts, reminders and loose notes" },
  "Topographical Notes": {
    es: "Los lugares que recorrió: ríos, montañas, ciudades y viajes",
    en: "The places he travelled: rivers, mountains, cities" },
  "Botany for Painters and Elements of Landscape Painting": {
    es: "Cómo crecen las ramas y las hojas, y cómo pintar un paisaje",
    en: "How branches and leaves grow, and how to paint a landscape" },
  "Physical Geography": {
    es: "El agua, las mareas, el diluvio y cómo se formó la tierra",
    en: "Water, tides, the flood, and how the earth was formed" },
  "On the Proportions and on the Movements of the Human Figure": {
    es: "Cuánto mide cada parte del cuerpo y cómo se mueve",
    en: "How long each part of the body is, and how it moves" },
  "Philosophical Maxims. Morals. Polemics and Speculations": {
    es: "Lo que pensaba sobre la ciencia, la vida y sus adversarios",
    en: "What he thought about science, life and his rivals" },
  "Linear Perspective": {
    es: "Por qué las cosas se ven más chicas de lejos, con geometría",
    en: "Why things look smaller far away, worked out with geometry" },
  "Astronomy": {
    es: "La luna, el sol y la Tierra vista como un planeta más",
    en: "The moon, the sun, and the Earth seen as one more planet" },
  "Anatomy, Zoology and Physiology": {
    es: "Huesos, músculos, órganos y cómo funciona el cuerpo",
    en: "Bones, muscles, organs, and how the body works" },
  "Letters. Personal Records. Dated Notes": {
    es: "Cartas a sus mecenas, fechas y registros de su propia vida",
    en: "Letters to his patrons, dates and records of his own life" },
  "Perspective of Disappearance": {
    es: "Por qué lo lejano se ve borroso y pierde el color",
    en: "Why distant things look blurred and lose their colour" },
  "Prolegomena and General Introduction to the Book on Painting": {
    es: "Cómo pensaba ordenar su tratado, y qué significa ver",
    en: "How he meant to order his treatise, and what seeing is" },
  "The notes on Sculpture": {
    es: "Fundir bronce y los dos monumentos a caballo que proyectó",
    en: "Casting bronze, and the two horse monuments he designed" },
  "Theoretical writings on Architecture": {
    es: "Arcos, vigas, cimientos y por qué se rajan los muros",
    en: "Arches, beams, foundations, and why walls crack" },
  "Studies and Sketches for Pictures and Decorations": {
    es: "Notas para la Última Cena, la batalla de Anghiari y alegorías",
    en: "Notes for the Last Supper, the battle of Anghiari, and allegories" },
  "Architectural Designs": {
    es: "Plantas de templos, escaleras, caballerizas y decorados de fiesta",
    en: "Plans for temples, stairs, stables and festival sets" },
  "Theory of colours": {
    es: "Cómo se afectan los colores entre sí y qué les pasa en la sombra",
    en: "How colours affect one another, and what happens to them in shadow" },
  "'Prospettiva de' colri' (Perspective of Colour)": {
    es: "Por qué lo lejano se ve azul: el color del aire",
    en: "Why distance looks blue: the colour of the air" },
  "Naval Warfare.—Mechanical Appliances.—Music": {
    es: "Máquinas de volar, respirar bajo el agua e instrumentos",
    en: "Flying machines, breathing underwater, and instruments" },
};

/** Los que ninguna regla arregla. Escritos a mano contra su propio contenido. */
const AMANO: Record<string, string> = {
  // castellano
  "Proposiciones sobre Prospettiva de' perdimenti del MS. C":
    "Cómo se pierde nitidez con la distancia",
  "La importancia de la luz y la sombra en la Prospettiva de' perdimenti":
    "El papel de la luz y la sombra en lo que se ve de lejos",
  "La práctica de la Prospettiva de' colori": "Cómo se aplica la perspectiva del color",
  "A. Observaciones Generales._": "Observaciones generales de arquitectura",
  "G. Descripción de un templo desconocido": "Descripción de un templo sin identificar",
  "PERSPPECTIVA DE LA DESAPARICIÓN Definición": "Qué es la perspectiva de la desaparición",
  "PERSPECTIVA DE DESAPARICIÓN Definición": "Qué es la perspectiva de la desaparición",
  "PERSPECTIVA DE Reglas generales": "Reglas generales de la perspectiva del color",
  "Los cuadernos de bitácora de Vitruvio, de Alberti y de Leonardo":
    "Sus cuadernos y los de Vitruvio y Alberti",
  // inglés
  "Propositions on Prospettiva de' perdimenti from MS. C":
    "How sharpness is lost with distance",
  "The importance of light and shade in the Prospettiva de' perdimenti":
    "The part light and shade play in what is seen far off",
  "The practice of the Prospettiva de' colori": "How the perspective of colour is applied",
  "A. General Observations._": "General observations on architecture",
  "G. Description of an unknown Temple": "Description of an unidentified temple",
  "PERSPECTIVE OF DISAPPEARANCE Definition": "What the perspective of disappearance is",
  "PERSPECTIVE OF General rules": "General rules of the perspective of colour",
  "ON ON OF Preliminary observations": "Preliminary observations",
  "The ship's logs of Vitruvius, of Alberti and of Leonardo":
    "His notebooks and those of Vitruvius and Alberti",
};

/**
 * Los cinco imanes. Aparecen como "lo mas cercano" a casi cualquier consulta y
 * entre los cinco ocupan un tercio de las sugerencias. **Siguen en la lista y se
 * pueden abrir**; lo que no hacen es destacarse. Ver `28-estado-y-plan.md` §5.
 */
const IMANES = new Set([
  "Citas y notas sobre libros y autores (1469—1508)",
  "Quotations and notes on books and authors (1469—1508)",
  "Chanzas y cuentos", "JESTS AND TALES",
  "Fisiología", "PHYSIOLOGY",
  "Moral", "MORALS",
  "La posición correcta del artista, al pintar y del espectador",
  "The right position of the artist, when painting and of the spectator",
]);

const oracion = (s: string): string => {
  const t = s.toLowerCase().replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Cuantas palabras del arranque estan ENTERAS en mayusculas. */
const arrancaGritando = (s: string): number => {
  let n = 0;
  for (const p of s.trim().split(/\s+/)) {
    const l = p.replace(/[^A-Za-zÁÉÍÓÚÑ]/g, "");
    if (l.length > 1 && l === l.toUpperCase()) n++; else break;
  }
  return n;
};

function rotulo(titulo: string, seccionVisible: string): string {
  if (AMANO[titulo]) return AMANO[titulo];
  let t = titulo;
  t = t.replace(/\s*\(\s*\d{2,4}\s*[-—–.][^)]*\)\s*$/, "");   // (1275-1279)
  t = t.replace(/\s*\(\s*\d{2,4}\s*\)\s*$/, "");               // (584)
  t = t.replace(/[_.\s]+$/, "");                                // "._" colgando
  const pre = seccionVisible.toUpperCase();
  if (t.toUpperCase().startsWith(pre + " ")) t = t.slice(pre.length + 1);

  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letras.length > 6 && letras === letras.toUpperCase()) {
    t = oracion(t);
  } else {
    const n = arrancaGritando(t);
    if (n) {
      const pal = t.trim().split(/\s+/);
      const resto = pal.slice(n).join(" ");
      // Si lo que sigue ya es una frase, la tirada de arriba era un encabezado
      // suelto y sobra; si no, se la baja de tono y se conserva.
      t = resto.length > 12 ? resto.charAt(0).toUpperCase() + resto.slice(1) : oracion(t);
    }
  }
  return t.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------

const RAIZ = new URL("../", import.meta.url);
const chunks: Chunk[] = JSON.parse(
  readFileSync(new URL("artifacts/chunks.json", RAIZ), "utf8"));
const trad: Record<string, { texto: string; titulo: string | null }> = JSON.parse(
  readFileSync(new URL("artifacts/chunks_es.json", RAIZ), "utf8"));

const sinTabla = new Set<string>();
for (const c of chunks) {
  if (c.voice !== "leonardo") continue;
  const s = (c.section || "").trim();
  if (s && (!SECCION[s] || !GLOSA[s])) sinTabla.add(s);
}
/**
 * ⚠ UNA CLAVE DE `AMANO` QUE NO EXISTE NO FALLA: SIMPLEMENTE NO SE APLICA.
 *
 * Se escriben a mano y son 18. Dos estaban mal —«A. General Observations» sin el
 * `._` que el corpus sí tiene, y «The log books of…» donde el título real es
 * «The ship's logs of…»— y llevaban así desde que se escribieron: el rótulo
 * limpio nunca se mostró y nadie se enteró, porque `rotulo()` cae al camino
 * mecánico y devuelve algo razonable igual.
 *
 * Las dos se escribieron TRADUCIENDO la clave castellana en vez de copiar el
 * título inglés del corpus. Es el mismo error que `npm run curadas` atrapó en la
 * cita de Verrocchio (D-239), y por eso acá también se comprueba en vez de
 * confiar. Se avisa y no se aborta: un rótulo perdido no rompe el mapa, pero
 * tiene que verse.
 */
{
  const titulos = new Set<string>();
  for (const c of chunks) {
    if (c.voice !== "leonardo") continue;
    if (c.richterTitle) titulos.add(c.richterTitle);
    const t = trad[c.id]?.titulo;
    if (t) titulos.add(t);
  }
  const muertas = Object.keys(AMANO).filter((k) => !titulos.has(k));
  if (muertas.length) {
    console.warn(`\n⚠ ${muertas.length} clave(s) de AMANO no corresponden a ningún título del corpus:`);
    for (const k of muertas) console.warn(`   ${JSON.stringify(k)}`);
    console.warn("  El rótulo escrito a mano NO se aplica: se cae al mecánico.\n");
  }
}

if (sinTabla.size) {
  console.error(`\nSECCIONES SIN NOMBRE O SIN DESCRIPCION (${sinTabla.size}):`);
  for (const s of sinTabla) console.error(`  ${JSON.stringify(s)}`);
  console.error("\nAgregarlas a SECCION y a GLOSA, en los dos idiomas. No se genera nada.");
  process.exit(1);
}

/**
 * ══════════════════════════════════════════════════════════════════════
 * UN TEMA CASTELLANO POR TEMA INGLES. Ver D-241.
 * ══════════════════════════════════════════════════════════════════════
 *
 * La traducción del corpus tradujo el MISMO título inglés de dos maneras en
 * chunks distintos: «Sobre los materiales químicos» y «Sobre materiales
 * químicos», «Lemas y Emblemas» y «Motes y Emblemas», «Sobre el manejo de las
 * obras» y «Sobre la gestión de las obras». **27 títulos ingleses tienen dos
 * traducciones cada uno.**
 *
 * Eso explica exactamente la asimetría del mapa —423 temas en castellano contra
 * 396 en inglés, y 423 − 396 = 27— que hasta hoy nadie había mirado. En el rail
 * castellano el visitante veía el mismo tema DOS VECES, con dos redacciones
 * parecidas y los pasajes repartidos entre las dos.
 *
 * ⚠ SE ARREGLA ACA Y NO EN EL CORPUS. Las dos variantes son traducciones
 * correctas; ninguna está mal. Reescribir `chunks_es.json` obligaría a
 * reconstruir el índice castellano y a recalibrar τ_es, o sea a mover los
 * números medidos de todo el proyecto para arreglar un problema de rótulos.
 * Acá se agrupa por el título INGLES —que es el identificador real del tema— y
 * se elige una variante castellana: la que cubre más chunks, y a igualdad, la
 * primera alfabéticamente, para que dos corridas den lo mismo.
 *
 * ⚠ LA VARIANTE ELEGIDA SIGUE SIENDO UN TITULO QUE EXISTE, así que
 * `mapa.consultasHuerfanas` sigue dando 0 y la consulta que se manda sigue
 * siendo texto del corpus. La otra variante no se pierde: sus pasajes se cuentan
 * en el tema unificado, y el buscador la encuentra igual porque filtra por
 * `consulta` además de por `visible`.
 */
function construir(idioma: Idioma) {
  /** sección → título inglés → (variante del idioma → cuántos chunks) */
  const porSeccion = new Map<string, Map<string, Map<string, number>>>();
  for (const c of chunks) {
    if (c.voice !== "leonardo") continue;
    const secEn = (c.section || "").trim();
    if (!secEn) continue;
    /** ⚠ El titulo del idioma que se va a consultar, nunca el del otro. */
    const titulo = idioma === "es" ? (trad[c.id]?.titulo || c.richterTitle) : c.richterTitle;
    if (!titulo || !c.richterTitle) continue;
    if (!porSeccion.has(secEn)) porSeccion.set(secEn, new Map());
    const porTema = porSeccion.get(secEn)!;
    if (!porTema.has(c.richterTitle)) porTema.set(c.richterTitle, new Map());
    const vs = porTema.get(c.richterTitle)!;
    vs.set(titulo, (vs.get(titulo) ?? 0) + 1);
  }

  /**
   * La variante que cubre más chunks; a igualdad, la primera alfabéticamente.
   *
   * ⚠ PERO PRIMERO, LA QUE TENGA ROTULO ESCRITO A MANO. Sin esto, unificar dos
   * variantes podía tirar el rótulo de `AMANO` sin que nada fallara: si la que
   * gana por cantidad de chunks no está en la tabla, el tema cae al rótulo
   * mecánico y el trabajo a mano se pierde en silencio. Es barato preferirla y
   * quita el modo de fallo entero en vez de avisar de él.
   */
  const elegir = (vs: Map<string, number>): string => {
    const orden = [...vs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return (orden.find(([t]) => AMANO[t]) ?? orden[0]!)[0];
  };

  let unificados = 0;
  for (const porTema of porSeccion.values()) {
    for (const vs of porTema.values()) if (vs.size > 1) unificados += vs.size - 1;
  }
  if (unificados) {
    console.log(`  [${idioma}] ${unificados} tema(s) duplicado(s) por doble traducción, unificados`);
  }

  return [...porSeccion.entries()]
    .map(([secEn, m]) => {
      const nombre = SECCION[secEn]![idioma];
      return {
        seccion: nombre,
        glosa: GLOSA[secEn]![idioma],
        pasajes: [...m.values()].reduce((a, vs) => a + [...vs.values()].reduce((x, y) => x + y, 0), 0),
        temas: [...m.entries()]
          .map(([tituloEn, vs]) => {
            const consulta = elegir(vs);
            return {
              visible: rotulo(consulta, nombre),
              /** ⚠ EL TITULO ORIGINAL: es lo que `alcance.json` midió. */
              consulta,
              pasajes: [...vs.values()].reduce((a, x) => a + x, 0),
              /** El imán se marca por el título INGLES: es el identificador del tema. */
              iman: IMANES.has(tituloEn) || IMANES.has(consulta) || undefined,
            };
          })
          .sort((a, b) => b.pasajes - a.pasajes),
      };
    })
    .sort((a, b) => b.pasajes - a.pasajes);
}

const mapa = { es: construir("es"), en: construir("en") };

/* ══════════════════════════════════════════════════════════════════════
   EL REFUERZO: los temas cuyo TITULO no alcanza para encontrarse a sí mismo
   ══════════════════════════════════════════════════════════════════════

   D-260 dejó 7 temas de 792 que el gate no contesta cuando se les pregunta
   por su propio nombre. No es que el corpus no los tenga —cada tema del mapa
   ES un conjunto de pasajes de Richter—: es que el rótulo del índice no se
   parece al texto que hay debajo. «Asia Central» da 0,8238 contra τ 0,8410.

   ⚠ ESTO NO ES REFORMULAR LA PREGUNTA DEL USUARIO, que `28` §3.3 descarta. La
   consulta de un tema del mapa **la escribimos nosotros** desde el índice de
   Richter: el panel es, literalmente, un generador de consultas. Arreglar una
   consulta que generamos mal no es tocar lo que escribió el visitante.

   ⚠ Y LOS TERMINOS NO SE INVENTAN: salen de los propios pasajes del tema, por
   frecuencia relativa contra el corpus entero. Nadie elige palabras a mano.

   ⚠ EL REFUERZO SOLO SE ACEPTA SI ADEMAS ACIERTA. Pasar τ no alcanza: el
   primer pasaje recuperado tiene que ser UNO DE LOS SUYOS. Hacer que un tema
   conteste con el pasaje equivocado es peor que dejarlo abstenerse — es la
   misma falla que D-110 sacó del sistema, presentar algo como respaldo cuando
   no lo es.

   ⚠ NO TOCA `consulta`. El título original queda donde estaba, así que
   `mapa.consultasHuerfanas` sigue midiendo lo que medía y `alcance.json` sigue
   describiendo lo que describe: la alcanzabilidad **del título pelado**. */

const { cargarMotor, decidirCon } = await import("../src/lib/grounding.js");
const { cargarExtractor } = await import("../src/lib/embed.js");
const motorRef = cargarMotor(new URL("artifacts/", RAIZ));
const extractorRef = await cargarExtractor();
const embeberRef = async (t: string): Promise<Float32Array> =>
  (await extractorRef("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

/** Variante del título en cada idioma → título inglés, que es la identidad. */
const identidad: Record<Idioma, Map<string, string>> = { es: new Map(), en: new Map() };
for (const c of chunks) {
  if (c.voice !== "leonardo" || !c.richterTitle) continue;
  identidad.en.set(c.richterTitle, c.richterTitle);
  const te = trad[c.id]?.titulo;
  if (te) identidad.es.set(te, c.richterTitle);
}

const tokens = (t: string): string[] =>
  (t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").match(/[a-z][a-z'-]{3,}/g) ?? []);

/** En cuántos pasajes aparece cada término. Se calcula una vez por idioma. */
const df: Record<Idioma, Map<string, number>> = { es: new Map(), en: new Map() };
const textoDe = (c: Chunk, i: Idioma): string => (i === "es" ? (trad[c.id]?.texto || c.text) : c.text);
const leonardos = chunks.filter((c) => c.voice === "leonardo");
for (const idi of ["es", "en"] as Idioma[]) {
  for (const c of leonardos) {
    for (const t of new Set(tokens(textoDe(c, idi)))) df[idi].set(t, (df[idi].get(t) ?? 0) + 1);
  }
}

let reforzados = 0;
const sinArreglo: string[] = [];

for (const idi of ["es", "en"] as Idioma[]) {
  const { corpus, umbrales } = motorRef.por[idi];
  const tau = umbrales.tau[idi];
  const N = leonardos.length;

  for (const sec of mapa[idi]) {
    for (const tema of sec.temas) {
      if (decidirCon(motorRef, tema.consulta, await embeberRef(tema.consulta), idi).tipo !== "abstiene") continue;

      const tituloEn = identidad[idi].get(tema.consulta);
      const mios = leonardos.filter((c) => c.richterTitle === tituloEn);
      const nosMios = new Set(mios.flatMap((c) => c.richterNos));
      if (!mios.length) { sinArreglo.push(`[${idi}] ${tema.visible} — sin pasajes propios`); continue; }

      /** tf·idf sobre los pasajes del tema: los términos que lo distinguen. */
      const tf = new Map<string, number>();
      for (const c of mios) for (const t of tokens(textoDe(c, idi))) tf.set(t, (tf.get(t) ?? 0) + 1);
      const puntuados = [...tf.entries()]
        .map(([t, f]) => [t, f * Math.log(N / (df[idi].get(t) ?? 1))] as const)
        .sort((a, b) => b[1] - a[1]);

      /** Se prueba con 4, 6 y 8: el refuerzo más corto que cumple. */
      let elegido: string | null = null;
      for (const n of [4, 6, 8]) {
        const terminos = puntuados.slice(0, n).map(([t]) => t);
        if (terminos.length < 2) break;
        const candidata = `${tema.consulta}: ${terminos.join(", ")}`;
        const vec = await embeberRef(candidata);
        if (decidirCon(motorRef, candidata, vec, idi).tipo === "abstiene") continue;
        const { top } = corpus.buscar(vec, candidata, "leonardo", 3);
        if (!top[0] || !top[0].chunk.richterNos.some((x) => nosMios.has(x))) continue;
        elegido = terminos.join(", ");
        break;
      }

      if (elegido) { (tema as { refuerzo?: string }).refuerzo = elegido; reforzados++; }
      else sinArreglo.push(`[${idi}] ${tema.visible} (τ ${tau.toFixed(4)})`);
    }
  }
}

console.log(`
  refuerzos escritos: ${reforzados}`);
if (sinArreglo.length) {
  console.log(`  sin arreglo, siguen abstiniéndose: ${sinArreglo.length}`);
  for (const x of sinArreglo) console.log(`    ${x}`);
}


const salida = new URL("src/data/mapa.ts", RAIZ);
mkdirSync(new URL("./", salida), { recursive: true });
writeFileSync(salida, `\
/**
 * GENERADO por \`npm run mapa\` desde \`artifacts/chunks.json\` y
 * \`artifacts/chunks_es.json\`. NO EDITAR A MANO: los nombres de sección, sus
 * descripciones y los rótulos rescritos viven en \`tools/mapa_temas.ts\`.
 *
 * ⚠ \`visible\` es lo que se muestra; \`consulta\` es lo que se manda al buscar, y
 * es el título ORIGINAL de Richter **en el idioma de su índice**. Dos reglas que
 * cuestan caro si se rompen:
 *   · \`alcance.json\` midió 345/375 con los títulos originales: mandar otro
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
   * nunca**: viaja pegado a la consulta y el visitante ve sólo \`visible\`.
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
  t.refuerzo ? \`\${t.consulta}: \${t.refuerzo}\` : t.consulta;

export interface SeccionDelMapa {
  seccion: string;
  /** Qué hay adentro, en una línea. */
  glosa: string;
  pasajes: number;
  temas: TemaDelMapa[];
}

export const MAPA: Record<"es" | "en", SeccionDelMapa[]> =
${JSON.stringify(mapa, null, 1)};
`, "utf8");

const bytes = Buffer.byteLength(JSON.stringify(mapa));
console.log(`escrito: src/data/mapa.ts   (${(bytes / 1024).toFixed(1)} KB)`);
for (const idi of ["es", "en"] as const) {
  const secs = mapa[idi];
  const temas = secs.flatMap((s) => s.temas);
  const limpiados = temas.filter((t) => t.visible !== t.consulta).length;
  console.log(`  ${idi}: ${secs.length} secciones · ${temas.length} temas · ` +
    `${limpiados} rótulos limpiados · ${temas.filter((t) => t.iman).length} imanes`);
}
