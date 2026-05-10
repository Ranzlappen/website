# Electronics Fundamentals — Architecture & Maintenance Guide

This document explains how the interactive `/references/electronics-fundamentals/`
page is wired together and how to extend it without breaking the existing
widgets. The page is built as a single Jekyll HTML page that pulls in a
modular JavaScript bundle plus a single CSS stylesheet — no framework, no
build step, no monorepo tooling.

If you're looking to **fix a bug**, jump to [Where things live](#where-things-live).
If you're looking to **add a new calculator or widget**, jump to
[Adding a new widget](#adding-a-new-widget).

---

## High-level shape

```
┌─────────────────────────────────────────────────────────────────────┐
│ pages/references/electronics-fundamentals.html                      │
│   • Jekyll page with permalink /references/electronics-fundamentals/│
│   • Renders all six sections as static HTML for SEO + zero-JS users │
│   • Embeds per-section <script type="application/json"> data islands│
│   • Loads the ten-file JS bundle at the bottom of the page          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ assets/js/electronics-*.js (ten files, IIFE-isolated, defer-loaded) │
│                                                                     │
│    1. electronics-utils.js            — utilities + EF namespace    │
│    2. electronics-widget-core.js      — Widget / Kernel / registry /│
│                                         LazyChart / Bookmark /      │
│                                         Chart.js loader / soft warns│
│    3. electronics-quick-wheel.js      — Section 1 widget            │
│    4. electronics-formulas.js         — Section 2 widget            │
│    5. electronics-ohms-calculator.js  — Section 3 / Calc 1          │
│    6. electronics-led-divider-calcs.js— Section 3 / Calcs 2 & 3     │
│    7. electronics-sp-rc-calculators.js— Section 3 / Calcs 4 & 5     │
│    8. electronics-battery-calculator.js— Section 3 / Calc 6         │
│    9. electronics-components.js       — Sections 4 / 5 / 6 + chrome │
│   10. electronics-fundamentals.js     — entry: mount + restore      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ assets/css/electronics-fundamentals.css                             │
│   • Custom CSS, no Tailwind. Uses CSS custom properties from the    │
│     site theme so dark/light mode flips for free.                   │
└─────────────────────────────────────────────────────────────────────┘
```

The bundle is **strictly ordered** in HTML: `utils` creates the namespace,
`widget-core` extends it with the framework, the per-section files register
their widgets at IIFE-eval time, and the entry-point file mounts everything
on `DOMContentLoaded`. Each file is its own IIFE that bails silently on any
page lacking `.electronics-page` so loading them site-wide is safe.

---

## The EF namespace

Everything attaches to `window.ElectronicsFundamentals` (alias `EF`). The
namespace is **idempotent** — every file does
`var EF = window.ElectronicsFundamentals || {}` and writes back, so hot
reloads / out-of-order loads don't double-up state.

### Utility functions (`electronics-utils.js`)

| Function | Purpose |
|---|---|
| `EF.debounce(fn, wait)` | Trailing-edge debounce. Used by every recompute pipeline + the resize handler. |
| `EF.copyToClipboard(text)` | Promise-returning clipboard write with a textarea fallback for non-secure contexts. |
| `EF.copyWithFlash(btn, text, opts)` | Wrapper that flashes a "Copied ✓" label on `btn` after a successful copy. |
| `EF.formatNumberWithUnits(value, unit)` | SI-prefix formatter (`12000` → `"12 kΩ"`). 3 significant digits. |
| `EF.readDataIsland(id)` | Reads a `<script type="application/json">` data island, returning `{}` on parse failure. |
| `EF.sanitizeInput(raw)` | Coerces an `<input>.value` into a finite number; returns `NaN` on empty/non-numeric/Infinity. |
| `EF.findWidgetByName(name)` | Looks up an `EF.widgets` entry by `name`. |
| `EF.solveOhmsLaw(known)` | Domain-validated Ohm's-law solver shared by the Quick Wheel and the Ohm's-Law calculator. |
| `EF.syncSliderToValue(slider, value)` | Clamp-and-set helper used by every input↔slider pair. |
| `EF.chartTheme()` | Reads the live CSS custom properties on `<html>` and returns a Chart.js color palette. |
| `EF.scrollIntoView(el, opts)` | Honours `prefers-reduced-motion`. |
| `EF.describeSvg(svg, title, desc)` | Idempotent `<title>` / `<desc>` injector for inline SVG. |
| `EF.autoWireUnitHints(card)` | Walks a calculator card and auto-wires `aria-describedby` from each numeric input to its small unit-hint span. |
| `EF.wireInputDescription(input, descSpan)` | Single-pair version of the above. |
| `EF.capUnitForValue(F)` | Picks the friendliest µF / nF / pF unit for a farads value. |
| `EF.formatCapacitorValue(F, unit)` | Farads → display string in the chosen unit. |
| `EF.parseCapacitorInput(raw, unit)` | Typed text → farads (the inverse of `formatCapacitorValue`). |
| `EF.softLimitWarning(quantity, value)` | Returns a "Most circuits use…" string when `value` is outside the soft band for `quantity`, or `''` in range. Centralises wording for V / I / R / P / Vsupply / Vin / Vf / R1 / R2 / RL / C. |

### Framework (`electronics-widget-core.js`)

| Symbol | Role |
|---|---|
| `EF.Widget` | Base class — `mount` / `unmount` / `reset` / `getState` / `toJSON` / `destroy` / `addCleanup`. |
| `EF.CalculatorKernel` | Extends `Widget` with calculator-shaped helpers (`debounce`, `sanitizeInput`, `formatWithSI`, `copyToClipboardWithUnits`, `openInQuickWheel`, `themeChart`, `registerResizeObserver`, `announce`). |
| `EF._SectionAdapter` | Wraps existing closure-based `init…()` functions in the `Widget` lifecycle without rewriting their internals. Each per-section file registers via this adapter. |
| `EF._inherit(Child, Parent)` | Prototype inheritance helper. |
| `EF.registerWidget(name, factory)` | Registers a widget factory at IIFE-eval time. |
| `EF._registerSection(name, initFn)` | Convenience wrapper that builds a `_SectionAdapter` factory. **This is what every per-section file uses.** |
| `EF.mountAllWidgets()` | Boot path. Instantiates each registered factory, calls `mount()`, syncs themes, and auto-attaches soft warnings. |
| `EF.unmountAllWidgets()` | Tear-down for tests. |
| `EF.resetAllWidgets()` | Global Reset-All target — calls `reset()` on every active widget. |
| `EF.getAllWidgetStates()` | Snapshots every widget's `getState()` output. Useful in DevTools. |
| `EF.syncAllWidgetThemes()` | Post-mount safety net for dark-mode timing. |
| `EF.confirmModal(opts)` | Promise-returning, focus-trapping accessible alternative to `window.confirm()`. Used by Reset All and the help overlay. |
| `EF.LazyChartManager` | IntersectionObserver/ResizeObserver chart lifecycle (see below). |
| `EF.Bookmark` | `localStorage` + URL-hash state persistence (see below). |
| `EF.ensureChartJs()` | Promise-based, **consent-gated** Chart.js loader (see below). |
| `EF.attachInputSoftWarning(input, qty?, opts)` | Attaches a debounced `input` listener that flips `aria-invalid` + a `title` tooltip when the value crosses `EF.softLimitWarning`'s threshold. Idempotent. |
| `EF.attachAllSoftWarnings()` | Walks `[data-quantity]` numeric inputs page-wide. Hooked from `mountAllWidgets`. |
| `EF.prefersReducedMotion()` | Centralised `prefers-reduced-motion` check. |
| `EF.theme` | Live theme name (`'dark'` / `'light'`). Updated via a `MutationObserver` on `<html data-theme>`. |
| `EF.widgets` | Per-widget registry every section pushes its `{ name, onResize, onThemeChange, getState, reset, restoreState }` entry into. |

---

## Where things live

### `pages/references/electronics-fundamentals.html`

The static page. Rendered by Jekyll at build time so the page works without
JS (and is SEO-indexable). Each interactive section has a stable id (e.g.
`#electronics-calc-rc`) and a sibling `<script type="application/json">`
data island carrying its defaults / ranges / lookup tables. The JS reads
those islands via `EF.readDataIsland(id)` instead of being hard-coded, so
content changes don't require touching JS.

The page ends with the nine `<script defer>` tags in load order. **Do not
reorder them** — the bundle relies on `utils` running before `widget-core`,
and on every per-section file running before the entry point.

### `assets/css/electronics-fundamentals.css`

A single ~3000-line stylesheet, sectioned with `/* === N — Title === */`
comment headers. CSS custom properties drive the dark/light theme; the
chart palette in `EF.chartTheme()` reads from these so themes flip without
a chart rebuild. **No Tailwind** — this stylesheet is independent of the
PolyVote / Blog Admin builds and uses the same conventions as the rest of
the blog's custom CSS.

The page also pulls in **`assets/css/abbreviations.css`** (the shared
glossary utility's stylesheet) at the top of `electronics-fundamentals.html`,
above this stylesheet. If you fork the page or split it into a new
reference page, both stylesheets must be loaded — see the Abbreviations
integration section below.

### `assets/js/electronics-utils.js` (1)

Creates the `EF` namespace, seeds it with utilities, and starts the theme +
resize observers. **Must run first.**

### `assets/js/electronics-widget-core.js` (2)

Defines the `Widget` / `CalculatorKernel` / `_SectionAdapter` classes, the
registry, `LazyChartManager`, `Bookmark`, the consent-gated Chart.js
loader, the soft-warning auto-wirer, and `EF.confirmModal`. **Must run
second.**

### `assets/js/electronics-{quick-wheel,formulas,ohms-calculator,led-divider-calculators,sp-rc-calculators,components}.js` (3–8)

Per-section widgets. Each file:

1. Bails silently if `.electronics-page` is absent.
2. Defines one or more `init…()` closures that wire their card.
3. Registers each one via `EF._registerSection('widget-name', initFn)`.

Each `init` is wrapped in a `_SectionAdapter` automatically — there's no
need to subclass `Widget` directly. Push a per-widget entry onto
`EF.widgets` at the end of `init` if the widget needs `onResize` /
`onThemeChange` / `getState` / `reset` / `restoreState` hooks.

### `assets/js/electronics-fundamentals.js` (9)

Thin entry point. On `DOMContentLoaded` it calls `EF.mountAllWidgets()`,
then `EF.Bookmark.restoreFromHash()`, then logs a success line. **Do not
add per-widget logic here** — keep the entry point a one-shot dispatcher.

---

## Data islands

Every section that needs configuration ships a sibling
`<script type="application/json">` element so the markup stays declarative:

```html
<article class="electronics-calculator" id="electronics-calc-rc">
  …card markup…
  <script type="application/json" id="electronics-calc-rc-data">
    {
      "defaults":     { "V": 5, "R": 10000, "C": 0.000001 },
      "animationMs":  3000
    }
  </script>
</article>
```

The JS reads it once at init time:

```js
var data = EF.readDataIsland('electronics-calc-rc-data');
var DEFAULTS = (data && data.defaults) || { V: 5, R: 10000, C: 1e-6 };
var ANIM_MS  = (data && data.animationMs) || 3000;
```

The `|| { … }` fallback lets the JS keep working even if the page-author
omits or breaks the island — the calculator just uses the baked-in
defaults.

| Island id | Section |
|---|---|
| `electronics-data` | Page-level (currently empty). |
| `electronics-calc-ohms-data` | Ohm's Law calculator. |
| `electronics-calc-led-data` | LED Resistor calculator. |
| `electronics-calc-divider-data` | Voltage Divider calculator. |
| `electronics-calc-sp-data` | Series / Parallel calculator (min/max rows, defaults, slider ranges). |
| `electronics-calc-rc-data` | RC Timer calculator. |
| `electronics-calc-battery-data` | Battery Charge & Capacity calculator (per-mode defaults, real-world preset scenarios, per-chemistry SOC voltage curves). |
| `electronics-rcd-data` | Resistor color decoder (color table, presets metadata). |
| `electronics-eseries-data` | E-series explorer (E12/E24/E48/E96/E192 mantissa tables). |

When you change content for a section, **edit the island** — don't move
the values into JS. That keeps the page editable without a JS rebuild.

---

## Lazy chart manager

`Chart.js` is heavy (~75 kB gzipped) and most visitors won't scroll past
the first calculator. `EF.LazyChartManager` keeps **at most two charts
active at once**:

* Each chart's parent container is observed by an `IntersectionObserver`.
* When the container scrolls into view, the manager calls `build()` (or
  `resume()` if already built once).
* When more than `MAX_ACTIVE` charts are alive, the oldest gets `pause()`d
  — its closure may `chart.destroy()` and null out the canvas, freeing GPU
  memory.
* A `ResizeObserver` calls `chart.resize()` on every active chart when its
  container changes size.

The manager is consent-gated: Chart.js itself is loaded by
`EF.ensureChartJs()`, which waits for `__cookieConsent.functional` before
fetching the CDN script. Sections opt into lazy mode like this:

```js
EF.ensureChartJs().then(function () {
  var wrapper = canvas.parentElement;
  EF.LazyChartManager.register('rc-timer-chart', wrapper, {
    build:  function () { buildChart(); recompute(); return chart; },
    pause:  function () { if (chart && chart.destroy) { chart.destroy(); chart = null; } },
    resume: function () { buildChart(); recompute(); return chart; }
  });
}, function () {
  setWarning('Chart unavailable (Chart.js blocked or offline). Calculations still work.');
});
```

**The `.then` failure path matters** — every section degrades gracefully
when consent is declined or the CDN is unreachable. Keep that pattern when
you add a new charted widget.

---

## Bookmark / state persistence

`EF.Bookmark` snapshots a widget's `getState()` output to two places:

1. **`localStorage`** under `ef:state:<name>` — for "remember my last
   session" persistence.
2. **The URL hash** (`#ef=<name>:<base64-json>`) — for shareable URLs.

On boot, the entry point calls `EF.Bookmark.restoreFromHash()`. If the URL
contains a hash, the bookmark walks `EF.widgets`, finds the matching
entry, and calls its `restoreState(snap)` method. Widgets that want to
participate in state restore implement both `getState()` and
`restoreState(snap)` in their `EF.widgets` entry:

```js
EF.widgets.push({
  name: 'rc-timer-calculator',
  // … other hooks …
  getState: function () { /* return JSON-serialisable snapshot */ },
  restoreState: function (snap) { /* reverse: feed snapshot into inputs */ }
});
```

The hash format is intentionally short (base64 of a small JSON blob) so it
fits in real-world URL length limits. Only one widget's state is captured
per hash; the **🔗 Share** button on each calculator overwrites the hash
with the active widget's snapshot.

---

## Soft input-range warnings

Every numeric calculator input gets a non-blocking soft warning when its
value crosses a per-quantity threshold (e.g. R > 10 MΩ → *"Most circuits
use 1 Ω – 10 MΩ"*). Two layers:

1. **In-flow warnings.** Each calculator's `recompute()` calls
   `EF.softLimitWarning(qty, value)` and merges the result string into
   its existing `setWarning(msg)` flow, so out-of-range inputs show up
   in the same warning strip as result-side warnings.
2. **Page-wide auto-attach.** `EF.attachAllSoftWarnings()` walks every
   `input.electronics-calculator__input[data-quantity]` on the page and
   wires a debounced `input` listener that flips `aria-invalid="true"` +
   sets a `title` tooltip when out of range. This catches inputs whose
   calculators don't surface the warning directly (Quick Wheel, Ohm's,
   LED, Voltage Divider, etc.) without per-file plumbing.

Thresholds + wording live in a single `SOFT_LIMITS` table in
`electronics-utils.js`. **To change a band, edit that table** — every calc
on the page picks up the new threshold and the new message.

---

## Theme synchronisation

The site uses `<html data-theme="dark|light">` to flip themes. A
`MutationObserver` in `electronics-utils.js` watches the attribute. On
every flip:

1. `EF.theme` is updated.
2. Every `EF.widgets[i].onThemeChange` callback fires.
3. A `electronics:theme` `CustomEvent` is dispatched on `document` for
   any external listeners.

Charts pick up the change via `EF.chartTheme()`, which re-reads the live
CSS custom properties on `<html>`. Sections that want to re-skin their
chart implement an `onThemeChange` that updates colours and calls
`chart.update('none')`.

---

## Abbreviations / glossary integration

The page consumes the **shared site-wide abbreviations utility** rather
than rolling its own glossary. The contract:

- **Dataset**: `_data/abbreviations/electronics.yml` — array of
  `{ term, full_form, explanation }` maps. Add new terms directly here;
  no JS or HTML edits required, the include regenerates the JSON island
  on every build.
- **Markup**: `pages/references/electronics-fundamentals.html` includes
  `_includes/abbreviations-section.html` near the top of the page, just
  below the hero, passing `data=site.data.abbreviations.electronics`.
- **Styles**: `/assets/css/abbreviations.css` is loaded at the top of
  the page **alongside** `electronics-fundamentals.css`.
- **Behaviour**: `/assets/js/abbreviations.js` is loaded at the bottom
  **before** the EF bundle. It owns the modal stack, keyboard
  activation, and the in-content auto-decoration walker.
- **Auto-decoration opt-in**: the design-guides container carries
  `data-abbr-decorate`, so glossary terms inside guide bodies become
  click-to-explain triggers automatically. Add the attribute to any
  other content area you want decorated.

Cross-references between glossary entries use
`<span class="abbr-link" data-abbr="X">X</span>` inside `explanation`;
clicking opens a stacked modal on top of the current one (Escape
unwinds the stack). Datasets are page-scoped: the same key (e.g.
`ADC`) can have a completely different definition in
`_data/abbreviations/spectrum.yml` with no conflict.

---

## Adding a new widget

Want to add a sixth calculator (say, an inductor energy calculator)?

### 1. Wire the markup

Edit `pages/references/electronics-fundamentals.html`, choose the section
that fits, and add a new `<article class="electronics-calculator" id="electronics-calc-inductor">`
block following the existing five calculators' shape. Include any data you
need as a `<script type="application/json" id="electronics-calc-inductor-data">`
sibling.

### 2. Style the new card

Reuse the existing classes (`electronics-calculator`,
`electronics-ohms-fields`, `electronics-ohms-field`, etc.) wherever
possible. If you need new styling, add it to the appropriate numbered
section in `assets/css/electronics-fundamentals.css` and follow the
existing CSS-custom-property pattern so dark/light mode keeps working.

### 3. Create the JS file

Create `assets/js/electronics-inductor-calculator.js`. Skeleton:

```js
/* ============================================================================
   electronics-inductor-calculator.js — Section 3 / Calculator 6

   Depends on electronics-utils.js + electronics-widget-core.js.
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;
  var EF = window.ElectronicsFundamentals;
  if (!EF || typeof EF._registerSection !== 'function') return;

  function initInductorCalculator() {
    var card = document.getElementById('electronics-calc-inductor');
    if (!card) return;

    var data = EF.readDataIsland('electronics-calc-inductor-data');
    var DEFAULTS = (data && data.defaults) || { L: 1e-3, I: 1 };

    // … wire inputs, recompute, copy/reset/share buttons …

    // If the calculator has a chart, register it with LazyChartManager.

    // Push a registry entry so Reset All / theme / state-restore work.
    EF.widgets.push({
      name: 'inductor-calculator',
      onResize:      function () { /* chart.resize() if charted */ },
      onThemeChange: function () { /* chart re-skin */ },
      getState:      function () { /* return JSON-serialisable snapshot */ },
      reset:         function () { /* click clearBtn or similar */ },
      restoreState:  function (snap) { /* feed snapshot into inputs */ }
    });
  }

  EF._registerSection('inductor-calculator', initInductorCalculator);
})();
```

### 4. Register the script

In `electronics-fundamentals.html`, add a `<script defer>` tag for the new
file **before** `electronics-fundamentals.js` (the entry point). Ordering
within the per-section block doesn't matter, but it must come after
`electronics-widget-core.js`.

### 5. Wire the conventions

* **Inputs** carry `data-quantity="<symbol>"` so the page-wide soft-warning
  auto-wirer reaches them. Add the quantity to the `SOFT_LIMITS` table in
  `electronics-utils.js` if it's not already there.
* **Bookmark / Share** only works if you implement `getState()` +
  `restoreState(snap)`.
* **Reset All** only works if you implement `reset()` (or a `clearBtn`
  whose click handler resets state, plus a `reset: function () { clearBtn.click(); }`
  wrapper in the `EF.widgets` entry).
* **Quick Wheel hand-off** — if your calc maps onto V/I/R/P, expose an
  "Open in Quick Wheel" button that calls
  `EF.findWidgetByName('quick-reference-wheel').setValues({ V, R }, { scroll: true })`.

That's it — `EF.mountAllWidgets()` will pick up the new widget on the next
page load.

---

## Common gotchas

* **Don't import across modules.** The Jekyll blog (root), PolyVote, Blog
  Admin, and Cloud Functions are four independent modules with no shared
  package. The electronics page is part of the Jekyll blog and uses only
  vanilla browser JS — no `import` statements, no bundler.
* **Don't add `addDoc` / `setDoc` in the JS.** This page is fully static.
  All interactivity is client-side; nothing here writes to Firebase.
* **Don't hot-link favicons.** Per the project conventions, favicons go in
  `assets/images/favicons/` so visitor IPs don't leak to upstream servers.
* **Keep the bundle defer-loaded.** Every script tag has `defer` so the
  bundle parses without blocking the initial paint. Don't change to
  `async` — the strict load order is required.
* **Don't reorder the bundle.** `utils → widget-core → per-section
  files → entry`. Any other order breaks namespace bootstrapping.

---

## Verifying changes

Run from the repo root:

```bash
# Syntax-check every JS file in the bundle.
for f in assets/js/electronics-*.js; do node -c "$f" || break; done

# Smoke-test the page locally.
bundle exec jekyll serve
# Then visit http://localhost:4000/references/electronics-fundamentals/
```

Manual smoke test for a structural change:

* Every calculator computes a sane default result on first paint.
* The Quick Reference Wheel updates as you type.
* Every chart paints once in view (and pauses when scrolled past the
  third one — only two should be active at once).
* `🔗 Share` copies a hash URL; pasting it into a new tab restores
  state.
* `↻ Reset all` (the floating pill) returns every widget to defaults.
* Toggling site theme between light/dark re-skins every chart without a
  flicker.
* Resizing the window from desktop → narrow mobile keeps the layout
  tidy and re-fits charts.

---

## See also

* The HTML page header itself contains a short version of this guide as a
  Jekyll comment block — useful for quick reference while editing.
* The top of `electronics-widget-core.js` links back to this README.
* `CLAUDE.md` (repo root) covers the broader project's module boundaries
  and CI/CD setup.
