/**
 * Exporta la caché N0 a un bundle que el CLIENTE importa directo. Ver D-132.
 *
 *   npm run exportar:portada
 *
 * POR QUE EXISTE. `app/api/chat` sirve la caché N0 (D-112) instantáneamente
 * — pero para llegar a esa rama igual exige un `vector` de 384 posiciones
 * (D-097), y el único lugar de donde sale ese vector es `embed()` del hook
 * del navegador, que **espera a que el modelo de 129 MB esté cargado**
 * (`src/hooks/useEmbedder.ts`, D-127/D-128). Un click en una pregunta de
 * portada — la interacción que D-112 diseñó para no necesitar el modelo —
 * terminaba esperando al modelo igual, por una validación que ni siquiera
 * usa el vector en ese camino (la caché se busca por texto, no por coseno).
 *
 * Encontrado auditando el propio prompt de handoff para la conversación de
 * diseño: ahí decía *"el usuario puede tener su primera conversación
 * completa antes de que la descarga termine"*, y era falso — nunca se había
 * verificado contra el código real.
 *
 * LA SOLUCION NO ES TOCAR LA VALIDACION DE LA RUTA. Aflojarla para que el
 * vector sea opcional en el camino de caché resuelve el síntoma pero deja
 * una llamada de red de por medio — y con las funciones pausadas (R17), esa
 * llamada falla. Este script en cambio saca las 6 preguntas de portada
 * **del todo** del camino de red: el cliente las tiene desde que carga la
 * página, cero fetch, cero espera, funciona con el sitio entero caído salvo
 * el frontend estático.
 *
 * `app/api/chat` SIGUE sirviendo la misma caché N0 para cualquier otra
 * consulta que calce por texto (alguien la escribe a mano) — este bundle no
 * la reemplaza, la adelanta para el único camino que se sabe de antemano.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { cargarMotor, type Idioma } from "../src/lib/grounding.js";
import type { RespuestaPublica, PasajePublico } from "../src/lib/respuesta.js";

const RAIZ = new URL("../", import.meta.url);
const ART = new URL("artifacts/", RAIZ);

interface Fija {
  id: string; lang: Idioma; pregunta: string; respuesta: string;
  pasajes: number[]; textosVistos: string[]; huella: string;
}

const j: { huella: string; respuestas: Fija[] } =
  JSON.parse(readFileSync(new URL("respuestas_fijas.json", ART), "utf8"));

// Mismo criterio que `cargarMotor` en la ruta: un índice por idioma, para
// resolver título y url de cada pasaje con el corpus que le corresponde.
const motor = cargarMotor(ART);
const tituloDe = (c: { tituloEs?: string | null; richterTitle: string | null }, idioma: Idioma) =>
  (idioma === "es" && c.tituloEs !== undefined ? c.tituloEs : c.richterTitle) ?? null;

const bundle: Record<string, RespuestaPublica & { id: string }> = {};

for (const r of j.respuestas) {
  const corpus = motor.por[r.lang].corpus;
  const pasajes: PasajePublico[] = r.pasajes.map((n, i) => {
    // Misma resolución que la ruta: `textosVistos[i]` es la autoridad sobre
    // el texto (D-084), el número sólo sirve para buscar título y url.
    const c = corpus.chunks.find((x) => x.richterNos.includes(n));
    return {
      richterNo: n,
      titulo: c ? tituloDe(c, r.lang) : null,
      texto: r.textosVistos[i] ?? "",
      url: c?.url ?? null,
    };
  });
  bundle[`${r.id}:${r.lang}`] = {
    id: r.id,
    decision: "responde",
    texto: r.respuesta,
    pasajes,
    notas: [],
    origen: "cache",
    diagnostico: {
      cosMax: null, tau: null, reintentosCita: 0, comillasQuitadas: 0, podadas: 0,
      citasSinRespaldo: [],
    },
  };
}

/**
 * TS, NO JSON. Así el cliente lo importa como cualquier módulo —tree-shaken,
 * tipado, sin un `fetch` a `public/` de por medio— y el tipo `RespuestaPublica`
 * compartido (`src/lib/respuesta.ts`) evita que este bundle y la respuesta en
 * vivo del API diverjan en forma sin que nadie lo note.
 */
const salida = new URL("../src/data/portada.ts", import.meta.url);
mkdirSync(new URL("./", salida), { recursive: true });
writeFileSync(salida, `\
/**
 * GENERADO por \`npm run exportar:portada\` desde \`artifacts/respuestas_fijas.json\`.
 * NO EDITAR A MANO — D-112 prohíbe escribir una respuesta que no salió del
 * pipeline real, y ese principio aplica también acá.
 *
 * huella de origen: ${j.huella}
 */
import type { RespuestaPublica } from "../lib/respuesta.js";

export const PORTADA: Record<string, RespuestaPublica & { id: string }> =
${JSON.stringify(bundle, null, 2)};
`, "utf8");

const bytes = Buffer.byteLength(JSON.stringify(bundle));
console.log(`escrito: src/data/portada.ts`);
console.log(`  ${Object.keys(bundle).length} entradas · ${(bytes / 1024).toFixed(1)} KB de datos`);
