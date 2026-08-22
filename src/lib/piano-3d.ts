// Grand piano, lid open, on a dark stage. Composed from primitives; every mesh
// and material is named so the group stays readable (and exportable).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const CASE_LEN = 2.06;
const HALF_W = 0.75;
const RIM_H = 0.235;
const LEG_H = 0.66;
const CASE_Y = LEG_H;
const CASE_TOP = LEG_H + RIM_H;

const WHITE_KEYS = 36;
const KEY_W = 1.28 / WHITE_KEYS;
const KEY_Y = CASE_TOP - 0.012;
/** How far a struck key tips, in radians. Real keys move about 10mm at the tip. */
const KEY_DIP = 0.045;

/** The wrapper group carries the lid hinge, so setLid stays a one-liner. */
export type PianoGroup = THREE.Group & {
  userData: {
    lidPivot: THREE.Group;
    /** White keys, left to right, each on its own pivot at the far end. */
    keyPivots: THREE.Group[];
  };
};

export type StageOptions = {
  exposure?: number;
  background?: number;
  fov?: number;
  targetY?: number;
  azimuth?: number;
  elevation?: number;
  distance?: number;
  /** Trades shadow resolution and pixel ratio for frame rate. Auto-detected. */
  quality?: 'high' | 'low';
};

export type Stage = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  piano: PianoGroup;
  renderer: THREE.WebGLRenderer;
  target: THREE.Vector3;
  /** How many white keys can be addressed by setKeyDepth. */
  keyCount: number;
  /** Orbit the camera: azimuth/elevation in degrees, distance in world units. */
  setCamera: (azDeg: number, elDeg: number, dist: number) => void;
  /** Lid hinge angle in radians: 0.85 wide open, 0 shut. */
  setLid: (rad: number) => void;
  /** Press one white key. depth is 0 (up) to 1 (fully down). */
  setKeyDepth: (index: number, depth: number) => void;
  render: () => void;
  resize: () => void;
  dispose: () => void;
};

type Materials = ReturnType<typeof mats>;

function caseShape(inset = 0): THREE.Shape {
  const w = HALF_W - inset;
  const L = CASE_LEN - inset;
  const s = new THREE.Shape();
  s.moveTo(-w, inset);
  s.lineTo(-w, L);
  s.lineTo(-0.3 + inset * 0.5, L);
  s.bezierCurveTo(0.08, L - 0.015, 0.6, L - 0.4, w, L - 1.16);
  s.lineTo(w, inset);
  s.closePath();
  return s;
}

/**
 * Piano black is lacquer over wood: a dark base under a glass-clear coat. That
 * second layer is what makes the highlight read as polish rather than plastic,
 * so the case uses MeshPhysicalMaterial and everything else stays standard.
 */
function mats() {
  const lacquer = (name: string, color: number, clearcoatRoughness: number) =>
    new THREE.MeshPhysicalMaterial({
      name,
      color,
      roughness: 0.34,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness,
      envMapIntensity: 1.1,
    });

  return {
    ebony: lacquer('ebony', 0x141110, 0.04),
    ebonySoft: lacquer('ebony-satin', 0x1a1614, 0.22),
    ebonyLid: lacquer('ebony-lid', 0x161211, 0.06),
    ivory: new THREE.MeshPhysicalMaterial({
      name: 'ivory',
      color: 0xf4eee1,
      roughness: 0.38,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.7,
    }),
    brass: new THREE.MeshStandardMaterial({
      name: 'brass',
      color: 0xc8a134,
      roughness: 0.24,
      metalness: 1,
      envMapIntensity: 1.5,
    }),
    felt: new THREE.MeshStandardMaterial({
      name: 'felt',
      color: 0x5a1119,
      roughness: 1,
      metalness: 0,
    }),
    board: new THREE.MeshStandardMaterial({
      name: 'soundboard',
      color: 0x9a6330,
      roughness: 0.5,
      metalness: 0.04,
      envMapIntensity: 0.9,
    }),
    stringWire: new THREE.MeshStandardMaterial({
      name: 'string-wire',
      color: 0xb08a3c,
      roughness: 0.22,
      metalness: 1,
      envMapIntensity: 1.6,
    }),
    gold: new THREE.MeshStandardMaterial({
      name: 'gold-trim',
      color: 0xcca830,
      roughness: 0.3,
      metalness: 1,
      envMapIntensity: 1.3,
    }),
  };
}

function strut(
  a: THREE.Vector3,
  b: THREE.Vector3,
  r: number,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const geo = new THREE.CylinderGeometry(r, r, dir.length(), 12);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

/** A soft dark disc on the floor. Real shadows cannot reach under the case. */
function contactShadow(): THREE.Mesh {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.24)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    }),
  );
  mesh.name = 'contact-shadow';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.004, -0.45);
  mesh.renderOrder = -1;
  return mesh;
}

export function buildPiano(): PianoGroup {
  const M: Materials = mats();
  const piano = new THREE.Group();
  piano.name = 'grand-piano';

  const extrude = (
    shape: THREE.Shape,
    depth: number,
    material: THREE.Material,
    name: string,
    y: number,
  ): THREE.Mesh => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      curveSegments: 48,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.008,
      bevelSegments: 3,
    });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    mesh.position.y = y;
    return mesh;
  };

  // Rim: outer wall with the top open so the soundboard reads under the lid.
  const rim = caseShape();
  rim.holes.push(new THREE.Path().setFromPoints(caseShape(0.062).getPoints(80)));
  piano.add(extrude(rim, RIM_H, M.ebony, 'case-rim', CASE_Y));
  piano.add(extrude(caseShape(0.01), 0.022, M.ebonySoft, 'case-bottom', CASE_Y));
  piano.add(extrude(caseShape(0.075), 0.012, M.board, 'soundboard', CASE_Y + 0.05));

  // Bridge: the curved rib the strings cross. A ring, not a plate — a filled
  // shape here would just read as a second soundboard sitting on the first.
  const bridgeShape = caseShape(0.2);
  bridgeShape.holes.push(new THREE.Path().setFromPoints(caseShape(0.26).getPoints(64)));
  piano.add(extrude(bridgeShape, 0.018, M.board, 'bridge', CASE_Y + 0.062));

  const strings = new THREE.Group();
  strings.name = 'strings';
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const len = 1.36 - t * 0.88;
    // Bass strings are wound and visibly thicker than the treble.
    const gauge = 0.0062 - t * 0.0032;
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(gauge, 0.0022, len),
      M.stringWire,
    );
    s.name = `string-${i}`;
    s.position.set(-0.62 + t * 1.24, CASE_Y + 0.088, -0.42 - len / 2);
    strings.add(s);
  }
  piano.add(strings);

  // Keyboard. Each white key hangs off a pivot at its far end so a struck key
  // tips the way a real one does instead of sinking straight down.
  const keys = new THREE.Group();
  keys.name = 'keyboard';
  const keyPivots: THREE.Group[] = [];

  const keyBed = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.03, 0.2), M.ebonySoft);
  keyBed.name = 'key-bed';
  keyBed.position.set(0, KEY_Y - 0.024, -0.12);
  piano.add(keyBed);

  const feltStrip = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.006, 0.02), M.felt);
  feltStrip.name = 'key-felt';
  feltStrip.position.set(0, KEY_Y + 0.004, -0.192);
  piano.add(feltStrip);

  for (let i = 0; i < WHITE_KEYS; i++) {
    const pivot = new THREE.Group();
    pivot.name = `key-pivot-${i}`;
    // Hinge at the back of the key, where the balance rail sits.
    pivot.position.set(-0.64 + KEY_W * (i + 0.5), KEY_Y, -0.189);

    const k = new THREE.Mesh(new THREE.BoxGeometry(KEY_W * 0.92, 0.021, 0.148), M.ivory);
    k.name = `white-${i}`;
    k.position.set(0, 0, 0.074);
    pivot.add(k);

    // The front lip that catches the key light along the whole keyboard.
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(KEY_W * 0.92, 0.016, 0.008),
      M.ivory,
    );
    lip.name = `white-lip-${i}`;
    lip.position.set(0, -0.004, 0.152);
    pivot.add(lip);

    keys.add(pivot);
    keyPivots.push(pivot);

    const step = i % 7;
    if (i < WHITE_KEYS - 1 && (step === 0 || step === 1 || step === 3 || step === 4 || step === 5)) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(KEY_W * 0.58, 0.019, 0.095), M.ebony);
      b.name = `black-${i}`;
      b.position.set(-0.64 + KEY_W * (i + 1), KEY_Y + 0.02, -0.145);
      keys.add(b);
    }
  }
  piano.add(keys);

  // Cheek blocks close the keyboard off at both ends.
  [-0.685, 0.685].forEach((x, i) => {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.21), M.ebony);
    cheek.name = `cheek-block-${i}`;
    cheek.position.set(x, KEY_Y + 0.012, -0.118);
    piano.add(cheek);
  });

  const fallboard = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.016, 0.14), M.ebony);
  fallboard.name = 'fallboard';
  fallboard.position.set(0, CASE_TOP - 0.02, -0.255);
  fallboard.rotation.x = -0.38;
  piano.add(fallboard);

  const brand = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.004, 0.016), M.gold);
  brand.name = 'fallboard-brand';
  brand.position.set(0, CASE_TOP + 0.008, -0.233);
  brand.rotation.x = -0.38;
  piano.add(brand);

  const desk = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.014, 0.24), M.ebonySoft);
  desk.name = 'music-desk';
  desk.position.set(0, CASE_TOP + 0.09, -0.43);
  desk.rotation.x = -1.16;
  piano.add(desk);

  // Lid, hinged on the spine.
  const lidPivot = new THREE.Group();
  lidPivot.name = 'lid-pivot';
  lidPivot.position.set(-HALF_W, CASE_TOP + 0.006, 0);
  const lid = extrude(caseShape(-0.006), 0.026, M.ebonyLid, 'lid', 0);
  lid.position.x = HALF_W;
  lidPivot.add(lid);
  lidPivot.rotation.z = 0.85;
  piano.add(lidPivot);

  const contact = new THREE.Vector3(0.72, 0, 0).applyEuler(new THREE.Euler(0, 0, 0.85));
  piano.add(
    strut(
      new THREE.Vector3(0.02, CASE_TOP, -1.02),
      new THREE.Vector3(-HALF_W + contact.x, CASE_TOP + contact.y, -1.02),
      0.009,
      M.ebonySoft,
      'lid-prop',
    ),
  );

  // Legs, pedal lyre, bench.
  const leg = (x: number, z: number, name: string) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.082, LEG_H, 4), M.ebony);
    l.name = name;
    l.rotation.y = Math.PI / 4;
    l.position.set(x, LEG_H / 2, z);
    piano.add(l);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.022, 20), M.brass);
    cap.name = `${name}-castor`;
    cap.position.set(x, 0.01, z);
    piano.add(cap);
  };
  leg(-0.62, -0.2, 'leg-bass');
  leg(0.62, -0.2, 'leg-treble');
  leg(-0.22, -1.74, 'leg-tail');

  const lyre = new THREE.Group();
  lyre.name = 'pedal-lyre';
  [-0.07, 0.07].forEach((x, i) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.4, 0.03), M.ebony);
    post.name = `lyre-post-${i}`;
    post.position.set(x, CASE_Y - 0.2, -0.34);
    lyre.add(post);
  });
  const lyreFoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.022, 0.09), M.ebony);
  lyreFoot.name = 'lyre-foot';
  lyreFoot.position.set(0, CASE_Y - 0.4, -0.34);
  lyre.add(lyreFoot);
  [-0.075, 0, 0.075].forEach((x, i) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.15), M.brass);
    p.name = `pedal-${i}`;
    p.position.set(x, CASE_Y - 0.38, -0.26);
    p.rotation.x = 0.06;
    lyre.add(p);
  });
  piano.add(lyre);

  // The bench: an empty seat says someone was here, which is the whole point.
  const bench = new THREE.Group();
  bench.name = 'bench';
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.28), M.ebony);
  seat.name = 'bench-seat';
  seat.position.set(0, 0.5, 0.62);
  bench.add(seat);
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.024, 0.23), M.felt);
  cushion.name = 'bench-cushion';
  cushion.position.set(0, 0.532, 0.62);
  bench.add(cushion);
  [-0.25, 0.25].forEach((x, i) =>
    [0.53, 0.71].forEach((z, j) => {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.48, 8), M.ebony);
      l.name = `bench-leg-${i}${j}`;
      l.position.set(x, 0.24, z);
      bench.add(l);
    }),
  );
  piano.add(bench);

  piano.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(piano);
  const c = box.getCenter(new THREE.Vector3());
  piano.position.set(-c.x, -box.min.y, -c.z);

  const wrap = new THREE.Group() as PianoGroup;
  wrap.name = 'piano';
  wrap.add(piano);
  wrap.userData.lidPivot = lidPivot;
  wrap.userData.keyPivots = keyPivots;
  return wrap;
}

/** Dark stage: one spotlight pool, a cool rim, a warm glow inside the case. */
export function createStage(canvas: HTMLCanvasElement, opts: StageOptions = {}): Stage {
  const quality =
    opts.quality ??
    (window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4
      ? 'low'
      : 'high');
  const low = quality === 'low';

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !low,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.6 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.15;

  const scene = new THREE.Scene();
  const bg = new THREE.Color(opts.background ?? 0x0b0a09);
  scene.background = bg;
  scene.fog = new THREE.FogExp2(bg, 0.1);

  // Without an environment the brass and the strings render nearly black:
  // metals have no diffuse term, so a reflection is all they are. A prefiltered
  // room is enough, and it never shows up in the frame — only in the polish.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.35;
  room.dispose();
  pmrem.dispose();

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({
      name: 'stage-floor',
      color: 0x1b1613,
      roughness: 0.78,
      metalness: 0.06,
      envMapIntensity: 0.35,
    }),
  );
  floor.name = 'stage-floor';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const piano = buildPiano();
  scene.add(piano);
  scene.add(contactShadow());

  const spot = new THREE.SpotLight(0xfff2da, 620, 26, 0.68, 0.9, 2);
  spot.position.set(1.5, 5.8, 3.2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  spot.shadow.bias = -0.0006;
  spot.shadow.normalBias = 0.022;
  spot.shadow.radius = low ? 2 : 4;
  spot.shadow.camera.near = 0.6;
  spot.shadow.camera.far = 22;
  scene.add(spot);
  scene.add(spot.target);

  // Cool rim along the spine: it separates the case from the black behind it.
  const rim = new THREE.DirectionalLight(0x9db4d6, 1.15);
  rim.position.set(-3.4, 2.4, -3.2);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xffe6c2, 0.34);
  fill.position.set(3.2, 1.9, 3.4);
  scene.add(fill);

  // Warm bounce inside the open case, where the soundboard catches the light.
  const inner = new THREE.PointLight(0xffc98a, 2.6, 3.6, 2);
  inner.position.set(-0.1, 0.95, -0.55);
  scene.add(inner);

  const keyLight = new THREE.PointLight(0xffe9c9, 1.7, 2.4, 2);
  keyLight.position.set(0.1, 1.4, 0.3);
  scene.add(keyLight);

  scene.add(new THREE.HemisphereLight(0x4a5666, 0x0a0908, 0.2));

  const camera = new THREE.PerspectiveCamera(opts.fov ?? 38, 1, 0.1, 60);
  const target = new THREE.Vector3(0, opts.targetY ?? 0.72, 0);

  function setCamera(azDeg: number, elDeg: number, dist: number) {
    const az = (azDeg * Math.PI) / 180;
    const el = (elDeg * Math.PI) / 180;
    // Tall phone viewports lose horizontal field: pull back so the case still fits.
    dist *= Math.min(2.15, Math.max(0.88, 1.5 / Math.max(camera.aspect, 0.35)));
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.sin(az),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(target);
  }

  const keyPivots = piano.userData.keyPivots;

  function setKeyDepth(index: number, depth: number) {
    const pivot = keyPivots[index];
    if (!pivot) return;
    pivot.rotation.x = Math.max(0, Math.min(1, depth)) * KEY_DIP;
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() {
    renderer.render(scene, camera);
  }

  setCamera(opts.azimuth ?? 22, opts.elevation ?? 18, opts.distance ?? 5.6);
  resize();
  render();

  const ro = new ResizeObserver(() => {
    resize();
    render();
  });
  ro.observe(canvas);

  return {
    scene,
    camera,
    piano,
    renderer,
    target,
    keyCount: keyPivots.length,
    setCamera,
    setLid(rad: number) {
      piano.userData.lidPivot.rotation.z = rad;
    },
    setKeyDepth,
    render,
    resize,
    dispose() {
      ro.disconnect();
      envMap.dispose();
      renderer.dispose();
    },
  };
}
