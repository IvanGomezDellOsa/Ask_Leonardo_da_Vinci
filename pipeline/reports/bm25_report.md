# Reporte del indice BM25

- Documentos: **2,068** · terminos: **15,271** · postings: 99,368
- Longitud media: 62.2 tokens · `k1=1.5`, `b=0.75`
- `bm25.json`: **1637 KB**
- Terminos podados por aparecer en mas del 60% de los documentos: 0 []

Se indexa el mismo texto que se embebe (`richterTitle + text`), para que
las dos mitades de la busqueda hibrida vean lo mismo.

> **El BM25 solo ordena.** Nunca se umbraliza sobre su score: no es comparable entre consultas (D-021). Quien decide es el coseno denso.

