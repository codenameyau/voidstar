# Voidstar Programmer

Plan three colors and a flash mode, preview them on a spinning flowstar, then follow the button presses on the light.

The page cannot program the light. The Void's USB-C cable only charges, so a computer never sees the light as a device. You press the light's one button. The guide counts the presses and plays a beep for each one.

## What the button does

From the [official manual](https://trippysquid.com/pages/led-flowstar). Copies of the booklet pages are in `instructions/`.

| Action | Button |
| --- | --- |
| On / next mode | Click |
| Off | Hold 1 s |
| Enter program mode (from off) | Hold 2 s, white LED blinks once |
| Next color (program mode) | Click, cycles chart colors 1-34 (#1 is blank) |
| Save color | Hold 1 s (keep holding to cycle brightness) |
| 1-Touch mode toggle (while on) | Hold 3 s until white |
| Lock mode (from off) | Hold 3 s, release on green; exit with 3 fast clicks |
| Factory reset (from off) | Hold 5 s, release on red |

Programming saves three colors in order. The guide then clicks from mode 1 to the mode you picked. All 9 modes use those colors. A flowstar holds 8 lights. Program one light at a time, or give all 8 the same program.

## Run it

The site is the files in this folder. Publish the repository root with GitHub Pages (branch `master`, folder `/`) and it is served at https://codenameyau.github.io/voidstar/.

Choose colors and a mode, then click **Start guided programming**. Hands-free plays each cue; confirm on screen before the next step. The last beep of a color or a mode means stop.

To preview on your machine, serve this folder with any static file server and open `index.html`. Script modules do not load from a `file://` address.

The terminal planner needs Node 18 or newer. No install step.

Choices stay in the browser. **Export** and **Import** read and write `voidstar-lights.json`. The active palette is also in the page URL (`#p=16-27-34`).

Print the color steps in the terminal:

```sh
npm run plan -- 16 27 34
```

That count assumes program mode starts on color 1, and each color starts over from color 1. `--start N` and `--carry-over` change those two assumptions.

## Preview

Three Void Glowstar designs. **Flip** shows the other side. **LEDs** on is a dark room with a light in each tip. **LEDs** off is the full-color print. Flash timings are measured from the manual's chart. Screen colors are sampled from the color chart, not from the LED itself.

## Tests

```sh
npm test
```
