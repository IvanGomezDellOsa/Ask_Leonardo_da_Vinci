/**
 * El espacio vectorial del indice, dibujado.
 *
 * ⚠ ESTE MODULO NO SE IMPORTA NUNCA DE FORMA ESTATICA. Entra por `import()`
 * desde `Espacio.tsx` cuando la seccion aparece en pantalla, igual que
 * `museo-motor` (D-162): Three pesa y lo paga solo quien baja hasta el final.
 *
 * QUE DIBUJA. Los 1.402 pasajes que el motor de busqueda recorre, proyectados
 * de 384 dimensiones a 3 por `pipeline/08_proyeccion.py`. Cada uno es un vector
 * de verdad: esta en el lugar que le dio el PCA y apunta al pasaje que mas se
 * le parece, medido en las 384 dimensiones y no en la sombra.
 *
 * SON FLECHAS DE GEOMETRIA, NO LINEAS. Una linea de WebGL mide siempre 1 pixel
 * —`linewidth` se ignora en todos los navegadores— y termina en un corte recto.
 * Cada vector es un cilindro de cuerpo y un cono de punta, instanciados: 1.402
 * flechas en dos llamadas de dibujo.
 *
 * LA NUBE CONSERVA EL RADIO QUE LE DIO EL PCA. No esta normalizada a la esfera,
 * y por eso tiene interior y se puede entrar.
 */

import * as THREE from "three";

export type DatosEspacio = {
  n: number;
  secciones: string[];
  pos: number[];
  dir: number[];
  sim: number[];
  sec: number[];
  titulo: string[];
  richter: (number | null)[];
  varianza: number;
};

export type OpcionesEspacio = {
  lienzo: HTMLCanvasElement;
  datos: DatosEspacio;
  /** El indice bajo el puntero, o `null`. Las coordenadas son de la ventana. */
  alApuntar: (i: number | null, x: number, y: number) => void;
  /** La hondura, de 0 (afuera) a 1 (en el centro). */
  alHundir: (v: number) => void;
  /** `prefers-reduced-motion`: sin entrada y sin giro propio. */
  quieto: boolean;
};

export type Espacio = {
  /** Enciende una seccion (o todas con `null`) y decide si van en color. */
  pintar(encendida: number | null, porSeccion: boolean): void;
  pausar(v: boolean): void;
  /** Suma a la hondura. Positivo entra. */
  hundir(d: number): void;
  /** El color CSS de cada seccion, para que el rail ponga el mismo. */
  colores: string[];
  destruir(): void;
};

/** El largo de la flecha sale del parecido con su vecino, entre estos dos. */
const LARGO_MIN = 0.03;
const LARGO_MAX = 0.07;
const SIM_MIN = 0.83;
const R_CUERPO = 0.0022;
const R_PUNTA = 0.0072;

const AFUERA = 3.05;
const ADENTRO = 0.14;
const NIEBLA_FUERA = 0.16;
const NIEBLA_ADENTRO = 0.62;

/** Cuanto dura la entrada, cuanto vuela cada flecha y de cuan lejos viene. */
const APERTURA = 3400;
const VUELO = 0.58;
const LEJOS = 6.5;

/**
 * UNA SOLA MATERIA POR OMISION. El blanco pleno hace masa: 1.402 cosas del
 * mismo valor se leen como un manchon. Hueso, y sobre todo CON PROFUNDIDAD
 * —lo de afuera brilla, lo del centro se hunde—, que es lo que convierte una
 * mancha plana en un volumen.
 *
 * Los 22 tonos existen detras del boton «Colorear» y NO son una leyenda: en una
 * nube todos los pares de colores compiten a la vez y a partir de tres o cuatro
 * dejan de ser separables. Lo que muestran es que hay muchos vecindarios; para
 * decodificar esta el rail, donde cada tema lleva su punto del mismo color.
 */
const HUESO = new THREE.Color("#e8dfcd");
const APAGADO = new THREE.Color("#2b2926");

function paleta(cuantas: number): { tres: THREE.Color[]; css: string[] } {
  const tres: THREE.Color[] = [];
  const css: string[] = [];
  for (let i = 0; i < cuantas; i++) {
    // El salto de a 7 reparte los tonos por todo el circulo en vez de dejar
    // vecinos casi iguales pegados en la lista.
    const h = Math.round((14 + ((i * 7) % cuantas) * (330 / cuantas)) % 360);
    const c = `hsl(${h}, 44%, ${66 + (i % 2 ? 6 : 0)}%)`;
    css.push(c);
    tres.push(new THREE.Color(c));
  }
  return { tres, css };
}

/** mulberry32. Por que hace falta una semilla fija, mas abajo. */
function dado(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function construirEspacio(o: OpcionesEspacio): Espacio {
  const { lienzo, datos, alApuntar, alHundir, quieto } = o;
  const n = datos.n;
  const pos = datos.pos;

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);

  const escena = new THREE.Scene();
  escena.fog = new THREE.FogExp2(0x000000, NIEBLA_FUERA);
  const camara = new THREE.PerspectiveCamera(46, 1, 0.01, 100);
  const mundo = new THREE.Group();
  escena.add(mundo);

  escena.add(new THREE.AmbientLight(0xffffff, 0.8));
  const luz1 = new THREE.DirectionalLight(0xffffff, 0.95);
  luz1.position.set(2, 3, 4);
  const luz2 = new THREE.DirectionalLight(0xffd9a0, 0.5);
  luz2.position.set(-3, -1, -2);
  escena.add(luz1, luz2);

  const cuerpos = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(R_CUERPO, R_CUERPO, 1, 5, 1, true),
    new THREE.MeshLambertMaterial(),
    n,
  );
  const puntas = new THREE.InstancedMesh(
    new THREE.ConeGeometry(R_PUNTA, 1, 7),
    new THREE.MeshLambertMaterial(),
    n,
  );
  cuerpos.frustumCulled = false;
  puntas.frustumCulled = false;
  // Las matrices cambian en cada cuadro mientras dura la entrada.
  cuerpos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  puntas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mundo.add(cuerpos, puntas);

  const { tres: PALETA, css: CSS } = paleta(datos.secciones.length);

  /** Cuanto brilla cada flecha segun su distancia al centro. */
  const brillo = new Float32Array(n);

  /*
    LA ENTRADA: MIL CUATROCIENTAS FLECHAS QUE CAEN. La escena no aparece hecha.
    Cada flecha entra desde fuera del encuadre, por su lado y con su propio
    retraso, girando, y frena en la posicion exacta que le dio el PCA.

    ⚠ EL AZAR ES SEMBRADO. Generador propio con semilla fija, no `Math.random`:
    la entrada es identica en cada visita, asi que se puede grabar dos veces y
    que de lo mismo — que es lo que hace falta para un GIF.
  */
  const azar = dado(1452);
  const fq = new Float32Array(n * 4);
  const lCuerpos = new Float32Array(n);
  const lPuntas = new Float32Array(n);
  const desde = new Float32Array(n * 3);
  const qDesde = new Float32Array(n * 4);
  const demora = new Float32Array(n);

  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const ARRIBA = new THREE.Vector3(0, 1, 0);
  const D = new THREE.Vector3();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    D.set(datos.dir[i * 3], datos.dir[i * 3 + 1], datos.dir[i * 3 + 2]).normalize();
    Q.setFromUnitVectors(ARRIBA, D);
    fq[i * 4] = Q.x;
    fq[i * 4 + 1] = Q.y;
    fq[i * 4 + 2] = Q.z;
    fq[i * 4 + 3] = Q.w;

    const t = Math.min(1, Math.max(0, (datos.sim[i] - SIM_MIN) / (1 - SIM_MIN)));
    const largo = LARGO_MIN + (LARGO_MAX - LARGO_MIN) * t;
    lPuntas[i] = Math.min(0.021, largo * 0.42);
    lCuerpos[i] = largo - lPuntas[i];

    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    brillo[i] = 0.42 + 0.58 * Math.min(1, Math.hypot(x, y, z) / 1.05);

    // El punto de partida: una direccion al azar sobre la esfera —muestreo
    // uniforme, no un `random` por eje, que amontona en las esquinas del cubo—
    // y una distancia bien afuera del encuadre.
    const u = azar() * 2 - 1;
    const fi = azar() * Math.PI * 2;
    const rxy = Math.sqrt(1 - u * u);
    const lejos = LEJOS * (0.75 + azar() * 0.8);
    desde[i * 3] = x + Math.cos(fi) * rxy * lejos;
    desde[i * 3 + 1] = y + Math.sin(fi) * rxy * lejos;
    desde[i * 3 + 2] = z + u * lejos;

    // Y entra torcida: una orientacion cualquiera que se endereza en el camino.
    Q.set(azar() * 2 - 1, azar() * 2 - 1, azar() * 2 - 1, azar() * 2 - 1).normalize();
    qDesde[i * 4] = Q.x;
    qDesde[i * 4 + 1] = Q.y;
    qDesde[i * 4 + 2] = Q.z;
    qDesde[i * 4 + 3] = Q.w;

    // ⚠ El retraso no pasa de lo que sobra del vuelo: asi la ultima tambien
    // termina en `APERTURA` y no queda una rezagada moviendose sola.
    demora[i] = azar() * (1 - VUELO);
  }

  const QA = new THREE.Quaternion();
  const QB = new THREE.Quaternion();
  const V = new THREE.Vector3();

  function colocar(i: number, px: number, py: number, pz: number, q: THREE.Quaternion) {
    V.set(0, 1, 0).applyQuaternion(q);
    const lc = lCuerpos[i];
    const lp = lPuntas[i];
    P.set(px, py, pz).addScaledVector(V, lc / 2);
    M.compose(P, q, S.set(1, lc, 1));
    cuerpos.setMatrixAt(i, M);
    P.set(px, py, pz).addScaledVector(V, lc + lp / 2);
    M.compose(P, q, S.set(1, lp, 1));
    puntas.setMatrixAt(i, M);
  }

  /** Un cuadro de la entrada. `k` va de 0 a 1 sobre la apertura entera. */
  function armar(k: number) {
    for (let i = 0; i < n; i++) {
      const u = Math.min(1, Math.max(0, (k - demora[i]) / VUELO));
      // Cuarta potencia: llega lanzada y frena sobre el final, que es lo que la
      // hace leerse como una caida y no como un deslizamiento.
      const e = 1 - Math.pow(1 - u, 4);
      const d = 1 - e;
      QA.set(qDesde[i * 4], qDesde[i * 4 + 1], qDesde[i * 4 + 2], qDesde[i * 4 + 3]);
      QB.set(fq[i * 4], fq[i * 4 + 1], fq[i * 4 + 2], fq[i * 4 + 3]);
      QA.slerp(QB, e);
      colocar(
        i,
        pos[i * 3] + (desde[i * 3] - pos[i * 3]) * d,
        pos[i * 3 + 1] + (desde[i * 3 + 1] - pos[i * 3 + 1]) * d,
        pos[i * 3 + 2] + (desde[i * 3 + 2] - pos[i * 3 + 2]) * d,
        QA,
      );
    }
    cuerpos.instanceMatrix.needsUpdate = true;
    puntas.instanceMatrix.needsUpdate = true;
  }

  let encendida: number | null = null;
  let porSeccion = false;
  const c = new THREE.Color();

  function pintar(cual: number | null, color: boolean) {
    encendida = cual;
    porSeccion = color;
    for (let i = 0; i < n; i++) {
      const sec = datos.sec[i];
      const suyo = porSeccion ? PALETA[sec] : HUESO;
      if (encendida === null || sec === encendida) c.copy(suyo).multiplyScalar(brillo[i]);
      else c.copy(APAGADO);
      cuerpos.setColorAt(i, c);
      puntas.setColorAt(i, c);
    }
    if (cuerpos.instanceColor) cuerpos.instanceColor.needsUpdate = true;
    if (puntas.instanceColor) puntas.instanceColor.needsUpdate = true;
  }

  // ── girar, entrar, pausar ────────────────────────────────────────────────
  let hondura = 0;
  const giro = { x: -0.18, y: 0.5 };
  let inercia = { x: 0, y: 0.0014 };
  let girando = false;
  let ultimo = { x: 0, y: 0 };
  let pausado = quieto;

  function hundir(d: number) {
    hondura = Math.min(1, Math.max(0, hondura + d));
    alHundir(hondura);
  }

  /*
    ⚠ LA RUEDA SOLA NO HACE ZOOM, Y ACA ESO NO ES NEGOCIABLE. Esto es la ULTIMA
    seccion de una pagina larga: si la rueda se quedara con el gesto, quien
    baja hasta aca no tendria como volver a subir y el sitio se cerraria sobre
    si mismo. Con `Ctrl`/`⌘` si —es la convencion de cualquier mapa embebido—,
    y para el resto estan el pellizco, las flechas y los botones de la barra.
  */
  const alRodar = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    hundir(-e.deltaY * 0.0025);
  };
  lienzo.addEventListener("wheel", alRodar, { passive: false });

  const dedos = new Map<number, PointerEvent>();
  let pinza = 0;

  const alBajar = (e: PointerEvent) => {
    dedos.set(e.pointerId, e);
    lienzo.setPointerCapture(e.pointerId);
    if (dedos.size === 1) {
      girando = true;
      ultimo = { x: e.clientX, y: e.clientY };
    }
  };
  const soltar = (e: PointerEvent) => {
    dedos.delete(e.pointerId);
    girando = dedos.size === 1;
    pinza = 0;
  };
  const alMover = (e: PointerEvent) => {
    if (dedos.has(e.pointerId)) dedos.set(e.pointerId, e);
    if (dedos.size >= 2) {
      const [a, b] = [...dedos.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinza) hundir((d - pinza) * 0.0016);
      pinza = d;
      return;
    }
    if (girando) {
      const dx = e.clientX - ultimo.x;
      const dy = e.clientY - ultimo.y;
      ultimo = { x: e.clientX, y: e.clientY };
      giro.y += dx * 0.005;
      giro.x = Math.max(-1.45, Math.min(1.45, giro.x + dy * 0.005));
      inercia = { x: dy * 0.0004, y: dx * 0.0006 };
    }
    apuntar(e);
  };

  lienzo.addEventListener("pointerdown", alBajar);
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);
  lienzo.addEventListener("pointermove", alMover);

  // ── la ficha ─────────────────────────────────────────────────────────────
  const rayo = new THREE.Raycaster();
  const raton = new THREE.Vector2();
  let tocado = -1;

  function apuntar(e: PointerEvent) {
    const caja = lienzo.getBoundingClientRect();
    // ⚠ Contra la caja del lienzo y no contra la ventana: esto vive dentro de
    // una seccion de una pagina larga, no ocupa la pantalla entera.
    raton.x = ((e.clientX - caja.left) / caja.width) * 2 - 1;
    raton.y = -((e.clientY - caja.top) / caja.height) * 2 + 1;
    rayo.setFromCamera(raton, camara);
    const t = rayo.intersectObject(puntas)[0];
    const i = t?.instanceId ?? -1;
    const habia = tocado !== -1;
    tocado = i;
    // Se avisa siempre que haya algo debajo —la ficha sigue al puntero— y una
    // sola vez cuando deja de haberlo.
    if (i !== -1 || habia) alApuntar(i === -1 ? null : i, e.clientX, e.clientY);
  }

  // ── medir, y el bucle ────────────────────────────────────────────────────
  function medir() {
    const ancho = lienzo.clientWidth || 1;
    const alto = lienzo.clientHeight || 1;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
  }
  const ojo = new ResizeObserver(medir);
  ojo.observe(lienzo);
  medir();

  let armado = false;
  if (quieto) {
    armar(1);
    armado = true;
  } else {
    armar(0);
  }
  pintar(null, false);

  const t0 = performance.now();
  let z = AFUERA;
  let vivo = true;
  let pedido = 0;

  function cuadro(ahora: number) {
    if (!vivo) return;
    pedido = requestAnimationFrame(cuadro);
    const k = Math.min(1, (ahora - t0) / APERTURA);
    if (!armado) {
      armar(k);
      if (k >= 1) armado = true;
    }

    if (!girando && !pausado) {
      // Mientras caen, la escena gira un poco mas rapido: el movimiento propio
      // se apaga solo a medida que las flechas llegan.
      giro.y += inercia.y + (1 - k) * 0.0035;
      giro.x += inercia.x;
      inercia.x *= 0.94;
      inercia.y = inercia.y * 0.94 + 0.0014 * 0.06;
    }
    mundo.rotation.set(giro.x, giro.y, 0);

    z += (AFUERA + (ADENTRO - AFUERA) * hondura - z) * 0.075;
    camara.position.z = z;
    (escena.fog as THREE.FogExp2).density =
      NIEBLA_FUERA + (NIEBLA_ADENTRO - NIEBLA_FUERA) * hondura;

    renderer.render(escena, camara);
  }
  pedido = requestAnimationFrame(cuadro);

  return {
    pintar,
    pausar: (v: boolean) => {
      pausado = v;
    },
    hundir,
    colores: CSS,
    destruir() {
      vivo = false;
      cancelAnimationFrame(pedido);
      ojo.disconnect();
      lienzo.removeEventListener("wheel", alRodar);
      lienzo.removeEventListener("pointerdown", alBajar);
      lienzo.removeEventListener("pointerup", soltar);
      lienzo.removeEventListener("pointercancel", soltar);
      lienzo.removeEventListener("pointermove", alMover);
      cuerpos.geometry.dispose();
      puntas.geometry.dispose();
      (cuerpos.material as THREE.Material).dispose();
      (puntas.material as THREE.Material).dispose();
      renderer.dispose();
    },
  };
}
