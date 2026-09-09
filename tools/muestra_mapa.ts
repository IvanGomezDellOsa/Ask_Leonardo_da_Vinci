/**
 * ¿Vale la pena congelar las respuestas del mapa? Diez temas, leídos. Ver 28 §4C.
 *
 *   npm run muestra:mapa              10 temas, 5 por idioma
 *   npm run muestra:mapa -- --n 20    más
 *
 * POR QUE EXISTE, Y POR QUE ES UN SCRIPT Y NO UNA LECTURA A OJO. El plan dice
 * congelar una respuesta por cada tema del mapa: **~800 generaciones contra un
 * techo de 400 por día**. Antes de gastar eso hay que saber si la respuesta se
 * LEE bien, y ese dato no lo tiene nadie: `alcance.json` midió que 345 de 375
 * temas RECUPERAN sus propios pasajes, que es otra cosa. Que el pasaje correcto
 * entre al top-3 no dice nada sobre si el párrafo que sale después se entiende.
 *
 * ⚠ USA EL MISMO `responder()` Y LA MISMA COMPUERTA DE CONGELADO que usaría el
 * congelador de verdad. Si leyera con un camino distinto del que después
 * escribe, estaría leyendo otra cosa que la que se publicaría — que es el
 * defecto que este proyecto lleva quince entradas documentando.
 *
 * ⚠ LA MUESTRA ES DETERMINISTA. Se recorren las secciones en orden y se toma un
 * tema de cada una espaciado por el mismo salto: dos corridas dan los mismos
 * diez temas, así que dos lecturas son comparables. Al azar no lo serían.
 */

import { readFileSync } from "node:fs";
import { cargarExtractor } from "../src/lib/embed.js";
import { cargarMotor, type Idioma } from "../src/lib/grounding.js";
import { responder } from "../src/lib/responder.js";
import { proveedorPorId } from "../src/lib/llm.js";
import { MAPA } from "../src/data/mapa.js";

const RAIZ = new URL("../", import.meta.url);
const ART = new URL("artifacts/", RAIZ);

const arg = (n: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : "";
};
const N = Number(arg("n") || 10);

const claves = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const l of readFileSync(new URL(".env.local", RAIZ), "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    // Vercel escribe sus valores entrecomillados; sin quitarlas el fetch falla en silencio (D-220).
    if (m && m[2].trim()) out[m[1]] = m[2].trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
};

const idProveedor = arg("proveedor") || "deepseek/deepseek-v4-flash";
const proveedor = proveedorPorId(idProveedor, claves());

const motor = cargarMotor(ART);
const extractor = await cargarExtractor();
const embeber = async (t: string): Promise<Float32Array> =>
  (await extractor("query: " + t, { pooling: "mean", normalize: true })).data as Float32Array;

/** Un tema de cada sección, espaciados igual. Determinista a propósito. */
function muestra(lang: Idioma, cuantos: number): { seccion: string; visible: string; consulta: string }[] {
  const secciones = MAPA[lang];
  const out: { seccion: string; visible: string; consulta: string }[] = [];
  const salto = Math.max(1, Math.floor(secciones.length / cuantos));
  for (let i = 0, s = 0; out.length < cuantos && s < secciones.length * 2; s++, i += salto) {
    const sec = secciones[i % secciones.length]!;
    const t = sec.temas[Math.floor(sec.temas.length / 2)];
    if (t && !out.some((x) => x.consulta === t.consulta)) {
      out.push({ seccion: sec.seccion, visible: t.visible, consulta: t.consulta });
    }
  }
  return out;
}

console.log(`\n# Muestra del mapa — ¿la respuesta se lee bien?\n`);
console.log(`  proveedor: ${idProveedor}`);
console.log(`  temas    : ${N} (${Math.ceil(N / 2)} es · ${Math.floor(N / 2)} en)\n`);

let responden = 0, conCitaRota = 0, abstienen = 0, palabras = 0;

for (const lang of ["es", "en"] as Idioma[]) {
  for (const t of muestra(lang, lang === "es" ? Math.ceil(N / 2) : Math.floor(N / 2))) {
    await new Promise((r) => setTimeout(r, 4000));
    const R = await responder({
      motor, pregunta: t.consulta, idioma: lang,
      vector: await embeber(t.consulta),
      generar: (sys, msgs) => proveedor.generar(sys, msgs),
    });

    console.log("=".repeat(78));
    console.log(`[${lang}] ${t.seccion} › ${t.visible}`);
    console.log(`  consulta que se manda: «${t.consulta}»`);
    if (R.decision !== "responde") {
      abstienen++;
      console.log(`  ⚠ EL GATE NO RESPONDE (${R.decision}) — este tema NO se podría congelar.\n`);
      continue;
    }
    responden++;
    palabras += (R.texto ?? "").split(/\s+/).length;
    if (R.citasSinRespaldo.length) {
      conCitaRota++;
      console.log(`  ⚠ ${R.citasSinRespaldo.length} cita(s) sin respaldo tras ${R.reintentosCita} reintentos — NO se congelaría.`);
    }
    console.log(`  pasajes: ${R.pasajes.flatMap((x) => x.chunk.richterNos).join(", ")}`);
    console.log(`  reintentos ${R.reintentosCita} · comillas quitadas ${R.comillasQuitadas} · podadas ${R.podadas}`);
    console.log(`\n${R.texto}\n`);
  }
}

console.log("=".repeat(78));
console.log(`\n## Resumen\n`);
console.log(`  responden        : ${responden}`);
console.log(`  se abstienen     : ${abstienen}  ← no congelables`);
console.log(`  con cita rota    : ${conCitaRota}  ← no congelables`);
console.log(`  palabras/resp.   : ${responden ? Math.round(palabras / responden) : 0}`);
console.log(`\n> Se lee para decidir §4C. El número no decide solo: hay que LEER los`);
console.log(`> párrafos de arriba y ver si un visitante entendería la respuesta.\n`);
