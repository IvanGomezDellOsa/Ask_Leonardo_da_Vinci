"use client";

/**
 * El token de Cloudflare Turnstile, si está configurado. Ver D-206.
 *
 * ================================================================
 * QUE ARREGLA: UNA PROMESA QUE EL CODIGO NO CUMPLIA.
 * ================================================================
 *
 * `.env.example` decía —desde D-123— *«el widget vive en el frontend y todavía
 * no existe. Configurarla la activa sin tocar código»*. La segunda mitad era
 * falsa: `verificarTurnstile` rechaza cuando hay secreto y no hay token, y el
 * cliente no mandaba ninguno. **Poner `TURNSTILE_SECRET_KEY` devolvía 403 a todo
 * el mundo**, que es la peor forma de fallar: el sitio queda mudo y la causa está
 * en una variable de entorno que se acaba de configurar «sin tocar código».
 *
 * ⚠ SIN `NEXT_PUBLIC_TURNSTILE_SITE_KEY` ESTE HOOK NO HACE ABSOLUTAMENTE NADA:
 * no baja el script de Cloudflare, no monta nada y devuelve `undefined`. El
 * sitio de hoy —que no la tiene— se comporta exactamente igual que antes.
 *
 * LA SITE KEY ES PUBLICA POR DISEÑO y por eso puede ser `NEXT_PUBLIC_`. La que
 * no sale nunca del servidor es la secreta (D-035), que sigue viviendo sólo en
 * `TURNSTILE_SECRET_KEY` y sólo la lee la ruta.
 *
 * EL WIDGET ES INVISIBLE SALVO QUE CLOUDFLARE DESAFIE. Va en
 * `execution: "execute"` con `appearance: "interaction-only"`: no dibuja nada
 * hasta que hay que probar que hay una persona, y recién ahí aparece el recuadro
 * de Cloudflare. Es el único momento en que se ve algo, y es el momento en que
 * tiene que verse.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Lo que Cloudflare planta en `window`. Sólo lo que se usa. */
interface Turnstile {
  render(el: HTMLElement, o: Record<string, unknown>): string;
  execute(id: string): void;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window { turnstile?: Turnstile }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * UN SOLO SCRIPT POR PAGINA, a nivel de módulo y no por hook.
 *
 * Es la misma lección que D-128 con el embedder: `pipeline()` no memoiza y dos
 * componentes abrían dos sesiones ONNX de 112,8 MB. Acá el desperdicio sería
 * menor pero el efecto es peor — dos copias de `api.js` pelean por `window.turnstile`.
 */
let cargando: Promise<void> | null = null;

function cargarScript(): Promise<void> {
  if (cargando) return cargando;
  cargando = new Promise((resolver, rechazar) => {
    if (window.turnstile) return resolver();
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolver();
    s.onerror = () => rechazar(new Error("no se pudo cargar Turnstile"));
    document.head.appendChild(s);
  });
  return cargando;
}

/** Cuánto se espera al desafío antes de rendirse. Un humano tarda segundos. */
const ESPERA_MS = 12_000;

export interface Turnstiles {
  /** `false` cuando no hay site key: el resto del hook es inerte. */
  activo: boolean;
  /** El contenedor donde Cloudflare dibuja, si alguna vez desafía. */
  ref: React.RefObject<HTMLDivElement | null>;
  /**
   * Un token fresco, o `undefined` si no está configurado o el desafío falló.
   *
   * ⚠ EL TOKEN ES DE UN SOLO USO Y SE PIDE POR CONSULTA. Cloudflare lo invalida
   * al verificarlo, así que reutilizarlo daría un 403 en el segundo mensaje —un
   * fallo que sólo aparecería con más de un turno, o sea el que más tarda en
   * descubrirse.
   */
  token: () => Promise<string | undefined>;
}

export function useTurnstile(): Turnstiles {
  const ref = useRef<HTMLDivElement | null>(null);
  const widget = useRef<string | null>(null);
  const pendiente = useRef<((t: string | undefined) => void) | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let vivo = true;
    cargarScript()
      .then(() => {
        if (!vivo || !ref.current || !window.turnstile) return;
        widget.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          execution: "execute",
          appearance: "interaction-only",
          callback: (t: string) => { pendiente.current?.(t); pendiente.current = null; },
          "error-callback": () => { pendiente.current?.(undefined); pendiente.current = null; },
          "expired-callback": () => { pendiente.current?.(undefined); pendiente.current = null; },
        });
        setListo(true);
      })
      .catch(() => { /* sin Turnstile: el resto de los límites siguen en pie */ });
    return () => {
      vivo = false;
      const id = widget.current;
      if (id && window.turnstile) window.turnstile.remove(id);
      widget.current = null;
    };
  }, []);

  const token = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY || !listo || !widget.current || !window.turnstile) return undefined;
    const id = widget.current;
    window.turnstile.reset(id);
    return new Promise<string | undefined>((resolver) => {
      /**
       * El temporizador NO es de adorno: si Cloudflare no contesta —red caída,
       * script bloqueado por un adblock— sin él la promesa no se resuelve nunca
       * y el códice queda en «pensando» para siempre. Rendirse devuelve
       * `undefined`, el servidor responde 403 y el cliente lo dice: es un fallo
       * visible en vez de un cuelgue.
       */
      const reloj = setTimeout(() => { pendiente.current = null; resolver(undefined); }, ESPERA_MS);
      pendiente.current = (t) => { clearTimeout(reloj); resolver(t); };
      window.turnstile!.execute(id);
    });
  }, [listo]);

  return { activo: Boolean(SITE_KEY), ref, token };
}
