/**
 * Valida la lista curada de la capa 0. Ver D-124.
 *
 *   npm run curadas
 *
 * POR QUE EXISTE. `LISTA_CURADA` es la unica parte del sistema donde una persona
 * escribe a mano algo que el usuario va a leer como respaldado por la fuente. Es
 * exactamente el lugar donde el proyecto no se permite confiar en la buena
 * intencion: D-082 no le pide al modelo que no invente citas, las comprueba; acá
 * pasa lo mismo con las que escribimos nosotros.
 *
 * COMPRUEBA CUATRO COSAS, y las dos ultimas son las que de verdad atajan un
 * desastre:
 *
 *   1. **La nota existe** en el corpus y es de Richter, no de Leonardo. Una nota
 *      con `voice: leonardo` significaria presentar texto del propio Leonardo
 *      como prueba de que Leonardo no escribio nada.
 *   2. **La cita aparece TAL CUAL** en el texto de la nota. Sin esto, un error de
 *      transcripcion al copiarla pone entre comillas algo que la fuente no dice.
 *   3. **Ningun patron matchea una pregunta que el corpus SI contesta.** Es el
 *      riesgo real de esta capa: corre ANTES del retrieval y su veredicto es
 *      inapelable, asi que un patron ancho de mas convierte una buena respuesta
 *      en una abstencion para siempre, en silencio. El caso concreto que casi
 *      pasa: «¿Cómo se aprende a pintar?» es pregunta de portada y esta bien
 *      cubierta (R-483 a R-497), mientras «¿Dónde y con quién aprendiste a
 *      pintar?» es biografia y no lo esta.
 *   4. **Cada caso curado atrapa algo.** Un patron que no matchea ninguna
 *      pregunta conocida no esta protegiendo nada y probablemente esta mal
 *      escrito.
 *
 * Sale con codigo 1 si algo falla, para poder colgarlo de la guarda de regresion.
 */

import { readFileSync, existsSync } from "node:fs";
import { LISTA_CURADA, capaCurada } from "../src/lib/grounding.js";

const RAIZ = new URL("../", import.meta.url);
const chunks: { id: string; voice: string; text: string; richterNo: number | null }[] =
  JSON.parse(readFileSync(new URL("artifacts/chunks.json", RAIZ), "utf8"));

/** La traducción congelada (D-079, D-125), para verificar `citaEs`. */
const fEs = new URL("artifacts/chunks_es.json", RAIZ);
const textosEs: Record<string, { texto: string }> =
  existsSync(fEs) ? JSON.parse(readFileSync(fEs, "utf8")) : {};

interface Caso { id: string; q: string; lang: string; category: string }
const casos: Caso[] = readFileSync(new URL("evals/dataset.jsonl", RAIZ), "utf8")
  .trim().split("\n").filter((l) => l.trim() && !l.startsWith("//")).map((l) => JSON.parse(l));

/** Las 5 de la portada (D-112). Si la capa 0 se come una, se pierde la caché. */
const PORTADA = [
  "¿Por qué el cielo es azul?", "Why is the sky blue?",
  "¿Por qué hay conchas marinas en la cima de las montañas?", "Why are sea shells found on mountain tops?",
  "¿Cuáles son las proporciones perfectas del cuerpo humano?", "What are the perfect proportions of the human body?",
  "¿Cómo se pinta una batalla?", "How do you paint a battle?",
  "¿Cómo se aprende a pintar?", "How does one learn to paint?",
];

let fallos = 0;
const mal = (m: string) => { console.log(`  ❌ ${m}`); fallos++; };
const bien = (m: string) => console.log(`  ✅ ${m}`);

// ---------------------------------------------------------------------------
console.log(`\n## 1 · Las notas existen, son de Richter, y la cita es textual\n`);

for (const c of LISTA_CURADA) {
  if (!c.notaDeRichter) {
    console.log(`  ·  ${c.caso}: sin nota, a propósito (el corpus calla y Richter no lo comenta)`);
    if (c.cita) mal(`${c.caso}: tiene 'cita' pero no 'notaDeRichter' — la cita no se puede verificar`);
    continue;
  }
  const nota = chunks.find((x) => x.id === c.notaDeRichter);
  if (!nota) { mal(`${c.caso}: la nota '${c.notaDeRichter}' NO EXISTE en el corpus`); continue; }
  if (nota.voice !== "richter") {
    mal(`${c.caso}: la nota '${c.notaDeRichter}' es voice='${nota.voice}', tiene que ser 'richter'`);
    continue;
  }
  if (!c.cita) { mal(`${c.caso}: tiene nota pero no 'cita' — se mostraría el chunk entero`); continue; }
  // Normalizado sólo en espacios: el contenido tiene que coincidir carácter a carácter.
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  if (!norm(nota.text).includes(norm(c.cita))) {
    mal(`${c.caso}: la cita (en) NO aparece en ${c.notaDeRichter}\n       buscaba: «${c.cita}»`);
    continue;
  }
  bien(`${c.caso} → ${c.notaDeRichter} · cita (en) verificada (${c.cita.length} car.)`);

  /**
   * `citaEs` CONTRA `textoEs`, NO CONTRA `cita` TRADUCIDA AL VUELO. Sin nota
   * traducida, el fallback documentado es mostrar `cita` en inglés — así que
   * `citaEs` ausente no es un fallo, es D-125 sin llegar todavía a esa nota.
   */
  const traducida = textosEs[c.notaDeRichter]?.texto;
  if (!c.citaEs) {
    if (traducida) mal(`${c.caso}: la nota SÍ está traducida pero falta 'citaEs' — un usuario en` +
                        ` castellano vería la cita en inglés sin necesidad`);
    else console.log(`  ⚠️  ${c.caso}: sin 'citaEs' — la nota ${c.notaDeRichter} no está traducida` +
                      ` todavía, cae a inglés (correcto por ahora)`);
  } else if (!traducida) {
    mal(`${c.caso}: tiene 'citaEs' pero ${c.notaDeRichter} no está en chunks_es.json`);
  } else if (!norm(traducida).includes(norm(c.citaEs))) {
    mal(`${c.caso}: la cita (es) NO aparece en la traducción de ${c.notaDeRichter}\n       buscaba: «${c.citaEs}»`);
  } else {
    bien(`${c.caso} → ${c.notaDeRichter} · cita (es) verificada (${c.citaEs.length} car.)`);
  }
}

// ---------------------------------------------------------------------------
console.log(`\n## 2 · Ningún patrón se come una pregunta que el corpus SÍ contesta\n`);

const enCorpus = casos.filter((c) => c.category.startsWith("in_corpus"));
let colisiones = 0;
for (const c of enCorpus) {
  const cur = capaCurada(c.q);
  if (cur) { mal(`COLISIÓN: «${c.q}» (${c.id}, ${c.category}) la atrapa el caso '${cur.caso}'`); colisiones++; }
}
for (const q of PORTADA) {
  const cur = capaCurada(q);
  if (cur) { mal(`COLISIÓN CON LA PORTADA: «${q}» la atrapa el caso '${cur.caso}'`); colisiones++; }
}
if (!colisiones) {
  bien(`ninguno de los ${enCorpus.length} casos in_corpus ni las ${PORTADA.length} de portada quedan atrapados`);
}

// ---------------------------------------------------------------------------
console.log(`\n## 3 · Cada caso atrapa sus propios ejemplos, y los atrapa ÉL\n`);

for (const c of LISTA_CURADA) {
  if (!c.ejemplos?.length) { mal(`'${c.caso}' no declara ejemplos`); continue; }
  let bienN = 0;
  for (const q of c.ejemplos) {
    const cur = capaCurada(q);
    if (!cur) mal(`'${c.caso}': «${q}» NO la atrapa ningún caso`);
    // Que la atrape OTRO caso no es sólo un detalle de orden: `capaCurada`
    // devuelve el primero que matchea, así que un patrón ancho de más en un caso
    // anterior se lleva silenciosamente la nota que le correspondía a éste.
    else if (cur.caso !== c.caso) mal(`'${c.caso}': «${q}» la atrapa '${cur.caso}' (patrón ancho de más)`);
    else bienN++;
  }
  if (bienN === c.ejemplos.length) bien(`'${c.caso}' atrapa sus ${bienN} ejemplo(s)`);
}

// ---------------------------------------------------------------------------
console.log(`\n## 4 · Cobertura de la categoría F (known_but_unwritten)\n`);

const f = casos.filter((c) => c.category === "known_but_unwritten");
const cubiertos = f.filter((c) => capaCurada(c.q));
console.log(`| id | pregunta | caso curado |`);
console.log(`|---|---|---|`);
for (const c of f) {
  const cur = capaCurada(c.q);
  console.log(`| ${c.id} | ${c.q} | ${cur ? `**${cur.caso}**` : "— (cae al gate)"} |`);
}
console.log(`\n  ${cubiertos.length} de ${f.length} casos F resueltos por la capa 0.`);
console.log(`  Los que caen al gate NO son un fallo: algunos el corpus los contesta de verdad`);
console.log(`  (Salaì tiene 16 chunks de Leonardo; la Última Cena, tres).`);

// ---------------------------------------------------------------------------
console.log(`\n${fallos === 0 ? "OK — la lista curada es consistente" : `${fallos} FALLO(S)`}\n`);
process.exit(fallos ? 1 : 0);
