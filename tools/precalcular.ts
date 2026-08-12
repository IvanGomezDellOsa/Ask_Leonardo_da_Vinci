/**
 * Caché N0: las respuestas de las preguntas sugeridas, generadas una vez,
 * verificadas y congeladas. Implementa D-033. Ver D-112.
 *
 *   npm run precalcular              genera las que falten
 *   npm run precalcular -- --forzar  regenera todas
 *
 * TRES RAZONES, Y LA TERCERA ES LA QUE MAS PESA:
 *
 *   1. **Cuota.** Son las preguntas más clickeadas por definición: están en la
 *      puerta de entrada. Servirlas de un archivo las saca del presupuesto de
 *      500 requests/día para siempre.
 *   2. **Latencia y disponibilidad.** Se sirven estáticas, y siguen andando con
 *      la cuota agotada o las funciones pausadas (R17).
 *   3. **Varianza.** El generador corre a temperatura 0,7 (D-085): hoy, hacer
 *      clic dos veces en la misma sugerencia da dos respuestas distintas. Para la
 *      vidriera del proyecto eso es un defecto. Congelada, la respuesta que se
 *      revisó es la que se sirve.
 *
 * ================================================================
 * NO SE ESCRIBE NINGUNA RESPUESTA A MANO. NUNCA.
 * ================================================================
 *
 * La tentación obvia —«ya que las congelamos, redactémoslas bien»— **destruye el
 * proyecto entero**. La tesis es que Leonardo no inventa porque cada cita se
 * comprueba contra el corpus; una respuesta escrita por una persona es una cita
 * que no salió de ningún pasaje, y el 0% de citas inventadas pasaría a ser una
 * afirmación sobre texto que escribimos nosotros.
 *
 * Por eso este script **corre el pipeline real**: el mismo gate, los mismos
 * pasajes recuperados, el mismo prompt, las mismas tres garantías de `citas.ts`.
 * Lo único que agrega es que el resultado se guarda en vez de tirarse.
 *
 * Y **se niega a congelar una respuesta que no verifica**: si tras los reintentos
 * queda una cita sin respaldo, el caso se reporta y no entra al archivo. Una
 * respuesta congelada mala es peor que una generada mala, porque se sirve mil
 * veces y nadie la vuelve a mirar.
 *
 * PROCEDENCIA. Cada entrada guarda la huella del prompt, el proveedor, los
 * pasajes vistos y la fecha. La huella cubre plantilla, corpus, política de
 * generación, índices, umbrales y curaduría (D-081, D-082, D-107): si cualquiera
 * de esas cambia, la entrada queda marcada como **vencida** y hay que
 * regenerarla. Sin eso, la caché sería la novena forma del mismo bug — servir
 * algo viejo creyéndolo nuevo.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { cargarExtractor } from "../src/lib/embed.js";
import { cargarMotor, decidirCon, type Idioma } from "../src/lib/grounding.js";
import { responder } from "../src/lib/responder.js";
import { huellaPrompt, varianteVigente, proveedorPorId } from "../src/lib/llm.js";

const RAIZ = new URL("../", import.meta.url);
const ART = new URL("artifacts/", RAIZ);
const SALIDA = new URL("artifacts/respuestas_fijas.json", RAIZ);

const arg = (n: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : "";
};
const forzar = process.argv.includes("--forzar");

/**
 * LAS CINCO DE LA PUERTA DE ENTRADA, elegidas a mano de las 13 validadas en
 * `sugeridas.json` (D-102). La validación mecánica garantiza que ninguna miente;
 * cuáles se muestran es decisión de producto y por eso están acá y no salen de
 * un `slice` del pool.
 *
 * El criterio del reparto: que un visitante reconozca a Leonardo en el conjunto.
 * Ciencia observacional, geología, anatomía, práctica de taller y pedagogía.
 */
/**
 * Set del 2026-08-11 (D-131), reemplaza al de D-112. Elegido a mano por el
 * dueño del proyecto sobre candidatas medidas contra el índice real —no la
 * plantilla mecánica de `proponer.ts`— y verificado en los dos idiomas antes
 * de congelar: ninguna cae cerca del umbral de abstención. Detalle completo
 * del proceso, incluidas las descartadas y por qué, en D-131.
 */
const PREGUNTAS: { id: string; es: string; en: string }[] = [
  { id: "pintura",     es: "¿Por qué crees que la pintura es superior a las demás artes?",
                       en: "Why do you think painting is superior to the other arts?" },
  { id: "teoria",      es: "¿Cuál es el objetivo de aprender sin haber estudiado primero la teoría?",
                       en: "What is the purpose of learning without first studying theory?" },
  { id: "maxima",      es: "¿Qué máxima te repetías cada noche para dormir en paz y aprovechar la vida?",
                       en: "What maxim did you repeat to yourself each night to sleep in peace and make the most of life?" },
  { id: "estudiar",    es: "¿Por qué dices que estudiar sin ganas arruina la memoria?",
                       en: "Why do you say that studying without desire ruins the memory?" },
  { id: "agua",        es: "¿Por qué te niegas a publicar tus diseños para respirar bajo el agua?",
                       en: "Why do you refuse to publish your designs for breathing underwater?" },
  { id: "noche",       es: "¿Por qué te despiertas en medio de la noche para repasar tus ideas en la oscuridad?",
                       en: "Why do you wake up in the middle of the night to go over your ideas in the dark?" },
];

const claves = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const l of readFileSync(new URL(".env.local", RAIZ), "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[2].trim()) out[m[1]] = m[2].trim();
  }
  return out;
};

const env = claves();
/**
 * DeepSeek por defecto, no Gemini. D-088 lo designó generador porque el free
 * tier de Gemini no aguanta una corrida; acá son sólo 10 llamadas, pero el
 * primer intento se comió un 429 igual.
 */
const idProveedor = arg("proveedor") || "deepseek/deepseek-v4-flash";
const proveedor = proveedorPorId(idProveedor, env);

/** La misma huella que el runner — la MISMA cuenta, no una copia. Ver D-122. */
const VARIANTE = varianteVigente(ART);
const HUELLA = huellaPrompt(VARIANTE);

const motor = cargarMotor(ART);
const extractor = await cargarExtractor();
const embeber = async (t: string): Promise<Float32Array> =>
  (await extractor("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

interface Fija {
  id: string; lang: Idioma; pregunta: string; respuesta: string;
  pasajes: number[]; textosVistos: string[];
  huella: string; proveedor: string; generado: string;
  reintentosCita: number; comillasQuitadas: number; podadas: number;
}

const previo: { huella?: string; respuestas?: Fija[] } =
  existsSync(SALIDA) ? JSON.parse(readFileSync(SALIDA, "utf8")) : {};
/**
 * `id` SOLO, SIN EL TEXTO, NO ALCANZA COMO CLAVE DE VIGENCIA. Encontrado en
 * D-131 antes de que mordiera: la huella no cambia si sólo cambia QUÉ pregunta
 * va bajo un `id` — cubre el corpus, el prompt y los índices, no `PREGUNTAS`.
 * Reusar un `id` de un set anterior (pasó acá: "aprender" cambió de pregunta
 * entre D-112 y D-131) habría servido la respuesta VIEJA bajo el enunciado
 * NUEVO, en silencio. Por eso la vigencia exige también que el texto de la
 * pregunta coincida — no sólo `id` y `huella`.
 */
const vigentes = new Map<string, Fija>();
if (!forzar && previo.respuestas) {
  const preguntaEsperada = new Map<string, string>(
    PREGUNTAS.flatMap((p) => [[`${p.id}:es`, p.es], [`${p.id}:en`, p.en]]));
  for (const r of previo.respuestas) {
    const clave = `${r.id}:${r.lang}`;
    if (r.huella === HUELLA && r.pregunta === preguntaEsperada.get(clave)) vigentes.set(clave, r);
  }
}

console.log(`\n# Caché N0 — respuestas fijas de la puerta de entrada\n`);
console.log(`  huella actual : ${HUELLA}`);
console.log(`  proveedor     : ${idProveedor}`);
console.log(`  ya vigentes   : ${vigentes.size} de ${PREGUNTAS.length * 2}`);
console.log(`  a generar     : ${PREGUNTAS.length * 2 - vigentes.size}\n`);

const salida: Fija[] = [];
const rechazadas: string[] = [];

for (const p of PREGUNTAS) {
  for (const lang of ["es", "en"] as Idioma[]) {
    const clave = `${p.id}:${lang}`;
    const yaEsta = vigentes.get(clave);
    if (yaEsta) { salida.push(yaEsta); console.log(`  = ${clave.padEnd(16)} vigente`); continue; }

    const pregunta = p[lang];

    /**
     * PAUSA ENTRE LLAMADAS. La primera versión copió el bucle del runner sin su
     * limitador de ritmo y se comió un 429 en la segunda llamada (D-112). Son 10
     * llamadas: la pausa alcanza como limitador pobre, pero cero era muy poco.
     */
    await new Promise((res) => setTimeout(res, 4000));

    const R = await responder({
      motor, pregunta, idioma: lang, vector: await embeber(pregunta),
      generar: (sys, msgs) => proveedor.generar(sys, msgs),
    });

    if (R.decision !== "responde") {
      // Una sugerencia que el gate frena no puede estar en la puerta de entrada.
      rechazadas.push(`${clave} — el gate devolvió «${R.decision}»`);
      console.log(`  ✗ ${clave.padEnd(16)} el gate no responde (${R.decision})`);
      continue;
    }
    if (!R.texto) {
      rechazadas.push(`${clave} — el proveedor no devolvió texto`);
      console.log(`  ✗ ${clave.padEnd(16)} sin texto`); continue;
    }
    /**
     * LA COMPUERTA DE CONGELADO, que el runner NO tiene. Si tras los reintentos y
     * el descomillado queda una cita sin respaldo, no entra al archivo. En el
     * runner esa respuesta se guarda igual —esconderla falsearía la tasa— pero
     * acá se serviría mil veces sin que nadie la vuelva a mirar.
     */
    if (R.citasSinRespaldo.length) {
      rechazadas.push(`${clave} — ${R.citasSinRespaldo.length} cita(s) sin respaldo tras ${R.reintentosCita} reintentos`);
      console.log(`  ✗ ${clave.padEnd(16)} NO se congela: cita sin respaldo`);
      continue;
    }

    salida.push({
      id: p.id, lang, pregunta, respuesta: R.texto,
      pasajes: R.pasajes.flatMap((x) => x.chunk.richterNos),
      textosVistos: R.textosVistos, huella: HUELLA, proveedor: idProveedor,
      generado: new Date().toISOString().slice(0, 10),
      reintentosCita: R.reintentosCita, comillasQuitadas: R.comillasQuitadas, podadas: R.podadas,
    });
    console.log(`  ✓ ${clave.padEnd(16)} ${R.texto.replace(/\s+/g, " ").slice(0, 58)}…`);
  }
}

writeFileSync(SALIDA, JSON.stringify({
  regla: "Generadas por el pipeline real y congeladas. NINGUNA se escribe a mano: la tesis del proyecto es que cada cita se comprueba contra el corpus. Una entrada cuya `huella` no coincida con la actual está VENCIDA y hay que regenerarla con `npm run precalcular`. Ver D-112.",
  huella: HUELLA,
  generado: new Date().toISOString().slice(0, 10),
  respuestas: salida,
}, null, 2) + "\n");

console.log(`\n  congeladas : ${salida.length} de ${PREGUNTAS.length * 2}`);
if (rechazadas.length) {
  console.log(`  RECHAZADAS : ${rechazadas.length}`);
  for (const r of rechazadas) console.log(`    ${r}`);
}
console.log(`\nescrito: artifacts/respuestas_fijas.json`);
