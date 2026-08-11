/**
 * Verifica la procedencia y la licencia del corpus. R4, R20, D-024. Ver D-129.
 *
 *   npm run procedencia
 *
 * POR QUE EXISTE. `07-riesgos-y-bugs.md` lista R20 —licencia de Gutenberg y del
 * repositorio— como riesgo abierto, y dice algo que conviene tomarse en serio:
 * «un proyecto cuya tesis es el rigor sobre las fuentes no puede permitirse
 * tenerlas mal». Medido, la mitad de Gutenberg ya estaba bien. **Pero nadie lo
 * habia comprobado nunca**, y una obligacion de licencia que se cumple por
 * accidente se deja de cumplir por accidente.
 *
 * Es el mismo movimiento que `npm run curadas` (D-124): lo que sostiene una
 * afirmacion publica se comprueba, no se recuerda.
 *
 * TRES COSAS, y cada una responde a una obligacion distinta:
 *
 *   1. **Los fuentes son bit a bit los declarados** (R4/D-024). Si el HTML que
 *      se parsea no es el que dice `checksums.json`, todo lo que el proyecto
 *      afirma sobre el corpus se apoya en un archivo que nadie identifico.
 *   2. **La cabecera y la licencia de Gutenberg siguen en el archivo crudo.**
 *      Es lo que su licencia pide para redistribuir la obra marcada tal cual, y
 *      es la razon por la que se puede commitear (R4).
 *   3. **Cero boilerplate de Gutenberg en el corpus que se SIRVE.** Es la otra
 *      cara: el texto derivado no lleva la marca, y ademas ese boilerplate no
 *      es ni de Leonardo ni de Richter — si se colara, el sistema lo citaria
 *      como si lo fuera. Acá la obligacion legal y la tesis del proyecto piden
 *      exactamente lo mismo.
 *
 * LO QUE ESTE CHEQUEO NO CUBRE: la licencia del CODIGO del repositorio, que es
 * la otra mitad de R20 y es una decision del dueño, no una comprobacion.
 */

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const RAIZ = new URL("../", import.meta.url);

let fallos = 0;
const mal = (m: string) => { console.log(`  ❌ ${m}`); fallos++; };
const bien = (m: string) => console.log(`  ✅ ${m}`);

// ---------------------------------------------------------------------------
console.log(`\n## 1 · Las fuentes son bit a bit las declaradas (R4, D-024)\n`);

interface Meta { bytes: number; sha256: string; url: string; rol: string }
const checksums: Record<string, Meta> =
  JSON.parse(readFileSync(new URL("pipeline/raw/checksums.json", RAIZ), "utf8"));

for (const [nombre, meta] of Object.entries(checksums)) {
  const f = new URL(`pipeline/raw/${nombre}`, RAIZ);
  if (!existsSync(f)) { mal(`${nombre}: no está en el repo`); continue; }
  const buf = readFileSync(f);
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== meta.sha256) { mal(`${nombre}: sha256 NO coincide (${sha.slice(0, 16)}…)`); continue; }
  if (buf.length !== meta.bytes) { mal(`${nombre}: ${buf.length} bytes, declarados ${meta.bytes}`); continue; }
  bien(`${nombre} · ${meta.bytes.toLocaleString()} B · sha256 coincide · ${meta.rol}`);
}

// ---------------------------------------------------------------------------
console.log(`\n## 2 · La licencia de Gutenberg sigue en el archivo crudo\n`);

/**
 * Las tres marcas que la licencia de Gutenberg pide conservar al redistribuir
 * la obra marcada: el encabezado, y los dos delimitadores que acotan el texto.
 * Sin el bloque final, se estaria redistribuyendo la marca sin sus terminos.
 */
const crudo = readFileSync(new URL("pipeline/raw/pg5000.txt", RAIZ), "utf8");
const exigidas: [string, RegExp][] = [
  ["encabezado del eBook", /The Project Gutenberg eBook of/i],
  ["delimitador de inicio", /\*\*\* START OF THE PROJECT GUTENBERG EBOOK/i],
  ["delimitador de fin", /\*\*\* END OF THE PROJECT GUTENBERG EBOOK/i],
  ["texto completo de la licencia", /Section 1\.\s+General Terms of Use/i],
];
for (const [que, re] of exigidas) {
  if (re.test(crudo)) bien(`${que} presente`);
  else mal(`${que} AUSENTE — no se puede redistribuir la obra marcada así`);
}

// ---------------------------------------------------------------------------
console.log(`\n## 3 · Cero boilerplate de Gutenberg en el corpus que se sirve\n`);

/**
 * Se buscan las marcas del boilerplate, NO la palabra "Gutenberg" a secas: el
 * campo `url` de cada chunk apunta legítimamente a gutenberg.org y eso es
 * atribución de la fuente, que es lo correcto. Lo que no puede aparecer es el
 * texto del aparato legal DENTRO de un pasaje, porque se serviría como si
 * fuera de Leonardo o de Richter.
 */
const BOILERPLATE: RegExp[] = [
  /Project Gutenberg/i, /gutenberg\.org/i, /PGLAF/i, /Michael S\. Hart/i,
  /Literary Archive Foundation/i, /1\.E\.[0-9]/, /Section 1\.\s+General Terms/i,
];

interface Chunk { id: string; voice: string; text: string; url: string | null }
const chunks: Chunk[] = JSON.parse(readFileSync(new URL("artifacts/chunks.json", RAIZ), "utf8"));

const sucios: string[] = [];
for (const c of chunks) {
  if (BOILERPLATE.some((p) => p.test(c.text))) sucios.push(c.id);
}
if (sucios.length) mal(`${sucios.length} chunks con boilerplate en el texto: ${sucios.slice(0, 8).join(", ")}`);
else bien(`0 de ${chunks.length} chunks en inglés con boilerplate en el texto`);

// La traducción es opcional: sin ella el sistema funciona en inglés (D-079).
const fEs = new URL("artifacts/chunks_es.json", RAIZ);
if (existsSync(fEs)) {
  const es: Record<string, { texto: string }> = JSON.parse(readFileSync(fEs, "utf8"));
  const suciosEs = Object.entries(es)
    .filter(([, v]) => BOILERPLATE.some((p) => p.test(v.texto)))
    .map(([id]) => id);
  if (suciosEs.length) mal(`${suciosEs.length} chunks traducidos con boilerplate: ${suciosEs.slice(0, 8).join(", ")}`);
  else bien(`0 de ${Object.keys(es).length} chunks en castellano con boilerplate en el texto`);
}

const conAtribucion = chunks.filter((c) => c.url && /gutenberg\.org/i.test(c.url)).length;
bien(`${conAtribucion} chunks enlazan la fuente en gutenberg.org (atribución, no marca)`);

// ---------------------------------------------------------------------------
console.log(`\n## 4 · Lo que este chequeo NO cubre\n`);
const hayLicencia = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCIA.md"]
  .some((n) => existsSync(new URL(n, RAIZ)));
console.log(`  ${hayLicencia ? "·" : "⚠️ "} Licencia del código del repositorio: ` +
            `${hayLicencia ? "presente" : "**NO HAY ARCHIVO DE LICENCIA**"}`);
console.log(`     Es la otra mitad de R20 y es una decisión del dueño, no una comprobación.`);
console.log(`     Sin archivo de licencia, un repo público **no** concede permiso de uso: el`);
console.log(`     default legal es «todos los derechos reservados», que probablemente no es`);
console.log(`     lo que un proyecto de portfolio quiere decir.`);

console.log(`\n${fallos === 0 ? "OK — la procedencia del corpus es verificable" : `${fallos} FALLO(S)`}\n`);
process.exit(fallos ? 1 : 0);
