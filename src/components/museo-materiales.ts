/**
 * LOS MATERIALES DE LA SALA, DIBUJADOS EN UN CANVAS Y NO DESCARGADOS.
 *
 * Es la misma decisión que el cuero de los tomos de la biblioteca (D-155): un
 * mármol de museo en fotografía son dos o tres megas por textura, y acá son
 * cuatro superficies —piso, pared, techo, moldura— sobre un sitio que ya paga
 * 133 MB en la primera carga. Todo esto se dibuja con `canvas` 2D en unos
 * milisegundos y no cuesta un solo byte de red.
 *
 * Y no es sólo el peso. Un mármol procedural se repite sin costura por
 * construcción, se puede pedir en la resolución que haga falta, y cambiarle el
 * tono es cambiar un número en vez de volver a exportar un archivo.
 *
 * EL RUIDO ES UN VALUE NOISE PROPIO, con `Math.random` sembrado. No hace falta
 * Perlin: para vetas de mármol alcanza con interpolar una grilla de valores al
 * azar y sumar tres octavas. Lo que da el mármol no es el ruido, es lo que se
 * hace con él — pasarlo por un seno es lo que convierte manchas en vetas.
 */

import * as THREE from "three";

/** Un generador reproducible: la misma sala en cada visita. */
function sembrado(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Value noise en dos dimensiones, con la grilla envuelta para que no corte. */
function ruidoTeselado(tam: number, celdas: number, azar: () => number) {
  const g = new Float32Array(celdas * celdas);
  for (let i = 0; i < g.length; i++) g[i] = azar();
  const suave = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const fx = (x / tam) * celdas;
    const fy = (y / tam) * celdas;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = suave(fx - x0), ty = suave(fy - y0);
    // El `% celdas` es lo que hace que el mosaico cierre por los cuatro lados.
    const i = (a: number, b: number) =>
      g[(((b % celdas) + celdas) % celdas) * celdas + (((a % celdas) + celdas) % celdas)]!;
    const a = i(x0, y0) + (i(x0 + 1, y0) - i(x0, y0)) * tx;
    const b = i(x0, y0 + 1) + (i(x0 + 1, y0 + 1) - i(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}

function lienzo(tam: number) {
  const c = document.createElement("canvas");
  c.width = tam;
  c.height = tam;
  return { c, ctx: c.getContext("2d")! };
}

function aTextura(c: HTMLCanvasElement, repeticiones: number, srgb = true): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeticiones, repeticiones);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * EL PISO: damero de mármol, que es lo que hay en el piso de una galería.
 *
 * Dos tonos alternados y una veta distinta por baldosa. La veta sale de pasar
 * el ruido por un seno: `sin(x·f + ruido·k)` produce bandas que se doblan, y
 * eso —no las manchas del ruido crudo— es lo que el ojo reconoce como piedra.
 *
 * La junta va oscura y de un píxel: en un piso pulido la línea entre baldosas
 * es lo primero que dice la escala de la sala al caminar.
 */
export function texturaMarmol(tam = 1024): { mapa: THREE.Texture; rugosidad: THREE.Texture } {
  const { c, ctx } = lienzo(tam);
  const azar = sembrado(20260821);
  const ruido = ruidoTeselado(tam, 12, azar);
  const ruidoFino = ruidoTeselado(tam, 48, azar);

  const img = ctx.createImageData(tam, tam);
  const d = img.data;
  // Dos baldosas por lado en la textura: al repetirla, el damero sale solo.
  const baldosa = tam / 2;

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const bx = Math.floor(x / baldosa);
      const by = Math.floor(y / baldosa);
      const clara = (bx + by) % 2 === 0;

      const n = ruido(x, y);
      const nf = ruidoFino(x, y);
      /*
       * LA VETA ES FINA Y APENAS TORCIDA, no una mancha.
       *
       * La primera versión usaba `sin((x+y)·0,012 + ruido·9)`: una onda muy
       * lenta doblada nueve radianes por el ruido. Eso no da vetas, da
       * manchas que se retuercen — el piso parecía agua o una lámpara de
       * lava. El mármol se ve cuando la onda es RAPIDA y la distorsión CHICA:
       * filamentos casi paralelos que el ruido desvía un poco.
       *
       * `pow(·, 3)` concentra la veta en una línea delgada en vez de dejar un
       * degradado ancho, que es lo que separa una veta de una sombra.
       */
      /*
       * DOS OCTAVAS DE VETA, Y LAS DOS FLOJAS.
       *
       * Con una sola onda las vetas salían paralelas y parejas: se leía como
       * madera, no como piedra. Una segunda onda en otro ángulo y otra
       * frecuencia rompe el paralelismo, que es lo único que separa las dos
       * cosas — el mármol tiene vetas en varias direcciones cruzándose.
       *
       * Y van flojas: 14 niveles de contraste sobre 232. Una veta marcada es
       * un mármol de baño; la de una galería está casi al límite de no verse.
       */
      const v1 = Math.pow(1 - Math.abs(Math.sin((x * 0.9 + y * 0.55) * 0.05 + n * 2.2)), 3);
      const v2 = Math.pow(1 - Math.abs(Math.sin((x * -0.4 + y * 1.1) * 0.031 + nf * 1.6)), 4);
      const veta = v1 * 0.6 + v2 * 0.4;
      const grano = (nf - 0.5) * 4;

      // El damero, que antes no se veía: 232 contra 178 es la diferencia que
      // sobrevive a la luz de la sala. Con 226/196 el piso salía todo claro.
      const base = clara ? 232 : 178;
      const contraste = 14;
      let v = base - veta * contraste + grano;

      // La junta.
      const dx = Math.min(x % baldosa, baldosa - 1 - (x % baldosa));
      const dy = Math.min(y % baldosa, baldosa - 1 - (y % baldosa));
      if (dx < 1.5 || dy < 1.5) v *= 0.72;

      const k = (y * tam + x) * 4;
      // Apenas más cálido en el rojo: un mármol crema, no un gris.
      d[k] = Math.max(0, Math.min(255, v + 6));
      d[k + 1] = Math.max(0, Math.min(255, v + 2));
      d[k + 2] = Math.max(0, Math.min(255, v - 4));
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  /*
   * EL MAPA DE RUGOSIDAD ES EL QUE HACE EL PULIDO. Sin él, el mármol es un
   * dibujo sobre una superficie uniforme y el reflejo delata que es plano. Acá
   * la veta refleja distinto que el fondo —la piedra pulida no es homogénea— y
   * la junta es mate, porque en una junta no hay pulido.
   */
  const { c: cr, ctx: cr2 } = lienzo(tam / 2);
  const imgR = cr2.createImageData(tam / 2, tam / 2);
  const dr = imgR.data;
  for (let y = 0; y < tam / 2; y++) {
    for (let x = 0; x < tam / 2; x++) {
      const X = x * 2, Y = y * 2;
      const veta = Math.pow(1 - Math.abs(Math.sin((X * 0.9 + Y * 0.55) * 0.05 + ruido(X, Y) * 2.2)), 3);
      const b2 = baldosa;
      const dx = Math.min(X % b2, b2 - 1 - (X % b2));
      const dy = Math.min(Y % b2, b2 - 1 - (Y % b2));
      const junta = dx < 1.5 || dy < 1.5;
      const v = junta ? 235 : 40 + veta * 55;
      const k = (y * (tam / 2) + x) * 4;
      dr[k] = dr[k + 1] = dr[k + 2] = v;
      dr[k + 3] = 255;
    }
  }
  cr2.putImageData(imgR, 0, 0);

  return { mapa: aTextura(c, 1), rugosidad: aTextura(cr, 1, false) };
}

/**
 * LA PARED: el azul del Prado, con el grano de una pared pintada.
 *
 * El color es `#414D59`, la conversión del NCS S7010-R90B con el que el Prado
 * repintó la Galería Central. La variación es mínima a propósito: una pared de
 * museo está pintada al plástico mate y lo único que se ve es una diferencia
 * de un par de niveles por el rodillo y por cómo le pega la luz. Cualquier
 * textura más marcada la convertiría en una pared de piedra.
 */
export const AZUL_PRADO = 0x414d59;

export function texturaPared(tam = 512): THREE.Texture {
  const { c, ctx } = lienzo(tam);
  const azar = sembrado(7010);
  const ruido = ruidoTeselado(tam, 24, azar);
  const fino = ruidoTeselado(tam, 96, azar);

  const img = ctx.createImageData(tam, tam);
  const d = img.data;
  const R = (AZUL_PRADO >> 16) & 255;
  const G = (AZUL_PRADO >> 8) & 255;
  const B = AZUL_PRADO & 255;

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const v = (ruido(x, y) - 0.5) * 7 + (fino(x, y) - 0.5) * 4;
      const k = (y * tam + x) * 4;
      d[k] = Math.max(0, Math.min(255, R + v));
      d[k + 1] = Math.max(0, Math.min(255, G + v));
      d[k + 2] = Math.max(0, Math.min(255, B + v));
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return aTextura(c, 1);
}

/**
 * EL TECHO: yeso blanco. Casi liso, con la variación justa para que no sea un
 * color plano — el techo es lo que más superficie ocupa mirando hacia arriba y
 * un blanco perfectamente uniforme se lee como un vacío.
 */
export function texturaYeso(tam = 512): THREE.Texture {
  const { c, ctx } = lienzo(tam);
  const azar = sembrado(1519);
  const ruido = ruidoTeselado(tam, 32, azar);
  const fino = ruidoTeselado(tam, 128, azar);
  const img = ctx.createImageData(tam, tam);
  const d = img.data;
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const v = 239 + (ruido(x, y) - 0.5) * 6 + (fino(x, y) - 0.5) * 5;
      const k = (y * tam + x) * 4;
      d[k] = v + 2;
      d[k + 1] = v + 1;
      d[k + 2] = v - 2;
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return aTextura(c, 1);
}
