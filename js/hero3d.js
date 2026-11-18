import * as THREE from "three";

const loader = new THREE.TextureLoader();
const cloudTex = loader.load("assets/img/clouds.jpg");
const noiseTex = loader.load("assets/img/clouds-noise.png");
noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;

const MODES = {
  day:   { day: 1, night: 0, mist: 0 },
  night: { day: 0, night: 1, mist: 0 },
  mist:  { day: 0, night: 0, mist: 1 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/* -------------------------------------------------------------------------- */
/* Sky: gradient, sun / moon / stars, layered Ghats ridges and far clouds      */
/* -------------------------------------------------------------------------- */

const skyVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const skyFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uDay, uNight, uMist;
  uniform float uScroll;
  uniform vec2 uMouse;
  uniform float uHorizon;
  uniform float uRidges;
  uniform float uCloudAmt;
  uniform sampler2D uClouds;
  uniform sampler2D uNoise;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(float x) { float i = floor(x); float f = fract(x); float u = f * f * (3.0 - 2.0 * f);
    return mix(hash(vec2(i, 0.0)), hash(vec2(i + 1.0, 0.0)), u); }
  float fbm(float x) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(x); x *= 2.03; a *= 0.5; } return v; }

  vec3 skyCol(float y) {
    vec3 dayTop = vec3(0.20, 0.45, 0.80), dayHz = vec3(0.68, 0.84, 0.96);
    vec3 nightTop = vec3(0.012, 0.025, 0.07), nightHz = vec3(0.09, 0.14, 0.26);
    vec3 mistTop = vec3(0.71, 0.76, 0.79), mistHz = vec3(0.90, 0.92, 0.92);
    float t = pow(clamp(y, 0.0, 1.0), 0.8);
    vec3 d = mix(dayHz, dayTop, t);
    vec3 n = mix(nightHz, nightTop, t);
    vec3 m = mix(mistHz, mistTop, t);
    return d * uDay + n * uNight + m * uMist;
  }

  float cloud(vec2 uv, vec2 c, vec2 size, int ch) {
    vec2 q = (uv - c) / size + 0.5;
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 0.0;
    vec2 n = texture2D(uNoise, q * 0.8 + uTime * 0.004).rg - 0.5;
    vec3 s = texture2D(uClouds, q + n * 0.03).rgb;
    float v = ch == 0 ? s.r : (ch == 1 ? s.g : s.b);
    return smoothstep(0.06, 0.55, v);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * aspect, uv.y);
    vec2 m = uMouse * 0.012;

    float lift = uScroll * 0.10;
    vec3 col = skyCol(uv.y - lift * 0.5);

    // Sun (day) and moon (night).
    vec2 sunPos = vec2(aspect * 0.80, 0.80) + m * 0.5;
    float ds = length(p - sunPos);
    col += vec3(1.0, 0.92, 0.75) * (0.55 * exp(-ds * 6.0) + 0.35 * exp(-ds * 22.0)) * uDay;
    col += vec3(1.0, 0.98, 0.92) * smoothstep(0.030, 0.026, ds) * uDay * 0.6;
    float moon = smoothstep(0.034, 0.030, ds) - smoothstep(0.034, 0.030, length(p - sunPos - vec2(0.012, 0.008))) * 0.85;
    col += vec3(0.95, 0.96, 1.0) * clamp(moon, 0.0, 1.0) * uNight;
    col += vec3(0.45, 0.55, 0.85) * exp(-ds * 9.0) * 0.25 * uNight;
    col += vec3(1.0) * exp(-ds * 4.0) * 0.18 * uMist;

    // Stars.
    vec2 g = floor(p * 180.0);
    float st = hash(g);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + st * 40.0);
    col += vec3(0.9, 0.95, 1.0) * step(0.9965, st) * tw * uNight * smoothstep(0.35, 0.7, uv.y);

    // Far clouds drawn from the Primland cloud atlas.
    float cl = 0.0;
    float shade = 0.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float speed = 0.004 + 0.003 * hash(vec2(fi, 3.0));
      float x = mod(hash(vec2(fi, 1.0)) * (aspect + 1.2) + uTime * speed, aspect + 1.2) - 0.6;
      float y = 0.58 + 0.30 * hash(vec2(fi, 2.0)) - lift;
      vec2 size = vec2(0.85 + 0.6 * hash(vec2(fi, 4.0)), 0.30 + 0.18 * hash(vec2(fi, 5.0)));
      float c = cloud(p + m * (0.4 + fi * 0.08), vec2(x, y), size, int(mod(fi, 3.0)));
      cl = max(cl, c * (0.55 + 0.45 * hash(vec2(fi, 6.0))));
      shade += c * (p.y - y);
    }
    cl *= uCloudAmt;
    vec3 cLight = vec3(1.0) * uDay + vec3(0.20, 0.25, 0.38) * uNight + vec3(0.97) * uMist;
    vec3 cDark = vec3(0.74, 0.80, 0.90) * uDay + vec3(0.06, 0.08, 0.15) * uNight + vec3(0.80, 0.83, 0.85) * uMist;
    vec3 cc = mix(cDark, cLight, clamp(0.55 + shade * 2.0, 0.0, 1.0));
    col = mix(col, cc, cl * 0.85);

    // Layered ridges of the Western Ghats, hazier with distance.
    float hz = uHorizon - uScroll * 0.06;
    vec3 haze = skyCol(0.05);
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      float depth = 1.0 - fk / 4.0;
      float px = p.x * (1.2 + fk * 0.7) + fk * 13.7 + m.x * (1.0 + fk * 2.0) * 10.0;
      float h = hz + 0.035 + 0.11 * depth * 0.6 + (fbm(px) - 0.5) * (0.09 + 0.05 * depth) - fk * 0.035;
      float mask = smoothstep(h + 0.002, h - 0.002, uv.y);
      vec3 rDay = mix(vec3(0.42, 0.56, 0.62), vec3(0.20, 0.34, 0.30), fk / 3.0);
      vec3 rNight = mix(vec3(0.07, 0.10, 0.18), vec3(0.03, 0.05, 0.08), fk / 3.0);
      vec3 rMist = mix(vec3(0.80, 0.84, 0.85), vec3(0.62, 0.68, 0.68), fk / 3.0);
      vec3 rc = rDay * uDay + rNight * uNight + rMist * uMist;
      float hazeAmt = mix(0.75, 0.15, fk / 3.0) * (1.0 + uMist * 0.25);
      rc = mix(rc, haze, clamp(hazeAmt, 0.0, 1.0));
      float valleyMist = smoothstep(h - 0.06, h, uv.y) * 0.35 * (uMist + 0.4);
      rc = mix(rc, haze, valleyMist);
      col = mix(col, rc, mask * uRidges);
    }

    // Low mist band lying in the valleys.
    float band = exp(-pow((uv.y - hz + 0.02) * 14.0, 2.0));
    col = mix(col, haze * 1.04, band * (0.35 + uMist * 0.45) * uRidges);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function createSky(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.dpr || 1.25));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uDay: { value: 1 }, uNight: { value: 0 }, uMist: { value: 0 },
    uScroll: { value: 0 },
    uMouse: { value: new THREE.Vector2() },
    uHorizon: { value: opts.horizon ?? 0.40 },
    uRidges: { value: opts.ridges ?? 1 },
    uCloudAmt: { value: opts.clouds ?? 1 },
    uClouds: { value: cloudTex },
    uNoise: { value: noiseTex },
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: skyVert, fragmentShader: skyFrag, uniforms, depthWrite: false }));
  scene.add(mesh);
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  };
  resize();
  return { renderer, scene, camera, uniforms, resize, render: () => renderer.render(scene, camera) };
}

/* -------------------------------------------------------------------------- */
/* Mist: volumetric-looking cloud cards in front of the resort, plus birds     */
/* -------------------------------------------------------------------------- */

const cloudVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const cloudFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform sampler2D uNoise;
  uniform vec3 uMask;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uSeed;
  uniform vec3 uLight;
  uniform vec3 uShadow;
  void main() {
    vec2 n = texture2D(uNoise, vUv * 0.9 + vec2(uTime * 0.006 + uSeed, uSeed)).rg - 0.5;
    vec3 s = texture2D(uTex, vUv + n * 0.045).rgb;
    float d = dot(s, uMask);
    float a = smoothstep(0.04, 0.6, d) * uOpacity;
    if (a < 0.004) discard;
    vec3 c = mix(uShadow, uLight, clamp(vUv.y * 0.9 + d * 0.5, 0.0, 1.0));
    gl_FragColor = vec4(c, a);
  }
`;

function makeCloud(seed, light, shadow) {
  const ch = Math.floor(seed * 3) % 3;
  const mask = new THREE.Vector3(ch === 0 ? 1 : 0, ch === 1 ? 1 : 0, ch === 2 ? 1 : 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: cloudVert,
    fragmentShader: cloudFrag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTex: { value: cloudTex }, uNoise: { value: noiseTex },
      uMask: { value: mask }, uOpacity: { value: 1 }, uTime: { value: 0 }, uSeed: { value: seed * 10 },
      uLight: { value: light }, uShadow: { value: shadow },
    },
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(2, 1), mat);
}

function makeBird() {
  const g = new THREE.Group();
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.5, 0.06, -0.1, 0.28, 0.0, 0.16], 3));
  const mat = new THREE.MeshBasicMaterial({ color: 0x1e2a30, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const l = new THREE.Mesh(wingGeo, mat);
  const r = new THREE.Mesh(wingGeo, mat);
  r.scale.x = -1;
  g.add(l, r);
  g.userData = { l, r, mat };
  return g;
}

function createMist(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const light = new THREE.Color(1, 1, 1);
  const shadow = new THREE.Color(0.78, 0.84, 0.9);
  const clouds = [];
  const add = (kind, i, x, y, z, w, op) => {
    const seed = (i * 0.618 + kind.length * 0.13) % 1;
    const m = makeCloud(seed, light, shadow);
    m.position.set(x, y, z);
    m.scale.set(w, w * 0.5, 1);
    m.material.uniforms.uOpacity.value = op;
    m.userData = { kind, base: m.position.clone(), w, op, seed, drift: 0.04 + seed * 0.08 };
    scene.add(m);
    clouds.push(m);
    return m;
  };

  // Intro bank: covers the view, then parts.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    add("intro", i, Math.cos(a) * (1 + (i % 3)) * 1.4, Math.sin(a) * (0.6 + (i % 2)) * 1.2, 3 + (i % 5) * 0.9, 9 + (i % 4) * 2.2, 1);
  }
  // Side clouds: frame the scene at the edges and low on the hill.
  const sides = [[-9, -1.6, -2, 12], [9.5, -1.2, -1, 12], [-7.5, 2.8, -4, 10], [8, 3.4, -5, 11], [-4.8, -3.6, 2, 9], [5.4, -3.8, 2.4, 9], [0, -4.6, 1, 14], [-11, 0.6, -6, 13], [11.5, 0.2, -6, 13]];
  sides.forEach(([x, y, z, w], i) => add("side", i, x, y, z, w, 0.85));
  // Dive bank: you fly into these as you scroll.
  for (let i = 0; i < 26; i++) {
    const z = -2 - i * 1.6;
    const x = (Math.sin(i * 2.3) * 0.5 + (i % 2 ? 0.6 : -0.6)) * (2 + (i % 4));
    const y = Math.cos(i * 1.7) * 1.6 - 0.4;
    add("dive", i, x, y, z, 10 + (i % 5) * 2, 0);
  }

  const birds = [];
  for (let i = 0; i < 9; i++) {
    const b = makeBird();
    b.userData.phase = Math.random() * 6.28;
    b.userData.offset = new THREE.Vector3((i % 3) * 0.55 - (i > 4 ? 0.4 : 0), Math.floor(i / 3) * 0.32 + Math.random() * 0.15, -Math.random() * 0.6);
    b.scale.setScalar(0.32 + Math.random() * 0.12);
    scene.add(b);
    birds.push(b);
  }

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 68 : 50;
    camera.updateProjectionMatrix();
  };
  resize();
  return { renderer, scene, camera, clouds, birds, light, shadow, resize };
}

/* -------------------------------------------------------------------------- */
/* Public hero controller                                                      */
/* -------------------------------------------------------------------------- */

export function createHero({ skyCanvas, mistCanvas }) {
  const sky = createSky(skyCanvas);
  const mist = createMist(mistCanvas);

  const state = {
    progress: 0,
    intro: 0,
    introTarget: 0,
    mouse: new THREE.Vector2(),
    mouseTarget: new THREE.Vector2(),
    mode: { ...MODES.day },
    modeTarget: { ...MODES.day },
    running: true,
  };

  const lightDay = new THREE.Color(1, 1, 1), shadowDay = new THREE.Color(0.76, 0.82, 0.9);
  const lightNight = new THREE.Color(0.24, 0.28, 0.4), shadowNight = new THREE.Color(0.05, 0.07, 0.13);
  const lightMist = new THREE.Color(0.97, 0.97, 0.96), shadowMist = new THREE.Color(0.8, 0.83, 0.84);

  window.addEventListener("pointermove", (e) => {
    state.mouseTarget.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  }, { passive: true });

  const onResize = () => { sky.resize(); mist.resize(); };
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  function frame() {
    if (!state.running) return;
    const t = clock.getElapsedTime();

    state.mouse.lerp(state.mouseTarget, 0.05);
    state.intro += (state.introTarget - state.intro) * 0.022;
    for (const k of ["day", "night", "mist"]) state.mode[k] += (state.modeTarget[k] - state.mode[k]) * 0.05;
    const { day, night, mist: mi } = state.mode;
    const p = state.progress;

    // Sky
    const u = sky.uniforms;
    u.uTime.value = t;
    u.uDay.value = day; u.uNight.value = night; u.uMist.value = mi;
    u.uScroll.value = smooth(0, 0.6, p);
    u.uMouse.value.copy(state.mouse);
    u.uCloudAmt.value = 0.9 + mi * 0.4 - night * 0.3;
    sky.render();

    // Mist
    const cLight = lightDay.clone().multiplyScalar(day).add(lightNight.clone().multiplyScalar(night)).add(lightMist.clone().multiplyScalar(mi));
    const cShadow = shadowDay.clone().multiplyScalar(day).add(shadowNight.clone().multiplyScalar(night)).add(shadowMist.clone().multiplyScalar(mi));
    const dive = smooth(0.32, 1.0, p);
    const intro = state.intro;

    for (const c of mist.clouds) {
      const d = c.userData;
      const un = c.material.uniforms;
      un.uTime.value = t;
      un.uLight.value.copy(cLight);
      un.uShadow.value.copy(cShadow);
      if (d.kind === "intro") {
        const out = intro;
        const dir = d.base.clone().setZ(0).normalize();
        if (!isFinite(dir.x)) dir.set(1, 0, 0);
        c.position.set(d.base.x + dir.x * out * 16, d.base.y + dir.y * out * 9, d.base.z + out * 3);
        un.uOpacity.value = d.op * (1 - smooth(0.25, 0.95, out));
        c.visible = un.uOpacity.value > 0.01;
      } else if (d.kind === "side") {
        c.position.x = d.base.x + Math.sin(t * d.drift + d.seed * 6) * 0.8;
        c.position.y = d.base.y + Math.cos(t * d.drift * 0.7 + d.seed * 4) * 0.25 - dive * 2;
        un.uOpacity.value = d.op * (0.75 + mi * 0.35 - night * 0.25) * smooth(0.15, 0.7, intro);
        c.visible = true;
      } else {
        c.position.x = d.base.x + Math.sin(t * d.drift + d.seed * 6) * 0.5;
        un.uOpacity.value = smooth(0.0, 0.35, dive) * (0.9 + mi * 0.1);
        c.visible = un.uOpacity.value > 0.01;
      }
    }

    // Camera: parallax, then the dive into the cloud bank.
    const cam = mist.camera;
    cam.position.x = state.mouse.x * 0.45;
    cam.position.y = state.mouse.y * 0.25 + dive * 0.4;
    cam.position.z = 10 - dive * 44;
    cam.lookAt(state.mouse.x * 0.2, dive * 0.4, cam.position.z - 10);

    // Birds circle slowly across the sky.
    const flockT = (t * 0.035) % 1;
    const fx = lerp(-12, 12, flockT);
    const fy = 2.6 + Math.sin(t * 0.3) * 0.5;
    for (const b of mist.birds) {
      const bd = b.userData;
      const flap = Math.sin(t * 9 + bd.phase) * 0.7;
      bd.l.rotation.z = flap; bd.r.rotation.z = -flap;
      bd.l.rotation.x = bd.r.rotation.x = 0.35;
      b.position.set(fx + bd.offset.x, fy + bd.offset.y + Math.sin(t * 1.3 + bd.phase) * 0.06, -3 + bd.offset.z);
      b.rotation.y = -0.3;
      bd.mat.color.setRGB(0.12 + mi * 0.35, 0.16 + mi * 0.35, 0.2 + mi * 0.35);
      bd.mat.opacity = (0.85 - night * 0.6) * (1 - dive);
    }
    mist.renderer.render(mist.scene, mist.camera);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setProgress(v) { state.progress = v; },
    setMode(name) { state.modeTarget = { ...MODES[name] }; },
    playIntro() { state.introTarget = 1; },
    pause() { state.running = false; },
    resume() { if (!state.running) { state.running = true; clock.getDelta(); requestAnimationFrame(frame); } },
  };
}

/* A calmer sky with ridges and clouds behind the booking form. */
export function createBookSky(canvas) {
  const sky = createSky(canvas, { horizon: 0.34, clouds: 1.2, dpr: 1 });
  sky.uniforms.uDay.value = 0.55;
  sky.uniforms.uMist.value = 0.45;
  let running = false;
  const clock = new THREE.Clock();
  const frame = () => {
    if (!running) return;
    sky.uniforms.uTime.value = 40 + clock.getElapsedTime() * 1.6;
    sky.render();
    requestAnimationFrame(frame);
  };
  window.addEventListener("resize", sky.resize);
  return {
    start() { if (!running) { running = true; requestAnimationFrame(frame); } },
    stop() { running = false; },
  };
}
