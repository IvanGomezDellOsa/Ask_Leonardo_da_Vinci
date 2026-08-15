/**
 * Recall de la recuperacion a distintos k, SIN generar una sola respuesta.
 *
 *   npm run evals:recall
 *
 * POR QUE EXISTE. El paso 17 del roadmap pide comparar k=3 contra k=5, y durante
 * toda la fase se asumio que eso requeria dos corridas completas —260 llamadas a
 * la API, dos dias de cuota—. **No es cierto.** Que el pasaje correcto entre o no
 * en el top-k es una propiedad UNICAMENTE del retrieval: no depende del modelo
 * generador, del prompt ni de la temperatura. Se mide offline y en segundos.
 *
 * Lo que SI necesita generacion es la otra mitad de la pregunta —si mas pasajes
 * mejoran o ensucian la respuesta—, y esa conviene hacerla solo si esta primera
 * muestra que hay algo que ganar.
 *
 * DOS VERDADES, PORQUE EL DATASET TIENE DOS, y durante toda la fase se uso una
 * sola:
 *
 *   `expected_passages`  numeros de Richter exactos. 30 casos, TODOS de la
 *                        categoria A (`in_corpus_direct`).
 *   `expected_topic`     el rango de numeros de Richter del tema que contesta.
 *                        25 casos, todos de la categoria B (`in_corpus_conceptual`).
 *
 * QUE ESTO FALTABA SE DESCUBRIO AL VALIDAR LA CURADURIA (D-098). D-097
 * diagnostico el problema de recuperacion entero sobre `B-03es` —"¿por que vale
 * mas la experiencia que la autoridad de los libros?", que traia inventarios— y
 * mando medir la solucion con este script. Pero `B-03es` es de la categoria B y
 * tiene `expected_passages: []`: **el instrumento no podia ver el caso que
 * motivo el trabajo.** Con la mitad B puesta, si lo ve.
 *
 * Es el mismo patron de toda la fase, otra vez: el instrumento medía una
 * dimension distinta de la que gobernaba el resultado, y no fallaba — devolvia
 * un 2 de 30 perfectamente plausible.
 *
 * ================================================================
 * LAS DOS TABLAS NO SE SUMAN. LA DE ABAJO ES UNA PANTALLA, NO UN VEREDICTO.
 * ================================================================
 *
 * `expected_passages` es un CONTEO: el pasaje esta en el top-k o no esta, y no
 * hay nada que interpretar. `expected_topic` es un JUICIO: un humano nomino UN
 * rango de numeros de Richter, y el corpus casi siempre tiene pasajes vecinos
 * que contestan igual de bien. Un "fallo" de la tabla de abajo puede ser
 * cualquiera de tres cosas, y hay que LEER el caso para saber cual:
 *
 *   1. un casi-empate       `B-13es` trae el rango 483-495 y esperaba 502-506,
 *                           a 0,009 de coseno del primero
 *   2. una etiqueta angosta `B-09es` esperaba los prolegomenos de luz y sombra y
 *                           trajo "On relative proportion of light and shadows"
 *   3. un fallo de verdad   `B-02` y `B-07`, con lo esperado en posicion densa
 *                           20, 38, 73 y 134
 *
 * Sumar las dos columnas y anunciar "12 fallos de 55" es un error que ya se
 * cometio una vez —en D-098, corregido en D-099—. La tabla de abajo dice DONDE
 * MIRAR. No dice cuantos fallos hay.
 */

import { existsSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";
import { Corpus, rangosDeRichter, caeEnRangos } from "../src/lib/retrieval.js";
import { DTYPE_PRODUCCION, type Dtype } from "../src/lib/embed.js";
import type { Idioma } from "../src/lib/grounding.js";
import { ART, cargarCasos } from "./comun.js";

const KS = [3, 5, 8];

const arg0 = (n) => { const i = process.argv.indexOf('--'+n); return i>=0 ? process.argv[i+1] : ''; };
/** Permite apuntar a un indice alternativo para comparar modelos. Ver D-097. */
const dirIdx = arg0('artifacts');
const DIR = dirIdx ? new URL('../' + dirIdx + '/', import.meta.url) : ART;
/**
 * LAS DOS RAMAS, con y sin curaduria (D-098). No es un lujo: desde que `Corpus`
 * cura por defecto, una sola columna diria "con curaduria" mientras el lector
 * la compara mentalmente contra el 13/15/2 de D-096 — que es de la otra. Se
 * imprimen juntas y con el mismo vector de consulta para que no haya nada que
 * recordar mal.
 */
/**
 * UN INDICE POR IDIOMA, IGUAL QUE PRODUCCION. Ver D-107.
 *
 * Este script se escribio antes de que existiera el indice castellano y nunca se
 * actualizo: construia UN `Corpus` sobre `artifacts/` —el ingles— y buscaba ahi
 * las 120 consultas, las castellanas incluidas. `decidirCon` (y con el
 * `npm run regresion`, y la ruta del API) rutea por `c.lang` desde D-107.
 *
 * O sea que el instrumento medía el retrieval de un sistema que ya no existe, y
 * no fallaba: devolvia "2 fallos de 30", perfectamente plausible, contra el 1 que
 * tiene el sistema real. Es el patron de la seccion 1 de `17-continuacion.md` una
 * vez mas —el componente mide una dimension distinta de la que gobierna el
 * resultado— y por eso los dos numeros discrepaban sin que nada lo dijera.
 *
 * `--indice en|es` fuerza un solo indice para las dos mitades del dataset. NO es
 * el modo por defecto: existe para comparar MODELOS de embedding con `--modelo`
 * y `--artifacts`, donde el directorio alternativo puede no tener su `es/`, y ahi
 * lo correcto es fijar el indice a proposito —igual que hacen `compuerta.ts` y
 * `alcance.ts`— en vez de rutear.
 */
const forzado = arg0('indice') as Idioma | '';
const dirEs = new URL('es/', DIR);
const hayEs = existsSync(new URL('index.bin', dirEs));

function porIdioma(curar: boolean): Record<Idioma, Corpus> {
  const en = new Corpus(DIR, { curar });
  if (forzado === 'en' || !hayEs) return { en, es: en };
  const es = new Corpus(dirEs, { base: DIR, curar });
  return forzado === 'es' ? { en: es, es } : { en, es };
}

const ramas = [
  { nombre: 'sin curaduría', corpus: porIdioma(false) },
  { nombre: 'con curaduría', corpus: porIdioma(true) },
];
const MODELO = arg0('modelo') || 'Xenova/multilingual-e5-small';
/**
 * `--dtype` aparte de `--modelo`: este script existe para poder cambiar el
 * MODELO de embedding (una pregunta de arquitectura), y `dtype` es una
 * pregunta distinta —qué pesos del mismo modelo— que D-126 fija en
 * `DTYPE_PRODUCCION` por default. Si el modelo cambia, puede que ni tenga
 * variante cuantizada; por eso queda como flag separado y no atado al de arriba.
 */
const dtype = (arg0('dtype') || DTYPE_PRODUCCION) as Dtype;
const embed = await pipeline("feature-extraction", MODELO, { dtype });

async function vector(q: string): Promise<Float32Array> {
  const s = await embed(`query: ${q}`, { pooling: "mean", normalize: true });
  return s.data as Float32Array;
}

const todos = cargarCasos();
const casosPasaje = todos.filter((c) => c.expected_passages?.length);
const casosTema = todos
  .filter((c) => !c.expected_passages?.length && c.expected_topic)
  .map((c) => ({ ...c, rangos: rangosDeRichter(c.expected_topic!) }))
  .filter((c) => c.rangos.length);

console.log(`\n# Recall de recuperación`);
console.log(`\n  ${casosPasaje.length} casos con pasajes exactos (categoría A)`);
console.log(`  ${casosTema.length} casos con tema esperado (categoría B)`);
for (const r of ramas) {
  console.log(`  ${r.nombre}: ${r.corpus.en.filasPorVoz.leonardo.length} chunks de Leonardo en el índice`);
}
console.log();

interface Fila { k: number; completo: number; alguno: number; nada: number; fallos: string[] }
const nuevas = (): Fila[] => KS.map((k) => ({ k, completo: 0, alguno: 0, nada: 0, fallos: [] }));
/** Un juego de filas por rama. Se recorre una vez y se embebe una vez por caso. */
const porPasaje: Fila[][] = ramas.map(nuevas);
const porTema: Fila[][] = ramas.map(nuevas);

/** Anota un caso: `n` aciertos sobre `total` objetivos distintos. */
function anotar(f: Fila, id: string, n: number, total: number): void {
  if (n === total) f.completo++;
  else if (n > 0) f.alguno++;
  else { f.nada++; f.fallos.push(id); }
}

for (const c of casosPasaje) {
  const v = await vector(c.q);
  ramas.forEach((r, ri) => KS.forEach((k, ki) => {
    const { top } = r.corpus[c.lang].buscar(v, c.q, "leonardo", k);
    const traidos = new Set(top.flatMap((t) => t.chunk.richterNos));
    const esperados = c.expected_passages!;
    anotar(porPasaje[ri][ki], c.id, esperados.filter((e) => traidos.has(e)).length, esperados.length);
  }));
}

for (const c of casosTema) {
  const v = await vector(c.q);
  ramas.forEach((r, ri) => KS.forEach((k, ki) => {
    const { top } = r.corpus[c.lang].buscar(v, c.q, "leonardo", k);
    // "Completo" no aplica a un tema: alcanza con traer UN pasaje del rango.
    // Se anota sobre 1 para que la columna que importa siga siendo la ultima.
    const dentro = caeEnRangos(top.flatMap((t) => t.chunk.richterNos), c.rangos);
    anotar(porTema[ri][ki], c.id, dentro ? 1 : 0, 1);
  }));
}

function tabla(titulo: string, datos: Fila[][], conCompleto: boolean): void {
  console.log(`## ${titulo}\n`);
  console.log(conCompleto
    ? `| k | trae todos | trae alguno | **no trae ninguno** | rama |`
    : `| k | trae del tema | — | **no trae ninguno** | rama |`);
  console.log(`|---:|---:|---:|---:|---|`);
  ramas.forEach((r, ri) => {
    for (const f of datos[ri]) {
      const medio = conCompleto ? `${f.alguno}` : `—`;
      console.log(`| ${f.k} | ${f.completo} | ${medio} | **${f.nada}** | ${r.nombre} |`);
    }
  });
  console.log();
  ramas.forEach((r, ri) => {
    for (const f of datos[ri]) {
      if (f.fallos.length) console.log(`[${r.nombre}] k=${f.k} falla del todo en: ${f.fallos.join(", ")}`);
    }
  });
  console.log();
}

tabla(`Pasajes exactos — ${casosPasaje.length} casos`, porPasaje, true);
console.log(`> "Trae todos" está limitado por k: un caso con 4 pasajes esperados no`);
console.log(`> puede completarse con k=3. Lo que importa es la última columna.\n`);
tabla(`Tema esperado — ${casosTema.length} casos`, porTema, false);
console.log(`> PANTALLA, NO VEREDICTO. Un fallo acá puede ser un casi-empate, una`);
console.log(`> etiqueta angosta o un fallo real: hay que leer el caso. No sumar con`);
console.log(`> la tabla de arriba. Ver D-099.\n`);
