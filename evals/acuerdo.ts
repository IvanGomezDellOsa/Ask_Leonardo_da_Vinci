/**
 * ⚠️ RETIRADO — NO USAR SU NUMERO. Ver D-090, D-091 y D-094.
 *
 * Esta herramienta calcula kappa de Cohen, y **kappa no sirve para medir este
 * fenomeno**. Su propia documentacion de abajo justifica kappa diciendo que el
 * porcentaje bruto enganya con clases desbalanceadas; lo que se midio despues es
 * que **el desbalance rompe a kappa, no al porcentaje**:
 *
 *   dos jueces con 97% de acuerdo dieron kappa = -0,014
 *
 * Es la paradoja de kappa: con prevalencia del 1-2%, el acuerdo esperado por azar
 * ya es del 97%, asi que kappa colapsa a cero por buena que sea la rubrica. Se uso
 * durante una fase entera para declarar rota una rubrica que quizas no lo estaba.
 *
 * LO QUE SE USA EN SU LUGAR: sensibilidad y especificidad del juez contra una
 * referencia humana, mas el acuerdo bruto, mas las disputas enumeradas y
 * adjudicadas una por una — que a esta prevalencia son pocas y por eso tratables.
 *
 * Se conserva el archivo por el log append-only y porque su plomeria —leer
 * etiquetas y veredictos y emparejarlos— sirve para el reemplazo. Fuera de los
 * scripts de npm a proposito: no debe poder correrse por accidente.
 */
/**
 * Mide el acuerdo entre el verificador y el etiquetado humano. Paso 14 de `08`.
 *
 *   npm run evals:acuerdo -- --entrada rag-k3-groq_llama-3_3-70b-versatile.jsonl
 *
 * Lee `evals/etiquetas_humanas.jsonl` y los veredictos del juez, y reporta
 * **kappa de Cohen** sobre el veredicto binario (alucina / no alucina), que es
 * la unidad en la que se publica la metrica.
 *
 * POR QUE KAPPA Y NO EL PORCENTAJE BRUTO
 *
 * `06` fija la meta de alucinacion en < 3%. Con clases tan desbalanceadas, un
 * juez que dijera "no alucina" SIEMPRE acertaria el 97% de las veces y no
 * mediria nada. El porcentaje bruto de acuerdo premia exactamente esa
 * degeneracion; kappa la castiga, porque descuenta el acuerdo esperable por
 * azar dadas las frecuencias marginales de cada anotador.
 *
 * Se reporta ademas el intervalo por bootstrap: con n=30 el kappa puntual tiene
 * mucha varianza y publicarlo solo seria sugerir una precision que no existe.
 *
 * Escala de referencia (Landis & Koch, 1977), que se cita para no inventar una:
 *   < 0,00 peor que el azar · 0,01-0,20 leve · 0,21-0,40 aceptable
 *   0,41-0,60 moderado · 0,61-0,80 sustancial · 0,81-1,00 casi perfecto
 */

import { existsSync } from "node:fs";
import { RAIZ, SALIDAS, cargarCasos, leerJsonl } from "./comun.js";

interface Humana { id: string; alucina: boolean; nota?: string }
interface Veredicto { id: string; alucina: boolean; error?: string; prompt?: string; juez?: string }

const args = process.argv.slice(2);
const arg = (n: string, def: string): string => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const entrada = arg("entrada", "");
if (!entrada) { console.error("falta --entrada <archivo.jsonl>"); process.exit(1); }
// Sin esto, un caso que todavia no se re-juzgo tras un cambio de prompt (D-070)
// aportaria su veredicto VIEJO al kappa, silenciosamente, porque `leerJsonl`
// solo garantiza "la ultima fila", no "la del prompt actual".
const soloPromptActual = arg("prompt", "");
/**
 * El instrumento es el par (modelo, prompt). Filtrar por prompt NO alcanza: al
 * cambiar de juez las instrucciones no cambian, asi que `gpt-oss-120b` y
 * `gemini-3.1-flash-lite` comparten huella de prompt y un filtro por prompt
 * solo los mezclaria sin que nada lo señalara.
 */
const soloJuez = arg("juez", "");

/**
 * Contra que se compara. Por defecto, etiquetas HUMANAS — que es lo unico que
 * `06` v3 §5 acepta para validar el instrumento.
 *
 * D-073: el archivo que ocupaba ese nombre resulto ser etiquetado por un modelo,
 * no a mano, y su propia cabecera afirmaba lo contrario. El kappa que salia de
 * ahi no era acuerdo verificador-humano sino acuerdo entre dos modelos, y se
 * reporto durante toda una fase como si fuera lo primero.
 *
 * Por eso el default apunta a un archivo que HOY NO EXISTE, y el script falla
 * ruidosamente en vez de caer a la referencia mas cercana. Comparar contra
 * etiquetas de modelo sigue siendo posible y util, pero hay que pedirlo
 * explicito con `--referencia`, y la salida lo dice en cada corrida.
 */
const nombreRef = arg("referencia", "etiquetas_humanas.jsonl");
const esHumana = nombreRef === "etiquetas_humanas.jsonl";
const fHumanas = new URL(`evals/${nombreRef}`, RAIZ);
if (!existsSync(fHumanas)) {
  console.error(`falta evals/${nombreRef}`);
  if (esHumana) {
    console.error(`
  No hay etiquetas humanas todavia. \`06\` v3 §5 pide validar el juez contra
  casos etiquetados A MANO, y eso no se puede sustituir por otro modelo: dos
  modelos que aplican la misma rubrica comparten sus mismos puntos ciegos, asi
  que su acuerdo no mide si el instrumento sirve (D-073).

  Para etiquetar:  npm run evals:muestra -- --entrada <corrida>.jsonl
  y volcar los veredictos a evals/etiquetas_humanas.jsonl.

  Para comparar contra etiquetas de modelo, a sabiendas de que NO valida:
    --referencia etiquetas_modelo_a.jsonl`);
  }
  process.exit(1);
}
const humanas = new Map(leerJsonl<Humana>(fHumanas).map((h) => [h.id, h]));
const todosVeredictos = leerJsonl<Veredicto>(
  new URL(entrada.replace(/\.jsonl$/, "") + ".veredictos.jsonl", SALIDAS));
const promptsVistos = new Set(todosVeredictos.map((v) => v.prompt).filter(Boolean));
if (!soloPromptActual && promptsVistos.size > 1) {
  console.error(`AVISO: el archivo tiene veredictos de ${promptsVistos.size} prompts distintos ` +
                `(${[...promptsVistos].join(", ")}). Pasa --prompt <huella> para comparar solo uno; ` +
                "si no, se usan todos mezclados y el kappa mide un instrumento que no es uno solo.");
}
const juecesVistos = new Set(todosVeredictos.map((v) => v.juez).filter(Boolean));
if (!soloJuez && juecesVistos.size > 1) {
  console.error(`AVISO: el archivo tiene veredictos de ${juecesVistos.size} jueces distintos ` +
                `(${[...juecesVistos].join(", ")}). Pasa --juez <modelo> para comparar solo uno.`);
}
const juez = new Map(
  todosVeredictos
    .filter((v) => !v.error
                && (!soloPromptActual || v.prompt === soloPromptActual)
                && (!soloJuez || v.juez === soloJuez))
    .map((v) => [v.id, v]));
const casos = new Map(cargarCasos().map((c) => [c.id, c]));

const pares = [...humanas.entries()]
  .filter(([id]) => juez.has(id))
  .map(([id, h]) => ({ id, humano: h.alucina, maquina: juez.get(id)!.alucina, nota: h.nota }));

if (!pares.length) { console.error("sin pares comparables"); process.exit(1); }

/** Kappa de Cohen sobre una lista de pares binarios. */
function kappa(ps: { humano: boolean; maquina: boolean }[]): number {
  const n = ps.length;
  const a = ps.filter((p) => p.humano && p.maquina).length;       // ambos: alucina
  const b = ps.filter((p) => p.humano && !p.maquina).length;      // humano si, juez no
  const c = ps.filter((p) => !p.humano && p.maquina).length;      // juez si, humano no
  const d = ps.filter((p) => !p.humano && !p.maquina).length;     // ambos: no
  const po = (a + d) / n;
  const pe = ((a + b) / n) * ((a + c) / n) + ((c + d) / n) * ((b + d) / n);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

const n = pares.length;
const vp = pares.filter((p) => p.humano && p.maquina).length;
const fn = pares.filter((p) => p.humano && !p.maquina).length;
const fp = pares.filter((p) => !p.humano && p.maquina).length;
const vn = pares.filter((p) => !p.humano && !p.maquina).length;
const po = (vp + vn) / n;
const k = kappa(pares);

// Bootstrap con semilla fija, para que el intervalo sea reproducible.
let s = 20260803;
const rnd = (): number => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
const ks: number[] = [];
for (let i = 0; i < 5000; i++) {
  const m = Array.from({ length: n }, () => pares[Math.floor(rnd() * n)]);
  const kk = kappa(m);
  if (Number.isFinite(kk)) ks.push(kk);
}
ks.sort((x, y) => x - y);
const ic = [ks[Math.floor(0.025 * ks.length)], ks[Math.floor(0.975 * ks.length)]];

const escala = (v: number): string =>
  v < 0 ? "peor que el azar" : v <= 0.20 ? "leve" : v <= 0.40 ? "aceptable"
  : v <= 0.60 ? "moderado" : v <= 0.80 ? "sustancial" : "casi perfecto";

console.log(`# Acuerdo verificador-${esHumana ? "humano" : "referencia"} — ${entrada}\n`);
if (!esHumana) {
  console.log(`> **ESTO NO VALIDA EL INSTRUMENTO.** La referencia es \`${nombreRef}\`, que NO son`);
  console.log("> etiquetas humanas. Dos modelos aplicando la misma rubrica comparten puntos");
  console.log("> ciegos, asi que su acuerdo no dice si el juez sirve — solo dice cuanto se");
  console.log("> parecen entre si. `06` v3 §5 exige etiquetado a mano. Ver D-073.\n");
}
console.log(`Casos comparados: **${n}**\n`);
console.log("|  | juez: alucina | juez: no |");
console.log("|---|---:|---:|");
console.log(`| **humano: alucina** | ${vp} | ${fn} |`);
console.log(`| **humano: no** | ${fp} | ${vn} |`);
console.log();
console.log(`- acuerdo bruto      : **${(100 * po).toFixed(1)}%**`);
console.log(`- **kappa de Cohen**  : **${k.toFixed(3)}**  (${escala(k)})`);
console.log(`- IC 95% (bootstrap) : [${ic[0].toFixed(3)}, ${ic[1].toFixed(3)}]`);
console.log(`- prevalencia humana : ${(100 * (vp + fn) / n).toFixed(1)}% de alucinacion`);
console.log(`- prevalencia juez   : ${(100 * (vp + fp) / n).toFixed(1)}%`);
console.log();

if (fp || fn) {
  console.log("## Desacuerdos\n");
  for (const p of pares.filter((x) => x.humano !== x.maquina)) {
    const c = casos.get(p.id)!;
    console.log(`- \`${p.id}\` [${c.category}] — humano: **${p.humano ? "alucina" : "ok"}** · ` +
                `juez: **${p.maquina ? "alucina" : "ok"}**`);
    if (p.nota) console.log(`  > ${p.nota}`);
  }
  console.log();
}

console.log("## Veredicto sobre el instrumento\n");
if (!esHumana) {
  console.log(`kappa ${k.toFixed(3)} contra \`${nombreRef}\`. **No hay veredicto posible sobre el`);
  console.log("instrumento**: la referencia no es humana, y validar un modelo contra otro");
  console.log("modelo no es validar. Este numero sirve para estudiar la rubrica (si dos");
  console.log("aplicaciones independientes no concuerdan, la rubrica esta subespecificada),");
  console.log("no para autorizar la publicacion de la tasa de alucinacion.");
} else if (k >= 0.61) {
  console.log(`kappa ${k.toFixed(3)} es acuerdo ${escala(k)}. **El verificador se puede usar**,`);
  console.log("publicando este numero junto con la tasa de alucinacion.");
} else {
  console.log(`kappa ${k.toFixed(3)} es acuerdo ${escala(k)}. **El verificador NO se puede usar todavia**`);
  console.log("para producir la metrica publicada: hay que corregirlo contra estas etiquetas");
  console.log("humanas y volver a medir. Publicar un numero salido de un instrumento con este");
  console.log("acuerdo seria exactamente lo que `06` v3 punto 5 quiere evitar.");
}
if (ic[0] < 0.61 && k >= 0.61) {
  console.log(`\n> Ojo: el limite inferior del IC es ${ic[0].toFixed(3)}. Con n=${n} el intervalo`);
  console.log("> es ancho y el punto solo no alcanza para afirmar acuerdo sustancial.");
}
