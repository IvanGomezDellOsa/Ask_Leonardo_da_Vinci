/**
 * `npm run biblioteca` — de `contenido biblioteca/` a `public/biblioteca/`.
 *
 * QUE ARREGLA. Las 20 láminas llegaron como las bajó el dueño del proyecto:
 * nombres con espacios, comas y tildes («Leonardo, spines.png.webp»), tres
 * formatos mezclados y, sobre todo, seis PNG de captura de pantalla que pesan
 * ~780 KB para 530x739 px — 40 veces lo que ocupa la misma imagen en webp. En
 * total 8,6 MB. Este archivo los pasa a webp, les pone un slug ASCII y saca
 * dos tamaños de cada uno.
 *
 * POR QUE IMPORTA EL PESO ACA MAS QUE EN OTRO LADO. `19-bocetos-biblioteca.md`
 * §6 lo deja escrito como restricción dura: la primera carga ya cuesta ~133 MB
 * por el modelo de embeddings (D-118). Cualquier mega que agregue la biblioteca
 * compite con ese número, que ya duele. De ahí las dos decisiones de abajo.
 *
 * LAS DOS VARIANTES, Y POR QUE DOS Y NO UNA:
 *
 *   `<slug>.webp`         hoja: lado largo 1600 px, q82. Es lo que se ve
 *                         cuando la lámina ocupa la página del libro abierto.
 *   `<slug>-indice.webp`  índice: lado largo 320 px, q72. Es la tira de
 *                         miniaturas de abajo y el reverso de la hoja que
 *                         gira.
 *
 * La miniatura no es una optimización de más: durante el pliegue se ven DOS
 * caras a la vez (`19-bocetos-biblioteca.md` §2.2), y la que se va no merece
 * 1600 px. Bajar la de atrás a 320 es lo que deja que el giro no pida medio
 * mega de decodificación a mitad de animación.
 *
 * NO SE AGRANDA NADA. `withoutEnlargement` está puesto: `Craneo.jpg` mide
 * 327x456 y sale de acá igual de chico. Estirarlo a 1600 sería inventar
 * píxeles y pesar más por una imagen peor.
 *
 * SE PUEDE CORRER MIL VECES. Es idempotente y no toca el original: lee de
 * `contenido biblioteca/`, escribe en `public/biblioteca/`, y salta la lámina
 * cuya salida ya es más nueva que su entrada salvo que se pase `--forzar`.
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { BIBLIOTECA, type Lamina, type Libro } from "../src/data/biblioteca.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ORIGEN = path.join(RAIZ, "contenido biblioteca");
const DESTINO = path.join(RAIZ, "public", "biblioteca");

/**
 * Los dos tamaños. `q` es la calidad webp: 82 en la hoja porque son dibujos a
 * tinta sobre papel y el ruido del grano se lleva mal con la compresión
 * agresiva; 72 en el índice porque a 320 px no se ve la diferencia.
 */
const VARIANTES = [
  { sufijo: "", lado: 1600, q: 82 },
  { sufijo: "-indice", lado: 320, q: 72 },
] as const;

/**
 * EL TECHO POR HOJA, Y POR QUE ES UNA REGLA Y NO UN ARREGLO PUNTUAL.
 *
 * A q82 parejo, dieciocho de las veinte láminas caen abajo de 250 KB y dos se
 * van a ~750 KB: «Cabeza de una mujer» y «Ginevra de' Benci». No es culpa de
 * la conversión —son dibujos a tiza sobre papel con grano, y el grano es ruido
 * de alta frecuencia, justo lo que ningún códec puede tirar sin que se note—.
 * Reencodearlas a q82 devuelve el mismo peso que tenían.
 *
 * La tentación es bajarle la calidad a esos dos archivos por nombre. Sería un
 * parche que se pudre: la lámina 21 que alguien agregue mañana con la misma
 * textura vuelve a pesar 750 KB y nadie se entera. Así que el techo es una
 * regla del pipeline: si la hoja se pasa, se reintenta con menos calidad hasta
 * entrar o hasta tocar el piso, y se avisa cuál se bajó y hasta dónde.
 *
 * 400 KB sale de la restricción de `19-bocetos-biblioteca.md` §6.1: veinte
 * hojas a 400 son 8 MB de tope absoluto, y como se bajan de a una —la que se
 * está leyendo— el costo real por hoja es lo que importa. El piso de 62 es el
 * punto donde el grano del papel empieza a verse en bloques.
 */
const TECHO_HOJA = 400 * 1024;
const PISO_CALIDAD = 62;

const forzar = process.argv.includes("--forzar");

/** Kilobytes con un decimal, para que la tabla del final se lea derecha. */
const kb = (bytes: number) => (bytes / 1024).toFixed(0).padStart(5) + " KB";

type Medida = {
  libro: string;
  slug: string;
  ancho: number;
  alto: number;
  bytes: number;
  bytesOrigen: number;
};

async function procesar(libro: Libro, lamina: Lamina): Promise<Medida> {
  const entrada = path.join(ORIGEN, libro.carpeta, lamina.origen);
  const carpetaSalida = path.join(DESTINO, libro.destino);
  await mkdir(carpetaSalida, { recursive: true });

  const infoEntrada = await stat(entrada);
  let medida: Medida | null = null;

  for (const variante of VARIANTES) {
    const salida = path.join(carpetaSalida, `${lamina.slug}${variante.sufijo}.webp`);

    // Saltar sólo si la salida ya existe Y es más nueva que la entrada. Con
    // `--forzar` se rehace igual: hace falta cuando lo que cambió es la
    // calidad o el lado de arriba, no el archivo de origen.
    let vigente = false;
    if (!forzar) {
      try {
        vigente = (await stat(salida)).mtimeMs >= infoEntrada.mtimeMs;
      } catch {
        vigente = false;
      }
    }

    if (vigente) {
      const { size } = await stat(salida);
      const meta = await sharp(salida).metadata();
      if (!variante.sufijo) {
        medida = {
          libro: libro.id,
          slug: lamina.slug,
          ancho: meta.width ?? 0,
          alto: meta.height ?? 0,
          bytes: size,
          bytesOrigen: infoEntrada.size,
        };
      }
      continue;
    }

    const codificar = (q: number) =>
      sharp(entrada)
        .rotate() // respeta el EXIF de orientación antes de redimensionar
        .resize({
          width: variante.lado,
          height: variante.lado,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: q, effort: 6 })
        .toFile(salida);

    let calidad = variante.q;
    let info = await codificar(calidad);

    // El techo sólo rige para la hoja: el índice a 320 px nunca se le acerca.
    if (!variante.sufijo) {
      while (info.size > TECHO_HOJA && calidad > PISO_CALIDAD) {
        calidad = Math.max(PISO_CALIDAD, calidad - 6);
        info = await codificar(calidad);
      }
      if (calidad !== variante.q) {
        const nota = info.size > TECHO_HOJA ? " — sigue arriba del techo" : "";
        console.warn(
          `  ajuste ${lamina.slug}: q${variante.q} → q${calidad} para entrar en ` +
            `${(TECHO_HOJA / 1024).toFixed(0)} KB${nota}`,
        );
      }
    }

    if (!variante.sufijo) {
      medida = {
        libro: libro.id,
        slug: lamina.slug,
        ancho: info.width,
        alto: info.height,
        bytes: info.size,
        bytesOrigen: infoEntrada.size,
      };
    }
  }

  if (!medida) throw new Error(`sin medida para ${lamina.slug}`);
  return medida;
}

async function main() {
  // Que las 20 entradas del catálogo existan de verdad, ANTES de convertir
  // ninguna: un slug mal escrito tiene que fallar acá y no dejar la carpeta
  // de salida a medio llenar.
  const faltantes: string[] = [];
  const usados = new Set<string>();
  for (const libro of BIBLIOTECA) {
    for (const lamina of libro.laminas) {
      const entrada = path.join(ORIGEN, libro.carpeta, lamina.origen);
      try {
        await stat(entrada);
      } catch {
        faltantes.push(`${libro.carpeta}/${lamina.origen}`);
      }
      const clave = `${libro.destino}/${lamina.slug}`;
      if (usados.has(clave)) faltantes.push(`slug repetido: ${clave}`);
      usados.add(clave);
    }
  }
  if (faltantes.length) {
    console.error("El catálogo no coincide con la carpeta:");
    for (const f of faltantes) console.error("  falta  " + f);
    process.exit(1);
  }

  // Y al revés: archivos en la carpeta que el catálogo no menciona. No es un
  // error —el bloc de notas de los videos vive ahí— pero se avisa, porque una
  // lámina nueva que nadie agregó al catálogo es invisible en el sitio.
  for (const libro of BIBLIOTECA) {
    const enDisco = await readdir(path.join(ORIGEN, libro.carpeta));
    const enCatalogo = new Set(libro.laminas.map((l) => l.origen));
    for (const f of enDisco) {
      if (f.endsWith(".txt") || enCatalogo.has(f)) continue;
      console.warn(`  aviso  ${libro.carpeta}/${f} está en la carpeta y no en el catálogo`);
    }
  }

  const medidas: Medida[] = [];
  for (const libro of BIBLIOTECA) {
    console.log(`\n${libro.titulo.es}`);
    for (const lamina of libro.laminas) {
      const m = await procesar(libro, lamina);
      medidas.push(m);
      const ahorro = 100 - (m.bytes / m.bytesOrigen) * 100;
      console.log(
        `  ${m.slug.padEnd(24)} ${String(m.ancho).padStart(4)}x${String(m.alto).padEnd(4)}` +
          ` ${kb(m.bytesOrigen)} → ${kb(m.bytes)}  (−${ahorro.toFixed(0)}%)`,
      );
    }
  }

  // Las medidas van a un JSON aparte y no al catálogo: son derivadas, y
  // meterlas en `biblioteca.ts` obligaría a editar a mano un archivo cada vez
  // que cambia la calidad de compresión. El `width`/`height` de cada `<img>`
  // sale de acá, que es lo que evita que la hoja salte al cargar.
  const medidasPorClave = Object.fromEntries(
    medidas.map((m) => [`${m.libro}/${m.slug}`, { ancho: m.ancho, alto: m.alto, bytes: m.bytes }]),
  );
  await writeFile(
    path.join(DESTINO, "medidas.json"),
    JSON.stringify(medidasPorClave, null, 2) + "\n",
    "utf8",
  );

  const origen = medidas.reduce((a, m) => a + m.bytesOrigen, 0);
  const salida = medidas.reduce((a, m) => a + m.bytes, 0);
  console.log(
    `\n${medidas.length} láminas · ${(origen / 1024 / 1024).toFixed(1)} MB → ` +
      `${(salida / 1024 / 1024).toFixed(1)} MB de hojas ` +
      `(−${(100 - (salida / origen) * 100).toFixed(0)}%)`,
  );

  // Una huella de la salida, del mismo género que la de `portada.ts`: si dos
  // corridas dan la misma, no hace falta volver a mirar las imágenes.
  const huella = createHash("sha256")
    .update(JSON.stringify(medidasPorClave))
    .digest("hex")
    .slice(0, 12);
  console.log(`huella de la biblioteca: ${huella}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
