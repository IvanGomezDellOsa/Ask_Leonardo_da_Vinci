# Reporte de los indices BM25

| | documentos | terminos | largo medio | tamano |
|---|---:|---:|---:|---:|
| ingles (`bm25.json`) | 2,062 | 15,252 | 62.4 | 1639 KB |
| castellano (`es/bm25.json`) | 2,062 | 18,519 | 58.0 | 1790 KB |

- `k1=1.5`, `b=0.75` · podados por aparecer en mas del 60% de los
  documentos: 0 en ingles, 0 en castellano

Se indexa el mismo texto que se embebe (`richterTitle + text`), para que
las dos mitades de la busqueda hibrida vean lo mismo.

> **Hasta D-226 el castellano no tenia el suyo** y reusaba el ingles, donde
> ninguna palabra castellana existe: la mitad lexica de la busqueda hibrida
> aportaba exactamente cero. Los RRF daban 1/61, 1/62, 1/63.

> **El BM25 solo ordena.** Nunca se umbraliza sobre su score: no es comparable entre consultas (D-021). Quien decide es el coseno denso.

