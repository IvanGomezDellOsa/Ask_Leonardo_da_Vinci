/**
 * Mide candidatas a preguntas sugeridas de la puerta de entrada.
 *
 *   npx tsx tools/medir_sugeridas.ts
 *
 * R18 es un riesgo existencial: las preguntas de entrada mas probables caen
 * FUERA del corpus (Mona Lisa 0 menciones, Miguel Angel 0). La mitigacion de
 * D-025 es que la primera pregunta caiga dentro por construccion, derivando las
 * sugerencias de los titulos tematicos de Richter.
 *
 * "Derivar de los titulos" garantiza que el TEMA existe. No garantiza que la
 * pregunta RECUPERE bien: un titulo puede cubrir pasajes de ocho palabras. Por
 * eso se mide cada candidata contra el indice real y se ordena por margen sobre
 * tau y por sustancia de lo recuperado.
 *
 * ESTE SCRIPT AHORA SI ESCRIBE AL PRODUCTO: `artifacts/sugeridas.json`, con las
 * candidatas que pasan. Ver D-102.
 *
 * LA REGLA QUE FALTABA, Y ES LA DE D-088. Pasar el gate y traer muchas palabras
 * no alcanza: dice que se recupero ALGO, no que se recupero LO PROMETIDO. Una
 * sugerencia es una promesa —"preguntame esto, que de esto se"— y si el top-3
 * cae en otro tema, la puerta de entrada del producto miente en el primer clic.
 *
 * Se agrega la comprobacion mecanica: **al menos un pasaje recuperado tiene que
 * caer en el rango de numeros de Richter que nombra la entrada del indice de
 * contenidos**, en los DOS idiomas. Es la misma verdad de `expected_topic` que
 * `recall_k.ts` usa para la categoria B, y usa la MISMA funcion, no una copia.
 *
 * Por que importa tanto aca: medido en D-099, solo 193 chunks de 1.404 entran
 * alguna vez al top-3 de las 120 preguntas del eval set. Buena parte del corpus
 * es inalcanzable, y una sugerencia sobre un tema inalcanzable es exactamente la
 * promesa que el retrieval no puede cumplir.
 */

import { writeFileSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";
import { Corpus, rangosDeRichter, caeEnRangos } from "../src/lib/retrieval.js";
import { cargarMotor, decidirCon, type Idioma } from "../src/lib/grounding.js";

const ART = new URL("../artifacts/", import.meta.url);

/** Candidatas: pares es/en derivados de entradas del indice de contenidos. */
const CANDIDATAS: { tema: string; es: string; en: string; toc: string }[] = [
  { tema: "vuelo", toc: "On Flying machines (1120-1131)",
    es: "¿Puede el hombre volar como los pájaros?", en: "Can man fly as the birds do?" },
  { tema: "proporciones", toc: "The proportions of the whole figure (308-343)",
    es: "¿Cuáles son las proporciones perfectas del cuerpo humano?", en: "What are the perfect proportions of the human body?" },
  { tema: "cielo azul", toc: "On the colour of the atmosphere (300-307)",
    es: "¿Por qué el cielo es azul?", en: "Why is the sky blue?" },
  { tema: "conchas en montañas", toc: "Geological problems (985-994)",
    es: "¿Por qué hay conchas marinas en la cima de las montañas?", en: "Why are sea shells found on mountain tops?" },
  { tema: "batalla", toc: "Of painting battle-pieces (601-603)",
    es: "¿Cómo se pinta una batalla?", en: "How do you paint a battle?" },
  { tema: "diluvio", toc: "Of representing the deluge (607-609)",
    es: "¿Cómo se representa un diluvio?", en: "How is a deluge to be represented?" },
  { tema: "sombra", toc: "Six books on Light and Shade (110-131)",
    es: "¿Cómo debe estudiarse la sombra?", en: "How should shadow be studied?" },
  { tema: "agua", toc: "Of the nature of water (930-960)",
    es: "¿Cómo se mueve el agua?", en: "How does water move?" },
  { tema: "universalidad", toc: "How to acquire universality (503-506)",
    es: "¿Cómo se llega a dominar muchas artes?", en: "How does one come to master many arts?" },
  { tema: "ojo", toc: "The function of the eye (19-29)",
    es: "¿Cómo funciona el ojo?", en: "How does the eye work?" },
  { tema: "aprender", toc: "The course of instruction for an artist (483-497)",
    es: "¿Cómo se aprende a pintar?", en: "How does one learn to paint?" },
  { tema: "luna", toc: "The Moon (892-918)",
    es: "¿Por qué brilla la luna?", en: "Why does the moon shine?" },
  { tema: "árboles", toc: "The law of proportion in the growth of branches (394-411)",
    es: "¿Cómo crecen las ramas de los árboles?", en: "How do the branches of trees grow?" },
  { tema: "emociones", toc: "Of representing the emotions (584)",
    es: "¿Cómo se pintan las emociones en un rostro?", en: "How are emotions painted on a face?" },
  { tema: "pintura vs escultura", toc: "Painting is superior to sculpture (655-656)",
    es: "¿Qué es más difícil, pintar o esculpir?", en: "Which is harder, painting or sculpture?" },
];

/** Un índice por idioma (D-107): se mide lo que el producto hace de verdad. */
const motor = cargarMotor(ART);
const corpus = motor.por.en.corpus;
const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");

const embeber = async (t: string): Promise<Float32Array> =>
  (await extractor("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

interface Fila {
  tema: string; toc: string;
  margen: number; palabras: number;
  /** D-088: ¿el top-3 cae en el tema PROMETIDO, en los dos idiomas? */
  enTema: boolean;
  det: Record<Idioma, { cos: number; tau: number; margen: number; pasajes: string; palabras: number; enTema: boolean }>;
}

const filas: Fila[] = [];
for (const c of CANDIDATAS) {
  const rangos = rangosDeRichter(c.toc);
  const det = {} as Fila["det"];
  for (const idioma of ["es", "en"] as Idioma[]) {
    const d = decidirCon(motor, c[idioma], await embeber(c[idioma]), idioma, 3);
    if (d.tipo !== "responde") {
      det[idioma] = { cos: d.tipo === "abstiene" ? d.cosMax : 0, tau: d.tipo === "abstiene" ? d.tau : 0,
                      margen: -1, pasajes: "ABSTIENE", palabras: 0, enTema: false };
      continue;
    }
    det[idioma] = {
      cos: d.cosMax, tau: d.tau, margen: d.cosMax - d.tau,
      pasajes: d.pasajes.map((p) => `R-${p.chunk.richterNo}`).join(" "),
      palabras: d.pasajes.reduce((s, p) => s + p.chunk.nWords, 0),
      // Sin rangos parseables no se puede afirmar nada, y no afirmar es `false`.
      enTema: rangos.length > 0 && caeEnRangos(d.pasajes.flatMap((p) => p.chunk.richterNos), rangos),
    };
  }
  filas.push({
    tema: c.tema, toc: c.toc,
    enTema: det.es.enTema && det.en.enTema,
    margen: Math.min(det.es.margen, det.en.margen),
    palabras: Math.min(det.es.palabras, det.en.palabras),
    det,
  });
}

// Ordena por el margen del idioma PEOR: una sugerida tiene que funcionar en los
// dos, y el espanol corre ~0,05 mas bajo (D-038). Optimizar por el promedio
// esconderia justo el caso que falla.
filas.sort((a, b) => b.margen - a.margen);

console.log("# Candidatas a preguntas sugeridas — medidas contra el indice real\n");
console.log("Ordenadas por el margen sobre tau del idioma PEOR de los dos: una sugerida");
console.log("tiene que caer dentro del corpus en espanol Y en ingles.\n");
console.log("| tema | en tema | margen min | palabras min | es cos/tau | pasajes (es) |");
console.log("|---|:-:|---:|---:|---|---|");
for (const f of filas) {
  const m = f.margen < 0 ? "**ABSTIENE**" : `+${f.margen.toFixed(4)}`;
  console.log(`| ${f.tema} | ${f.enTema ? "✅" : "❌"} | ${m} | ${f.palabras} | ` +
              `${f.det.es.cos.toFixed(4)}/${f.det.es.tau.toFixed(4)} | ${f.det.es.pasajes} |`);
}

/**
 * EL RANGO DE RICHTER ES UNA PANTALLA, NO UN VEREDICTO — la misma leccion que
 * D-099 tuvo que aprender con `expected_topic`, y que se aplica aca ANTES de
 * equivocarse en vez de despues.
 *
 * De las 5 candidatas que el rango rechazo, se leyeron las 5 y **3 estaban bien
 * contestadas**: el rango nominal del indice de contenidos era mas angosto que
 * el material que el corpus tiene sobre el tema. Un rechazo automatico habria
 * tirado tres sugerencias buenas, incluida "¿como funciona el ojo?".
 *
 * Por eso caer fuera del rango manda a REVISION, no a la basura. Y la revision
 * queda escrita acá, con el motivo, para poder objetarla de a una.
 */
const ADJUDICADAS: Record<string, { acepta: boolean; motivo: string }> = {
  ojo: { acepta: true,
    motivo: "trae R-51 «IN WHAT WAY THE EYE SEES OBJECTS PLACED IN FRONT OF IT» y R-74 sobre refracción en el ojo: contesta la pregunta, sólo que fuera del 19-29 nominal" },
  sombra: { acepta: true,
    motivo: "trae gradación, intensidad y relación entre sombra primaria y derivada; es el tema exacto, fuera del rango de los prolegómenos" },
  universalidad: { acepta: true,
    motivo: "trae R-499 «Nor is the painter praiseworthy who does but one thing well», que ES el argumento de la universalidad, en el rango contiguo 498-502" },
  vuelo: { acepta: false,
    motivo: "FALLO REAL. En inglés trae «OF THE NATURE OF SIGHT», la magnanimidad del halcón y la lealtad de las grullas — bestiario moral, no máquinas voladoras. En castellano sí funciona" },
  "conchas en montañas": { acepta: false,
    motivo: "FALLO REAL. Trae R-1106 «WHY WATER IS FOUND AT THE TOP OF MOUNTAINS» y los Alpes: agua en montañas, no el razonamiento de los fósiles" },
};

const aprobada = (f: Fila): boolean =>
  f.margen > 0 && (f.enTema || ADJUDICADAS[f.tema]?.acepta === true);

const aceptadas = filas.filter(aprobada);
const rechazadas = filas.filter((f) => !aprobada(f));

console.log(`\n## Aceptadas: ${aceptadas.length} de ${filas.length}\n`);
for (const [i, f] of aceptadas.entries()) {
  const c = CANDIDATAS.find((x) => x.tema === f.tema)!;
  console.log(`${i + 1}. **${c.es}**`);
  console.log(`   ${c.en}`);
  console.log(`   margen mínimo +${f.margen.toFixed(4)} · ${f.palabras} palabras · ${f.toc}\n`);
}

console.log(`## Rechazadas: ${rechazadas.length}\n`);
for (const f of rechazadas) {
  const adj = ADJUDICADAS[f.tema];
  const motivo = f.margen < 0 ? "el gate se abstiene" : adj?.motivo ?? "fuera del tema y sin adjudicar";
  console.log(`  ❌ ${f.tema} (${f.toc})`);
  console.log(`     ${motivo}`);
}

writeFileSync("artifacts/sugeridas.json", JSON.stringify({
  regla: "D-088/D-102: pasa el gate en es y en, y el top-3 contesta el tema prometido — por rango de Richter (mecanico) o por lectura adjudicada con motivo. Comprobado con `npm run sugeridas`.",
  generado: new Date().toISOString().slice(0, 10),
  aceptadas: aceptadas.map((f) => {
    const c = CANDIDATAS.find((x) => x.tema === f.tema)!;
    return { tema: f.tema, es: c.es, en: c.en, toc: f.toc,
             margenMinimo: Number(f.margen.toFixed(4)), palabras: f.palabras,
             // Como se aprobo: por rango, o por lectura con motivo escrito.
             via: f.enTema ? "rango" : "lectura",
             motivo: f.enTema ? undefined : ADJUDICADAS[f.tema]?.motivo };
  }),
}, null, 2) + "\n");
console.log(`\nescrito: artifacts/sugeridas.json (${aceptadas.length} sugerencias)`);
