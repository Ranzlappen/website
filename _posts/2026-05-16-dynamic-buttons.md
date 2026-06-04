---
title: "Dynamic Buttons"
description: "An experiment in animated, dynamically generated button UI components — exploring what CSS custom properties, clip-path, and JavaScript-driven geometry can do for interactive controls."
keywords: ["dynamic buttons", "css animation", "ui components", "web experiment", "css custom properties", "clip-path", "javascript ui"]
date: 2026-05-16
category: "Projects"
tags: [ui, web, css, experiment]
image: /assets/images/dynamic-buttons/dynamic-buttons-hero.svg
backdrop: /assets/images/dynamic-buttons/dynamic-buttons-hero.svg
status: published
series: "project-showcases"
series_order: 13
comments: true
---

<nav>
  <strong>Table of Contents</strong>
  <ol>
    <li><a href="#overview">Overview</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#how-it-works">How It Works</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#key-takeaways">Key Takeaways</a></li>
    <li><a href="#conclusion">Conclusion</a></li>
    <li><a href="#sources">Sources</a></li>
  </ol>
</nav>

<h2 id="overview">Overview</h2>

Most button libraries treat the button as a static rectangle — you swap colours, maybe add a hover shadow, and call it done. **Dynamic Buttons** is a design experiment that asks a different question: what if a button's shape, motion, and personality could be generated at runtime from a handful of parameters?

The project is a focused front-end playground — no framework, no build step — exploring how far modern CSS and a thin layer of JavaScript can push interactive controls without reaching for a canvas or a heavy animation library. Each button variant is assembled from CSS custom properties and geometry primitives, so tweaking a single variable reshapes the entire component rather than requiring a hand-crafted keyframe rewrite.

The goal is not a production-ready library but a living sketchbook: a place to prototype ideas about organic motion, cursor-aware morphing, and generative aesthetics that can later be distilled into real UI work.

<h2 id="features">Features</h2>

- **Parameterised geometry** — Button shape, corner radius, notch depth, and skew angle are driven by CSS custom properties set via JavaScript. A single `--tension` variable, for example, can interpolate a button from pill-shaped all the way to a diamond without touching any keyframe.
- **Cursor-reactive morphing** — Buttons track the pointer position relative to their own bounding box and apply subtle perspective tilts and highlight shifts using `transform: perspective()` and radial-gradient masks, giving each control a tactile, almost physical feel.
- **Ripple and burst effects** — Click events spawn procedurally positioned pseudo-elements that expand and fade, with burst radius and spread angle computed from where exactly on the button the click lands rather than always emanating from the centre.
- **Theme token integration** — All colour values are pulled from a small set of CSS custom properties on `:root`, so an entire page of buttons repaints instantly when the theme token changes — no JS re-render needed.
- **Zero dependencies** — The experiment runs as plain HTML + CSS + ES module JavaScript, openable directly in a browser from the file system with no install or bundler required.

<h2 id="how-it-works">How It Works</h2>

The core insight is that CSS `clip-path: polygon(...)` coordinates and `border-radius` values can be driven by custom properties that JavaScript updates on `pointermove`. Because CSS transitions apply to custom properties when they are registered with `@property` (the CSS Properties and Values API<sup><a href="#source-2">[2]</a></sup>), the browser interpolates geometry changes smoothly without the JS having to run on every animation frame — only pointer events trigger property updates, and the compositor handles the rest.

Each button component is a single `<button>` element. An `IntersectionObserver` lazy-initialises the JS logic so off-screen buttons pay no runtime cost. On pointer entry the script:

1. Reads the button's `getBoundingClientRect()` to establish local coordinate space.
2. Writes normalised `--mx` and `--my` custom properties (−1 to 1 from centre) on the element itself.
3. CSS `calc()` expressions inside the button's ruleset translate those values into perspective transforms, gradient positions, and clip-path coordinates.

The ripple effect takes a different path: a click handler appends a `<span>` absolutely positioned at the local click coordinates, applies a CSS animation via a freshly added class, then removes the element once the animation ends (`animationend` listener). This keeps the DOM clean between interactions and avoids any ongoing JS timer.

The result is a system where the heaviest computation lives in the browser's style engine — well-optimised and hardware-accelerated — rather than in a JavaScript animation loop.

<h2 id="getting-started">Getting Started</h2>

Because there is no build step, getting started is as lightweight as the project itself:

1. Clone or download the repository from [github.com/Ranzlappen](https://github.com/Ranzlappen).
2. Open `index.html` directly in a modern browser (Chrome 85+, Firefox 90+, or Safari 15.4+ for full `@property` support<sup><a href="#source-2">[2]</a></sup>).
3. Browse the button gallery. Each variant is annotated with the custom properties that drive it.
4. Edit the `:root` token block at the top of `styles.css` to reskin the whole page, or tweak individual `--tension`, `--skew`, or `--depth` values on a specific button class to explore the parameter space.

There are no npm installs, no `node_modules`, and no bundler configuration to deal with.

<h2 id="roadmap">Roadmap</h2>

- [ ] Export individual button variants as self-contained Web Component (`<dynamic-button>` custom element) so they can be dropped into any project
- [ ] Add a live parameter panel (sliders mapped to each custom property) so the geometry space can be explored interactively without editing CSS
- [ ] Investigate `@starting-style`<sup><a href="#source-3">[3]</a></sup> for enter/exit transitions on dynamically inserted buttons — currently the first paint has no entry animation
- [ ] Accessibility audit: ensure all variants pass WCAG 2.1 AA contrast at every animation state, and that `prefers-reduced-motion` suppresses all non-essential transforms<sup><a href="#source-4">[4]</a></sup>

<h2 id="key-takeaways">Key Takeaways</h2>

- Registered CSS custom properties (`@property`) unlock GPU-accelerated interpolation of arbitrary geometry — you can animate polygon coordinates as naturally as colours, without a single `requestAnimationFrame` call in JS.
- Keeping event-driven JS small and letting the CSS engine do the interpolation produces surprisingly smooth results even on mid-range hardware.
- A zero-dependency, no-build experiment is the fastest way to validate a UI idea — the constraint of "just a browser" forces clarity about what the idea actually needs.
- Procedural ripple placement (click coordinates, not centre) meaningfully improves perceived physicality, and the implementation is only a dozen lines.

<h2 id="conclusion">Conclusion</h2>

Dynamic Buttons started as a question — "how alive can a button feel using only the platform?" — and turned into a useful reference for how CSS custom properties, `clip-path`, and pointer event geometry can collaborate. The techniques here aren't specific to buttons: the same parameterised approach applies to cards, toggles, sliders, or any element where the designer wants the shape itself to be part of the interaction.

The project lives on GitHub under the [Ranzlappen](https://github.com/Ranzlappen) account.

---

**More project showcases:** [Exif Metadata Viewer](/blog/2026/05/18/exif/) · [D2App Watch Face](/blog/2026/05/20/d2app/) · [MIUI Theme](/blog/2026/05/22/miui-theme/) · [Pageside Extension](/blog/2026/06/04/pageside/) · [tools.ranzlappen.com](/blog/2026/06/04/tools/)

<h2 id="sources">Sources</h2>

<ol>
  <li id="source-1"><a href="https://github.com/Ranzlappen">github.com/Ranzlappen — project repositories</a></li>
  <li id="source-2"><a href="https://developer.mozilla.org/en-US/docs/Web/CSS/@property">MDN Web Docs — CSS @property (Houdini CSS Properties and Values API)</a></li>
  <li id="source-3"><a href="https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style">MDN Web Docs — @starting-style</a></li>
  <li id="source-4"><a href="https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html">WCAG 2.1 — Success Criterion 2.3.3: Animation from Interactions</a></li>
</ol>
