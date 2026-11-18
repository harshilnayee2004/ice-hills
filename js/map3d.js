import * as THREE from "three";
import { GLTFLoader } from "../assets/vendor/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "../assets/vendor/jsm/loaders/DRACOLoader.js";

const PLACES = [
  {
    id: "meadows",
    title: "Vagamon Meadows",
    tag: "Grasslands",
    drive: "About 20 min",
    text: "Open rolling meadows for walks, picnics and paragliding above the mist.",
    img: "assets/img/places/meadows.webp",
    pos: [-0.0409, 0.006, -0.0524],
  },
  {
    id: "pine",
    title: "Pine Forest",
    tag: "Forest walk",
    drive: "About 25 min",
    text: "Tall pine avenues and quiet paths. The classic Vagamon walk.",
    img: "assets/img/places/pine-forest.webp",
    pos: [-0.0625, -0.002, -0.0252],
  },
  {
    id: "kurisu",
    title: "Kurisumala",
    tag: "Hill & pilgrimage",
    drive: "About 30 min",
    text: "A green hill with a Christian pilgrimage path and wide views over the valley.",
    img: "assets/img/places/kurisumala.webp",
    pos: [-0.0788, 0.0089, 0.013],
  },
  {
    id: "thangal",
    title: "Thangalpara",
    tag: "Rock & view",
    drive: "About 25 min",
    text: "A distinctive rock formation and viewpoint near Kolahalamedu.",
    img: "assets/img/places/thangalpara.webp",
    pos: [-0.025, 0.0077, 0.046],
  },
  {
    id: "marmala",
    title: "Marmala Falls",
    tag: "Waterfall",
    drive: "About 45 min",
    text: "A wooded waterfall trek near Teekoy, a favourite day trip from the hills.",
    img: "assets/img/places/marmala.webp",
    pos: [0.0291, 0.0098, -0.0576],
  },
];

const RESORT = [-0.0006, 0.0077, -0.0113];

function makeCloudMat(map, noise) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: map },
      uNoise: { value: noise },
      uTime: { value: 0 },
      uAlpha: { value: 0.55 },
      uChannel: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap, uNoise;
      uniform float uTime, uAlpha, uChannel;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        float n = texture2D(uNoise, uv * 0.7 + vec2(uTime * 0.015, uTime * -0.01)).r;
        uv += (n - 0.5) * 0.04;
        vec3 c = texture2D(uMap, uv).rgb;
        float a = uChannel < 0.5 ? c.r : (uChannel < 1.5 ? c.g : c.b);
        a = smoothstep(0.12, 0.85, a) * uAlpha;
        if (a < 0.02) discard;
        gl_FragColor = vec4(vec3(1.0), a);
      }
    `,
  });
}

export function createMap3D({ canvas, pinRoot, onSelect }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb7c9b8, 0.85);
  scene.background = new THREE.Color(0xc5d4c6);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 20);
  const camTarget = new THREE.Vector3(RESORT[0], RESORT[1], RESORT[2]);
  let yaw = 0.55, pitch = 0.42, radius = 0.42;
  let yawT = yaw, pitchT = pitch, radiusT = radius;
  let focus = new THREE.Vector3().fromArray(RESORT);
  let focusT = focus.clone();

  const hemi = new THREE.HemisphereLight(0xe8f0ea, 0x3d4f38, 1.15);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.8);
  sun.position.set(0.6, 1.2, 0.4);
  scene.add(hemi, sun);

  const group = new THREE.Group();
  scene.add(group);

  const texLoader = new THREE.TextureLoader();
  const cloudMap = texLoader.load("assets/img/clouds.jpg");
  const noiseMap = texLoader.load("assets/img/clouds-noise.png");
  cloudMap.colorSpace = THREE.SRGBColorSpace;

  const clouds = [];
  for (let i = 0; i < 18; i++) {
    const mat = makeCloudMat(cloudMap, noiseMap);
    mat.uniforms.uChannel.value = i % 3;
    mat.uniforms.uAlpha.value = 0.78 + (i % 4) * 0.05;
    mat.depthTest = false;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + (i % 4) * 0.1, 0.24 + (i % 3) * 0.06), mat);
    mesh.renderOrder = 10;
    mesh.position.set(
      Math.sin(i * 1.7) * 0.4,
      0.11 + (i % 5) * 0.028,
      Math.cos(i * 1.3) * 0.38
    );
    mesh.rotation.x = -0.35;
    mesh.userData = {
      base: mesh.position.clone(),
      speed: 0.006 + (i % 5) * 0.0022,
      phase: i * 0.75,
      spin: (i % 2 ? 1 : -1) * 0.03,
      driftX: 0.12 + (i % 4) * 0.03,
      driftZ: 0.1 + (i % 3) * 0.03,
    };
    group.add(mesh);
    clouds.push(mesh);
  }

  const resortMark = new THREE.Mesh(
    new THREE.SphereGeometry(0.0032, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xc98a45 })
  );
  resortMark.position.fromArray(RESORT);
  resortMark.position.y += 0.004;
  group.add(resortMark);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.006, 0.0072, 48),
    new THREE.MeshBasicMaterial({ color: 0xc98a45, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(resortMark.position);
  group.add(ring);

  let terrain = null;
  const draco = new DRACOLoader();
  draco.setDecoderPath("assets/vendor/draco/");
  const gltf = new GLTFLoader();
  gltf.setDRACOLoader(draco);

  const ready = gltf.loadAsync("assets/map/elevation.glb").then((g) => {
    terrain = g.scene;
    const diffuse = texLoader.load("assets/map/diffuse-summer.jpg");
    diffuse.colorSpace = THREE.SRGBColorSpace;
    diffuse.flipY = false;
    terrain.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({
          map: diffuse,
          roughness: 0.92,
          metalness: 0.02,
        });
        o.castShadow = false;
        o.receiveShadow = true;
      }
    });
    group.add(terrain);
  });

  // Pointer drag
  let dragging = false, lx = 0, ly = 0;
  const onDown = (e) => { dragging = true; lx = e.clientX ?? e.touches?.[0].clientX; ly = e.clientY ?? e.touches?.[0].clientY; };
  const onUp = () => { dragging = false; };
  const onMove = (e) => {
    if (!dragging) return;
    const x = e.clientX ?? e.touches?.[0].clientX;
    const y = e.clientY ?? e.touches?.[0].clientY;
    yawT -= (x - lx) * 0.0045;
    pitchT = Math.max(0.18, Math.min(1.1, pitchT + (y - ly) * 0.003));
    lx = x; ly = y;
  };
  const onWheel = (e) => {
    e.preventDefault();
    radiusT = Math.max(0.22, Math.min(0.72, radiusT + e.deltaY * 0.00035));
  };
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointermove", onMove);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  const pinNodes = PLACES.map((p, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "map-pin";
    el.dataset.id = p.id;
    el.innerHTML = `<i></i><span>${p.title}</span>`;
    pinRoot.appendChild(el);
    el.addEventListener("click", () => select(i));
    return { el, world: new THREE.Vector3(...p.pos), place: p };
  });

  let active = -1;
  function select(i) {
    active = i;
    pinNodes.forEach((n, k) => n.el.classList.toggle("is-active", k === i));
    const p = PLACES[i];
    focusT.set(p.pos[0], p.pos[1], p.pos[2]);
    radiusT = 0.3;
    pitchT = 0.5;
    onSelect?.(i, p);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let running = false, raf = 0, t0 = performance.now();
  const v = new THREE.Vector3();

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;

    yawT += 0.00055;
    yaw += (yawT - yaw) * 0.06;
    pitch += (pitchT - pitch) * 0.06;
    radius += (radiusT - radius) * 0.06;
    focus.lerp(focusT, 0.05);

    camera.position.set(
      focus.x + Math.sin(yaw) * Math.cos(pitch) * radius,
      focus.y + Math.sin(pitch) * radius * 0.95 + 0.02,
      focus.z + Math.cos(yaw) * Math.cos(pitch) * radius
    );
    camera.lookAt(focus.x, focus.y + 0.01, focus.z);

    for (const c of clouds) {
      const { base, speed, phase, spin, driftX, driftZ } = c.userData;
      c.position.x = base.x + Math.sin(t * speed * 10 + phase) * driftX + t * speed * 0.35;
      c.position.z = base.z + Math.cos(t * speed * 8 + phase) * driftZ;
      // Keep clouds looping over the terrain.
      if (c.position.x > 0.55) c.position.x -= 1.1;
      if (c.position.x < -0.55) c.position.x += 1.1;
      c.position.y = base.y + Math.sin(t * 0.4 + phase) * 0.012;
      c.rotation.z = Math.sin(t * 0.25 + phase) * spin;
      c.material.uniforms.uTime.value = t;
      c.quaternion.copy(camera.quaternion);
    }
    ring.scale.setScalar(1 + Math.sin(t * 1.6) * 0.08);

    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const n of pinNodes) {
      v.copy(n.world);
      v.y += 0.006;
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      const behind = v.z > 1;
      n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      n.el.style.opacity = behind ? 0 : 1;
      n.el.style.pointerEvents = behind ? "none" : "auto";
      n.el.style.zIndex = String(1000 + Math.round((1 - v.z) * 100));
    }

    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    resize();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  return {
    places: PLACES,
    ready,
    resize,
    start,
    stop,
    select,
    focusResort() {
      active = -1;
      pinNodes.forEach((n) => n.el.classList.remove("is-active"));
      focusT.fromArray(RESORT);
      radiusT = 0.42;
      pitchT = 0.42;
      onSelect?.(-1, null);
    },
  };
}

export { PLACES };
