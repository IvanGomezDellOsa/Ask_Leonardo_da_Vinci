/**
 * Control de calidad DETERMINISTA de la traduccion congelada (D-079).
 *
 * POR QUE HACE FALTA. `chunks_es.json` son 1.431 chunks traducidos por un modelo
 * que hoy son tres cosas a la vez: lo que el modelo cita como palabras de
 * Leonardo en castellano, la evidencia contra la que el juez falla, y el pajar
 * de la fidelidad de cita. Es el artefacto mas influyente del sistema y **no
 * tenia ni una medicion de calidad** — se acepto porque el traductor no devolvio
 * vacios, que no es lo mismo que estar bien.
 *
 * POR QUE ESTE CHEQUEO Y NO OTRO. No hace falta un modelo para lo que mas
 * importa: los elementos duros de la rubrica —nombres propios y numeros— **tienen
 * que sobrevivir a la traduccion**. Si el ingles dice "Ludovico" o "1492" y el
 * castellano no, la traduccion perdio o invento justo la clase de dato que el
 * juez despues va a buscar. Es la lista de elementos duros usada como validador
 * de traduccion, y corre offline en segundos.
 *
 * LO QUE ESTE CHEQUEO NO HACE, y hay que decirlo: no mide si la traduccion es
 * BUENA. Un texto puede conservar todos los nombres y numeros y aun asi
 * desplazar un matiz — y el matiz es justamente lo que D-074 dice que distingue
 * a un hombre de otro. Eso sigue sin medirse, y sigue siendo el asterisco de la
 * cadena italiano -> Richter (1888) -> este castellano.
 */

import { readFileSync } from "node:fs";

const ART = new URL("../artifacts/", import.meta.url);

interface Chunk {
  id: string; text: string; textoEs?: string; voice?: string;
  richterNos?: number[];
}

const chunks: Chunk[] = JSON.parse(readFileSync(new URL("chunks.json", ART), "utf8"));
/**
 * La traduccion vive en su PROPIO archivo, indexada por id de chunk, y no
 * mergeada dentro de `chunks.json`. Es a proposito (D-079): el corpus ingles es
 * el original y no se toca; el castellano es una capa que se puede regenerar,
 * descartar o versionar sin arriesgar la fuente.
 */
const es: Record<string, { texto?: string; titulo?: string }> =
  JSON.parse(readFileSync(new URL("chunks_es.json", ART), "utf8"));
for (const c of chunks) c.textoEs = es[c.id]?.texto;

/** Sin acentos y en minuscula, para comparar "Milan" con "Milán". */
const plano = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Numeros: se exige que sobrevivan EXACTOS. Un ano o una cantidad no se traduce.
 * Se ignoran los de una sola cifra porque aparecen dentro de palabras y en
 * numeracion editorial, donde el ruido supera a la senal.
 */
const numerosDe = (t: string): string[] =>
  [...new Set((t.match(/\d{2,}/g) ?? []))];

/**
 * Nombres propios, DEDUCIDOS DEL PROPIO CORPUS en vez de por heuristica de
 * posicion.
 *
 * El primer intento fue "palabra capitalizada que no abre oracion" y dio 370
 * chunks con faltantes que eran casi todos basura: `Book`, `Light`, `Painter`,
 * `When`, `East`. Richter capitaliza en 1888 los sustantivos de tema y los
 * encabezados, asi que la mayuscula no distingue un nombre propio de un sustantivo
 * comun destacado — y traducir `Light` como "luz" es CORRECTO, no una perdida.
 *
 * EL TEST QUE SI FUNCIONA no necesita lista de palabras: **un nombre propio nunca
 * aparece en minuscula en el corpus.** "Ludovico" nunca; "light" a cada rato. Se
 * recorre el corpus entero una vez, se junta el vocabulario en minuscula, y una
 * palabra capitalizada solo cuenta como nombre propio si NUNCA aparece en
 * minuscula. Es determinista, sale de los datos y no hay que mantener nada.
 */
const enMinuscula = new Set<string>();
for (const c of chunks) {
  for (const w of c.text.match(/\b[a-z]{4,}\b/g) ?? []) enMinuscula.add(w);
}

function nombresDe(t: string): string[] {
  const out = new Set<string>();
  for (const w of t.match(/\b[A-Z][a-z]{3,}\b/g) ?? []) {
    if (!enMinuscula.has(w.toLowerCase())) out.add(w);
  }
  return [...out];
}

/**
 * Un nombre "sobrevive" si aparece igual O con una raiz compartida de 5 letras.
 * La tolerancia es deliberada: "Florence" -> "Florencia" y "Milan" -> "Milán"
 * son traducciones CORRECTAS, y exigir literalidad marcaria como fallo el buen
 * trabajo. Lo que se busca es el nombre que DESAPARECIO, no el que se adapto.
 */
function sobrevive(nombre: string, pajar: string): boolean {
  const n = plano(nombre);
  if (pajar.includes(n)) return true;
  return n.length >= 5 && pajar.includes(n.slice(0, 5));
}

/**
 * LAS DOS VOCES, POR SEPARADO. Ver D-125.
 *
 * Mezclar los conteos escondería un problema real: si la traducción de Richter
 * saliera peor que la de Leonardo, un promedio único lo disimularía. Cada voz
 * tiene su propia fila y su propio veredicto.
 */
const VOCES = ["leonardo", "richter"] as const;
const args = process.argv.slice(2);
const soloVoz = args.includes("--voz") ? args[args.indexOf("--voz") + 1] : null;
const voces = soloVoz ? VOCES.filter((v) => v === soloVoz) : VOCES;

interface Resultado {
  voz: string; conTraduccion: number; sinTraducir: string[]; vacios: string[];
  faltanNumeros: { id: string; falta: string[] }[]; faltanNombres: { id: string; falta: string[] }[];
}

function medir(voz: string): Resultado {
  const r: Resultado = { voz, conTraduccion: 0, sinTraducir: [], vacios: [], faltanNumeros: [], faltanNombres: [] };
  for (const c of chunks) {
    if (c.voice !== voz) continue;
    if (!c.textoEs) { r.sinTraducir.push(c.id); continue; }
    if (!c.textoEs.trim()) { r.vacios.push(c.id); continue; }
    r.conTraduccion++;

    const es = plano(c.textoEs);
    const fn = numerosDe(c.text).filter((n) => !c.textoEs!.includes(n));
    if (fn.length) r.faltanNumeros.push({ id: c.id, falta: fn });

    const fnom = nombresDe(c.text).filter((n) => !sobrevive(n, es));
    if (fnom.length) r.faltanNombres.push({ id: c.id, falta: fnom });
  }
  return r;
}

const pct = (a: number, b: number): string => b ? `${((a / b) * 100).toFixed(1)}%` : "n/a";

console.log(`\n# Control de la traducción congelada (D-079, D-125)\n`);

const resultados = voces.map(medir);
for (const r of resultados) {
  console.log(`## voz: ${r.voz}\n`);
  console.log(`Con traducción                 : ${r.conTraduccion}`);
  console.log(`Sin traducción (cae al inglés)  : ${r.sinTraducir.length}`);
  console.log(`Traducción vacía                : ${r.vacios.length}`);
  console.log(`\n| chequeo | chunks limpios | con faltantes |`);
  console.log(`|---|---:|---:|`);
  console.log(`| números sobreviven | ${r.conTraduccion - r.faltanNumeros.length} ` +
              `(${pct(r.conTraduccion - r.faltanNumeros.length, r.conTraduccion)}) | ${r.faltanNumeros.length} |`);
  console.log(`| nombres propios sobreviven | ${r.conTraduccion - r.faltanNombres.length} ` +
              `(${pct(r.conTraduccion - r.faltanNombres.length, r.conTraduccion)}) | ${r.faltanNombres.length} |\n`);
}

// El resto del reporte (listas detalladas) usa la voz con más faltantes, o la
// única pedida por --voz. Evita un reporte doble cuando sólo interesa una.
const { conTraduccion, faltanNumeros, faltanNombres, vacios, sinTraducir } =
  resultados.reduce((a, b) => (a.faltanNumeros.length + a.faltanNombres.length >=
                                b.faltanNumeros.length + b.faltanNombres.length ? a : b));

if (faltanNumeros.length) {
  console.log(`\n## Numeros que no sobrevivieron (${faltanNumeros.length})\n`);
  for (const f of faltanNumeros) console.log(`- \`${f.id}\` — ${f.falta.join(", ")}`);
}

/**
 * Se agrupa POR NOMBRE y no por chunk, porque la pregunta que importa no es
 * "cuantos chunks tienen un faltante" sino "que nombres se estan perdiendo". Un
 * nombre que falta 60 veces es una clase de traduccion (`North` -> "norte", que
 * es CORRECTO y este chequeo no puede distinguir); un nombre que falta una vez y
 * es una persona es una perdida real. Ordenado por frecuencia, la lista se
 * revisa de un vistazo y la cola es la unica parte interesante.
 */
if (faltanNombres.length) {
  const cuenta = new Map<string, number>();
  for (const f of faltanNombres) for (const n of f.falta) cuenta.set(n, (cuenta.get(n) ?? 0) + 1);
  const orden = [...cuenta].sort((a, b) => b[1] - a[1]);
  console.log(`\n## Nombres propios sin correspondencia — ${cuenta.size} distintos ` +
              `en ${faltanNombres.length} chunks\n`);
  console.log(`Los frecuentes suelen ser traduccion legitima (North -> norte).`);
  console.log(`Los de aparicion unica son los que hay que mirar.\n`);
  console.log(`| nombre | chunks |`);
  console.log(`|---|---:|`);
  for (const [n, k] of orden.slice(0, 20)) console.log(`| ${n} | ${k} |`);
  const unicos = orden.filter(([, k]) => k === 1).map(([n]) => n);
  console.log(`\n**Aparecen en un solo chunk (${unicos.length}):** ${unicos.slice(0, 60).join(", ")}` +
              (unicos.length > 60 ? ` … y ${unicos.length - 60} mas` : ""));
}

if (vacios.length) console.log(`\n## Traducciones vacias\n\n${vacios.join(", ")}`);

console.log(`\n> Este chequeo NO mide si la traduccion es buena: mide que no haya`);
console.log(`> perdido los elementos duros que el juez despues va a buscar. El`);
console.log(`> desplazamiento de matiz sigue sin medirse (ver D-084 §5c).`);
