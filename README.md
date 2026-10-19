# Voidstar Programmer

Plan, preview, and program a Trippy Squid Void LED microlight from a web page.

## What the light can and can't do

The Void has no USB data connection. Its cable only charges the light, so a
computer cannot read from or write to it. Plugged into a Mac, nothing shows up
on the USB bus or as a serial port. The only way to program it is the single
button, so this tool turns the button sequence into exact steps with audio cues.

The button interface, from the [official manual](https://trippysquid.com/pages/led-flowstar)
(copies are in `manual/`):

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

Programming saves three colors in order. All 9 flash modes then use them.

## Run it

Needs Node 18 or newer. No install step.

```sh
npm start
```

Open http://localhost:8734. Pick three colors, preview a mode, then click
**Start guided programming** and press the light's button on each beep.

Your palette is kept in the page URL (`#p=16-27-34`), so you can bookmark or share it.

From the terminal, print the steps without the UI:

```sh
npm run plan -- 16 27 34
```

## Calibration

The manual doesn't say which color shows first in program mode, or whether
each color slot restarts at #1. The defaults assume #1 and a restart. If a
count lands on the wrong color, click **Wrong color?** in the guide and pick
what the light shows. It recounts from there, and the start color is
remembered. You can also change both under **Calibration**.

The Flowstar preview spins one of the Void Glowstar prints (8 or 16 lights), lit only by the LEDs the way it looks in the dark. Preview timings and screen colors are estimates from the manual's charts.

## Tests

```sh
npm test
```
