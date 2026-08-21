"use client";

/**
 * LA BIBLIOTECA: la estantería de tres volúmenes y la lectura hoja a hoja.
 *
 * LAS CUATRO DECISIONES Y POR QUÉ (el diseño está en el canvas de Claude
 * Design; acá va el porqué de lo que quedó en código):
 *
 * 1. VA EN CLARO, y el hero sigue de noche. No es gusto: las veinte láminas
 *    son papel crema envejecido, y sobre fondo oscuro quedaban veinte
 *    rectángulos claros flotando. Sobre pergamino se apoyan, que es lo que
 *    hace un libro. El códice de chat sigue oscuro porque ahí se lee texto
 *    largo y el color compite.
 *
 * 2. LA ESTANTERÍA ES DE LOMOS. Tres tapas de frente son tres carteles. El
 *    volumen elegido sale del estante y se sostiene al costado, y su lugar
 *    queda vacío — si el tomo está afuera no puede seguir en la fila. El
 *    ancho de cada lomo sale de cuántas láminas tiene adentro, así que la
 *    estantería informa antes de que la toques.
 *
 * 3. CERO BYTES DE ARTE PARA LOS LIBROS. Cuero, nervios y filete salen de
 *    gradientes sobre un solo `hue` por volumen. Con los ~133 MB del modelo
 *    de embeddings ya bajando (D-118), tres portadas en PNG competirían con
 *    el número que ya duele.
 *
 * 4. EL MOTOR NO PASA POR REACT. El pliegue y la lupa viven en
 *    `biblioteca-motor.ts` y escriben el DOM directo. React sólo sabe qué
 *    volumen, qué pliego y qué idioma. Ver `docs/19-bocetos-biblioteca.md`
 *    §4.1: es el reparto al que llegaron los dos bocetos desde stacks
 *    opuestos.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BIBLIOTECA, type Lamina, type Libro } from "../data/biblioteca.js";
import { useAngosto } from "../hooks/useAngosto.js";
import type { Idioma } from "../lib/cliente-chat.js";
import { FUENTE } from "./estilos.js";
import {
  acercarLupa, aplicarGiro, apartarLupa, colocarLupa, construirPliegue,
  cssDePose, indiceDe, paginarTexto, pasoResorte, poseDelRelevo, posePresentada, suavizar,
  ARRASTRE, POSE_GUARDADO, RESORTE_CANCELA, RESORTE_COMPROMISO,
  type BloqueTexto, type CajaLibro, type EntradaIndice, type EstadoLupa, type Geometria,
  type HojaTexto,
  type Pliegue, type Pose, type Resorte,
} from "./biblioteca-motor.js";

/**
 * La proporción de una hoja.
 *
 * En escritorio es la del diseño —442/582, la de un folio—. En teléfono la
 * hoja se hace más alta a propósito: el ancho lo fija la pantalla, así que con
 * la proporción de folio sobraban 200 px de alto sin usar y la lámina salía
 * más chica de lo que la pantalla permitía.
 */
const RATIO_HOJA = 442 / 582;
const RATIO_HOJA_MOVIL = 0.66;

/** Las constantes del giro. Ver `19-bocetos-biblioteca.md` §2.2 y §4.4. */
const TIRAS = 14;
const COMBADO = 0.6;
const DURACION = 760;

/* ---- Las medidas del estante, en píxeles a escala 1 --------------------- */

/** Lo que se separan los tomos entre sí. */
const HUECO_FILA = 4;
/** Cuánto se aparta del mueble el tomo presentado. */
const SEPARACION_TAPA = 56;
/** Lo que ocupa la ficha cuando va al costado del mueble. */
const ANCHO_FICHA = 400;
/** Lo que ocupa la ficha cuando va arriba, en compacto y en teléfono. */
const ALTO_FICHA = 250;
/** Aire a los costados de la escena. */
const MARGEN_ESCENA = 56;
/**
 * Lo que dura el relevo entero. Seis fases adentro de este número: a 820 ms
 * cada una duraba poco más de cien milisegundos y la coreografía se leía como
 * un parpadeo. Acá se ve salir un tomo y entrar el otro.
 */
const DURACION_RELEVO = 1500;
/** El alto que la fila necesita para verse a escala 1. */
const ALTO_MUEBLE = 470;

/** El radio del vidrio, como fracción del alto de la hoja. */
/*
 * EL RADIO DEL VIDRIO, como fracción del alto de la hoja. Bajó un 20% en
 * D-156: a 0.261 el vidrio tapaba casi un tercio de la lámina, y una lupa que
 * cubre lo que uno quiere comparar deja de ser una lupa.
 */
const RADIO_LUPA = 0.209;

const COPY = {
  firma: { es: "Biblioteca", en: "Library" },
  laminas: { es: "láminas", en: "plates" },
  capitulos: { es: "capítulos", en: "chapters" },
  cargando: { es: "Abriendo el volumen…", en: "Opening the volume…" },
  sinTexto: {
    es: "El texto de este volumen no cargó. Se puede leer en Wikipedia.",
    en: "This volume’s text did not load. It can be read on Wikipedia.",
  },
  irAlArticulo: { es: "Leerlo en Wikipedia", en: "Read it on Wikipedia" },
  /*
   * LA ADVERTENCIA DEL VOLUMEN DE CONTEXTO. Va en la portadilla, que es la
   * primera hoja que se ve al abrirlo, y dice lo único que importa: este tomo
   * no es de Leonardo y no es de donde sale lo que el chat responde.
   */
  ajeno: {
    es: "Este volumen no es de Leonardo. Es contexto de una enciclopedia, y no forma parte de lo que Leonardo lee para responder.",
    en: "This volume is not Leonardo’s. It is context from an encyclopaedia, and it is no part of what Leonardo reads in order to answer.",
  },
  abrir: { es: "Abrir el volumen", en: "Open the volume" },
  volver: { es: "Biblioteca", en: "Library" },
  anteriorVol: { es: "Volumen anterior", en: "Previous volume" },
  siguienteVol: { es: "Volumen siguiente", en: "Next volume" },
  anteriorHoja: { es: "Hoja anterior", en: "Previous leaf" },
  siguienteHoja: { es: "Hoja siguiente", en: "Next leaf" },
  pliego: { es: "Pliego", en: "Sheet" },
  hoja: { es: "Hoja", en: "Leaf" },
  de: { es: "de", en: "of" },
  lamina: { es: "Lámina", en: "Plate" },
  andar: { es: "Verlo andar", en: "See it run" },
  enYoutube: { es: "Ver en YouTube", en: "Watch on YouTube" },
  lupa: { es: "Lupa", en: "Loupe" },
  indice: { es: "Índice", en: "Contents" },
  verArticulo: { es: "Ver el original", en: "See the original" },
} as const;

type Vista = "estanteria" | "lectura";
type Pagina =
  | { tipo: "portadilla" }
  | { tipo: "vacia" }
  | { tipo: "lamina"; lamina: Lamina; n: number }
  | { tipo: "texto"; hoja: HojaTexto; n: number }
  | { tipo: "colofon" };

/**
 * El volumen de texto, tal como lo escribe `npm run wikipedia`. Se baja del
 * `public/` recién al abrir el tomo; ver el porqué en `tools/wikipedia.ts`.
 */
type VolumenTexto = {
  titulo: string;
  revision: number;
  consultado: string;
  url: string;
  credito: string;
  licencia: { nombre: string; url: string };
  bloques: BloqueTexto[];
  capitulos: string[];
  palabras: number;
};

/** Las páginas de un volumen de láminas: portadilla y una lámina por hoja. */
function paginasDe(libro: Libro, porPliego: number): Pagina[] {
  const p: Pagina[] = [{ tipo: "portadilla" }];
  libro.laminas.forEach((lamina, i) => p.push({ tipo: "lamina", lamina, n: i + 1 }));
  while (p.length % porPliego) p.push({ tipo: "vacia" });
  return p;
}

/**
 * Lo mismo para el volumen de texto: portadilla, una hoja por rebanada, y el
 * colofón al final.
 *
 * EL COLOFON ES LA ULTIMA HOJA, y es exactamente donde va (D-157). Un colofón
 * es la nota del final de un libro que dice quién lo hizo y bajo qué términos
 * — existe desde los incunables y siempre estuvo al dar vuelta la última hoja.
 * La atribución CC BY-SA es literalmente eso, así que dejó de ser un cartel
 * pegado en algún lado y pasó a ser la parte del libro que le corresponde.
 */
function paginasDeTexto(hojas: HojaTexto[], porPliego: number): Pagina[] {
  const p: Pagina[] = [{ tipo: "portadilla" }];
  hojas.forEach((hoja, i) => p.push({ tipo: "texto", hoja, n: i + 1 }));
  if (hojas.length) p.push({ tipo: "colofon" });
  while (p.length % porPliego) p.push({ tipo: "vacia" });
  return p;
}

/**
 * EL AREA DE TEXTO DE UNA HOJA, Y EL CUERPO DE LETRA.
 *
 * Las dos cosas salen del alto de la hoja y de nada más, así que la caja de
 * texto es la misma proporción a cualquier tamaño de ventana: lo que cambia es
 * la escala, no cuántos renglones entran. Es lo que hace que agrandar la
 * ventana no repagine el tomo entero de otra manera.
 *
 * El cuerpo es `0.0295 × alto`: a la hoja de escritorio le da ~17 px de Source
 * Serif sobre una columna de ~360 px, que son unos 48 caracteres por renglón —
 * la medida de lectura de un libro, no la de una pantalla.
 */
const cajaTexto = (w: number, h: number) => ({
  padX: Math.round(w * 0.115),
  padY: Math.round(h * 0.095),
  ancho: w - Math.round(w * 0.115) * 2,
  alto: h - Math.round(h * 0.095) * 2,
  cuerpo: Math.max(11, Math.round(h * 0.0295)),
});

/**
 * EL RUIDO DEL CUERO: UNA TEXTURA FRACTAL, NO UNA REJILLA DE PUNTOS.
 *
 * LO QUE FALLABA. La primera versión sembraba el poro con dos
 * `radial-gradient` repetidas cada 5×7 y 7×5 px. La idea —dos períodos primos
 * entre sí no coinciden— es correcta y ES la que usa el fondo de papel de la
 * sección. Pero el papel se ve a través de un `multiply` al 18% y detrás de
 * todo, y la tapa de un tomo es una superficie grande, plana y bien iluminada
 * en primer plano. Ahí los puntos dejan de leerse como poro y se leen como lo
 * que son: puntos, en filas y columnas. El ojo encuentra la grilla enseguida.
 *
 * Y el problema no se arregla bajándoles la opacidad. Una rejilla tenue sigue
 * siendo una rejilla: lo que está mal no es cuánto se ven, es que estén
 * alineados. El cuero no tiene nada alineado.
 *
 * LO QUE HAY AHORA. `feTurbulence` de SVG, que es ruido de Perlin fractal
 * —justamente el modelo matemático de una superficie orgánica— embebido como
 * `data:` URI. Con `stitchTiles="stitch"` el mosaico cierra sin costura, así
 * que se puede repetir sobre cualquier tamaño de tapa sin que aparezca el
 * borde del azulejo. Tres octavas: la primera da las manchas grandes del
 * curtido, las otras dos el grano fino.
 *
 * ¿SIGUE SIENDO «CERO BYTES DE ARTE»? Sí. Son ~200 caracteres de marcado que
 * el navegador rasteriza solo — no hay archivo, no hay descarga, no hay nada
 * que versionar. Es la misma idea de §4.7 del doc 19 (lo procedural sembrado
 * gana a los assets), sólo que con el generador de ruido correcto en vez de
 * con el que había a mano.
 *
 * ES UNO SOLO PARA LOS CINCO TOMOS. El ruido va en blanco y negro y se tiñe
 * después con `background-blend-mode: overlay`, que es lo que hace que el
 * mismo grano funcione sobre el tafilete rojo, sobre la badana clara y sobre
 * la tela azul. Una textura por tomo serían cinco rasterizaciones distintas
 * para el mismo material.
 */
const RUIDO_CUERO =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E` +
  // `color-interpolation-filters='sRGB'` NO ES OPCIONAL, y es invisible hasta
  // que se mide. El default de SVG es linearRGB: el filtro trabaja en lineal y
  // el resultado se convierte a sRGB al pintarlo, así que el gris medio que
  // esta matriz produce (128) sale por pantalla como 187. En `overlay` el
  // neutro es 128, y 187 no modula: aclara. Los cinco cueros salían lavados y
  // ninguno de los dos valores es "un error" en ningún lado — se ve midiendo
  // el data URI en un canvas, no leyendo el código.
  `%3Cfilter id='n' color-interpolation-filters='sRGB'%3E` +
  `%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E` +
  // El ruido crudo va de negro a blanco y en `overlay` eso es un golpe. Esta
  // matriz lo aplasta a [0.435, 0.565] alrededor del gris medio —que en
  // `overlay` es el valor neutro—, así que lo que llega es una modulación
  // suave y no una capa de suciedad. Bajar el 0.13 lo hace más liso; subirlo,
  // más gastado. La última fila fija el alfa en 1: `feTurbulence` también
  // genera ruido en el canal alfa, y sin esto la textura queda agujereada.
  `%3CfeColorMatrix type='matrix' values='` +
  `0.13 0 0 0 0.435  0 0.13 0 0 0.435  0 0 0.13 0 0.435  0 0 0 0 1'/%3E` +
  `%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")`;

/**
 * LA MANCHA DEL CURTIDO. Debajo del grano, tres claros anchos y descentrados:
 * un cuero no se tiñe parejo, tiene zonas donde el tinte agarró más. Son
 * gradientes de radio grande —nada de bordes— y es lo que impide que la tapa
 * vuelva a leerse como un rectángulo de un solo color con textura encima.
 */
function cuero(l: Libro, claro = 0): string {
  const { hue, croma, luz } = l.tinte;
  const L = luz + claro;
  const sombra = (a: number) => `oklch(${Math.max(8, L - 15)}% ${croma} ${hue - 10} / ${a})`;
  const brillo = (a: number) =>
    `oklch(${Math.min(96, L + 24)}% ${(croma * 0.7).toFixed(3)} ${hue + 6} / ${a})`;
  return [
    `${RUIDO_CUERO} 0 0 / 140px 140px`,
    `radial-gradient(120% 80% at 18% 12%, ${brillo(0.15)}, transparent 60%)`,
    `radial-gradient(100% 70% at 82% 74%, ${sombra(0.22)}, transparent 62%)`,
    // La veta del prensado, muy suave: le da dirección al material sin
    // dibujar una sola línea nítida.
    `repeating-linear-gradient(81deg, ${sombra(0.07)} 0 2px, transparent 2px 9px)`,
    `linear-gradient(96deg, oklch(${(L + 6).toFixed(1)}% ${croma} ${hue}) 0%, ` +
      `oklch(${L.toFixed(1)}% ${croma} ${hue - 4}) 52%, ` +
      `oklch(${Math.max(6, L - 7).toFixed(1)}% ${(croma * 0.82).toFixed(3)} ${hue - 8}) 100%)`,
  ].join(", ");
}

/**
 * COMO SE MEZCLA CADA CAPA DEL CUERO. El ruido en `overlay` —que es lo que lo
 * tiñe con el color de abajo en vez de pintar gris encima—, y todo lo demás
 * normal. El orden es el mismo de `cuero()`; si se agrega una capa allá hay
 * que agregar su modo acá.
 */
const MEZCLA_CUERO = "overlay, normal, normal, normal, normal";

/**
 * LA TINTA DEL LOMO SIGUE AL CUERO, NO AL REVES.
 *
 * Sobre un cuero oscuro se estampa en dorado o en blanco; sobre uno claro, en
 * marrón oscuro, porque el dorado sobre badana clara no se lee. El umbral está
 * en 44% de luz, que es donde el contraste con una tinta de 93% cae por debajo
 * de lo legible. Hoy lo cruza un solo tomo —Obras— y por eso es el único con
 * el título en oscuro; es la misma razón por la que un encuadernador le pega
 * un tejuelo de otro color.
 */
const tintaSobreCuero = (l: Libro) =>
  l.tinte.luz > 44
    ? `oklch(24% 0.03 ${l.tinte.hue - 6} / .92)`
    : `oklch(93% 0.03 ${l.tinte.hue + 4} / .9)`;

/**
 * LOS NERVIOS DEL LOMO: cuatro, y a estas alturas.
 *
 * Es lo que faltaba para que un rectángulo de color se leyera como un libro.
 * Un lomo de la época no es liso: los cordeles de la costura pasan por debajo
 * del cuero y lo levantan en bandas que cruzan de lado a lado, y cada banda
 * agarra la luz arriba y deja sombra abajo. Sin eso, el mejor cuero del mundo
 * sigue siendo una tira de color.
 *
 * Van en porcentaje y no en píxeles porque los lomos no miden lo mismo: el
 * grosor sale de cuántas hojas tiene el tomo. Los dos de adentro dejan el
 * entrepaño largo del medio libre, que es donde va el título — es el reparto
 * de un lomo de verdad, y es también lo que hizo falta para que los títulos
 * fueran de una palabra.
 */
const NERVIOS = [14, 26, 74, 86];

/**
 * CUANTAS HOJAS TIENE EL TOMO, A LOS EFECTOS DE SU GROSOR.
 *
 * En los tomos de láminas es literal: una lámina, una hoja. El de texto no
 * tiene láminas y sus hojas no se saben hasta paginarlo contra la ventana, así
 * que lleva un número fijo — y ese número no es una afirmación sobre el
 * contenido (para eso está `capitulos`, que el pipeline verifica), es una
 * medida de layout. Está en 13 porque el artículo entero pagina en unas 45
 * hojas y es el tomo más gordo de la fila; 45 daría un lomo de 326 px que se
 * come el estante.
 */
const GROSOR_TEXTO = 13;
const hojasDe = (l: Libro) => (l.texto ? GROSOR_TEXTO : l.laminas.length);

/**
 * El ancho del lomo sale de cuántas hojas tiene adentro — la estantería
 * informa antes de que la toques. En teléfono la base es más angosta: ahí el
 * lomo sólo sostiene un título vertical, y con la medida de escritorio la fila
 * se comía el ancho que necesita la tapa para salir.
 */
const anchoLomo = (l: Libro, angosto: boolean) =>
  (angosto ? 40 : 56) + hojasDe(l) * (angosto ? 4 : 6);
/** La tapa, en proporción de folio sobre el alto del tomo. */
const anchoTapa = (l: Libro, angosto: boolean) =>
  Math.round(altoLomo(l) * (angosto ? 0.62 : 0.68));
const altoLomo = (l: Libro) => 384 + hojasDe(l) * 6;

/** Lo que cuenta el pie del lomo y la tapa: láminas, o capítulos. */
const cuenta = (l: Libro, lang: Idioma) =>
  l.texto
    ? { n: l.texto.capitulos[lang], que: COPY.capitulos[lang] }
    : { n: l.laminas.length, que: COPY.laminas[lang] };
/** Lo que se aparta la tapa del mueble. En teléfono, lo mínimo que se lee. */
const separacionTapa = (angosto: boolean) => (angosto ? 24 : SEPARACION_TAPA);
/** Aire a los costados de la escena. */
const margenEscena = (angosto: boolean) => (angosto ? 14 : MARGEN_ESCENA);

export function Biblioteca({ lang }: { lang: Idioma }) {
  const angosto = useAngosto();
  const [vista, setVista] = useState<Vista>("estanteria");
  const [libroIdx, setLibroIdx] = useState(0);
  const [pliego, setPliego] = useState(0);
  /**
   * Mientras gira una hoja. `mano` distingue las dos formas de girar: por
   * flecha —tiempo fijo— o arrastrando, donde el dedo manda el progreso y al
   * soltar decide un resorte.
   */
  const [vuelo, setVuelo] = useState<{ dir: 1 | -1; mano: boolean } | null>(null);
  const arrastreRef = useRef<
    { dir: 1 | -1; x0: number; w: number; movido: number; vel: number; tPrev: number; t: number } | null
  >(null);
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
  // Abierta de entrada: es la herramienta de la sección, no un extra.
  const [lupaOn, setLupaOn] = useState(true);
  const [videoEn, setVideoEn] = useState<number | null>(null);
  /**
   * El volumen de texto, una vez bajado. `null` mientras viaja, `"falla"` si
   * no llegó — y esa distinción importa: la hoja no puede mostrar el mismo
   * cartel para «esperá» que para «no vino».
   */
  const [texto, setTexto] = useState<VolumenTexto | "falla" | null>(null);
  const [indiceAbierto, setIndiceAbierto] = useState(false);

  // En un teléfono la hoja se lee sola: un pliego de dos páginas a 375 px deja
  // cada lámina en 170 px, que no es ver un dibujo, es adivinarlo.
  const porPliego = angosto ? 1 : 2;

  const libro = BIBLIOTECA[libroIdx]!;

  /* ---- El volumen de texto ------------------------------------------------
     Se baja recién al abrirlo, como las láminas (D-154 §6): la estantería no
     pide un byte. `abortado` corta la carrera si el lector cierra el tomo
     antes de que llegue. */
  useEffect(() => {
    const fuente = libro.texto;
    if (vista !== "lectura" || !fuente) return;
    let vivo = true;
    setTexto(null);
    fetch(`/biblioteca/${fuente.archivo}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Record<string, VolumenTexto>) => {
        if (vivo) setTexto(j[lang] ?? j.es ?? "falla");
      })
      .catch(() => {
        if (vivo) setTexto("falla");
      });
    return () => {
      vivo = false;
    };
  }, [vista, libro, lang]);

  /*
   * LA PAGINACION, MEDIDA CONTRA LA HOJA DE VERDAD.
   *
   * Depende del tamaño de la hoja, así que se rehace al cambiar de ventana —y
   * eso es correcto: en una ventana más chica el artículo ocupa más hojas—.
   * Rehacerla cuesta ~400 lecturas de `scrollHeight` sobre un molde fuera de
   * pantalla; el `useMemo` es lo que impide que eso pase en cada render.
   */
  const hojasTexto = useMemo(() => {
    if (!libro.texto || typeof texto !== "object" || !texto || !medida) return [];
    const caja = cajaTexto(medida.w, medida.h);
    return paginarTexto({
      bloques: texto.bloques,
      ancho: caja.ancho,
      alto: caja.alto,
      cuerpo: caja.cuerpo,
    });
  }, [libro, texto, medida]);

  const paginas = useMemo(
    () => (libro.texto ? paginasDeTexto(hojasTexto, porPliego) : paginasDe(libro, porPliego)),
    [libro, porPliego, hojasTexto],
  );
  const pliegos = Math.ceil(paginas.length / porPliego);
  const base = pliego * porPliego;

  /** El índice del tomo de texto: sale de la paginación, no del artículo. */
  const indice = useMemo(() => indiceDe(hojasTexto), [hojasTexto]);

  /**
   * Qué título se está leyendo, para marcarlo en el índice. Es el último que
   * quedó ATRAS de la hoja visible, no el que está en ella: un índice que
   * sólo se ilumina en la hoja donde arranca el capítulo se apaga en cuanto
   * pasás una página, que es justo cuando hace falta saber dónde estás.
   */
  const tituloALaVista = useMemo(() => {
    const hojaVisible = (() => {
      for (let i = base + porPliego - 1; i >= base; i--) {
        const p = paginas[i];
        if (p?.tipo === "texto") return p.n - 1;
      }
      return -1;
    })();
    if (hojaVisible < 0) return -1;
    let cual = -1;
    indice.forEach((e, i) => {
      if (e.hoja <= hojaVisible) cual = i;
    });
    return cual;
  }, [paginas, base, porPliego, indice]);

  const seccionRef = useRef<HTMLElement | null>(null);
  const escenarioRef = useRef<HTMLDivElement | null>(null);
  const escenaRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canteraRef = useRef<HTMLDivElement | null>(null);
  const copiaRef = useRef<HTMLDivElement | null>(null);
  const copiaInteriorRef = useRef<HTMLDivElement | null>(null);
  const lupaRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pliegueRef = useRef<Pliegue | null>(null);
  const lupaEstado = useRef<EstadoLupa>({ x: 0, y: 0, r: 90, destino: null, agarrada: false });
  /** Para soltar los listeners del arrastre si el componente se va con la
   *  lupa todavía agarrada. */
  const soltarLupaRef = useRef<(() => void) | null>(null);
  useEffect(() => () => soltarLupaRef.current?.(), []);

  useEffect(() => {
    if (vista !== "lectura") return;
    seccionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [vista]);

  // El pliego vuelve a 0 al cambiar de volumen o de formato de página.
  useEffect(() => setPliego(0), [libroIdx, porPliego]);
  useEffect(() => setVideoEn(null), [pliego, libroIdx]);
  useEffect(() => setIndiceAbierto(false), [libroIdx, vista]);

  /* ---- La medida del libro ------------------------------------------------
     Se recalcula en cada `resize` y no una sola vez al montar: agrandar la
     ventana desde un tamaño de teléfono tiene que devolver el pliego, no
     dejar una hoja sola estirada. */
  useEffect(() => {
    if (vista !== "lectura") return;
    const medir = () => {
      const caja = escenarioRef.current;
      if (!caja) return;
      const dispoW = caja.clientWidth - (angosto ? 24 : 220);
      // 104 de encabezado + 58 de miniaturas + aire: si se reserva de menos,
      // la tira de láminas se le monta al pie de la hoja.
      const dispoH = caja.clientHeight - (angosto ? 168 : 214);
      // Se prueba por alto y se recorta por ancho: la hoja manda su proporción.
      const ratio = angosto ? RATIO_HOJA_MOVIL : RATIO_HOJA;
      let h = dispoH;
      let w = h * ratio;
      if (w * porPliego > dispoW) {
        w = dispoW / porPliego;
        h = w / ratio;
      }
      setMedida({ w: Math.floor(w), h: Math.floor(h) });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [vista, angosto, porPliego]);

  /* ---- La copia magnificada ----------------------------------------------
     Se rehace cuando cambia lo que hay abajo. No hay segunda descarga: el
     navegador reusa las mismas imágenes que ya pintó. */
  const sincronizarCopia = useCallback(() => {
    const escena = escenaRef.current;
    const interior = copiaInteriorRef.current;
    if (!escena || !interior) return;
    interior.textContent = "";
    interior.appendChild(escena.cloneNode(true));
  }, []);

  useLayoutEffect(() => {
    if (vista !== "lectura" || !medida || vuelo) return;
    sincronizarCopia();
  }, [vista, medida, pliego, libroIdx, lang, vuelo, sincronizarCopia]);

  /* ---- El giro ------------------------------------------------------------
     Dos maneras de pasar una hoja: la flecha, que corre un tiempo fijo, y el
     arrastre, donde el dedo escribe el progreso y al soltar decide un resorte.
     Las dos arman el mismo pliegue; lo único que cambia es quién mueve la `t`. */
  const puedeGirar = useCallback(
    (dir: 1 | -1) => {
      const destino = pliego + dir;
      return !vuelo && destino >= 0 && destino < pliegos;
    },
    [vuelo, pliego, pliegos],
  );

  const girar = useCallback(
    (dir: 1 | -1) => {
      if (!puedeGirar(dir)) return;
      // La hoja aparta la lupa antes de barrerla — salvo que la tengan agarrada.
      if (medida) apartarLupa(lupaEstado.current, cajaLibro(medida, porPliego), dir);
      setVideoEn(null);
      setVuelo({ dir, mano: false });
    },
    [puedeGirar, medida, porPliego],
  );

  /** Cierra el giro: o avanza el pliego, o lo deja donde estaba. */
  const cerrarGiro = useCallback((dir: 1 | -1, comprometido: boolean) => {
    if (comprometido) setPliego((v) => v + dir);
    setVuelo(null);
  }, []);

  /*
   * El pliegue se arma en `useLayoutEffect`, ANTES del pintado. React ya
   * renderizó el pliego con la página de abajo adelantada; si el armado
   * esperara al efecto normal, se vería un cuadro con esa página descubierta
   * antes de que la hoja la tape.
   */
  useLayoutEffect(() => {
    if (!vuelo || !medida) return;
    const host = hostRef.current;
    const cantera = canteraRef.current;
    if (!host || !cantera) return;

    const buscar = (i: number) =>
      cantera.querySelector<HTMLElement>(`[data-pag="${i}"] > *`) ?? null;

    // Yendo adelante gira el recto; yendo atrás, el verso.
    const iFrente = vuelo.dir > 0 ? base + porPliego - 1 : base;
    const iDorso = vuelo.dir > 0 ? iFrente + 1 : iFrente - 1;

    host.style.display = "";
    host.style.left = `${vuelo.dir > 0 ? medida.w * (porPliego - 1) : 0}px`;

    const p = construirPliegue({
      host,
      frente: buscar(iFrente),
      dorso: buscar(iDorso),
      ancho: medida.w,
      alto: medida.h,
      dir: vuelo.dir,
      tiras: TIRAS,
    });
    pliegueRef.current = p;
    aplicarGiro(p, 0, COMBADO);

    // Arrastrando, el progreso lo escribe la mano: acá no corre nada.
    if (vuelo.mano) {
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        host.style.display = "none";
        host.textContent = "";
        pliegueRef.current = null;
      };
    }

    const t0 = performance.now();
    const paso = (ahora: number) => {
      const bruto = Math.min(1, (ahora - t0) / DURACION);
      aplicarGiro(p, suavizar(bruto), COMBADO);
      if (bruto < 1) rafRef.current = requestAnimationFrame(paso);
      else cerrarGiro(vuelo.dir, true);
    };
    rafRef.current = requestAnimationFrame(paso);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      host.style.display = "none";
      host.textContent = "";
      pliegueRef.current = null;
    };
  }, [vuelo, medida, base, porPliego, cerrarGiro]);

  /* ---- El arrastre ---------------------------------------------------------
     Los umbrales son los que enseña Sketchbook (§2.4): menos de 6 px es un
     toque y no un arrastre; pasado el 42% del giro, o tirada con velocidad, la
     hoja se compromete sola. El recorrido de un giro entero es el 62% del
     ancho de la hoja, que es lo que hace que se sienta física y no un slider. */
  const soltarArrastre = useCallback(() => {
    const d = arrastreRef.current;
    arrastreRef.current = null;
    const p = pliegueRef.current;
    if (!d) return;
    if (!p) {
      setVuelo(null);
      return;
    }
    const comprometer =
      d.movido < ARRASTRE.minimoPx || d.t > ARRASTRE.compromiso || d.vel > ARRASTRE.velocidad;
    const resorte: Resorte = {
      t: d.t,
      v: d.vel,
      destino: comprometer ? 1 : 0,
      ...(comprometer ? RESORTE_COMPROMISO : RESORTE_CANCELA),
    };
    let previo = performance.now();
    const paso = (ahora: number) => {
      const dt = (ahora - previo) / 1000;
      previo = ahora;
      const sigue = pasoResorte(resorte, dt);
      aplicarGiro(p, Math.max(0, Math.min(1, resorte.t)), COMBADO);
      if (sigue) rafRef.current = requestAnimationFrame(paso);
      else cerrarGiro(d.dir, comprometer);
    };
    rafRef.current = requestAnimationFrame(paso);
  }, [cerrarGiro]);

  const bajarEnLibro = useCallback(
    (ev: React.PointerEvent) => {
      // Los controles de la hoja mandan sobre el arrastre.
      if ((ev.target as HTMLElement).closest("button, a, iframe")) return;
      if (ev.button !== 0 || !medida || vuelo) return;
      const caja = escenaRef.current?.getBoundingClientRect();
      if (!caja) return;
      const dir: 1 | -1 = (ev.clientX - caja.left) / caja.width > 0.5 ? 1 : -1;
      if (!puedeGirar(dir)) return;
      // Mata la selección de texto y el arrastre nativo de imágenes.
      ev.preventDefault();
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
      if (medida) apartarLupa(lupaEstado.current, cajaLibro(medida, porPliego), dir);
      setVideoEn(null);
      arrastreRef.current = {
        dir,
        x0: ev.clientX,
        w: medida.w * porPliego,
        movido: 0,
        vel: 0,
        tPrev: performance.now(),
        t: 0,
      };
      setVuelo({ dir, mano: true });
    },
    [medida, vuelo, puedeGirar, porPliego],
  );

  const moverEnLibro = useCallback((ev: React.PointerEvent) => {
    const d = arrastreRef.current;
    const p = pliegueRef.current;
    if (!d || !p) return;
    const dx = ev.clientX - d.x0;
    d.movido = Math.max(d.movido, Math.abs(dx));
    const crudo = (d.dir > 0 ? -dx : dx) / (d.w * ARRASTRE.recorrido);
    const t = Math.max(0, Math.min(1, crudo));
    const ahora = performance.now();
    d.vel = (t - d.t) / Math.max(0.001, (ahora - d.tPrev) / 1000);
    d.tPrev = ahora;
    d.t = t;
    aplicarGiro(p, t, COMBADO);
  }, []);

  /* ---- La lupa ------------------------------------------------------------
     Sin cursor no hay lupa que arrastrar: en pantalla táctil directamente no
     existe (`19-bocetos-biblioteca.md` §5.7). */
  const hayLupa = !angosto && vista === "lectura" && !!medida;

  useLayoutEffect(() => {
    if (!hayLupa || !medida) return;
    const e = lupaEstado.current;
    e.r = medida.h * RADIO_LUPA;
    /*
     * Arranca APOYADA SOBRE la esquina de abajo a la derecha, no al costado.
     * Como viene abierta, si empezara fuera del papel se vería un anillo vacío
     * y nadie sabría para qué está: pisando la hoja, muestra de entrada qué
     * hace. Y el usuario la corre desde ahí.
     */
    if (e.x === 0 && e.y === 0) {
      e.x = medida.w * porPliego - e.r * 0.62;
      e.y = medida.h - e.r * 0.42;
    }
    pintarLupa();
  }, [hayLupa, medida, porPliego]);

  const pintarLupa = useCallback(() => {
    const lupa = lupaRef.current;
    const copia = copiaRef.current;
    const interior = copiaInteriorRef.current;
    if (!lupa || !copia || !interior || !medida) return;
    colocarLupa(lupa, copia, interior, lupaEstado.current, cajaLibro(medida, porPliego));
  }, [medida, porPliego]);

  // El easing de la lupa cuando la hoja la apartó.
  useEffect(() => {
    if (!hayLupa) return;
    let vivo = true;
    let id = 0;
    const tick = () => {
      if (!vivo) return;
      if (acercarLupa(lupaEstado.current)) {
        pintarLupa();
        id = requestAnimationFrame(tick);
      }
    };
    id = requestAnimationFrame(tick);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [hayLupa, vuelo, pintarLupa]);

  const tomarLupa = useCallback(
    (ev: React.PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const e = lupaEstado.current;
      const caja = escenarioRef.current?.getBoundingClientRect();
      const escena = escenaRef.current?.getBoundingClientRect();
      if (!caja || !escena) return;
      const offX = ev.clientX - (escena.left - caja.left) - e.x - caja.left;
      const offY = ev.clientY - (escena.top - caja.top) - e.y - caja.top;
      e.agarrada = true;
      e.destino = null;
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);

      const mover = (m: PointerEvent) => {
        e.x = m.clientX - caja.left - (escena.left - caja.left) - offX;
        e.y = m.clientY - caja.top - (escena.top - caja.top) - offY;
        pintarLupa();
      };
      const soltar = () => {
        e.agarrada = false;
        soltarLupaRef.current = null;
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("pointerup", soltar);
      };
      soltarLupaRef.current = soltar;
      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", soltar);
    },
    [pintarLupa],
  );

  /* ---- Teclado ------------------------------------------------------------ */
  useEffect(() => {
    const alTeclado = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // Sólo mientras la sección está a la vista: si el visitante está en el
      // hero, las flechas no tienen por qué estar moviendo libros.
      const caja = seccionRef.current?.getBoundingClientRect();
      if (!caja || caja.bottom < window.innerHeight * 0.5 || caja.top > window.innerHeight * 0.5) return;
      /*
       * ESCAPE CIERRA UNA CAPA POR VEZ, Y ESA ES LA UNICA REGLA.
       *
       * Con el índice abierto, un Escape cerraba las dos cosas a la vez —el
       * panel y el volumen— porque los dos escuchan en `document` y ahí la
       * propagación no separa a nadie. El panel es la capa de arriba: mientras
       * esté abierto, Escape es suyo. Lo mismo con las flechas, que si no
       * pasarían hojas por debajo de un panel abierto.
       */
      if (indiceAbierto) return;
      // Escape vuelve al estante. Ya no cierra nada: la biblioteca es una
      // sección de la página, no una ventana encima.
      if (ev.key === "Escape" && vista === "lectura") {
        setVista("estanteria");
        return;
      }
      if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        if (vista === "lectura") girar(-1);
        else setLibroIdx((v) => Math.max(0, v - 1));
      }
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        if (vista === "lectura") girar(1);
        else setLibroIdx((v) => Math.min(BIBLIOTECA.length - 1, v + 1));
      }
    };
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [vista, girar, indiceAbierto]);

  /* ---- Lo que se ve en cada lado mientras gira ----------------------------
     En un libro de verdad, cuando el recto se levanta, abajo ya está el recto
     siguiente. Si no se adelanta, la hoja se despega y deja ver una copia de
     sí misma, y el giro se lee como un truco. */
  const visibles: number[] = [];
  for (let k = 0; k < porPliego; k++) {
    let i = base + k;
    if (vuelo && porPliego === 2) {
      if (vuelo.dir > 0 && k === 1) i = base + 3;
      if (vuelo.dir < 0 && k === 0) i = base - 2;
    } else if (vuelo && porPliego === 1) {
      i = base + vuelo.dir;
    }
    visibles.push(i);
  }

  // La cantera: las páginas vecinas, montadas y ocultas, listas para clonar.
  const enCantera = useMemo(() => {
    const s = new Set<number>();
    for (let d = -2; d <= 3; d++) s.add(base + d);
    return [...s].filter((i) => i >= 0 && i < paginas.length);
  }, [base, paginas.length]);

  const T = paleta;

  return (
    <section
      id="biblioteca"
      aria-label={COPY.firma[lang]}
      ref={seccionRef}
      className="alv-bib"
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        background: `radial-gradient(circle at 50% 40%, oklch(100% 0 0 / .3), transparent 47%), ${T.papel}`,
        color: T.tinta,
        fontFamily: FUENTE.lectura,
      }}
    >
      {/* ---- Cabecera ---- */}
      <div
        style={{
          position: "absolute",
          zIndex: 20,
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: vista === "lectura" ? "center" : "flex-start",
          justifyContent: "space-between",
          gap: 16,
          padding: angosto ? "18px 18px" : "26px 46px",
          paddingTop: `calc(${angosto ? 18 : 26}px + env(safe-area-inset-top))`,
          pointerEvents: "none",
        }}
      >
        {vista === "lectura" ? (
          <button
            type="button"
            className="alv-bib-linea"
            onClick={() => setVista("estanteria")}
            style={{ ...estiloLinea, pointerEvents: "auto" }}
          >
            <span style={{ fontSize: 14, fontWeight: 400 }} aria-hidden="true">
              ←
            </span>
            {COPY.volver[lang]}
          </button>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 13,
              alignItems: "center",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".185em",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            {/*
              SIN BAJADA (D-156). Decía «Los cuadernos y la obra», y los
              cuadernos no están acá: están del otro lado, en el chat, que es
              todo el punto del proyecto. Se probaron reemplazos —«Lo que
              dibujó y lo que pintó», «Veintisiete láminas y un compendio»— y
              todos explicaban algo que cinco lomos con su título ya dicen
              mejor. Una línea que explica lo evidente es una línea de más.
            */}
            <span>{COPY.firma[lang]}</span>
          </div>
        )}

        {vista === "lectura" && angosto && (
          <div style={{ textAlign: "right", pointerEvents: "none" }}>
            <div
              style={{
                fontFamily: FUENTE.titulo,
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: "-.01em",
                lineHeight: 1.1,
              }}
            >
              {libro.titulo[lang]}
            </div>
            <div
              style={{
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: ".18em",
                marginTop: 3,
                textTransform: "uppercase",
                color: T.tintaSuave,
              }}
            >
              {pliego + 1} / {pliegos}
            </div>
          </div>
        )}

        {vista === "lectura" && !angosto && (
          <div style={{ textAlign: "center", pointerEvents: "none" }}>
            <div
              style={{
                fontFamily: FUENTE.titulo,
                fontSize: 25,
                fontWeight: 500,
                letterSpacing: "-.015em",
              }}
            >
              {libro.titulo[lang]}
            </div>
            <div
              style={{
                fontSize: 8.5,
                fontWeight: 600,
                letterSpacing: ".2em",
                marginTop: 5,
                textTransform: "uppercase",
                color: T.tintaSuave,
              }}
            >
              {(porPliego === 2 ? COPY.pliego[lang] : COPY.hoja[lang])} {pliego + 1}{" "}
              {COPY.de[lang]} {pliegos}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", pointerEvents: "auto" }}>
          {/*
            LA LUPA SE PRENDE CON UN INTERRUPTOR, NO CON UNA PASTILLA (D-156).
            Una pastilla que se rellena es un botón que quedó apretado: hay que
            acordarse de qué significaba el relleno. Un interruptor no se
            recuerda, se ve — la perilla está de un lado o del otro, y eso ya
            es el estado. Se usa `role="switch"`, que es lo que un lector de
            pantalla anuncia como «activado / desactivado» en vez de «botón».
          */}
          {hayLupa && (
            <button
              type="button"
              role="switch"
              className="alv-bib-switch"
              aria-checked={lupaOn}
              aria-label={COPY.lupa[lang]}
              onClick={() => setLupaOn((v) => !v)}
            >
              <span className="alv-bib-switch-nombre">{COPY.lupa[lang]}</span>
              <span className="alv-bib-switch-riel" aria-hidden="true">
                <span className="alv-bib-switch-perilla" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/*
        LA ESTANTERÍA NO SE DESMONTA AL LEER.
        Leer no es irse a otra pantalla: es abrir el volumen ahí mismo. El
        mueble se va hacia atrás —se achica, se desenfoca y baja de opacidad—
        y el libro se abre delante. El modo lo dice React una sola vez y el
        CSS hace todo el movimiento, que es el reparto de §4.10 del doc 19.
      */}
      <div className="alv-bib-escena-estante" data-modo={vista}>
        <Estanteria
          lang={lang}
          angosto={angosto}
          idx={libroIdx}
          onElegir={setLibroIdx}
          onAbrir={() => setVista("lectura")}
        />
      </div>

      {/* ---- LECTURA ---- */}
      {vista === "lectura" && (
        <div
          ref={escenarioRef}
          className="alv-bib-escena-libro"
          style={{
            position: "absolute",
            inset: 0,
            paddingTop: angosto ? 72 : 104,
            paddingBottom: angosto ? 92 : 112,
          }}
        >
          {/*
            EL TOMO DE TEXTO MIENTRAS VIAJA, Y SI NO LLEGA.
            Son 120 KB: en una conexión decente esto no se ve. En una mala sí,
            y entonces un libro abierto en blanco no dice nada. Si además no
            llega, el cartel lleva al artículo — el texto es de Wikipedia y
            está allá, no hay razón para dejar al lector sin nada.
          */}
          {libro.texto && !paginas.some((p) => p.tipo === "texto") && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "0 32px",
                color: paleta.tintaSuave,
                fontSize: 13,
                letterSpacing: ".04em",
              }}
            >
              {texto === "falla" ? (
                <>
                  <span style={{ maxWidth: 380, lineHeight: 1.6 }}>{COPY.sinTexto[lang]}</span>
                  <a
                    className="alv-bib-linea"
                    href={`https://${lang}.wikipedia.org/wiki/Leonardo_da_Vinci`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...estiloLinea, pointerEvents: "auto", textDecoration: "none" }}
                  >
                    {COPY.irAlArticulo[lang]}
                    <span style={{ fontSize: 14, fontWeight: 400 }} aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </>
              ) : (
                <span>{COPY.cargando[lang]}</span>
              )}
            </div>
          )}

          {medida && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: medida.w * porPliego,
                height: medida.h,
              }}
            >
              {/* El canto del block: las hojas que quedan de cada lado. */}
              <div className="alv-bib-canto" style={{ left: -9 }} />
              <div className="alv-bib-canto" style={{ right: -9 }} />

              <div
                ref={escenaRef}
                onPointerDown={bajarEnLibro}
                onPointerMove={moverEnLibro}
                onPointerUp={soltarArrastre}
                onPointerCancel={soltarArrastre}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  position: "absolute",
                  inset: 0,
                  perspective: 1900,
                  transformStyle: "preserve-3d",
                  cursor: vuelo?.mano ? "grabbing" : "grab",
                  // El teléfono conserva su scroll vertical; lo horizontal es
                  // del libro.
                  touchAction: "pan-y",
                }}
              >
                {visibles.map((i, k) => (
                  <div
                    key={`${k}-${i}`}
                    style={{ position: "absolute", left: medida.w * k, top: 0 }}
                  >
                    <HojaPagina
                      pagina={paginas[i]}
                      libro={libro}
                      lang={lang}
                      lado={porPliego === 1 ? "der" : k === 0 ? "izq" : "der"}
                      w={medida.w}
                      h={medida.h}
                      videoActivo={videoEn === i}
                      onVideo={() => setVideoEn(i)}
                      volumen={texto}
                    />
                  </div>
                ))}
                {porPliego === 2 && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: medida.w,
                      top: 0,
                      width: 1,
                      height: medida.h,
                      boxShadow: "0 0 26px 9px oklch(45% .035 58 / .26)",
                    }}
                  />
                )}
                {/* La hoja que gira. La arma el motor; acá sólo vive su caja. */}
                <div ref={hostRef} className="alv-bib-pliegue" style={{ display: "none" }} />
              </div>

              {/* La copia magnificada, hermana del libro y no hija: por eso el
                  vidrio no hereda ninguna transformación de la página. */}
              {hayLupa && (
                <div
                  ref={copiaRef}
                  aria-hidden="true"
                  className="alv-bib-copia"
                  style={{ opacity: 0, display: lupaOn ? "block" : "none" }}
                >
                  <div ref={copiaInteriorRef} className="alv-bib-copia-interior" />
                </div>
              )}

              {hayLupa && (
                <div
                  ref={lupaRef}
                  className="alv-bib-lupa"
                  style={{
                    width: lupaEstado.current.r * 2,
                    height: lupaEstado.current.r * 2,
                    opacity: lupaOn ? 1 : 0,
                    pointerEvents: lupaOn ? "auto" : "none",
                  }}
                >
                  <div className="alv-bib-mango" onPointerDown={tomarLupa} />
                  <div className="alv-bib-aro" onPointerDown={tomarLupa}>
                    <div className="alv-bib-vidrio-lupa" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* La cantera: las vecinas montadas y ocultas, listas para clonar. */}
          <div
            ref={canteraRef}
            aria-hidden="true"
            style={{ position: "absolute", left: -99999, top: 0, opacity: 0 }}
          >
            {medida &&
              enCantera.map((i) => (
                <div key={i} data-pag={i}>
                  <HojaPagina
                    pagina={paginas[i]}
                    libro={libro}
                    lang={lang}
                    lado={porPliego === 1 ? "der" : i % 2 === 0 ? "izq" : "der"}
                    w={medida.w}
                    h={medida.h}
                    videoActivo={false}
                    onVideo={() => {}}
                    volumen={texto}
                  />
                </div>
              ))}
          </div>

          <button
            type="button"
            className="alv-bib-flecha"
            onClick={() => girar(-1)}
            disabled={pliego === 0 || !!vuelo}
            aria-label={COPY.anteriorHoja[lang]}
            style={{
              ...estiloFlecha,
              left: angosto ? 5 : 44,
              ...(angosto ? { width: 40, height: 40 } : null),
            }}
          >
            <Flecha hacia="izq" />
          </button>
          <button
            type="button"
            className="alv-bib-flecha"
            onClick={() => girar(1)}
            disabled={pliego >= pliegos - 1 || !!vuelo}
            aria-label={COPY.siguienteHoja[lang]}
            style={{
              ...estiloFlecha,
              right: angosto ? 5 : 44,
              ...(angosto ? { width: 40, height: 40 } : null),
            }}
          >
            <Flecha hacia="der" />
          </button>

          {/*
            EL INDICE. En un tomo de láminas es la lámina misma en miniatura:
            un dibujo se reconoce de un vistazo y no hay nada mejor que
            mostrarlo. En el tomo de texto no hay nada que mirar, así que el
            índice es lo que un libro de texto tiene: los capítulos. Cuarenta y
            pico de hojas sin un índice serían cuarenta y pico de flechazos.
          */}
          <div
            style={{
              position: "absolute",
              bottom: `calc(${angosto ? 20 : 32}px + env(safe-area-inset-bottom))`,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 9,
              flexWrap: "wrap",
              padding: "0 16px",
            }}
          >
            {libro.texto && !!indice.length && (
              <Indice
                entradas={indice}
                lang={lang}
                enLaVista={tituloALaVista}
                abierto={indiceAbierto}
                onAbrir={setIndiceAbierto}
                onIr={(hoja) => {
                  if (vuelo) return;
                  setPliego(Math.floor((hoja + 1) / porPliego));
                  setIndiceAbierto(false);
                }}
              />
            )}

            {libro.laminas.map((lamina, i) => {
              const destino = Math.floor((i + 1) / porPliego);
              const activa = destino === pliego;
              return (
                <button
                  key={lamina.slug}
                  type="button"
                  className="alv-bib-mini"
                  data-on={activa ? "si" : "no"}
                  onClick={() => !vuelo && setPliego(destino)}
                  aria-label={`${COPY.lamina[lang]} ${i + 1}`}
                  aria-current={activa ? "true" : undefined}
                >
                  <img src={rutaIndice(libro, lamina)} alt="" loading="lazy" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function Estanteria({
  lang, angosto, idx, onElegir, onAbrir,
}: {
  lang: Idioma;
  angosto: boolean;
  idx: number;
  onElegir: (i: number) => void;
  onAbrir: () => void;
}) {
  /*
   * LA ESTANTERÍA SE ESCALA AL ALTO QUE HAY.
   *
   * Los tomos miden lo que miden —el ancho del lomo sale de la cantidad de
   * láminas, y eso no puede ser relativo a la ventana sin perder la relación
   * entre los tres—. Así que las medidas quedan fijas y lo que se ajusta es la
   * escala del mueble entero.
   */
  const [escala, setEscala] = useState(1);
  /*
   * UN SEGUNDO CORTE, ADEMÁS DEL DE TELÉFONO.
   *
   * En una notebook —o en cualquier ventana baja— la ficha al costado del
   * estante no entra: el título se le mete debajo de la tapa del volumen.
   * Acá la ficha se va arriba a la izquierda y el estante se queda con la
   * banda de abajo, que es otra maqueta y no la misma apretada.
   */
  const [compacto, setCompacto] = useState(false);
  const [padDerecha, setPadDerecha] = useState(120);
  useEffect(() => {
    const medir = () => {
      const compactoAhora = window.innerWidth < 1180 || window.innerHeight < 620;
      setCompacto(compactoAhora);

      /*
       * LA ESCALA MIRA EL ALTO **Y** EL ANCHO.
       *
       * Mirando sólo el alto, en una ventana de 1100x700 los tomos salían a
       * escala 1 y la tapa presentada —que vuela a la izquierda del mueble— se
       * le montaba encima al título de la ficha. La escena necesita ancho para
       * tres cosas en fila: la tapa, su separación del mueble, y el mueble.
       * Se toma la más chica de las dos escalas, que es la que entra en las
       * dos direcciones.
       */
      const anchoFila =
        BIBLIOTECA.reduce((a, l) => a + anchoLomo(l, angosto), 0) + HUECO_FILA * (BIBLIOTECA.length - 1);
      const anchoEscena =
        anchoFila + separacionTapa(angosto) + Math.max(...BIBLIOTECA.map((l) => anchoTapa(l, angosto)));

      // Lo que la ficha se queda del ancho: al costado se lo saca a la escena;
      // arriba (compacto y teléfono) no le compite.
      const columnaFicha = compactoAhora || angosto ? 0 : ANCHO_FICHA + 92;
      const dispoW = window.innerWidth - columnaFicha - margenEscena(angosto) * 2;

      // Y lo que se queda del alto: la ficha arriba, o el encabezado.
      const lineaEstante = window.innerHeight * (angosto ? 0.82 : 0.74);
      const techo = compactoAhora || angosto ? ALTO_FICHA : 96;
      const dispoH = lineaEstante - techo;

      const e = Math.min(1, Math.max(0.3, Math.min(dispoH / ALTO_MUEBLE, dispoW / anchoEscena)));
      setEscala(e);

      /*
       * Y DÓNDE ARRANCA. Que la escena ENTRE no alcanza: la fila se alinea a la
       * derecha, así que con un margen fijo la tapa se corría hacia la
       * izquierda hasta meterse debajo del título. El margen derecho se calcula
       * para que el borde izquierdo de la escena caiga después de la ficha, y
       * si sobra lugar la escena se queda contra la derecha.
       */
      setPadDerecha(
        compactoAhora || angosto
          ? Math.max(16, Math.min(90, window.innerWidth * 0.07))
          : Math.max(
              margenEscena(angosto),
              window.innerWidth - (columnaFicha + margenEscena(angosto)) - anchoEscena * e,
            ),
      );
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [angosto]);

  /* ---- La coreografía ------------------------------------------------------
     El relevo de seis fases vive en el motor; acá sólo se lo hace correr y se
     escriben las transformaciones. React no se entera de ningún cuadro. */
  const tomosRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  /**
   * QUÉ ÍNDICE ESTÁ EFECTIVAMENTE PINTADO.
   *
   * Se actualiza cuando el relevo TERMINA, no cuando arranca. Antes se
   * asignaba al entrar al efecto, y como React corre los efectos dos veces en
   * desarrollo, la segunda pasada encontraba `previo === idx`, tomaba la rama
   * de «primera pintada» y saltaba directo a la pose final: la coreografía no
   * se veía nunca.
   */
  const pintadoRef = useRef(idx);
  /**
   * DE QUÉ RELEVO ES CADA CUADRO.
   *
   * Cancelar por `rafRef` no alcanza: esa variable guarda UN id, y cuando el
   * efecto se vuelve a correr —React lo hace dos veces en desarrollo— el id
   * del bucle anterior queda pisado antes de que la limpieza lo alcance. El
   * resultado era un bucle huérfano con su `t0` vencido escribiendo poses
   * viejas encima del nuevo: el primer cuadro del relevo entraba con el avance
   * ya en 0,65 y la coreografía se veía como un salto.
   *
   * Con un número de generación, cualquier bucle que no sea el último se apaga
   * solo en su próximo cuadro.
   */
  const generacionRef = useRef(0);
  const [asentado, setAsentado] = useState(true);

  const geometria = useCallback(
    (i: number): Geometria => {
      const l = BIBLIOTECA[i]!;
      // La bisagra de este tomo dentro de la fila.
      let bisagra = 0;
      for (let k = 0; k < i; k++) bisagra += anchoLomo(BIBLIOTECA[k]!, angosto) + HUECO_FILA;
      /*
       * DÓNDE SE PRESENTA EL TOMO: SIEMPRE FUERA DE LA FILA.
       *
       * Se probó dejarlo adentro en teléfono, por falta de ancho. El resultado
       * fue un bug feo: la tapa mide tres veces lo que un lomo, así que tapaba
       * por completo a sus dos vecinos — no quedaba UN SOLO PÍXEL clickeable de
       * ellos— y el visitante creía estar tocando un lomo cuando en realidad
       * tocaba la tapa. De ahí el «a veces abre otro libro».
       *
       * Y el ancho nunca fue el problema: la escala la manda el ALTO
       * disponible, así que a la escala que entra a lo alto, la tapa más la
       * fila entran a lo ancho de sobra.
       */
      const xPresentado = -(bisagra + separacionTapa(angosto) + anchoTapa(l, angosto));

      return {
        xPresentado,
        zCarril: 230,
        zPresentado: 110,
        escalaPresentada: 1.06,
      };
    },
    [angosto],
  );

  const pintarTomo = useCallback((i: number, pose: Pose) => {
    const el = tomosRef.current[i];
    if (el) el.style.transform = cssDePose(pose);
  }, []);

  // Estado inicial y cambios de volumen: el mismo camino.
  useLayoutEffect(() => {
    const de = pintadoRef.current;
    const a = idx;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Nada que relevar: el elegido ya está presentado.
    if (de === a) {
      BIBLIOTECA.forEach((_, i) =>
        pintarTomo(i, i === a ? posePresentada(geometria(i)) : POSE_GUARDADO),
      );
      setAsentado(true);
      return;
    }

    setAsentado(false);
    const generacion = ++generacionRef.current;
    const t0 = performance.now();
    const paso = (ahora: number) => {
      if (generacionRef.current !== generacion) return;
      const avance = Math.min(1, (ahora - t0) / DURACION_RELEVO);
      BIBLIOTECA.forEach((_, i) => {
        const rol = i === de ? "sale" : i === a ? "entra" : "quieto";
        pintarTomo(i, poseDelRelevo(rol, avance, geometria(i)));
      });
      if (avance < 1) {
        rafRef.current = requestAnimationFrame(paso);
      } else {
        rafRef.current = null;
        // Recién acá: el relevo llegó a destino.
        pintadoRef.current = a;
        setAsentado(true);
      }
    };
    rafRef.current = requestAnimationFrame(paso);

    // La limpieza NO toca `pintadoRef`: si el efecto se vuelve a correr, el
    // relevo se retoma desde donde estaba en vez de darse por hecho.
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [idx, geometria, pintarTomo]);

  // Al reescalar, el tomo presentado tiene que quedar donde corresponde.
  useLayoutEffect(() => {
    if (rafRef.current !== null) return;
    BIBLIOTECA.forEach((_, i) =>
      pintarTomo(i, i === idx ? posePresentada(geometria(i)) : POSE_GUARDADO),
    );
  }, [escala, idx, geometria, pintarTomo]);

  const activo = BIBLIOTECA[idx]!;

  return (
    <>
      {/*
        UNA TABLA LARGA, NO UN MUEBLE Y NO UNA LÍNEA.

        El mueble cerrado encajonaba los tres tomos y los volvía una vitrina; y
        un listón plano se lee como una raya de color, no como madera. Lo que
        hace que se entienda que hay una TABLA es la perspectiva: la cara de
        arriba se acuesta con `rotateX` y se va hacia el fondo, así que se ve la
        superficie sobre la que los libros se apoyan y no solamente su canto.

        Corre de borde a borde y se desvanece en las puntas — la estantería
        sigue más allá del cuadro aunque hoy tenga cuatro volúmenes.
      */}
      <div
        className="alv-bib-estante"
        style={{ top: angosto ? "82%" : "74%", perspective: 1500 }}
      >
        <div className="alv-bib-tabla-sup" />
        <div className="alv-bib-tabla-canto" />

        {/* La fila se apoya sobre la línea del estante. Cada ranura ocupa el
            grosor del tomo; la tapa, al girar, se sale de su ranura. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            paddingRight: padDerecha,
            pointerEvents: "none",
          }}
        >
          <div
            className="alv-bib-fila"
            style={{
              gap: HUECO_FILA,
              transform: `scale(${escala})`,
              transformOrigin: "right bottom",
              pointerEvents: "auto",
            }}
          >
            {BIBLIOTECA.map((l, i) => (
              <div
                key={l.id}
                className="alv-bib-ranura"
                data-on={i === idx ? "si" : "no"}
                style={{
                  width: anchoLomo(l, angosto),
                  height: altoLomo(l),
                }}
              >
                <div
                  ref={(el) => {
                    tomosRef.current[i] = el;
                  }}
                  className="alv-bib-tomo"
                  data-on={i === idx ? "si" : "no"}
                  data-asentado={i === idx && asentado ? "si" : "no"}
                  style={{ height: altoLomo(l) }}
                >
                  {/* EL LOMO. Con la bisagra en el borde izquierdo, a 90° es
                      esta cara la que mira al frente. */}
                  <button
                    type="button"
                    className="alv-bib-cara-lomo"
                    onClick={() => (i === idx ? onAbrir() : onElegir(i))}
                    aria-label={`${l.titulo[lang]} — ${cuenta(l, lang).n} ${cuenta(l, lang).que}`}
                    aria-current={i === idx ? "true" : undefined}
                    style={{
                      width: anchoLomo(l, angosto),
                      height: altoLomo(l),
                      background: cuero(l),
                      backgroundBlendMode: MEZCLA_CUERO,
                      color: tintaSobreCuero(l),
                    }}
                  >
                    {/* Los cordeles de la costura, levantando el cuero. */}
                    {NERVIOS.map((y) => (
                      <span key={y} className="alv-bib-nervio" style={{ top: `${y}%` }} />
                    ))}
                    {/* La cofia: el cuero doblado sobre la cabeza y el pie. */}
                    <span className="alv-bib-cofia" data-donde="alta" />
                    <span className="alv-bib-cofia" data-donde="baja" />
                    <span className="alv-bib-lomo-texto" style={{ fontFamily: FUENTE.titulo }}>
                      {(l.tituloLomo ?? l.titulo)[lang]}
                    </span>
                    <span className="alv-bib-lomo-pie">{cuenta(l, lang).n}</span>
                  </button>

                  {/* LA TAPA. A 0° es la que mira al frente. */}
                  <button
                    type="button"
                    className="alv-bib-cara-tapa"
                    onClick={() => (i === idx ? onAbrir() : onElegir(i))}
                    aria-label={COPY.abrir[lang]}
                    tabIndex={i === idx ? 0 : -1}
                    style={{
                      width: anchoTapa(l, angosto),
                      height: altoLomo(l),
                      background: cuero(l),
                      backgroundBlendMode: MEZCLA_CUERO,
                      color: tintaSobreCuero(l),
                    }}
                  >
                    <span className="alv-bib-tapa-marco" />
                    <span className="alv-bib-tapa-dentro">
                      {/*
                        ACA IBA «LA BIBLIOTECA» EN VERSALITAS. Se fue en D-156:
                        es el nombre de la sección donde el tomo ya está, y
                        repetirlo cinco veces —una por tapa— no le dice nada a
                        nadie. La tapa lleva el título y el recuento, que es lo
                        que distingue un tomo del de al lado.
                      */}
                      <span className="alv-bib-tapa-titulo" style={{ fontFamily: FUENTE.titulo }}>
                        {l.titulo[lang]}
                      </span>
                      <span className="alv-bib-tapa-motivo">
                        <Motivo id={l.id} />
                      </span>
                      <span className="alv-bib-tapa-pie">
                        {cuenta(l, lang).n} {cuenta(l, lang).que}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* La ficha editorial. */}
      <div
        className="alv-bib-ficha"
        style={{
          position: "absolute",
          zIndex: 16,
          left: angosto ? 20 : compacto ? 56 : 92,
          right: angosto ? 20 : undefined,
          top: angosto ? "clamp(88px, 13vh, 140px)" : compacto ? 78 : "50%",
          width: angosto ? undefined : compacto ? "min(360px, 34vw)" : ANCHO_FICHA,
          transform: angosto || compacto ? undefined : "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            margin: "0 0 17px",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: ".19em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          <span>{String(idx + 1).padStart(2, "0")}</span>
          <span style={{ width: 46, height: 1, background: "currentColor", opacity: 0.35 }} />
          <span>{String(BIBLIOTECA.length).padStart(2, "0")}</span>
        </div>
        <h2
          style={{
            margin: 0,
            maxWidth: "100%",
            fontFamily: FUENTE.titulo,
            fontSize: angosto
              ? "clamp(38px,11vw,52px)"
              : compacto
                ? "clamp(34px,6.4vh,48px)"
                : "clamp(38px,8.2vh,66px)",
            fontWeight: 500,
            letterSpacing: "-.035em",
            lineHeight: 0.94,
          }}
        >
          {activo.titulo[lang]}
        </h2>
        {/*
          ACA IBA UNA BAJADA POR TOMO («Los folios mecánicos, y el mismo
          mecanismo andando»). Se fue en D-156: con los títulos de una palabra
          de D-155, la frase explicaba lo que el título ya decía y lo que las
          láminas iban a mostrar en dos clicks. El campo `bajada` se sacó del
          catálogo entero, no se dejó sin usar — un dato que no pinta nada es
          un dato que alguien va a mantener para nada.
        */}

        {/*
          LA INVITACIÓN. Un volumen presentado no dice por sí solo que se
          abre; el llamado tiene que estar. Aparece recién cuando el tomo se
          asentó —antes competiría con el movimiento— y el punto que late es
          lo único que se mueve en toda la pantalla, así que el ojo va ahí.
        */}
        <button
          type="button"
          className="alv-bib-linea alv-bib-invita"
          data-on={asentado ? "si" : "no"}
          onClick={onAbrir}
          style={{ ...estiloLinea, marginTop: 26, pointerEvents: "auto" }}
        >
          <span className="alv-bib-punto" aria-hidden="true" />
          {COPY.abrir[lang]}
          <span style={{ fontSize: 14, fontWeight: 400 }} aria-hidden="true">
            ↗
          </span>
        </button>
      </div>

      <button
        type="button"
        className="alv-bib-flecha"
        onClick={() => onElegir(Math.max(0, idx - 1))}
        disabled={idx === 0}
        aria-label={COPY.anteriorVol[lang]}
        style={{
          ...estiloFlecha,
          left: angosto ? 12 : 44,
          ...(compacto ? { top: "auto", bottom: 26 } : null),
        }}
      >
        <Flecha hacia="izq" />
      </button>
      <button
        type="button"
        className="alv-bib-flecha"
        onClick={() => onElegir(Math.min(BIBLIOTECA.length - 1, idx + 1))}
        disabled={idx >= BIBLIOTECA.length - 1}
        aria-label={COPY.siguienteVol[lang]}
        style={{
          ...estiloFlecha,
          right: angosto ? 12 : 44,
          ...(compacto ? { top: "auto", bottom: 26 } : null),
        }}
      >
        <Flecha hacia="der" />
      </button>
    </>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * EL INDICE PLEGABLE DEL TOMO DE TEXTO.
 *
 * POR QUE NO SON PASTILLAS. La primera versión ponía los capítulos como una
 * fila de pastillas, ahí donde el resto de los tomos pone las miniaturas de
 * sus láminas. Funcionaba con cuatro; con los títulos de nivel 3 son
 * veintitantos, y veintitantas pastillas envueltas en tres renglones no son un
 * índice: son una pared. Un libro de texto no lista sus capítulos al pie de
 * cada página, los guarda en una hoja aparte a la que se va cuando hace falta.
 *
 * LO QUE HACE QUE SE SIENTA BIEN, y no es el redondeo de las esquinas:
 *
 *   · SE ABRE DESDE ABAJO Y HACIA ARRIBA, anclado al botón que lo abrió, así
 *     que el panel sale del lugar que tocaste en vez de aparecer en el medio.
 *   · LA CURVA ES `cubic-bezier(.32,.72,0,1)`: arranca rápido y frena largo.
 *     Es la diferencia entre un panel que aparece y uno que se despliega.
 *   · EL VIDRIO ES REAL: `backdrop-filter` con saturación, no un gris opaco.
 *     Debajo hay una lámina o una hoja de texto, y que se adivine es lo que
 *     dice que el panel está ENCIMA del libro y no en otra pantalla.
 *   · LA JERARQUIA SE LEE SIN LEER: los capítulos en versalitas, las
 *     subsecciones sangradas y más claras. Se distingue de un vistazo.
 *   · CIERRA CON `Escape` Y TOCANDO AFUERA, porque un panel que se abre
 *     tocando tiene que cerrarse igual de barato.
 *
 * El foco vuelve al botón al cerrar: quien navega con teclado no se queda
 * parado en un elemento que ya no existe.
 */
function Indice({
  entradas, lang, enLaVista, abierto, onAbrir, onIr,
}: {
  entradas: EntradaIndice[];
  lang: Idioma;
  /** Cuál de las entradas corresponde a lo que se está leyendo. */
  enLaVista: number;
  abierto: boolean;
  onAbrir: (v: boolean) => void;
  onIr: (hoja: number) => void;
}) {
  const botonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const activoRef = useRef<HTMLButtonElement | null>(null);

  // Escape cierra, y el click de afuera también. Los dos devuelven el foco.
  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => {
      onAbrir(false);
      botonRef.current?.focus();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    const afuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !botonRef.current?.contains(t)) cerrar();
    };
    document.addEventListener("keydown", tecla);
    // En `capture`: si no, un click sobre la hoja lo atrapa el arrastre antes.
    document.addEventListener("pointerdown", afuera, true);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", afuera, true);
    };
  }, [abierto, onAbrir]);

  /*
   * Al abrir, la entrada de donde estás leyendo tiene que estar A LA VISTA. Con
   * veintitantos títulos y el panel scrolleado arriba, abrir el índice en el
   * capítulo 7 mostraba el capítulo 1. `block: "center"` y sin animación: el
   * panel todavía se está desplegando y dos movimientos a la vez se pelean.
   */
  useLayoutEffect(() => {
    if (!abierto) return;
    activoRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [abierto]);

  return (
    <div style={{ position: "relative", pointerEvents: "auto" }}>
      <button
        ref={botonRef}
        type="button"
        className="alv-bib-indice-boton"
        data-on={abierto ? "si" : "no"}
        aria-expanded={abierto}
        aria-haspopup="true"
        onClick={() => onAbrir(!abierto)}
      >
        <svg width="13" height="11" viewBox="0 0 13 11" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx="1.2" cy={1.4 + i * 4.1} r="1.2" fill="currentColor" />
              <path
                d={`M4.6 ${1.4 + i * 4.1} H${i === 2 ? 9 : 12.4}`}
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>
        {COPY.indice[lang]}
        <span className="alv-bib-indice-chevron" aria-hidden="true">
          <svg width="9" height="6" viewBox="0 0 9 6">
            <path
              d="M1 4.6 L4.5 1.2 L8 4.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <div
        ref={panelRef}
        className="alv-bib-indice-panel"
        data-on={abierto ? "si" : "no"}
        role="menu"
        aria-label={COPY.indice[lang]}
        aria-hidden={!abierto}
      >
        <div className="alv-bib-indice-lista">
          {entradas.map((e, i) => (
            <button
              key={`${e.hoja}-${e.x}`}
              ref={i === enLaVista ? activoRef : undefined}
              type="button"
              role="menuitem"
              className="alv-bib-indice-fila"
              data-nivel={e.t}
              data-on={i === enLaVista ? "si" : "no"}
              tabIndex={abierto ? 0 : -1}
              onClick={() => onIr(e.hoja)}
            >
              <span className="alv-bib-indice-texto">{e.x}</span>
              <span className="alv-bib-indice-folio">{e.hoja + 1}</span>
            </button>
          ))}
        </div>

        {/*
          ACA ESTUVO LA ATRIBUCION UN RATO (D-156). Se fue al colofón, que es la
          última hoja del tomo: un panel de navegación no es donde un libro
          pone quién lo escribió. Ver `paginasDeTexto`.
        */}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/** Una hoja del libro. Es lo que se clona para el pliegue y para la lupa. */
function HojaPagina({
  pagina, libro, lang, lado, w, h, videoActivo, onVideo, volumen,
}: {
  pagina: Pagina | undefined;
  libro: Libro;
  lang: Idioma;
  lado: "izq" | "der";
  w: number;
  h: number;
  videoActivo: boolean;
  onVideo: () => void;
  /** Sólo el volumen de texto: lo bajado, o el estado en que está. */
  volumen?: VolumenTexto | "falla" | null;
}) {
  const T = paleta;
  // Proporcional y no un margen fijo: con 84 px de aire a cada lado, en una
  // ventana baja la hoja queda de 152 px y el reproductor terminaba en 68.
  const anchoVideo = Math.round(w * 0.82);
  const caja = cajaTexto(w, h);

  return (
    <div className={`alv-bib-hoja ${lado}`} style={{ width: w, height: h }}>
      {pagina?.tipo === "portadilla" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 clamp(28px,12%,62px)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: ".26em",
              textTransform: "uppercase",
              color: "oklch(40% .02 62 / .68)",
            }}
          >
            {COPY.firma[lang]}
          </div>
          <div style={{ width: 34, height: 1, background: "oklch(40% .02 62 / .34)", margin: "28px 0" }} />
          <div
            style={{
              fontFamily: FUENTE.titulo,
              fontSize: Math.round(h * 0.065),
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-.02em",
              color: "oklch(24% .01 66)",
            }}
          >
            {libro.titulo[lang]}
          </div>
          <div style={{ width: 34, height: 1, background: "oklch(40% .02 62 / .34)", margin: "28px 0" }} />
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: "oklch(40% .02 62 / .74)",
            }}
          >
            {cuenta(libro, lang).n} {cuenta(libro, lang).que}
          </div>

          {/*
            LA PORTADILLA DEL VOLUMEN AJENO DICE DOS COSAS Y LAS DICE ACA.
            Que no es de Leonardo, y de quién es. La primera es la advertencia
            —la hoja que se ve sí o sí al abrir el tomo—; la segunda es la
            atribución que pide CC BY-SA, y viene redactada dentro del JSON
            para que no exista una copia del texto sin ella.
          */}
          {libro.texto && (
            <div style={{ marginTop: 30, maxWidth: "94%" }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: FUENTE.lectura,
                  fontSize: Math.max(10, Math.round(h * 0.023)),
                  fontStyle: "italic",
                  lineHeight: 1.5,
                  color: "oklch(34% .02 62 / .86)",
                }}
              >
                {COPY.ajeno[lang]}
              </p>
              {/*
                LA ATRIBUCION SE FUE DE ACA (D-156), Y NO SE FUE DEL PRODUCTO.
                En la portadilla eran tres renglones de aparato legal encima
                del título, y competían con lo único que esa hoja tiene que
                decir. Ahora vive al pie del panel de índice: se llega desde
                cualquier hoja, con un toque, en vez de sólo desde la primera.
                CC BY-SA pide que la atribución acompañe a la obra, no que
                interrumpa la portada — y sigue estando adentro del JSON, que
                es lo que hace imposible servir el texto sin ella.
              */}
            </div>
          )}
        </div>
      )}

      {pagina?.tipo === "texto" && (
        <>
          <div
            className="alv-bib-texto"
            style={{
              position: "absolute",
              inset: `${caja.padY}px ${caja.padX}px`,
              fontSize: caja.cuerpo,
              // El molde de `paginarTexto` mide con este mismo recorte, así que
              // lo que se corta acá es lo que allá ya no entró: nada.
              overflow: "hidden",
            }}
          >
            {pagina.hoja.bloques.map((b, i) =>
              b.t === "p" ? (
                <p key={i} data-sigue={b.sigue ? "si" : undefined}>
                  {b.x}
                </p>
              ) : b.t === "h2" ? (
                <h2 key={i} style={{ fontFamily: FUENTE.titulo }}>
                  {b.x}
                </h2>
              ) : (
                <h3 key={i} style={{ fontFamily: FUENTE.titulo }}>
                  {b.x}
                </h3>
              ),
            )}
          </div>
          <div
            className="alv-bib-folio"
            style={{ [lado === "izq" ? "left" : "right"]: 30 } as React.CSSProperties}
          >
            {String(pagina.n).padStart(2, "0")}
          </div>
        </>
      )}

      {pagina?.tipo === "lamina" && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              padding: `${Math.round(h * 0.08)}px ${Math.round(w * 0.1)}px ${Math.round(h * 0.1)}px`,
            }}
          >
            {videoActivo && pagina.lamina.video ? (
              <div
                className="alv-bib-marco-video"
                style={{ width: anchoVideo, height: Math.round((anchoVideo * 9) / 16) }}
              >
                {/* El respaldo vive DEBAJO del reproductor: si el iframe no
                    pinta —red caída, extensión de privacidad— queda un camino
                    al video en vez de un rectángulo negro. */}
                <a
                  className="alv-bib-respaldo"
                  href={`https://www.youtube.com/watch?v=${pagina.lamina.video}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {COPY.enYoutube[lang]} ↗
                </a>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${pagina.lamina.video}?autoplay=1&rel=0&modestbranding=1`}
                  title={`${libro.titulo[lang]} — ${COPY.lamina[lang]} ${pagina.n}`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            ) : (
              <img
                className="alv-bib-lamina"
                src={rutaHoja(libro, pagina.lamina)}
                alt={pagina.lamina.nota[lang]}
                loading="lazy"
                draggable={false}
              />
            )}

            {/* El folio se convierte en el movimiento: el video entra en el
                mismo hueco donde estaba el dibujo. */}
            {pagina.lamina.video && !videoActivo && (
              <button type="button" className="alv-bib-andar" onClick={onVideo}>
                <svg width="14" height="14" viewBox="0 0 15 15" aria-hidden="true">
                  <circle cx="7.5" cy="7.5" r="6.6" fill="none" stroke="currentColor" strokeWidth="1" />
                  <path d="M6 4.6 L10.4 7.5 L6 10.4 Z" fill="currentColor" />
                </svg>
                {COPY.andar[lang]}
              </button>
            )}
          </div>
          <div
            className="alv-bib-folio"
            style={{ [lado === "izq" ? "left" : "right"]: 30 } as React.CSSProperties}
          >
            {String(pagina.n).padStart(2, "0")}
          </div>
        </>
      )}

      {/*
        EL COLOFON: la última hoja, y la única del tomo que no es del artículo.
        Va centrada y chica, como se imprime un colofón — no es contenido, es la
        firma de quién puso el contenido ahí. El enlace al original y el de la
        licencia son lo que CC BY-SA pide de verdad; el texto ya viene redactado
        adentro del JSON, así que no hay forma de servir uno sin el otro.
      */}
      {pagina?.tipo === "colofon" && typeof volumen === "object" && volumen && (
        <div className="alv-bib-colofon" style={{ inset: `${caja.padY}px ${caja.padX}px` }}>
          <span className="alv-bib-colofon-adorno" aria-hidden="true">
            ❦
          </span>
          <p>{volumen.credito}</p>
          <p className="alv-bib-colofon-enlaces">
            <a href={volumen.url} target="_blank" rel="noopener noreferrer">
              {COPY.verArticulo[lang]} ↗
            </a>
            <span aria-hidden="true"> · </span>
            <a href={volumen.licencia.url} target="_blank" rel="noopener noreferrer">
              {volumen.licencia.nombre}
            </a>
          </p>
        </div>
      )}

      <div className={`alv-bib-canal ${lado}`} />
    </div>
  );
}

/**
 * El motivo de cada tapa. Cero bytes de arte: es la lección de §4.7 del doc 19
 * —lo procedural sembrado gana a los assets— y acá manda la restricción §6.1,
 * que ya tiene 133 MB encima.
 */
function Motivo({ id }: { id: Libro["id"] }) {
  const t = { fill: "none", stroke: "currentColor", strokeWidth: 1.1 } as const;
  if (id === "anatomia") {
    return (
      <svg width="160" height="112" viewBox="0 0 160 112" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const r = 20 + i * 12;
          return <path key={i} {...t} d={`M${80 - r} 98 A${r} ${(r * 0.76).toFixed(1)} 0 0 1 ${80 + r} 98`} />;
        })}
      </svg>
    );
  }
  if (id === "maquinas") {
    return (
      <svg width="160" height="112" viewBox="0 0 160 112" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return (
            <path
              key={i}
              {...t}
              d={`M${(80 + Math.cos(a) * 38).toFixed(1)} ${(56 + Math.sin(a) * 38).toFixed(1)} L${(80 + Math.cos(a) * 48).toFixed(1)} ${(56 + Math.sin(a) * 48).toFixed(1)}`}
            />
          );
        })}
        <circle {...t} cx="80" cy="56" r="38" />
        <circle {...t} cx="80" cy="56" r="23" />
        <circle {...t} cx="80" cy="56" r="8" />
      </svg>
    );
  }
  if (id === "wikipedia") {
    /*
     * RENGLONES, Y NINGUN DIBUJO. Los otros cuatro motivos son figuras que
     * Leonardo trazó —arcos anatómicos, una rueda dentada, la espiral del
     * agua, los rectángulos áureos—. Este tomo no es de él, así que su tapa no
     * lleva ninguna: lleva lo único que tiene adentro, que es texto. La
     * diferencia se ve sin leer una palabra, que es todo el punto.
     */
    const renglones = [0, 1, 2, 3, 4, 5, 6];
    const anchos = [1, 0.94, 1, 0.88, 1, 0.97, 0.52];
    return (
      <svg width="160" height="112" viewBox="0 0 160 112" aria-hidden="true">
        {renglones.map((i) => (
          <path
            key={i}
            {...t}
            strokeWidth={1}
            d={`M34 ${(24 + i * 11).toFixed(0)} H${(34 + 92 * anchos[i]!).toFixed(1)}`}
          />
        ))}
      </svg>
    );
  }
  if (id === "dibujos") {
    // La espiral del diluvio: el remolino que Leonardo dibujó una y otra vez
    // para entender cómo se mueve el agua.
    const pts: string[] = [];
    for (let i = 0; i <= 190; i++) {
      const a = (i / 190) * Math.PI * 7;
      const r = 3 + a * 3.6;
      pts.push(`${(80 + Math.cos(a) * r).toFixed(1)} ${(56 + Math.sin(a) * r * 0.72).toFixed(1)}`);
    }
    return (
      <svg width="160" height="112" viewBox="0 0 160 112" aria-hidden="true">
        <path {...t} d={`M${pts.join(" L")}`} />
      </svg>
    );
  }
  // Rectángulos áureos encajados, uno adentro del otro.
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  let x = 10, y = 14, w = 140, h = 84;
  for (let i = 0; i < 6; i++) {
    rects.push({ x, y, w, h });
    if (i % 2 === 0) { const nw = w / 1.618; x += w - nw; w = nw; }
    else { const nh = h / 1.618; y += h - nh; h = nh; }
  }
  return (
    <svg width="160" height="112" viewBox="0 0 160 112" aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} {...t} x={r.x.toFixed(1)} y={r.y.toFixed(1)} width={r.w.toFixed(1)} height={r.h.toFixed(1)} />
      ))}
    </svg>
  );
}

function Flecha({ hacia }: { hacia: "izq" | "der" }) {
  return (
    <svg width="17" height="9" viewBox="0 0 17 9" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      {hacia === "izq" ? <path d="M17 4.5 H1 M5.5 1 L1 4.5 L5.5 8" /> : <path d="M0 4.5 H16 M11.5 1 L16 4.5 L11.5 8" />}
    </svg>
  );
}

/* ---- Piezas compartidas -------------------------------------------------- */

const paleta = {
  papel: "oklch(93.2% 0.014 84)",
  tinta: "oklch(24% 0.008 70)",
  tintaSuave: "oklch(24% 0.008 70 / .62)",
  pelo: "oklch(24% 0.008 70 / .19)",
} as const;

const estiloLinea: React.CSSProperties = {
  display: "inline-flex",
  gap: 14,
  alignItems: "center",
  padding: "0 0 7px",
  border: 0,
  borderBottom: "1px solid currentColor",
  background: "transparent",
  cursor: "pointer",
  color: paleta.tinta,
  fontFamily: FUENTE.lectura,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".15em",
  textTransform: "uppercase",
};

const estiloFlecha: React.CSSProperties = {
  position: "absolute",
  zIndex: 17,
  top: "49%",
  display: "grid",
  width: 50,
  height: 50,
  placeItems: "center",
  border: `1px solid ${paleta.pelo}`,
  borderRadius: "50%",
  background: "oklch(93.2% .014 84 / .68)",
  backdropFilter: "blur(10px)",
  cursor: "pointer",
  color: paleta.tinta,
};

const rutaHoja = (l: Libro, m: Lamina) => `/biblioteca/${l.destino}/${m.slug}.webp`;
const rutaIndice = (l: Libro, m: Lamina) => `/biblioteca/${l.destino}/${m.slug}-indice.webp`;

/** La caja del papel, en píxeles del libro. La usa la lupa para saber si salió. */
const cajaLibro = (m: { w: number; h: number }, porPliego: number): CajaLibro => ({
  x: 0,
  y: 0,
  w: m.w * porPliego,
  h: m.h,
});
