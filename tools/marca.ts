/**
 * `npm run marca` — de `brand/` a `public/`: la tarjeta social y los iconos.
 *
 * POR QUE LOS ORIGINALES VUELVEN AL REPOSITORIO. D-192 los sacó de `public/`
 * con razón —3,7 MB que cualquiera descargaba y nada usaba— y los mandó a
 * `docs/fuentes/`, que está gitignoreada. El efecto colateral: **los másters de
 * la marca vivían fuera de git, o sea sin historia y sin copia**, y todo lo
 * derivado (favicon, iconos, tarjeta social) no se podía regenerar en un clon.
 *
 * `brand/` resuelve las dos cosas a la vez: está versionado y **no se sirve**.
 * Next publica `public/`, no la raíz, así que ningún visitante puede pedir
 * estos archivos. El defecto que D-192 arregló sigue arreglado.
 *
 * ES IDEMPOTENTE Y NO TOCA LOS ORIGINALES. Lee de `brand/`, escribe en
 * `public/`. Por omisión sólo rehace la tarjeta social, que es la que cambia;
 * con `--iconos` rehace también el juego de favicons, que ya está en su lugar
 * y no hace falta mover.
 */

import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ORIGEN = path.join(RAIZ, "brand", "logo.png");
const ORIGEN_SIN = path.join(RAIZ, "brand", "logo-sin-inscripcion.png");
const DESTINO = path.join(RAIZ, "public");

/**
 * EL FONDO, MUESTREADO DEL PROPIO ORIGINAL, no elegido a ojo.
 *
 * El logo es cuadrado y la tarjeta social es apaisada, así que sobra ancho a
 * los dos lados y hay que rellenarlo. `rgb(9, 11, 15)` es el píxel de la
 * esquina del máster: cualquier otro valor dibujaría dos bandas visibles
 * contra un negro que no es negro puro.
 *
 * ⚠ NO ES EL `themeColor` DE `layout.tsx` (`#0e0503`). Ése es el del taller
 * —hue 40, cálido— y éste es el del logo, que tira a azul. Se parecen y no son
 * el mismo; mezclarlos deja el borde a la vista.
 */
const FONDO = { r: 9, g: 11, b: 15 } as const;

/**
 * 1200 × 630 es la medida que LinkedIn, X y WhatsApp sirven sin reescalar. La
 * anterior era 600 × 312: el mínimo que una tarjeta grande acepta, o sea que en
 * cualquier pantalla densa se veía blanda. El original mide 1254 px de lado,
 * así que a 630 de alto se reduce —nunca se agranda— y no hay píxel inventado.
 */
const TARJETA = { ancho: 1200, alto: 630, archivo: "og-1200x630.png" } as const;

/** El juego de iconos, tal como lo declara `metadata.icons`. */
const ICONOS = [
  { lado: 512, archivo: "logo-512.webp", q: 88 },
  { lado: 256, archivo: "logo-256.webp", q: 86 },
  { lado: 180, archivo: "logo-180.webp", q: 86 },
  { lado: 64, archivo: "favicon-64.webp", q: 82 },
] as const;

const kb = (n: number): string => `${(n / 1024).toFixed(0)} KB`;

/**
 * LA MARCA DEL ESPACIO VECTORIAL, la que va en la última pantalla.
 *
 * Sale del máster SIN inscripción porque ahí el nombre va escrito al lado, en
 * grande: repetirlo dentro del dibujo lo dejaría ilegible a 226 px.
 *
 * ⚠ EL FONDO SE VA AL CANAL ALFA, y no se tapa con una máscara. El máster está
 * sobre `rgb(3, 7, 11)` y esa pantalla es negro puro: pegado tal cual dibuja un
 * rectángulo apenas más claro, y una máscara radial que lo escondiera recortaría
 * dibujo —la escritura especular de la izquierda y los nodos de la derecha—.
 *
 * Cómo: para cada píxel, `alfa = max(r, g, b)` y el color se reescala por ese
 * mismo factor. Compuesto sobre negro da EXACTAMENTE el píxel original —es la
 * identidad `C = (C · 255/max) · (max/255)`— y el fondo queda al 4 % de opacidad,
 * o sea invisible sobre cualquier superficie oscura.
 *
 * El piso de 18 barre la bruma del fondo: compuesta sobre negro no se veía, pero
 * en el canal alfa era ruido puro y triplicaba el peso del archivo. La rampa
 * evita que ese corte deje un borde duro.
 */
const ESPACIO = { archivo: "espacio-marca.webp", lado: 360, piso: 18, rampa: 12 } as const;

async function espacio(): Promise<void> {
  const { data, info } = await sharp(ORIGEN_SIN)
    // Contra el píxel de la esquina: el máster trae aire arriba y abajo que
    // dejaría el dibujo chico y descentrado dentro de su caja.
    .trim({ threshold: 16 })
    .resize({ width: ESPACIO.lado, height: ESPACIO.lado, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = info.width * info.height;
  const rgba = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    const o = i * info.channels;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const m = Math.max(r, g, b);
    const suave = Math.min(1, Math.max(0, (m - ESPACIO.piso) / ESPACIO.rampa));
    const k = m > 0 && suave > 0 ? 255 / m : 0;
    rgba[i * 4] = Math.min(255, Math.round(r * k));
    rgba[i * 4 + 1] = Math.min(255, Math.round(g * k));
    rgba[i * 4 + 2] = Math.min(255, Math.round(b * k));
    rgba[i * 4 + 3] = Math.round(m * suave);
  }

  const buf = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .webp({ quality: 87, effort: 6 })
    .toBuffer();
  await writeFile(path.join(DESTINO, ESPACIO.archivo), buf);
  console.log(
    `  ${ESPACIO.archivo.padEnd(20)} ${info.width}×${info.height}  ${kb(buf.length)}`,
  );
}

async function tarjeta(): Promise<void> {
  const buf = await sharp(ORIGEN)
    .resize({
      width: TARJETA.ancho,
      height: TARJETA.alto,
      // `contain`: el logo entra entero y centrado. `cover` recortaría el
      // cuadrado a una banda y se comería la mitad del hombre de Vitruvio.
      fit: "contain",
      background: FONDO,
      withoutEnlargement: true,
    })
    .flatten({ background: FONDO })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  const destino = path.join(DESTINO, TARJETA.archivo);
  await writeFile(destino, buf);
  console.log(`  ${TARJETA.archivo.padEnd(20)} ${TARJETA.ancho}×${TARJETA.alto}  ${kb(buf.length)}`);
}

async function iconos(): Promise<void> {
  for (const i of ICONOS) {
    const buf = await sharp(ORIGEN)
      .resize({ width: i.lado, height: i.lado, fit: "cover", withoutEnlargement: true })
      .webp({ quality: i.q })
      .toBuffer();
    await writeFile(path.join(DESTINO, i.archivo), buf);
    console.log(`  ${i.archivo.padEnd(20)} ${i.lado}×${i.lado}  ${kb(buf.length)}`);
  }
}

const m = await stat(ORIGEN).catch(() => null);
if (!m) {
  console.error(`no encuentro el original en ${ORIGEN}`);
  process.exit(1);
}

console.log(`marca — desde brand/logo.png (${kb(m.size)})\n`);
await tarjeta();
await espacio();
if (process.argv.includes("--iconos")) await iconos();
else console.log("  (los iconos no se tocan; `--iconos` los rehace)");
