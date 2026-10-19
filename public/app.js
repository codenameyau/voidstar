import {
  BLANK,
  COLORS,
  MODES,
  TIMING,
  colorAt,
  colorHex,
  decodePalette,
  encodePalette,
  modeTimeline,
  planProgramming,
  pressesBetween,
} from "./lib/void.js";

const STORAGE_KEY = "voidstar-programmer:v1";
const PRESETS = [
  { name: "Squid", palette: [16, 27, 34] },
  { name: "Fire", palette: [24, 28, 29] },
  { name: "Ocean", palette: [10, 6, 32] },
  { name: "Galaxy", palette: [18, 13, 9] },
  { name: "Aurora", palette: [4, 5, 17] },
  { name: "Sunset", palette: [29, 21, 18] },
  { name: "Neon", palette: [27, 13, 8] },
  { name: "Ice", palette: [25, 32, 34] },
  { name: "Jungle", palette: [4, 27, 2] },
  { name: "Duo", palette: [22, 7, BLANK] },
  { name: "Dusk Duo", palette: [29, 10, BLANK] },
];
const LEAD_IN_BEATS = 2;
const STARS = [
  { id: "moon-vortex-8", name: "Moon Vortex", lights: 8, src: "stars/moon-vortex-8.png" },
  { id: "sherbet-8", name: "Rainbow Sherbet", lights: 8, src: "stars/sherbet-8.png" },
  { id: "mandela-8", name: "Mandela Dreams", lights: 8, src: "stars/mandela-8.png" },
  { id: "moon-vortex-16", name: "Moon Vortex", lights: 16, src: "stars/moon-vortex-16.png" },
  { id: "sherbet-16", name: "Rainbow Sherbet", lights: 16, src: "stars/sherbet-16.png" },
  { id: "mandela-16", name: "Mandela Dreams", lights: 16, src: "stars/mandela-16.png" },
];

const $ = (id) => document.getElementById(id);
const asPalette = (p) => (Array.isArray(p) ? decodePalette(p.join("-")) : null);
const colorName = (id) => (id === BLANK ? "#1 Blank" : `#${id}`);
const isDark = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
};

const state = loadState();

function loadState() {
  const defaults = {
    palette: PRESETS[0].palette,
    mode: 1,
    view: "flowstar",
    star: "moon-vortex-8",
    settings: { startColor: BLANK, carryOver: false, tempo: 2, sound: true },
  };
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {}
  const fromHash = decodePalette(new URLSearchParams(location.hash.slice(1)).get("p") ?? "");
  return {
    palette: fromHash ?? asPalette(stored.palette) ?? defaults.palette,
    mode: MODES.some((m) => m.id === stored.mode) ? stored.mode : defaults.mode,
    view: stored.view === "shake" || stored.view === "light" ? "light" : stored.view === "flowstar" ? "flowstar" : defaults.view,
    star: STARS.some((s) => s.id === stored.star) ? stored.star : defaults.star,
    settings: { ...defaults.settings, ...stored.settings },
    activeSlot: 0,
  };
}

function persist() {
  const { palette, mode, view, star, settings } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ palette, mode, view, star, settings }));
  history.replaceState(null, "", `#p=${encodePalette(palette)}`);
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function swatch(id, className = "swatch") {
  const node = el("span", { className });
  if (id === BLANK) node.classList.add("blank");
  else node.style.background = colorHex(id);
  return node;
}

function paletteDots(palette) {
  return palette.map((id) => swatch(id, "chip-dot"));
}

// ---------- Palette ----------

const slotButtons = [0, 1, 2].map((slot) => {
  const button = el("button", { type: "button", className: "slot" });
  button.addEventListener("click", () => {
    state.activeSlot = slot;
    render();
  });
  return button;
});
$("slots").append(...slotButtons);

function buildChart(container, onPick) {
  return COLORS.map(({ id, hex }) => {
    const button = el("button", {
      type: "button",
      textContent: String(id),
      ariaLabel: id === BLANK ? "Color 1, blank" : `Color ${id}`,
    });
    if (hex) {
      button.style.background = hex;
      if (isDark(hex)) button.style.color = "#fff";
    } else button.classList.add("swatch", "blank");
    button.addEventListener("click", () => onPick(id));
    container.append(button);
    return button;
  });
}

const chartButtons = buildChart($("chart"), (id) => {
  state.palette = state.palette.with(state.activeSlot, id);
  if (state.activeSlot < 2) state.activeSlot += 1;
  paletteChanged();
});

function paletteChanged() {
  persist();
  rebuildTimeline();
  render();
}

function renderPalette() {
  slotButtons.forEach((button, slot) => {
    const id = state.palette[slot];
    button.setAttribute("aria-pressed", String(slot === state.activeSlot));
    button.replaceChildren(
      el("span", { className: "label", textContent: `Color ${slot + 1}` }),
      swatch(id),
      el("span", { className: "value", textContent: colorName(id) }),
    );
  });
  $("slot-hint").textContent = `Choosing Color ${state.activeSlot + 1}. Color #1 is blank (LED off).`;
  const current = state.palette[state.activeSlot];
  chartButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(i + 1 === current)));

  $("presets").replaceChildren(
    ...PRESETS.map(({ name, palette }) => {
      const chip = el("button", { type: "button", className: "chip" }, [...paletteDots(palette), ` ${name}`]);
      chip.addEventListener("click", () => {
        state.palette = palette;
        paletteChanged();
      });
      return chip;
    }),
  );

}

// ---------- Preview ----------

const canvas = $("preview");
const ctx = canvas.getContext("2d");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let timeline;
let playing = !reducedMotion;
let lastFrame = performance.now();

function rebuildTimeline() {
  timeline = modeTimeline(state.mode, state.palette);
}

const trail = document.createElement("canvas");
const trailCtx = trail.getContext("2d");

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  trail.width = canvas.width = Math.round(canvas.clientWidth * dpr);
  trail.height = canvas.height = Math.round(canvas.clientHeight * dpr);
}
new ResizeObserver(resizeCanvas).observe(canvas);

const TAU = 2 * Math.PI;
const FLOWSTAR_SPIN_MS = 480;
// Tips sit this far from the image center, as a fraction of half the image.
const STAR_TIP = 0.88;
const STAR_VALLEY = 0.78;

function currentStar() {
  return STARS.find((s) => s.id === state.star) ?? STARS[0];
}

const starImages = new Map(STARS.map((star) => {
  const img = new Image();
  img.src = star.src;
  return [star.id, img];
}));

function flowstarPose(t, w, h) {
  return {
    cx: w / 2,
    cy: h / 2,
    spin: (t / FLOWSTAR_SPIN_MS) * TAU,
    reach: h * 0.4,
  };
}

function flowstarLights(t, w, h) {
  const { cx, cy, spin, reach } = flowstarPose(t, w, h);
  const count = currentStar().lights;
  return Array.from({ length: count }, (_, i) => {
    const slot = count === 16 ? i / 2 : i;
    const angle = spin - Math.PI / 2 + (slot / 8) * TAU;
    const r = reach * (count === 16 && i % 2 ? STAR_VALLEY : 1);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}

const FABRIC = 480;
const fabric = document.createElement("canvas");
const lightMap = document.createElement("canvas");
fabric.width = lightMap.width = FABRIC;
fabric.height = lightMap.height = FABRIC;
const fabricCtx = fabric.getContext("2d");
const lightCtx = lightMap.getContext("2d");
const preparedStars = new Map();

function preparedStar(id) {
  const cached = preparedStars.get(id);
  if (cached) return cached;
  const img = starImages.get(id);
  if (!img?.complete || !img.naturalWidth) return null;
  const copy = document.createElement("canvas");
  copy.width = copy.height = FABRIC;
  copy.getContext("2d").drawImage(img, 0, 0, FABRIC, FABRIC);
  preparedStars.set(id, copy);
  return copy;
}

const glowCache = new Map();
function glowSprite(hex, diameter, soft) {
  const key = `${hex}:${diameter}:${soft ? 1 : 0}`;
  const cached = glowCache.get(key);
  if (cached) return cached;
  if (glowCache.size > 24) glowCache.clear();
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = diameter;
  const g = sprite.getContext("2d");
  const mid = diameter / 2;
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const grad = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
  if (soft) {
    grad.addColorStop(0, `rgba(${channels},0.9)`);
    grad.addColorStop(0.05, `rgba(${channels},0.4)`);
    grad.addColorStop(0.18, `rgba(${channels},0.14)`);
    grad.addColorStop(0.4, `rgba(${channels},0.045)`);
    grad.addColorStop(0.7, `rgba(${channels},0.012)`);
    grad.addColorStop(1, `rgba(${channels},0)`);
  } else {
    grad.addColorStop(0, `rgba(${channels},1)`);
    grad.addColorStop(0.22, `rgba(${channels},0.7)`);
    grad.addColorStop(1, `rgba(${channels},0)`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, diameter, diameter);
  glowCache.set(key, sprite);
  return sprite;
}

function quantize(hex) {
  const step = (i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) / 32) * 32);
  return `#${[1, 3, 5].map((i) => step(i).toString(16).padStart(2, "0")).join("")}`;
}

function stamp(c, x, y, radius, hex, soft = false) {
  const spread = soft ? 18 : 5;
  const diameter = Math.max(8, Math.min(480, Math.round(radius * spread)));
  const sprite = glowSprite(quantize(hex), diameter, soft);
  c.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
}

function drawFlowstarBody(c, t, w, h, hex, radius) {
  const print = preparedStar(currentStar().id);
  if (!print) return;
  const { cx, cy, spin, reach } = flowstarPose(t, w, h);
  const half = reach / STAR_TIP;
  const lights = flowstarLights(t, w, h);
  const scale = FABRIC / (half * 2);
  const cos = Math.cos(spin);
  const sin = Math.sin(spin);

  fabricCtx.globalCompositeOperation = "source-over";
  fabricCtx.clearRect(0, 0, FABRIC, FABRIC);
  fabricCtx.drawImage(print, 0, 0);
  lightCtx.globalCompositeOperation = "source-over";
  lightCtx.fillStyle = "#0c0c12";
  lightCtx.fillRect(0, 0, FABRIC, FABRIC);
  if (hex) {
    lightCtx.globalCompositeOperation = "lighter";
    const pool = FABRIC * 0.2;
    for (const [x, y] of lights) {
      const dx = (x - cx) * scale;
      const dy = (y - cy) * scale;
      const lx = FABRIC / 2 + dx * cos + dy * sin;
      const ly = FABRIC / 2 - dx * sin + dy * cos;
      const grad = lightCtx.createRadialGradient(lx, ly, 0, lx, ly, pool);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.12, hex);
      grad.addColorStop(1, "#000000");
      lightCtx.fillStyle = grad;
      lightCtx.beginPath();
      lightCtx.arc(lx, ly, pool, 0, TAU);
      lightCtx.fill();
    }
  }
  fabricCtx.globalCompositeOperation = "multiply";
  fabricCtx.drawImage(lightMap, 0, 0);
  fabricCtx.globalCompositeOperation = "destination-in";
  fabricCtx.drawImage(print, 0, 0);
  fabricCtx.globalCompositeOperation = "source-over";

  c.save();
  c.translate(cx, cy);
  c.rotate(spin);
  c.drawImage(fabric, -half, -half, half * 2, half * 2);
  c.restore();
  if (!hex) return;
  for (const [x, y] of lights) stamp(c, x, y, radius * 0.7, hex);
}

const VIEWS = {
  flowstar: {
    label: "Flowstar",
    fade: 0.11,
    radius: 0.034,
    soft: true,
    samples: 1,
    lights: flowstarLights,
    overlay: drawFlowstarBody,
  },
  light: {
    label: "Light",
    fade: 0.07,
    radius: 0.05,
    soft: true,
    lights: (t, w, h) => [[w / 2 + w * 0.4 * Math.sin((t / 900) * TAU), h / 2 + h * 0.22 * Math.sin((t / 450) * TAU)]],
  },
};

const MAX_TRAIL_STEPS = 6;

function drawFrame(now) {
  const { width: w, height: h } = canvas;
  if (!w || !h) {
    lastFrame = now;
    if (playing) requestAnimationFrame(drawFrame);
    return;
  }
  const view = VIEWS[state.view];
  const radius = Math.max(3, h * view.radius);
  const dt = Math.min(40, now - lastFrame);
  const steps = Math.max(1, Math.min(view.samples ?? MAX_TRAIL_STEPS, Math.ceil(dt / 8)));
  const step = dt / steps;
  trailCtx.globalCompositeOperation = "source-over";
  trailCtx.fillStyle = `rgba(0,0,0,${view.fade})`;
  trailCtx.fillRect(0, 0, w, h);
  if (view.soft) trailCtx.globalCompositeOperation = "lighter";
  for (let i = 1; i <= steps; i++) {
    const t = lastFrame + i * step;
    const hex = colorAt(timeline, t);
    if (!hex) continue;
    for (const [x, y] of view.lights(t, w, h)) stamp(trailCtx, x, y, radius, hex, view.soft);
  }
  trailCtx.globalCompositeOperation = "source-over";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(trail, 0, 0);
  view.overlay?.(ctx, now, w, h, colorAt(timeline, now), radius);
  lastFrame = now;
  if (playing) requestAnimationFrame(drawFrame);
}

function startPreview() {
  lastFrame = performance.now();
  if (playing) requestAnimationFrame(drawFrame);
  else drawFrame(lastFrame);
}

const previewWrap = document.querySelector(".preview-wrap");
function fullscreenTarget() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}
function renderFullscreen() {
  const on = fullscreenTarget() === previewWrap;
  const button = $("fullscreen");
  button.textContent = on ? "Exit full screen" : "Full screen";
  button.setAttribute("aria-pressed", String(on));
  requestAnimationFrame(resizeCanvas);
}
$("fullscreen").addEventListener("click", () => {
  if (fullscreenTarget()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    exit.call(document);
    return;
  }
  const request = previewWrap.requestFullscreen || previewWrap.webkitRequestFullscreen;
  const pending = request.call(previewWrap);
  if (pending && typeof pending.catch === "function") pending.catch(() => {});
});
document.addEventListener("fullscreenchange", renderFullscreen);
document.addEventListener("webkitfullscreenchange", renderFullscreen);

const viewButtons = Object.entries(VIEWS).map(([id, { label }]) => {
  const button = el("button", { type: "button", textContent: label });
  button.addEventListener("click", () => {
    state.view = id;
    persist();
    render();
  });
  $("views").append(button);
  return [id, button];
});

function renderViews() {
  viewButtons.forEach(([id, button]) => button.setAttribute("aria-pressed", String(id === state.view)));
  $("preview-note").textContent = state.view === "flowstar"
    ? "Shown in the dark: the print only shows where the lights land. Timings are approximate, and strobes flash."
    : "Timings are approximate, and strobes flash.";
}

function renderStars() {
  const root = $("stars");
  root.replaceChildren();
  for (const count of [8, 16]) {
    const row = el("div", { className: "star-row" });
    for (const star of STARS.filter((s) => s.lights === count)) {
      const button = el("button", {
        type: "button",
        className: "star",
        ariaLabel: `${star.name}, ${count} lights`,
      });
      button.setAttribute("aria-pressed", String(star.id === state.star));
      button.append(el("img", { src: star.src, alt: "" }), el("span", { textContent: star.name }));
      button.addEventListener("click", () => {
        state.star = star.id;
        state.view = "flowstar";
        persist();
        render();
      });
      row.append(button);
    }
    root.append(row);
  }
}

const modeButtons = MODES.map(({ id, name }) => {
  const button = el("button", { type: "button" }, [el("span", { className: "n", textContent: `${id}` }), name]);
  button.addEventListener("click", () => {
    state.mode = id;
    persist();
    rebuildTimeline();
    render();
  });
  $("modes").append(button);
  return button;
});

function renderModes() {
  modeButtons.forEach((b, i) => {
    b.setAttribute("aria-pressed", String(MODES[i].id === state.mode));
  });
}

// ---------- Plan + settings ----------

function currentPlan() {
  return planProgramming(state.palette, state.settings);
}

function renderSummary() {
  const selects = currentPlan().filter((s) => s.type === "select");
  const total = selects.reduce((n, s) => n + s.presses, 0);
  const seconds = total / state.settings.tempo + (LEAD_IN_BEATS * 3) / state.settings.tempo + 30;
  const parts = selects.map((s) => `Color ${s.slot + 1} (${colorName(s.to)}): ${s.presses}`);
  $("plan-summary").replaceChildren(
    el("strong", { textContent: `${total} presses total` }),
    `, about ${Math.max(1, Math.round(seconds / 60))} min with cues.`,
    el("br"),
    el("span", { className: "hint", textContent: parts.join(" · ") }),
  );
}

const startSelect = $("start-color");
COLORS.forEach(({ id }) => startSelect.append(el("option", { value: String(id), textContent: colorName(id) })));

function renderSettings() {
  const { startColor, carryOver, tempo, sound } = state.settings;
  startSelect.value = String(startColor);
  document.querySelector(`input[name="carry"][value="${carryOver ? "carry" : "reset"}"]`).checked = true;
  $("tempo").value = String(tempo);
  $("tempo-out").textContent = String(tempo);
  $("sound").checked = sound;
}

function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  persist();
  render();
}
startSelect.addEventListener("change", () => updateSettings({ startColor: Number(startSelect.value) }));
document.querySelectorAll('input[name="carry"]').forEach((input) =>
  input.addEventListener("change", () => updateSettings({ carryOver: input.value === "carry" })),
);
$("tempo").addEventListener("input", (e) => updateSettings({ tempo: Number(e.target.value) }));
$("sound").addEventListener("change", (e) => updateSettings({ sound: e.target.checked }));

// ---------- Audio cues ----------

let audio;
function tone(freq, ms) {
  if (!state.settings.sound) return;
  audio ??= new AudioContext();
  const start = audio.currentTime;
  const end = start + ms / 1000;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
  gain.gain.setValueAtTime(0.25, Math.max(start + 0.01, end - 0.02));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

// ---------- Coach ----------

const dialog = $("coach");
const coach = { steps: [], index: 0, timers: [] };

function stopCue() {
  coach.timers.forEach(clearTimeout);
  coach.timers = [];
}

function schedule(ms, fn) {
  coach.timers.push(setTimeout(fn, ms));
}

function setBig(content, className = "") {
  const big = $("coach-big");
  big.className = "coach-big";
  void big.offsetWidth; // restart the pulse animation on every beat
  if (className) big.classList.add(...className.split(" "));
  big.replaceChildren(...[content].flat());
}

function leadIn(interval, then) {
  for (let i = 0; i < LEAD_IN_BEATS; i++) {
    schedule(i * interval, () => {
      tone(440, 50);
      setBig(el("span", { className: "of", textContent: `Get ready… ${LEAD_IN_BEATS - i}` }));
    });
  }
  schedule(LEAD_IN_BEATS * interval, then);
}

function playPressCue(step) {
  stopCue();
  const interval = 1000 / state.settings.tempo;
  leadIn(interval, () => {
    for (let k = 1; k <= step.presses; k++) {
      schedule((k - 1) * interval, () => {
        tone(k % 5 === 0 ? 1320 : 880, 60);
        setBig([String(k), el("span", { className: "of", textContent: ` / ${step.presses}` })], "pulse");
      });
    }
    schedule(step.presses * interval, () => {
      $("coach-detail").textContent = `Check that the light shows ${colorName(step.to)}, then continue.`;
      $("coach-next").focus();
    });
  });
}

function playHoldCue(ms) {
  stopCue();
  leadIn(500, () => {
    tone(660, ms);
    const started = performance.now();
    const tick = () => {
      const left = Math.max(0, ms - (performance.now() - started));
      setBig(`${(left / 1000).toFixed(1)} s`, "holding");
      if (left > 0) schedule(50, tick);
      else {
        tone(1320, 120);
        setBig("Release", "holding");
        $("coach-next").focus();
      }
    };
    setBig("Hold now", "holding");
    tick();
  });
}

function openCoach() {
  coach.steps = [{ type: "prep" }, ...currentPlan()];
  coach.index = 0;
  dialog.showModal();
  renderCoach();
}

function replanFrom(index) {
  const fresh = [{ type: "prep" }, ...currentPlan()];
  coach.steps = [...coach.steps.slice(0, index + 1), ...fresh.slice(index + 1)];
}

const COACH_VIEWS = {
  prep: () => ({
    title: "Start with the light off",
    detail: "If it's on, hold the button for 1 second until it turns off.",
    next: "Light is off",
  }),
  enter: (step) => ({
    title: "Hold the button for 2 seconds",
    big: "2.0 s",
    detail: "Release when the white LED blinks once. Don't hold past 3 seconds: that turns on Lock Mode instead.",
    expect: state.settings.startColor,
    expectLabel: "Then it shows",
    cue: ["Play 2-second cue", () => playHoldCue(step.ms)],
    next: "White LED blinked",
    canFix: true,
  }),
  select: (step) => ({
    title: step.presses ? `Press the button ${step.presses} times` : "No presses needed",
    big: step.presses ? ["0", el("span", { className: "of", textContent: ` / ${step.presses}` })] : "0",
    detail: step.presses
      ? `From ${colorName(step.from)} to ${colorName(step.to)}. Click once on each beep, or count yourself.`
      : `The light should already show ${colorName(step.to)}.`,
    expect: step.to,
    expectLabel: "Your light should show",
    cue: step.presses ? ["Start press cue", () => playPressCue(step)] : null,
    next: `It shows ${colorName(step.to)}`,
    canFix: true,
  }),
  save: (step) => ({
    title: `Hold for 1 second to save Color ${step.slot + 1}`,
    big: "1.0 s",
    detail: "Release right after the beep. Holding longer cycles brightness, so let go when it looks right.",
    cue: ["Play 1-second cue", () => playHoldCue(step.ms)],
    next: "Saved",
  }),
  done: () => ({
    title: "Your palette is saved",
    big: "✓",
    detail: "Click the button to cycle through the 9 modes. These colors stay until you reprogram or factory reset.",
    next: "Finish",
  }),
};

function renderCoach() {
  stopCue();
  const step = coach.steps[coach.index];
  const view = COACH_VIEWS[step.type](step);
  const total = coach.steps.length;

  $("coach-step").textContent = `Step ${coach.index + 1} of ${total}`;
  $("coach-bar").style.width = `${((coach.index + 1) / total) * 100}%`;
  $("coach-slots").replaceChildren(
    ...state.palette.map((id, slot) => {
      const saved = coach.steps.findIndex((s) => s.type === "save" && s.slot === slot) < coach.index;
      const chip = el("span", { className: "s" }, [swatch(id, "chip-dot"), `Color ${slot + 1} ${saved ? "✓" : colorName(id)}`]);
      chip.classList.toggle("active", step.slot === slot);
      chip.classList.toggle("saved", saved);
      return chip;
    }),
  );
  $("coach-title").textContent = view.title;
  setBig(view.big ?? "");
  $("coach-detail").textContent = view.detail;
  $("coach-expect").replaceChildren(
    ...(view.expect
      ? [`${view.expectLabel}:`, swatch(view.expect), el("strong", { textContent: colorName(view.expect) })]
      : []),
  );
  if (view.expect === BLANK) $("coach-expect").append(" (LED off)");

  $("coach-fix").hidden = true;
  $("coach-wrong").hidden = !view.canFix;
  $("coach-back").disabled = coach.index === 0;
  $("coach-next").textContent = view.next;
  const cue = $("coach-cue");
  cue.hidden = !view.cue;
  if (view.cue) {
    cue.textContent = view.cue[0];
    cue.onclick = view.cue[1];
  }
  (view.cue ? cue : $("coach-next")).focus();
}

buildChart($("fix-chart"), (observed) => {
  const step = coach.steps[coach.index];
  if (step.type !== "enter" && step.type !== "select") return;
  if (step.type === "enter") {
    state.settings = { ...state.settings, startColor: observed };
    persist();
    render();
    replanFrom(coach.index);
  } else {
    coach.steps[coach.index] = { ...step, from: observed, presses: pressesBetween(observed, step.to) };
  }
  renderCoach();
});

$("coach-wrong").addEventListener("click", () => {
  stopCue();
  $("coach-fix").hidden = !$("coach-fix").hidden;
});
$("coach-back").addEventListener("click", () => {
  coach.index = Math.max(0, coach.index - 1);
  renderCoach();
});
$("coach-next").addEventListener("click", () => {
  if (coach.index === coach.steps.length - 1) {
    dialog.close();
    return;
  }
  coach.index += 1;
  renderCoach();
});
dialog.addEventListener("close", () => {
  if (!dialog.open) stopCue();
});
$("start-coach").addEventListener("click", openCoach);

// ---------- Boot ----------

function render() {
  renderPalette();
  renderModes();
  renderViews();
  renderStars();
  renderSettings();
  renderSummary();
}

rebuildTimeline();
render();
persist();
startPreview();
