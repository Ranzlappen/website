---
title: "HardwareDash (Gadget) on the Legacy Branch: A Proof-of-Concept for Exploring and Automating Android Hardware & Software"
description: "HardwareDash is a modular Android app that turns your device into a powerful dashboard for monitoring sensors, controlling radios and actuators, managing storage and apps, and automating complex hardware-software interactions. Discover the current state on the legacy/refactor branch."
keywords: ["HardwareDash", "Android proof of concept", "hardware automation Android", "modular Android app", "sensor dashboard", "rooted Android tools", "Flipper integration"]
date: 2026-06-04
category: "Projects"
tags: [android, hardware, automation, proof-of-concept, modular, rooted, sensors]
image: /assets/images/hardwaredash/hardwaredash-hero.webp
backdrop: /assets/images/hardwaredash/hardwaredash-hero.webp
status: placeholder
series: "project-showcases"
series_order: 3
comments: true
---

<nav>
  <strong>Table of Contents</strong>
  <ol>
    <li><a href="#introduction">Introduction</a></li>
    <li><a href="#vision">The Vision: Proof of Concept for Exploration & Automation</a></li>
    <li><a href="#features">Core Capabilities at a Glance</a></li>
    <li><a href="#architecture">Modular Architecture & Dual Flavors</a></li>
    <li><a href="#legacy">The Legacy/Refactor Branch (claude/refactor-2026)</a></li>
    <li><a href="#key-takeaways">Key Takeaways</a></li>
    <li><a href="#conclusion">Conclusion</a></li>
    <li><a href="#sources">Sources</a></li>
  </ol>
</nav>

<h2 id="introduction">Introduction</h2>

HardwareDash (also known as Gadget) is a modular Android application designed as a proof of concept for deeply exploring and automating the hardware and software layers of your device. Whether you want to monitor every sensor in real time, control radios and actuators, manage storage and apps, or build automation rules that react to hardware events, this app provides a unified, extensible interface.

The project lives in the Ranzlappen/HardwareDash repository, with active development happening on the legacy/refactor branch (`claude/refactor-2026`), where Phase 0 of a major modular refactor has just been completed.

**Try the latest stable build:** The most recent stable proof-of-concept is [release v1.0.117](https://github.com/Ranzlappen/HardwareDash/releases/tag/v1.0.117) — grab the APK there to run it today. Everything after that release is part of the in-progress **2.0 beta**, which is being rebuilt on the `claude/refactor-2026` branch.

<h2 id="vision">The Vision: Proof of Concept for Exploration & Automation</h2>

At its core, HardwareDash aims to give power users, developers, and tinkerers a single place to inspect, control, and automate almost every hardware surface Android exposes — and deeper system surfaces on rooted devices. 

Instead of juggling dozens of separate tools, you get one coherent dashboard with sensor tiles, actuator controls, radio management, and a rule engine that lets you automate actions based on hardware state changes. It is deliberately built as a proof of concept to demonstrate what a truly integrated hardware-software automation platform on Android can look like.

<h2 id="features">Core Capabilities at a Glance</h2>

- **Dashboard** — Adaptive grid of live sensor and status tiles (battery, motion, ambient, GPS, etc.).
- **Hardware Control** — Direct access to sensors, actuators (torch, vibration), cameras, audio, and advanced radios (Wi-Fi, Bluetooth, NFC, sub-GHz, IR).
- **Specialized Modules** — Dedicated support for Flipper devices, storage management, app control, screen lock behavior, and bug report generation.
- **Automation Engine** — Rule-based automation in `core/automation` with a companion UI, allowing users to define reactions to hardware events.
- **Rooted Flavor Extras** — Deeper diagnostics, storage, apps, lock, and bugreport surfaces available only in the rooted build, plus a bundled LSPosed module.

Everything is organized so users can explore hardware behavior interactively while also scripting automated workflows.

<!-- TODO: deferred — re-enable this carousel once real screenshots are added
     (dashboard.webp / automation.webp / radios.webp).
<div class="carousel">
  <img src="/assets/images/hardwaredash/dashboard.webp" alt="HardwareDash dashboard showing live sensor tiles and status cards">
  <img src="/assets/images/hardwaredash/automation.webp" alt="Automation rule editor interface for creating hardware-triggered actions">
  <img src="/assets/images/hardwaredash/radios.webp" alt="Radio control panel with Wi-Fi, Bluetooth, NFC and sub-GHz options">
</div>
-->

<h2 id="architecture">Modular Architecture & Dual Flavors</h2>

The app uses a clean modular monorepo structure with reusable `core/*` infrastructure (common utilities, domain logic, hardware registries, automation engine, design system, permissions, etc.) and focused `feature/*` modules (one capability per module).

Two product flavors are maintained from the same codebase:

- **standard** (`dev.ranzlappen.gadget`) — Ships on the Play Store, works on any Android 10+ device.
- **rooted** (`dev.ranzlappen.gadget.rooted`) — Side-loaded only; unlocks deeper system surfaces and includes the LSPosed module.

A strict leak gate in CI ensures rooted-only code never accidentally enters the standard APK.

<h2 id="legacy">The Legacy/Refactor Branch (claude/refactor-2026)</h2>

The branch `claude/refactor-2026` represents the current “legacy” state of the project during its major modular refactor. Phase 0 is complete: the full `build-logic/` convention-plugin layer (8 plugins), 44 `core/*` / `feature/*` / `benchmark` module skeletons, and the `:app` migration to Kotlin DSL with updated application IDs are all in place.

This branch is the active development target right now. Phase 1 (light-preview skeleton app) is the next milestone. Contributing here helps shape the future modular foundation of HardwareDash while the main branch remains stable.

<h2 id="key-takeaways">Key Takeaways</h2>

- HardwareDash is a true proof-of-concept that unifies hardware monitoring, control, and rule-based automation in one modular Android app.
- It supports both everyday devices (standard flavor) and rooted devices with deeper system access.
- The automation engine and extensive hardware coverage (including advanced radios and Flipper integration) make it uniquely powerful for exploration and scripting.
- Active development is happening on the `claude/refactor-2026` legacy/refactor branch, where the new modular architecture has reached Phase 0 completion.
- The project demonstrates what a comprehensive, extensible hardware-software automation platform on Android can become.

<h2 id="conclusion">Conclusion</h2>

HardwareDash stands out as an ambitious, well-architected proof of concept that lets users truly explore and automate the hardware and software layers of their Android devices. Whether you are a developer debugging sensors, a tinkerer automating routines, or a power user wanting deeper control, this app offers a glimpse of what unified hardware automation on Android can look like.

The work happening on the legacy/refactor branch (`claude/refactor-2026`) is laying a solid modular foundation for the next phases. If you are interested in Android internals, automation, or rooted tooling, HardwareDash is definitely worth watching — and contributing to.

Star the repository and check out the `claude/refactor-2026` branch to follow the progress:  
https://github.com/Ranzlappen/HardwareDash/tree/claude/refactor-2026

<h2 id="sources">Sources</h2>

- HardwareDash GitHub Repository (main README and branch information)  
- `claude/refactor-2026` branch status and Phase 0 completion notes (May 2026)  
- Project documentation: MASTER-PLAN.md, docs/flavors.md, and architecture ADRs
