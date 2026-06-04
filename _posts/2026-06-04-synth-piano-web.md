---
title: "Synth Piano: A Powerful Android Synthesizer App (Despite the Misleading Repo Name)"
description: "Synth Piano is a native Android APK app — not a web app. This Kotlin + Jetpack Compose + C++ synthesizer delivers touch keyboard, chord pads, full MIDI editing, USB-MIDI input, and sub-20ms latency audio. A complete port of the original Python version with professional features."
keywords: ["synth piano android", "android synthesizer apk", "midi editor android", "low latency android audio", "jetpack compose music app", "usb midi android"]
date: 2026-06-04
category: "Projects"
tags: [android, synthesizer, midi, music, apk, jetpack-compose, audio]
image: /assets/images/synth-piano/synth-piano-hero.webp
backdrop: /assets/images/synth-piano/synth-piano-hero.webp
status: published
series: "project-showcases"
series_order: 4
comments: true
---

<nav>
  <strong>Table of Contents</strong>
  <ol>
    <li><a href="#introduction">Introduction: It’s an APK, Not a Web App</a></li>
    <li><a href="#what-is">What is Synth Piano?</a></li>
    <li><a href="#features">Key Features</a></li>
    <li><a href="#technical">Technical Highlights</a></li>
    <li><a href="#key-takeaways">Key Takeaways</a></li>
    <li><a href="#conclusion">Conclusion</a></li>
    <li><a href="#sources">Sources</a></li>
  </ol>
</nav>

<h2 id="introduction">Introduction: It’s an APK, Not a Web App</h2>

The repository is named <strong>Synth-piano-web</strong>, but don’t let the name fool you — this is a native <strong>Android application</strong> that produces APK and AAB files. There is zero web technology involved. It is a full Kotlin + Jetpack Compose port of the original Python tkinter synthesizer, now running with a high-performance C++ audio engine on Android.

Synth Piano brings professional-grade synthesis, MIDI editing, and low-latency performance to Android devices in a clean, touch-first interface.

<h2 id="what-is">What is Synth Piano?</h2>

Synth Piano is a touch-optimized software synthesizer and MIDI workstation for Android. It combines real-time audio synthesis, a playable touch keyboard, chord pads, a full piano-roll MIDI editor, USB-MIDI input, and high-quality recording — all in one cohesive app.

Originally written in Python with tkinter, it has been completely rebuilt for Android using modern native tools while preserving (and improving) the original workflow and sound.

<h2 id="features">Key Features</h2>

- **Multi-touch Keyboard** — Play with up to 16 voices of polyphony. Adjustable octave range and transposition.
- **Four Oscillator Shapes** — Sine, square, saw, and triangle with full ADSR envelope per voice.
- **Chord Pads** — 11 assignable pads supporting major, minor, 7th, diminished, and suspended chords across all 12 roots.
- **Piano-Roll MIDI Editor** — Full-featured editor with tap-to-add, drag-to-move/resize, and long-press-to-delete. Supports multi-channel scores with velocity and color coding. Includes four bundled demo MIDI files (Ode to Joy, Twinkle Twinkle, etc.).
- **Standard MIDI File Support** — Open and save .mid files (Format 0 & 1) using Android’s Storage Access Framework.
- **USB MIDI Input** — Connect class-compliant MIDI controllers via OTG with no extra permissions required.
- **Hardware Keyboard Support** — Bluetooth and USB QWERTY keyboards work out of the box (fully remappable).
- **High-Quality Recording** — Simultaneously records master audio as WAV and a perfectly timed MIDI file. Files are easy to share or export.

<h2 id="technical">Technical Highlights</h2>

The app achieves excellent real-time performance through a hybrid architecture:

- **UI Layer**: 100% Kotlin + Jetpack Compose + Material 3 (dynamic theming, responsive on phones, tablets, and foldables).
- **Audio Engine**: C++17 DSP core using Oboe (which backs onto AAudio) for true sub-20ms latency on modern devices.
- **MIDI Handling**: Uses Android’s native MIDI API plus the excellent ktmidi library for robust SMF parsing and generation.
- **Data & State**: DataStore for settings and key mappings; efficient in-memory score model.

The project follows modern Android best practices with a clean separation between UI, audio, and MIDI layers. It is actively maintained with CI that automatically builds and releases APKs.

<h2 id="key-takeaways">Key Takeaways</h2>

- Synth Piano is a **native Android APK app**, not a web application — the repository name is simply misleading.
- It delivers a complete synthesizer workstation: touch keyboard, chord pads, MIDI editing, USB-MIDI, and low-latency audio recording.
- The C++ audio engine (via Oboe) provides professional-grade real-time performance with very low latency.
- Full MIDI file support and a capable piano-roll editor make it genuinely useful for composition and practice on the go.
- The project is open source (MIT), actively developed, and available via GitHub Releases.

<h2 id="conclusion">Conclusion</h2>

Synth Piano proves that you can build a serious, low-latency music creation tool entirely on Android using modern native technologies. Despite the confusing repository name, this is a polished, feature-rich APK that Android musicians and tinkerers will genuinely enjoy. Whether you want to play, compose, record ideas, or just experiment with synthesis on your phone or tablet, Synth Piano is a compelling proof of concept done right.

Check out the repository and grab the latest APK from the releases page:  
https://github.com/Ranzlappen/Synth-piano-web

<h2 id="sources">Sources</h2>

- Synth Piano GitHub Repository (README and project structure)  
- Original Python version: https://github.com/Ranzlappen/synth-piano  
- Project releases and CI workflow (June 2026)
