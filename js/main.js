import { createHero, createBookSky } from "./hero3d.js";

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isMobile = () => window.innerWidth < 720;

/* ------------------------------------------------------------ Smooth scroll */
const lenis = new Lenis({ duration: 1.25, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
lenis.stop();
window.__lenis = lenis;
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const el = id.length > 1 && $(id);
    if (!el) return;
    e.preventDefault();
    lenis.scrollTo(el, { duration: 1.6 });
  });
});

/* ------------------------------------------------------------ 3D hero */
const hero = createHero({ skyCanvas: $("#sky-canvas"), mistCanvas: $("#mist-canvas") });
const heroSec = $("#hero");

$$(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    $$(".mode-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
    heroSec.dataset.mode = mode;
    hero.setMode(mode);
  });
});

// Split the title into letters for the entrance.
const titleLine = $(".ht-line");
titleLine.innerHTML = [...titleLine.textContent].map((c) => `<span class="ch">${c === " " ? "&nbsp;" : c}</span>`).join("");

gsap.set(".hero-h1 .ch", { yPercent: 110, opacity: 0 });
gsap.set([".hero-eyebrow span", ".hero-script"], { opacity: 0, y: 24 });
gsap.set([".hero-ui", ".hero-bottom", ".hero-scroll-cue", "#top-header"], { opacity: 0 });
gsap.set("#hero-fg", { scale: 1.1, yPercent: 5 });

function heroIntro() {
  hero.playIntro();
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.to("#hero-fg", { scale: 1, yPercent: 0, duration: 2.8, ease: "power3.out" }, 0)
    .to(".hero-eyebrow span", { opacity: 1, y: 0, duration: 1.0 }, 0.55)
    .to(".hero-h1 .ch", { yPercent: 0, opacity: 1, duration: 1.35, stagger: isMobile() ? 0.03 : 0.045 }, 0.7)
    .to(".hero-script", { opacity: 1, y: 0, duration: 1.35 }, 1.15)
    .to("#top-header", { opacity: 1, duration: 1.0 }, 1.35)
    .to(".hero-ui", { opacity: 1, duration: 1.0 }, 1.55)
    .to([".hero-bottom", ".hero-scroll-cue"], { opacity: 1, duration: 0.9 }, 1.75);
  return tl;
}

// Scroll: title lifts, camera pushes in, then soft mist handoff.
const heroTl = gsap.timeline({
  scrollTrigger: {
    trigger: "#hero",
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => hero.setProgress(self.progress),
  },
});
heroTl
  .to([".hero-ui", ".hero-scroll-cue", ".hero-bottom"], { opacity: 0, y: -16, duration: 0.12 }, 0)
  .to(".hero-title-layer", { yPercent: -14, scale: 1.06, duration: 0.5, ease: "none" }, 0)
  .to("#hero-fg", { scale: 1.28, yPercent: 6, duration: 0.6, ease: "power1.in" }, 0)
  .to(".hero-title-layer", { opacity: 0, filter: "blur(8px)", duration: 0.16 }, 0.46)
  .to("#hero-mist-out", { opacity: 1, duration: 0.24, ease: "power1.in" }, 0.6)
  .fromTo("#hero-mist-text", { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.14 }, 0.8)
  .to({}, { duration: 0.06 });

/* ------------------------------------------------------------ Preloader */
const pre = $("#preloader");
const preBar = $("#pre-progress");
const audio = new Audio("assets/audio/ambient.mp3");
audio.loop = true;
audio.volume = 0;
const soundBtn = $("#sound-toggle");

function setSound(on) {
  soundBtn.classList.toggle("is-on", on);
  if (on) {
    audio.play().catch(() => {});
    gsap.to(audio, { volume: 0.55, duration: 2 });
  } else {
    gsap.to(audio, { volume: 0, duration: 0.8, onComplete: () => audio.pause() });
  }
}
soundBtn.addEventListener("click", () => setSound(!soundBtn.classList.contains("is-on")));

const preCount = $("#pre-count");
const preH2 = $("#pre-h2");
preH2.innerHTML = [...preH2.textContent].map((c) => `<span class="ch">${c === " " ? "&nbsp;" : c}</span>`).join("");
gsap.set(".pre-eyebrow span", { yPercent: 80, opacity: 0 });
gsap.set("#pre-h2 .ch", { yPercent: 60, opacity: 0 });
gsap.set(".pre-script", { y: 16, opacity: 0 });
gsap.timeline({ defaults: { ease: "power3.out" } })
  .to(".pre-eyebrow span", { yPercent: 0, opacity: 1, duration: 0.7 }, 0.1)
  .to("#pre-h2 .ch", { yPercent: 0, opacity: 1, duration: 0.85, stagger: 0.028 }, 0.18)
  .to(".pre-script", { y: 0, opacity: 1, duration: 0.9 }, 0.45);

const toLoad = [
  "assets/img/hero-day.webp",
  "assets/img/hero-night.webp",
  "assets/img/clouds.jpg",
];
let loaded = 0;
const setPreProgress = (n) => {
  const pct = Math.min(100, Math.round(n));
  preBar.style.height = `${pct}%`;
  if (preCount) preCount.textContent = String(pct).padStart(2, "0");
};
const bump = () => { loaded++; setPreProgress((loaded / (toLoad.length + 1)) * 100); };

let entered = false;
function enter() {
  if (entered) return;
  entered = true;
  setSound(true);
  pre.classList.add("is-out");
  document.body.classList.remove("is-loading");
  document.body.classList.add("is-entered");
  setTimeout(() => { lenis.start(); }, 420);
  setTimeout(heroIntro, 380);
  setTimeout(() => { if (pre.isConnected) pre.remove(); }, 1800);
}

Promise.all([
  ...toLoad.map((src) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = () => { bump(); res(); }; i.src = src; })),
  document.fonts.ready.then(bump),
  new Promise((res) => setTimeout(res, 1100)),
]).then(() => {
  setPreProgress(100);
  pre.classList.add("is-ready");
  const k = $(".pre-k");
  if (k) k.textContent = "Entering";
  // Brief hold, then curtain lifts straight into the site (with sound).
  setTimeout(enter, 700);
});

/* ------------------------------------------------------------ Pill nav */
const pill = $("#pill-nav");
const indicator = $("#pill-indicator");
const pillLinks = $$("#pill-nav a");
function moveIndicator(link) {
  indicator.style.left = `${link.offsetLeft}px`;
  indicator.style.top = `${link.offsetTop}px`;
  indicator.style.width = `${link.offsetWidth}px`;
  indicator.style.height = `${link.offsetHeight}px`;
  pillLinks.forEach((l) => l.classList.toggle("is-active", l === link));
}
ScrollTrigger.create({
  trigger: "#about",
  start: "top 80%",
  endTrigger: "#footer",
  end: "bottom bottom",
  onToggle: (self) => pill.classList.toggle("is-visible", self.isActive),
});
pillLinks.forEach((link) => {
  const sec = $(`#${link.dataset.target}`);
  if (!sec) return;
  ScrollTrigger.create({
    trigger: sec,
    start: "top 55%",
    end: "bottom 55%",
    onToggle: (self) => self.isActive && moveIndicator(link),
  });
});

/* ------------------------------------------------------------ About: word reveal */
$$("[data-split]").forEach((el) => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(" ");
  const words = $$(".w", el);
  ScrollTrigger.create({
    trigger: el,
    start: "top 80%",
    end: "bottom 45%",
    scrub: true,
    onUpdate: (self) => {
      const n = self.progress * words.length;
      words.forEach((w, i) => { w.style.opacity = Math.max(0.14, Math.min(1, n - i + 0.6)); });
    },
  });
});

$$("[data-parallax]").forEach((fig) => {
  const img = $("img", fig);
  const k = parseFloat(fig.dataset.parallax);
  gsap.fromTo(img, { yPercent: -8 }, { yPercent: 2, ease: "none", scrollTrigger: { trigger: fig, scrub: true } });
  gsap.fromTo(fig, { y: 0 }, { y: k * 400, ease: "none", scrollTrigger: { trigger: fig, scrub: true } });
});

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
}, { threshold: 0.15 });
$$("[data-reveal]").forEach((el, i) => { el.style.setProperty("--d", `${(i % 3) * 0.12}s`); io.observe(el); });

/* ------------------------------------------------------------ Pool: arch window and guided view */
const pool = {
  sec: $("#pool"),
  sticky: $("#pool .arch-sticky"),
  frame: $("#arch-frame"),
  pan: $("#arch-pan"),
  shade: $("#pool .arch-shade"),
  pois: $$("#pool .poi"),
  card: $("#poi-card"),
  n: $("#poi-n"),
  title: $("#poi-title"),
  text: $("#poi-text"),
  bar: $("#poi-bar"),
  fade: $$("#pool .arch-top, #pool .arch-lede, #arch-cue"),
  wordL: $("#pool .at-l > span"),
  wordR: $("#pool .at-r > span"),
  script: $("#pool .at-script > span"),
  stops: [
    { title: "Outdoor pool", text: "Open to the sky, with steps down from the deck and tea right at the edge." },
    { title: "Sun deck", text: "Loungers on a stone deck at the edge of the hill, in the sun all afternoon." },
    { title: "Valley view", text: "Hills, tea and sky all the way to the horizon of the Western Ghats." },
    { title: "Tea garden", text: "Rows of tea run down the slope below the pool. Walk them in the morning mist." },
  ],
  active: -1,
};
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const EXPAND_END = 0.3, TOUR_START = 0.4, SEGMENTS = 5;

function archStart(W, H) {
  return isMobile()
    ? { w: W * 0.66, h: H * 0.5, top: H * 0.34 }
    : { w: Math.min(440, Math.max(270, W * 0.24)), h: H * 0.64, top: H * 0.22 };
}

function poolLayout() {
  const W = window.innerWidth, H = window.innerHeight;
  const a = archStart(W, H);
  pool.sticky.style.setProperty("--arch-w", `${a.w}px`);
  pool.sticky.style.setProperty("--arch-top", `${a.top}px`);
  pool.pw = pool.pan.offsetWidth;
  pool.ph = pool.pan.offsetHeight;
}

function poolCamera(i, W, H) {
  if (i < 0 || i >= pool.pois.length) return { s: 1, x: 0, y: 0 };
  const poi = pool.pois[i];
  const px = parseFloat(poi.style.getPropertyValue("--x")) / 100;
  const py = parseFloat(poi.style.getPropertyValue("--y")) / 100;
  const s = isMobile() ? 1.25 : 1.42;
  const tx = isMobile() ? 0 : W * 0.14;
  const ty = isMobile() ? -H * 0.1 : -H * 0.04;
  const maxX = Math.max(0, (s * pool.pw - W) / 2);
  const maxY = Math.max(0, (s * pool.ph - H) / 2);
  return {
    s,
    x: Math.max(-maxX, Math.min(maxX, tx - s * (px - 0.5) * pool.pw)),
    y: Math.max(-maxY, Math.min(maxY, ty - s * (py - 0.5) * pool.ph)),
  };
}

function setPoolStop(i) {
  if (i === pool.active) return;
  pool.active = i;
  pool.pois.forEach((p, k) => p.classList.toggle("is-active", k === i));
  if (i < 0) return;
  pool.card.classList.add("is-swap");
  clearTimeout(pool.swapT);
  pool.swapT = setTimeout(() => {
    pool.n.textContent = String(i + 1).padStart(2, "0");
    pool.title.textContent = pool.stops[i].title;
    pool.text.textContent = pool.stops[i].text;
    pool.card.classList.remove("is-swap");
  }, 260);
}

function renderPool(p) {
  const W = window.innerWidth, H = window.innerHeight;
  const a = archStart(W, H);

  // Arch opens to the full screen while the words part around it.
  const e = easeIO(clamp01(p / EXPAND_END));
  const w = lerp(a.w, W, e), h = lerp(a.h, H, e);
  const top = lerp(a.top, 0, e), left = (W - w) / 2;
  const r = (w / 2) * (1 - e);
  pool.frame.style.clipPath = `inset(${top}px ${left}px ${H - top - h}px ${left}px round ${r}px ${r}px 0 0)`;

  const spread = isMobile() ? 0 : W * 0.32;
  pool.wordL.style.transform = `translate(${-e * spread}px, ${isMobile() ? -e * 120 : 0}%)`;
  pool.wordR.style.transform = `translate(${e * spread}px, ${isMobile() ? -e * 120 : 0}%)`;
  pool.wordL.style.opacity = pool.wordR.style.opacity = 1 - clamp01(e * 1.8);
  pool.script.style.transform = `translateY(${-e * 60}px)`;
  pool.script.style.opacity = 1 - clamp01(e * 2.2);
  pool.fade.forEach((el) => { el.style.opacity = 1 - clamp01(e * 2.6); });

  // Pins and the info card arrive once the view is open.
  const k = clamp01((p - EXPAND_END - 0.02) / 0.07);
  pool.shade.style.opacity = k;
  pool.card.style.opacity = k;
  pool.card.style.transform = `translateY(${(1 - k) * 30}px)`;
  pool.card.style.pointerEvents = k > 0.5 ? "auto" : "none";

  // Guided tour: glide to each pin, then back out to the full view.
  const q = clamp01((p - TOUR_START) / (1 - TOUR_START)) * SEGMENTS;
  const seg = Math.min(SEGMENTS - 1, Math.floor(q));
  const t = easeIO(clamp01((q - seg) / 0.55));
  const from = poolCamera(seg - 1, W, H);
  const to = poolCamera(seg < pool.pois.length ? seg : -1, W, H);
  const intro = lerp(1.35, 1, e);
  const cam = p < TOUR_START
    ? { s: intro, x: 0, y: 0 }
    : { s: lerp(from.s, to.s, t), x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
  pool.pan.style.transform = `translate(-50%, -50%) translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`;

  const lastOut = clamp01((q - (SEGMENTS - 1)) / 0.5);
  pool.pois.forEach((poi) => {
    poi.style.opacity = k;
    poi.style.transform = `translate(-50%, -100%) scale(${1 / cam.s})`;
  });
  pool.card.style.opacity = k * (1 - lastOut);
  setPoolStop(p < TOUR_START ? (k > 0.5 ? 0 : -1) : Math.min(seg, pool.pois.length - 1));
  pool.bar.style.width = `${clamp01(q / pool.pois.length) * 100}%`;
}

const poolST = ScrollTrigger.create({
  trigger: pool.sec,
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => renderPool(self.progress),
  onRefresh: (self) => { poolLayout(); renderPool(self.progress); },
});
poolLayout();
renderPool(0);

pool.pois.forEach((poi, i) => {
  poi.addEventListener("click", () => {
    const p = TOUR_START + ((i + 0.6) / SEGMENTS) * (1 - TOUR_START);
    lenis.scrollTo(poolST.start + p * (poolST.end - poolST.start), { duration: 1.4 });
  });
});

/* ------------------------------------------------------------ Experiences: stacking */
const stackCards = $$(".stack-card");
stackCards.forEach((card, i) => {
  if (i === stackCards.length - 1) return;
  const shrink = isMobile() ? 0.97 + i * 0.008 : 0.92 + i * 0.015;
  const dim = isMobile() ? 0.9 : 0.82;
  gsap.fromTo(card, { scale: 1, filter: "brightness(1)" }, {
    scale: shrink,
    filter: `brightness(${dim})`,
    ease: "none",
    scrollTrigger: { trigger: stackCards[i + 1], start: "top bottom", end: "top 35%", scrub: true },
  });
});

/* ------------------------------------------------------------ Gallery: columns */
$$(".gcol").forEach((col) => {
  const s = parseFloat(col.dataset.speed) * (isMobile() ? 0.45 : 1);
  gsap.fromTo(col, { yPercent: -s * 60 }, { yPercent: s * 60, ease: "none", scrollTrigger: { trigger: "#gallery", start: "top bottom", end: "bottom top", scrub: true } });
});

/* ------------------------------------------------------------ Booking */
const bookSky = createBookSky($("#book-canvas"));
new IntersectionObserver(([e]) => (e.isIntersecting ? bookSky.start() : bookSky.stop())).observe($("#book"));
new IntersectionObserver(([e]) => (e.isIntersecting ? hero.resume() : hero.pause())).observe(heroSec);

const roomSelect = $("#room-select");
$$("[data-room]").forEach((a) => a.addEventListener("click", () => { roomSelect.value = a.dataset.room; }));

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const inEl = $('[name="in"]'), outEl = $('[name="out"]');
inEl.min = iso(today);
outEl.min = iso(new Date(today.getTime() + 864e5));
inEl.addEventListener("change", () => {
  const next = new Date(new Date(inEl.value).getTime() + 864e5);
  outEl.min = iso(next);
  if (!outEl.value || outEl.value <= inEl.value) outEl.value = iso(next);
});

const toast = $("#toast");
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("is-on");
  setTimeout(() => toast.classList.remove("is-on"), 3800);
}

$("#book-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const fmt = (v) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const msg = [
    "Hello Ice Hills, I would like to check availability.",
    `Name: ${f.get("name")}`,
    `Phone: ${f.get("phone")}`,
    `Dates: ${fmt(f.get("in"))} to ${fmt(f.get("out"))}`,
    `Guests: ${f.get("guests")}`,
    `Room: ${f.get("room")}`,
  ].join("\n");
  window.open(`https://wa.me/919605077755?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  showToast("Opening WhatsApp with your details…");
});

window.addEventListener("load", () => ScrollTrigger.refresh());
