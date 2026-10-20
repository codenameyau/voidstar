#!/usr/bin/env node
import { parseArgs } from "node:util";
import { COLOR_COUNT, BLANK, decodePalette, planProgramming } from "../lib/void.js";

const USAGE = `Usage: npm run plan -- <color> <color> <color> [--start N] [--carry-over]

Prints the button sequence that programs three chart colors (1-${COLOR_COUNT}, 1 = blank).

  --start N      Color shown right after entering program mode (default ${BLANK})
  --carry-over   Next color starts from the one just saved, not from --start

Example: npm run plan -- 13 27 34`;

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      start: { type: "string", default: String(BLANK) },
      "carry-over": { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  });
} catch (err) {
  console.error(`${err.message}\n\n${USAGE}`);
  process.exit(2);
}

if (args.values.help) {
  console.log(USAGE);
  process.exit(0);
}

const palette = decodePalette(args.positionals.join("-"));
const startColor = Number(args.values.start);
if (!palette || !(startColor >= 1 && startColor <= COLOR_COUNT)) {
  console.error(`Need three colors between 1 and ${COLOR_COUNT}.\n\n${USAGE}`);
  process.exit(2);
}

const steps = planProgramming(palette, { startColor, carryOver: args.values["carry-over"] });
const name = (id) => (id === BLANK ? "#1 (blank)" : `#${id}`);
let n = 1;
console.log("Start with the light OFF.");
for (const step of steps) {
  const line = {
    enter: () => "Hold the button ~2 s until the white LED blinks once, then release. (Don't pass 3 s: that's Lock Mode.)",
    select: () =>
      step.presses === 0
        ? `Color ${step.slot + 1}: no presses, light already shows ${name(step.to)}.`
        : `Color ${step.slot + 1}: click ${step.presses}x (${name(step.from)} -> ${name(step.to)}).`,
    save: () => `Hold ~1 s to save ${name(step.color)}, then release.`,
    done: () => "Done. All 9 modes now use your palette.",
  }[step.type]();
  console.log(`${String(n++).padStart(2)}. ${line}`);
}
