---
title: "Building a Custom Mechanical Keyboard from Scratch"
date: 2026-03-28
category: "Projects"
tags: [hardware, diy, keyboards]
description: "A deep dive into designing and hand-wiring a 60% mechanical keyboard with a custom PCB layout."
image:
status: placeholder
comments: true
---

There's something deeply satisfying about typing on a keyboard you built yourself. This post walks through my journey of designing and assembling a 60% mechanical keyboard from raw components.

## Choosing the Switches

The switch is the soul of a mechanical keyboard. After testing a dozen different options, I landed on Gateron Milky Yellows — linear, smooth, and budget-friendly. They have a 50g actuation force which sits in a sweet spot between too light and too heavy.

The key factors I considered were actuation force, travel distance, and sound profile. I wanted something quiet enough for late-night use but with enough tactile feedback to know I'd registered a keypress.

## PCB Design

I used KiCad to design a custom PCB. The layout follows a standard ANSI 60% footprint but with a few tweaks — I added an extra column for dedicated arrow keys and moved the USB-C port to the left side.

The design process took about two weeks of evenings. Most of the time was spent routing traces to avoid crossing paths, which feels a lot like solving a puzzle.

## Hand-Wiring vs Custom PCB

Originally I planned to hand-wire the whole thing with diodes and jumper wire. I got about halfway through before deciding the rats nest of solder joints wasn't worth the debugging headaches. The custom PCB cost about €15 from JLCPCB and arrived in a week.

## Firmware

I flashed QMK firmware with a custom keymap. The real magic is in the layers — I have a base typing layer, a function layer for F-keys and media controls, and a third layer for macros.

```c
const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
  [_BASE] = LAYOUT_60_ansi(
    KC_ESC,  KC_1, KC_2, KC_3, KC_4, KC_5, KC_6, KC_7, KC_8, KC_9, KC_0, KC_MINS, KC_EQL, KC_BSPC,
    // ... full layout here
  ),
};
```

## Final Assembly

The case is a CNC-milled aluminum block I found on AliExpress. It's heavy, solid, and gives the board a premium feel. Total cost for the entire build came out to roughly €120 — significantly less than a comparable commercial board.

## Was It Worth It?

Absolutely. Beyond the end product, the process itself taught me PCB design, basic firmware development, and gave me an excuse to finally learn to solder properly. The keyboard has been my daily driver for three months now and shows no signs of quitting.
