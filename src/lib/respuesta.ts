/**
 * La forma pública de una respuesta — compartida entre `app/api/chat/route.ts`
 * y `tools/exportar_portada.ts` (D-132). Antes vivía sólo en la ruta; sacarla
 * de ahí evita que el bundle de portada (§ D-132) y la respuesta en vivo
 * diverjan en silencio, la misma razón por la que `responder()` es una sola
 * definición (D-113) y no una por consumidor.
 */

export interface PasajePublico {
  richterNo: number | null;
  titulo: string | null;
  texto: string;
  url: string | null;
}

export interface RespuestaPublica {
  decision: "curada" | "abstiene" | "responde";
  texto: string;
  /** Sólo en `curada` (D-124): qué caso disparó y el fragmento exacto de la nota. */
  caso?: string;
  cita?: string | null;
  pasajes: PasajePublico[];
  /** Ids de notas de Richter vinculadas, para la tarjeta de citación. */
  notas: string[];
  /** `cache` = congelada por `npm run precalcular` (D-112). `vivo` = generada ahora. */
  origen: "cache" | "vivo";
  diagnostico: {
    cosMax: number | null; tau: number | null;
    reintentosCita: number; comillasQuitadas: number; podadas: number;
    citasSinRespaldo: string[];
  };
}
