import * as THREE from 'three';

export type CharacterGender = 'male' | 'female';
export type CharacterOutfit = 'explorer' | 'suit' | 'dress';
export type CharacterController = {
  setCharacter: (gender: CharacterGender, outfit: string) => void;
  setQuiet: (quiet: boolean) => void;
  setVisible: (visible: boolean) => void;
  turn: (radians: number) => void;
  reset: () => void;
  wave: () => void;
  dispose: () => void;
};

const FRONT = -.13;
const FRAME_MS = 1000 / 30;

// Geometry and materials are shared within each character and disposed together.
// Keeping the entire model procedural avoids model/image requests on first entry.
export function createCharacterModel(gender: CharacterGender, outfit: CharacterOutfit) {
  const root = new THREE.Group();
  root.name = `life-rpg-${gender}-${outfit}`;
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  resources.add(sphere);
  const mat = (color: string, roughness = .58, metalness = 0) => {
    const key = `${color}:${roughness}:${metalness}`;
    if (!materials.has(key)) {
      const material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      materials.set(key, material);
      resources.add(material);
    }
    return materials.get(key)!;
  };
  const skin = mat('#edbe97');
  const skinLight = mat('#f3cca9');
  const hair = mat(gender === 'female' ? '#493140' : '#493331', .86);
  const hairLight = mat(gender === 'female' ? '#62404f' : '#62443c', .78);
  const violet = mat('#8470c4');
  const lightViolet = mat('#b19ade');
  const darkViolet = mat('#453557');
  const midnight = mat('#262638');
  const cream = mat('#f5e7d2');
  const gold = mat('#e5bd70', .35, .45);
  const mint = mat('#92dcd1', .4, .12);
  const body = new THREE.Group();
  root.add(body);
  const ellipsoid = (parent: THREE.Object3D, material: THREE.Material, p: number[], s: number[]) => {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.set(p[0], p[1], p[2]);
    mesh.scale.set(s[0], s[1], s[2]);
    parent.add(mesh);
    return mesh;
  };
  const customMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, p = [0, 0, 0]) => {
    resources.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(p[0], p[1], p[2]);
    parent.add(mesh);
    return mesh;
  };
  const lathe = (parent: THREE.Object3D, material: THREE.Material, points: number[][], p = [0, 0, 0], depth = 1) => {
    const mesh = customMesh(parent, new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 28), material, p);
    mesh.scale.z = depth;
    return mesh;
  };
  const tube = (parent: THREE.Object3D, material: THREE.Material, points: number[][], thickness: number, segments = 12) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number])));
    return customMesh(parent, new THREE.TubeGeometry(curve, segments, thickness, 7, false), material);
  };
  const cylinder = (parent: THREE.Object3D, material: THREE.Material, radius: number, height: number, p: number[], bottom = radius) =>
    customMesh(parent, new THREE.CylinderGeometry(radius, bottom, height, 24), material, p);
  const star = (parent: THREE.Object3D, material: THREE.Material, radius: number, position: number[]) => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 ? radius * .46 : radius;
      const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
      if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
    }
    shape.closePath();
    return customMesh(parent, new THREE.ExtrudeGeometry(shape, { depth: .024, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 1, steps: 1 }), material, position);
  };

  // Boots, legs and a rounded tailored torso share the same silhouette across outfits.
  const legMaterial = outfit === 'suit' ? midnight : darkViolet;
  for (const side of [-1, 1]) {
    ellipsoid(body, legMaterial, [side * .21, .93, 0], [.155, .64, .165]);
    ellipsoid(body, midnight, [side * .21, .30, .07], [.21, .22, .32]);
    ellipsoid(body, darkViolet, [side * .21, .18, .11], [.215, .095, .335]);
    cylinder(body, gold, .164, .045, [side * .21, .43, 0]);
  }
  const torsoMaterial = outfit === 'suit' ? midnight : violet;
  lathe(body, torsoMaterial, [[0, 1.42], [.31, 1.42], [.39, 1.5], [.43, 2.03], [.39, 2.4], [.29, 2.53], [0, 2.53]], [0, 0, 0], .74);
  ellipsoid(body, skin, [0, 2.58, 0], [.18, .23, .18]);
  const shoulders = gender === 'female' ? .43 : .46;
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * shoulders, 2.36, 0);
    arm.rotation.z = side * .16;
    body.add(arm);
    arms.push(arm);
    const sleeve = outfit === 'dress' ? skin : torsoMaterial;
    ellipsoid(arm, sleeve, [side * .03, -.28, .005], [.155, .37, .155]);
    ellipsoid(arm, outfit === 'dress' ? skin : torsoMaterial, [side * .035, -.70, .025], [.13, .26, .13]);
    cylinder(arm, outfit === 'dress' ? gold : lightViolet, .137, .10, [side * .035, -.88, .03]);
    ellipsoid(arm, skinLight, [side * .035, -1, .05], [.135, .175, .13]);
    ellipsoid(arm, skin, [side * -.073, -.973, .107], [.066, .095, .066]);
  }

  if (outfit === 'explorer') {
    // A small backpack is visible when the player rotates their explorer.
    ellipsoid(body, darkViolet, [0, 2.02, -.37], [.35, .47, .17]);
    ellipsoid(body, violet, [0, 1.93, -.51], [.25, .26, .095]);
    for (const side of [-1, 1]) {
      tube(body, darkViolet, [[side * .28, 2.46, .07], [side * .30, 2.1, .32], [side * .24, 1.68, .25]], .036);
      cylinder(body, gold, .055, .055, [side * .26, 1.98, .325]).rotation.x = Math.PI / 2;
    }
    lathe(body, lightViolet, [[.17, 2.51], [.27, 2.48], [.31, 2.57], [.28, 2.66], [.18, 2.69]], [0, 0, 0], .82);
    tube(body, lightViolet, [[.13, 2.56, .24], [.17, 2.36, .34], [.26, 2.21, .34]], .076);
    tube(body, mint, [[-.10, 2.47, .32], [0, 2.37, .35], [.1, 2.47, .32]], .015);
    star(body, gold, .078, [0, 2.25, .335]);
    lathe(body, darkViolet, [[.385, 1.65], [.385, 1.76]], [0, 0, 0], .76);
    const buckle = customMesh(body, new THREE.TorusGeometry(.069, .014, 6, 18), gold, [0, 1.70, .302]);
    buckle.scale.x = 1.3;
    ellipsoid(body, darkViolet, [.28, 1.51, .19], [.105, .15, .1]);
  } else if (outfit === 'suit') {
    ellipsoid(body, cream, [0, 2.26, .275], [.18, .27, .06]);
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(side * .27, 2.50); shape.lineTo(side * .04, 2.09); shape.lineTo(side * .30, 2.29); shape.lineTo(side * .38, 2.43); shape.closePath();
      customMesh(body, new THREE.ExtrudeGeometry(shape, { depth: .02, bevelEnabled: false }), darkViolet, [0, 0, .292]);
      ellipsoid(body, gold, [side * .09, 2.38, .34], [.079, .048, .028]).rotation.z = side * -.4;
    }
    ellipsoid(body, gold, [0, 2.38, .36], [.034, .037, .026]);
    for (const y of [1.84, 2.00]) ellipsoid(body, gold, [0, y, .331], [.027, .027, .014]);
    star(body, gold, .065, [-.23, 2.26, .331]);
    tube(body, gold, [[.10, 1.98, .32], [.24, 1.89, .31], [.30, 2.02, .30]], .008);
  } else {
    // A sculpted bell skirt is modeled around the same legs/body, not a replacement character.
    lathe(body, violet, [[0, .53], [.60, .53], [.65, .61], [.57, .95], [.47, 1.25], [.34, 1.64], [.33, 1.74]], [0, 0, 0], .82);
    lathe(body, lightViolet, [[.6, .56], [.635, .60], [.625, .65]], [0, 0, 0], .82);
    for (const x of [-.4, -.2, 0, .2, .4]) {
      tube(body, lightViolet, [[x * .48, 1.61, .29], [x * .75, 1.20, .37], [x, .68, .45 - Math.abs(x) * .20]], .012);
    }
    lathe(body, gold, [[.346, 1.64], [.346, 1.72]], [0, 0, 0], .82);
    star(body, gold, .074, [0, 1.68, .296]);
    tube(body, gold, [[-.20, 2.49, .16], [0, 2.34, .325], [.20, 2.49, .16]], .017);
    ellipsoid(body, mint, [0, 2.31, .34], [.044, .061, .022]);
    for (const side of [-1, 1]) ellipsoid(body, lightViolet, [side * .38, 2.32, .015], [.20, .17, .175]);
  }

  const head = new THREE.Group();
  head.position.y = 3.30;
  body.add(head);
  ellipsoid(head, skinLight, [0, 0, 0], [.65, .74, .58]);
  for (const side of [-1, 1]) {
    ellipsoid(head, skin, [side * .65, -.02, -.01], [.10, .16, .095]);
    ellipsoid(head, skinLight, [side * .67, -.015, .034], [.045, .087, .047]);
  }
  const hairCap = customMesh(head, new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * .51), hair, [0, .13, -.035]);
  hairCap.scale.set(.70, .67, .62);
  if (gender === 'male') {
    // Asymmetric swept locks give the hair a sculpted toy-model silhouette.
    for (const [x, y, z, sx, sy, rz] of [[-.45, .42, .40, .30, .20, -.4], [-.14, .50, .49, .33, .22, -.3], [.20, .50, .43, .30, .21, .15], [.48, .35, .28, .18, .24, .35], [-.57, .17, .0, .11, .25, -.3]]) {
      const lock = ellipsoid(head, hair, [x, y, z], [sx, sy, .19]);
      lock.rotation.z = rz;
    }
    tube(head, hairLight, [[-.52, .47, .44], [-.32, .61, .57], [-.04, .60, .60]], .017);
    tube(head, hairLight, [[-.14, .61, .52], [.10, .68, .48], [.34, .55, .44]], .014);
  } else {
    ellipsoid(head, hair, [0, -.08, -.43], [.66, .69, .25]);
    for (const side of [-1, 1]) {
      tube(head, hair, [[side * .51, .45, .19], [side * .65, .06, .15], [side * .65, -.40, .03], [side * .46, -.72, -.06]], .155, 16);
      tube(head, hairLight, [[side * .55, .35, .30], [side * .69, -.12, .24], [side * .57, -.55, .12]], .021);
      ellipsoid(head, hair, [side * .43, .51, .38], [.30, .20, .15]).rotation.z = side * .31;
      ellipsoid(head, gold, [side * .65, -.20, .06], [.043, .054, .026]);
    }
    ellipsoid(head, hair, [-.12, .54, .47], [.37, .19, .15]).rotation.z = -.24;
    tube(head, hairLight, [[-.48, .51, .49], [-.24, .63, .58], [.07, .65, .53]], .016);
    star(head, gold, .08, [.53, .28, .42]).rotation.z = -.2;
  }

  const eyes: THREE.Group[] = [];
  const white = mat('#fff7eb', .35);
  const iris = mat('#654a45', .45);
  const pupil = mat('#252031', .28);
  const sparkle = mat('#ffffff', .12);
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * .229, .015, .528);
    eye.rotation.y = side * .12;
    head.add(eye);
    eyes.push(eye);
    ellipsoid(eye, white, [0, 0, 0], [.118, .151, .053]);
    ellipsoid(eye, iris, [.007, -.009, .048], [.077, .104, .027]);
    ellipsoid(eye, pupil, [.013, -.004, .069], [.046, .069, .014]);
    ellipsoid(eye, sparkle, [-.019, .041, .080], [.023, .029, .012]);
    ellipsoid(eye, sparkle, [.040, -.048, .077], [.009, .010, .009]);
    tube(head, hair, [[side * .13, .238, .535], [side * .23, .26, .535], [side * .33, .23, .487]], .024);
    if (gender === 'female') tube(head, hair, [[side * .32, .085, .549], [side * .355, .121, .546]], .015, 4);
    const blush = mat('#df9c95', .9);
    ellipsoid(head, blush, [side * .39, -.17, .462], [.093, .042, .012]).rotation.y = side * .4;
  }
  ellipsoid(head, skin, [0, -.12, .583], [.080, .094, .086]);
  ellipsoid(head, skinLight, [-.012, -.104, .647], [.043, .041, .022]);
  tube(head, mat('#a76469'), [[-.10, -.268, .541], [0, -.296, .574], [.10, -.268, .541]], .016);
  ellipsoid(head, skin, [0, -.39, .496], [.11, .04, .012]);

  return {
    root,
    body,
    head,
    eyes,
    waveArm: arms[0],
    dispose: () => { resources.forEach(resource => resource.dispose()); root.clear(); },
  };
}

export function createCharacterRenderer(canvas: HTMLCanvasElement, initial: { gender: CharacterGender; outfit?: string; quiet?: boolean; onError?: () => void }): CharacterController {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 30);
  camera.position.set(0, 2.75, 7.8);
  camera.lookAt(0, 2.16, 0);
  scene.add(new THREE.HemisphereLight('#ece4ff', '#30223d', 2.6));
  const key = new THREE.DirectionalLight('#fff1d9', 3.0);
  key.position.set(-3, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ae97ff', 2.8);
  rim.position.set(3, 3, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#b8e7ef', .75);
  fill.position.set(3, 1, 4);
  scene.add(fill);

  const platformResources: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const addPlatform = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;
    scene.add(mesh);
    platformResources.push(geometry, material);
    return mesh;
  };
  addPlatform(new THREE.CylinderGeometry(1.0, 1.04, .16, 48), new THREE.MeshStandardMaterial({ color: '#2e244d', roughness: .58, metalness: .15 }), .015);
  const ring = addPlatform(new THREE.TorusGeometry(.98, .014, 7, 48), new THREE.MeshStandardMaterial({ color: '#bea5e8', emissive: '#6c44b0', emissiveIntensity: .45, roughness: .4, metalness: .3 }), .11);
  ring.rotation.x = Math.PI / 2;
  // A feathered contact shadow costs one draw call and needs no shadow map render.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 63);
    gradient.addColorStop(0, 'rgba(8,4,17,.8)'); gradient.addColorStop(.45, 'rgba(8,4,17,.42)'); gradient.addColorStop(1, 'rgba(8,4,17,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(shadowCanvas);
    platformResources.push(texture);
    const shadow = addPlatform(new THREE.PlaneGeometry(1.6, 1.35), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }), .103);
    shadow.rotation.x = -Math.PI / 2;
  }
  const normalizeOutfit = (outfit?: string): CharacterOutfit => outfit === 'suit' || outfit === 'dress' ? outfit : 'explorer';
  let model = createCharacterModel(initial.gender, normalizeOutfit(initial.outfit));
  model.root.position.y = .015;
  scene.add(model.root);
  let quiet = Boolean(initial.quiet), visible = true, disposed = false;
  let yaw = FRONT, targetYaw = FRONT, waveStarted = -1, request = 0, lastFrame = 0, dirty = true;
  let characterGender = initial.gender, characterOutfit = normalizeOutfit(initial.outfit);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const documentVisible = () => document.visibilityState !== 'hidden';
  const schedule = () => {
    if (!disposed && visible && documentVisible() && !request) request = requestAnimationFrame(frame);
  };
  const frame = (now: number) => {
    request = 0;
    if (disposed || !visible || !documentVisible()) return;
    const idle = !quiet && !reducedMotion.matches;
    const interacting = Math.abs(yaw - targetYaw) > .001 || waveStarted >= 0;
    if (now - lastFrame >= FRAME_MS && (idle || interacting || dirty)) {
      lastFrame = now - (now - lastFrame) % FRAME_MS;
      yaw += (targetYaw - yaw) * .24;
      model.root.rotation.y = yaw;
      const t = now / 1000;
      model.body.position.y = idle ? Math.sin(t * 1.8) * .018 : 0;
      model.head.rotation.z = idle ? Math.sin(t * .85) * .013 : 0;
      const blinkPhase = t % 4.8;
      const blink = idle && blinkPhase < .15 ? Math.max(.08, Math.abs(blinkPhase - .075) / .075) : 1;
      model.eyes.forEach(eye => { eye.scale.y = blink; });
      model.waveArm.rotation.z = -.16;
      model.waveArm.rotation.x = 0;
      if (waveStarted >= 0) {
        const elapsed = (now - waveStarted) / 1000;
        if (elapsed > 1.7) waveStarted = -1;
        else {
          const envelope = Math.min(1, elapsed * 5, (1.7 - elapsed) * 5);
          model.waveArm.rotation.z = -.16 + envelope * (2.2 + Math.sin(elapsed * 16) * .24);
          model.waveArm.rotation.x = envelope * -.25;
        }
      }
      renderer.render(scene, camera);
      dirty = false;
    }
    if (idle || interacting || dirty) schedule();
  };
  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    // Limit the backing surface as well as DPR on large desktop character panels.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5, 850 / width, 850 / height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // A narrow phone panel still needs the whole pedestal and both hands visible.
    camera.position.z = Math.max(7.8, 4.35 / Math.max(.55, camera.aspect));
    camera.updateProjectionMatrix();
    dirty = true; schedule();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const onVisibility = () => {
    if (!documentVisible() && request) { cancelAnimationFrame(request); request = 0; }
    else { dirty = true; schedule(); }
  };
  const onMotion = () => { dirty = true; schedule(); };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    if (request) cancelAnimationFrame(request);
    request = 0;
    initial.onError?.();
  };
  document.addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener('change', onMotion);
  canvas.addEventListener('webglcontextlost', onContextLost);
  resize();
  return {
    setCharacter(gender, outfit) {
      const normalized = normalizeOutfit(outfit);
      if (characterGender === gender && characterOutfit === normalized) return;
      const previous = model;
      model = createCharacterModel(gender, normalized);
      model.root.position.y = .015;
      scene.remove(previous.root);
      previous.dispose();
      renderer.renderLists.dispose();
      scene.add(model.root);
      characterGender = gender; characterOutfit = normalized;
      waveStarted = -1;
      dirty = true; schedule();
    },
    setQuiet(next) { quiet = next; dirty = true; schedule(); },
    setVisible(next) {
      visible = next;
      if (!next && request) { cancelAnimationFrame(request); request = 0; }
      if (next) { dirty = true; schedule(); }
    },
    turn(radians) { targetYaw += radians; dirty = true; schedule(); },
    reset() { targetYaw = FRONT; waveStarted = -1; dirty = true; schedule(); },
    wave() { waveStarted = performance.now(); dirty = true; schedule(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (request) cancelAnimationFrame(request);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotion);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      model.dispose();
      platformResources.forEach(resource => resource.dispose());
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
