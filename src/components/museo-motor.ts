/**
 * EL MOTOR DEL MUSEO: la sala, el paseo y la física de los telones.
 *
 * Sin React adentro, igual que `biblioteca-motor.ts` y por la misma razón: acá
 * vive todo lo que cambia cuadro a cuadro —sesenta veces por segundo— y React
 * sólo tiene que saber si la sección está andando y qué obra se está mirando.
 * Un `setState` por frame con nueve telones de 12×16 partículas sería un
 * re-render por partícula.
 *
 * POR QUE THREE Y NO EL REPO DE INSPIRACION (D-162). El export de arrival.space
 * que sirvió de referencia depende de PlayCanvas, de Ammo.js y de
 * `gl.texElementImage2D` —una API que en agosto de 2026 sigue en origin trial y
 * que sólo Chrome implementa—. Esa API existe para poner HTML VIVO en una
 * textura; acá los telones muestran cuadros, que son imágenes. Con una textura
 * común esto anda en todos los navegadores.
 *
 * Y LA TELA ES PROPIA, no Ammo. Los 398 KB comprimidos de Ammo son cuatro veces
 * el motor entero de Three, para resolver un problema que un Verlet de ciento
 * y pico de líneas resuelve: una malla de partículas, una restricción de
 * distancia por arista, y unas cuantas pasadas de relajación. Es la misma
 * decisión que el pliegue de la biblioteca, que tampoco importó un motor.
 */

import * as THREE from "three";
import { texturaMarmol, texturaPared, texturaYeso } from "./museo-materiales.js";

/** Una obra colgada de su barral. */
export type ObraMuseo = {
  slug: string;
  /** Ruta de la textura, ya optimizada, dentro de `public/`. */
  url: string;
  /** Ancho / alto del archivo. Manda la forma del telón. */
  ratio: number;
  /** Lo que lee un lector de pantalla, y lo que se muestra al enfocar. */
  titulo: string;
  nota: string;
};

export type OpcionesMuseo = {
  lienzo: HTMLCanvasElement;
  obras: ObraMuseo[];
  /** Se llama cuando cambia la obra que el visitante tiene delante. */
  alEnfocar: (i: number | null) => void;
  /** Se llama cuando el puntero se suelta, para que React saque el overlay. */
  alSoltarPuntero: () => void;
  /** Progreso de carga de texturas, 0..1. */
  alCargar: (t: number) => void;
};

/* ---- Las medidas de la sala, en metros ---------------------------------- */

/** Separación entre un telón y el siguiente, a lo largo del pasillo. */
const PASO = 7;
/** Lo que se aparta cada telón del eje del pasillo. */
const RETIRO = 2.9;
/** Alto del telón. El ancho sale de la proporción de cada cuadro. */
const ALTO_TELON = 3.6;
/** A qué altura cuelga el barral. */
const ALTURA_BARRAL = 4.1;
/** Altura de los ojos. Una persona de pie. */
const ALTURA_OJOS = 1.62;

/**
 * Partículas por telón. Con los telones dormidos (ver `Telon.dormido`) hay a lo
 * sumo uno simulándose a la vez, así que la malla puede ser bastante más densa
 * que antes sin costo: lo que se paga es el paño que uno está tocando, no los
 * nueve. El repositorio de referencia usa 24×30 por la misma razón.
 */
const MALLA_X = 20;
const MALLA_Y = 26;
/** Pasadas de relajación por paso. Más pasadas, tela más tensa. */
const RELAJACIONES = 5;

/**
 * RIGIDEZ POR FAMILIA DE ARISTA.
 *
 * Las tres familias no tiran con la misma fuerza: las de estructura sostienen
 * el tamaño del paño, las diagonales impiden que el cuadrado colapse, y las de
 * flexión —el vecino a dos celdas— son las que deciden cuánto se resiste a
 * doblarse.
 *
 * Subieron de 1 / 0,6 / 0,15 a 1 / 0,85 / 0,35 (D-164). El repositorio de
 * referencia usa `kLST = kAST = 0,9` con ocho iteraciones: una tela CASI
 * inextensible, que es lo que hace falta para que cuelgue tensa y lisa.
 */
const RIGIDEZ = { estructura: 1, corte: 0.85, flexion: 0.35 } as const;

/**
 * ROZAMIENTO DEL AIRE. Estaba en 0,992 —casi nada— porque con viento constante
 * la tela tenía que seguir ondeando. Sin viento, lo que importa es lo contrario:
 * que después de un empujón el paño **frene** y vuelva a quedar quieto, y para
 * eso el movimiento tiene que morirse en cosa de un segundo.
 */
const AMORTIGUACION = 0.975;

/**
 * MEMORIA DE FORMA: un tirón flojísimo de cada partícula hacia su posición de
 * reposo, cada paso.
 *
 * La tensión sola casi alcanza —un paño colgado y estirado vuelve a su forma
 * porque cualquier desvío alarga sus aristas— pero «casi» deja pliegues
 * biestables: una arruga que se acomodó no tiene por qué desarmarse. Este
 * término garantiza que el telón SIEMPRE termine exactamente como empezó, que
 * es lo que pasa con un telón real colgado de su barra.
 *
 * 0,014 por paso es una constante de tiempo de algo más de un segundo: no
 * pelea con el empujón del visitante, que es un orden de magnitud más fuerte.
 */
const MEMORIA = 0.014;

/**
 * CUANDO SE DUERME UN TELON.
 *
 * Un telón que nadie toca no debe simularse: no porque cueste, sino porque
 * mientras se simula **nunca está del todo quieto** —siempre queda una
 * vibración de décimas de milímetro— y eso es exactamente lo que se veía como
 * una tela temblando sola. Por debajo de este umbral de velocidad, y después de
 * `CUADROS_QUIETOS` cuadros seguidos, el paño se calca sobre su reposo y deja
 * de correr. Queda quieto de verdad, no casi quieto.
 */
const UMBRAL_SUENO = 1e-8;
const CUADROS_QUIETOS = 24;

/** Paso fijo de física. Un paso variable hace explotar un Verlet. */
const DT = 1 / 60;

/**
 * VELOCIDAD DE CAMINATA. Bajó de 3,4 a 2 m/s (D-166).
 *
 * 3,4 no es caminar, es trotar — y el pedido fue explícito: el personaje no
 * corre. Además el modelo trae un solo clip de caminata: a 3,4 m/s hay que
 * acelerarlo tanto que los pies patinan igual. Dos metros por segundo es un
 * paso vivo de museo.
 */
const VELOCIDAD = 2;
/**
 * VELOCIDAD DE CORRER (D-167). El pedido fue activar `Shift`, no elegir un
 * número: 4,3 m/s es un trote controlado, más rápido que caminar pero que
 * sigue dejando leer las cartelas al pasar corriendo delante de un telón.
 */
const VELOCIDAD_CORRER = 4.3;

/** Alto del personaje. El modelo se escala a esto, se mida como se mida. */
const ALTURA_PERSONA = 1.78;
/**
 * CUANTO AVANZA UNA PERSONA EN UN CICLO COMPLETO DE CADA CLIP.
 *
 * Es lo que sincroniza la animación con el traslado, y **está medido, no
 * supuesto**: es lo único de esta sección que no se puede juzgar a ojo. Con el
 * personaje caminando se muestreó la posición mundial del hueso `FootL` cuadro
 * a cuadro y se sumó su desplazamiento durante el apoyo, que es cuando el pie
 * debería estar **quieto contra el mármol**. Ver D-166 para el método completo
 * y por qué no alcanza con promediar velocidades por cuadro.
 *
 * Con 1,62 el pie apoyado se iba 3 cm hacia atrás mientras el cuerpo avanzaba
 * 80 — un 3,8% de patinada. 1,68 es ese número corregido para `Walk`.
 *
 * `Run` es un clip distinto —zancada más larga, más aérea— y se midió aparte
 * con el mismo método, corriendo con `Shift` sostenido (D-167).
 */
const PASO_DEL_CLIP = 1.68;
const PASO_DEL_CLIP_CORRER = 2.35;
/** Cuánto tarda la velocidad en llegar y en irse. Sin esto, se patina. */
const SUAVIZADO = 9;
/** Radio del visitante, para no atravesar los telones ni salirse del piso. */
const RADIO_VISITANTE = 0.45;
/**
 * Radio del cuerpo CONTRA LA TELA, que no es el mismo que contra las paredes.
 * El de referencia usa una cápsula de 0,2 m de radio y 2,4 de alto para el
 * jugador. Con los 0,63 que usaba antes el telón se abría como un portón mucho
 * antes de que el cuerpo llegara a tocarlo; con 0,34 —medio ancho de hombros más
 * la ropa— el paño se mueve cuando el hombro llega, y no un metro antes.
 */
const RADIO_CUERPO = 0.3;


/**
 * ROZAMIENTO ENTRE LA TELA Y EL CUERPO, y es lo que faltaba para que el paño
 * se **adapte** en vez de resbalar.
 *
 * Sin rozamiento una tela empujada se corre y vuelve: el cuerpo la atraviesa
 * como una puerta de vaivén. Con rozamiento el paño **se agarra** de lo que lo
 * toca y viaja con él — se estira sobre el hombro, se arrastra, y se suelta
 * cuando el cuerpo sale. Es la diferencia entre apartar una cortina y meterse
 * adentro de ella.
 *
 * Está en toda la bibliografía del tema y el repositorio de referencia lo trae
 * como `kDF = 0,8` sobre la tela entera. Acá se aplica sólo en el contacto: se
 * mezcla la velocidad tangencial de la partícula con la del cuerpo. 0 es hielo,
 * 1 es pegamento.
 */
const ROCE_CUERPO = 0.55;

/* ---- La cámara de tercera persona ---------------------------------------
 *
 * Deja de haber un ojo flotante: la cámara orbita al personaje, que es quien
 * camina. Es lo que pide poder atravesar los telones — de frente, el ojo
 * termina adentro del paño y no se ve nada; desde atrás se ve exactamente lo
 * que hay que ver, que es la tela envolviendo a alguien.
 */
/** A qué distancia va la cámara por detrás del personaje. */
const CAMARA_ATRAS = 3.2;
/** Corrimiento a la derecha. Una cámara al hombro deja ver hacia dónde se va;
 *  una centrada pone la nuca justo encima de lo que uno quiere mirar. */
const CAMARA_LADO = 0.5;
/** Altura del punto al que apunta: el pecho, no los pies ni la cabeza. */
const CAMARA_MIRA = 1.32;
/** Lo más cerca que puede quedar si algo la empuja hacia adelante. */
const CAMARA_MINIMA = 0.85;

/**
 * Distancia a la que una obra se considera «la que estoy mirando».
 *
 * Estaba en 5,2 y medido en el navegador quedaba justo afuera: a 5,15 m el
 * telón ya ocupa media pantalla y la cartela todavía no había aparecido. Una
 * ficha de museo se lee al acercarse, no al quedar pegado al cuadro.
 */
const DISTANCIA_ENFOQUE = 7.5;

/**
 * UNA TELA VERLET.
 *
 * Cada partícula guarda dónde está y dónde estaba; la velocidad es la
 * diferencia entre las dos, y por eso no hace falta guardarla ni integrarla.
 * Eso es lo que vuelve a Verlet estable donde un Euler explota: una restricción
 * que mueve una partícula corrige su velocidad sola, sin que nadie la toque.
 *
 * TODA la fila de arriba está fija: el paño va clavado al barral en todo su
 * ancho, no colgado de anillas. Ver el bloque grande de `dormido`.
 */
class Telon {
  pos: Float32Array;
  prev: Float32Array;
  /** La forma exacta en la que el paño queda cuando nadie lo toca. */
  reposo: Float32Array;
  fija: Uint8Array;
  /** Cada arista: índice a, índice b, largo de reposo y cuánto tira. */
  aristas: { a: number; b: number; largo: number; k: number }[] = [];
  geom: THREE.BufferGeometry;
  malla: THREE.Mesh;
  ancho: number;
  alto: number;

  /**
   * EL TELON ARRANCA DORMIDO, Y ESO ES TODA LA DIFERENCIA (D-164).
   *
   * D-163 le había dado al paño un 12% de holgura sobre sus anillas para que
   * hiciera pliegues. Estaba mal, y el repositorio de referencia lo dice sin
   * ambigüedad: `appendAnchor` se llama para CADA punto del borde de arriba
   * —el paño va clavado al barral en todo su ancho, sin holgura ninguna—, la
   * rigidez es 0,9 sobre 1, y no hay una sola fuerza de viento en las 1.868
   * líneas. Ese telón cuelga tenso, liso y quieto.
   *
   * Y quieto de verdad, que es lo que no se consigue simplemente simulando
   * bien: una tela en simulación permanente siempre conserva un temblor de
   * décimas de milímetro, y a nueve telones eso es una sala entera vibrando.
   * Así que un telón que nadie toca no se simula. Duerme sobre su forma de
   * reposo, se despierta cuando el cuerpo del visitante entra en su caja, y
   * cuando el movimiento se apaga vuelve a calcarse sobre el reposo y se
   * duerme otra vez.
   *
   * Es, además, el comportamiento correcto: un telón grande está inmóvil hasta
   * que alguien lo toca.
   */
  dormido = true;
  /** Cuadros seguidos por debajo del umbral. Ver `CUADROS_QUIETOS`. */
  private quietos = 0;

  constructor(ancho: number, alto: number, material: THREE.Material) {
    this.ancho = ancho;
    this.alto = alto;
    const n = MALLA_X * MALLA_Y;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.fija = new Uint8Array(n);

    const dx = ancho / (MALLA_X - 1);
    const dy = alto / (MALLA_Y - 1);
    const uv = new Float32Array(n * 2);

    /*
     * EL ERROR DE CLAVADO, de cuatro milímetros.
     *
     * Es lo único que separa un telón de una chapa pintada. El repositorio de
     * referencia hace exactamente esto y lo comenta igual: mueve cada anclaje
     * del borde superior ±5 mm al azar «para que la tela caiga más natural en
     * vez de perfectamente plana». Nadie clava un paño de tres metros con
     * precisión de micras, y esa imperfección mínima se propaga hacia abajo
     * como una ondulación que no se lee como arruga pero saca al plano de su
     * perfección de render.
     *
     * Va con una función determinista y no con `Math.random`: la misma sala en
     * cada visita, igual que el mármol.
     */
    const error = (x: number) => (Math.sin(x * 127.1 + 311.7) * 43758.5453) % 1;

    for (let y = 0; y < MALLA_Y; y++) {
      for (let x = 0; x < MALLA_X; x++) {
        const i = y * MALLA_X + x;
        const clavado = y === 0;
        const px = -ancho / 2 + x * dx + (clavado ? error(x) * 0.004 : 0);
        const py = -y * dy;
        const pz = clavado ? error(x + 17) * 0.004 : 0;
        this.pos[i * 3] = px;
        this.pos[i * 3 + 1] = py;
        this.pos[i * 3 + 2] = pz;
        this.prev[i * 3] = px;
        this.prev[i * 3 + 1] = py;
        this.prev[i * 3 + 2] = pz;
        // TODA la fila de arriba, sin anillas: ver el comentario de `dormido`.
        if (clavado) this.fija[i] = 1;
        uv[i * 2] = x / (MALLA_X - 1);
        uv[i * 2 + 1] = 1 - y / (MALLA_Y - 1);
      }
    }

    /*
     * TRES FAMILIAS DE ARISTAS, y las tres hacen falta.
     *   estructura  vecinos en cruz: sostienen el largo y el ancho.
     *   corte       las diagonales: sin ellas la tela se pliega como un
     *               acordeón porque un cuadrado sin diagonal no tiene forma.
     *   flexión     el vecino a dos casilleros: es lo que impide que se
     *               arrugue sobre sí misma en pliegues de una sola celda.
     */
    const unir = (a: number, b: number, k: number) => {
      const dxx = this.pos[a * 3]! - this.pos[b * 3]!;
      const dyy = this.pos[a * 3 + 1]! - this.pos[b * 3 + 1]!;
      const dzz = this.pos[a * 3 + 2]! - this.pos[b * 3 + 2]!;
      this.aristas.push({ a, b, largo: Math.hypot(dxx, dyy, dzz), k });
    };
    for (let y = 0; y < MALLA_Y; y++) {
      for (let x = 0; x < MALLA_X; x++) {
        const i = y * MALLA_X + x;
        if (x + 1 < MALLA_X) unir(i, i + 1, RIGIDEZ.estructura);
        if (y + 1 < MALLA_Y) unir(i, i + MALLA_X, RIGIDEZ.estructura);
        if (x + 1 < MALLA_X && y + 1 < MALLA_Y) {
          unir(i, i + MALLA_X + 1, RIGIDEZ.corte);
          unir(i + 1, i + MALLA_X, RIGIDEZ.corte);
        }
        if (x + 2 < MALLA_X) unir(i, i + 2, RIGIDEZ.flexion);
        if (y + 2 < MALLA_Y) unir(i, i + 2 * MALLA_X, RIGIDEZ.flexion);
      }
    }

    const indices: number[] = [];
    for (let y = 0; y < MALLA_Y - 1; y++) {
      for (let x = 0; x < MALLA_X - 1; x++) {
        const i = y * MALLA_X + x;
        indices.push(i, i + MALLA_X, i + 1, i + 1, i + MALLA_X, i + MALLA_X + 1);
      }
    }

    this.geom = new THREE.BufferGeometry();
    this.geom.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    this.geom.setIndex(indices);

    /*
     * SE DEJA CAER ANTES DE MOSTRARLO, y el resultado es la forma de reposo.
     *
     * El paño arranca geométricamente plano, pero su forma en reposo no es esa:
     * su propio peso estira apenas las aristas verticales y el error de clavado
     * se propaga. Si el reposo fuera el plano teórico, cada vez que el telón se
     * duerme daría un salto de un par de milímetros al calcarse encima.
     *
     * Así que se lo cuelga y se lo deja asentar acá mismo, noventa pasos con el
     * visitante afuera, y **lo que queda es el reposo**. A partir de ahí el
     * telón se ve exactamente igual dormido que simulando, y dormirse no se
     * nota. Son unos pocos milisegundos por telón, una sola vez.
     */
    this.reposo = this.pos.slice();
    for (let i = 0; i < 120; i++) this.simular(null, null);
    this.reposo.set(this.pos);

    this.geom.computeVertexNormals();
    this.malla = new THREE.Mesh(this.geom, material);
    this.malla.castShadow = true;
    this.malla.receiveShadow = true;
  }

  /**
   * ¿El cuerpo del visitante llega a tocar este paño?
   *
   * Es la prueba que despierta al telón, y tiene que ser barata porque corre
   * para los nueve en cada cuadro: la caja del paño en coordenadas locales,
   * agrandada por el radio del cuerpo. Un telón dormido no paga nada más.
   */
  alcanzable(local: THREE.Vector3) {
    const m = RADIO_CUERPO + 0.25;
    // `local` son los PIES del visitante; el cuerpo sube desde ahí. La caja
    // del paño va de y = 0 (el barral) a y = −alto.
    return (
      Math.abs(local.x) < this.ancho / 2 + m &&
      Math.abs(local.z) < m &&
      local.y + ALTURA_OJOS > -this.alto - m &&
      local.y < m
    );
  }

  /** Calca el reposo y deja de simular. Ver el comentario de `dormido`. */
  private dormirse() {
    this.pos.set(this.reposo);
    this.prev.set(this.reposo);
    this.geom.attributes.position!.needsUpdate = true;
    this.geom.computeVertexNormals();
    this.dormido = true;
    this.quietos = 0;
  }

  /**
   * UN CUADRO DE ESTE TELON, con el despertar y el dormirse alrededor.
   *
   * `visitante` es la posición del que camina en coordenadas locales del telón,
   * o `null` si está lejos. Devuelve si el paño se movió, que es lo que el
   * bucle usa para no recalcularle las normales a una tela quieta.
   */
  paso(visitante: THREE.Vector3 | null, arrastre: THREE.Vector3 | null): boolean {
    const tocando = visitante !== null && this.alcanzable(visitante);
    if (this.dormido) {
      // Dormido no cuesta absolutamente nada hasta que alguien lo roza.
      if (!tocando) return false;
      this.dormido = false;
      this.quietos = 0;
    }

    const v2 = this.simular(visitante, arrastre);

    if (tocando || v2 >= UMBRAL_SUENO) {
      this.quietos = 0;
    } else if (++this.quietos >= CUADROS_QUIETOS) {
      this.dormirse();
    }
    return true;
  }

  /**
   * Un paso de física. Devuelve la mayor velocidad al cuadrado que quedó, que
   * es con lo que se decide si el paño ya se aquietó.
   *
   * NO HAY VIENTO, y es a propósito. Lo había hasta D-163 y es lo que hacía que
   * los telones se movieran solos todo el tiempo. Adentro de un museo no corre
   * aire, y el repositorio de referencia —que es el que se ve bien— no aplica
   * una sola fuerza ambiente: lo único que deforma su tela es el cuerpo del
   * visitante y el clic del mouse.
   */
  private simular(visitante: THREE.Vector3 | null, arrastre: THREE.Vector3 | null): number {
    const n = MALLA_X * MALLA_Y;
    const p = this.pos, q = this.prev;

    for (let i = 0; i < n; i++) {
      if (this.fija[i]) continue;
      const k = i * 3;

      const vx = (p[k]! - q[k]!) * AMORTIGUACION;
      const vy = (p[k + 1]! - q[k + 1]!) * AMORTIGUACION;
      const vz = (p[k + 2]! - q[k + 2]!) * AMORTIGUACION;

      q[k] = p[k]!;
      q[k + 1] = p[k + 1]!;
      q[k + 2] = p[k + 2]!;

      p[k] = p[k]! + vx;
      p[k + 1] = p[k + 1]! + vy - 9.81 * DT * DT;
      p[k + 2] = p[k + 2]! + vz;
    }

    for (let r = 0; r < RELAJACIONES; r++) {
      for (const e of this.aristas) {
        const ka = e.a * 3, kb = e.b * 3;
        const dx = p[kb]! - p[ka]!;
        const dy = p[kb + 1]! - p[ka + 1]!;
        const dz = p[kb + 2]! - p[ka + 2]!;
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        // La mitad de la corrección a cada punta, salvo que una esté fija.
        const corr = ((d - e.largo) / d) * 0.5 * e.k;
        const fa = this.fija[e.a] ? 0 : this.fija[e.b] ? 1 : 0.5;
        const fb = this.fija[e.b] ? 0 : this.fija[e.a] ? 1 : 0.5;
        p[ka] = p[ka]! + dx * corr * 2 * fa;
        p[ka + 1] = p[ka + 1]! + dy * corr * 2 * fa;
        p[ka + 2] = p[ka + 2]! + dz * corr * 2 * fa;
        p[kb] = p[kb]! - dx * corr * 2 * fb;
        p[kb + 1] = p[kb + 1]! - dy * corr * 2 * fb;
        p[kb + 2] = p[kb + 2]! - dz * corr * 2 * fb;
      }

      /*
       * EL VISITANTE ES UNA CAPSULA, NO UN DISCO.
       *
       * La primera versión empujaba sólo dentro de ±1,1 m de la altura de los
       * ojos, así que la tela se abría a la altura del pecho y seguía derecha
       * arriba y abajo: se veía un agujero, no un cuerpo pasando. Una cápsula
       * —un cilindro con las puntas redondeadas— es la forma con la que
       * cualquier motor representa a una persona, y cuesta lo mismo: se acota
       * la altura al segmento del eje y se mide la distancia a ese punto.
       *
       * El empuje se aplica también a `prev`, y eso importa: en Verlet la
       * velocidad ES la diferencia entre `pos` y `prev`, así que mover sólo
       * `pos` inventa una velocidad enorme y la tela salta. Moviendo las dos,
       * la tela se aparta sin recibir un golpe.
       */
      if (visitante) {
        const r2 = RADIO_CUERPO;
        // El eje de la cápsula va de los tobillos a la coronilla. `visitante`
        // llega con los pies en el piso, no con los ojos: desde D-165 el que
        // camina es el personaje, y el paño lo toca de arriba abajo.
        const yPies = visitante.y + 0.14;
        const yCabeza = visitante.y + ALTURA_OJOS;
        for (let i = 0; i < n; i++) {
          if (this.fija[i]) continue;
          const k = i * 3;
          const yEje = Math.max(yPies, Math.min(yCabeza, p[k + 1]!));
          const dx = p[k]! - visitante.x;
          const dy = p[k + 1]! - yEje;
          const dz = p[k + 2]! - visitante.z;
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          if (d >= r2) continue;

          /*
           * PRIMERO SE SACA LA PARTICULA, POR EL CAMINO MAS CORTO.
           *
           * Es lo que hace que la tela ENVUELVA en vez de agujerearse: cada
           * partícula se va al punto más cercano de la superficie de la
           * cápsula, así que el paño termina calcando la forma del cuerpo.
           * Cuanto más adentro está el cuerpo, más lo abraza.
           */
          const nx = dx / d, ny = dy / d, nz = dz / d;
          const fuera = r2 - d;
          const px = p[k]! + nx * fuera;
          const py = p[k + 1]! + ny * fuera;
          const pz = p[k + 2]! + nz * fuera;

          /*
           * Y DESPUES EL ROZAMIENTO, que es lo que decide si el paño se
           * arrastra o resbala. Ver `ROCE_CUERPO`.
           *
           * En Verlet la velocidad no se guarda: ES `pos − prev`. Así que
           * imponer una velocidad se hace escribiendo `prev`, y eso permite
           * hacer las tres cosas de una: sacar la componente que empuja hacia
           * adentro del cuerpo, frenar la tangencial, y mezclarla con la del
           * cuerpo para que la tela lo acompañe.
           */
          const vx = p[k]! - q[k]!;
          const vy = p[k + 1]! - q[k + 1]!;
          const vz = p[k + 2]! - q[k + 2]!;
          const vn = vx * nx + vy * ny + vz * nz;
          // Sólo se corrige la parte que entra: la que sale ya está bien.
          const dentro = Math.min(0, vn);
          const tx = vx - vn * nx + dentro * nx;
          const ty = vy - vn * ny + dentro * ny;
          const tz = vz - vn * nz + dentro * nz;
          const ax = arrastre ? arrastre.x : 0;
          const az = arrastre ? arrastre.z : 0;

          p[k] = px;
          p[k + 1] = py;
          p[k + 2] = pz;
          q[k] = px - (tx + (ax - tx) * ROCE_CUERPO);
          q[k + 1] = py - ty * (1 - ROCE_CUERPO * 0.5);
          q[k + 2] = pz - (tz + (az - tz) * ROCE_CUERPO);
        }
      }
    }

    /*
     * LA MEMORIA DE FORMA Y LA MEDIDA DE QUIETUD, en la misma pasada.
     *
     * El tirón hacia el reposo va acá, después de las restricciones: si fuera
     * antes, la relajación lo desharía. Y como se mueve `pos` y no `prev`, lo
     * que se le está dando a la partícula es velocidad hacia su lugar —un
     * resorte flojo— y no un teletransporte.
     */
    let peor = 0;
    for (let i = 0; i < n; i++) {
      if (this.fija[i]) continue;
      const k = i * 3;
      p[k] = p[k]! + (this.reposo[k]! - p[k]!) * MEMORIA;
      p[k + 1] = p[k + 1]! + (this.reposo[k + 1]! - p[k + 1]!) * MEMORIA;
      p[k + 2] = p[k + 2]! + (this.reposo[k + 2]! - p[k + 2]!) * MEMORIA;

      const vx = p[k]! - q[k]!;
      const vy = p[k + 1]! - q[k + 1]!;
      const vz = p[k + 2]! - q[k + 2]!;
      const v2 = vx * vx + vy * vy + vz * vz;
      if (v2 > peor) peor = v2;
    }

    this.geom.attributes.position!.needsUpdate = true;
    return peor;
  }

  /**
   * LAS NORMALES SE RECALCULAN UNA VEZ POR CUADRO, NO UNA POR PASO DE FISICA.
   *
   * Estaban adentro de `paso()`, y como el bucle da hasta cuatro pasos de
   * física por cuadro para no depender de los hercios de la pantalla, eso eran
   * cuatro recorridas de 330 triángulos por telón y por cuadro. Con tres
   * telones cerca, doce recorridas para doce imágenes idénticas: lo único que
   * se ve es la última. La primera corrida contra el navegador congeló la
   * pestaña.
   *
   * Es exactamente el mismo error que el pliegue de la biblioteca evita desde
   * D-154: lo que se DIBUJA se hace una vez por cuadro, lo que se SIMULA se
   * hace tantas veces como haga falta, y las dos cosas no van en el mismo
   * bucle.
   */
  refrescarNormales() {
    this.geom.computeVertexNormals();
  }
}

/**
 * BAJA EL BRILLO DEL MODELO DESCARGADO (D-167).
 *
 * El GLB del visitante viene con `metalness` en 0,4 sobre CUALQUIER material,
 * piel y tela incluidas. Con los focos de la sala en 130 de intensidad eso se
 * ve de plástico — el mismo motivo por el que el mármol del piso, más abajo en
 * este archivo, lleva `metalness` apenas 0,06 y no más.
 *
 * Nada en una galería es metal salvo los herrajes, así que se pisa el valor
 * después de cargar en vez de confiar en lo que trajo el archivo.
 *
 * Sigue siendo una función suelta y no dos líneas adentro de la carga porque
 * llegó a aplicarse a tres modelos (había un sombrero y un sillón, D-167 a
 * D-171) y el día que se agregue otro va a hacer falta igual.
 */
function desplasticar(raiz: THREE.Object3D) {
  raiz.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (typeof std.metalness === "number") std.metalness = Math.min(std.metalness, 0.06);
      if (typeof std.roughness === "number") std.roughness = Math.max(std.roughness, 0.82);
    }
  });
}

export type Museo = {
  /** Arranca el bucle. */
  andar: () => void;
  /** Lo para sin destruir nada: la pestaña se fue de la sección. */
  parar: () => void;
  /** Pide el bloqueo de puntero, que es lo que permite mirar con el mouse. */
  tomarPuntero: () => void;
  redimensionar: () => void;
  destruir: () => void;
};

/**
 * ARMA LA SALA ENTERA Y DEVUELVE LOS CUATRO BOTONES QUE REACT NECESITA.
 *
 * Todo lo de adentro —cámara, luces, telones, teclado, bucle— es privado a
 * propósito: la única superficie que cruza a React son estas cuatro funciones y
 * los tres callbacks de las opciones.
 */
export function construirMuseo(o: OpcionesMuseo): Museo {
  const { lienzo, obras } = o;

  const render = new THREE.WebGLRenderer({
    canvas: lienzo,
    antialias: true,
    powerPreference: "high-performance",
  });
  render.setPixelRatio(Math.min(devicePixelRatio, 2));
  render.shadowMap.enabled = true;
  render.shadowMap.type = THREE.PCFShadowMap;
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.18;

  const escena = new THREE.Scene();
  // El fondo y la niebla comparten el azul de las paredes: el pasillo no
  // termina en un borde, se pierde en el mismo color que lo rodea.
  escena.background = new THREE.Color(0x2d3540);
  /*
   * La niebla es lo que hace que la sala se sienta grande sin construirla.
   * Del mismo color que el fondo, así que el pasillo no termina en un borde:
   * se desvanece. Sin esto se ve el final del piso y la ilusión se corta.
   */
  /*
   * La niebla ya no está para tapar el final del pasillo —ahora hay una pared
   * de fondo— sino para lo que hace la niebla en una sala grande de verdad:
   * despegar lo que está lejos de lo que está cerca. Del color de la pared
   * iluminada y no más oscura, que era lo que hacía ver el fondo como un pozo.
   */
  escena.fog = new THREE.Fog(0x39434f, 26, 90);

  const camara = new THREE.PerspectiveCamera(62, 1, 0.1, 120);

  /* ---- Luz --------------------------------------------------------------
     Un museo es luz difusa y pareja. Una hemisférica hace el ambiente, una
     direccional suave da la sombra que apoya los telones en el piso, y sin
     una tercera de relleno los reversos quedaban negros. */
  /*
   * LA LUZ DE UNA GALERIA VIENE DE ARRIBA, Y ESO CAMBIA TODO.
   *
   * Con paredes blancas alcanzaba una hemisférica fuerte y listo. Con el azul
   * del Prado, ese mismo esquema deja una sala plana y apagada: el azul se
   * come la luz rebotada y los cuadros pierden el contraste que el color de
   * pared existía para darles.
   *
   * El reparto es el de un museo real:
   *   AMBIENTE   una hemisférica floja, con el cielo cálido de las claraboyas
   *              y el rebote frío del piso de mármol. Da el relleno y nada más.
   *   CENITAL    la direccional, casi vertical, que baja de las claraboyas y
   *              es la que proyecta las sombras.
   *   FOCOS      un `SpotLight` por obra, apuntando al telón. Es exactamente
   *              lo que hay en la sala de un museo, y es lo que hace que el
   *              cuadro salte del fondo en vez de quedar sumergido.
   */
  escena.add(new THREE.HemisphereLight(0xfff2dd, 0x7d8794, 1.9));
  /*
   * LA SOMBRA VIAJA CON EL VISITANTE, y no es una optimización: es la única
   * manera de que exista. Una sala de casi 120 metros de largo con un solo mapa
   * de sombras fijo reparte 1024 píxeles sobre todo eso — se ve el rectángulo
   * donde el mapa alcanza y el borde donde deja de alcanzar, que fue lo primero
   * que apareció en el piso. Moviendo la luz y su objetivo con la cámara, esos
   * mismos 1024 píxeles cubren 28 metros alrededor de quien mira, que es lo
   * único que se ve.
   */
  const sol = new THREE.DirectionalLight(0xfff6e8, 2.1);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.near = 1;
  sol.shadow.camera.far = 46;
  const s = 14;
  sol.shadow.camera.left = -s;
  sol.shadow.camera.right = s;
  sol.shadow.camera.top = s;
  sol.shadow.camera.bottom = -s;
  sol.shadow.bias = -0.0015;
  sol.shadow.normalBias = 0.02;
  escena.add(sol);
  escena.add(sol.target);
  // El rebote del piso: sube y aclara los reversos de los telones, que si no
  // quedan negros cuando se los mira desde el otro lado.
  const rebote = new THREE.DirectionalLight(0xe8eef5, 0.55);
  rebote.position.set(0, -4, 0);
  escena.add(rebote);

  /*
   * EL PISO MINIMO DE LUZ. Con la cenital casi vertical, una pared vertical no
   * recibe casi nada y de cerca salía negra — el azul del Prado desaparecía
   * justo donde más se lo mira. Una ambiente floja garantiza que ninguna
   * superficie caiga a cero sin lavar el contraste que dan los focos.
   */
  escena.add(new THREE.AmbientLight(0xdfe6ef, 0.55));

  /* ---- La sala ----------------------------------------------------------
   *
   * DE UNA CAJA BLANCA A UNA GALERIA (D-163).
   *
   * La primera versión eran cuatro planos del mismo blanco. Se leía como sala
   * —había suelo, techo y paredes— pero como sala vacía de render, no como
   * museo. Lo que faltaba no era detalle: era que cada superficie fuera de un
   * material distinto y que hubiera arquitectura entre ellas.
   *
   * Lo que hay ahora, y de dónde sale cada cosa:
   *
   *   PISO      damero de mármol. Es lo que hay en el piso de casi cualquier
   *             galería del XIX, y las juntas son además lo que le da escala a
   *             la sala mientras se camina: sin una retícula en el suelo, la
   *             velocidad de caminata no se percibe.
   *   PAREDES   azul del Prado, `#414D59` (NCS S7010-R90B), el que la Galería
   *             Central estrenó después de probarlo en la muestra del Greco.
   *             No es decorativo: un cuadro oscuro sobre pared blanca pierde
   *             todo su contraste, y por eso los museos que cuelgan pintura
   *             antigua pintan las salas de azul, granate o verde profundo.
   *   TECHO     yeso blanco con vigas cruzadas y tres claraboyas. La luz de
   *             una galería viene de arriba, y una claraboya explica de dónde.
   *   MOLDURAS  zócalo abajo y cornisa arriba. Son las dos líneas que separan
   *             pared de piso y pared de techo; sin ellas los planos se cortan
   *             a filo y el ojo lee «polígono», no «habitación».
   *
   * Todas las texturas se dibujan en un `canvas` — ver `museo-materiales.ts`.
   * Cero bytes de descarga.
   */
  const ANCHO_SALA = 13.5;
  const ALTO_SALA = 6.4;

  /*
   * DONDE EMPIEZA Y DONDE TERMINA LA SALA (bug arreglado en D-164).
   *
   * Había dos largos distintos y no coincidían: el piso medía 124 metros y el
   * visitante sólo podía caminar 91. El resultado era el peor de los dos
   * mundos — se frenaba contra una pared invisible con veinte metros de sala
   * todavía por delante, y como no había paredes de fondo, el pasillo se
   * perdía en la niebla en vez de terminar.
   *
   * Ahora hay UNA sola medida. La sala arranca `MARGEN_EXTREMO` antes del
   * primer telón y termina `MARGEN_EXTREMO` después del último, las paredes de
   * frente y fondo se levantan exactamente ahí, y el tope de la caminata es esa
   * misma pared menos el radio del cuerpo. Se camina hasta tocarla.
   *
   * Nueve metros de margen y no menos: es lo que hace falta para poder pararse
   * frente al primer y al último telón a la distancia de mirar un cuadro, sin
   * tener la pared en la nuca.
   */
  const MARGEN_EXTREMO = PASO * 1.3;
  const zFrente = MARGEN_EXTREMO;
  const zFondo = -(obras.length - 1) * PASO - MARGEN_EXTREMO;
  const largoSala = zFrente - zFondo;
  const zCentro = (zFrente + zFondo) / 2;

  // Se entra por la puerta del frente, mirando el pasillo: el primer telón
  // queda justo a la distancia de leer su cartela. Y con sitio de sobra por
  // detrás, porque ahora la cámara va tres metros atrás del personaje.

  const marmol = texturaMarmol();
  // Una baldosa cada ~2,4 m: la textura trae dos por lado, así que se repite
  // la mitad de veces que baldosas hay.
  marmol.mapa.repeat.set(ANCHO_SALA / 4.8, largoSala / 4.8);
  marmol.rugosidad.repeat.set(ANCHO_SALA / 4.8, largoSala / 4.8);

  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(ANCHO_SALA, largoSala),
    new THREE.MeshStandardMaterial({
      map: marmol.mapa,
      roughnessMap: marmol.rugosidad,
      roughness: 1,
      // Un mármol pulido refleja algo. Sin nada de metalness la piedra se ve
      // de yeso; con demasiada, de plástico.
      metalness: 0.06,
    }),
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.z = zCentro;
  piso.receiveShadow = true;
  escena.add(piso);

  const yeso = texturaYeso();
  yeso.repeat.set(ANCHO_SALA / 6, largoSala / 6);
  const techo = new THREE.Mesh(
    new THREE.PlaneGeometry(ANCHO_SALA, largoSala),
    new THREE.MeshStandardMaterial({ map: yeso, roughness: 1, metalness: 0 }),
  );
  techo.rotation.x = Math.PI / 2;
  techo.position.set(0, ALTO_SALA, zCentro);
  escena.add(techo);

  const azul = texturaPared();
  azul.repeat.set(largoSala / 7, ALTO_SALA / 7);
  const matPared = new THREE.MeshStandardMaterial({
    map: azul,
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
  });
  for (const lado of [-1, 1]) {
    const pared = new THREE.Mesh(new THREE.PlaneGeometry(largoSala, ALTO_SALA), matPared);
    pared.rotation.y = (lado * -Math.PI) / 2;
    pared.position.set((lado * ANCHO_SALA) / 2, ALTO_SALA / 2, zCentro);
    pared.receiveShadow = true;
    escena.add(pared);
  }

  /*
   * LAS PAREDES DE FRENTE Y FONDO, que antes no existían.
   *
   * Sin ellas el pasillo no terminaba: se desvanecía en la niebla, y la
   * caminata se frenaba contra un tope invisible en medio del piso. Una sala
   * tiene cuatro paredes; ésta tenía dos.
   *
   * La textura se clona en vez de volver a generarse: es el mismo `canvas` de
   * 512 px y lo único que cambia es cuántas veces se repite, que en una pared
   * de trece metros no es lo mismo que en una de sesenta y cinco.
   */
  const azulCorto = azul.clone();
  azulCorto.needsUpdate = true;
  azulCorto.repeat.set(ANCHO_SALA / 7, ALTO_SALA / 7);
  const matParedCorta = new THREE.MeshStandardMaterial({
    map: azulCorto,
    roughness: 0.95,
    metalness: 0,
  });
  for (const extremo of [zFrente, zFondo]) {
    const alFondo = extremo === zFondo;
    const pared = new THREE.Mesh(
      new THREE.PlaneGeometry(ANCHO_SALA, ALTO_SALA),
      matParedCorta,
    );
    // Mirando hacia adentro de la sala, las dos.
    pared.rotation.y = alFondo ? 0 : Math.PI;
    pared.position.set(0, ALTO_SALA / 2, extremo);
    pared.receiveShadow = true;
    escena.add(pared);
  }

  /*
   * ZOCALO Y CORNISA, y no son adorno.
   *
   * Son las molduras que resuelven el encuentro entre dos planos. Un museo
   * real las tiene por una razón práctica —proteger la pared del roce y tapar
   * la junta— y el ojo las usa para leer la habitación: son la única pista de
   * que el piso y la pared son dos superficies distintas y no un doblez.
   *
   * Van en mármol claro, como el piso, que es lo que hace un edificio de esta
   * época: el zócalo continúa el material del suelo.
   */
  const matMoldura = new THREE.MeshStandardMaterial({
    color: 0xdcd6cb,
    roughness: 0.55,
    metalness: 0.08,
  });
  for (const lado of [-1, 1]) {
    const x = (lado * ANCHO_SALA) / 2;
    const zocalo = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, largoSala), matMoldura);
    zocalo.position.set(x - lado * 0.045, 0.17, zCentro);
    zocalo.receiveShadow = true;
    escena.add(zocalo);

    const cornisa = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, largoSala), matMoldura);
    cornisa.position.set(x - lado * 0.11, ALTO_SALA - 0.13, zCentro);
    escena.add(cornisa);

    // El filete: un hilo fino a media altura de la cornisa, que es lo que le
    // da perfil a una moldura en vez de dejarla como un cajón.
    const filete = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, largoSala), matMoldura);
    filete.position.set(x - lado * 0.15, ALTO_SALA - 0.3, zCentro);
    escena.add(filete);
  }

  /*
   * Y LAS MISMAS MOLDURAS EN LOS DOS EXTREMOS, más un paño enmarcado.
   *
   * El zócalo y la cornisa tienen que dar la vuelta: una moldura que se corta
   * en la esquina delata la caja. Y el marco vacío en el centro es lo que hace
   * un arquitecto con una pared testera donde no hay nada colgado — dejarla
   * lisa la convierte en el fondo de un pasillo, enmarcarla la convierte en una
   * pared que alguien diseñó.
   */
  for (const extremo of [zFrente, zFondo]) {
    const dentro = extremo === zFondo ? 1 : -1;
    const z = extremo + dentro * 0.045;

    const zocalo = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_SALA, 0.34, 0.09), matMoldura);
    zocalo.position.set(0, 0.17, z);
    zocalo.receiveShadow = true;
    escena.add(zocalo);

    const cornisa = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_SALA, 0.26, 0.22), matMoldura);
    cornisa.position.set(0, ALTO_SALA - 0.13, extremo + dentro * 0.11);
    escena.add(cornisa);

    const filete = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_SALA, 0.05, 0.3), matMoldura);
    filete.position.set(0, ALTO_SALA - 0.3, extremo + dentro * 0.15);
    escena.add(filete);

    /*
     * EL MARCO VACIO VA SOLO EN EL FONDO (D-167).
     *
     * Hasta acá las dos paredes testeras llevaban el mismo paño enmarcado. Pero
     * la de adelante es la que tiene la puerta —el visitante entra ahí—, y una
     * puerta y un cuadro vacío en la misma pared se pisan. El fondo se queda
     * con el marco; el frente, más abajo, se queda con la puerta.
     */
    if (extremo === zFondo) {
      // El marco: cuatro varillas finas formando un rectángulo sobre el azul.
      const mAncho = ANCHO_SALA * 0.52;
      const mAlto = ALTO_SALA * 0.5;
      const mCentro = ALTO_SALA * 0.52;
      const zMarco = extremo + dentro * 0.03;
      for (const [ancho, alto, dxm, dym] of [
        [mAncho, 0.07, 0, mAlto / 2],
        [mAncho, 0.07, 0, -mAlto / 2],
        [0.07, mAlto, -mAncho / 2, 0],
        [0.07, mAlto, mAncho / 2, 0],
      ] as const) {
        const varilla = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, 0.05), matMoldura);
        varilla.position.set(dxm, mCentro + dym, zMarco);
        escena.add(varilla);
      }
    }
  }

  /*
   * LA PUERTA DE ENTRADA, en la pared del frente (D-167).
   *
   * Es la pared donde se spawnea el visitante, y hasta acá tenía el mismo
   * marco vacío que la del fondo — una pared de entrada sin puerta se lee
   * como un decorado, no como el principio de un edificio. Doble hoja de
   * madera oscura sobre un portal de mármol claro, el mismo material que ya
   * tienen zócalo y cornisa: es la piedra de la que está hecho el edificio,
   * y la puerta es de otra cosa, como en cualquier entrada real.
   *
   * NO ES UN AGUJERO EN LA PARED, es un objeto apoyado delante. Recortar un
   * plano de verdad pide una `Shape` con un hueco y complica la UV de la
   * pared por nada: el visitante nunca necesita atravesarla —interactuar con
   * ella hace lo mismo que Esc, no abre un pasillo detrás— así que alcanza
   * con que LEA como una puerta.
   */
  const matPuerta = new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.6, metalness: 0.1 });
  const matHerraje = new THREE.MeshStandardMaterial({ color: 0xc9ae72, roughness: 0.32, metalness: 0.8 });

  const ANCHO_PUERTA = 1.7;
  const ALTO_PUERTA = 2.32;
  const grupoPuerta = new THREE.Group();

  for (const lado of [-1, 1]) {
    const cx = (lado * ANCHO_PUERTA) / 4;
    const hoja = new THREE.Mesh(
      new THREE.BoxGeometry(ANCHO_PUERTA / 2 - 0.02, ALTO_PUERTA, 0.06),
      matPuerta,
    );
    hoja.position.set(cx, ALTO_PUERTA / 2, 0);
    grupoPuerta.add(hoja);

    // Dos paneles en relieve por hoja: lo que separa una puerta de un cajón.
    for (const [y, h] of [
      [ALTO_PUERTA * 0.73, ALTO_PUERTA * 0.36],
      [ALTO_PUERTA * 0.27, ALTO_PUERTA * 0.36],
    ] as const) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_PUERTA / 2 - 0.16, h, 0.02), matPuerta);
      panel.position.set(cx, y, -0.04);
      grupoPuerta.add(panel);
    }

    // La manija, del lado de adentro de cada hoja.
    const manija = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 8), matHerraje);
    manija.rotation.z = Math.PI / 2;
    manija.position.set(cx - lado * (ANCHO_PUERTA / 4 - 0.07), ALTO_PUERTA * 0.5, 0.05);
    grupoPuerta.add(manija);
  }

  // El portal: dos jambas y un dintel, en el mismo mármol claro que las
  // molduras de toda la sala.
  const anchoMarco = ANCHO_PUERTA + 0.24;
  const altoMarco = ALTO_PUERTA + 0.12;
  for (const lado of [-1, 1]) {
    const jamba = new THREE.Mesh(new THREE.BoxGeometry(0.13, altoMarco, 0.1), matMoldura);
    jamba.position.set((lado * anchoMarco) / 2, altoMarco / 2, 0);
    grupoPuerta.add(jamba);
  }
  const dintel = new THREE.Mesh(new THREE.BoxGeometry(anchoMarco + 0.13, 0.16, 0.12), matMoldura);
  dintel.position.set(0, altoMarco, 0);
  grupoPuerta.add(dintel);

  /*
   * Y VA DELANTE DEL ZOCALO, no encima (corregido).
   *
   * Con la puerta a 6 cm de la pared, sus hojas ocupaban exactamente el mismo
   * volumen que el zócalo —que sobresale 9— en los primeros 34 cm de altura.
   * Dos superficies en el mismo plano son un empate que la tarjeta de video
   * resuelve píxel por píxel según el redondeo: el rayado diagonal que se veía
   * en la base de la puerta era eso, `z-fighting`, y por eso aparecía sólo
   * abajo y sólo hasta la altura del zócalo.
   *
   * Se corre el conjunto entero hasta despejarlo. Una puerta apoyada sobre su
   * marco sobresale de la pared, así que además es lo que corresponde.
   */
  grupoPuerta.position.set(0, 0, zFrente - 0.17);
  grupoPuerta.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  escena.add(grupoPuerta);

  /*
   * LAS VIGAS Y LAS CLARABOYAS.
   *
   * Un techo liso a seis metros es un techo que no se mira. Las vigas cruzadas
   * cada cuatro metros y medio hacen dos cosas: dan ritmo al avanzar —pasan
   * por encima una tras otra, y eso se siente como distancia recorrida— y
   * dividen el techo en tramos, que es la forma en que un edificio real
   * organiza un cielorraso largo.
   *
   * Entre viga y viga, cada tres tramos, hay una claraboya: un panel que EMITE
   * luz. No ilumina la escena de verdad —eso lo hacen las luces— pero explica
   * de dónde viene la luz, que es lo que le faltaba a la sala anterior. Una
   * galería del XIX se ilumina cenitalmente, y por eso los cuadros cuelgan
   * donde cuelgan.
   */
  const matViga = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 });
  const matVidrio = new THREE.MeshStandardMaterial({
    color: 0xfffaf0,
    // `emissive` es lo que la hace verse encendida aunque no le dé ninguna luz.
    emissive: 0xfff4e2,
    emissiveIntensity: 0.85,
    roughness: 1,
  });
  const PASO_VIGA = 4.5;
  const zDesde = zCentro - largoSala / 2;
  const cuantasVigas = Math.ceil(largoSala / PASO_VIGA);
  for (let i = 0; i <= cuantasVigas; i++) {
    const z = zDesde + i * PASO_VIGA;
    // Con 0,34 de canto y a ras del techo se leían como franjas pintadas. Una
    // viga se ve porque tiene sombra propia abajo, y para eso necesita canto y
    // separarse del cielorraso.
    const viga = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_SALA, 0.5, 0.46), matViga);
    viga.position.set(0, ALTO_SALA - 0.26, z);
    viga.castShadow = false;
    escena.add(viga);

    if (i % 3 === 1 && i < cuantasVigas) {
      const claraboya = new THREE.Mesh(
        new THREE.PlaneGeometry(ANCHO_SALA * 0.42, PASO_VIGA - 0.6),
        matVidrio,
      );
      claraboya.rotation.x = Math.PI / 2;
      claraboya.position.set(0, ALTO_SALA - 0.02, z + PASO_VIGA / 2);
      escena.add(claraboya);

      // Los travesaños que parten el vidrio: sin ellos es un rectángulo
      // brillante, con ellos es una claraboya.
      for (const t of [-0.33, 0, 0.33]) {
        const cruz = new THREE.Mesh(
          new THREE.BoxGeometry(ANCHO_SALA * 0.42, 0.06, 0.06),
          matViga,
        );
        cruz.position.set(0, ALTO_SALA - 0.04, z + PASO_VIGA / 2 + t * (PASO_VIGA - 0.6));
        escena.add(cruz);
      }
    }
  }

  /* ---- Los telones ------------------------------------------------------ */
  /*
   * SE APAGA EN `destruir()`, Y LAS DESCARGAS EN VUELO LO MIRAN.
   *
   * Entre que alguien entra a la sala y que llegan las nueve texturas y el
   * modelo del visitante pasan segundos, y salir antes es lo más fácil del
   * mundo: se aprieta Escape y listo. Sin esto, esas descargas terminaban
   * igual y le colgaban una textura a un material ya descartado o metían el
   * personaje en una escena que ya nadie mira — memoria de video que no la
   * libera nadie, porque el recorrido de `destruir()` ya pasó.
   */
  let destruido = false;

  const cargador = new THREE.TextureLoader();
  const telones: Telon[] = [];
  const anclas: THREE.Vector3[] = [];
  let cargadas = 0;

  obras.forEach((obra, i) => {
    const ancho = ALTO_TELON * obra.ratio;
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    /*
     * La textura entra cuando llega, no antes. Hasta entonces el telón es tela
     * blanca: la sala se puede recorrer completa desde el primer cuadro, y las
     * obras aparecen a medida que bajan. Nueve texturas de 1600 px son ~90 MB
     * de memoria de video; pedirlas todas de golpe congela el primer segundo.
     */
    cargador.load(obra.url, (tex) => {
      if (destruido) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, render.capabilities.getMaxAnisotropy());
      material.map = tex;
      material.needsUpdate = true;
      cargadas += 1;
      o.alCargar(cargadas / obras.length);
    });

    const telon = new Telon(ancho, ALTO_TELON, material);
    // Alternados a izquierda y derecha, como una pasarela.
    const lado = i % 2 === 0 ? -1 : 1;
    const z = -i * PASO;
    const x = lado * RETIRO;
    telon.malla.position.set(x, ALTURA_BARRAL, z);
    // Girados hacia el pasillo, con una pizca de ángulo para que se vean de
    // frente al caminar y no de canto.
    telon.malla.rotation.y = lado === -1 ? 0.42 : -0.42;
    escena.add(telon.malla);
    telones.push(telon);
    anclas.push(new THREE.Vector3(x, ALTURA_BARRAL, z));

    /* El barral: un caño fino del que cuelga la tela. */
    const barral = new THREE.Mesh(
      // El barral mide lo que mide el paño, más lo que sobresale de cada lado:
      // el telón va clavado a él en todo su ancho.
      new THREE.CylinderGeometry(0.035, 0.035, ancho + 0.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.4, metalness: 0.75 }),
    );
    barral.rotation.z = Math.PI / 2;
    barral.position.set(x, ALTURA_BARRAL + 0.02, z);
    barral.rotation.y = telon.malla.rotation.y;
    barral.castShadow = true;
    escena.add(barral);

    /*
     * EL FOCO DE LA OBRA. Cuelga por delante del telón y apunta a su centro.
     * Sin sombra a propósito: nueve mapas de sombra más el del sol es lo que
     * separa una escena que corre de una que no, y la sombra que importa —la
     * del telón sobre el piso— ya la da el cenital.
     */
    const foco = new THREE.SpotLight(0xfff1d8, 130, 13, 0.5, 0.6, 1.35);
    foco.position.set(x - lado * 1.7, ALTO_SALA - 0.42, z + 0.5);
    foco.target.position.set(x, ALTURA_BARRAL - ALTO_TELON / 2, z);
    escena.add(foco);
    escena.add(foco.target);

    /* La carcasa del foco, para que la luz salga de algo. */
    const carcasa = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 0.24, 10),
      new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.45, metalness: 0.7 }),
    );
    carcasa.position.copy(foco.position);
    carcasa.lookAt(foco.target.position);
    carcasa.rotateX(Math.PI / 2);
    escena.add(carcasa);

    /* La varilla del foco al techo. Sin ella la carcasa era un cubo negro
       flotando, que es peor que no poner nada. */
    const varilla = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6),
      new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.5, metalness: 0.6 }),
    );
    varilla.position.set(foco.position.x, ALTO_SALA - 0.21, foco.position.z);
    escena.add(varilla);

    /* Los dos tensores. Van del barral al techo y ni un centímetro más: en la
       primera versión medían 3,2 m fijos y como no había techo terminaban en
       el aire, que es lo primero que delata que no hay sala. */
    const largoCable = ALTO_SALA - ALTURA_BARRAL;
    for (const lx of [-1, 1]) {
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.007, largoCable, 6),
        new THREE.MeshStandardMaterial({ color: 0x9a948d, roughness: 0.6, metalness: 0.3 }),
      );
      const off = ((ancho + 0.4) / 2 - 0.12) * lx;
      cable.position.set(
        x + Math.cos(telon.malla.rotation.y) * off,
        ALTURA_BARRAL + largoCable / 2,
        z - Math.sin(telon.malla.rotation.y) * off,
      );
      escena.add(cable);
    }
  });

  /* ---- El visitante ------------------------------------------------------
   *
   * HASTA AHORA EL QUE CAMINABA ERA UNA CAMARA, y se notaba: ni sombra, ni
   * cuerpo al mirar hacia abajo, y sobre todo nada visible que empujara la tela
   * —el telón se abría solo cuando pasabas—. Ahora hay una persona.
   *
   * VA EN TERCERA PERSONA (D-165). Estuvo un rato en primera, y no servía para
   * lo que hace falta acá: si la cámara está en la cabeza, meterse en un telón
   * llena la pantalla de lienzo y el momento que uno quiere ver —la tela
   * envolviendo a alguien— es justo el que tapa. Desde atrás del hombro se ve.
   *
   * Es, además, la única forma de que agregar un personaje signifique algo: en
   * primera persona el cuerpo sólo aparece si uno mira al piso.
   *
   * NO SE DESCARGA NINGUN MODELO. Ocho primitivas de Three y dos materiales,
   * como el mármol y el cuero: cero bytes de red.
   */
  function crearVisitante() {
    const grupo = new THREE.Group();

    /*
     * LA FIGURA DE PRIMITIVAS PASA A SER EL CARTEL DE «CARGANDO».
     *
     * El modelo bueno son 1,5 MB y tarda. Mientras baja, camina esta, que es
     * la misma decisión que los telones: tela blanca hasta que llega el cuadro,
     * la sala se recorre entera desde el primer segundo. Cuando el GLB entra,
     * este grupo se apaga de una línea.
     */
    const provisorio = new THREE.Group();
    grupo.add(provisorio);

    const abrigo = new THREE.MeshStandardMaterial({ color: 0x5b5750, roughness: 0.88 });
    const pantalon = new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.92 });
    const piel = new THREE.MeshStandardMaterial({ color: 0xd8b493, roughness: 0.7 });
    const cuero = new THREE.MeshStandardMaterial({ color: 0x25211e, roughness: 0.55 });

    const pieza = (g: THREE.BufferGeometry, m: THREE.Material, y: number) => {
      const malla = new THREE.Mesh(g, m);
      malla.position.y = y;
      malla.castShadow = true;
      return malla;
    };

    /*
     * EL TORSO VA UN POCO MAS ABAJO DE LO QUE MANDA LA ANATOMIA, y no hay
     * cuello.
     *
     * Con los hombros a la altura real —1,40 sobre un ojo a 1,62— mirar al
     * piso llena media pantalla de pecho, medido en el navegador. Es lo que
     * pasa de verdad, pero en la vida real eso no molesta porque hay visión
     * periférica y dos ojos, y acá hay un rectángulo con 62 grados. Bajarlo
     * cuatro centímetros y afinarlo dos deja ver el cuerpo entero al agachar
     * la vista en vez de un primer plano de la propia camisa.
     *
     * Y el cuello se saca directamente: estaba a 16 cm del ojo, o sea que era
     * una mancha de piel en el centro de la imagen y nada más.
     */
    const torso = pieza(new THREE.CapsuleGeometry(0.15, 0.4, 4, 10), abrigo, 1.06);
    provisorio.add(torso);

    /*
     * LA CABEZA VIVE EN LA CAPA 1, que es la que la cámara no mira.
     *
     * En primera persona la cámara está adentro del cráneo: sin esto, mirar
     * hacia abajo muestra el interior de una esfera. Las capas de Three son la
     * forma barata de decir «esto existe pero no para esta cámara», y de yapa
     * la saca del mapa de sombras —que no molesta, porque con la luz cayendo
     * casi vertical la cabeza no agrega nada a la sombra de los hombros.
     */
    /*
     * EL CUELLO VUELVE con la tercera persona. Se había sacado porque en
     * primera persona quedaba a 16 cm del ojo y era una mancha de piel en el
     * centro de la imagen; visto desde atrás, sin él la cabeza flota.
     */
    provisorio.add(pieza(new THREE.CylinderGeometry(0.052, 0.068, 0.12, 10), piel, 1.45));
    provisorio.add(pieza(new THREE.SphereGeometry(0.112, 16, 12), piel, 1.565));

    /** Un miembro que pivota desde su articulación, no desde su centro. */
    const miembro = (
      x: number,
      y: number,
      radio: number,
      largo: number,
      mat: THREE.Material,
      punta: THREE.Mesh | null,
    ) => {
      const eje = new THREE.Group();
      eje.position.set(x, y, 0);
      eje.add(pieza(new THREE.CapsuleGeometry(radio, largo, 4, 8), mat, -largo / 2 - radio));
      if (punta) eje.add(punta);
      provisorio.add(eje);
      return eje;
    };

    const mano = () => pieza(new THREE.SphereGeometry(0.052, 10, 8), piel, -0.5);
    const zapato = () => {
      const z = pieza(new THREE.BoxGeometry(0.1, 0.07, 0.24), cuero, -0.79);
      z.position.z = 0.03;
      return z;
    };

    const brazos = [
      miembro(-0.195, 1.36, 0.05, 0.34, abrigo, mano()),
      miembro(0.195, 1.36, 0.05, 0.34, abrigo, mano()),
    ];
    const piernas = [
      miembro(-0.095, 0.92, 0.078, 0.6, pantalon, zapato()),
      miembro(0.095, 0.92, 0.078, 0.6, pantalon, zapato()),
    ];

    let fase = 0;
    let amplitud = 0;

    /* ---- El modelo de verdad ---------------------------------------------
     *
     * «Business Man», de Quaternius, **CC0** (dominio público): se puede usar
     * para cualquier cosa, sin atribución y comercialmente. Se eligió de un
     * catálogo que miró el dueño; la decisión de cuál fue suya.
     *
     * Son 4.200 triángulos y —esto importa— **ninguna textura**: los ocho
     * materiales son colores planos. Así que no hay ni un byte de imagen y el
     * traje toma la luz de la sala como cualquier otra superficie.
     *
     * VIENE CON VEINTICUATRO ANIMACIONES y se usan dos. Las otras son de
     * juego —morir, correr, rodar, patear, disparar, dar espadazos— y no hay
     * ninguna tecla que las dispare: en un museo se camina y se para. Sólo se
     * instancian `Idle_Neutral` y `Walk`; el resto ni se toca.
     */
    let mezclador: THREE.AnimationMixer | null = null;
    let accQuieto: THREE.AnimationAction | null = null;
    let accCamina: THREE.AnimationAction | null = null;
    let accCorrer: THREE.AnimationAction | null = null;
    let duraCaminar = 1;
    let duraCorrer = 1;

    (async () => {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync("/museo/visitante.glb");
      if (destruido) return;
      const raiz = gltf.scene;

      /*
       * ESCALAR Y APOYAR, medido y no supuesto. Un GLB puede venir en
       * centímetros, en metros o en lo que el que lo exportó tuviera puesto, y
       * con el origen en los pies, en la cadera o en cualquier lado. Se mide la
       * caja y se ajusta; si el número no es plausible —una malla con esqueleto
       * puede dar una caja degenerada— se deja como vino antes que romperlo.
       */
      /*
       * MEDIA VUELTA. El modelo mira a +Z, que es la convención con la que se
       * exporta un personaje de glTF; una cámara de Three mira a −Z y sobre eso
       * está armado `rumbo`. Sin esto el visitante camina de espaldas — se
       * verificó en el navegador, se le veía la corbata mientras se alejaba.
       */
      raiz.rotation.y = Math.PI;

      const caja = new THREE.Box3().setFromObject(raiz);
      const alto = caja.max.y - caja.min.y;
      let k = 1;
      if (alto > 0.4 && alto < 6) {
        k = ALTURA_PERSONA / alto;
        raiz.scale.setScalar(k);
        raiz.position.y = -caja.min.y * k;
      }
      raiz.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          // El traje es oscuro y la sala también: sin esto los reversos se
          // hunden en la pared azul.
          (m.material as THREE.MeshStandardMaterial).side = THREE.FrontSide;
        }
      });
      // Ver `desplasticar`: el defecto de exportación del archivo, acá sobre
      // piel, tela y pelo.
      desplasticar(raiz);
      grupo.add(raiz);

      /*
       * Y LA FIGURA PROVISORIA SE VA DEL TODO, no sólo se apaga.
       *
       * Apagarla alcanzaba para que no se viera, pero sus once mallas seguían
       * colgando del grafo y su geometría en memoria de video hasta que
       * alguien saliera de la sala. Una vez que el modelo bueno está adentro no
       * hay camino de vuelta —si la descarga falla no se llega hasta acá—, así
       * que se libera. Sus materiales y geometrías son suyos y de nadie más.
       */
      grupo.remove(provisorio);
      provisorio.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat.dispose();
      });

      mezclador = new THREE.AnimationMixer(raiz);
      const clip = (re: RegExp) => gltf.animations.find((a) => re.test(a.name));
      const quieto = clip(/\|Idle_Neutral$/) ?? clip(/\|Idle$/);
      const camina = clip(/\|Walk$/);
      // `$` al final: sin él, `/\|Run/` también encuentra `Run_Back`,
      // `Run_Left`, `Run_Right` y `Run_Shoot`, que no se usan (D-166 §2).
      const corre = clip(/\|Run$/);
      if (quieto) accQuieto = mezclador.clipAction(quieto).play();
      if (camina) {
        accCamina = mezclador.clipAction(camina).play();
        accCamina.setEffectiveWeight(0);
        duraCaminar = camina.duration;
      }
      if (corre) {
        accCorrer = mezclador.clipAction(corre).play();
        accCorrer.setEffectiveWeight(0);
        duraCorrer = corre.duration;
      }

    })().catch(() => {
      /* Si el modelo no baja, queda la figura de primitivas caminando. Un
         museo que no abre porque falló una descarga es un museo roto. */
    });

    /**
     * Un cuadro de caminata. Devuelve el bamboleo, que sube y baja el cuerpo
     * entero y con él el punto al que apunta la cámara.
     */
    function animar(dt: number, rapidez: number, giro: number) {
      grupo.rotation.y = giro;

      if (mezclador) {
        /*
         * TRES ANIMACIONES, MEZCLADAS EN CADENA: quieto → caminar → correr.
         *
         * Con dos clips alcanzaba un único `t` de 0 a 1. Con tres hace falta
         * un árbol de mezcla: por debajo de `VELOCIDAD` se cruzan quieto y
         * caminata, por encima se cruzan caminata y carrera, y en el punto
         * exacto de `VELOCIDAD` sólo pesa `Walk` —el empalme entre los dos
         * tramos no se nota porque ahí un tramo termina en 1 y el otro
         * arranca en 0.
         */
        let wQuieto: number;
        let wCaminar: number;
        let wCorrer: number;
        if (rapidez <= VELOCIDAD) {
          const t = VELOCIDAD > 0 ? Math.min(1, rapidez / VELOCIDAD) : 1;
          wQuieto = 1 - t;
          wCaminar = t;
          wCorrer = 0;
        } else {
          const t = Math.min(1, (rapidez - VELOCIDAD) / (VELOCIDAD_CORRER - VELOCIDAD));
          wQuieto = 0;
          wCaminar = 1 - t;
          wCorrer = t;
        }
        accQuieto?.setEffectiveWeight(wQuieto);

        /*
         * Y CADA CLIP QUE SUENA SE ACELERA CON SU PROPIA CAMINATA.
         *
         * La animación es **en el lugar** —ninguno de los dos clips tiene
         * movimiento de raíz, se verificó en el archivo—, así que si
         * corrieran a velocidad fija mientras el cuerpo se traslada a otra,
         * los pies patinarían. `PASO_DEL_CLIP` y `PASO_DEL_CLIP_CORRER` son
         * cuánto avanza una persona en un ciclo completo de cada uno, medidos
         * por separado porque una zancada de trote es más larga que una de
         * caminar (D-166, D-167).
         */
        if (accCamina) {
          accCamina.setEffectiveWeight(wCaminar);
          if (wCaminar > 0) {
            accCamina.timeScale = Math.max(0.4, (rapidez * duraCaminar) / PASO_DEL_CLIP);
          }
        }
        if (accCorrer) {
          accCorrer.setEffectiveWeight(wCorrer);
          if (wCorrer > 0) {
            accCorrer.timeScale = Math.max(0.4, (rapidez * duraCorrer) / PASO_DEL_CLIP_CORRER);
          }
        }
        mezclador.update(dt);

        // El clip ya trae su propio subir y bajar: no hay que agregarle otro.
        return 0;
      }

      /* Y mientras tanto, la figura provisoria.
       *
       * EL CICLO LO MANDA LA DISTANCIA RECORRIDA, no el reloj: así los pasos se
       * alargan y se acortan con la velocidad en vez de patinar. */
      fase += rapidez * dt * 3.6;
      const objetivo = Math.min(1, rapidez / VELOCIDAD);
      // La amplitud entra y sale suave: frenar de golpe con las piernas
      // abiertas es lo que delata una animación pegada.
      amplitud += (objetivo - amplitud) * Math.min(1, dt * 8);

      const balanceo = Math.sin(fase) * amplitud * 0.62;
      piernas[0]!.rotation.x = balanceo;
      piernas[1]!.rotation.x = -balanceo;
      brazos[0]!.rotation.x = -balanceo * 0.7;
      brazos[1]!.rotation.x = balanceo * 0.7;
      // El torso se inclina un poco hacia adelante al caminar, como todos.
      torso.rotation.x = amplitud * 0.06;

      /*
       * DOS SUBIDAS POR ZANCADA: el cuerpo sube cuando la pierna de apoyo está
       * vertical, y eso pasa dos veces por ciclo. Dos centímetros: en primera
       * persona más que esto mareaba, y en tercera sigue siendo lo justo para
       * que la caminata no se lea como un deslizamiento.
       */
      return Math.abs(Math.sin(fase)) * 0.02 * amplitud;
    }

    return { grupo, animar };
  }

  const visitante = crearVisitante();
  escena.add(visitante.grupo);

  /* ---- El paseo --------------------------------------------------------- */
  const teclas = new Set<string>();
  const vel = new THREE.Vector3();
  const EJE_Y = new THREE.Vector3(0, 1, 0);

  /**
   * DONDE ESTA PARADO EL PERSONAJE, con los pies en el piso.
   *
   * Es el cambio de fondo de D-165: hasta acá el que caminaba era la cámara y
   * el cuerpo la seguía. Ahora camina el cuerpo y la cámara lo mira. Todo lo
   * demás —el tope contra las paredes, la cápsula que empuja la tela, el foco
   * de la cartela, el sol— pasó a colgar de este punto.
   */
  const sujeto = new THREE.Vector3(0, 0, zFrente - 4.7);
  /** Dónde estaba en el paso anterior, para saber cuánto arrastra. */
  const previo = new THREE.Vector3();
  /** Su desplazamiento en este paso. Es lo que la tela usa para engancharse. */
  const arrastre = new THREE.Vector3();
  /** Hacia dónde mira el cuerpo. No es lo mismo que hacia dónde mira la cámara. */
  let rumbo = 0;

  let giroY = 0;
  let giroX = 0;
  let enfocada: number | null = null;
  let corriendo = false;
  let raf: number | null = null;
  let ultimo = 0;
  let acumulado = 0;
  /** Los telones que se movieron en este cuadro: sólo a esos se les recalculan
   *  las normales, y una sola vez. */
  const simulados: Telon[] = [];

  /*
   * EL PUNTERO BLOQUEADO ES EL CAMINO BUENO, NO EL UNICO.
   *
   * `requestPointerLock()` es lo que hace que el mouse gire la cabeza sin
   * tocar los bordes de la pantalla, y es lo que espera cualquiera que jugó
   * algo. Pero **falla**: pide un gesto del usuario, algunos navegadores lo
   * niegan dentro de un iframe, y en un documento que no es el de arriba tira
   * `WrongDocumentError`. Se comprobó en la primera corrida.
   *
   * Un museo que no abre porque el navegador no quiso bloquear el puntero es
   * un museo roto, así que hay un segundo camino: arrastrar con el botón
   * izquierdo. `activo` —no el bloqueo— es lo que decide si el teclado y el
   * mouse mandan, y por eso los dos caminos funcionan sin saber uno del otro.
   */
  let activo = false;
  let arrastrando = false;
  let ultimoX = 0;
  let ultimoY = 0;

  const bloqueado = () => document.pointerLockElement === lienzo;

  const alBajarTecla = (e: KeyboardEvent) => {
    if (!activo) return;
    const t = e.target as HTMLElement | null;
    // Nunca robarle una tecla a un campo de texto.
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    teclas.add(e.code);
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
  };
  const alSubirTecla = (e: KeyboardEvent) => teclas.delete(e.code);

  const mirar = (dx: number, dy: number) => {
    giroY -= dx * 0.0022;
    giroX -= dy * 0.0022;
    /*
     * En tercera persona la inclinación mueve la cámara alrededor del
     * personaje, no un cuello: negativa la sube por encima del hombro,
     * positiva la baja. Menos recorrido que en primera persona porque en los
     * extremos la cámara termina en el piso o en el techo.
     */
    giroX = Math.max(-0.72, Math.min(0.42, giroX));
  };

  const alMoverMouse = (e: MouseEvent) => {
    if (!activo) return;
    if (bloqueado()) {
      mirar(e.movementX, e.movementY);
    } else if (arrastrando) {
      mirar(e.clientX - ultimoX, e.clientY - ultimoY);
      ultimoX = e.clientX;
      ultimoY = e.clientY;
    }
  };

  const alBajarMouse = (e: MouseEvent) => {
    if (!activo || bloqueado()) return;
    arrastrando = true;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
  };
  const alSubirMouse = () => {
    arrastrando = false;
  };

  const alCambiarPuntero = () => {
    // Salir del bloqueo es la forma en que el navegador dice «Escape». Se
    // avisa a React, que pone la capa de pausa.
    if (activo && !bloqueado()) {
      teclas.clear();
      o.alSoltarPuntero();
    }
  };

  document.addEventListener("keydown", alBajarTecla);
  document.addEventListener("keyup", alSubirTecla);
  document.addEventListener("mousemove", alMoverMouse);
  lienzo.addEventListener("mousedown", alBajarMouse);
  document.addEventListener("mouseup", alSubirMouse);
  document.addEventListener("pointerlockchange", alCambiarPuntero);

  /** Coordenadas locales del visitante respecto de un telón. */
  const tmp = new THREE.Vector3();
  const tmpInv = new THREE.Matrix4();
  const tmpArr = new THREE.Vector3();
  const tmpOjo = new THREE.Vector3();
  const tmpCam = new THREE.Vector3();
  /** El rumbo que piden las teclas. Se reusa: `paso()` corre hasta dos veces
   *  por cuadro, y un `Vector3` nuevo por paso son 120 objetos por segundo
   *  para el recolector, todos idénticos y todos descartados enseguida. */
  const deseada = new THREE.Vector3();

  function paso(dt: number) {
    /* ---- 1 · Caminar. Camina el PERSONAJE, no la cámara ------------------ */
    deseada.set(0, 0, 0);
    if (teclas.has("KeyW") || teclas.has("ArrowUp")) deseada.z -= 1;
    if (teclas.has("KeyS") || teclas.has("ArrowDown")) deseada.z += 1;
    if (teclas.has("KeyA") || teclas.has("ArrowLeft")) deseada.x -= 1;
    if (teclas.has("KeyD") || teclas.has("ArrowRight")) deseada.x += 1;
    if (deseada.lengthSq() > 0) {
      // Shift para correr: el clip ya estaba en el archivo (D-167), sólo
      // hacía falta la tecla y la velocidad de más.
      const corriendoAhora = teclas.has("ShiftLeft") || teclas.has("ShiftRight");
      deseada.normalize().multiplyScalar(corriendoAhora ? VELOCIDAD_CORRER : VELOCIDAD);
      // W sigue siendo «hacia donde mira la cámara», que es lo que espera
      // cualquiera: en tercera persona el rumbo lo pone el encuadre.
      deseada.applyAxisAngle(EJE_Y, giroY);
    }
    // Llegar y frenar con la misma constante: es lo que saca el patinaje sin
    // que el arranque se sienta trabado.
    const k = 1 - Math.exp(-SUAVIZADO * dt);
    vel.lerp(deseada, k);

    previo.copy(sujeto);
    sujeto.addScaledVector(vel, dt);

    /*
     * NO SALIRSE DE LA SALA, y el tope ES la pared. Los cuatro límites salen de
     * las mismas medidas con las que se levantaron las paredes, menos el radio
     * del cuerpo.
     *
     * Y ya no hay ningún otro tope: **los telones se atraviesan** (D-165). El
     * que había frenaba al cuerpo a 18 cm del paño, y con eso lo máximo que se
     * conseguía era una abolladura. Una tela colgada no es una pared: se pasa
     * a través y ella se acomoda.
     */
    const bordeX = ANCHO_SALA / 2 - RADIO_VISITANTE - 0.05;
    sujeto.x = Math.max(-bordeX, Math.min(bordeX, sujeto.x));
    sujeto.z = Math.max(
      zFondo + RADIO_VISITANTE + 0.05,
      Math.min(zFrente - RADIO_VISITANTE - 0.05, sujeto.z),
    );
    // Lo que se movió en ESTE paso, que es lo que arrastra la tela.
    arrastre.subVectors(sujeto, previo);

    /* ---- 2 · Hacia dónde mira el cuerpo ---------------------------------- */
    const rapidez = Math.hypot(vel.x, vel.z);
    if (rapidez > 0.25) {
      /*
       * El cuerpo se da vuelta hacia donde camina, no hacia donde mira la
       * cámara: girar el encuadre alrededor de alguien que sigue caminando
       * derecho es lo que uno espera de una tercera persona. `atan2` con los
       * signos cambiados porque el frente del modelo es −z.
       */
      const quiere = Math.atan2(-vel.x, -vel.z);
      let dif = quiere - rumbo;
      // Por el camino corto: sin esto, cruzar ±π hace un trompo.
      while (dif > Math.PI) dif -= Math.PI * 2;
      while (dif < -Math.PI) dif += Math.PI * 2;
      rumbo += dif * Math.min(1, dt * 11);
    }
    const bamboleo = visitante.animar(dt, rapidez, rumbo);
    visitante.grupo.position.set(sujeto.x, bamboleo, sujeto.z);

    // La luz y su objetivo acompañan al visitante. Ver el comentario del sol.
    // Casi vertical: la luz baja de las claraboyas, no entra por una ventana.
    sol.position.set(sujeto.x + 2.2, 15, sujeto.z + 3.4);
    sol.target.position.set(sujeto.x, 0, sujeto.z);
    sol.target.updateMatrixWorld();

    /* ---- 3 · Dónde querría estar la cámara ------------------------------- */
    /*
     * El mismo convenio que `rotateY(giroY)` seguido de `rotateX(giroX)`: el
     * frente de una cámara de Three es −z. La cámara se cuelga hacia atrás
     * sobre ese frente y se corre a su derecha, que es lo que hace una cámara
     * al hombro — una centrada pone la nuca justo encima de lo que uno mira.
     */
    const cosX = Math.cos(giroX);
    const fx = -Math.sin(giroY) * cosX;
    const fy = Math.sin(giroX);
    const fz = -Math.cos(giroY) * cosX;
    const rx = Math.cos(giroY);
    const rz = -Math.sin(giroY);
    const oy = CAMARA_MIRA + bamboleo;
    let distancia = CAMARA_ATRAS;

    /* ---- 4 · Física de cada telón, y qué obra está enfocada -------------- */
    simulados.length = 0;
    let masCerca: number | null = null;
    let mejor = DISTANCIA_ENFOQUE;
    for (let i = 0; i < telones.length; i++) {
      const t = telones[i]!;
      const ancla = anclas[i]!;
      const d = Math.hypot(sujeto.x - ancla.x, sujeto.z - ancla.z);

      /*
       * YA NO HACE FALTA UN CORTE POR DISTANCIA. Lo había —no se simulaba nada
       * a más de veinte metros— porque los nueve telones corrían siempre. Ahora
       * el que nadie toca duerme, y un telón dormido cuesta una comparación:
       * `paso(null)` devuelve enseguida.
       */
      let local: THREE.Vector3 | null = null;
      let arrastreLocal: THREE.Vector3 | null = null;
      if (d < 8) {
        tmpInv.copy(t.malla.matrixWorld).invert();
        // Sin `.clone()`: `local` no sobrevive a esta vuelta del bucle —lo
        // consume `t.paso()` al final— y los otros temporales de acá son
        // distintos, así que nadie pisa `tmp` mientras se lo usa.
        local = tmp.copy(sujeto).applyMatrix4(tmpInv);

        /*
         * El arrastre va en coordenadas del telón, y como sólo está girado
         * sobre Y alcanza con rotar el vector: `transformDirection` no sirve
         * porque normaliza, y acá el largo ES el dato — es la velocidad.
         */
        const a = -t.malla.rotation.y;
        arrastreLocal = tmpArr.set(
          arrastre.x * Math.cos(a) + arrastre.z * Math.sin(a),
          0,
          -arrastre.x * Math.sin(a) + arrastre.z * Math.cos(a),
        );

        /*
         * DE PASO, LA CAMARA NO SE QUEDA DETRAS DEL PAÑO.
         *
         * Es el truco estándar de cualquier tercera persona: se tira un rayo
         * del personaje a la cámara y si algo se cruza, la cámara se adelanta
         * hasta ahí. Sin esto, meterse en un telón deja la pantalla tapada por
         * el revés del cuadro justo en el momento que uno quiere ver.
         *
         * En coordenadas locales es una cuenta: si el personaje y la cámara
         * están de distinto lado del plano `z = 0`, se busca dónde lo cruza y
         * se comprueba que ese punto caiga dentro del paño.
         */
        const camX = sujeto.x - fx * distancia + rx * CAMARA_LADO;
        const camY = oy - fy * distancia;
        const camZ = sujeto.z - fz * distancia + rz * CAMARA_LADO;
        const oj = tmpOjo.set(sujeto.x, oy, sujeto.z).applyMatrix4(tmpInv);
        const cm = tmpCam.set(camX, camY, camZ).applyMatrix4(tmpInv);
        if (oj.z * cm.z < 0) {
          const f = oj.z / (oj.z - cm.z);
          const px = oj.x + (cm.x - oj.x) * f;
          const py = oj.y + (cm.y - oj.y) * f;
          if (Math.abs(px) < t.ancho / 2 && py < 0.15 && py > -t.alto - 0.15) {
            distancia = Math.max(CAMARA_MINIMA, distancia * f - 0.14);
          }
        }
      }
      if (t.paso(local, arrastreLocal)) simulados.push(t);

      if (d < mejor) {
        mejor = d;
        masCerca = i;
      }
    }
    if (masCerca !== enfocada) {
      enfocada = masCerca;
      o.alEnfocar(enfocada);
    }

    /* ---- 5 · Y ahí se pone ----------------------------------------------- */
    camara.position.set(
      sujeto.x - fx * distancia + rx * CAMARA_LADO,
      oy - fy * distancia,
      sujeto.z - fz * distancia + rz * CAMARA_LADO,
    );
    // Que no se meta en una pared ni en el techo ni bajo el piso.
    const bordeC = ANCHO_SALA / 2 - 0.3;
    camara.position.x = Math.max(-bordeC, Math.min(bordeC, camara.position.x));
    camara.position.z = Math.max(zFondo + 0.3, Math.min(zFrente - 0.3, camara.position.z));
    camara.position.y = Math.max(0.45, Math.min(ALTO_SALA - 0.35, camara.position.y));

    camara.rotation.set(0, 0, 0);
    camara.rotateY(giroY);
    camara.rotateX(giroX);
  }

  function bucle(ahora: number) {
    raf = requestAnimationFrame(bucle);
    if (!ultimo) ultimo = ahora;
    // Un tope: si la pestaña estuvo escondida, `ahora - ultimo` son minutos y
    // sin el tope el Verlet daría un paso de mil segundos y explotaría.
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    acumulado += dt;
    /*
     * DOS PASOS COMO TECHO. Si la máquina no llega, es preferible que la
     * física vaya un poco lenta a que el navegador se quede sin cuadros
     * tratando de alcanzarla — la espiral de la muerte clásica de un paso
     * fijo. El resto del tiempo se descarta y nadie lo nota.
     */
    let vueltas = 0;
    while (acumulado >= DT && vueltas < 2) {
      paso(DT);
      acumulado -= DT;
      vueltas += 1;
    }
    if (acumulado > DT * 4) acumulado = 0;
    if (vueltas) for (const t of simulados) t.refrescarNormales();
    render.render(escena, camara);
  }

  function redimensionar() {
    const w = lienzo.clientWidth || 1;
    const h = lienzo.clientHeight || 1;
    render.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }

  redimensionar();

  return {
    andar() {
      activo = true;
      if (corriendo) return;
      corriendo = true;
      ultimo = 0;
      raf = requestAnimationFrame(bucle);
    },
    parar() {
      activo = false;
      corriendo = false;
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      teclas.clear();
      arrastrando = false;
    },
    tomarPuntero() {
      // Si el navegador lo niega, no pasa nada: queda el arrastre.
      try {
        const r = lienzo.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (r && typeof r.catch === "function") r.catch(() => {});
      } catch {
        /* El museo funciona igual con el arrastre. */
      }
    },
    redimensionar,
    destruir() {
      this.parar();
      document.removeEventListener("keydown", alBajarTecla);
      document.removeEventListener("keyup", alSubirTecla);
      document.removeEventListener("mousemove", alMoverMouse);
      lienzo.removeEventListener("mousedown", alBajarMouse);
      document.removeEventListener("mouseup", alSubirMouse);
      document.removeEventListener("pointerlockchange", alCambiarPuntero);
      if (document.pointerLockElement === lienzo) document.exitPointerLock?.();
      destruido = true;

      /*
       * SE SUELTA TODA TEXTURA, no sólo `map`.
       *
       * La versión anterior descartaba `map` y nada más, y el piso de mármol
       * lleva además un `roughnessMap` —el que le da el pulido, D-163— que se
       * quedaba en memoria de video en cada visita a la sala. Y para las
       * mallas con varios materiales ni siquiera miraba las texturas.
       *
       * Recorrer las propiedades y soltar lo que sea una textura cubre las dos
       * cosas y también las que se agreguen mañana, sin tener que acordarse de
       * sumar un `?.dispose()` por cada mapa nuevo.
       */
      const soltar = (mat: THREE.Material) => {
        for (const valor of Object.values(mat)) {
          const tex = valor as THREE.Texture | null;
          if (tex && tex.isTexture) tex.dispose();
        }
        mat.dispose();
      };
      escena.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach(soltar);
        else if (mat) soltar(mat);
      });
      render.dispose();
    },
  };
}
