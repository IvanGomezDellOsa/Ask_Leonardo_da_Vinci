/**
 * `npm run wikipedia` — el volumen de contexto de la biblioteca (D-155).
 *
 * QUE HACE. Baja el artículo «Leonardo da Vinci» de Wikipedia en los dos
 * idiomas, le saca todo lo que no es prosa, tira las secciones de aparato y
 * escribe `public/biblioteca/wikipedia.json`. Se corre a mano, cuando el dueño
 * del proyecto quiera actualizar el tomo; no corre en cada build, porque un
 * build no debería depender de que Wikipedia esté arriba ni cambiar de
 * contenido sin que nadie lo haya pedido.
 *
 * POR QUE `public/` Y NO `src/data/`. `portada.ts` se bundlea porque son seis
 * respuestas cortas que tienen que estar antes del primer render. Acá son
 * ~110 KB de prosa en dos idiomas para un tomo que la mayoría de los
 * visitantes no va a abrir. D-154 §6 dejó la regla: la estantería no pide un
 * solo byte hasta que abrís un volumen. Esto la respeta — el JSON se baja
 * recién cuando el tomo se abre.
 *
 * DE DONDE SALE EL TEXTO. De `action=query&prop=extracts&explaintext`, la
 * extensión TextExtracts. Es la salida más limpia que da la API: ya viene sin
 * hipervínculos, sin infobox, sin tablas, sin pies de foto, sin los botones de
 * «escuchar este artículo» y sin las cajas de navegación. Lo que queda por
 * limpiar es poco y está abajo, en `limpiar()`. La alternativa —bajar el HTML
 * y desarmarlo— sería escribir un limpiador de HTML entero para llegar al
 * mismo lugar.
 *
 * LO QUE NO ENTRA, Y POR QUE. Eponimia, Véase también, Notas, Referencias,
 * Bibliografía y Enlaces externos —y sus equivalentes en inglés—. Ninguna es
 * prosa sobre Leonardo: son aparato de la enciclopedia. En una hoja de un
 * libro que se pasa a mano, cuarenta páginas de citas numeradas serían
 * cuarenta páginas de ruido.
 *
 * LA LICENCIA. El artículo es CC BY-SA 4.0 y este repo es MIT. La atribución
 * —autor colectivo, número de revisión, fecha y enlace al artículo y a la
 * licencia— se escribe DENTRO del JSON, no al lado: así no existe una forma de
 * servir el texto sin llevarse la atribución puesta. `LICENSE-CORPUS.md` dice
 * lo mismo para quien lea el repo y no el JSON.
 *
 * NO TOCA EL CORPUS. Esto no se indexa, no se recupera y `responder()` no lo
 * ve nunca. El corpus sigue siendo Richter y nada más (D-018, D-026). Si algún
 * día alguien quiere que esto entre al RAG, es otra decisión y hay que releer
 * por qué el 0% de citas inventadas depende de que la fuente sea una sola.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { BIBLIOTECA } from "../src/data/biblioteca.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const SALIDA = path.join(RAIZ, "public", "biblioteca", "wikipedia.json");

/**
 * La cortesía que pide Wikimedia: identificarse. Un `User-Agent` genérico se
 * come un 403 y además está mal pedirlo así.
 * https://meta.wikimedia.org/wiki/User-Agent_policy
 */
const AGENTE = "AskLeonardoDaVinci/1.0 (https://askleonardodavinci.online)";

type Idioma = "es" | "en";

/**
 * LAS SECCIONES QUE NO ENTRAN, por idioma.
 *
 * Se comparan en minúsculas y sin tildes contra el título de la sección de
 * nivel 2. Si Wikipedia renombra una —pasa—, el tomo se llenaría de ruido en
 * silencio, así que `bajar()` avisa cuando alguna no apareció y falla cuando
 * no apareció ninguna.
 */
const APARATO: Record<Idioma, string[]> = {
  es: ["eponimia", "vease tambien", "notas", "referencias", "bibliografia", "enlaces externos"],
  // Sólo los `h2`. «Citations» y «Works cited» son subsecciones de
  // «References» y se van solas con el corte en cascada; ponerlas acá no
  // agregaba filtro y hacía saltar el aviso de sección ausente en cada corrida.
  en: ["see also", "notes", "references", "further reading", "external links"],
};

/** El artículo en cada idioma. */
const ARTICULO: Record<Idioma, { host: string; titulo: string }> = {
  es: { host: "es.wikipedia.org", titulo: "Leonardo da Vinci" },
  en: { host: "en.wikipedia.org", titulo: "Leonardo da Vinci" },
};

/** Un bloque de la hoja: un encabezado o un párrafo. */
type Bloque = { t: "h2" | "h3" | "p"; x: string };

type Volumen = {
  /** El título del artículo tal como lo devolvió la API. */
  titulo: string;
  /** La revisión exacta. Es lo que hace reproducible este JSON. */
  revision: number;
  /** Cuándo se bajó, en ISO. */
  consultado: string;
  url: string;
  /** La atribución, ya redactada, tal como se pinta en la portadilla. */
  credito: string;
  licencia: { nombre: string; url: string };
  bloques: Bloque[];
  /** Los `h2`, en orden. El índice del tomo. */
  capitulos: string[];
  palabras: number;
};

/**
 * LOS CARACTERES INVISIBLES, POR NOMBRE Y NO PEGADOS EN LA EXPRESION.
 *
 * Los tres se ven igual que nada en un editor, y una expresión regular con un
 * carácter invisible adentro es una expresión que nadie puede revisar leyendo.
 * Escritos así, además, sobreviven a cualquier herramienta que normalice el
 * archivo.
 */
const ZWSP = "​"; //           el espacio de ancho cero que deja cada nota
const FINOS = "   "; // duro, fino y fino-duro: separan cifras
const DIACRITICOS = "̀-ͯ"; // las tildes sueltas que deja NFD

/** Para comparar títulos de sección sin que una tilde decida el filtro. */
const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(new RegExp(`[${DIACRITICOS}]`, "g"), "")
    .toLowerCase()
    .trim();

async function api(host: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({ format: "json", formatversion: "2", ...params }).toString();
  const r = await fetch(url, { headers: { "User-Agent": AGENTE } });
  if (!r.ok) throw new Error(`${url.host} respondió ${r.status}`);
  return r.json();
}

/** Las tres limpiezas que hacen falta después de TextExtracts. */
const RUIDO: { que: RegExp; por: string }[] = [
  // 1. El espacio de ancho cero que queda donde estaba cada llamada a nota.
  //    Es el ruido más abundante del artículo castellano: hay ~300.
  { que: new RegExp(ZWSP, "g"), por: "" },
  // 2. Las llamadas a nota que sobrevivieron con corchetes: [1], [nota 2].
  { que: /\[[^\]]{0,18}\]/g, por: "" },
  // 3. Los espacios finos e irrompibles que Wikipedia usa entre número y
  //    unidad. En una hoja angosta rompen el renglón de más.
  { que: new RegExp(`[${FINOS}]`, "g"), por: " " },
];

/**
 * LO QUE QUEDA DE RUIDO DESPUES DE TextExtracts, y de dónde sale cada cosa.
 *
 * Nada de esto es cosmético: son marcas que quedan donde había un elemento que
 * la extensión sacó, y sin limpiarlas el texto llega con espacios dobles y
 * palabras sueltas en el medio de una oración.
 */
function limpiar(texto: string, idioma: Idioma): string {
  let t = texto;
  for (const { que, por } of RUIDO) t = t.replace(que, por);
  // El enlace del reproductor de audio del título: «… da Vinci  escuchar
  // (Vinci, 15 de abril…». TextExtracts saca el ícono y deja la palabra.
  t = t.replace(idioma === "es" ? /\s+escuchar\s+(?=\()/ : /\s+listen\s+(?=\()/i, " ");
  return t
    .replace(/[ \t]+/g, " ")
    .replace(/ ([,.;:)])/g, "$1")
    .trim();
}

/** De texto plano con `== títulos ==` a bloques, tirando el aparato. */
function bloquesDe(texto: string, idioma: Idioma): { bloques: Bloque[]; vistos: string[] } {
  const bloques: Bloque[] = [];
  const vistos: string[] = [];
  // `saltando` se enciende al entrar a una sección de aparato y se apaga sólo
  // en el próximo `h2`: así se van también sus subsecciones, que es lo que
  // pasa con «References → Citations → Works cited» en inglés.
  let saltando = false;

  for (const crudo of texto.split("\n")) {
    const linea = crudo.trim();
    if (!linea) continue;

    const enc = /^(={2,4})\s*(.+?)\s*\1$/.exec(linea);
    if (enc) {
      const nivel = enc[1]!.length;
      const titulo = limpiar(enc[2]!, idioma);
      if (nivel === 2) {
        vistos.push(sinTildes(titulo));
        saltando = APARATO[idioma].includes(sinTildes(titulo));
      }
      if (saltando) continue;
      // Los `h4` del artículo («Primeras obras», «Década de 1480») son
      // divisiones de una sola sección; en una hoja de libro, tres niveles de
      // jerarquía son dos de más. Se aplastan al segundo.
      bloques.push({ t: nivel === 2 ? "h2" : "h3", x: titulo });
      continue;
    }

    if (saltando) continue;
    const parrafo = limpiar(linea, idioma);
    // Después de limpiar quedan renglones que eran sólo una marca de nota.
    if (parrafo.length < 2) continue;
    bloques.push({ t: "p", x: parrafo });
  }

  return { bloques, vistos };
}

async function bajar(idioma: Idioma): Promise<Volumen> {
  const { host, titulo } = ARTICULO[idioma];

  const extracto = (await api(host, {
    action: "query",
    prop: "extracts|revisions",
    explaintext: "1",
    rvprop: "ids|timestamp",
    titles: titulo,
  })) as {
    query: { pages: { title: string; extract?: string; revisions?: { revid: number }[] }[] };
  };

  const pagina = extracto.query.pages[0];
  if (!pagina?.extract) throw new Error(`${host}: el artículo «${titulo}» no trajo texto`);
  const revision = pagina.revisions?.[0]?.revid;
  if (!revision) throw new Error(`${host}: el artículo «${titulo}» no trajo revisión`);

  const { bloques, vistos } = bloquesDe(pagina.extract, idioma);

  /*
   * LA GUARDA. Si Wikipedia renombra «Referencias», el aparato entra al tomo
   * sin que nadie se entere: cuarenta páginas de citas numeradas en un libro
   * que se pasa a mano. Que la sección esperada no aparezca es un error, no un
   * aviso — es exactamente el patrón que el proyecto viene comiendo quince
   * veces (00-README §Las lecciones, 1): medir una dimensión distinta de la
   * que gobierna el resultado y recibir un número plausible.
   */
  const ausentes = APARATO[idioma].filter((s) => !vistos.includes(s));
  if (ausentes.length === APARATO[idioma].length) {
    throw new Error(
      `${host}: no apareció ninguna de las secciones de aparato (${APARATO[idioma].join(", ")}). ` +
        `El artículo cambió de estructura y el filtro dejó de filtrar.`,
    );
  }
  if (ausentes.length) {
    console.warn(
      `  aviso  ${host}: no apareció ${ausentes.join(", ")} — puede haber cambiado de nombre`,
    );
  }

  const capitulos = bloques.filter((b) => b.t === "h2").map((b) => b.x);
  const palabras = bloques.reduce((a, b) => a + b.x.split(/\s+/).length, 0);
  const url = `https://${host}/wiki/${encodeURIComponent(titulo.replace(/ /g, "_"))}`;
  const consultado = new Date().toISOString();

  const credito =
    idioma === "es"
      ? `«${pagina.title}», Wikipedia, la enciclopedia libre. Texto de sus colaboradores, ` +
        `revisión ${revision}, consultada el ${consultado.slice(0, 10)}. ` +
        `Disponible bajo licencia CC BY-SA 4.0.`
      : `“${pagina.title}”, Wikipedia, the free encyclopedia. Text by its contributors, ` +
        `revision ${revision}, retrieved ${consultado.slice(0, 10)}. ` +
        `Available under the CC BY-SA 4.0 licence.`;

  return {
    titulo: pagina.title,
    revision,
    consultado,
    url,
    credito,
    licencia: {
      nombre: "CC BY-SA 4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0/deed.es",
    },
    bloques,
    capitulos,
    palabras,
  };
}

async function main() {
  const volumen = BIBLIOTECA.find((l) => l.texto);
  if (!volumen?.texto) throw new Error("El catálogo no tiene ningún volumen de texto.");

  const salida: Record<Idioma, Volumen> = { es: await bajar("es"), en: await bajar("en") };

  for (const idioma of ["es", "en"] as const) {
    const v = salida[idioma];
    console.log(
      `  ${idioma}  ${v.capitulos.length} capítulos · ${v.bloques.length} bloques · ` +
        `${v.palabras.toLocaleString("es-AR")} palabras · rev ${v.revision}`,
    );
  }

  /*
   * EL LOMO CUENTA CAPITULOS Y EL CATALOGO LOS TIENE ESCRITOS A MANO. Si los
   * números se separan, el lomo miente y nadie se entera: falla acá. Es la
   * misma guarda que `optimizar_biblioteca.ts` hace contra el disco.
   *
   * SE COMPRUEBAN LOS DOS IDIOMAS, uno por uno, y no la suma ni el castellano
   * solo. Los dos artículos no son traducciones —el inglés tiene ocho
   * capítulos donde el castellano tiene cuatro—, así que un único número acá
   * era correcto para un idioma y falso para el otro, que es exactamente cómo
   * se veía antes de que el navegador lo mostrara.
   */
  const desacuerdos = (["es", "en"] as const)
    .map((i) => ({ i, dice: volumen.texto!.capitulos[i], trajo: salida[i].capitulos.length }))
    .filter((d) => d.dice !== d.trajo);
  if (desacuerdos.length) {
    throw new Error(
      desacuerdos
        .map(
          (d) =>
            `[${d.i}] el catálogo dice ${d.dice} capítulos y el artículo trajo ${d.trajo}: ` +
            salida[d.i].capitulos.join(" · "),
        )
        .join("\n") +
        `\nCorregí \`capitulos\` en el volumen «${volumen.id}» de src/data/biblioteca.ts.`,
    );
  }

  const json = JSON.stringify(salida);
  await writeFile(SALIDA, json, "utf8");
  console.log(
    `\n  ${path.relative(RAIZ, SALIDA)} — ${(json.length / 1024).toFixed(1)} KB\n` +
      `  No se baja hasta que alguien abre el tomo.`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
