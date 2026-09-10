/**
 * Los temas del mapa que el gate NO contesta cuando se les pregunta por su
 * propio nombre — y, para cada uno, si es el coseno o la guarda de anclas.
 *
 *   npm run mapa:abstenciones
 *
 * POR QUE EXISTE. El panel OFRECE 396 temas por idioma: clickear uno y que el
 * sistema conteste «no dejé anotación» es el peor caso posible, porque el
 * tema lo propusimos nosotros. Este script cuenta cuántos son y por qué.
 *
 * ⚠ NO GASTA CUOTA. Sólo el gate: embedding local y coseno. No llama al
 * generador.
 *
 * ⚠ SE VUELVE A CORRER SI CAMBIA EL CORPUS, τ O EL MAPA. Fue lo que destapó
 * D-260: 36 temas se abstenían y 30 de ellos eran falsos positivos de la
 * guarda de anclas de D-231, no del embedding.
 */
import { cargarExtractor } from "../src/lib/embed.js";
import { cargarMotor, decidirCon, type Idioma } from "../src/lib/grounding.js";
import { consultaDe, MAPA } from "../src/data/mapa.js";

const ART = new URL("../artifacts/", import.meta.url);
const motor = cargarMotor(ART);
const extractor = await cargarExtractor();
const embeber = async (t: string): Promise<Float32Array> =>
  (await extractor("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

let totalAbstiene = 0, totalGuarda = 0;

for (const lang of ["es", "en"] as Idioma[]) {
  const { corpus, umbrales } = motor.por[lang];
  const tau = umbrales.tau[lang];
  const filas: string[] = [];
  let temas = 0, porGuarda = 0;

  for (const s of MAPA[lang]) {
    for (const t of s.temas) {
      temas++;
      /** ⚠ LA CONSULTA EFECTIVA, con su refuerzo si lo tiene: es lo que manda
          el clic (D-261). Medir el título pelado mediría otra cosa. */
      const q = consultaDe(t);
      const vec = await embeber(q);
      if (decidirCon(motor, q, vec, lang).tipo !== "abstiene") continue;
      const anclas = corpus.anclas(q, lang).length;
      /**
       * ⚠ EL COSENO **REAL**, salteando la guarda. `decidirCon` devuelve
       * `cosMax: 0` cuando corta en la capa 1a, y ese cero es un centinela, no
       * una medición: leerlo como «el embedding no llega» es exactamente el
       * error que costó D-260.
       */
      const { cosMax } = corpus.buscar(vec, q, "leonardo", 3);
      const culpa = anclas === 0 && cosMax >= tau;
      if (culpa) porGuarda++;
      filas.push(`  ${cosMax.toFixed(4)}  ${anclas === 0 ? "sin anclas" : `${anclas} anclas `}  ` +
                 `${culpa ? "GUARDA" : "coseno"}  ${t.visible.slice(0, 46).padEnd(46)} ${s.seccion}`);
    }
  }

  totalAbstiene += filas.length;
  totalGuarda += porGuarda;
  console.log(`\n## ${lang} — τ ${tau.toFixed(4)} · ${temas} temas`);
  console.log(`   se abstienen: ${filas.length} (${(100 * filas.length / temas).toFixed(1)}%) · por la guarda: ${porGuarda}\n`);
  for (const f of filas) console.log(f);
}

console.log(`\n${totalAbstiene} temas se abstienen en total; ${totalGuarda} por la guarda de anclas.`);
if (totalGuarda > 0) {
  console.log("\n⚠ Un tema «por GUARDA» es un falso positivo: el coseno pasaría τ y la");
  console.log("  guarda de anclas lo corta antes de medirlo. Ver D-231 y D-260.");
  process.exitCode = 1;
}
