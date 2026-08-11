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
   *
   * SE ENUMERAN LOS ARCHIVOS, NO `artifacts/**`. El glob ancho metía los 11 MB
   * de la carpeta en el paquete de la función, incluidos ~4 MB que nadie lee en
   * runtime: `artifacts/q8/` (índices de experimento, gitignoreados, D-117),
   * `chunks_es.jsonl` (intermedio del traductor), `alcance.json`,
   * `sugeridas_pool.json` y `curaduria.md`. Esta lista es exactamente lo que
   * abre `Corpus` (ver `src/lib/retrieval.ts`) más la caché N0.
   */
  outputFileTracingIncludes: {
    "app/api/chat/route": [
      "./artifacts/index.bin",
      "./artifacts/index_meta.json",
      "./artifacts/chunks.json",
      "./artifacts/chunks_es.json",
      "./artifacts/bm25.json",
      "./artifacts/thresholds.json",
      "./artifacts/curaduria.json",
      "./artifacts/respuestas_fijas.json",
      "./artifacts/es/index.bin",
      "./artifacts/es/index_meta.json",
      "./artifacts/es/thresholds.json",
    ],
  },
};

export default nextConfig;
