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
 * Este script NO escribe nada al producto. Solo mide y ordena.
 */

import { pipeline } from "@huggingface/transformers";
import { Corpus } from "../src/lib/retrieval.js";
import { cargarUmbrales, decidir, type Idioma } from "../src/lib/grounding.js";

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

const corpus = new Corpus(ART);
const umbrales = cargarUmbrales(ART);
const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");

const embeber = async (t: string): Promise<Float32Array> =>
  (await extractor("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

interface Fila {
  tema: string; toc: string;
  margen: number; palabras: number;
  det: Record<Idioma, { cos: number; tau: number; margen: number; pasajes: string; palabras: number }>;
}

const filas: Fila[] = [];
for (const c of CANDIDATAS) {
  const det = {} as Fila["det"];
  for (const idioma of ["es", "en"] as Idioma[]) {
    const d = decidir(corpus, umbrales, c[idioma], await embeber(c[idioma]), idioma, 3);
    if (d.tipo !== "responde") {
      det[idioma] = { cos: d.tipo === "abstiene" ? d.cosMax : 0, tau: d.tipo === "abstiene" ? d.tau : 0,
                      margen: -1, pasajes: "ABSTIENE", palabras: 0 };
      continue;
    }
    det[idioma] = {
      cos: d.cosMax, tau: d.tau, margen: d.cosMax - d.tau,
      pasajes: d.pasajes.map((p) => `R-${p.chunk.richterNo}`).join(" "),
      palabras: d.pasajes.reduce((s, p) => s + p.chunk.nWords, 0),
    };
  }
  filas.push({
    tema: c.tema, toc: c.toc,
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
console.log("| tema | margen min | palabras min | es cos/tau | en cos/tau | pasajes (es) |");
console.log("|---|---:|---:|---|---|---|");
for (const f of filas) {
  const m = f.margen < 0 ? "**ABSTIENE**" : `**+${f.margen.toFixed(4)}**`;
  console.log(`| ${f.tema} | ${m} | ${f.palabras} | ${f.det.es.cos.toFixed(4)}/${f.det.es.tau.toFixed(4)} | ` +
              `${f.det.en.cos.toFixed(4)}/${f.det.en.tau.toFixed(4)} | ${f.det.es.pasajes} |`);
}

console.log("\n## Las cinco mejores\n");
for (const [i, f] of filas.slice(0, 5).entries()) {
  const c = CANDIDATAS.find((x) => x.tema === f.tema)!;
  console.log(`${i + 1}. **${c.es}**`);
  console.log(`   ${c.en}`);
  console.log(`   margen minimo +${f.margen.toFixed(4)} · ${f.palabras} palabras recuperadas · ${f.toc}\n`);
}
