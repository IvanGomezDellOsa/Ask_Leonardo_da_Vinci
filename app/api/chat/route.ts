/**
 * Ruta del chat. Ver D-119 y D-120.
 *
 * NO EMBEBE (D-118, D-022): el cliente calcula el vector en el navegador con
 * Transformers.js y lo manda ya hecho. Este handler sólo lo reconstruye.
 *
 * PASA POR `responder()`, LA UNICA DEFINICION (D-113): el mismo camino que usan
 * los evals, así que lo que un usuario ve tiene las mismas tres garantías
 * (D-082 verificación de cita, D-083 comillas inválidas, D-093 poda tras
 * declinar) que el número que se publica.
 *
 * NO HACE STREAMING TOKEN A TOKEN DEL PROVEEDOR. Ver D-120: las garantías de
 * arriba corren DESPUES de tener el texto completo — no se puede verificar una
 * cita a mitad de generar. Transmitir tokens crudos mostraría al usuario texto
 * que después se corrige o desaparece, que es exactamente lo que este proyecto
 * existe para no hacer. Se devuelve la respuesta completa YA VERIFICADA; la
 * sensación de streaming (si se quiere) es responsabilidad del cliente,
 * revelando ese texto de a poco.
 *
 * Ninguna clave sale de acá (D-035): las tres viven en variables de entorno del
 * servidor, Next.js las carga solo de `.env.local`.
 */

// ".js" explícito por el mismo motivo que las líneas de abajo: bajo
// "nodenext" (necesario para que Turbopack resuelva los imports de
// `src/lib`, ver más abajo), un import ESM sin extensión de un paquete sin
// mapa de "exports" — el caso de "next"— no resuelve; con ".js" sí.
import { NextRequest, NextResponse } from "next/server.js";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
// Extensión ".js" a propósito, igual que el resto del proyecto (Node/tsx en
// modo ESM la exige). `tsconfig.json` en "nodenext" le enseña a Turbopack a
// resolverla contra el ".ts" real.
import { cargarMotor, type Idioma } from "../../../src/lib/grounding.js";
import { responder } from "../../../src/lib/responder.js";
import { PresupuestoTpm, generar, proveedorPorId, type Proveedor } from "../../../src/lib/llm.js";

export const runtime = "nodejs";

/**
 * `process.cwd()`, no `new URL("../../../artifacts/", import.meta.url)`.
 *
 * Todo el resto del proyecto (`evals/comun.ts`, `tools/ask.ts`) usa la forma
 * relativa a `import.meta.url` porque corre bajo tsx y ese archivo SÍ vive
 * donde el disco dice. Acá no: Turbopack empaqueta esta ruta, `import.meta.url`
 * apunta al artefacto compilado, no al código fuente, y además Turbopack
 * analiza ese patrón en build time para decidir qué empaquetar — falla porque
 * `artifacts/` es una carpeta de datos, no un módulo. `process.cwd()` es la
 * raíz del proceso de Next tanto en `next dev` como en `next start`, y evita
 * el análisis estático. Ver `outputFileTracingIncludes` en `next.config.ts`
 * para que un despliegue serverless empaquete `artifacts/` igual.
 */
const ART = pathToFileURL(join(process.cwd(), "artifacts") + "/");

// Carga una vez por instancia del servidor, no por request — igual que
// `evals/run.ts` y `tools/ask.ts` (D-113).
const motor = cargarMotor(ART);

/**
 * `gemini-3.1-flash-lite` es el generador de producción (D-089: la mitad de
 * D-088 que quedó vigente). Groq queda de resguardo por su cuota
 * independiente (D-023) — DeepSeek NO entra acá: D-089 lo reasignó a juez,
 * instrumental, y dejarlo en la cascada de operación repetiría el error que
 * esa entrada revocó.
 *
 * Cada proveedor se agrega sólo si su clave está presente, para que faltar
 * una no tumbe el servidor entero — degrada, no rompe (mismo criterio que
 * `cargarMotor` con el índice en castellano, D-107).
 */
function cascadaDeProduccion(env: Record<string, string | undefined>): Proveedor[] {
  const p: Proveedor[] = [];
  const intentar = (id: string) => {
    try { p.push(proveedorPorId(id, env as Record<string, string>)); } catch { /* falta la clave */ }
  };
  intentar("gemini/gemini-3.1-flash-lite");
  intentar("groq/llama-3.3-70b-versatile");
  return p;
}

const presupuesto = new PresupuestoTpm(6000);

interface CuerpoPedido {
  pregunta: string;
  idioma: Idioma;
  vector: number[];
}

/**
 * 384 = las dims de `Xenova/multilingual-e5-small` (D-097). Sin este chequeo
 * un vector vacío pasaba la validación entera —`[].every(...)` es `true` por
 * vacuidad— y se coló hasta `Corpus.buscar`, donde el coseno contra un vector
 * de norma 0 da `cos: null` en los tres pasajes pero IGUAL generó con Gemini:
 * una llamada real y facturable disparada por un pedido degenerado.
 * Descubierto probando este mismo endpoint.
 */
const DIMS_EMBEDDING = 384;

function validar(cuerpo: unknown): CuerpoPedido | null {
  if (!cuerpo || typeof cuerpo !== "object") return null;
  const c = cuerpo as Record<string, unknown>;
  if (typeof c.pregunta !== "string" || !c.pregunta.trim() || c.pregunta.length > 500) return null;
  if (c.idioma !== "es" && c.idioma !== "en") return null;
  if (!Array.isArray(c.vector) || c.vector.length !== DIMS_EMBEDDING) return null;
  if (!c.vector.every((x) => typeof x === "number" && Number.isFinite(x))) return null;
  return { pregunta: c.pregunta.trim(), idioma: c.idioma, vector: c.vector as number[] };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "cuerpo no es JSON válido" }, { status: 400 });
  }
  const pedido = validar(cuerpo);
  if (!pedido) {
    return NextResponse.json({ error: "faltan o son inválidos: pregunta, idioma, vector" }, { status: 400 });
  }

  const cascada = cascadaDeProduccion(process.env);
  if (cascada.length === 0) {
    // No es un 500: es una configuración incompleta del servidor, distinguible
    // de un error del pedido. `decidirCon` (capa 0/1) sigue funcionando sin
    // esto, pero acá se corta antes por honestidad: sin generador no hay
    // respuesta que dar, y silenciarlo detrás de un 500 genérico ocultaría la
    // causa real (falta configurar `.env.local`).
    return NextResponse.json({ error: "el servidor no tiene generador configurado" }, { status: 503 });
  }

  try {
    const R = await responder({
      motor,
      pregunta: pedido.pregunta,
      idioma: pedido.idioma,
      vector: new Float32Array(pedido.vector),
      generar: async (system, messages) => {
        const g = await generar(cascada, presupuesto, system, messages);
        return g ?? { texto: "", tokensEntrada: 0, tokensSalida: 0 };
      },
    });
    return NextResponse.json(R);
  } catch (e) {
    console.error("[api/chat]", e);
    return NextResponse.json({ error: "fallo interno" }, { status: 500 });
  }
}
