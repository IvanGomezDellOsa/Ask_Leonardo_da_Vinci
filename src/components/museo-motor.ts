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

/** Partículas por telón. 12×16 alcanza para que ondee y no para que cueste. */
const MALLA_X = 10;
const MALLA_Y = 13;
/** Pasadas de relajación por paso. Más pasadas, tela más rígida. */
const RELAJACIONES = 3;
/** Paso fijo de física. Un paso variable hace explotar un Verlet. */
const DT = 1 / 60;

/** Velocidad de caminata, en metros por segundo. */
const VELOCIDAD = 3.4;
/** Cuánto tarda la velocidad en llegar y en irse. Sin esto, se patina. */
const SUAVIZADO = 9;
/** Radio del visitante, para no atravesar los telones ni salirse del piso. */
const RADIO_VISITANTE = 0.45;

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
 * La fila de arriba está fija —son las anillas del barral— y el resto cuelga.
 */
class Telon {
  pos: Float32Array;
  prev: Float32Array;
  fija: Uint8Array;
  /** Cada arista: índice a, índice b, largo de reposo. */
  aristas: { a: number; b: number; largo: number }[] = [];
  geom: THREE.BufferGeometry;
  malla: THREE.Mesh;
  ancho: number;
  alto: number;

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

    for (let y = 0; y < MALLA_Y; y++) {
      for (let x = 0; x < MALLA_X; x++) {
        const i = y * MALLA_X + x;
        const px = -ancho / 2 + x * dx;
        const py = -y * dy;
        // Una arruga inicial mínima: sin esto la tela arranca perfectamente
        // plana y tarda en encontrar su forma.
        const pz = Math.sin(x * 0.9) * 0.012;
        this.pos[i * 3] = px;
        this.pos[i * 3 + 1] = py;
        this.pos[i * 3 + 2] = pz;
        this.prev[i * 3] = px;
        this.prev[i * 3 + 1] = py;
        this.prev[i * 3 + 2] = pz;
        if (y === 0) this.fija[i] = 1;
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
    const unir = (a: number, b: number) => {
      const dxx = this.pos[a * 3]! - this.pos[b * 3]!;
      const dyy = this.pos[a * 3 + 1]! - this.pos[b * 3 + 1]!;
      const dzz = this.pos[a * 3 + 2]! - this.pos[b * 3 + 2]!;
      this.aristas.push({ a, b, largo: Math.hypot(dxx, dyy, dzz) });
    };
    for (let y = 0; y < MALLA_Y; y++) {
      for (let x = 0; x < MALLA_X; x++) {
        const i = y * MALLA_X + x;
        if (x + 1 < MALLA_X) unir(i, i + 1);
        if (y + 1 < MALLA_Y) unir(i, i + MALLA_X);
        if (x + 1 < MALLA_X && y + 1 < MALLA_Y) {
          unir(i, i + MALLA_X + 1);
          unir(i + 1, i + MALLA_X);
        }
        if (x + 2 < MALLA_X) unir(i, i + 2);
        if (y + 2 < MALLA_Y) unir(i, i + 2 * MALLA_X);
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
    this.geom.computeVertexNormals();
    this.malla = new THREE.Mesh(this.geom, material);
    this.malla.castShadow = true;
    this.malla.receiveShadow = true;
  }

  /**
   * Un paso de física. `viento` mueve la tela sola; `visitante` es la posición
   * del que camina, en coordenadas locales del telón, para apartarla al pasar.
   */
  paso(t: number, viento: number, visitante: THREE.Vector3 | null) {
    const n = MALLA_X * MALLA_Y;
    const p = this.pos, q = this.prev;

    for (let i = 0; i < n; i++) {
      if (this.fija[i]) continue;
      const k = i * 3;
      /*
       * El viento entra por el eje Z y varía con la altura y con el tiempo.
       * Es una suma de dos senos de períodos que no son múltiplos, así que no
       * se repite a simple vista — el mismo truco que las dos tramas del grano
       * del cuero, y por el mismo motivo.
       */
      const oleada =
        viento *
        (Math.sin(t * 1.1 + p[k + 1]! * 1.7 + p[k]! * 0.6) * 0.6 +
          Math.sin(t * 0.43 + p[k]! * 1.1) * 0.4);

      const ax = oleada * 0.35;
      const ay = -9.81;
      const az = oleada;

      const vx = (p[k]! - q[k]!) * 0.985;
      const vy = (p[k + 1]! - q[k + 1]!) * 0.985;
      const vz = (p[k + 2]! - q[k + 2]!) * 0.985;

      q[k] = p[k]!;
      q[k + 1] = p[k + 1]!;
      q[k + 2] = p[k + 2]!;

      p[k] = p[k]! + vx + ax * DT * DT;
      p[k + 1] = p[k + 1]! + vy + ay * DT * DT;
      p[k + 2] = p[k + 2]! + vz + az * DT * DT;
    }

    for (let r = 0; r < RELAJACIONES; r++) {
      for (const e of this.aristas) {
        const ka = e.a * 3, kb = e.b * 3;
        const dx = p[kb]! - p[ka]!;
        const dy = p[kb + 1]! - p[ka + 1]!;
        const dz = p[kb + 2]! - p[ka + 2]!;
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        // La mitad de la corrección a cada punta, salvo que una esté fija.
        const corr = ((d - e.largo) / d) * 0.5;
        const fa = this.fija[e.a] ? 0 : this.fija[e.b] ? 1 : 0.5;
        const fb = this.fija[e.b] ? 0 : this.fija[e.a] ? 1 : 0.5;
        p[ka] = p[ka]! + dx * corr * 2 * fa;
        p[ka + 1] = p[ka + 1]! + dy * corr * 2 * fa;
        p[ka + 2] = p[ka + 2]! + dz * corr * 2 * fa;
        p[kb] = p[kb]! - dx * corr * 2 * fb;
        p[kb + 1] = p[kb + 1]! - dy * corr * 2 * fb;
        p[kb + 2] = p[kb + 2]! - dz * corr * 2 * fb;
      }

      // El visitante empuja la tela. Es una esfera y la tela la rodea.
      if (visitante) {
        const r2 = RADIO_VISITANTE + 0.16;
        for (let i = 0; i < n; i++) {
          if (this.fija[i]) continue;
          const k = i * 3;
          const dx = p[k]! - visitante.x;
          const dy = p[k + 1]! - visitante.y;
          const dz = p[k + 2]! - visitante.z;
          // Sólo en el plano horizontal: un empujón vertical la levantaría.
          const d = Math.hypot(dx, dz) || 1e-6;
          if (d < r2 && Math.abs(dy) < 1.1) {
            const empuje = (r2 - d) / d;
            p[k] = p[k]! + dx * empuje;
            p[k + 2] = p[k + 2]! + dz * empuje;
          }
        }
      }
    }

    this.geom.attributes.position!.needsUpdate = true;
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
  render.toneMappingExposure = 1.05;

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xf3f1ec);
  /*
   * La niebla es lo que hace que la sala se sienta grande sin construirla.
   * Del mismo color que el fondo, así que el pasillo no termina en un borde:
   * se desvanece. Sin esto se ve el final del piso y la ilusión se corta.
   */
  escena.fog = new THREE.Fog(0xf3f1ec, 18, 62);

  const camara = new THREE.PerspectiveCamera(62, 1, 0.1, 120);
  camara.position.set(0, ALTURA_OJOS, PASO * 1.4);

  /* ---- Luz --------------------------------------------------------------
     Un museo es luz difusa y pareja. Una hemisférica hace el ambiente, una
     direccional suave da la sombra que apoya los telones en el piso, y sin
     una tercera de relleno los reversos quedaban negros. */
  escena.add(new THREE.HemisphereLight(0xffffff, 0xdcd8d0, 2.1));
  /*
   * LA SOMBRA VIAJA CON EL VISITANTE, y no es una optimización: es la única
   * manera de que exista. Una sala de casi 120 metros de largo con un solo mapa
   * de sombras fijo reparte 1024 píxeles sobre todo eso — se ve el rectángulo
   * donde el mapa alcanza y el borde donde deja de alcanzar, que fue lo primero
   * que apareció en el piso. Moviendo la luz y su objetivo con la cámara, esos
   * mismos 1024 píxeles cubren 28 metros alrededor de quien mira, que es lo
   * único que se ve.
   */
  const sol = new THREE.DirectionalLight(0xfff6e8, 1.35);
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
  const relleno = new THREE.DirectionalLight(0xffffff, 0.5);
  relleno.position.set(-7, 5, -9);
  escena.add(relleno);

  /* ---- La sala ----------------------------------------------------------
   *
   * PISO, TECHO Y DOS PAREDES, y las tres cosas hacen falta. La primera
   * versión era sólo un piso blanco sobre un fondo blanco, y como los dos
   * blancos eran casi el mismo no había suelo: había una superficie
   * flotando y un horizonte que no se sabía dónde estaba. Los telones colgaban
   * de cables que se iban hacia arriba sin llegar a nada.
   *
   * Los cuatro planos son del mismo blanco con tres claridades apenas
   * distintas —piso el más claro, techo el más oscuro—, que es lo que hace un
   * museo real: la misma pintura recibiendo distinta cantidad de luz. La
   * niebla se come las paredes a lo lejos, así que la sala no termina: se
   * desvanece.
   */
  const largoSala = obras.length * PASO + PASO * 3;
  const ANCHO_SALA = 17;
  const ALTO_SALA = 5.8;
  const zCentro = -largoSala / 2 + PASO;

  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(ANCHO_SALA, largoSala + 40),
    new THREE.MeshStandardMaterial({ color: 0xf8f6f2, roughness: 0.92, metalness: 0.02 }),
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.z = zCentro;
  piso.receiveShadow = true;
  escena.add(piso);

  const techo = new THREE.Mesh(
    new THREE.PlaneGeometry(ANCHO_SALA, largoSala + 40),
    new THREE.MeshStandardMaterial({ color: 0xe9e6e0, roughness: 1, metalness: 0 }),
  );
  techo.rotation.x = Math.PI / 2;
  techo.position.set(0, ALTO_SALA, zCentro);
  escena.add(techo);

  for (const lado of [-1, 1]) {
    const pared = new THREE.Mesh(
      new THREE.PlaneGeometry(largoSala + 40, ALTO_SALA),
      new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 1, metalness: 0 }),
    );
    pared.rotation.y = lado * -Math.PI / 2;
    pared.position.set((lado * ANCHO_SALA) / 2, ALTO_SALA / 2, zCentro);
    pared.receiveShadow = true;
    escena.add(pared);
  }

  /* El zócalo: la línea donde la pared toca el piso. Es lo que dice dónde
     termina el suelo cuando los dos son del mismo blanco. */
  for (const lado of [-1, 1]) {
    const zocalo = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.16, largoSala + 40),
      new THREE.MeshStandardMaterial({ color: 0xdedad3, roughness: 0.9 }),
    );
    zocalo.position.set((lado * ANCHO_SALA) / 2 - lado * 0.03, 0.08, zCentro);
    escena.add(zocalo);
  }

  /* ---- Los telones ------------------------------------------------------ */
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
      new THREE.CylinderGeometry(0.035, 0.035, ancho + 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.4, metalness: 0.75 }),
    );
    barral.rotation.z = Math.PI / 2;
    barral.position.set(x, ALTURA_BARRAL + 0.02, z);
    barral.rotation.y = telon.malla.rotation.y;
    barral.castShadow = true;
    escena.add(barral);

    /* Los dos tensores. Van del barral al techo y ni un centímetro más: en la
       primera versión medían 3,2 m fijos y como no había techo terminaban en
       el aire, que es lo primero que delata que no hay sala. */
    const largoCable = ALTO_SALA - ALTURA_BARRAL;
    for (const lx of [-1, 1]) {
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.007, largoCable, 6),
        new THREE.MeshStandardMaterial({ color: 0x9a948d, roughness: 0.6, metalness: 0.3 }),
      );
      const off = ((ancho + 0.5) / 2 - 0.12) * lx;
      cable.position.set(
        x + Math.cos(telon.malla.rotation.y) * off,
        ALTURA_BARRAL + largoCable / 2,
        z - Math.sin(telon.malla.rotation.y) * off,
      );
      escena.add(cable);
    }
  });

  /* ---- El paseo --------------------------------------------------------- */
  const teclas = new Set<string>();
  const vel = new THREE.Vector3();
  let giroY = 0;
  let giroX = 0;
  let enfocada: number | null = null;
  let corriendo = false;
  let raf: number | null = null;
  let ultimo = 0;
  let acumulado = 0;
  let reloj = 0;
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
    // Sin dar vuelta la cabeza: un museo no es un simulador de vuelo.
    giroX = Math.max(-1.15, Math.min(1.15, giroX));
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

  function paso(dt: number) {
    reloj += dt;

    /* Caminar. El eje es la cámara, así que W es «hacia donde miro». */
    const deseada = new THREE.Vector3();
    if (teclas.has("KeyW") || teclas.has("ArrowUp")) deseada.z -= 1;
    if (teclas.has("KeyS") || teclas.has("ArrowDown")) deseada.z += 1;
    if (teclas.has("KeyA") || teclas.has("ArrowLeft")) deseada.x -= 1;
    if (teclas.has("KeyD") || teclas.has("ArrowRight")) deseada.x += 1;
    if (deseada.lengthSq() > 0) {
      deseada.normalize().multiplyScalar(VELOCIDAD);
      deseada.applyAxisAngle(new THREE.Vector3(0, 1, 0), giroY);
    }
    // Llegar y frenar con la misma constante: es lo que saca el patinaje sin
    // que el arranque se sienta trabado.
    const k = 1 - Math.exp(-SUAVIZADO * dt);
    vel.lerp(deseada, k);
    camara.position.addScaledVector(vel, dt);
    camara.position.y = ALTURA_OJOS;

    // No salirse de la sala.
    const bordeX = ANCHO_SALA / 2 - RADIO_VISITANTE - 0.2;
    camara.position.x = Math.max(-bordeX, Math.min(bordeX, camara.position.x));
    camara.position.z = Math.max(-largoSala + PASO * 2, Math.min(PASO * 3, camara.position.z));

    camara.rotation.set(0, 0, 0);
    camara.rotateY(giroY);
    camara.rotateX(giroX);

    // La luz y su objetivo acompañan al visitante. Ver el comentario del sol.
    sol.position.set(camara.position.x + 5, 13, camara.position.z + 7);
    sol.target.position.set(camara.position.x, 0, camara.position.z);
    sol.target.updateMatrixWorld();

    /* Física de cada telón, y qué obra está enfocada. */
    simulados.length = 0;
    let masCerca: number | null = null;
    let mejor = DISTANCIA_ENFOQUE;
    for (let i = 0; i < telones.length; i++) {
      const t = telones[i]!;
      const ancla = anclas[i]!;
      const d = Math.hypot(camara.position.x - ancla.x, camara.position.z - ancla.z);

      /*
       * SOLO SE SIMULA LO QUE ESTA CERCA. Nueve telas de 192 partículas con
       * cuatro relajaciones son ~7.000 restricciones por cuadro; a veinte
       * metros nadie ve si la de allá ondea. Se simulan las que están a menos
       * de veinte metros y las demás quedan quietas en su última forma.
       */
      if (d > 20) continue;

      let local: THREE.Vector3 | null = null;
      if (d < 4) {
        tmpInv.copy(t.malla.matrixWorld).invert();
        local = tmp.copy(camara.position).applyMatrix4(tmpInv).clone();

        /*
         * EL TELON NO SE ATRAVIESA.
         *
         * La tela se aparta cuando alguien pasa —eso ya estaba— pero apartarse
         * no es frenar: en la primera corrida el visitante caminó derecho a
         * través de la Última Cena y terminó adentro del cuadro, con la
         * textura ocupando la pantalla entera. Una tela colgada se corre; un
         * cuadro de tres metros no se atraviesa.
         *
         * En coordenadas locales del telón el problema se vuelve trivial: el
         * paño ocupa x ∈ [−ancho/2, ancho/2] y z ≈ 0, así que alcanza con
         * sacar al visitante del lado por el que venía. Se hace acá y no con
         * un cuerpo físico porque el telón ya tiene su matriz invertida a mano
         * para la física, y calcularla dos veces sería pagar lo mismo dos
         * veces.
         */
        const margen = RADIO_VISITANTE + 0.22;
        const dentroDelAncho = Math.abs(local.x) < t.ancho / 2 + RADIO_VISITANTE;
        const aLaAltura = local.y > -t.alto - 0.4 && local.y < 0.6;
        if (dentroDelAncho && aLaAltura && Math.abs(local.z) < margen) {
          const lado = local.z >= 0 ? 1 : -1;
          local.z = margen * lado;
          // De vuelta al mundo: la corrección se aplica a la cámara, no a la
          // copia local, que sigue sirviendo para empujar la tela.
          const mundo = local.clone().applyMatrix4(t.malla.matrixWorld);
          camara.position.x = mundo.x;
          camara.position.z = mundo.z;
        }
      }
      t.paso(reloj, 0.55, local);
      if (!simulados.includes(t)) simulados.push(t);

      if (d < mejor) {
        mejor = d;
        masCerca = i;
      }
    }
    if (masCerca !== enfocada) {
      enfocada = masCerca;
      o.alEnfocar(enfocada);
    }
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
      escena.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) {
          const std = mat as THREE.MeshStandardMaterial;
          std.map?.dispose();
          std.dispose();
        }
      });
      render.dispose();
    },
  };
}
