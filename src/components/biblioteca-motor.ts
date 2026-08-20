/**
 * EL MOTOR DE LA BIBLIOTECA: el pliegue y la lupa, sin React adentro.
 *
 * Acá vive todo lo que cambia cuadro a cuadro. Está separado del componente a
 * propósito, y es el reparto que `docs/19-bocetos-biblioteca.md` §4.1 saca de
 * los dos bocetos: React posee el estado durable —qué volumen, qué pliego, qué
 * idioma—, este archivo posee el estado por frame, y no se hablan más que por
 * los argumentos de estas funciones. Pasar una hoja no dispara un solo render.
 *
 * Ninguna de las dos técnicas se copió. Sketchbook no tiene licencia (§7 del
 * doc), así que de ahí se aprende y se reimplementa; esto es una escritura
 * propia de las dos ideas que ese repo enseña.
 */

/** El pliegue completo se deriva de una sola variable de progreso. */
export type Pliegue = {
  host: HTMLElement;
  tiras: { tira: HTMLElement; vidrioA: HTMLElement; vidrioB: HTMLElement }[];
  dir: 1 | -1;
  n: number;
  ancho: number;
};

export type OpcionesPliegue = {
  /** Dónde se apoya la hoja que gira. */
  host: HTMLElement;
  /** La cara que se ve al empezar (la que se levanta). */
  frente: HTMLElement | null;
  /** Lo que hay del otro lado de esa misma hoja. */
  dorso: HTMLElement | null;
  ancho: number;
  alto: number;
  /** +1 avanza (gira el recto), −1 retrocede (gira el verso). */
  dir: 1 | -1;
  /** Cuántas tiras. Menos de 8 se ve facetado; más de 18 no se nota. */
  tiras: number;
};

/**
 * ARMA LA CADENA DE TIRAS.
 *
 * Una hoja que gira con un solo `rotateY` se lee como una puerta. Acá la hoja
 * es una cadena de tiras anidadas, cada una rotada un delta respecto de su
 * madre, de modo que la tangente barre un arco y el papel se comba
 * (`19-bocetos-biblioteca.md` §2.2).
 *
 * Las caras no se vuelven a dibujar: se CLONA el nodo de la página que ya está
 * en el documento. El navegador reusa las mismas imágenes, así que abrir el
 * pliegue no cuesta una sola descarga.
 */
export function construirPliegue(o: OpcionesPliegue): Pliegue {
  const { host, frente, dorso, ancho: W, alto: H, dir } = o;
  const n = Math.max(4, Math.round(o.tiras));
  const anchoTira = W / n;

  host.textContent = "";
  host.style.width = `${W}px`;
  host.style.height = `${H}px`;
  // El canal es el eje del giro: yendo adelante está a la izquierda de la
  // hoja que se levanta; yendo atrás, a su derecha.
  host.style.transformOrigin = dir > 0 ? "0 50%" : "100% 50%";

  const tiras: Pliegue["tiras"] = [];
  let padre: HTMLElement = host;

  for (let k = 0; k < n; k++) {
    const tira = document.createElement("div");
    tira.className = "alv-bib-tira";
    tira.style.width = `${anchoTira}px`;
    tira.style.height = `${H}px`;
    /*
     * DONDE ARRANCA LA CADENA. La tira 0 se apoya SIEMPRE contra el canal y
     * las hijas marchan hacia el borde libre. Yendo adelante el canal es el
     * borde izquierdo de la hoja y la cadena va a la derecha; yendo atrás es
     * el borde DERECHO, así que la tira 0 arranca pegada a él y la cadena va a
     * la izquierda. Arrancar las dos en 0 mandaba la cadena de la vuelta un
     * ancho de página afuera del libro, y la hoja no se veía.
     */
    tira.style.left = `${
      k === 0 ? (dir > 0 ? 0 : W - anchoTira) : dir > 0 ? anchoTira : -anchoTira
    }px`;
    tira.style.transformOrigin = dir > 0 ? "0 50%" : "100% 50%";

    const cara = (fuente: HTMLElement | null, atras: boolean) => {
      const c = document.createElement("div");
      c.className = "alv-bib-cara";
      if (atras) c.style.transform = "rotateY(180deg)";
      const cont = document.createElement("div");
      cont.className = "alv-bib-contenido";
      cont.style.width = `${W}px`;
      cont.style.height = `${H}px`;
      /*
       * Qué columna de la página le toca a esta tira. El dorso se lee al
       * revés, y el sentido del giro espeja las dos: la cadena arranca del
       * otro lado.
       */
      const desdeElCanal = k * anchoTira;
      const desdeElBorde = W - (k + 1) * anchoTira;
      const propio = dir > 0 ? desdeElCanal : desdeElBorde;
      const espejado = dir > 0 ? desdeElBorde : desdeElCanal;
      cont.style.left = `${-(atras ? espejado : propio)}px`;
      if (fuente) cont.appendChild(fuente.cloneNode(true));
      c.appendChild(cont);
      const vidrio = document.createElement("div");
      vidrio.className = "alv-bib-vidrio";
      c.appendChild(vidrio);
      return { cara: c, vidrio };
    };

    const a = cara(frente, false);
    const b = cara(dorso, true);
    tira.appendChild(a.cara);
    tira.appendChild(b.cara);
    padre.appendChild(tira);
    padre = tira;
    tiras.push({ tira, vidrioA: a.vidrio, vidrioB: b.vidrio });
  }

  return { host, tiras, dir, n, ancho: W };
}

/**
 * UN SOLO NÚMERO MANEJA TODO EL GIRO.
 *
 *   th   = π·t                 cuánto giró la hoja
 *   beta = combado·sin(π·t)    plana en las dos puntas, combada en el medio
 *   tt   = th + beta           rotación del conjunto, que se pasa a propósito
 *   td   = 2·beta/n            lo que cada hija rota de vuelta
 *
 * y la luz de cada tira es |cos(tt − k·td)|. Eso es lo ÚNICO que se escribe
 * por elemento por frame; el resto es una sola transformación en el host.
 * Interrumpir el giro a la mitad no rompe nada porque no hay dos estados que
 * sincronizar: hay uno.
 */
export function aplicarGiro(p: Pliegue, t: number, combado: number): void {
  const th = Math.PI * t;
  const beta = combado * Math.sin(Math.PI * t);
  const tt = th + beta;
  const td = (2 * beta) / p.n;

  p.host.style.transform = `rotateY(${-p.dir * tt}rad)`;

  for (let k = 0; k < p.n; k++) {
    const s = p.tiras[k];
    if (!s) continue;
    if (k > 0) s.tira.style.transform = `rotateY(${p.dir * td}rad)`;
    const l = Math.abs(Math.cos(tt - k * td));
    const sombra = `rgba(72,52,28,${((1 - l) * 0.34).toFixed(3)})`;
    const brillo = `inset 0 0 40px rgba(255,250,238,${(Math.pow(l, 12) * 0.14).toFixed(3)})`;
    s.vidrioA.style.background = sombra;
    s.vidrioB.style.background = sombra;
    s.vidrioA.style.boxShadow = brillo;
    s.vidrioB.style.boxShadow = brillo;
  }
}

/** Arranca decidida y aterriza controlada, que es como cae el papel. */
export const suavizar = (b: number): number =>
  b < 0.5 ? 4 * b * b * b : 1 - Math.pow(-2 * b + 2, 3) / 2;

// ---------------------------------------------------------------------------
// LA LUPA
// ---------------------------------------------------------------------------

export type EstadoLupa = {
  /** Centro del vidrio, en píxeles del escenario. */
  x: number;
  y: number;
  /** Radio del vidrio. */
  r: number;
  /** Adónde se está yendo sola, si la corrieron. */
  destino: { x: number; y: number } | null;
  /** `true` mientras el usuario la tiene agarrada. */
  agarrada: boolean;
};

export type CajaLibro = { x: number; y: number; w: number; h: number };

/** Cuánto agranda el vidrio lo que hay debajo. */
export const AUMENTO = 2.3;

/**
 * COLOCA EL VIDRIO Y LA COPIA MAGNIFICADA.
 *
 * Lo interesante de una lupa no es el vidrio —eso es CSS— sino qué se ve
 * adentro. Debajo del anillo hay una COPIA del libro, hermana del libro y no
 * hija: por eso el vidrio no hereda ninguna transformación de la página, y el
 * cursor le cae 1:1 encima. La copia se recorta con una máscara circular en la
 * posición del vidrio y se escala alrededor del punto de página que el vidrio
 * tapa, así que la lente muestra siempre ×AUMENTO de lo que hay en pantalla.
 *
 * Y EL CASO FEO, que es el que hace que parezca un objeto y no un efecto: al
 * salirse del papel la copia se DESVANECE. Sin eso se ve una lonja de página
 * flotando sobre el escritorio; con eso, se ve vidrio limpio.
 */
export function colocarLupa(
  lupa: HTMLElement,
  copia: HTMLElement,
  interior: HTMLElement,
  estado: EstadoLupa,
  caja: CajaLibro,
): void {
  const { x, y, r } = estado;
  lupa.style.transform = `translate3d(${(x - r).toFixed(1)}px,${(y - r).toFixed(1)}px,0)`;

  // Cuánto entra el centro del vidrio en el papel; negativo si está afuera.
  const x0 = caja.x;
  const x1 = caja.x + caja.w;
  const y0 = caja.y;
  const y1 = caja.y + caja.h;
  const cercaX = Math.max(x0, Math.min(x, x1));
  const cercaY = Math.max(y0, Math.min(y, y1));
  const adentro =
    x > x0 && x < x1 && y > y0 && y < y1
      ? Math.min(x - x0, x1 - x, y - y0, y1 - y)
      : -Math.hypot(x - cercaX, y - cercaY);
  const k = Math.max(0, Math.min(1, (adentro + r * 0.3) / (r * 0.55)));

  copia.style.opacity = k.toFixed(3);
  if (k <= 0.002) return;

  // El bisel come un 5,8% del radio: la máscara es el vidrio, no el anillo.
  const rv = r - r * 2 * 0.058;
  const mascara =
    `radial-gradient(circle ${rv.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px,` +
    `#000 calc(100% - 1px),transparent 100%)`;
  copia.style.webkitMaskImage = mascara;
  copia.style.maskImage = mascara;

  // Escalada alrededor del punto que tapa, para que no se corra al agrandar.
  const s = AUMENTO;
  interior.style.transform =
    `translate(${(x - x * s).toFixed(1)}px,${(y - y * s).toFixed(1)}px) scale(${s})`;
}

/**
 * LA HOJA APARTA A LA LUPA ANTES DE BARRERLA.
 *
 * Si el vidrio está sobre el papel cuando arranca un giro, se le fija un
 * destino en la esquina de abajo y se va solo. Si el usuario la tiene
 * agarrada, no se mueve: la mano gana.
 */
export function apartarLupa(estado: EstadoLupa, caja: CajaLibro, dir: 1 | -1): void {
  if (estado.agarrada) return;
  const nx = (estado.x - caja.x) / caja.w;
  const ny = (estado.y - caja.y) / caja.h;
  // Ya está fuera del papel: no hay nada que apartar.
  if (nx < 0.02 || nx > 0.98 || ny < 0.05 || ny > 0.95) return;
  estado.destino = {
    x: caja.x + caja.w * (dir > 0 ? 0.1 : 0.9),
    y: caja.y + caja.h * 0.88,
  };
}

/** Un paso del easing hacia el destino. Devuelve `true` si todavía se mueve. */
export function acercarLupa(estado: EstadoLupa): boolean {
  if (!estado.destino) return false;
  if (estado.agarrada) {
    estado.destino = null;
    return false;
  }
  const dx = estado.destino.x - estado.x;
  const dy = estado.destino.y - estado.y;
  if (Math.hypot(dx, dy) < 0.5) {
    estado.destino = null;
    return false;
  }
  estado.x += dx * 0.17;
  estado.y += dy * 0.17;
  return true;
}

// ---------------------------------------------------------------------------
// EL RELEVO DE SEIS FASES
// ---------------------------------------------------------------------------

/**
 * CAMBIAR DE VOLUMEN NO ES UN CRUCE.
 *
 * El que estaba sale ANTES de que entre el siguiente, en seis fases explícitas
 * con duraciones fijas. Es la coreografía de complete-shelf
 * (`docs/19-bocetos-biblioteca.md` §4.3, MIT © 2026 Mint), y la razón por la
 * que se ve como un libro y no como un carrusel: un tomo retrocede a un carril
 * despejado ANTES de girar, para no atravesar al vecino al rotar.
 *
 * LA ADAPTACIÓN, Y POR QUÉ NO ES LA MISMA CUENTA.
 *
 * En el original el carril de rotación se calcula del radio barrido por el
 * libro al girar sobre su CENTRO —la media diagonal— y con eso alcanza: es una
 * escena 3D de verdad, y separar en profundidad separa de verdad.
 *
 * Acá el libro gira sobre su LOMO, así que barre el ancho entero de la tapa. La
 * secuencia es la misma que la del original y por el mismo motivo: el tomo sale
 * DERECHO hacia adelante, gira ahí —por delante de los otros, todavía sobre su
 * propia ranura— y recién con la tapa ya de frente se traslada hasta su lugar.
 *
 * El orden importa. Trasladarlo antes de girar lo hace pasar A TRAVÉS de sus
 * vecinos, porque a esa altura sigue casi en el plano del estante; trasladarlo
 * después, desde el carril, lo hace pasar POR DELANTE.
 */
export const FASES = [
  // El viaje horizontal lo cargan la PRIMERA y la ÚLTIMA fase, que son las que
  // ocurren con el tomo ya rotado y adelante. En el original ese recorrido no
  // existe —allá se mueve la estantería entera— así que acá pesan más.
  { nombre: "retrocede-actual", peso: 0.19 },
  { nombre: "gira-actual", peso: 0.13 },
  { nombre: "guarda-actual", peso: 0.1 },
  { nombre: "saca-siguiente", peso: 0.1 },
  { nombre: "gira-siguiente", peso: 0.13 },
  { nombre: "posa-siguiente", peso: 0.19 },
] as const;

const PESO_TOTAL = FASES.reduce((a, f) => a + f.peso, 0);

/** Suavizado de complete-shelf: `smoothstep`, no cúbica. */
const suave = (v: number) => {
  const t = Math.min(1, Math.max(0, v));
  return t * t * (3 - 2 * t);
};

const entre = (a: number, b: number, k: number) => a + (b - a) * k;

export type Pose = { x: number; z: number; yaw: number; escala: number };

export type Geometria = {
  /** Adónde va el tomo cuando está presentado, en x. */
  xPresentado: number;
  /** Cuánto se adelanta para girar sin tocar al vecino. */
  zCarril: number;
  /** Cuánto se adelanta ya presentado. */
  zPresentado: number;
  escalaPresentada: number;
};

export const POSE_GUARDADO: Pose = { x: 0, z: 0, yaw: 90, escala: 1 };

export const posePresentada = (g: Geometria): Pose => ({
  x: g.xPresentado,
  z: g.zPresentado,
  yaw: 0,
  escala: g.escalaPresentada,
});

/**
 * La pose de un tomo en un instante del relevo.
 *
 * `avance` va de 0 a 1 sobre el relevo entero. `rol` dice si este tomo es el
 * que se va, el que llega, o ninguno de los dos —en cuyo caso no se mueve.
 */
export function poseDelRelevo(
  rol: "sale" | "entra" | "quieto",
  avance: number,
  g: Geometria,
): Pose {
  if (rol === "quieto") return POSE_GUARDADO;

  // En qué fase cae este avance, y cuánto lleva recorrido de ella.
  let acumulado = 0;
  let fase = 0;
  let t = 0;
  const total = Math.min(1, Math.max(0, avance)) * PESO_TOTAL;
  for (let i = 0; i < FASES.length; i++) {
    const f = FASES[i]!;
    if (total <= acumulado + f.peso || i === FASES.length - 1) {
      fase = i;
      t = suave((total - acumulado) / f.peso);
      break;
    }
    acumulado += f.peso;
  }

  const presentada = posePresentada(g);

  if (rol === "sale") {
    switch (fase) {
      /*
       * Se despega del estante y RECIÉN DESPUÉS empieza a volver: el `z` se
       * come el primer 40% de la fase y el `x` arranca al 30%. Así el viaje
       * horizontal ocurre con el tomo ya bien adelante, pasando POR DELANTE de
       * los otros y no a través de ellos.
       */
      case 0:
        return {
          x: entre(presentada.x, 0, Math.max(0, (t - 0.3) / 0.7)),
          z: entre(presentada.z, g.zCarril, Math.min(1, t / 0.4)),
          yaw: 0,
          escala: entre(g.escalaPresentada, 1, Math.min(1, t / 0.5)),
        };
      // Gira de tapa a lomo ADELANTE de los libros, ya sobre su propia ranura.
      case 1:
        return { x: 0, z: g.zCarril, yaw: entre(0, 90, t), escala: 1 };
      // Y sólo entonces retrocede a la fila, derecho hacia atrás.
      case 2:
        return { x: 0, z: entre(g.zCarril, 0, t), yaw: 90, escala: 1 };
      default:
        return POSE_GUARDADO;
    }
  }

  // El que entra no se mueve hasta que el otro terminó de guardarse.
  switch (fase) {
    case 0:
    case 1:
    case 2:
      return POSE_GUARDADO;
    // Sale derecho hacia adelante, sin correrse de su ranura.
    case 3:
      return { x: 0, z: entre(0, g.zCarril, t), yaw: 90, escala: 1 };
    // Gira ADELANTE de los libros, todavía sobre su ranura.
    case 4:
      return { x: 0, z: g.zCarril, yaw: entre(90, 0, t), escala: 1 };
    /*
     * Y recién ahora se traslada, YA ROTADO y todavía bien adelante: el `x`
     * usa toda la fase y el `z` no empieza a bajar hasta el 60%, así que el
     * cruce por delante de los otros tomos se hace entero en el carril.
     */
    default:
      return {
        x: entre(0, presentada.x, t),
        z: entre(g.zCarril, presentada.z, Math.max(0, (t - 0.6) / 0.4)),
        yaw: 0,
        escala: entre(1, g.escalaPresentada, Math.max(0, (t - 0.5) / 0.5)),
      };
  }
}

/** La transformación CSS de una pose. */
export const cssDePose = (p: Pose): string =>
  `translateX(${p.x.toFixed(1)}px) translateZ(${p.z.toFixed(1)}px) ` +
  `rotateY(${p.yaw.toFixed(2)}deg) scale(${p.escala.toFixed(4)})`;

// ---------------------------------------------------------------------------
// EL RESORTE DEL ARRASTRE
// ---------------------------------------------------------------------------

/**
 * Soltar una hoja no es un tween: es un resorte.
 *
 * `v += (−k·x − c·v)·dt`, con `dt` recortado a 32 ms para que volver de una
 * pestaña en segundo plano no produzca un salto. Comprometer la hoja usa un
 * resorte más duro que cancelarla, porque una hoja que se termina de dar
 * vuelta cae, y una que vuelve se acomoda (`19-bocetos-biblioteca.md` §2.3).
 */
export const RESORTE_COMPROMISO = { k: 170, c: 26 };
export const RESORTE_CANCELA = { k: 150, c: 24 };

export type Resorte = { t: number; v: number; destino: number; k: number; c: number };

/** Un paso del resorte. Devuelve `true` mientras siga valiendo la pena moverse. */
export function pasoResorte(r: Resorte, dtSegundos: number): boolean {
  const dt = Math.min(0.032, dtSegundos);
  const x = r.t - r.destino;
  r.v += (-r.k * x - r.c * r.v) * dt;
  r.t += r.v * dt;
  if (Math.abs(r.t - r.destino) < 0.001 && Math.abs(r.v) < 0.02) {
    r.t = r.destino;
    r.v = 0;
    return false;
  }
  return true;
}

/** Los umbrales del arrastre, tal como los enseña Sketchbook (§2.4). */
export const ARRASTRE = {
  /** Menos que esto es un toque, no un arrastre. */
  minimoPx: 6,
  /** Cuánto del ancho de la hoja equivale a un giro entero. */
  recorrido: 0.62,
  /** Pasado este punto la hoja se compromete sola. */
  compromiso: 0.42,
  /** O si se la tiró con esta velocidad, aunque no haya llegado. */
  velocidad: 1.1,
} as const;
