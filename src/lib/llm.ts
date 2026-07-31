/**
 * Cascada de proveedores, con presupuesto de tokens por minuto.
 *
 * D-023: el limite que ata en el free tier de Groq NO son los 14.400 requests
 * por dia sino los **6.000 tokens por minuto**. Con el prompt recortado de
 * D-020 (k=3 pasajes de <=200 palabras + historial de 4 turnos) son ~1.100
 * tokens por request, o sea ~5,5 req/min. El limite de tokens ata 11 veces
 * antes que el de requests, asi que el modo degradado se dispara por CONTADOR
 * DE TOKENS, preventivamente, y no esperando un 429.
 *
 * D-039: una sola llamada. El modelo recibe los pasajes y devuelve la respuesta
 * O la abstencion en personaje. No hay segunda llamada de verificacion: la
 * capa 4 de `05` se fusiona con la generacion.
 *
 * Ninguna clave sale de aca. Todas las llamadas pasan por el servidor (D-035).
 */

export type Idioma = "es" | "en";

export interface Pasaje {
  richterNo: number | null;
  richterTitle: string | null;
  text: string;
  url: string | null;
}

export interface Turno { rol: "usuario" | "leonardo"; texto: string }

export interface Respuesta {
  texto: string;
  proveedor: string;
  tokensEntrada: number;
  tokensSalida: number;
}

/** El limite real es de tokens, no de requests (D-023). */
export class PresupuestoTpm {
  private ventana: { t: number; tokens: number }[] = [];
  constructor(private readonly tpm = 6000) {}

  disponible(estimado: number): boolean {
    const corte = Date.now() - 60_000;
    this.ventana = this.ventana.filter((x) => x.t > corte);
    const usado = this.ventana.reduce((s, x) => s + x.tokens, 0);
    return usado + estimado <= this.tpm;
  }

  registrar(tokens: number): void {
    this.ventana.push({ t: Date.now(), tokens });
  }

  usoActual(): number {
    const corte = Date.now() - 60_000;
    return this.ventana.filter((x) => x.t > corte).reduce((s, x) => s + x.tokens, 0);
  }
}

const IDENTIDAD = {
  es: `Sos Leonardo da Vinci. Hablás en primera persona, en un registro del
Renacimiento pero legible. No sos un asistente y no rompés personaje.`,
  en: `You are Leonardo da Vinci. You speak in the first person, in a Renaissance
register that remains readable. You are not an assistant and do not break character.`,
};

const REGLA = {
  es: `REGLA DE FUNDAMENTACIÓN (inviolable)
  Solo podés afirmar contenido presente en los PASAJES de abajo. Podés
  reformular, resumir, conectar entre pasajes y adaptar el tono. NO podés
  agregar hechos, fechas, nombres, obras ni opiniones que no estén en los
  pasajes. Si los pasajes no alcanzan para responder, decilo en personaje:
  que de eso no dejaste nada consignado en tus papeles, y ofrecé un tema
  cercano que sí esté en los pasajes.

ANACRONISMO
  No conocés nada posterior a 1519. Si preguntan por algo posterior, respondé
  con curiosidad genuina, sin fingir conocerlo.

ESTILO
  2 a 4 párrafos cortos. Sin viñetas. No cites textualmente salvo que sea
  especialmente hermoso. Nunca digas "según mis notas" ni menciones pasajes,
  números ni fuentes: el aparato lo muestra la interfaz, no vos.`,
  en: `GROUNDING RULE (inviolable)
  You may only assert content present in the PASSAGES below. You may rephrase,
  summarise, connect passages and adapt tone. You may NOT add facts, dates,
  names, works or opinions that are not in the passages. If the passages are
  not enough to answer, say so in character: that you set nothing down about it
  in your papers, and offer a nearby subject that IS in the passages.

ANACHRONISM
  You know nothing after 1519. If asked about something later, answer with
  genuine curiosity, without pretending to know it.

STYLE
  2 to 4 short paragraphs. No bullet points. Do not quote verbatim unless it is
  especially beautiful. Never say "according to my notes" nor mention passages,
  numbers or sources: the interface shows the apparatus, not you.`,
};

/** ~4 caracteres por token; alcanza para el presupuesto, no para facturar. */
export const estimarTokens = (s: string): number => Math.ceil(s.length / 4);

export function construirPrompt(
  consulta: string, pasajes: Pasaje[], historial: Turno[], idioma: Idioma,
): { system: string; messages: { role: "user" | "assistant"; content: string }[] } {
  const cuerpo = pasajes
    .map((p) => `[${p.richterNo}] ${p.richterTitle ?? ""}\n${p.text}`)
    .join("\n\n");
  const system = `${IDENTIDAD[idioma]}\n\n${REGLA[idioma]}\n\nPASAJES\n\n${cuerpo}`;
  // Historial recortado a 4 turnos (D-020): es presupuesto de capacidad.
  const messages = historial.slice(-8).map((t) => ({
    role: (t.rol === "usuario" ? "user" : "assistant") as "user" | "assistant",
    content: t.texto,
  }));
  messages.push({ role: "user", content: consulta });
  return { system, messages };
}

export interface Proveedor {
  nombre: string;
  generar(system: string, messages: { role: string; content: string }[]): Promise<Respuesta>;
}

export function groq(modelo: string, apiKey: string): Proveedor {
  return {
    nombre: `groq/${modelo}`,
    async generar(system, messages) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelo,
          messages: [{ role: "system", content: system }, ...messages],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });
      if (!r.ok) {
        const err = new Error(`${r.status} ${await r.text()}`);
        (err as Error & { status?: number }).status = r.status;
        throw err;
      }
      const j = await r.json();
      return {
        texto: j.choices[0].message.content.trim(),
        proveedor: `groq/${modelo}`,
        tokensEntrada: j.usage?.prompt_tokens ?? 0,
        tokensSalida: j.usage?.completion_tokens ?? 0,
      };
    },
  };
}

/**
 * Recorre la cascada. Devuelve `null` cuando se agota: eso es el modo
 * "Leonardo descansa", que se sirve estatico y nunca como error tecnico.
 */
export async function generar(
  proveedores: Proveedor[], presupuesto: PresupuestoTpm,
  system: string, messages: { role: string; content: string }[],
): Promise<Respuesta | null> {
  const estimado = estimarTokens(system + messages.map((m) => m.content).join("")) + 300;
  if (!presupuesto.disponible(estimado)) return null;   // degradacion preventiva

  for (const p of proveedores) {
    try {
      const r = await p.generar(system, messages);
      presupuesto.registrar(r.tokensEntrada + r.tokensSalida);
      return r;
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status && status !== 429 && status < 500) throw e;   // error real, no cuota
      // 429 o 5xx: se pasa al siguiente proveedor
    }
  }
  return null;
}
