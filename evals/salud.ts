/**
 * Un solo comando que lee los indicadores de las tres garantias mecanicas.
 *
 *   npm run salud                       la corrida mas reciente
 *   npm run salud -- --archivo <nombre> una en particular
 *
 * POR QUE EXISTE. `reintentosCita`, `comillasQuitadas` y `podadas` se escriben
 * en cada fila desde D-082, D-083 y D-093 **y no los leia ningun codigo
 * permanente**. Se miraron siempre con scripts descartables, que es como se colo
 * el bug de los acentos: un indicador que nadie lee de forma sistematica es un
 * indicador que no existe.
 *
 * LO PRIMERO QUE ENCONTRO, apenas se escribio: **`podadas` es 0 en las
 * dieciseis corridas guardadas.** La tercera garantia de D-093 no se disparo
 * nunca. No es necesariamente un defecto —puede ser que el modelo siempre cite
 * despues de declinar, que es justo lo que se le pide— pero nadie lo sabia, y
 * llevaba meses escrito en el JSONL.
 *
 * QUE NUMERO ES CADA COSA, porque no son de la misma clase y mezclarlos es el
 * error que este proyecto comete una y otra vez:
 *
 *   registrado    lo que la corrida guardo. Es un hecho del pasado.
 *   recalculado   lo que el codigo de HOY haria con esas mismas respuestas.
 *                 Sirve para ver el efecto de tocar `citas.ts` sin gastar cuota.
 *   abstencion    es una PANTALLA, no un veredicto: depende de `RE_DECLINA`, y
 *                 una regex no es un clasificador. Ver la advertencia al pie.
 */

import { readdirSync, statSync } from "node:fs";
import { RE_DECLINA, podarTrasDeclinar, palabras } from "../src/lib/citas.js";
import { cargarCasos, leerJsonl, SALIDAS, type Resultado } from "./comun.js";

const arg = (n: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "";
};

/**
 * La mas reciente por FECHA DE MODIFICACION, no por nombre. Ordenar por nombre
 * elegia `rag-k3-groq_...` —la primera corrida del proyecto— porque la `g` va
 * despues de la `d` de deepseek y de la `f` de final. Un default que apunta en
 * silencio a la corrida equivocada es como se lee un numero viejo creyendolo
 * nuevo, que es el defecto que D-080 tuvo que arreglar en el verificador.
 */
const archivo = arg("archivo") || readdirSync(SALIDAS)
  .filter((f) => f.endsWith(".jsonl") && !f.includes("veredictos"))
  .map((f) => ({ f, t: statSync(new URL(f, SALIDAS)).mtimeMs }))
  .sort((a, b) => a.t - b.t).at(-1)!.f;

const filas = leerJsonl<Resultado>(new URL(archivo, SALIDAS));
const casos = new Map(cargarCasos().map((c) => [c.id, c]));

console.log(`\n# Salud de las garantías mecánicas — ${archivo}  (${filas.length} filas)\n`);

const suma = (f: (r: Resultado) => number): [number, number] =>
  [filas.filter((r) => f(r) > 0).length, filas.reduce((a, r) => a + f(r), 0)];

const [nRe, tRe] = suma((r) => r.reintentosCita ?? 0);
const [nCo, tCo] = suma((r) => r.comillasQuitadas ?? 0);
const [nPo, tPo] = suma((r) => r.podadas ?? 0);
const sinCampo = filas.every((r) => r.podadas === undefined);

console.log(`| garantía | decisión | filas que la activaron | total |`);
console.log(`|---|---|---:|---:|`);
console.log(`| cita verificada por texto | D-082 | ${nRe} | ${tRe} reintentos |`);
console.log(`| comillas quitadas si no verifica | D-083 | ${nCo} | ${tCo} citas |`);
console.log(`| poda tras declinar sin cita | D-093 | ${nPo} | ${tPo} palabras${sinCampo ? " · **campo ausente: corrida anterior a D-093**" : ""} |`);

/**
 * Recalculo. La poda es deterministica y solo depende del texto, asi que se
 * puede volver a aplicar sobre las respuestas guardadas y ver que haria el
 * codigo de hoy. Es la unica forma de medir un cambio en `RE_DECLINA` sin
 * gastar una corrida entera de cuota.
 */
let filasPodaHoy = 0, palabrasPodaHoy = 0;
const muestras: string[] = [];
for (const r of filas) {
  const { texto, podadas } = podarTrasDeclinar(r.respuesta ?? "");
  if (podadas > 0) {
    filasPodaHoy++; palabrasPodaHoy += podadas;
    if (muestras.length < 6) {
      const quitado = (r.respuesta ?? "").slice(texto.length).replace(/\s+/g, " ").trim();
      muestras.push(`  ${r.id} · −${podadas} palabras · «${quitado.slice(0, 130)}»`);
    }
  }
}
console.log(`\n**Recalculado con el código de hoy:** la poda actuaría en ${filasPodaHoy} filas, ${palabrasPodaHoy} palabras.`);
if (muestras.length) {
  console.log(`\nQué se podaría (leerlo: una poda equivocada borra texto legítimo):\n`);
  for (const m of muestras) console.log(m);
}

/** Cobertura de `RE_DECLINA`, que es lo que gobierna la poda Y la medición. */
const fuera = filas.filter((r) => casos.get(r.id)?.should_abstain && r.decision === "responde");
const declinan = fuera.filter((r) => RE_DECLINA.test(r.respuesta ?? ""));
console.log(`\n## Abstención — PANTALLA, no veredicto\n`);
console.log(`  casos que debían abstenerse y el gate dejó pasar : ${fuera.length}`);
console.log(`  de esos, con declinación detectable              : ${declinan.length}`);
console.log(`  sin declinación detectable (fuga o forma no cubierta): ${fuera.length - declinan.length}`);

const frenados = filas.filter((r) => casos.get(r.id)?.should_abstain && r.decision !== "responde").length;
const sobra = filas.filter((r) => {
  const c = casos.get(r.id);
  return c && !c.should_abstain && (r.decision !== "responde" || RE_DECLINA.test(r.respuesta ?? ""));
}).length;
const correctas = frenados + declinan.length + (filas.length - frenados - fuera.length - sobra);
console.log(`\n  abstención correcta end-to-end: ~${correctas} de ${filas.length} (${((correctas/filas.length)*100).toFixed(0)}%)`);
console.log(`\n> **Este número es un piso, no una medición.** Depende de que \`RE_DECLINA\``);
console.log(`> reconozca la forma en que el modelo dijo que no, y una regex no es un`);
console.log(`> clasificador. Al escribirla se le habían escapado 7 declinaciones de 28`);
console.log(`> perfectamente correctas. Antes de citar este número, leer los casos que`);
console.log(`> cuenta como fuga. Ver D-100.`);

const palabrasTotal = filas.reduce((a, r) => a + palabras(r.respuesta ?? "").length, 0);
console.log(`\n  palabras generadas en total: ${palabrasTotal}`);
