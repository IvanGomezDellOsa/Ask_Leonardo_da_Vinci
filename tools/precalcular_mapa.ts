/**
 * Congela las respuestas del mapa de temas. Ver `28` §4C y D-238.
 *
 *   npm run precalcular:mapa -- --limite 100        una tanda
 *   npm run precalcular:mapa -- --seccion "Teoría de los colores"
 *   npm run precalcular:mapa -- --idioma es --limite 60
 *
 * POR QUE. Si la pregunta sale del mapa, la respuesta se sabe de antemano: se
 * genera una vez y se sirve mil. Cero tokens por clic, cero varianza, y anda con
 * el proveedor caído y la cuota agotada — que es la prioridad 2 del proyecto.
 *
 * ══════════════════════════════════════════════════════════════════════
 * ESCRIBE EN `respuestas_fijas.json`, NO EN UNA CACHE NUEVA.
 * ══════════════════════════════════════════════════════════════════════
 *
 * Y no es comodidad. `app/api/chat` ya carga ese archivo, ya lo indexa por
 * `${lang}:${normalizar(pregunta)}` y **ya descarta toda entrada cuya huella no
 * sea la vigente** (D-112). Un archivo nuevo habría necesitado su propia
 * validación de vigencia, y el proyecto ya sabe cómo termina eso: la caché de
 * portada tuvo ese agujero desde D-132 hasta D-237, y estuvo vencida de verdad.
 * Se reusa la maquinaria que ya se defiende sola.
 *
 * ⚠ Y POR ESO NO VA AL BUNDLE DEL NAVEGADOR. La portada son 12 entradas y 40 KB;
 * el mapa son ~800 y **unos 3 MB**. Bundlearlas le costaría 3 MB de descarga a
 * cada visitante para servir una respuesta que quizá nunca pida. Van por la
 * ruta, que es el mismo pedido de red que el clic hace hoy — sólo que sin
 * generar nada del otro lado.
 *
 * ⚠ NO TODAS LAS SECCIONES MERECEN CONGELARSE, y esto está medido (D-238). De
 * diez temas leídos, siete se leen bien y tres no; los tres malos son de
 * secciones que son LISTAS —notas topográficas, apuntes personales, notas con
 * fechas—, no doctrina. Una sección de lista da una respuesta que pega
 * fragmentos de frases distintas, o que mezcla una profecía con una
 * observación, y congelarla la vuelve permanente. `EXCLUIDAS` las deja fuera:
 * se siguen contestando en vivo, igual que hoy.
 *
 * ⚠ POR TANDAS. ~800 generaciones contra un techo de 400 por día. Es reanudable:
 * lo ya congelado con la huella vigente no se vuelve a generar, y el archivo se
 * escribe en cada vuelta, así que una tanda cortada a la mitad no se pierde.
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { cargarExtractor } from "../src/lib/embed.js";
import { cargarMotor, type Idioma } from "../src/lib/grounding.js";
import { responder } from "../src/lib/responder.js";
import { huellaPrompt, varianteVigente, proveedorPorId } from "../src/lib/llm.js";
import { MAPA } from "../src/data/mapa.js";

const RAIZ = new URL("../", import.meta.url);
const ART = new URL("artifacts/", RAIZ);
const SALIDA = new URL("artifacts/respuestas_fijas.json", RAIZ);

const arg = (n: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith("--") ? process.argv[i + 1]! : "";
};

/**
 * LAS SECCIONES QUE NO SE CONGELAN, y el motivo es de lectura, no de máquina.
 *
 * Medido leyendo diez temas (D-238): son archivo, no doctrina. Sus «temas» son
 * listas de anotaciones sueltas —fechas, lugares, gastos— y la respuesta que
 * sale de ahí pega fragmentos de frases distintas, gramaticalmente rotos. Se
 * contestan en vivo igual que hoy: no se pierde nada, sólo no se vuelve
 * permanente algo que se lee mal.
 */
const EXCLUIDAS = new Set<string>([
  "Notas topográficas", "Topographical notes",
  "Cartas y apuntes personales", "Letters and personal records",
]);

/**
 * ⚠ «NOTAS MISCELANEAS» NO ESTA ACA, Y CASI LO ESTUVO. La primera versión listó
 * «Inventarios y cuentas», que **no es una sección sino un tema adentro de
 * “Notas misceláneas”**: el filtro no excluía nada y nadie se enteraba. Al
 * corregirlo, lo natural era poner la sección entera — su propia glosa dice
 * «listas de libros, cuentas, recordatorios y apuntes sueltos», que suena a la
 * misma clase de archivo que las dos de arriba.
 *
 * **Se leyeron las 9 que ya estaban congeladas antes de excluirla, y 7 se leen
 * bien.** «Notas sobre discípulos» trae a Salai —«ladrón, mentiroso, obstinado,
 * glotón»— y es de lo mejor que da el corpus; «Inventarios y cuentas» sale
 * ordenado y con gracia. Las dos flojas son los dos «Memoranda», que se pisan
 * entre sí y devuelven la misma cita.
 *
 * La analogía era buena y estaba equivocada. Las dos de arriba se excluyen por
 * lo que se LEYO de ellas —dos de dos malas en cartas, una de una en
 * topográficas—, no por parecerse a algo.
 */

const claves = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const l of readFileSync(new URL(".env.local", RAIZ), "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    // Vercel escribe sus valores entrecomillados; sin quitarlas el fetch falla en silencio (D-220).
    if (m && m[2]!.trim()) out[m[1]!] = m[2]!.trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
};

const idProveedor = arg("proveedor") || "deepseek/deepseek-v4-flash";
const proveedor = proveedorPorId(idProveedor, claves());
const limite = Number(arg("limite") || 40);
const soloSeccion = arg("seccion");
const soloIdioma = arg("idioma") as Idioma | "";

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
  /** `"mapa"` distingue estas de las 6 de portada, que no lo llevan. */
  origen?: "mapa";
  /** El rótulo limpio que se muestra en el rail. Sólo para poder auditar a mano. */
  visible?: string;
}

const previo: { regla?: string; huella?: string; respuestas?: Fija[] } =
  existsSync(SALIDA) ? JSON.parse(readFileSync(SALIDA, "utf8")) : {};
const todas: Fija[] = previo.respuestas ?? [];

/**
 * CLAVE DE VIGENCIA: idioma + pregunta EXACTA + huella. La misma de D-131, y por
 * el mismo motivo: la huella no cubre QUE pregunta va bajo cada id, así que un
 * id reusado serviría la respuesta vieja bajo el enunciado nuevo, en silencio.
 */
const yaVigente = new Set(
  todas.filter((r) => r.huella === HUELLA).map((r) => `${r.lang}:${r.pregunta}`));

/** Los temas pendientes, en orden de sección y de tema: determinista. */
const pendientes: { lang: Idioma; seccion: string; visible: string; consulta: string }[] = [];
for (const lang of ["es", "en"] as Idioma[]) {
  if (soloIdioma && lang !== soloIdioma) continue;
  for (const s of MAPA[lang]) {
    if (EXCLUIDAS.has(s.seccion)) continue;
    if (soloSeccion && s.seccion !== soloSeccion) continue;
    for (const t of s.temas) {
      if (yaVigente.has(`${lang}:${t.consulta}`)) continue;
      pendientes.push({ lang, seccion: s.seccion, visible: t.visible, consulta: t.consulta });
    }
  }
}

const total = (["es", "en"] as Idioma[]).reduce((a, l) =>
  a + MAPA[l].filter((s) => !EXCLUIDAS.has(s.seccion))
             .reduce((b, s) => b + s.temas.length, 0), 0);

console.log(`\n# Congelado del mapa — tanda\n`);
console.log(`  huella      : ${HUELLA}`);
console.log(`  proveedor   : ${idProveedor}`);
console.log(`  congelables : ${total} de ${MAPA.es.reduce((a, s) => a + s.temas.length, 0) + MAPA.en.reduce((a, s) => a + s.temas.length, 0)} (las de archivo quedan fuera)`);
console.log(`  ya vigentes : ${total - pendientes.length}`);
console.log(`  pendientes  : ${pendientes.length}`);
console.log(`  esta tanda  : ${Math.min(limite, pendientes.length)}\n`);

/**
 * ⚠ SE ESCRIBE POR TEMPORAL Y RENAME, Y SE REINTENTA. Sin esto la tanda se
 * muere. Encontrado corriendo la primera de 260: `writeFileSync` sobre el mismo
 * archivo en cada vuelta choca con cualquier otro proceso que lo esté leyendo
 * —el antivirus, un `exportar:portada`, el indexador del explorador— y en
 * Windows eso es un `UNKNOWN: -4094` que mató el proceso en la vuelta 117.
 *
 * `rename` sobre el mismo volumen es atómico: o está el archivo viejo entero o
 * el nuevo entero, nunca uno a medio escribir. Y si igual falla, se reintenta
 * una vez y después se SIGUE: perder una vuelta de escritura no vale abortar una
 * tanda de horas, porque la próxima vuelta lo reescribe completo igual.
 */
const guardar = (): void => {
  const tmp = new URL("respuestas_fijas.json.tmp", SALIDA);
  const cuerpo = JSON.stringify({ ...previo, huella: HUELLA, respuestas: todas }, null, 2);
  for (let intento = 0; intento < 2; intento++) {
    try {
      writeFileSync(tmp, cuerpo, "utf8");
      renameSync(tmp, SALIDA);
      return;
    } catch (e) {
      if (intento === 1) console.log(`  ⚠ no se pudo guardar esta vuelta: ${(e as Error).message}`);
    }
  }
};

let congeladas = 0, saltadas = 0;
const motivos = new Map<string, number>();
const anotar = (m: string): void => { motivos.set(m, (motivos.get(m) ?? 0) + 1); };

for (const t of pendientes.slice(0, limite)) {
  // Limitador pobre pero real: la primera versión de `precalcular` copió el
  // bucle del runner sin ritmo y se comió un 429 en la segunda llamada (D-112).
  await new Promise((r) => setTimeout(r, 4000));

  let R;
  try {
    R = await responder({
      motor, pregunta: t.consulta, idioma: t.lang,
      vector: await embeber(t.consulta),
      generar: (sys, msgs) => proveedor.generar(sys, msgs),
    });
  } catch (e) {
    saltadas++; anotar("error del proveedor");
    console.log(`  ✗ [${t.lang}] ${t.visible.slice(0, 44).padEnd(44)} error: ${(e as Error).message.slice(0, 38)}`);
    continue;
  }

  /**
   * LA MISMA COMPUERTA DE CONGELADO QUE `precalcular.ts`. Una respuesta que se
   * abstiene no puede quedar congelada como si contestara, y una con una cita
   * sin respaldo tras los reintentos se serviría mil veces sin que nadie la
   * vuelva a mirar. En el runner esas filas se guardan igual —esconderlas
   * falsearía la tasa de alucinación— pero acá NO entran.
   */
  if (R.decision !== "responde" || !R.texto) {
    saltadas++; anotar(`el gate no responde (${R.decision})`);
    console.log(`  ✗ [${t.lang}] ${t.visible.slice(0, 44).padEnd(44)} ${R.decision}`);
    continue;
  }
  if (R.citasSinRespaldo.length) {
    saltadas++; anotar("cita sin respaldo");
    console.log(`  ✗ [${t.lang}] ${t.visible.slice(0, 44).padEnd(44)} cita sin respaldo`);
    continue;
  }

  todas.push({
    id: `mapa:${t.lang}:${t.consulta}`, lang: t.lang, pregunta: t.consulta,
    respuesta: R.texto,
    pasajes: R.pasajes.flatMap((x) => x.chunk.richterNos),
    textosVistos: R.textosVistos, huella: HUELLA, proveedor: idProveedor,
    generado: new Date().toISOString().slice(0, 10),
    reintentosCita: R.reintentosCita, comillasQuitadas: R.comillasQuitadas, podadas: R.podadas,
    origen: "mapa", visible: t.visible,
  });
  congeladas++;
  console.log(`  ✓ [${t.lang}] ${t.visible.slice(0, 44).padEnd(44)} ${R.texto.replace(/\s+/g, " ").slice(0, 38)}…`);

  // Se escribe en cada vuelta: una tanda de 100 cortada en la 90 no se pierde.
  guardar();
}

guardar();

console.log(`\n  congeladas : ${congeladas}`);
console.log(`  saltadas   : ${saltadas}`);
for (const [m, n] of motivos) console.log(`     ${String(n).padStart(3)}× ${m}`);
console.log(`  quedan     : ${pendientes.length - congeladas - saltadas}\n`);
console.log(`escrito: artifacts/respuestas_fijas.json (${todas.length} entradas)\n`);
