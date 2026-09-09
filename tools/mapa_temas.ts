/**
 * Genera el mapa de temas que alimenta la pregunta asistida del códice.
 *
 *   npm run mapa
 *
 * QUE PRODUCE. `src/data/mapa.ts`: las 22 secciones de Richter con una linea que
 * dice que hay adentro, y sus 423 temas con dos textos por tema —el que se ve y
 * el que se pregunta—. Va bundleado y no en `public/`, por lo mismo que la
 * portada (D-132): sin red, sin espera y sin cuota.
 *
 * ══════════════════════════════════════════════════════════════════════
 * EL ROTULO QUE SE VE NO ES LA CONSULTA QUE SE MANDA.
 * ══════════════════════════════════════════════════════════════════════
 *
 * `visible` es un rotulo limpio, para leer. `consulta` es el titulo ORIGINAL de
 * Richter, que es el que viaja al buscador.
 *
 * ⚠ NO SE PUEDE MANDAR EL ROTULO LIMPIO. `alcance.json` mide que el nombre de un
 * tema recupera sus propios pasajes en **345 de 375 casos**, y esa medicion se
 * hizo con los titulos ORIGINALES. Mandar otro texto la invalida entera y habria
 * que rehacerla. El visitante lee lo limpio; la busqueda recibe lo medido.
 *
 * QUE SE LIMPIA, Y CUANTO. Medido sobre los 422 titulos unicos:
 *
 *   291  ya estaban bien y NO se tocan
 *   108  se arreglan sacando el rango entre parentesis: "Fabulas sobre plantas
 *        (1275-1279)". Es una referencia cruzada de Richter, no dice nada
 *    ~24  se arreglan bajando las mayusculas sostenidas
 *      9  hubo que rescribirlos a mano (italiano, prefijos sueltos, una errata)
 *
 * O sea que el 90% es mecanico. Lo que se escribe a mano son 22 nombres de
 * seccion, 22 descripciones y 9 rotulos: 53 cadenas cortas, verificables de un
 * vistazo, congeladas. Es el precedente de D-125 y de `retitular_es.ts`.
 *
 * ⚠ ABORTA SI APARECE UNA SECCION QUE NO ESTA EN LA TABLA, en vez de dejarla en
 * ingles en silencio. Una seccion nueva es una decision, no un caso limite.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

interface Chunk {
  id: string; richterNo: number | null; richterTitle: string | null;
  section: string | null; voice: string;
}

/** Los nombres de las 22 secciones. En el corpus estan en ingles. */
const SECCION: Record<string, string> = {
  "The Practice of Painting": "La práctica de la pintura",
  "Humorous Writings": "Escritos humorísticos",
  "Six books on Light and Shade": "Seis libros sobre luz y sombra",
  "Miscellaneous Notes": "Notas misceláneas",
  "Topographical Notes": "Notas topográficas",
  "Botany for Painters and Elements of Landscape Painting": "Botánica y paisaje para pintores",
  "Physical Geography": "Geografía física",
  "On the Proportions and on the Movements of the Human Figure":
    "Proporciones y movimiento del cuerpo",
  "Philosophical Maxims. Morals. Polemics and Speculations": "Máximas, moral y polémicas",
  "Linear Perspective": "Perspectiva lineal",
  "Astronomy": "Astronomía",
  "Anatomy, Zoology and Physiology": "Anatomía, zoología y fisiología",
  "Letters. Personal Records. Dated Notes": "Cartas y apuntes personales",
  "Perspective of Disappearance": "Perspectiva de la desaparición",
  "Prolegomena and General Introduction to the Book on Painting":
    "Prolegómenos al libro de pintura",
  "The notes on Sculpture": "Notas sobre escultura",
  "Theoretical writings on Architecture": "Escritos de arquitectura",
  "Studies and Sketches for Pictures and Decorations": "Estudios y bocetos para cuadros",
  "Architectural Designs": "Diseños arquitectónicos",
  "Theory of colours": "Teoría de los colores",
  "'Prospettiva de' colri' (Perspective of Colour)": "Perspectiva del color",
  "Naval Warfare.—Mechanical Appliances.—Music": "Guerra naval, máquinas y música",
};

/**
 * De que trata cada seccion, en criollo. **Escritas leyendo sus propios temas**,
 * no inventadas: "Notas miscelaneas" no le dice nada a nadie, y adentro hay
 * listas de libros, cuentas y recordatorios.
 */
const GLOSA: Record<string, string> = {
  "La práctica de la pintura":
    "Cómo preparaba los colores, dónde ponía la luz y cómo pintaba gestos y telas",
  "Escritos humorísticos": "Fábulas, adivinanzas, chistes y profecías burlonas",
  "Seis libros sobre luz y sombra": "Cómo cae una sombra, cómo se degrada y cómo se pinta",
  "Notas misceláneas": "Listas de libros, cuentas, recordatorios y apuntes sueltos",
  "Notas topográficas": "Los lugares que recorrió: ríos, montañas, ciudades y viajes",
  "Botánica y paisaje para pintores": "Cómo crecen las ramas y las hojas, y cómo pintar un paisaje",
  "Geografía física": "El agua, las mareas, el diluvio y cómo se formó la tierra",
  "Proporciones y movimiento del cuerpo": "Cuánto mide cada parte del cuerpo y cómo se mueve",
  "Máximas, moral y polémicas": "Lo que pensaba sobre la ciencia, la vida y sus adversarios",
  "Perspectiva lineal": "Por qué las cosas se ven más chicas de lejos, con geometría",
  "Astronomía": "La luna, el sol y la Tierra vista como un planeta más",
  "Anatomía, zoología y fisiología": "Huesos, músculos, órganos y cómo funciona el cuerpo",
  "Cartas y apuntes personales": "Cartas a sus mecenas, fechas y registros de su propia vida",
  "Perspectiva de la desaparición": "Por qué lo lejano se ve borroso y pierde el color",
  "Prolegómenos al libro de pintura": "Cómo pensaba ordenar su tratado, y qué significa ver",
  "Notas sobre escultura": "Fundir bronce y los dos monumentos a caballo que proyectó",
  "Escritos de arquitectura": "Arcos, vigas, cimientos y por qué se rajan los muros",
  "Estudios y bocetos para cuadros": "Notas para la Última Cena, la batalla de Anghiari y alegorías",
  "Diseños arquitectónicos": "Plantas de templos, escaleras, caballerizas y decorados de fiesta",
  "Teoría de los colores": "Cómo se afectan los colores entre sí y qué les pasa en la sombra",
  "Perspectiva del color": "Por qué lo lejano se ve azul: el color del aire",
  "Guerra naval, máquinas y música": "Máquinas de volar, respirar bajo el agua e instrumentos",
};

/** Los 9 que ninguna regla arregla. Escritos a mano contra su propio contenido. */
const AMANO: Record<string, string> = {
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
};

/**
 * Los cinco imanes. Aparecen como "lo mas cercano" a casi cualquier consulta y
 * entre los cinco ocupan un tercio de las sugerencias — salen igual para "quien
 * sos", "como fue tu muerte" y "hola". **Siguen en la lista y se pueden abrir**;
 * lo que no hacen es destacarse. Ver `28-estado-y-plan.md` §5.
 */
const IMANES = new Set([
  "Citas y notas sobre libros y autores (1469—1508)",
  "Chanzas y cuentos",
  "Fisiología",
  "Moral",
  "La posición correcta del artista, al pintar y del espectador",
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

function rotulo(titulo: string, seccionEs: string): string {
  if (AMANO[titulo]) return AMANO[titulo];
  let t = titulo;
  t = t.replace(/\s*\(\s*\d{2,4}\s*[-—–.][^)]*\)\s*$/, "");   // (1275-1279)
  t = t.replace(/\s*\(\s*\d{2,4}\s*\)\s*$/, "");               // (584)
  t = t.replace(/[_.\s]+$/, "");                                // "._" colgando
  // el nombre de la seccion repetido adelante
  const pre = seccionEs.toUpperCase();
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

const porSeccion = new Map<string, Map<string, { en: string; n: number }>>();
const sinTraducir = new Set<string>();

for (const c of chunks) {
  if (c.voice !== "leonardo") continue;
  const secEn = (c.section || "").trim();
  const secEs = SECCION[secEn];
  if (!secEs) { if (secEn) sinTraducir.add(secEn); continue; }
  const tEs = trad[c.id]?.titulo || c.richterTitle;
  if (!tEs) continue;
  if (!porSeccion.has(secEs)) porSeccion.set(secEs, new Map());
  const m = porSeccion.get(secEs)!;
  const y = m.get(tEs);
  if (y) y.n++; else m.set(tEs, { en: c.richterTitle || tEs, n: 1 });
}

if (sinTraducir.size) {
  console.error(`\nSECCIONES SIN TRADUCCION (${sinTraducir.size}):`);
  for (const s of sinTraducir) console.error(`  ${JSON.stringify(s)}`);
  console.error("\nAgregarlas a SECCION y a GLOSA. No se genera nada.");
  process.exit(1);
}

const secciones = [...porSeccion.entries()]
  .map(([s, m]) => ({
    seccion: s,
    glosa: GLOSA[s] ?? "",
    pasajes: [...m.values()].reduce((a, x) => a + x.n, 0),
    temas: [...m.entries()]
      .map(([tituloEs, { n }]) => ({
        visible: rotulo(tituloEs, s),
        /**
         * ⚠ EL TITULO ORIGINAL, no el rotulo. Es lo que `alcance.json` midio.
         * La consulta va en castellano porque el indice castellano embebe el
         * titulo traducido (D-230).
         */
        consulta: tituloEs,
        pasajes: n,
        iman: IMANES.has(tituloEs) || undefined,
      }))
      .sort((a, b) => b.pasajes - a.pasajes),
  }))
  .sort((a, b) => b.pasajes - a.pasajes);

const faltanGlosa = secciones.filter((s) => !s.glosa).map((s) => s.seccion);
if (faltanGlosa.length) {
  console.error(`\nSECCIONES SIN DESCRIPCION: ${faltanGlosa.join(", ")}`);
  process.exit(1);
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
 * es el título ORIGINAL de Richter. \`alcance.json\` midió que ese título
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
${JSON.stringify(secciones, null, 1)};
`, "utf8");

const temas = secciones.reduce((a, s) => a + s.temas.length, 0);
const cambiados = secciones.flatMap((s) => s.temas).filter((t) => t.visible !== t.consulta).length;
const bytes = Buffer.byteLength(JSON.stringify(secciones));
console.log(`escrito: src/data/mapa.ts`);
console.log(`  ${secciones.length} secciones · ${temas} temas · ${(bytes / 1024).toFixed(1)} KB`);
console.log(`  rótulos limpiados: ${cambiados} · intactos: ${temas - cambiados}`);
console.log(`  a mano: ${Object.keys(AMANO).length} rótulos, ${secciones.length} secciones + descripciones`);
