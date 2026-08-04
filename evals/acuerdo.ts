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
interface Veredicto { id: string; alucina: boolean; error?: string; prompt?: string }

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

const fHumanas = new URL("evals/etiquetas_humanas.jsonl", RAIZ);
if (!existsSync(fHumanas)) {
  console.error("falta evals/etiquetas_humanas.jsonl — hay que etiquetar la muestra primero");
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
const juez = new Map(
  todosVeredictos
    .filter((v) => !v.error && (!soloPromptActual || v.prompt === soloPromptActual))
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

console.log(`# Acuerdo verificador-humano — ${entrada}\n`);
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
if (k >= 0.61) {
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
