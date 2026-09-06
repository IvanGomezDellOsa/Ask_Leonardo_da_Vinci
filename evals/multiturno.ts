/**
 * Que le pasa al RETRIEVAL cuando la consulta es una repregunta. Sin generar
 * una sola respuesta y sin gastar cuota.
 *
 *   npm run evals:multiturno
 *
 * POR QUE EXISTE. Antes de D-197, `construirPrompt` aceptaba un `historial:
 * Turno[]` y **nadie lo llenaba**: `responder()` pasaba `[]` literal, la ruta no
 * lo recibia y el cliente no lo mandaba. El codice mostraba una conversacion de
 * hasta 20 turnos donde cada turno era una consulta suelta. Este script es lo
 * que decidio con que forma se arreglaba, y queda como la guarda de esa
 * decision: **S4 es lo que corre en produccion**, y las otras cinco columnas son
 * lo que se probo y se descarto.
 *
 * Y no falla en silencio hacia la abstencion, que seria lo benigno: medido, «¿Y
 * por que?» en castellano da cos_max 0,8523 contra tau 0,841, **pasa el gate** y
 * trae «Sobre el cuerpo humano en accion», «Decoraciones para fiestas» y «Sobre
 * varias ayudas para preparar un cuadro». Contesta con pasajes que no tienen
 * nada que ver, y las citas de esos pasajes verifican perfecto — la garantia de
 * D-082 comprueba que la cita EXISTA, no que venga al caso.
 *
 * Es el patron de la seccion 1 de `00-README.md` una vez mas: **el vector de la
 * repregunta sola gobierna el retrieval, cuando la intencion vive en el turno
 * anterior.**
 *
 * ================================================================
 * LO QUE ESTE SCRIPT MIDE ES EL COSTO, NO LA GANANCIA.
 * ================================================================
 *
 * Que arrastrar el turno anterior ayude a una repregunta es casi obvio. Lo que
 * hay que averiguar antes de tocar nada es **cuanto se rompe**, porque la
 * prioridad 1 del proyecto es no alucinar (D-020) y concatenar contexto empuja
 * el coseno hacia arriba en TODAS las consultas — incluidas las que hoy se
 * abstienen bien. Una consulta fuera de corpus escrita despues de una pregunta
 * de adentro podria heredar el coseno de la de adentro y colarse.
 *
 * Por eso las tres mediciones de abajo son: una de ganancia y DOS de costo.
 *
 * LAS SEIS ESTRATEGIAS
 *
 *   S0  el estado anterior el vector y el texto son los de la repregunta sola
 *   S1  todo con contexto  `q1 + " " + q2` gobierna capa 0, BM25, coseno y gate
 *   S2  vector con contexto el TEXTO sigue siendo `q2` —o sea capa 0 y BM25
 *                          miran el turno actual— y solo el vector lleva el
 *                          contexto. El gate umbraliza ese coseno
 *   S3  S2 con gate viejo  los pasajes salen del vector con contexto, pero quien
 *                          decide responder o abstenerse es el coseno de `q2`
 *   S4  **produccion**     S3, y solo cuando la consulta NO se sostiene sola
 *   S5  S3 sin lista       se recuperan las dos ramas y gana la de mayor cosMax
 *
 * S1 esta para medirla y descartarla, no porque parezca buena: la capa 0 casea
 * PATRONES sobre el texto (`/vegetarian/i`, `/mona\s*lisa/i`), asi que con el
 * turno anterior pegado adelante una pregunta cualquiera hecha despues de «¿es
 * cierto que eras vegetariano?» dispara el caso curado del vegetarianismo para
 * siempre. La columna `curadas espurias` cuenta exactamente eso.
 *
 * TODAS PASAN POR `decidirCon`, la definicion del gate que corre en produccion:
 * lo unico que cambia entre columnas es que par (texto, vector) se le entrega.
 * Un instrumento que reimplemente el gate para medirlo es el defecto que D-115
 * encontro en `compuerta.ts`.
 */

import { cargarExtractor } from "../src/lib/embed.js";
import {
  cargarMotor, decidirCon, LISTA_CURADA, type Decision, type Idioma,
} from "../src/lib/grounding.js";
import { PORTADA } from "../src/data/portada.js";
import { consultaParaEmbeber, esAutonoma } from "../src/lib/conversacion.js";
import { ART, cargarCasos, type Caso } from "./comun.js";

// ---------------------------------------------------------------------------
// El criterio, ESCRITO ANTES DE CORRER
// ---------------------------------------------------------------------------

/**
 * D-091 y D-111: el criterio se fija antes de ver el numero, y sobre el
 * estimador corregido. Cambiarlo despues es mover la vara. Vive en codigo y se
 * imprime arriba de las tablas para que no haya version de memoria.
 */
const CRITERIO = {
  /** Prioridad 1. Una fuga nueva es una consulta que hoy se abstiene y pasaria a responder. */
  fugasNuevasMax: 2,
  /** D-041: la sobre-abstencion no es gratis. Cero tolerancia porque hoy son 0. */
  sobreAbstencionesNuevasMax: 0,
  /** Conteo duro (D-096): el pasaje esperado esta en el top-3 o no esta. */
  recallANuevoFalloMax: 1,
  /** Si no recupera el tema del turno anterior en al menos esto, no compra nada. */
  gananciaMinima: 0.6,
};

// ---------------------------------------------------------------------------
// Los pares de seguimiento
// ---------------------------------------------------------------------------

/**
 * LA PRIMERA PREGUNTA NO SE INVENTA: sale del dataset por id, con su
 * `expected_passages` (procedencia por referencia, no por copia — si el dataset
 * cambia, esto cambia con el). Lo unico escrito a mano es la repregunta, que es
 * lo que no existe en ningun lado: el eval set son 120 consultas sueltas.
 *
 * Son anaforicas a proposito —«eso», «that», «esa diferencia»—: es la forma en
 * que una persona repregunta y la que el retrieval no puede resolver sola. Una
 * repregunta que repite el tema («¿y por que la luz y el lustre se ven
 * distinto?») no necesita historial y no probaria nada.
 *
 * LA VERDAD ES LA DEL TURNO 1. Una repregunta sobre el mismo tema debe traer
 * los mismos pasajes: si «¿y por que?» sobre luz y lustre deja de traer 132-135,
 * el sistema perdio el hilo.
 */
const SEGUIMIENTOS: { base: string; q2: string }[] = [
  { base: "A-01es", q2: "¿Y por qué ocurre eso?" },
  { base: "A-03es", q2: "Contame más sobre eso." },
  { base: "A-09es", q2: "¿Y cómo se hace?" },
  { base: "A-13es", q2: "¿Por qué esa y no otra?" },
  { base: "A-14es", q2: "¿Por qué lo decís?" },
  { base: "A-01en", q2: "And why does that happen?" },
  { base: "A-03en", q2: "Tell me more about that." },
  { base: "A-09en", q2: "And how is it done?" },
  { base: "A-13en", q2: "Why that one and not another?" },
  { base: "A-14en", q2: "Why do you say so?" },
];

/**
 * Los turnos 1 para las mediciones de costo. Tres por idioma, del dataset y de
 * temas lejanos entre si: con uno solo, el numero diria mas sobre esa pregunta
 * que sobre la estrategia.
 */
const CONTEXTOS: Record<Idioma, string[]> = {
  es: ["A-01es", "A-08es", "A-13es"],
  en: ["A-01en", "A-08en", "A-13en"],
};

// ---------------------------------------------------------------------------

/**
 * ⚠ EL CLASIFICADOR NO VIVE ACA. `esAutonoma` y `consultaParaEmbeber` se
 * importan de `src/lib/conversacion.ts`, que es lo que corre en producción.
 * Una copia local para medir es como se colaron 41,7% de citas inventadas donde
 * había 0%: dos definiciones de lo mismo que se separan sin que nadie lo note.
 */

const motor = cargarMotor(ART);
const embed = await cargarExtractor();
const casos = cargarCasos();
const porId = new Map(casos.map((c) => [c.id, c]));

/** Cache de vectores: el mismo texto aparece muchas veces entre estrategias. */
const cacheVec = new Map<string, Float32Array>();
async function vec(t: string): Promise<Float32Array> {
  const hit = cacheVec.get(t);
  if (hit) return hit;
  const v = (await embed("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;
  cacheVec.set(t, v);
  return v;
}

const unir = (q1: string, q2: string): string => `${q1} ${q2}`;

interface Resuelto { decision: Decision; pasajes: number[] }

const numeros = (d: Decision): number[] =>
  d.tipo === "responde" ? d.pasajes.flatMap((p) => p.chunk.richterNos) : [];

/**
 * Las cuatro estrategias, cada una como el par (texto, vector) que le entra al
 * gate real. S3 es la unica compuesta: toma la decision de una y los pasajes de
 * otra, que es precisamente lo que la vuelve interesante.
 */
async function resolver(
  estrategia: Estrategia, q1: string | null, q2: string, lang: Idioma,
): Promise<Resuelto> {
  const conCtx = q1 ? unir(q1, q2) : q2;
  const solo = async (): Promise<Resuelto> => {
    const d = decidirCon(motor, q2, await vec(q2), lang, 3);
    return { decision: d, pasajes: numeros(d) };
  };
  if (estrategia === "S0") return solo();
  if (estrategia === "S1") {
    const d = decidirCon(motor, conCtx, await vec(conCtx), lang, 3);
    return { decision: d, pasajes: numeros(d) };
  }
  if (estrategia === "S2") {
    const d = decidirCon(motor, q2, await vec(conCtx), lang, 3);
    return { decision: d, pasajes: numeros(d) };
  }
  if (estrategia === "S3") {
    // El gate real con el vector de contexto: decide `q2` sola, recupera con contexto.
    const d = decidirCon(motor, q2, await vec(q2), lang, 3, await vec(conCtx));
    return { decision: d, pasajes: numeros(d) };
  }
  if (estrategia === "S4") {
    /**
     * EL CAMINO DE PRODUCCION, TAL CUAL. `consultaParaEmbeber` decide si hay
     * segundo vector, igual que en `Codice.tsx`; el gate hace el resto. Si esta
     * columna y el producto se separan alguna vez, es porque alguien cambió una
     * de las dos.
     */
    const historial = q1 ? [{ rol: "usuario" as const, texto: q1 }] : [];
    const paraEmbeber = consultaParaEmbeber(q2, historial);
    const vCtx = paraEmbeber === q2 ? undefined : await vec(paraEmbeber);
    const d = decidirCon(motor, q2, await vec(q2), lang, 3, vCtx);
    return { decision: d, pasajes: numeros(d) };
  }
  // S5: sin lista de palabras — se recuperan las dos ramas y gana la de mayor
  // `cosMax`. La apuesta es que una consulta autónoma se parece más a sus
  // pasajes por sí sola que pegada al turno anterior.
  const sinCtx = decidirCon(motor, q2, await vec(q2), lang, 3);
  if (sinCtx.tipo !== "responde") return { decision: sinCtx, pasajes: [] };
  const conVector = decidirCon(motor, q2, await vec(conCtx), lang, 3);
  const cosCtx = conVector.tipo === "responde" ? conVector.cosMax : -1;
  return {
    decision: sinCtx,
    pasajes: cosCtx > sinCtx.cosMax ? numeros(conVector) : numeros(sinCtx),
  };
}

const ESTRATEGIAS = ["S0", "S1", "S2", "S3", "S4", "S5"] as const;
type Estrategia = "S0" | "S1" | "S2" | "S3" | "S4" | "S5";

console.log(`\n# Multi-turno: qué le pasa al retrieval con una repregunta\n`);
console.log(`  es: τ ${motor.por.es.umbrales.tau.es} · en: τ ${motor.por.en.umbrales.tau.en}\n`);
console.log(`## Criterio, fijado antes de correr\n`);
console.log(`| condición | tope |`);
console.log(`|---|---:|`);
console.log(`| fugas nuevas del gate (prioridad 1, D-020) | ${CRITERIO.fugasNuevasMax} |`);
console.log(`| sobre-abstenciones nuevas (D-041) | ${CRITERIO.sobreAbstencionesNuevasMax} |`);
console.log(`| fallos nuevos de recall A (D-096) | ${CRITERIO.recallANuevoFalloMax} |`);
console.log(`| ganancia mínima en repreguntas | ${(CRITERIO.gananciaMinima * 100).toFixed(0)}% |`);

// ---------------------------------------------------------------------------
// El clasificador, medido antes de usarlo
// ---------------------------------------------------------------------------

/**
 * VALIDAR EL INSTRUMENTO ANTES DE MEDIR CON EL (lección 6 de `00-README.md`).
 * S4 entera depende de que esto no se equivoque, así que se corre contra todas
 * las consultas reales que hay en el repo: los 120 casos del dataset, las 6
 * preguntas de portada y los ejemplos verificados de la lista curada.
 *
 * **El número que importa es la columna «no autónomas»: tiene que ser 0.** Una
 * consulta real clasificada como repregunta arrastraría el turno anterior a un
 * tema nuevo, que es exactamente el daño que S1 y S2 muestran abajo.
 */
{
  const reales: { fuente: string; qs: string[] }[] = [
    { fuente: "dataset (120 casos)", qs: casos.map((c) => c.q) },
    { fuente: "portada (D-131)", qs: Object.values(PORTADA).map((p) => p.pregunta) },
    { fuente: "ejemplos de LISTA_CURADA", qs: LISTA_CURADA.flatMap((c) => c.ejemplos) },
  ];
  console.log(`\n## Validación del clasificador de autonomía (gobierna S4)\n`);
  console.log(`| fuente | consultas | no autónomas |`);
  console.log(`|---|---:|---:|`);
  for (const r of reales) {
    const malas = r.qs.filter((q) => !esAutonoma(q));
    console.log(`| ${r.fuente} | ${r.qs.length} | ${malas.length} |`);
    for (const m of malas) console.log(`| ↳ **${m}** | | ← falso positivo |`);
  }
  const repre = SEGUIMIENTOS.filter((s) => !esAutonoma(s.q2));
  console.log(`| repreguntas del bloque A | ${SEGUIMIENTOS.length} | ${repre.length} |`);
}

// ---------------------------------------------------------------------------
// A · La ganancia: repreguntas anafóricas
// ---------------------------------------------------------------------------

interface FilaSeg { id: string; q2: string; por: Record<Estrategia, { acierta: boolean; tipo: string }> }
const segs: FilaSeg[] = [];

for (const s of SEGUIMIENTOS) {
  const base = porId.get(s.base);
  if (!base) { console.error(`falta el caso ${s.base} en el dataset`); process.exit(1); }
  const esperados = base.expected_passages;
  const por = {} as FilaSeg["por"];
  for (const e of ESTRATEGIAS) {
    const r = await resolver(e, base.q, s.q2, base.lang);
    por[e] = { acierta: esperados.some((n) => r.pasajes.includes(n)), tipo: r.decision.tipo };
  }
  segs.push({ id: s.base, q2: s.q2, por });
}

console.log(`\n## A · Ganancia — ${segs.length} repreguntas anafóricas sobre casos de categoría A\n`);
console.log(`Acierta = el top-3 trae alguno de los pasajes que esperaba el turno 1.\n`);
console.log(`| turno 1 | repregunta | ${ESTRATEGIAS.join(" | ")} |`);
console.log(`|---|---|${ESTRATEGIAS.map(() => "---").join("|")}|`);
for (const f of segs) {
  const cs = ESTRATEGIAS.map((e) =>
    `${f.por[e].acierta ? "✓" : "·"}${f.por[e].tipo === "responde" ? "" : ` (${f.por[e].tipo})`}`);
  console.log(`| ${f.id} | ${f.q2} | ${cs.join(" | ")} |`);
}
const aciertos = (e: Estrategia) => segs.filter((f) => f.por[e].acierta).length;
console.log(`\n| | ${ESTRATEGIAS.join(" | ")} |`);
console.log(`|---|${ESTRATEGIAS.map(() => "---:").join("|")}|`);
console.log(`| acierta el tema del turno 1 | ${ESTRATEGIAS.map((e) => `${aciertos(e)}/${segs.length}`).join(" | ")} |`);

// ---------------------------------------------------------------------------
// B y C · El costo: los 120 casos del dataset como TURNO 2
// ---------------------------------------------------------------------------

/**
 * Cada caso del dataset se mide como si fuera la segunda cosa que alguien
 * escribe, despues de una pregunta de adentro del corpus. Tres contextos por
 * idioma: **se cuenta el PEOR**, no el promedio. Un gate que se abre con un
 * contexto de cada tres esta abierto.
 */
interface FilaCosto {
  caso: Caso;
  /** Por estrategia: cuántos de los 3 contextos responden, y en cuántos acierta el recall. */
  responde: Record<Estrategia, number>;
  recall: Record<Estrategia, number>;
  curadaEspuria: Record<Estrategia, number>;
}
const costos: FilaCosto[] = [];

/**
 * ⚠ EN CERO PARA CADA ESTRATEGIA, SIEMPRE POR ACA. Escribir el objeto literal a
 * mano dejó a S4 y S5 sin clave: `undefined++` da `NaN`, `NaN > 0` es `false`, y
 * las dos estrategias nuevas reportaron **0 filtraciones contra las 31 reales**
 * — un número plausible, en la dirección que uno quiere creer, sin un solo
 * error. El patrón de la sección 1 del README, adentro del instrumento escrito
 * para medirlo.
 */
const enCero = (): Record<Estrategia, number> =>
  Object.fromEntries(ESTRATEGIAS.map((e) => [e, 0])) as Record<Estrategia, number>;

let i = 0;
for (const c of casos) {
  const ctxs = CONTEXTOS[c.lang].map((id) => porId.get(id)!.q);
  const fila: FilaCosto = {
    caso: c, responde: enCero(), recall: enCero(), curadaEspuria: enCero(),
  };
  for (const q1 of ctxs) {
    for (const e of ESTRATEGIAS) {
      const r = await resolver(e, q1, c.q, c.lang);
      if (r.decision.tipo === "responde") fila.responde[e]++;
      if (c.expected_passages.length && c.expected_passages.some((n) => r.pasajes.includes(n)))
        fila.recall[e]++;
      // Una `curada` que S0 no produce salió del texto del turno anterior.
      if (r.decision.tipo === "curada") fila.curadaEspuria[e]++;
    }
  }
  costos.push(fila);
  if (++i % 20 === 0) process.stderr.write(`  ${i}/${casos.length}\n`);
}

/**
 * S4 y S5 AFIRMAN comportarse como hoy cuando la consulta se sostiene sola, y
 * «por construcción» no es una comprobación: se verifica sobre los 120 casos,
 * que son todos autónomos. Si esto se rompe, las columnas de costo de abajo no
 * significan lo que dicen.
 */
for (const e of ["S4", "S5"] as const) {
  const distintas = costos.filter(
    (f) => f.responde[e] !== f.responde.S0 || f.recall[e] !== f.recall.S0);
  if (distintas.length) {
    console.error(`\n⚠ ${e} difiere de S0 en ${distintas.length} casos autónomos: ` +
                  distintas.slice(0, 5).map((f) => f.caso.id).join(", "));
  }
}

const N_CTX = 3;
/** S0 no depende del contexto: sus tres corridas son idénticas. */
const base0 = (f: FilaCosto, campo: "responde" | "recall") => f[campo].S0 / N_CTX >= 1;

const debenAbstenerse = costos.filter((f) => f.caso.should_abstain);
const debenResponder = costos.filter((f) => !f.caso.should_abstain);
const conA = costos.filter((f) => f.caso.expected_passages.length);

console.log(`\n## B · Costo 1 — el gate, con ${debenAbstenerse.length} casos que deben abstenerse puestos como turno 2\n`);
console.log(`Peor de ${N_CTX} contextos. «fuga nueva» = hoy se abstiene y con la estrategia responde.\n`);
console.log(`| | ${ESTRATEGIAS.join(" | ")} |`);
console.log(`|---|${ESTRATEGIAS.map(() => "---:").join("|")}|`);
const fugas = (e: Estrategia) => debenAbstenerse.filter((f) => f.responde[e] > 0).length;
const fugasNuevas = (e: Estrategia) =>
  debenAbstenerse.filter((f) => f.responde[e] > 0 && !base0(f, "responde")).length;
console.log(`| filtraciones | ${ESTRATEGIAS.map((e) => fugas(e)).join(" | ")} |`);
console.log(`| **fugas nuevas vs. hoy** | ${ESTRATEGIAS.map((e) => fugasNuevas(e)).join(" | ")} |`);
const curadasEsp = (e: Estrategia) =>
  costos.filter((f) => f.curadaEspuria[e] > 0 && f.curadaEspuria.S0 === 0).length;
console.log(`| curadas espurias (capa 0 del turno anterior) | ${ESTRATEGIAS.map((e) => curadasEsp(e)).join(" | ")} |`);

console.log(`\n## C · Costo 2 — el tema nuevo, con ${debenResponder.length} casos que deben responderse\n`);
console.log(`| | ${ESTRATEGIAS.join(" | ")} |`);
console.log(`|---|${ESTRATEGIAS.map(() => "---:").join("|")}|`);
const sobre = (e: Estrategia) =>
  debenResponder.filter((f) => f.responde[e] < N_CTX && base0(f, "responde")).length;
const fallosA = (e: Estrategia) => conA.filter((f) => f.recall[e] < N_CTX).length;
const fallosANuevos = (e: Estrategia) =>
  conA.filter((f) => f.recall[e] < N_CTX && base0(f, "recall")).length;
console.log(`| sobre-abstenciones nuevas | ${ESTRATEGIAS.map((e) => sobre(e)).join(" | ")} |`);
console.log(`| fallos de recall A (${conA.length} casos) | ${ESTRATEGIAS.map((e) => fallosA(e)).join(" | ")} |`);
console.log(`| **fallos nuevos vs. hoy** | ${ESTRATEGIAS.map((e) => fallosANuevos(e)).join(" | ")} |`);

// ---------------------------------------------------------------------------
// Veredicto contra el criterio de arriba
// ---------------------------------------------------------------------------

console.log(`\n## Veredicto\n`);
console.log(`| estrategia | ganancia | fugas nuevas | sobre-abst. | recall A nuevo | ¿se gana el lugar? |`);
console.log(`|---|---:|---:|---:|---:|---|`);
const cumple = (e: Estrategia): boolean =>
  e !== "S0"
  && aciertos(e) / segs.length >= CRITERIO.gananciaMinima
  && fugasNuevas(e) <= CRITERIO.fugasNuevasMax
  && sobre(e) <= CRITERIO.sobreAbstencionesNuevasMax
  && fallosANuevos(e) <= CRITERIO.recallANuevoFalloMax
  && curadasEsp(e) === 0;

for (const e of ESTRATEGIAS) {
  const g = aciertos(e) / segs.length;
  console.log(`| ${e} | ${(g * 100).toFixed(0)}% | ${fugasNuevas(e)} | ${sobre(e)} | ${fallosANuevos(e)} | ` +
              `${e === "S0" ? "— (es el estado actual)" : cumple(e) ? "**sí**" : "no"} |`);
}

/**
 * SALE CON CODIGO 1 SI S4 DEJA DE CUMPLIR, que es lo que lo vuelve una guarda y
 * no un informe. D-115 lo dice sin rodeos: **una comprobación que depende de que
 * alguien lea la salida no es una comprobación** — `podadas` estuvo en 0
 * dieciséis corridas seguidas porque el número se escribía y nadie lo miraba.
 *
 * S4 es lo que corre en producción (D-197). Si esta línea se pone roja, o el
 * clasificador cambió, o el gate empezó a mirar el vector con contexto — y eso
 * último son 16 filtraciones.
 */
if (!cumple("S4")) {
  console.error(`\n  S4 dejó de cumplir el criterio: es lo que corre en producción (D-197).\n`);
  process.exit(1);
}
console.log(`\n  S4 cumple el criterio.\n`);
