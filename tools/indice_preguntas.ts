/**
 * PILOTO del índice de preguntas. Ver `28` §4G y D-243.
 *
 *   npm run indice:preguntas -- --preparar   arma el lote y dice cuánto cuesta
 *   npm run indice:preguntas -- --generar    genera las preguntas del lote
 *   npm run indice:preguntas -- --medir      mide contra el criterio de corte
 *
 * ══════════════════════════════════════════════════════════════════════
 * QUE ES G, Y POR QUE ESTE SCRIPT ES UN PILOTO Y NO LA COSA ENTERA.
 * ══════════════════════════════════════════════════════════════════════
 *
 * La asimetría del producto: el visitante pregunta por gusto, opinión o consejo;
 * el corpus tiene descripción y procedimiento. G la ataca de frente — por cada
 * pasaje se generan offline 2-3 preguntas del tipo que haría un visitante, se
 * embeben con el MISMO modelo (el navegador no cambia) y la búsqueda toma el
 * mejor resultado entre el pasaje y sus preguntas. **Nunca se muestran ni se
 * citan: sólo ordenan.**
 *
 * Hacerlo entero son ~1.400 pasajes × 3 preguntas = ~4.200 generaciones más un
 * índice nuevo. `28` §4G lo pone último y advierte el riesgo: al hacer todo más
 * fácil de encontrar, también se vuelve más fácil encontrar lo que no
 * corresponde. Antes de gastar eso hay que saber si funciona.
 *
 * ⚠ EL PILOTO TIENE QUE SER JUSTO O NO MIDE NADA. Generar preguntas SOLO para
 * los pasajes que uno quiere que ganen es hacer trampa: por construcción ganan.
 * Acá el lote son **todos los chunks que hoy entran al top-10 de las consultas
 * que fallan, más los chunks del tema esperado**. Así los que hoy ganan también
 * reciben sus preguntas y compiten con las mismas armas. Si el pasaje correcto
 * sube igual, subió por mérito.
 *
 * ⚠ EL CRITERIO DE CORTE SE FIJO ANTES DE GENERAR NADA (`28` §4G): los fallos de
 * la categoría conceptual bajan de 9 a 5 o menos, los de la directa no suben, y
 * la precisión del gate no baja. Está escrito acá abajo, en `CRITERIO`, y lo
 * imprime `--medir` al lado del resultado para que nadie lo mueva después.
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { cargarExtractor } from "../src/lib/embed.js";
import { cargarMotor, decidirCon, type Idioma } from "../src/lib/grounding.js";
import { rangosDeRichter, caeEnRangos } from "../src/lib/retrieval.js";
import { proveedorPorId } from "../src/lib/llm.js";
import { cargarCasos } from "../evals/comun.js";

const RAIZ = new URL("../", import.meta.url);
const ART = new URL("artifacts/", RAIZ);
const LOTE = new URL("artifacts/piloto_preguntas.json", RAIZ);

/** ⚠ Escrito antes de generar. No se toca para que dé. */
const CRITERIO = {
  conceptualBajaA: 5,
  directaNoSube: true,
  gateNoEmpeora: true,
};

const preparar = process.argv.includes("--preparar");
const generar = process.argv.includes("--generar");
const medir = process.argv.includes("--medir");

const motor = cargarMotor(ART);
const extractor = await cargarExtractor();
const emb = async (t: string): Promise<Float32Array> =>
  (await extractor("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;
const embPasaje = async (t: string): Promise<Float32Array> =>
  (await extractor("passage: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

const casos = cargarCasos();

/** Los casos de categoría B que hoy FALLAN: el blanco de G. */
async function fallosB(): Promise<{ caso: (typeof casos)[number]; rangos: [number, number][] }[]> {
  const out: { caso: (typeof casos)[number]; rangos: [number, number][] }[] = [];
  for (const c of casos) {
    if (c.expected_passages?.length || !c.expected_topic) continue;
    const r = rangosDeRichter(c.expected_topic);
    if (!r.length) continue;
    const corpus = motor.por[c.lang as Idioma].corpus;
    const top = corpus.buscar(await emb(c.q), c.q, "leonardo", 3).top.flatMap((t) => t.chunk.richterNos);
    if (!caeEnRangos(top, r)) out.push({ caso: c, rangos: r });
  }
  return out;
}

interface Lote { chunkId: string; lang: Idioma; titulo: string | null; texto: string; preguntas?: string[] }

if (preparar) {
  const fallos = await fallosB();
  console.log(`\n# Piloto del índice de preguntas — preparación\n`);
  console.log(`  casos B que fallan hoy: ${fallos.length}\n`);
  for (const f of fallos) console.log(`   ${f.caso.id}  ${f.caso.q}`);

  /**
   * EL LOTE: los que hoy GANAN y los que DEBERIAN ganar, juntos. Los primeros
   * son la competencia real; sin ellos el piloto se mide contra un rival
   * desarmado.
   */
  const ids = new Map<string, Lote>();
  for (const f of fallos) {
    const corpus = motor.por[f.caso.lang as Idioma].corpus;
    const v = await emb(f.caso.q);
    for (const t of corpus.buscar(v, f.caso.q, "leonardo", 10).top) {
      ids.set(`${f.caso.lang}:${t.chunk.id}`, { chunkId: t.chunk.id, lang: f.caso.lang as Idioma,
        titulo: t.chunk.richterTitle, texto: t.chunk.text });
    }
    for (const c of corpus.chunks) {
      if (c.voice === "leonardo" && caeEnRangos(c.richterNos, f.rangos)) {
        ids.set(`${f.caso.lang}:${c.id}`, { chunkId: c.id, lang: f.caso.lang as Idioma,
          titulo: c.richterTitle, texto: c.text });
      }
    }
  }
  const lote = [...ids.values()];
  console.log(`\n  chunks del lote      : ${lote.length}`);
  console.log(`  generaciones (×1)    : ${lote.length}   ~${Math.ceil(lote.length * 10 / 60)} min`);
  console.log(`\n  (el índice completo serían ~1.400 chunks: este piloto es el ${((lote.length / 1400) * 100).toFixed(0)}%)\n`);
  writeFileSync(LOTE, JSON.stringify({ criterio: CRITERIO, fallos: fallos.map((f) => f.caso.id), lote }, null, 2), "utf8");
  console.log(`escrito: artifacts/piloto_preguntas.json`);
}

if (generar) {
  const claves = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const l of readFileSync(new URL(".env.local", RAIZ), "utf8").split("\n")) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[2]!.trim()) out[m[1]!] = m[2]!.trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
    }
    return out;
  };
  const proveedor = proveedorPorId("deepseek/deepseek-v4-flash", claves());
  const j = JSON.parse(readFileSync(LOTE, "utf8")) as { lote: Lote[] };

  /**
   * ⚠ EL PROMPT PIDE PREGUNTAS DE VISITANTE, NO UN RESUMEN. Si pidiera «qué
   * responde este pasaje» saldrían preguntas con el vocabulario del pasaje, que
   * es exactamente el vocabulario que el visitante NO usa — y el índice no
   * serviría para nada. Se pide gusto, opinión y consejo a propósito.
   */
  /**
   * ⚠ EL IDIOMA SE FIJA POR ENTRADA, NO SE DEJA AL MODELO. Ver D-243.
   *
   * La primera corrida decía «en el mismo idioma que el fragmento» — y el
   * fragmento **siempre está en inglés**, porque `chunk.text` es el original de
   * Richter. El modelo eligió solo, y de los diez primeros salieron unos en
   * inglés y otros en castellano.
   *
   * No es cosmético: **hay un índice por idioma** (D-107). Una pregunta
   * castellana pegada a un chunk del índice inglés reintroduce exactamente la
   * búsqueda cross-lingüe que D-105 midió como mala y que motivó separar los dos
   * índices. El idioma de la pregunta tiene que ser el del ÍNDICE al que va, que
   * es `x.lang`, no el del texto que se le muestra al modelo.
   */
  const sys = (lang: Idioma): string => `Recibís un fragmento de los cuadernos de Leonardo da Vinci.
Escribí 3 preguntas que UNA PERSONA CUALQUIERA —no un experto— podría hacerle a Leonardo y que ESTE fragmento contestaría.
Reglas:
- de gusto, de opinión o de consejo, no de definición;
- con palabras de todos los días, NUNCA el vocabulario técnico del fragmento;
- cortas, como se escriben en un teléfono;
- ${lang === "es" ? "EN CASTELLANO, siempre, aunque el fragmento esté en inglés." : "IN ENGLISH, always."}
Devolvé sólo las 3 preguntas, una por línea, sin numerar.`;

  /**
   * ⚠ SE COMPRUEBA EL IDIOMA, NO SE CONFIA EN LA INSTRUCCION. Ver D-243.
   *
   * Con el idioma pedido explícitamente en el prompt, **el modelo igual devolvió
   * inglés en 4 de 21 pedidos castellanos (19%)**: el fragmento que ve está en
   * inglés y arrastra. Una instrucción no es una garantía, y acá el costo de que
   * falle es meter búsqueda cross-lingüe en un índice que existe justamente para
   * no tenerla (D-105, D-107).
   *
   * La heurística es tosca a propósito —acentos, signos de apertura y una
   * docena de funcionales— pero sólo tiene que distinguir castellano de inglés,
   * no clasificar idiomas. Si falla, se reintenta una vez y después se descarta:
   * es mejor un chunk sin preguntas que uno con preguntas en el idioma que no va.
   */
  const ES = /[áéíóúñ¿¡]|\b(qué|cómo|por qué|cuál|hago|puedo|para|los|las|una|del)\b/i;
  const idiomaOk = (qs: string[], lang: Idioma): boolean =>
    qs.every((q) => ES.test(q) === (lang === "es"));

  let n = 0, descartados = 0;
  for (const x of j.lote) {
    if (x.preguntas?.length) continue;
    await new Promise((r) => setTimeout(r, 3500));
    try {
      let qs: string[] = [];
      for (let intento = 0; intento < 2 && !qs.length; intento++) {
        const r = await proveedor.generar(sys(x.lang), [{ role: "user", content: x.texto.slice(0, 1400) }]);
        const cand = (r?.texto ?? "").split("\n")
          .map((s: string) => s.replace(/^[-*\d.)\s]+/, "").trim())
          .filter((s: string) => s.length > 8).slice(0, 3);
        if (cand.length && idiomaOk(cand, x.lang)) qs = cand;
        else if (intento === 0) await new Promise((r2) => setTimeout(r2, 2000));
      }
      if (!qs.length) {
        descartados++;
        console.log(`  ✗ ${x.chunkId} [${x.lang}]: el modelo no devolvió el idioma pedido`);
        continue;
      }
      x.preguntas = qs;
      n++;
      if (n % 10 === 0) {
        const tmp = new URL("piloto_preguntas.json.tmp", LOTE);
        writeFileSync(tmp, JSON.stringify(j, null, 2), "utf8"); renameSync(tmp, LOTE);
        console.log(`  ${n} generados…`);
      }
    } catch (e) {
      console.log(`  ✗ ${x.chunkId}: ${(e as Error).message.slice(0, 50)}`);
    }
  }
  const tmp = new URL("piloto_preguntas.json.tmp", LOTE);
  writeFileSync(tmp, JSON.stringify(j, null, 2), "utf8"); renameSync(tmp, LOTE);
  console.log(`\n  generados: ${n} de ${j.lote.length}\n`);
}

if (medir) {
  if (!existsSync(LOTE)) { console.error("falta el lote: correr --preparar y --generar"); process.exit(1); }
  const j = JSON.parse(readFileSync(LOTE, "utf8")) as { lote: Lote[]; fallos: string[] };
  const conPreguntas = j.lote.filter((x) => x.preguntas?.length);
  console.log(`\n# Piloto del índice de preguntas — medición\n`);
  console.log(`  chunks con preguntas: ${conPreguntas.length} de ${j.lote.length}\n`);

  /** chunkId → los vectores de sus preguntas, embebidas como PASAJE. */
  const vecs = new Map<string, Float32Array[]>();
  for (const x of conPreguntas) {
    const vs: Float32Array[] = [];
    for (const q of x.preguntas!) vs.push(await embPasaje(q));
    vecs.set(`${x.lang}:${x.chunkId}`, vs);
  }

  const coseno = (a: Float32Array, b: Float32Array): number => {
    let s = 0; for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!; return s;
  };

  /**
   * EL RE-RANKING DE G: por chunk, el mejor entre el pasaje y sus preguntas.
   * Se aplica SOLO sobre los candidatos que el retrieval de hoy ya trae — el
   * piloto no reconstruye el índice, mide si el orden mejora.
   */
  const conG = async (c: (typeof casos)[number], k: number): Promise<number[]> => {
    const corpus = motor.por[c.lang as Idioma].corpus;
    const v = await emb(c.q);
    const cand = corpus.buscar(v, c.q, "leonardo", 30).top;
    return cand
      .map((t) => {
        const extra = vecs.get(`${c.lang}:${t.chunk.id}`) ?? [];
        const mejor = extra.reduce((a, x) => Math.max(a, coseno(v, x)), t.cos);
        return { chunk: t.chunk, score: mejor };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .flatMap((t) => t.chunk.richterNos);
  };

  /**
   * ⚠ LOS DOS BANCOS APARTE, y no por prolijidad: **el criterio de §4G se fijó
   * sobre los 9 fallos del banco de CONTROL**, antes de que existiera el banco
   * común (D-236). Sumarlos daría 14 y el «bajar a 5 o menos» pasaría a
   * significar otra cosa — mover la vara después de ver el número es
   * exactamente lo que el criterio escrito de antemano existe para impedir.
   */
  let bAntes = 0, bDespues = 0, aAntes = 0, aDespues = 0;
  let bAntesComun = 0, bDespuesComun = 0;
  for (const c of casos) {
    const comun = c.banco === "comun";
    if (c.expected_passages?.length) {
      const corpus = motor.por[c.lang as Idioma].corpus;
      const esperado = new Set(c.expected_passages);
      const hoy = corpus.buscar(await emb(c.q), c.q, "leonardo", 3).top.flatMap((t) => t.chunk.richterNos);
      if (![...hoy].some((n) => esperado.has(n))) aAntes++;
      const con = await conG(c, 3);
      if (![...con].some((n) => esperado.has(n))) aDespues++;
    } else if (c.expected_topic) {
      const r = rangosDeRichter(c.expected_topic);
      if (!r.length) continue;
      const corpus = motor.por[c.lang as Idioma].corpus;
      const hoy = corpus.buscar(await emb(c.q), c.q, "leonardo", 3).top.flatMap((t) => t.chunk.richterNos);
      const falloHoy = !caeEnRangos(hoy, r);
      const falloCon = !caeEnRangos(await conG(c, 3), r);
      if (comun) { if (falloHoy) bAntesComun++; if (falloCon) bDespuesComun++; }
      else { if (falloHoy) bAntes++; if (falloCon) bDespues++; }
    }
  }

  console.log(`| | hoy | con el índice de preguntas |`);
  console.log(`|---|---:|---:|`);
  console.log(`| fallos categoría A (directa) | ${aAntes} | **${aDespues}** |`);
  console.log(`| fallos categoría B (conceptual), banco control | ${bAntes} | **${bDespues}** |`);
  console.log(`| fallos conceptuales del banco común (D-236) | ${bAntesComun} | **${bDespuesComun}** |`);

  console.log(`\n## Contra el criterio fijado ANTES de generar\n`);
  const ok1 = bDespues <= CRITERIO.conceptualBajaA;
  const ok2 = aDespues <= aAntes;
  console.log(`  conceptual ≤ ${CRITERIO.conceptualBajaA} .......... ${ok1 ? "✅" : "❌"}  (${bAntes} → ${bDespues})`);
  console.log(`  directa no sube ......... ${ok2 ? "✅" : "❌"}  (${aAntes} → ${aDespues})`);
  console.log(`\n  ${ok1 && ok2 ? "El piloto cumple. Vale la pena hacerlo entero." : "El piloto NO cumple: no se publica."}`);
  console.log(`\n> ⚠ Un piloto que cumple NO es permiso para publicar: falta medir la`);
  console.log(`> precisión del gate sobre el índice completo, que es el riesgo real de §4G.\n`);
}

if (!preparar && !generar && !medir) {
  console.log("usar --preparar, --generar o --medir");
}
