/**
 * Genera `docs/09-indice.md` a partir del log de decisiones.
 *
 *   npm run indice
 *
 * POR QUE UN ARCHIVO APARTE Y NO UN INDICE AL PRINCIPIO DEL LOG. `09` es
 * append-only (D-036): nunca se reescribe. Un indice al tope habria que
 * reescribirlo con cada entrada nueva, que es exactamente lo que la regla
 * prohibe. Un archivo generado no toca el log y se regenera con un comando.
 *
 * PARA QUE SIRVE. El log tiene 3.100 lineas y es el 42% de toda la
 * documentacion. Quien lo lee —hoy, casi siempre un modelo— no necesita las 97
 * entradas: necesita encontrar las tres que le importan. Cada linea de ruido
 * compite con la senal.
 */

import { readFileSync, writeFileSync } from "node:fs";

const RAIZ = new URL("../", import.meta.url);
const log = readFileSync(new URL("docs/09-decisiones.md", RAIZ), "utf8");
const lineas = log.split("\n");

interface Entrada { id: string; fecha: string; titulo: string; linea: number }
const entradas: Entrada[] = [];

for (const [i, l] of lineas.entries()) {
  /**
   * Patron tolerante a proposito. El primer intento exigia ` · ` literal entre
   * campos y capturo 21 de 98 encabezados: el log tiene tres años de formatos
   * ligeramente distintos y finales de linea mezclados (CRLF en la parte vieja,
   * LF en lo agregado despues). Un indice que se saltea el 78% del log en
   * silencio es peor que no tener indice.
   */
  const limpia = l.replace(/\r/g, "");
  // `[\s·—-]*` y no `\D*`: cualquier clase que incluya letras se come la
  // primera del titulo, y el indice sale con "orpus" en vez de "Corpus".
  const m = /^### (D-\d+)[\s·—-]*(\d{4}-\d{2}-\d{2})[\s·—-]*(.+?)\s*$/.exec(limpia);
  if (m) entradas.push({ id: m[1], fecha: m[2], titulo: m[3].trim(), linea: i + 1 });
}

/**
 * Las fases salen de la fecha, no de un campo: el log no las declara y
 * deducirlas de otra cosa seria inventar estructura que no existe.
 */
const porFecha = new Map<string, Entrada[]>();
for (const e of entradas) {
  const dia = e.fecha;
  porFecha.set(dia, [...(porFecha.get(dia) ?? []), e]);
}

const L: string[] = [];
L.push(`# 09-índice — mapa del log de decisiones\n`);
L.push(`> **Generado.** No editar a mano: \`npm run indice\`.`);
L.push(`> El log (\`09-decisiones.md\`) es append-only y tiene ${lineas.length} líneas.`);
L.push(`> Esto existe para no tener que leerlas todas.\n`);
L.push(`**${entradas.length} decisiones**, de ${entradas[0]?.fecha} a ${entradas.at(-1)?.fecha}.\n`);
L.push(`---\n`);

for (const [dia, es] of porFecha) {
  L.push(`### ${dia}\n`);
  for (const e of es) {
    L.push(`- **${e.id}** · ${e.titulo}  <sub>línea ${e.linea}</sub>`);
  }
  L.push(``);
}

writeFileSync(new URL("docs/09-indice.md", RAIZ), L.join("\n"));
console.log(`${entradas.length} decisiones · docs/09-indice.md`);
