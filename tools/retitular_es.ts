/**
 * Pone en castellano los rotulos de seccion que D-228 dejo como titulo.
 *
 *   npm run retitular
 *
 * POR QUE EXISTE. Al corregir la propagacion de titulos (D-228), 169 chunks
 * dejaron de llevar un titulo de Richter mal aplicado y pasaron a llevar el
 * nombre de su seccion o subseccion. Esos nombres estan en ingles y en
 * mayusculas en el fuente de Gutenberg, y el indice castellano embebe
 * `titulo + ". " + texto` con el titulo TRADUCIDO (`indexar.ts`): sin esto, 169
 * vectores castellanos llevarian adentro un rotulo en ingles.
 *
 * SON 21 CADENAS Y SE TRADUCEN A MANO, CONGELADAS. Es el precedente de D-125
 * con las notas: una traduccion corta, verificable de un vistazo y que no
 * cambia entre corridas vale mas que una llamada a un modelo que puede devolver
 * algo distinto cada vez. No son texto de Leonardo — son rotulos de seccion del
 * editor — asi que traducirlos no toca la tesis del proyecto.
 *
 * ⚠ NO INVENTA TITULOS. Si aparece un rotulo que no esta en la tabla, aborta y
 * lo nombra, en vez de dejarlo en ingles en silencio. Un rotulo nuevo es una
 * decision, no un caso limite.
 *
 * ⚠ EL TEXTO NO SE TOCA. Solo el campo `titulo` de `chunks_es.json`.
 */

import { readFileSync, writeFileSync } from "node:fs";

interface Chunk { id: string; richterTitle: string | null; voice: string }
type Traduccion = Record<string, { texto: string; titulo: string | null }>;

/**
 * Las 21, en el mismo registro que el resto de los titulos castellanos del
 * corpus: caja de oracion, no mayusculas, aunque el fuente venga gritando.
 */
const TITULOS: Record<string, string> = {
  "ANATOMY": "Anatomía",
  "Architectural Designs": "Diseños arquitectónicos",
  "DRAUGHTS AND SCHEMES FOR THE HUMOROUS WRITINGS":
    "Borradores y esquemas para los escritos humorísticos",
  "FRANCE": "Francia",
  "GEOLOGICAL PROBLEMS": "Problemas geológicos",
  "JESTS AND TALES": "Chanzas y cuentos",
  "MORALS": "Moral",
  "OF RIVERS": "De los ríos",
  "ON FISSURES IN NICHES": "Sobre las grietas en los nichos",
  "ON FISSURES IN WALLS": "Sobre las grietas en los muros",
  "ON FOUNDATIONS, THE NATURE OF THE GROUND AND SUPPORTS":
    "Sobre los cimientos, la naturaleza del terreno y los soportes",
  "ON MOUNTAINS": "Sobre las montañas",
  "ON THE NATURE OF THE ARCH": "Sobre la naturaleza del arco",
  "ON THE RESISTANCE OF BEAMS": "Sobre la resistencia de las vigas",
  "PHYSIOLOGY": "Fisiología",
  "POLEMICS.—SPECULATION": "Polémicas y especulación",
  "PROPHECIES": "Profecías",
  "STUDIES ON THE LIFE AND HABITS OF ANIMALS":
    "Estudios sobre la vida y las costumbres de los animales",
  "THE COUNTRIES OF THE WESTERN END OF THE MEDITERRANEAN":
    "Los países del extremo occidental del Mediterráneo",
  "THE EARTH AS A PLANET": "La Tierra como planeta",
  "The notes on Sculpture": "Las notas sobre escultura",
};

const chunks: Chunk[] = JSON.parse(readFileSync("artifacts/chunks.json", "utf8"));
const es: Traduccion = JSON.parse(readFileSync("artifacts/chunks_es.json", "utf8"));

let cambiados = 0;
const faltantes = new Set<string>();

for (const c of chunks) {
  const t = es[c.id];
  if (!t || !c.richterTitle) continue;
  const castellano = TITULOS[c.richterTitle];
  if (castellano === undefined) continue;      // titulo de Richter, ya traducido
  if (t.titulo !== castellano) { t.titulo = castellano; cambiados++; }
}

/**
 * El control: ningun chunk de Leonardo puede quedar con un titulo que este en
 * `chunks.json` y no en la traduccion. Si eso pasa es porque el parser produjo
 * un rotulo nuevo y hay que decidir como se dice, no seguir de largo.
 */
const titulosEs = new Set(Object.values(es).map((t) => t.titulo).filter(Boolean));
for (const c of chunks) {
  if (c.voice !== "leonardo" || !c.richterTitle) continue;
  const t = es[c.id];
  if (t && t.titulo && !titulosEs.has(t.titulo)) faltantes.add(c.richterTitle);
}

writeFileSync("artifacts/chunks_es.json", JSON.stringify(es), "utf8");
console.log(`títulos castellanos actualizados: ${cambiados}`);
console.log(`tabla congelada: ${Object.keys(TITULOS).length} rótulos de sección`);
if (faltantes.size) {
  console.error(`\nROTULOS SIN TRADUCCION (${faltantes.size}):`);
  for (const f of faltantes) console.error(`  ${JSON.stringify(f)}`);
  process.exit(1);
}
