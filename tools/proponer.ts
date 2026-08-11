/**
 * La maquina de PROPONER preguntas sugeridas. Ver D-109.
 *
 *   npm run proponer
 *
 * D-102 dejo la maquina de VALIDAR y 15 candidatas escritas a mano. D-104 dejo
 * el pool: 238 temas alcanzables en los dos idiomas. Faltaba lo del medio —
 * convertir un tema en una pregunta— y el roadmap (paso 20) lo pide derivado de
 * los titulos de Richter, no inventado.
 *
 * LA PLANTILLA ES LA RESPUESTA, Y NO ES UNA CONCESION. «¿Que dejaste escrito
 * sobre X?» es la forma mas honesta que tiene este producto de sugerir algo:
 *
 *   - **X sale del indice de contenidos del libro**, no de un modelo. Una
 *     sugerencia generada por un LLM podria prometer un tema que el corpus no
 *     tiene, que es exactamente R18 y exactamente lo que D-088 saco del prompt.
 *   - **No promete una respuesta, promete que hay material.** Es literalmente lo
 *     unico que el sistema puede garantizar.
 *   - No cuesta cuota ni depende de ningun proveedor.
 *
 * LO QUE HAY QUE MEDIR, y es la unica razon por la que este script existe en vez
 * de ser un `map`: **envolver el titulo en una pregunta cambia el vector.**
 * `alcance.ts` midio que el tema se recupera consultando su NOMBRE PELADO; una
 * pregunta agrega tokens que no son del tema («que», «dejaste», «escrito») y
 * puede correr el resultado. Se valida cada pregunta armada con la misma regla
 * de D-102: pasa el gate en los dos idiomas Y el top-3 trae los pasajes del
 * propio tema.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { cargarExtractor } from "../src/lib/embed.js";
import { cargarMotor, decidirCon, type Idioma } from "../src/lib/grounding.js";

const ART = new URL("../artifacts/", import.meta.url);
const motor = cargarMotor(ART);
const corpus = motor.por.en.corpus;
const extractor = await cargarExtractor();
const embeber = async (t: string): Promise<Float32Array> =>
  (await extractor("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

interface Entrada { titulo: string; tituloEs: string | null; palabras: number }
const { pool }: { pool: Entrada[] } = JSON.parse(readFileSync("artifacts/alcance.json", "utf8"));

/** Los `richterNos` de cada tema. Misma verdad que `alcance.ts`: la del corpus. */
const nums = new Map<string, Set<number>>();
for (const f of corpus.filasPorVoz.leonardo) {
  const c = corpus.chunks[f];
  if (!c.richterTitle) continue;
  const s = nums.get(c.richterTitle) ?? new Set<number>();
  for (const n of c.richterNos) s.add(n);
  nums.set(c.richterTitle, s);
}

/**
 * Se le saca el rango y el articulo/preposicion inicial para que la plantilla no
 * produzca «…sobre On the colour of the atmosphere». Richter titula con «On»,
 * «Of» y «The» de forma casi sistematica.
 */
/**
 * ARTICULOS Y MAYUSCULAS. Dos defectos aparecieron acá y los dos venian de tocar
 * el texto mas de la cuenta:
 *
 *   - bajar la primera letra siempre dejaba «sobre nilo», «about nile»,
 *     «about caspian Sea». Los nombres propios son la mitad de los temas
 *     geograficos del corpus.
 *   - sacar el articulo en castellano dejaba «sobre nilo» en vez de «sobre el
 *     Nilo». En ingles «On the Nile» -> «about the Nile» funciona; en castellano
 *     el articulo hace falta.
 *
 * Regla: en ingles se saca «On/Of» y se conserva «The». En castellano no se saca
 * nada. Y solo se baja la inicial si la primera palabra es un articulo, que es
 * el unico caso donde la mayuscula venia de encabezar el titulo y no del nombre.
 */
const ARTICULO_ES = /^(el|la|los|las|un|una)$/i;

const tema = (t: string, idi: Idioma): string => {
  let s = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (idi === "en") s = s.replace(/^(On|Of)\s+/i, "");
  const primera = s.split(/\s+/)[0] ?? "";
  // Encabezado entero en mayuscula: se deja como esta (Richter los usa asi).
  if (primera === primera.toUpperCase() && primera.length > 1) return s;
  if (idi === "es" && ARTICULO_ES.test(primera)) return s.charAt(0).toLowerCase() + s.slice(1);
  if (idi === "en" && /^the$/i.test(primera)) return s.charAt(0).toLowerCase() + s.slice(1);
  return s;
};

/**
 * APARATO EDITORIAL DE RICHTER, que es un tema del LIBRO y no de Leonardo.
 * "Suggestions for the arrangement of MSS.", "Book 15 of matters worn away by
 * water", "Plans for the representation of muscles by drawings": son titulos
 * sobre como esta organizado el manuscrito, no sobre el mundo. Preguntarle a
 * Leonardo por ellos es preguntarle por la edicion de Richter.
 */
const EDITORIAL = /MSS?|manuscript|arrangement of|the arrangement|book \d+ of|plans? for the|suggestions? for|list of|introduction|prolegomena|contents/i;

const PLANTILLA: Record<Idioma, (x: string) => string> = {
  es: (x) => `¿Qué dejaste escrito sobre ${x}?`,
  en: (x) => `What did you set down about ${x}?`,
};

interface Fila { titulo: string; es: string; en: string; margen: number; ok: boolean; motivo: string }
const filas: Fila[] = [];
let i = 0;
for (const e of pool) {
  if (!e.tituloEs) continue;
  const propias = nums.get(e.titulo);
  if (!propias) continue;
  if (EDITORIAL.test(e.titulo)) continue;
  const texto = { es: PLANTILLA.es(tema(e.tituloEs, "es")), en: PLANTILLA.en(tema(e.titulo, "en")) };
  let ok = true, motivo = "", margen = Infinity;
  for (const idi of ["es", "en"] as Idioma[]) {
    const d = decidirCon(motor, texto[idi], await embeber(texto[idi]), idi, 3);
    if (d.tipo !== "responde") { ok = false; motivo = `el gate se abstiene en ${idi}`; margen = -1; break; }
    margen = Math.min(margen, d.cosMax - d.tau);
    if (!d.pasajes.some((p) => p.chunk.richterNos.some((n) => propias.has(n)))) {
      ok = false; motivo = `el top-3 no trae el tema en ${idi}`; break;
    }
  }
  filas.push({ titulo: e.titulo, es: texto.es, en: texto.en, margen, ok, motivo });
  if (++i % 40 === 0) process.stdout.write(`\r  ${i}/${pool.length}   `);
}
process.stdout.write("\r".padEnd(30) + "\r");

/**
 * SE ORDENA POR BREVEDAD, NO POR MARGEN. Ordenar por margen sobre tau parecia lo
 * natural —es el numero que la validacion produce— y da la lista al reves: los
 * margenes mas altos son de titulos largos y tecnicos («libro 15 de las materias
 * desgastadas por el agua»), porque un titulo especifico matchea sus propios
 * pasajes con mas holgura. **El margen sirve como FILTRO y es la dimension
 * equivocada como RANKING**, que es el error de siempre aparecido en la
 * superficie que el usuario ve primero.
 *
 * La brevedad es un PROXY de naturalidad, no una medida de ella. Nadie midio que
 * las preguntas cortas sean mejores: se eligio porque las largas son
 * demostrablemente peores y porque no hay forma offline de medir "suena bien".
 * La eleccion final de cuales se muestran sigue siendo humana, sobre este pool.
 */
const buenas = filas.filter((f) => f.ok)
  .sort((a, b) => a.es.length - b.es.length || b.margen - a.margen);
const malas = filas.filter((f) => !f.ok);

console.log(`\n# Preguntas sugeridas propuestas desde los títulos de Richter\n`);
console.log(`  pool de temas (D-104)      : ${filas.length}`);
console.log(`  **sobreviven la validación : ${buenas.length}** (${((buenas.length / filas.length) * 100).toFixed(0)}%)`);
console.log(`  descartadas                : ${malas.length}\n`);

const porMotivo = new Map<string, number>();
for (const m of malas) porMotivo.set(m.motivo, (porMotivo.get(m.motivo) ?? 0) + 1);
console.log(`## Por qué se cae una pregunta armada, si el tema pelado sí se alcanzaba\n`);
for (const [m, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)} · ${m}`);

console.log(`\n## Las 12 mejores\n`);
for (const [j, f] of buenas.slice(0, 12).entries()) {
  console.log(`${String(j + 1).padStart(2)}. ${f.es}`);
  console.log(`    ${f.en}   (+${f.margen.toFixed(4)})`);
}

writeFileSync("artifacts/sugeridas_pool.json", JSON.stringify({
  regla: "Plantilla «¿Qué dejaste escrito sobre X?» con X = título de Richter, validada con la regla de D-102: pasa el gate en es y en, y el top-3 trae los pasajes del propio tema. Ver D-109.",
  generado: new Date().toISOString().slice(0, 10),
  resumen: { pool: filas.length, aceptadas: buenas.length, descartadas: malas.length },
  preguntas: buenas.map((f) => ({ titulo: f.titulo, es: f.es, en: f.en, margen: Number(f.margen.toFixed(4)) })),
}, null, 2) + "\n");
console.log(`\nescrito: artifacts/sugeridas_pool.json`);
