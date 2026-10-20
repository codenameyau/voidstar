import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLORS,
  COLOR_COUNT,
  BLANK,
  pressesBetween,
  planProgramming,
  encodePalette,
  decodePalette,
  colorAt,
  modeTimeline,
  MODES,
} from "../lib/void.js";

test("chart has 34 colors, #1 is blank", () => {
  assert.equal(COLOR_COUNT, 34);
  assert.equal(COLORS.length, 34);
  assert.equal(COLORS[0].id, BLANK);
  assert.equal(COLORS[0].hex, null);
  assert.equal(COLORS[33].hex, "#ffffff");
});

test("pressesBetween counts forward and wraps after 34", () => {
  assert.equal(pressesBetween(1, 1), 0);
  assert.equal(pressesBetween(1, 13), 12);
  assert.equal(pressesBetween(30, 2), 6);
  assert.equal(pressesBetween(34, 1), 1);
});

test("plan resets to the start color before each slot by default", () => {
  const steps = planProgramming([13, 27, 34]);
  assert.deepEqual(
    steps.map((s) => s.type),
    ["enter", "select", "save", "select", "save", "select", "save", "done"],
  );
  const selects = steps.filter((s) => s.type === "select");
  assert.deepEqual(
    selects.map((s) => [s.slot, s.from, s.to, s.presses]),
    [
      [0, 1, 13, 12],
      [1, 1, 27, 26],
      [2, 1, 34, 33],
    ],
  );
});

test("plan with carryOver continues from the previously saved color", () => {
  const selects = planProgramming([13, 27, 5], { carryOver: true }).filter(
    (s) => s.type === "select",
  );
  assert.deepEqual(
    selects.map((s) => [s.from, s.to, s.presses]),
    [
      [1, 13, 12],
      [13, 27, 14],
      [27, 5, 12],
    ],
  );
});

test("plan honors a calibrated start color", () => {
  const first = planProgramming([13, 27, 34], { startColor: 2 }).find(
    (s) => s.type === "select",
  );
  assert.equal(first.from, 2);
  assert.equal(first.presses, 11);
});

test("plan rejects palettes that are not three chart colors", () => {
  assert.throws(() => planProgramming([13, 27]), /three colors/);
  assert.throws(() => planProgramming([0, 27, 34]), /1.*34/);
  assert.throws(() => planProgramming([13, 27, 35]), /1.*34/);
});

test("palette encodes to and decodes from a share string", () => {
  assert.equal(encodePalette([13, 1, 34]), "13-1-34");
  assert.deepEqual(decodePalette("13-1-34"), [13, 1, 34]);
  assert.equal(decodePalette("13-1"), null);
  assert.equal(decodePalette("13-x-34"), null);
  assert.equal(decodePalette("13-1-99"), null);
});

test("there are nine modes", () => {
  assert.equal(MODES.length, 9);
  assert.equal(MODES[7].name, "Single Color");
});

test("blank slots render as off in the preview timeline", () => {
  const timeline = modeTimeline(4, [BLANK, 24, 34]);
  const firstOn = timeline.find((f) => f.slot === 0);
  assert.equal(firstOn.hex, null);
  assert.ok(timeline.some((f) => f.hex === "#ff0000"));
});

test("colorAt loops over the timeline", () => {
  const timeline = [
    { hex: "#ff0000", ms: 10 },
    { hex: null, ms: 10 },
  ];
  assert.equal(colorAt(timeline, 5), "#ff0000");
  assert.equal(colorAt(timeline, 15), null);
  assert.equal(colorAt(timeline, 25), "#ff0000");
});
