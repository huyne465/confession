// Grand piano, lid open, on a dark stage. Composed from primitives; every mesh
// and material is named so the group stays readable (and exportable).
import * as THREE from 'three';

const CASE_LEN = 2.06;
const HALF_W = 0.75;
const RIM_H = 0.235;
const LEG_H = 0.66;
const CASE_Y = LEG_H;
const CASE_TOP = LEG_H + RIM_H;

/** The wrapper group carries the lid hinge, so setLid stays a one-liner. */
export type PianoGroup = THREE.Group & {
  userData: { lidPivot: THREE.Group };
};

export type StageOptions = {
  exposure?: number;
  background?: number;
  fov?: number;
  targetY?: number;
  azimuth?: number;
  elevation?: number;
  distance?: number;
};

export type Stage = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  piano: PianoGroup;
  renderer: THREE.WebGLRenderer;
  target: THREE.Vector3;
  /** Orbit the camera: azimuth/elevation in degrees, distance in world units. */
  setCamera: (azDeg: number, elDeg: number, dist: number) => void;
  /** Lid hinge angle in radians: 0.85 wide open, 0 shut. */
  setLid: (rad: number) => void;
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

function mats() {
  return {
    ebony: new THREE.MeshStandardMaterial({ name: 'ebony', color: 0x1e1a17, roughness: 0.14, metalness: 0.12 }),
    ebonySoft: new THREE.MeshStandardMaterial({ name: 'ebony-satin', color: 0x241f1c, roughness: 0.5, metalness: 0.04 }),
    ebonyLid: new THREE.MeshStandardMaterial({ name: 'ebony-lid', color: 0x201b18, roughness: 0.46, metalness: 0.08 }),
    ivory: new THREE.MeshStandardMaterial({ name: 'ivory', color: 0xf1eadc, roughness: 0.34, metalness: 0 }),
    brass: new THREE.MeshStandardMaterial({ name: 'brass', color: 0xcca830, roughness: 0.26, metalness: 0.9 }),
    felt: new THREE.MeshStandardMaterial({ name: 'felt', color: 0x2a1412, roughness: 0.97, metalness: 0 }),
    board: new THREE.MeshStandardMaterial({ name: 'soundboard', color: 0x7a4d27, roughness: 0.64, metalness: 0.02 }),
    stringWire: new THREE.MeshStandardMaterial({ name: 'string-wire', color: 0x9c7c34, roughness: 0.34, metalness: 0.85 }),
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
      curveSegments: 40,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.006,
      bevelSegments: 2,
    });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    mesh.position.y = y;
    return mesh;
  };

  // Rim: outer wall with the top open so the soundboard reads under the lid.
  const rim = caseShape();
  rim.holes.push(new THREE.Path().setFromPoints(caseShape(0.062).getPoints(72)));
  piano.add(extrude(rim, RIM_H, M.ebony, 'case-rim', CASE_Y));
  piano.add(extrude(caseShape(0.01), 0.022, M.ebonySoft, 'case-bottom', CASE_Y));
  piano.add(extrude(caseShape(0.075), 0.012, M.board, 'soundboard', CASE_Y + 0.05));

  const strings = new THREE.Group();
  strings.name = 'strings';
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const len = 1.34 - t * 0.86;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.0025, len), M.stringWire);
    s.name = `string-${i}`;
    s.position.set(-0.6 + t * 1.2, CASE_Y + 0.085, -0.42 - len / 2);
    strings.add(s);
  }
  piano.add(strings);

  // Keyboard.
  const keys = new THREE.Group();
  keys.name = 'keyboard';
  const WHITE = 36;
  const kw = 1.28 / WHITE;
  const keyY = CASE_TOP - 0.012;
  for (let i = 0; i < WHITE; i++) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(kw * 0.9, 0.021, 0.148), M.ivory);
    k.name = `white-${i}`;
    k.position.set(-0.64 + kw * (i + 0.5), keyY, -0.115);
    keys.add(k);
    const step = i % 7;
    if (i < WHITE - 1 && (step === 0 || step === 1 || step === 3 || step === 4 || step === 5)) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(kw * 0.56, 0.017, 0.095), M.ebony);
      b.name = `black-${i}`;
      b.position.set(-0.64 + kw * (i + 1), keyY + 0.019, -0.145);
      keys.add(b);
    }
  }
  piano.add(keys);

  const fallboard = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.016, 0.14), M.ebony);
  fallboard.name = 'fallboard';
  fallboard.position.set(0, CASE_TOP - 0.02, -0.255);
  fallboard.rotation.x = -0.38;
  piano.add(fallboard);

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

  // Legs, pedal lyre.
  const leg = (x: number, z: number, name: string) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.082, LEG_H, 4), M.ebony);
    l.name = name;
    l.rotation.y = Math.PI / 4;
    l.position.set(x, LEG_H / 2, z);
    piano.add(l);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.022, 18), M.brass);
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
  return wrap;
}

/** Dark stage: one spotlight pool, a cool rim, a warm glow inside the case. */
export function createStage(canvas: HTMLCanvasElement, opts: StageOptions = {}): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.3;

  const scene = new THREE.Scene();
  const bg = new THREE.Color(opts.background ?? 0x0b0a09);
  scene.background = bg;
  scene.fog = new THREE.FogExp2(bg, 0.11);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({ name: 'stage-floor', color: 0x211c19, roughness: 0.94, metalness: 0.02 }),
  );
  floor.name = 'stage-floor';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const piano = buildPiano();
  scene.add(piano);

  const spot = new THREE.SpotLight(0xfff2da, 520, 24, 0.72, 0.96, 2);
  spot.position.set(1.5, 5.8, 3.2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0012;
  spot.shadow.camera.near = 0.6;
  spot.shadow.camera.far = 22;
  scene.add(spot);
  scene.add(spot.target);

  const rim = new THREE.DirectionalLight(0x9db4d6, 0.85);
  rim.position.set(-3.4, 2.4, -3.2);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xffe6c2, 0.42);
  fill.position.set(3.2, 1.9, 3.4);
  scene.add(fill);

  const inner = new THREE.PointLight(0xffcf94, 1.9, 3.4, 2);
  inner.position.set(-0.1, 0.95, -0.55);
  scene.add(inner);

  const keyLight = new THREE.PointLight(0xffe9c9, 1.9, 2.6, 2);
  keyLight.position.set(0.1, 1.44, 0.24);
  scene.add(keyLight);

  scene.add(new THREE.HemisphereLight(0x556070, 0x0a0908, 0.16));

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
    setCamera,
    setLid(rad: number) {
      piano.userData.lidPivot.rotation.z = rad;
    },
    render,
    resize,
    dispose() {
      ro.disconnect();
      renderer.dispose();
    },
  };
}
