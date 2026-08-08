/**
 * Verificacion de citas por comparacion de texto. Ver D-082.
 *
 * Es la unica comprobacion del proyecto que NO necesita un modelo: comparar lo
 * que Leonardo entrecomilla contra los pasajes que tuvo a la vista es un
 * `string match`. Por eso puede correr en generacion —antes de que la respuesta
 * llegue al usuario— y no solo en la evaluacion.
 *
 * POR QUE VIVE ACA Y NO EN `evals/`: despues de tres rondas de reglas de prompt
 * cada vez mas explicitas, las citas fabricadas seguian siendo el ULTIMO modo de
 * fallo (3 de 3 alucinaciones restantes). Pedirle al modelo que no invente es
 * una esperanza; comprobarlo es una garantia. Y es el fallo mas grave del
 * proyecto: una comilla con palabras que Leonardo no escribio le atribuye
 * elecciones que no hizo, que es exactamente lo contrario de lo que el producto
 * promete.
 */

import { recortar } from "./retrieval.js";

/** Solo `«»`, que es lo que el prompt pide. Ver D-074. */
const RE_CITA = /«([^»]+)»/g;

/**
 * Se compara por SECUENCIA DE PALABRAS, sin mayusculas ni puntuacion.
 *
 * Comparar caracteres daba falsos positivos tontos: "certainly" contra
 * "Certainly" —la cita va embebida a mitad de frase— o un punto final agregado.
 * Eso es puntuacion editorial al citar, y ademas la puntuacion de Richter es del
 * traductor de 1888, no de Leonardo: exigirla seria exigir fidelidad a la
 * persona equivocada. Lo que importa es que no cambie NINGUNA palabra.
 */
export const palabras = (s: string): string[] =>
  s.toLowerCase()
   .replace(/[‘’ʼ]/g, "'")
   .replace(/[^\p{L}\p{N}'\s]/gu, " ")
   .split(/\s+/)
   .filter(Boolean);

/** ¿Aparece `aguja` como secuencia contigua dentro de `pajar`? */
function contiene(aguja: string[], pajar: string[]): boolean {
  if (!aguja.length || aguja.length > pajar.length) return false;
  for (let i = 0; i + aguja.length <= pajar.length; i++) {
    let ok = true;
    for (let j = 0; j < aguja.length; j++) {
      if (pajar[i + j] !== aguja[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Una cita puede omitir el medio con puntos suspensivos, que es legitimo: se
 * parte por la elipsis y se exige que CADA tramo aparezca contiguo.
 */
export function esLiteral(cita: string, pajar: string[]): boolean {
  const tramos = cita.split(/\s*(?:\.\.\.|…)\s*/).map(palabras).filter((t) => t.length);
  return tramos.length > 0 && tramos.every((t) => contiene(t, pajar));
}

/**
 * Extrae las citas evaluables. Por debajo de 6 palabras no se evalua: puede ser
 * una palabra enfatizada y no una cita. El umbral es arbitrario y se declara.
 */
export function extraerCitas(t: string): string[] {
  return [...t.matchAll(RE_CITA)]
    .map((m) => m[1].trim())
    .filter((s) => s.split(/\s+/).length >= 6);
}

/**
 * Las citas de `respuesta` que NO aparecen en los pasajes. Vacio = todo bien.
 *
 * `textos` son los pasajes TAL COMO LOS VIO EL MODELO, ya en el idioma correcto
 * y recortados igual: comparar contra el texto entero marcaria como valida una
 * cita que el modelo no pudo haber leido.
 */
export function citasInvalidas(respuesta: string, textos: string[], maxPalabras = 200): string[] {
  const citas = extraerCitas(respuesta);
  if (!citas.length) return [];
  const pajar = palabras(textos.map((t) => recortar(t, maxPalabras)).join("   "));
  return citas.filter((c) => !esLiteral(c, pajar));
}

/**
 * Saca las comillas de las citas que no se pudieron verificar, dejando el texto
 * como parrafo comun. Ver D-083.
 *
 * ES LO QUE HAY QUE HACER CUANDO EL REINTENTO NO ALCANZA, y la razon es
 * especifica: **el problema de una cita fabricada no es lo que dice, es que
 * promete literalidad**. Una parafrasis afirma; una comilla afirma Y ADEMAS
 * afirma "estas son sus palabras exactas". Quitando las comillas se elimina la
 * segunda afirmacion —la falsa— y se conserva la primera, que el verificador
 * juzga con la misma vara que cualquier otra frase.
 *
 * NO ES ESCONDER EL CASO. El contenido queda intacto y sigue expuesto al juez;
 * si ademas es contenido inventado, lo marcara `N` igual. Lo unico que se quita
 * es una atribucion de autoria que sabemos falsa por `string match`, y dejarla
 * seria lo contrario de lo que el producto promete: que las palabras
 * entrecomilladas sean las de Leonardo.
 */
export function quitarComillasInvalidas(
  respuesta: string, textos: string[], maxPalabras = 200,
): { texto: string; quitadas: number } {
  const malas = new Set(citasInvalidas(respuesta, textos, maxPalabras));
  if (!malas.size) return { texto: respuesta, quitadas: 0 };
  let quitadas = 0;
  const texto = respuesta.replace(RE_CITA, (entera, dentro: string) => {
    if (!malas.has(dentro.trim())) return entera;
    quitadas++;
    return dentro.trim();
  });
  return { texto, quitadas };
}

/**
 * Formas de declinar, en los dos idiomas. Deliberadamente amplia.
 *
 * SE EXPORTA para que quien MIDA la abstencion use la misma definicion que
 * quien la PODA. Es la leccion mas cara de la fase: dos medidores con su propia
 * copia de `palabras()` reportaron 41,7% de citas inventadas donde habia 0%. Una
 * segunda regex «parecida» en un script de medicion es el mismo bug esperando.
 */
export const RE_DECLINA = new RegExp([
  // -- las formas originales
  "no dej[ée] (?:nada|poco) escrito", "no he dejado (?:nada|poco)", "nada escrito sobre",
  "set (?:nothing|little) down", "set down (?:nothing|little)", "have set down no",
  /*
   * -- las que faltaban. Medido sobre la corrida guardada: de los 54 casos
   * fuera de corpus que el gate dejo pasar, 28 declinan y la version anterior
   * SOLO VEIA 21. Los otros 7 declinaban perfectamente bien —«no tengo noticia
   * alguna de ese arte», «I have no knowledge of such a thing as a computer»,
   * «mis papeles no guardan nada escrito»— y quedaban fuera de las dos cosas
   * que esta regex gobierna: la medicion de la abstencion Y la poda de D-093.
   *
   * El patron es siempre el mismo: la regex se escribio mirando las formas que
   * el modelo usaba ESE dia, y el modelo tiene muchas maneras de decir que no.
   * Por eso ahora cada alternativa exige negacion explicita MAS un sustantivo de
   * registro o conocimiento, en vez de enumerar frases sueltas.
   */
  // «no tengo CONOCIMIENTO» se escapo de la primera ampliacion, que solo cubrio
  // «no tengo NOTICIA». Dos sustantivos del mismo giro, uno puesto y el otro no:
  // por eso la lista pide negacion + sustantivo de registro y no frases sueltas.
  "no tengo (?:noticia|conocimiento|constancia|memoria)", "no ten[gí]a noticia",
  "no (?:he )?dej[ée] escrito", "no consign[ée]",
  "(?:mis |los )?(?:cuadernos|papeles|notas|escritos)[^.]{0,40}\\bno\\b[^.]{0,40}(?:guardan|contienen|registran|dicen|hablan)",
  "no (?:guardan|guardo|hay) (?:registro|constancia|nada escrito)",
  "ni mis (?:cuadernos|papeles|notas)",
  "i have no knowledge", "i know nothing of", "i have never seen",
  "my (?:notebooks?|papers?|notes)[^.]{0,40}\\b(?:contain no|hold no|say nothing|make no|bear no)",
  "no record of", "i have not written", "i did not (?:write|set) down",
].join("|"), "i");

/**
 * Poda la continuacion de una declinacion cuando NO contiene ninguna cita.
 * Ver D-093.
 *
 * EL CASO. Cuando el sistema dice "sobre eso no deje nada escrito", lo que sigue
 * es contenido OPCIONAL — y medido, es donde se concentra la invencion que
 * quedaba: el modelo declina bien y enseguida agrega de que se ocupo, que le
 * interesa o que opina. Nada de eso esta en los pasajes y nada de eso hacia
 * falta decir.
 *
 * POR QUE NO SE CORTA SIEMPRE, que es lo que uno haria de primera: **de las 28
 * continuaciones medidas, 24 contienen una cita.** Ahi la prosa es andamiaje de
 * material legitimo —presenta el pasaje, lo enlaza— y cortarla destruiria
 * contenido real. El corte a ciegas seria peor que el problema.
 *
 * LA REGLA, entonces, es estrecha y segura: **se poda solo si despues de
 * declinar no hay NI UNA cita.** Eso deja exactamente el caso sin defensa
 * posible: afirmacion libre, sin respaldo, agregada a una respuesta que ya habia
 * dicho lo unico que podia sostener. Medido: 4 respuestas, 173 palabras.
 *
 * Y ES LA MISMA LECCION QUE `quitarComillasInvalidas`. Dos iteraciones pidiendo
 * por prompt que no agregue nada tras declinar redujeron la superficie a la
 * mitad pero no la eliminaron —y una de esas iteraciones la EMPEORO—. Pedirlo es
 * una esperanza; cortarlo es una garantia.
 */
export function podarTrasDeclinar(respuesta: string): { texto: string; podadas: number } {
  const m = RE_DECLINA.exec(respuesta);
  if (!m) return { texto: respuesta, podadas: 0 };
  const resto = respuesta.slice(m.index + m[0].length);
  const corte = resto.search(/[.!?]/);
  if (corte < 0) return { texto: respuesta, podadas: 0 };
  const despues = resto.slice(corte + 1);
  // Si hay una cita mas adelante, la continuacion sostiene contenido real.
  if (RE_CITA.test(despues)) { RE_CITA.lastIndex = 0; return { texto: respuesta, podadas: 0 }; }
  RE_CITA.lastIndex = 0;
  const podadas = despues.split(/\s+/).filter(Boolean).length;
  if (podadas < 8) return { texto: respuesta, podadas: 0 };   // una coletilla corta no molesta
  return { texto: respuesta.slice(0, m.index + m[0].length + corte + 1).trimEnd(), podadas };
}
