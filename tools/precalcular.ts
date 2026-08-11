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
import { pipeline } from "@huggingface/transformers";
import { cargarMotor, decidirCon, type Idioma } from "../src/lib/grounding.js";
import { citasInvalidas, quitarComillasInvalidas, podarTrasDeclinar } from "../src/lib/citas.js";
import { construirPrompt, huellaPrompt, proveedorPorId } from "../src/lib/llm.js";

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
const PREGUNTAS: { id: string; es: string; en: string }[] = [
  { id: "cielo",       es: "¿Por qué el cielo es azul?",
                       en: "Why is the sky blue?" },
  { id: "conchas",     es: "¿Por qué hay conchas marinas en la cima de las montañas?",
                       en: "Why are sea shells found on mountain tops?" },
  { id: "proporciones", es: "¿Cuáles son las proporciones perfectas del cuerpo humano?",
                       en: "What are the perfect proportions of the human body?" },
  { id: "batalla",     es: "¿Cómo se pinta una batalla?",
                       en: "How do you paint a battle?" },
  { id: "aprender",    es: "¿Cómo se aprende a pintar?",
                       en: "How does one learn to paint?" },
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

/** La misma huella que el runner, para que una entrada vencida se detecte sola. */
const h = (u: URL): string =>
  existsSync(u) ? createHash("sha256").update(readFileSync(u)).digest("hex").slice(0, 8) : "-";
const VARIANTE =
  (existsSync(new URL("chunks_es.json", ART))
    ? "es:" + h(new URL("chunks_es.json", ART)) : "en")
  + "|cv3|ix:" + [
    h(new URL("index.bin", ART)), h(new URL("es/index.bin", ART)),
    h(new URL("thresholds.json", ART)), h(new URL("es/thresholds.json", ART)),
    h(new URL("curaduria.json", ART)),
  ].join(".");
const HUELLA = huellaPrompt(VARIANTE);

const motor = cargarMotor(ART);
const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");
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
const vigentes = new Map<string, Fija>();
if (!forzar && previo.respuestas) {
  for (const r of previo.respuestas) if (r.huella === HUELLA) vigentes.set(`${r.id}:${r.lang}`, r);
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
    const d = decidirCon(motor, pregunta, await embeber(pregunta), lang, 3);
    if (d.tipo !== "responde") {
      // Una sugerencia que el gate frena no puede estar en la puerta de entrada.
      rechazadas.push(`${clave} — el gate devolvió «${d.tipo}»`);
      console.log(`  ✗ ${clave.padEnd(16)} el gate no responde (${d.tipo})`);
      continue;
    }

    const pasajesPrompt = d.pasajes.map((x) => ({ ...x.chunk }));
    const textosVistos = pasajesPrompt.map((x) => (lang === "es" && x.textoEs) ? x.textoEs! : x.text);
    const { system, messages } = construirPrompt(pregunta, pasajesPrompt, [], lang);

    /**
     * PAUSA ENTRE LLAMADAS. La primera versión copió el bucle de generación del
     * runner **sin su limitador de ritmo** y se comió un 429 en la segunda
     * llamada. `run.ts` tiene `PresupuestoTpm` y un tope de requests; este script
     * no, así que la pausa hace de limitador pobre. Son 10 llamadas: no hace
     * falta más, pero cero sí era muy poco.
     */
    await new Promise((res) => setTimeout(res, 4000));

    // Mismo bucle de garantías que el runner. Ni una regla distinta.
    let r = await proveedor.generar(system, messages);
    let reintentosCita = 0;
    for (let i = 0; i < 2; i++) {
      if (!r.texto || !citasInvalidas(r.texto, textosVistos).length) break;
      reintentosCita++;
      r = await proveedor.generar(system, messages);
    }
    if (!r.texto) { rechazadas.push(`${clave} — el proveedor no devolvió texto`); console.log(`  ✗ ${clave.padEnd(16)} sin texto`); continue; }

    const limpio = quitarComillasInvalidas(r.texto, textosVistos);
    const podado = podarTrasDeclinar(limpio.texto);

    /**
     * LA COMPUERTA DE CONGELADO. Tras los reintentos y el descomillado no puede
     * quedar NINGUNA cita sin respaldo. En el runner una respuesta así se guarda
     * igual —esconderla falsearía la tasa— pero acá se serviría mil veces sin
     * que nadie la vuelva a mirar. Se rechaza y se reporta.
     */
    const restantes = citasInvalidas(podado.texto, textosVistos);
    if (restantes.length) {
      rechazadas.push(`${clave} — ${restantes.length} cita(s) sin respaldo tras ${reintentosCita} reintentos`);
      console.log(`  ✗ ${clave.padEnd(16)} NO se congela: cita sin respaldo`);
      continue;
    }

    salida.push({
      id: p.id, lang, pregunta, respuesta: podado.texto,
      pasajes: pasajesPrompt.flatMap((x) => x.richterNos),
      textosVistos, huella: HUELLA, proveedor: idProveedor,
      generado: new Date().toISOString().slice(0, 10),
      reintentosCita, comillasQuitadas: limpio.quitadas, podadas: podado.podadas,
    });
    console.log(`  ✓ ${clave.padEnd(16)} ${podado.texto.replace(/\s+/g, " ").slice(0, 58)}…`);
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
