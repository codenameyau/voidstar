// Model of the Trippy Squid Void LED microlight's single-button interface.
// The light has no USB data connection (its cable is charge-only), so the only
// way to program it is the button sequence described in the official manual.
// This module turns a desired palette into that sequence and previews modes.

export const COLOR_COUNT = 34;
export const BLANK = 1;

// Sampled from the official "Void Programming Color Chart". Real LED output
// differs from screen color, especially for pastels and whites.
const CHART_HEX = [
  null, "#e1ff00", "#00ff9d", "#00d71f", "#00ffeb", "#00d6ff",
  "#00d5ff", "#3666ff", "#5dddff", "#0027ff", "#586bff", "#006fff",
  "#ff3bf7", "#ff8fff", "#e556ff", "#ff73e3", "#9c64ff", "#4f00ca",
  "#6300d2", "#ff6e33", "#ff3e00", "#ff0083", "#ed0000", "#ff0000",
  "#9fddff", "#cfe800", "#64ff00", "#f86b00", "#f9b600", "#b46400",
  "#00d2ff", "#91fffb", "#d3fff6", "#ffffff",
];

export const COLORS = CHART_HEX.map((hex, i) => ({ id: i + 1, hex }));

export const TIMING = {
  enterProgramMs: 2000,
  saveMs: 1000,
  lockModeMs: 3000,
  factoryResetMs: 5000,
};

function assertPalette(palette) {
  if (!Array.isArray(palette) || palette.length !== 3) {
    throw new Error("A palette must have exactly three colors");
  }
  for (const id of palette) {
    if (!Number.isInteger(id) || id < 1 || id > COLOR_COUNT) {
      throw new Error(`Color ${id} is not on the chart (1-${COLOR_COUNT})`);
    }
  }
}

export function pressesBetween(from, to) {
  return (((to - from) % COLOR_COUNT) + COLOR_COUNT) % COLOR_COUNT;
}

/**
 * Button sequence that programs `palette` into the light.
 * startColor: color shown right after entering program mode.
 * carryOver: whether the next slot starts from the color just saved
 *   (true) or from startColor again (false).
 */
export function planProgramming(palette, { startColor = BLANK, carryOver = false } = {}) {
  assertPalette(palette);
  const steps = [{ type: "enter", ms: TIMING.enterProgramMs }];
  let current = startColor;
  palette.forEach((to, slot) => {
    const from = carryOver || slot === 0 ? current : startColor;
    steps.push({ type: "select", slot, from, to, presses: pressesBetween(from, to) });
    steps.push({ type: "save", slot, color: to, ms: TIMING.saveMs });
    current = to;
  });
  steps.push({ type: "done" });
  return steps;
}

export function encodePalette(palette) {
  return palette.join("-");
}

export function decodePalette(text) {
  const parts = String(text).split("-");
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) return null;
  const palette = parts.map(Number);
  try {
    assertPalette(palette);
  } catch {
    return null;
  }
  return palette;
}

export function colorHex(id) {
  return COLORS[id - 1]?.hex ?? null;
}

// Durations are estimates read off the official flash-pattern chart, not
// measured from the hardware.
export const MODES = [
  { id: 1, name: "Fast Strobe" },
  { id: 2, name: "Standard Strobe" },
  { id: 3, name: "Micro Strobe" },
  { id: 4, name: "Continuous Strobe" },
  { id: 5, name: "Extended Strobe" },
  { id: 6, name: "Smooth Cycle" },
  { id: 7, name: "Randomizer Cycle" },
  { id: 8, name: "Single Color" },
  { id: 9, name: "2 Color Flash" },
];

function strobe(palette, onMs, offMs) {
  return palette.flatMap((id, slot) => {
    const frames = [{ slot, hex: colorHex(id), ms: onMs }];
    if (offMs) frames.push({ hex: null, ms: offMs });
    return frames;
  });
}

/** Loopable list of frames { hex, ms, slot?, fadeTo? } for preview. */
export function modeTimeline(modeId, palette, random = Math.random) {
  assertPalette(palette);
  const hex = palette.map(colorHex);
  switch (modeId) {
    case 1: return strobe(palette, 6, 22);
    case 2: return strobe(palette, 6, 60);
    case 3: return strobe(palette, 2, 4);
    case 4: return strobe(palette, 18, 0);
    case 5: return [
      { slot: 0, hex: hex[0], ms: 15 },
      { slot: 1, hex: hex[1], ms: 60 },
      { slot: 2, hex: hex[2], ms: 15 },
    ];
    case 6: return palette.map((_, slot) => ({
      slot, hex: hex[slot], ms: 500, fadeTo: hex[(slot + 1) % 3],
    }));
    case 7: {
      const frames = [];
      for (let burst = 0; burst < 8; burst++) {
        const pattern = random() < 0.5 ? strobe(palette, 18, 0) : strobe(palette, 6, 60);
        const repeats = 1 + Math.floor(random() * 3);
        for (let r = 0; r < repeats; r++) frames.push(...pattern);
      }
      return frames;
    }
    case 8: return [{ slot: 1, hex: hex[1], ms: 1000 }];
    case 9: return [
      { slot: 0, hex: hex[0], ms: 18 },
      { slot: 1, hex: hex[1], ms: 18 },
      { hex: null, ms: 30 },
    ];
    default: throw new Error(`Unknown mode ${modeId}`);
  }
}

function mix(a, b, t) {
  if (!a && !b) return null;
  const rgb = (h) => (h ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : [0, 0, 0]);
  const [x, y] = [rgb(a), rgb(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

export function colorAt(timeline, ms) {
  const total = timeline.reduce((sum, f) => sum + f.ms, 0);
  let t = ((ms % total) + total) % total;
  for (const frame of timeline) {
    if (t < frame.ms) {
      return frame.fadeTo === undefined ? frame.hex : mix(frame.hex, frame.fadeTo, t / frame.ms);
    }
    t -= frame.ms;
  }
  return timeline[timeline.length - 1].hex;
}
