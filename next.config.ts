import type { NextConfig } from "next";

/**
 * Next 16 usa Turbopack por defecto. Se prueba primero sin tocar `resolve`:
 * Turbopack sigue la convención TS/Node ESM de resolver un import ".js"
 * contra el ".ts" que corresponde, que es justo lo que `src/lib` necesita
 * (importa con ".js" porque corre bajo Node/tsx, D-113). `turbopack: {}`
 * sólo confirma la elección explícita y calla el aviso de migración.
 */
const nextConfig: NextConfig = {
  turbopack: {},
  /**
   * `app/api/chat` lee `artifacts/` con `fs` en runtime (índices, umbrales,
   * caché N0), no con un `import` que el bundler pueda rastrear solo. Sin
   * esto, un build serverless (Vercel) podría no incluir esos archivos en el
   * paquete de la función. Local (`next start`) no lo necesita: ya está en
   * disco. Ver el comentario en `app/api/chat/route.ts`.
   */
  outputFileTracingIncludes: {
    "app/api/chat/route": ["./artifacts/**"],
  },
};

export default nextConfig;
