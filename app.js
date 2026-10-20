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
  { name: "Duo", palette: [22, 7, BLANK] },
];
const LEAD_IN_BEATS = 2;
const STARS = [
  { id: "moon-vortex", name: "Moon Vortex", front: "stars/moon-vortex-8.png", back: "stars/moon-vortex-16.png" },
  { id: "sherbet", name: "Rainbow Sherbet", front: "stars/sherbet-8.png", back: "stars/sherbet-16.png" },
  { id: "mandela", name: "Mandela Dreams", front: "stars/mandela-8.png", back: "stars/mandela-16.png" },
];
const LEGACY_STARS = {
  "moon-vortex-8": ["moon-vortex", "front"],
  "moon-vortex-16": ["moon-vortex", "back"],
  "sherbet-8": ["sherbet", "front"],
  "sherbet-16": ["sherbet", "back"],
  "mandela-8": ["mandela", "front"],
  "mandela-16": ["mandela", "back"],
};

const $ = (id) => document.getElementById(id);
const asPalette = (p) => (Array.isArray(p) ? decodePalette(p.join("-")) : null);
const colorName = (id) => (id === BLANK ? "#1 Blank" : `#${id}`);
const modeName = (id) => `${id} ${MODES.find((m) => m.id === id)?.name ?? ""}`.trim();
const USER_ICON = "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0";
const FLIP_ICON = "M4 8h13l-3-3M20 16H7l3 3";
const isDark = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
};

const LIGHT_COUNT = 8;
const IDEA_NAME_MAX = 24;
const state = loadState();

function loadState() {
  const defaults = {
    palette: PRESETS[0].palette,
    mode: MODES.find((m) => m.name === "Smooth Cycle").id,
    star: "moon-vortex",
    face: "front",
    settings: { startColor: BLANK, carryOver: false, tempo: 2, sound: true, handsFree: true },
  };
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {}
  const fromHash = decodePalette(new URLSearchParams(location.hash.slice(1)).get("p") ?? "");
  const palette = asPalette(stored.palette) ?? defaults.palette;
  const mode = MODES.some((m) => m.id === stored.mode) ? stored.mode : defaults.mode;
  const storedLights = Array.isArray(stored.lights) ? stored.lights : [];
  const lights = Array.from({ length: LIGHT_COUNT }, (_, i) => {
    const saved = storedLights[i];
    const savedPalette = asPalette(saved?.palette);
    const savedMode = MODES.some((m) => m.id === saved?.mode) ? saved.mode : null;
    return {
      palette: savedPalette ? [...savedPalette] : [...palette],
      mode: savedMode ?? mode,
    };
  });
  const selectedLight = Number.isInteger(stored.selectedLight) && stored.selectedLight >= 0 && stored.selectedLight < LIGHT_COUNT
    ? stored.selectedLight
    : 0;
  const programAll = stored.programAll !== false;
  let allProgram = readProgram(stored.allProgram);
  if (fromHash) {
    if (programAll) {
      allProgram = {
        palette: [...fromHash],
        mode: allProgram?.mode ?? lights[selectedLight].mode,
      };
    } else {
      lights[selectedLight].palette = [...fromHash];
    }
  } else if (programAll && !allProgram) {
    allProgram = { palette: [...lights[selectedLight].palette], mode: lights[selectedLight].mode };
  }
  const active = programAll ? allProgram : lights[selectedLight];
  return {
    lights,
    selectedLight,
    allProgram,
    palette: [...active.palette],
    mode: active.mode,
    varySpin: stored.varySpin === true,
    ledsOn: stored.ledsOn !== false,
    programAll,
    applyAll: stored.applyAll === true,
    savedIdeas: readIdeas(stored.savedIdeas) ?? [],
    ...storedStar(stored, defaults),
    settings: { ...defaults.settings, ...stored.settings },
    activeSlot: 0,
  };
}

function readProgram(saved) {
  const palette = asPalette(saved?.palette);
  const mode = MODES.some((m) => m.id === saved?.mode) ? saved.mode : null;
  return palette && mode ? { palette: [...palette], mode } : null;
}

function readIdea(saved) {
  const name = typeof saved?.name === "string" ? saved.name.trim() : "";
  const program = readProgram(saved);
  if (!name || name.length > IDEA_NAME_MAX || !program) return null;
  return { name, ...program };
}

function readIdeas(saved) {
  if (!Array.isArray(saved)) return null;
  const ideas = saved.map(readIdea);
  return ideas.every(Boolean) ? ideas : null;
}

function storedStar(stored, defaults) {
  const legacy = LEGACY_STARS[stored.star];
  const star = legacy?.[0] ?? (STARS.some((s) => s.id === stored.star) ? stored.star : defaults.star);
  const face = stored.face === "back" || stored.face === "front"
    ? stored.face
    : legacy?.[1] ?? defaults.face;
  return { star, face };
}

function syncActiveProgram() {
  const program = { palette: [...state.palette], mode: state.mode };
  if (state.programAll) state.allProgram = program;
  else state.lights[state.selectedLight] = program;
}

function persist() {
  syncActiveProgram();
  const { lights, selectedLight, allProgram, palette, mode, varySpin, ledsOn, star, face, settings, programAll, applyAll, savedIdeas } = state;
  const saved = { lights, selectedLight, palette, mode, varySpin, ledsOn, star, face, settings, programAll, applyAll, savedIdeas };
  if (allProgram) saved.allProgram = { palette: [...allProgram.palette], mode: allProgram.mode };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
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
  const slot = state.activeSlot;
  state.palette = state.palette.with(slot, id);
  state.activeSlot = (slot + 1) % 3;
  paletteChanged({ slot });
});

function mirrorProgram({ palette = false, mode = false, slot = null } = {}) {
  if (state.programAll || !state.applyAll) return;
  for (const light of state.lights) {
    if (slot != null) light.palette[slot] = state.palette[slot];
    else if (palette) light.palette = [...state.palette];
    if (mode) light.mode = state.mode;
  }
}

function paletteChanged(fields) {
  mirrorProgram(fields);
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
  const current = state.palette[state.activeSlot];
  chartButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(i + 1 === current)));

  const samePalette = (palette) => palette.every((id, i) => id === state.palette[i]);
  $("presets").replaceChildren(
    ...PRESETS.map(({ name, palette }) => {
      const chip = el("button", { type: "button", className: "chip" }, [
        ...paletteDots(palette),
        el("span", { className: "chip-name", textContent: name }),
      ]);
      chip.setAttribute("aria-pressed", String(samePalette(palette)));
      chip.addEventListener("click", () => {
        state.palette = palette;
        paletteChanged({ palette: true });
      });
      return chip;
    }),
    ...state.savedIdeas.map(({ name, palette, mode }) => {
      const chip = el("button", {
        type: "button",
        className: "chip",
        ariaLabel: `${name}, your idea, ${modeName(mode)}`,
        title: `${name} · ${modeName(mode)}`,
      }, [
        ...paletteDots(palette),
        el("span", { className: "chip-name", textContent: name }),
        strokeIcon(USER_ICON),
      ]);
      chip.setAttribute("aria-pressed", String(samePalette(palette) && mode === state.mode));
      chip.addEventListener("click", () => {
        state.palette = [...palette];
        state.mode = mode;
        paletteChanged({ palette: true, mode: true });
      });
      return chip;
    }),
  );
  lightButtons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === state.selectedLight)));
}

function selectLight(i) {
  if (state.programAll || i === state.selectedLight) return;
  state.lights[state.selectedLight] = { palette: [...state.palette], mode: state.mode };
  state.selectedLight = i;
  state.palette = [...state.lights[i].palette];
  state.mode = state.lights[i].mode;
  persist();
  rebuildTimeline();
  render();
}

const lightButtons = Array.from({ length: LIGHT_COUNT }, (_, i) => {
  const button = el("button", { type: "button", textContent: String(i + 1), ariaLabel: `Light ${i + 1}` });
  button.addEventListener("click", () => selectLight(i));
  $("lights").append(button);
  return button;
});

function setProgramAll(programAll) {
  if (state.programAll === programAll) return;
  syncActiveProgram();
  state.programAll = programAll;
  if (programAll && !state.allProgram) {
    const source = state.lights[state.selectedLight];
    state.allProgram = { palette: [...source.palette], mode: source.mode };
  }
  const active = programAll ? state.allProgram : state.lights[state.selectedLight];
  state.palette = [...active.palette];
  state.mode = active.mode;
  persist();
  rebuildTimeline();
  render();
}
$("program-all").addEventListener("click", () => setProgramAll(true));
$("program-individual").addEventListener("click", () => setProgramAll(false));

function renderProgramScope() {
  $("program-all").setAttribute("aria-pressed", String(state.programAll));
  $("program-individual").setAttribute("aria-pressed", String(!state.programAll));
  $("lights").hidden = state.programAll;
  $("apply-all").checked = state.applyAll;
  $("apply-all-label").hidden = state.programAll;
}
$("apply-all").addEventListener("change", () => {
  state.applyAll = $("apply-all").checked;
  persist();
});

// ---------- Preview ----------

const canvas = $("preview");
const ctx = canvas.getContext("2d");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let timeline;
let playing = !reducedMotion;
let lastFrame = performance.now();

let timelines = [];

function rebuildTimeline() {
  syncActiveProgram();
  if (state.programAll) {
    const shared = modeTimeline(state.allProgram.mode, state.allProgram.palette);
    timelines = Array.from({ length: LIGHT_COUNT }, () => shared);
    timeline = shared;
    return;
  }
  timelines = state.lights.map((light) => modeTimeline(light.mode, light.palette));
  timeline = timelines[state.selectedLight];
}

function pocketHex(index, t) {
  return colorAt(timelines[index] ?? timeline, t);
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}
new ResizeObserver(resizeCanvas).observe(canvas);

const TAU = 2 * Math.PI;
const FLOWSTAR_SPIN_MS = 800;
// A hand-spun flowstar runs about 0.9 to 2.5 turns per second.
const SPIN_VERY_FAST_MS = 400;
const SPIN_VERY_SLOW_MS = 1100;
const SPIN_VARY_CYCLE_MS = 16000;
let spinAngle = 0;
let spinTime = 0;

function spinPeriod(t) {
  if (!state.varySpin) return FLOWSTAR_SPIN_MS;
  const wave = (1 - Math.cos((t / SPIN_VARY_CYCLE_MS) * TAU)) / 2;
  const fast = Math.log(SPIN_VERY_FAST_MS);
  const slow = Math.log(SPIN_VERY_SLOW_MS);
  return Math.exp(fast + (slow - fast) * wave);
}

function spinAt(t) {
  if (!spinTime) spinTime = t;
  const dt = t - spinTime;
  if (dt > 0) {
    spinTime = t;
    spinAngle += (Math.min(50, dt) / spinPeriod(t)) * TAU;
  }
  return spinAngle;
}
// Tips sit this far from the image center, as a fraction of half the image.
const STAR_TIP = 0.88;
// Opaque tip and inner notch, as a fraction of the drawn image half.
const IMAGE_TIP = 0.905;
const IMAGE_VALLEY = 0.7;

function currentStar() {
  return STARS.find((s) => s.id === state.star) ?? STARS[0];
}

const starImages = new Map(STARS.flatMap((star) => ["front", "back"].map((face) => {
  const img = new Image();
  img.src = star[face];
  return [`${star.id}:${face}`, img];
})));

function flowstarPose(t, w, h) {
  return {
    cx: w / 2,
    cy: h / 2,
    spin: spinAt(t),
    reach: Math.min(w, h) * 0.4,
  };
}

function starPocket(cx, cy, angle, tipR, valleyR) {
  const point = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const tip = point(tipR, angle);
  const left = point(valleyR, angle - Math.PI / 8);
  const right = point(valleyR, angle + Math.PI / 8);
  return {
    tip,
    left,
    right,
    mid: [(tip[0] + left[0] + right[0]) / 3, (tip[1] + left[1] + right[1]) / 3],
  };
}

function pocketAngle(spin, index) {
  return spin - Math.PI / 2 + (index / 8) * TAU;
}

function pocketLed(pocket) {
  const [mx, my] = pocket.mid;
  const [tx, ty] = pocket.tip;
  return [mx + (tx - mx) * 0.4, my + (ty - my) * 0.4];
}

const FABRIC = 480;
const fabric = document.createElement("canvas");
const lightMap = document.createElement("canvas");
fabric.width = lightMap.width = FABRIC;
fabric.height = lightMap.height = FABRIC;
const fabricCtx = fabric.getContext("2d");
const lightCtx = lightMap.getContext("2d");
const preparedStars = new Map();

function starKey() {
  return `${currentStar().id}:${state.face === "back" ? "back" : "front"}`;
}

function preparedStar() {
  const key = starKey();
  const cached = preparedStars.get(key);
  if (cached) return cached;
  const img = starImages.get(key);
  if (!img?.complete || !img.naturalWidth) return null;
  const probe = document.createElement("canvas");
  probe.width = probe.height = FABRIC;
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });
  probeCtx.drawImage(img, 0, 0, FABRIC, FABRIC);
  const pixels = probeCtx.getImageData(0, 0, FABRIC, FABRIC).data;
  const fitted = document.createElement("canvas");
  fitted.width = fitted.height = FABRIC;
  const fittedCtx = fitted.getContext("2d", { willReadFrequently: true });
  fittedCtx.setTransform(...trueStarTransform(pixels));
  fittedCtx.drawImage(probe, 0, 0);
  const [mx, my] = massCenter(fittedCtx.getImageData(0, 0, FABRIC, FABRIC).data);
  const copy = document.createElement("canvas");
  copy.width = copy.height = FABRIC;
  copy.getContext("2d").drawImage(fitted, FABRIC / 2 - mx, FABRIC / 2 - my);
  preparedStars.set(key, copy);
  return copy;
}

// Spinning about the silhouette's center of mass keeps it from orbiting,
// even where the photographed fabric is not perfectly regular.
function massCenter(pixels) {
  let sum = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < FABRIC; y++) {
    for (let x = 0; x < FABRIC; x++) {
      const a = pixels[(y * FABRIC + x) * 4 + 3];
      sum += a;
      sx += a * (x + 0.5);
      sy += a * (y + 0.5);
    }
  }
  return sum ? [sx / sum, sy / sum] : [FABRIC / 2, FABRIC / 2];
}

function opaqueAt(pixels, x, y) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= FABRIC || py >= FABRIC) return false;
  return pixels[(py * FABRIC + px) * 4 + 3] > 128;
}

// Photos are slightly off-center and skewed, so the artwork orbits when spun.
// Find the 8 tips and fit the affine map that puts them on a regular star
// centered in the buffer; rotating that is a true spin about the star's center.
function trueStarTransform(pixels) {
  let minX = FABRIC;
  let minY = FABRIC;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < FABRIC; y += 2) {
    for (let x = 0; x < FABRIC; x += 2) {
      if (opaqueAt(pixels, x, y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const ox = (minX + maxX) / 2;
  const oy = (minY + maxY) / 2;
  const shift = [1, 0, 0, 1, FABRIC / 2 - ox, FABRIC / 2 - oy];
  if (maxX <= minX) return shift;

  const tips = [];
  for (let i = 0; i < 8; i++) {
    const center = pocketAngle(0, i);
    let best = null;
    for (let step = -40; step <= 40; step++) {
      const a = center + (step / 40) * (Math.PI / 8);
      let r = FABRIC / 2;
      while (r > 0 && !opaqueAt(pixels, ox + r * Math.cos(a), oy + r * Math.sin(a))) r -= 0.5;
      if (!best || r > best.r) best = { r, x: ox + r * Math.cos(a), y: oy + r * Math.sin(a) };
    }
    tips.push(best);
  }
  const radius = tips.reduce((sum, tip) => sum + Math.hypot(tip.x - ox, tip.y - oy), 0) / 8;
  const targets = tips.map((_, i) => [
    FABRIC / 2 + radius * Math.cos(pocketAngle(0, i)),
    FABRIC / 2 + radius * Math.sin(pocketAngle(0, i)),
  ]);
  const rowX = solveAffineRow(tips, targets.map((t) => t[0]));
  const rowY = solveAffineRow(tips, targets.map((t) => t[1]));
  if (!rowX || !rowY) return shift;
  return [rowX[0], rowY[0], rowX[1], rowY[1], rowX[2], rowY[2]];
}

// Least squares for out = a*x + b*y + c over the tip points.
function solveAffineRow(points, out) {
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const v = [0, 0, 0];
  points.forEach(({ x, y }, i) => {
    const row = [x, y, 1];
    for (let r = 0; r < 3; r++) {
      v[r] += row[r] * out[i];
      for (let c = 0; c < 3; c++) m[r][c] += row[r] * row[c];
    }
  });
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-9) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    [v[col], v[pivot]] = [v[pivot], v[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c < 3; c++) m[r][c] -= f * m[col][c];
      v[r] -= f * v[col];
    }
  }
  return v.map((value, i) => value / m[i][i]);
}

function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// Light scattered through cloth from a point source: I(d) ~ 1 / (1 + (d/d0)^2),
// windowed to reach zero at the gradient edge.
function scatter(t, d0) {
  return (1 / (1 + (t / d0) ** 2)) * (1 - t * t) ** 2;
}

const IRRADIANCE_STOPS = [0, 0.03, 0.08, 0.15, 0.25, 0.4, 0.6, 0.8, 1];

// Light landing on the fabric. Additive so neighboring LEDs mix like real light.
function irradiate(ctx, x, y, radius, hex, gain) {
  const [r, g, b] = rgb(hex);
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  for (const t of IRRADIANCE_STOPS) {
    const k = gain * scatter(t, 0.1);
    grad.addColorStop(t, `rgb(${Math.min(255, r * k)},${Math.min(255, g * k)},${Math.min(255, b * k)})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// Soft radial glow with alpha stops [t, alpha], tinted toward white near the core.
function glow(ctx, x, y, radius, hex, stops, whiteCore = 0) {
  const [r, g, b] = rgb(hex);
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  for (const [t, a] of stops) {
    const w = whiteCore * Math.max(0, 1 - t / 0.12);
    const mix = (c) => Math.round(c + (255 - c) * w);
    grad.addColorStop(t, `rgba(${mix(r)},${mix(g)},${mix(b)},${a})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// Light leaking out of the translucent pocket into the air behind the star.
const HALO = [[0, 0.55], [0.12, 0.32], [0.3, 0.13], [0.55, 0.04], [0.8, 0.01], [1, 0]];
// The pocket itself glowing as light transmits through it.
const POCKET = [[0, 0.9], [0.08, 0.75], [0.25, 0.42], [0.5, 0.18], [0.8, 0.07], [1, 0.03]];
// Glare in the eye or camera from the bright pocket, in front of the star.
const GLARE = [[0, 0.5], [0.05, 0.3], [0.15, 0.12], [0.35, 0.04], [0.65, 0.01], [1, 0]];
// The LED seen through the pocket cloth: a diffused hot spot, overexposed toward white.
const CORE = [[0, 0.95], [0.2, 0.7], [0.5, 0.25], [1, 0]];

function drawFlowstarBody(c, t, w, h) {
  const print = preparedStar();
  if (!print) return;
  const { cx, cy, spin, reach } = flowstarPose(t, w, h);
  const half = Math.round(reach / STAR_TIP);
  const ledsOn = state.ledsOn;

  const size = half * 2;
  const drawFabric = () => {
    c.save();
    c.translate(cx, cy);
    c.rotate(spin);
    c.drawImage(fabric, -size / 2, -size / 2, size, size);
    c.restore();
  };

  fabricCtx.globalCompositeOperation = "source-over";
  fabricCtx.clearRect(0, 0, FABRIC, FABRIC);
  fabricCtx.drawImage(print, 0, 0);
  if (!ledsOn) {
    drawFabric();
    return;
  }

  const lit = [];
  for (let i = 0; i < 8; i++) {
    const color = pocketHex(i, t);
    if (color) lit.push([i, color]);
  }

  // The print only shows where light lands on it.
  const origin = FABRIC / 2;
  lightCtx.globalCompositeOperation = "source-over";
  lightCtx.fillStyle = "#040406";
  lightCtx.fillRect(0, 0, FABRIC, FABRIC);
  lightCtx.globalCompositeOperation = "lighter";
  for (const [i, color] of lit) {
    const pocket = starPocket(origin, origin, pocketAngle(0, i), IMAGE_TIP * origin, IMAGE_VALLEY * origin);
    const [x, y] = pocketLed(pocket);
    irradiate(lightCtx, x, y, origin * 0.85, color, 1.7);
  }
  lightCtx.globalCompositeOperation = "source-over";
  fabricCtx.globalCompositeOperation = "multiply";
  fabricCtx.drawImage(lightMap, 0, 0);
  fabricCtx.globalCompositeOperation = "destination-in";
  fabricCtx.drawImage(print, 0, 0);
  fabricCtx.globalCompositeOperation = "source-over";

  const tipR = IMAGE_TIP * half;
  const valleyR = IMAGE_VALLEY * half;
  const pockets = lit.map(([i, color]) => {
    const pocket = starPocket(cx, cy, pocketAngle(spin, i), tipR, valleyR);
    return { pocket, color, led: pocketLed(pocket) };
  });

  c.save();
  c.globalCompositeOperation = "lighter";
  for (const { color, led: [x, y] } of pockets) glow(c, x, y, half * 0.62, color, HALO);
  c.restore();

  drawFabric();

  c.save();
  c.globalCompositeOperation = "lighter";
  for (const { pocket, color, led: [x, y] } of pockets) {
    const span = Math.hypot(pocket.left[0] - x, pocket.left[1] - y);
    c.save();
    clipPocket(c, pocket);
    glow(c, x, y, span, color, POCKET, 0.5);
    c.restore();
    glow(c, x, y, half * 0.5, color, GLARE);
    glow(c, x, y, half * 0.09, color, CORE, 0.85);
  }
  c.restore();
}

function clipPocket(ctx, pocket) {
  ctx.beginPath();
  ctx.moveTo(pocket.tip[0], pocket.tip[1]);
  ctx.lineTo(pocket.left[0], pocket.left[1]);
  ctx.lineTo(pocket.right[0], pocket.right[1]);
  ctx.closePath();
  ctx.clip();
}

function drawFrame(now) {
  const { width: w, height: h } = canvas;
  if (!w || !h) {
    lastFrame = now;
    if (playing) requestAnimationFrame(drawFrame);
    return;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  drawFlowstarBody(ctx, now, w, h);
  lastFrame = now;
  if (playing) requestAnimationFrame(drawFrame);
}

function startPreview() {
  lastFrame = performance.now();
  if (playing) requestAnimationFrame(drawFrame);
  else drawFrame(lastFrame);
}

function strokeIcon(d) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function renderPause() {
  const button = $("pause");
  const label = playing ? "Pause" : "Play";
  const icon = playing ? "M9 4v16M15 4v16" : "M8 5v14l11-7z";
  button.replaceChildren(strokeIcon(icon), label);
  button.setAttribute("aria-pressed", String(!playing));
}
$("pause").addEventListener("click", () => {
  playing = !playing;
  renderPause();
  if (playing) startPreview();
});
renderPause();
$("logo").addEventListener("click", () => location.reload());

$("vary-speed").addEventListener("click", () => {
  state.varySpin = !state.varySpin;
  persist();
  render();
});
function renderVarySpeed() {
  $("vary-speed").setAttribute("aria-pressed", String(state.varySpin));
}
$("leds").addEventListener("click", () => {
  state.ledsOn = !state.ledsOn;
  persist();
  render();
  if (!playing) drawFrame(lastFrame);
});
function renderLeds() {
  $("leds").setAttribute("aria-pressed", String(state.ledsOn));
}

const previewWrap = document.querySelector(".preview-wrap");
function fullscreenTarget() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}
function renderFullscreen() {
  const on = fullscreenTarget() === previewWrap;
  const button = $("fullscreen");
  const icon = on ? "M3 9h6V3M15 3v6h6M9 21v-6H3M21 15h-6v6" : "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5";
  button.replaceChildren(strokeIcon(icon), on ? "Exit full screen" : "Full screen");
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
renderFullscreen();

$("flip").addEventListener("click", () => {
  state.face = state.face === "back" ? "front" : "back";
  persist();
  render();
  if (!playing) drawFrame(lastFrame);
});

function renderStars() {
  const side = state.face === "back" ? "Back" : "Front";
  const flip = $("flip");
  flip.replaceChildren(strokeIcon(FLIP_ICON), "Flip");
  flip.title = `Show the ${state.face === "back" ? "front" : "back"}`;
  const row = el("div", { className: "star-row" });
  for (const star of STARS) {
    const button = el("button", {
      type: "button",
      className: "star",
      ariaLabel: `${star.name}, ${side}`,
    });
    button.setAttribute("aria-pressed", String(star.id === state.star));
    button.append(
      el("img", { src: star[state.face === "back" ? "back" : "front"], alt: "" }),
      el("span", { textContent: star.name }),
    );
    button.addEventListener("click", () => {
      state.star = star.id;
      persist();
      render();
      if (!playing) drawFrame(lastFrame);
    });
    row.append(button);
  }
  $("stars").replaceChildren(row);
}

// ---------- Saved ideas ----------

const ideaDialog = $("idea-dialog");

$("save-idea").addEventListener("click", () => {
  $("idea-name").value = "";
  $("idea-colors").replaceChildren(
    ...state.palette.map((id, slot) => el("figure", {}, [
      swatch(id),
      el("figcaption", { textContent: `Color ${slot + 1} · ${colorName(id)}` }),
    ])),
  );
  $("idea-mode").replaceChildren(
    "Mode: ",
    el("span", { className: "n", textContent: String(state.mode) }),
    ` ${MODES.find((m) => m.id === state.mode)?.name ?? ""}`,
  );
  ideaDialog.showModal();
  $("idea-name").focus();
});

$("idea-cancel").addEventListener("click", () => ideaDialog.close());

$("idea-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const idea = readIdea({ name: $("idea-name").value, palette: state.palette, mode: state.mode });
  if (!idea) {
    $("idea-name").reportValidity();
    return;
  }
  state.savedIdeas = [...state.savedIdeas, idea];
  persist();
  render();
  ideaDialog.close();
});

const modeButtons = MODES.map(({ id, name }) => {
  const button = el("button", { type: "button" }, [el("span", { className: "n", textContent: `${id}` }), name]);
  button.addEventListener("click", () => {
    state.mode = id;
    mirrorProgram({ mode: true });
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
  const seconds = (total * COACH_PRESS_MS) / 1000 + (LEAD_IN_BEATS * 3 * COACH_PRESS_MS) / 1000 + 30;
  const who = state.programAll ? "All 8 lights share this program" : `Light ${state.selectedLight + 1}`;
  $("plan-summary").replaceChildren(
    el("strong", { textContent: `${who}: ${total} presses total` }),
    `, about ${Math.max(1, Math.round(seconds / 60))} min with cues.`,
  );
}

// ---------- Audio cues ----------

let audio;
function tone(freq, ms, delay = 0) {
  if (!state.settings.sound) return;
  audio ??= new AudioContext();
  const start = audio.currentTime + delay;
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

function stopChime() {
  tone(1175, 70);
  tone(494, 220, 0.09);
}

// ---------- Coach ----------

const AUTO_CUE_DELAY_MS = 800;
const COACH_PRESS_MS = 1000;
const dialog = $("coach");
const coach = { steps: [], index: 0, round: 1, done: new Set(), timers: [] };

function stopCue() {
  coach.timers.forEach(clearTimeout);
  coach.timers = [];
  if (coach.nextLabel) $("coach-next").textContent = coach.nextLabel;
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
  leadIn(COACH_PRESS_MS, () => {
    for (let k = 1; k <= step.presses; k++) {
      schedule((k - 1) * COACH_PRESS_MS, () => {
        if (k === step.presses) stopChime();
        else tone(k % 5 === 0 ? 1320 : 880, 60);
        setBig([String(k), el("span", { className: "of", textContent: ` / ${step.presses}` })], "pulse");
      });
    }
    schedule(step.presses * COACH_PRESS_MS, () => {
      $("coach-detail").textContent = step.doneDetail ?? `Check that the light shows ${colorName(step.to)}.`;
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

function advanceCoach() {
  if (coach.index === coach.steps.length - 1) {
    COACH_VIEWS.done().finish();
    return;
  }
  coach.index += 1;
  renderCoach();
}

function openCoach() {
  coach.round = 1;
  coach.done = new Set();
  restartCoach();
  dialog.showModal();
  renderCoach();
}

function restartCoach() {
  const steps = [{ type: "prep" }, ...currentPlan()];
  const done = steps.pop();
  steps.push({
    type: "mode",
    mode: state.mode,
    presses: Math.max(0, state.mode - 1),
    doneDetail: `Check that the light shows ${modeName(state.mode)}.`,
  });
  steps.push(done);
  coach.steps = steps;
  coach.index = 0;
}

function jumpToLight(index) {
  if (state.programAll) {
    if (coach.round === index + 1) return;
    coach.round = index + 1;
  } else if (index !== state.selectedLight) {
    selectLight(index);
  } else return;
  restartCoach();
  renderCoach();
}

function lightNumber() {
  return state.programAll ? coach.round : state.selectedLight + 1;
}

function hasNextLight() {
  return state.programAll ? coach.round < LIGHT_COUNT : state.selectedLight < LIGHT_COUNT - 1;
}

const COACH_VIEWS = {
  prep: () => ({
    title: `Pick up light ${lightNumber()} and turn it off`,
    detail: state.programAll
      ? "All 8 lights get this program, one at a time. If this one is on, hold its button for 1 second until it turns off."
      : "If it's on, hold its button for 1 second until it turns off.",
    next: "Light is off",
  }),
  enter: (step) => ({
    title: "Hold the button for 2 seconds",
    big: "2.0 s",
    detail: "Release when the white LED blinks once. Don't hold past 3 seconds: that turns on Lock Mode instead.",
    expect: state.settings.startColor,
    expectLabel: "Then it shows",
    cue: [null, () => playHoldCue(step.ms)],
    next: "White LED blinked",
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
  }),
  save: (step) => ({
    title: `Hold for 1 second to save Color ${step.slot + 1}`,
    big: "1.0 s",
    detail: "Release right after the beep. Holding longer cycles brightness, so let go when it looks right.",
    cue: ["Play 1-second cue", () => playHoldCue(step.ms)],
    next: "Saved",
  }),
  mode: (step) => ({
    title: step.presses ? `Press ${step.presses} times to reach ${modeName(step.mode)}` : `Leave it on ${modeName(step.mode)}`,
    big: step.presses ? ["0", el("span", { className: "of", textContent: ` / ${step.presses}` })] : modeName(step.mode),
    detail: step.presses
      ? "After the colors are saved, the light is on mode 1. Click once on each beep. The last sound means stop."
      : "After the colors are saved, the light is already on Fast Strobe.",
    cue: step.presses ? ["Start press cue", () => playPressCue(step)] : null,
    next: `It shows ${modeName(step.mode)}`,
  }),
  done: () => {
    const more = hasNextLight();
    const n = lightNumber();
    return {
      title: `Light ${n} is programmed`,
      big: "✓",
      detail: "Colors and mode stay on this light until you reprogram or factory reset.",
      next: more ? `Program light ${n + 1}` : "Finish",
      finish() {
        coach.done.add(n);
        if (!more) {
          dialog.close();
          return;
        }
        if (state.programAll) coach.round += 1;
        else selectLight(state.selectedLight + 1);
        restartCoach();
        renderCoach();
      },
    };
  },
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
    (() => {
      const chip = el("span", { className: "s", textContent: modeName(state.mode) });
      const modeAt = coach.steps.findIndex((s) => s.type === "mode");
      chip.classList.toggle("active", step.type === "mode");
      chip.classList.toggle("saved", modeAt >= 0 && modeAt < coach.index);
      return chip;
    })(),
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

  $("coach-back").disabled = coach.index === 0;
  coach.nextLabel = view.next;
  $("coach-next").textContent = view.next;
  const cue = $("coach-cue");
  const cueLabel = view.cue?.[0];
  cue.hidden = !cueLabel;
  if (cueLabel) {
    cue.textContent = cueLabel;
    cue.onclick = view.cue[1];
  }
  $("coach-auto").checked = state.settings.handsFree;
  (cueLabel && !state.settings.handsFree ? cue : $("coach-next")).focus();

  coachLightButtons.forEach((button, i) => {
    const current = i + 1 === lightNumber();
    button.setAttribute("aria-pressed", String(current));
    button.classList.toggle("done", coach.done.has(i + 1) && !current);
  });

  if (!state.settings.handsFree || !view.cue) return;
  schedule(AUTO_CUE_DELAY_MS, view.cue[1]);
}

$("coach-back").addEventListener("click", () => {
  coach.index = Math.max(0, coach.index - 1);
  renderCoach();
});
$("coach-next").addEventListener("click", advanceCoach);
$("coach-auto").addEventListener("change", (event) => {
  state.settings = { ...state.settings, handsFree: event.target.checked };
  persist();
  renderCoach();
});

const coachLightButtons = Array.from({ length: LIGHT_COUNT }, (_, i) => {
  const button = el("button", { type: "button", textContent: String(i + 1), ariaLabel: `Light ${i + 1}` });
  button.addEventListener("click", () => jumpToLight(i));
  $("coach-lights").append(button);
  return button;
});
dialog.addEventListener("close", () => {
  if (!dialog.open) stopCue();
});
$("start-coach").addEventListener("click", openCoach);

function programSnapshot() {
  syncActiveProgram();
  const allProgram = state.allProgram
    ? { palette: [...state.allProgram.palette], mode: state.allProgram.mode }
    : { palette: [...state.lights[state.selectedLight].palette], mode: state.lights[state.selectedLight].mode };
  return {
    lights: state.lights.map((light) => ({ palette: [...light.palette], mode: light.mode })),
    selectedLight: state.selectedLight,
    allProgram,
    star: state.star,
    face: state.face,
    varySpin: state.varySpin,
    ledsOn: state.ledsOn,
    programAll: state.programAll,
    applyAll: state.applyAll,
    savedIdeas: state.savedIdeas.map((idea) => ({ name: idea.name, palette: [...idea.palette], mode: idea.mode })),
    settings: { ...state.settings },
  };
}

function parseProgram(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.lights) || data.lights.length !== LIGHT_COUNT) return null;
  const lights = data.lights.map((light) => {
    const palette = asPalette(light?.palette);
    const mode = MODES.some((m) => m.id === light?.mode) ? light.mode : null;
    return palette && mode ? { palette, mode } : null;
  });
  if (lights.some((light) => !light)) return null;
  if (!Number.isInteger(data.selectedLight) || data.selectedLight < 0 || data.selectedLight >= LIGHT_COUNT) return null;
  if (!STARS.some((star) => star.id === data.star)) return null;
  if (data.face !== "front" && data.face !== "back") return null;
  if (typeof data.varySpin !== "boolean" || typeof data.ledsOn !== "boolean") return null;
  if ("programAll" in data && typeof data.programAll !== "boolean") return null;
  if ("applyAll" in data && typeof data.applyAll !== "boolean") return null;
  let allProgram = readProgram(data.allProgram);
  if (!allProgram) {
    if (data.allProgram != null) return null;
    allProgram = { palette: [...lights[data.selectedLight].palette], mode: lights[data.selectedLight].mode };
  }
  const settings = data.settings;
  const startColor = Number(settings?.startColor);
  const tempo = Number(settings?.tempo);
  if (!settings || !Number.isInteger(startColor) || startColor < 1 || startColor > 34) return null;
  if (typeof settings.carryOver !== "boolean" || typeof settings.sound !== "boolean") return null;
  if (!Number.isFinite(tempo) || tempo <= 0 || tempo > 20) return null;
  const savedIdeas = "savedIdeas" in data ? readIdeas(data.savedIdeas) : undefined;
  if (savedIdeas === null) return null;
  return {
    savedIdeas,
    lights,
    selectedLight: data.selectedLight,
    allProgram,
    star: data.star,
    face: data.face,
    varySpin: data.varySpin,
    ledsOn: data.ledsOn,
    programAll: data.programAll === true,
    applyAll: data.applyAll === true,
    settings: {
      startColor,
      carryOver: settings.carryOver,
      tempo,
      sound: settings.sound,
      handsFree: settings.handsFree !== false,
    },
  };
}

function showImportError(message) {
  const node = $("import-error");
  node.hidden = !message;
  node.textContent = message;
}

function applyProgram(program) {
  state.lights = program.lights.map((light) => ({ palette: [...light.palette], mode: light.mode }));
  state.selectedLight = program.selectedLight;
  state.allProgram = { palette: [...program.allProgram.palette], mode: program.allProgram.mode };
  state.programAll = program.programAll;
  state.applyAll = program.applyAll;
  const active = state.programAll ? state.allProgram : state.lights[state.selectedLight];
  state.palette = [...active.palette];
  state.mode = active.mode;
  state.star = program.star;
  state.face = program.face;
  state.varySpin = program.varySpin;
  state.ledsOn = program.ledsOn;
  state.settings = { ...program.settings };
  if (program.savedIdeas) state.savedIdeas = program.savedIdeas;
  persist();
  rebuildTimeline();
  render();
  if (!playing) drawFrame(lastFrame);
}

$("export-program").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(programSnapshot(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: "voidstar-lights.json" });
  link.click();
  URL.revokeObjectURL(url);
});
$("import-program").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async () => {
  const file = $("import-file").files?.[0];
  $("import-file").value = "";
  if (!file) return;
  try {
    const program = parseProgram(JSON.parse(await file.text()));
    if (!program) {
      showImportError("That file isn't a saved light program.");
      return;
    }
    applyProgram(program);
    showImportError("");
  } catch {
    showImportError("That file isn't a saved light program.");
  }
});

// ---------- Boot ----------

function render() {
  renderPalette();
  renderModes();
  renderVarySpeed();
  renderLeds();
  renderStars();
  renderSummary();
  renderProgramScope();
}

rebuildTimeline();
render();
persist();
startPreview();
