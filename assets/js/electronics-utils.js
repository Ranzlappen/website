/* ============================================================================
   electronics-utils.js — utility functions + EF namespace bootstrap
   ----------------------------------------------------------------------------
   First file of the modular electronics-fundamentals JS bundle (Intermission
   Batch 2). Creates window.ElectronicsFundamentals (alias `EF`) and seeds
   it with the shared utilities (debounce, copyToClipboard,
   formatNumberWithUnits, readDataIsland, sanitizeInput) plus the
   theme/resize plumbing every widget hooks into.

   Load order (each file is its own IIFE, safe to load on any page):
     1. electronics-utils.js                  ← THIS FILE
     2. electronics-widget-core.js            (Widget/Kernel/registry/Lazy/Bookmark/ChartJS)
     3. electronics-quick-wheel.js
     4. electronics-formulas.js
     5. electronics-ohms-calculator.js
     6. electronics-led-divider-calculators.js
     7. electronics-sp-rc-calculators.js
     8. electronics-components.js
     9. electronics-fundamentals.js           (entry point — calls EF.mountAllWidgets)
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /** Trailing-edge debounce, used by the resize handler and any future
   *  input-driven calculators. */
  function debounce(fn, wait) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  /** Clipboard copy with a graceful fallback for older browsers / non-secure
   *  contexts. Returns a Promise<boolean>. */
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return fallbackCopy(text); }
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_) { return false; }
  }

  /** Format a numeric value with an SI prefix (12000 → "12 kΩ", 0.0047 →
   *  "4.7 mΩ"). Caller picks the unit suffix. */
  function formatNumberWithUnits(value, unit) {
    unit = unit || '';
    if (value === 0 || !isFinite(value)) return value + ' ' + unit;
    var sign = value < 0 ? '-' : '';
    var abs = Math.abs(value);
    var prefixes = [
      { f: 1e12,  s: 'T' }, { f: 1e9,   s: 'G' }, { f: 1e6,   s: 'M' },
      { f: 1e3,   s: 'k' }, { f: 1,     s: ''  },
      { f: 1e-3,  s: 'm' }, { f: 1e-6,  s: 'µ' }, { f: 1e-9,  s: 'n' },
      { f: 1e-12, s: 'p' }
    ];
    for (var i = 0; i < prefixes.length; i++) {
      if (abs >= prefixes[i].f) {
        var scaled = abs / prefixes[i].f;
        // 3 significant digits is the sweet spot for hobby-grade EE math.
        var rounded = Number(scaled.toPrecision(3));
        return sign + rounded + ' ' + prefixes[i].s + unit;
      }
    }
    return sign + abs.toExponential(2) + ' ' + unit;
  }

  /** Read a `<script type="application/json">` data island, returning {} on
   *  any parse failure so callers can treat the result as always-an-object. */
  function readDataIsland(id) {
    var el = document.getElementById(id);
    if (!el) return {};
    try { return JSON.parse(el.textContent || '{}'); } catch (_) { return {}; }
  }

  /** Strict input sanitiser. Coerces a raw <input>.value (or any string /
   *  number) into a finite number; returns NaN for empty / null / non-numeric
   *  / ±Infinity inputs. Single source of truth across every calculator. */
  function sanitizeInput(raw) {
    if (raw === null || raw === undefined) return NaN;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
    var trimmed = String(raw).trim();
    if (trimmed === '') return NaN;
    var num = parseFloat(trimmed);
    return Number.isFinite(num) ? num : NaN;
  }

  // ==========================================================================
  // Shared widget helpers (Batch 6 deduplication)
  //   Every helper below was previously defined inline in two or more
  //   per-section files. They live here now so each section file calls
  //   EF.foo() instead of carrying its own copy.
  // ==========================================================================

  /** Walk the EF.widgets registry and return the entry whose name matches.
   *  Used by every "Open in Quick Wheel" button + the Bookmark restore path
   *  + initFormulasSection's Try-it dispatcher. Replaces ad-hoc for-loops
   *  scattered through six init functions. */
  function findWidgetByName(name) {
    if (!name) return null;
    for (var i = 0; i < EF.widgets.length; i++) {
      if (EF.widgets[i] && EF.widgets[i].name === name) return EF.widgets[i];
    }
    return null;
  }

  /** Solve Ohm's law from a 2-element `known` array
   *    [{ name: 'V', value: 12 }, { name: 'R', value: 100 }]
   *  Returns:
   *    { values: { V, I, R, P } }                        on success
   *    { error: 'Cannot derive R: …' }                   on domain violation
   *    { partial: true, values: {…} }                    when P=R=0 (under-
   *                                                      determined but valid)
   *
   *  Single shared implementation — was duplicated verbatim in the Quick
   *  Wheel and the Ohm's Law calculator before this batch. EPSILON is the
   *  divide-by-zero threshold matching typical hobby-grade meter resolution
   *  (1 µV / 1 µA / 1 µΩ). */
  function solveOhmsLaw(known) {
    var EPSILON = 1e-9;
    var a = known[0], b = known[1];
    var pair = [a.name, b.name].sort().join('');
    var out = { V: NaN, I: NaN, R: NaN, P: NaN };
    out[a.name] = a.value;
    out[b.name] = b.value;

    function err(msg) { return { error: msg }; }

    switch (pair) {
      case 'IV':
        if (Math.abs(out.I) < EPSILON) return err('Cannot derive R: current is zero (open circuit).');
        out.R = out.V / out.I;
        out.P = out.V * out.I;
        break;
      case 'RV':
        if (out.R < 0) return err('Resistance cannot be negative.');
        if (Math.abs(out.R) < EPSILON) return err('Cannot derive I: resistance is zero (short circuit).');
        out.I = out.V / out.R;
        out.P = (out.V * out.V) / out.R;
        break;
      case 'PV':
        if (out.P < 0) return err('Power cannot be negative.');
        if (Math.abs(out.V) < EPSILON) return err('Cannot derive I or R: voltage is zero.');
        out.I = out.P / out.V;
        out.R = Math.abs(out.P) < EPSILON ? Infinity : (out.V * out.V) / out.P;
        break;
      case 'IR':
        if (out.R < 0) return err('Resistance cannot be negative.');
        out.V = out.I * out.R;
        out.P = out.I * out.I * out.R;
        break;
      case 'IP':
        if (out.P < 0) return err('Power cannot be negative.');
        if (Math.abs(out.I) < EPSILON) return err('Cannot derive V or R: current is zero.');
        out.V = out.P / out.I;
        out.R = out.P / (out.I * out.I);
        break;
      case 'PR':
        if (out.P < 0) return err('Power cannot be negative.');
        if (out.R < 0) return err('Resistance cannot be negative.');
        if (Math.abs(out.R) < EPSILON && Math.abs(out.P) < EPSILON) {
          return { partial: true, values: out };
        }
        if (Math.abs(out.R) < EPSILON) return err('Cannot derive V: resistance is zero with non-zero power.');
        out.V = Math.sqrt(out.P * out.R);
        out.I = Math.sqrt(out.P / out.R);
        break;
    }
    return { values: out };
  }

  /** Clamp `value` to `slider`'s min/max and write it. No-op if value isn't
   *  finite or the slider doesn't exist. Replaces the per-calc syncSlider /
   *  syncSliderFromValue helpers in Ohm's, LED, Voltage Divider, RC Timer. */
  function syncSliderToValue(slider, value) {
    if (!slider || !Number.isFinite(value)) return;
    var min = parseFloat(slider.min);
    var max = parseFloat(slider.max);
    slider.value = String(Math.max(min, Math.min(max, value)));
  }

  /** Unified Chart.js theme palette derived from the live CSS custom
   *  properties on `<html>`. Returns the *superset* of keys any chart on the
   *  page asks for (grid / axis / angle / ticks / label / accent / fill /
   *  stroke / point / marker / loaded / bars / curveColors). Sections pick
   *  whichever they need; unused keys are harmless.
   *
   *  Replaces seven per-file `chartTheme()` definitions that all read the
   *  same CSS variables and returned overlapping shapes. */
  function chartTheme() {
    var styles = (typeof window !== 'undefined' && window.getComputedStyle)
      ? getComputedStyle(document.documentElement)
      : null;
    var dark = EF.theme !== 'light';
    function v(name, fb) {
      if (!styles) return fb;
      var raw = styles.getPropertyValue(name);
      raw = raw ? raw.trim() : '';
      return raw || fb;
    }
    return {
      grid:   dark ? 'rgba(220, 232, 226, 0.10)' : 'rgba(26, 42, 34, 0.10)',
      axis:   dark ? 'rgba(220, 232, 226, 0.18)' : 'rgba(26, 42, 34, 0.20)',
      angle:  dark ? 'rgba(220, 232, 226, 0.18)' : 'rgba(26, 42, 34, 0.20)',
      ticks:  v('--c-text-muted', dark ? '#7e948a' : '#5a7068'),
      label:  v('--c-text',       dark ? '#dce8e2' : '#1a2a22'),
      accent: v('--c-accent',     '#4ade80'),
      fill:   'rgba(74, 222, 128, 0.22)',
      stroke: '#4ade80',
      point:  '#4ade80',
      marker: '#f59e0b',
      loaded: '#f59e0b',
      // Categorical palettes — fixed across themes so individual bars /
      // V-I curves keep their identity when the visitor toggles dark/light.
      curveColors: ['#3b82f6', '#a78bfa', '#f59e0b', '#ef4444'],
      bars:        ['#3b82f6', '#a78bfa', '#f59e0b', '#ef4444',
                    '#06b6d4', '#ec4899', '#84cc16', '#eab308']
    };
  }

  /** Copy `text` to the clipboard and flash a success label on the supplied
   *  button (then revert after `ms`). Returns the same Promise<boolean> as
   *  EF.copyToClipboard so the caller can chain a failure-path setWarning.
   *
   *  Replaces the verbose copy-button handlers that were duplicated verbatim
   *  across six calculator cards. */
  function copyWithFlash(btn, text, opts) {
    opts = opts || {};
    var ms = opts.ms || 1400;
    var label = opts.label || 'Copied ✓';
    return copyToClipboard(text).then(function (ok) {
      if (ok && btn) {
        var prev = btn.textContent;
        btn.textContent = label;
        setTimeout(function () { btn.textContent = prev; }, ms);
      }
      return ok;
    });
  }

  /** Smooth-scroll an element into view, honouring prefers-reduced-motion.
   *  When the user opts out of motion, we fall back to behavior: 'auto'
   *  (instant scroll) so the element still becomes visible. */
  function scrollIntoView(el, opts) {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    opts = opts || {};
    var reduced = window.matchMedia &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      behavior: reduced ? 'auto' : (opts.behavior || 'smooth'),
      block:    opts.block    || 'start',
      inline:   opts.inline   || 'nearest'
    });
  }

  /** Inject <title> and (optional) <desc> children into an existing SVG so
   *  screen readers can announce a meaningful description. Idempotent —
   *  calling twice on the same SVG is a no-op. Used for the Quick Wheel
   *  SVG, the resistor-preview SVG, and any future inline SVG.
   *
   *  Also wires aria-labelledby on the <svg> so AT picks up the title. */
  function describeSvg(svg, title, desc) {
    if (!svg || svg.querySelector(':scope > title, :scope > desc')) return;
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var titleId = 'ef-svg-title-' + Math.random().toString(36).slice(2, 9);
    var descId  = 'ef-svg-desc-'  + Math.random().toString(36).slice(2, 9);
    if (title) {
      var t = document.createElementNS(SVG_NS, 'title');
      t.id = titleId;
      t.textContent = title;
      svg.insertBefore(t, svg.firstChild);
    }
    if (desc) {
      var d = document.createElementNS(SVG_NS, 'desc');
      d.id = descId;
      d.textContent = desc;
      var titleEl = svg.querySelector(':scope > title');
      if (titleEl && titleEl.nextSibling) svg.insertBefore(d, titleEl.nextSibling);
      else                                 svg.appendChild(d);
    }
    var ids = [];
    if (title) ids.push(titleId);
    if (desc)  ids.push(descId);
    if (ids.length) {
      // Only set aria-labelledby if the SVG doesn't already carry an
      // aria-label attribute (which takes precedence in some assistive tech).
      // We additively wire the title/desc via aria-describedby so both
      // strands are announceable.
      var existingLabelled = svg.getAttribute('aria-labelledby') || '';
      var existingDescribed = svg.getAttribute('aria-describedby') || '';
      if (title && !svg.getAttribute('aria-label') && existingLabelled.indexOf(titleId) === -1) {
        svg.setAttribute('aria-labelledby', (existingLabelled + ' ' + titleId).trim());
      }
      if (desc && existingDescribed.indexOf(descId) === -1) {
        svg.setAttribute('aria-describedby', (existingDescribed + ' ' + descId).trim());
      }
    }
  }

  /** Walk a calculator card and auto-wire `aria-describedby` on every
   *  numeric input that has a sibling/labelledby <small> unit hint. This
   *  is what each calculator init function calls so screen readers can
   *  announce the unit string ("volts", "ohms", "farads") as a description
   *  of the input independent of its name. Idempotent — skips inputs whose
   *  describedby already covers the small.
   *
   *  Resolution order:
   *    1. If the input has aria-labelledby, take that span and look for a
   *       descendent <small>. Use the FIRST <small> found.
   *    2. Else, look for a <small> within the closest .electronics-ohms-field
   *       or .electronics-calculator__field ancestor. */
  function autoWireUnitHints(card) {
    if (!card || typeof card.querySelectorAll !== 'function') return;
    var inputs = card.querySelectorAll(
      'input[type="number"].electronics-calculator__input, ' +
      'input.electronics-calculator__input[inputmode="decimal"]'
    );
    Array.prototype.forEach.call(inputs, function (input) {
      var small = null;
      var labelledById = input.getAttribute('aria-labelledby');
      if (labelledById) {
        var labelSpan = card.ownerDocument.getElementById(labelledById);
        if (labelSpan) small = labelSpan.querySelector('small');
      }
      if (!small) {
        var field = input.closest('.electronics-ohms-field, .electronics-calculator__field');
        if (field) small = field.querySelector(':scope > .electronics-ohms-field__label small, :scope small');
      }
      if (small) wireInputDescription(input, small);
    });
  }

  /** Wire `input.aria-describedby` to point at `descSpan`. Auto-generates an
   *  id on the description span if it lacks one. Idempotent. Used to link
   *  every numeric calculator input to its small unit-hint span (e.g. the
   *  "volts" / "ohms" / "farads" sub-label). */
  function wireInputDescription(input, descSpan) {
    if (!input || !descSpan) return;
    if (!descSpan.id) {
      descSpan.id = 'ef-aria-desc-' + Math.random().toString(36).slice(2, 9);
    }
    var existing = input.getAttribute('aria-describedby') || '';
    var parts = existing ? existing.split(/\s+/) : [];
    if (parts.indexOf(descSpan.id) === -1) {
      parts.push(descSpan.id);
      input.setAttribute('aria-describedby', parts.join(' '));
    }
  }

  // ==========================================================================
  // Capacitor unit display helpers (Batch 9)
  //   The Series/Parallel + RC Timer calcs store capacitance in farads
  //   internally (the math wants SI units), but humans pick capacitors in
  //   µF / nF / pF. These helpers swap between the two so an input shows
  //   "10" with a "µF" suffix instead of "0.00001" + "farads".
  // ==========================================================================

  /** Pick the friendliest µF / nF / pF unit for a capacitance in farads.
   *  Threshold is the floor of each prefix — a value of exactly 1e-6 maps
   *  to µF, 1e-9 maps to nF, anything below 1 nF (and finite/positive) maps
   *  to pF. Zero / NaN / negative values default to µF so the input is
   *  still parseable; the caller is responsible for the empty-display case. */
  function capUnitForValue(farads) {
    if (!Number.isFinite(farads) || farads <= 0) return { factor: 1e-6, label: 'µF' };
    if (farads >= 1e-6) return { factor: 1e-6, label: 'µF' };
    if (farads >= 1e-9) return { factor: 1e-9, label: 'nF' };
    return { factor: 1e-12, label: 'pF' };
  }

  /** Format a farads value as the visible string the input should display
   *  in the given unit (auto-picked when not supplied). 3 significant
   *  digits matches formatNumberWithUnits. Returns '' for non-finite. */
  function formatCapacitorValue(farads, unit) {
    if (!Number.isFinite(farads) || farads <= 0) return '';
    var u = unit || capUnitForValue(farads);
    var scaled = farads / u.factor;
    return String(Number(scaled.toPrecision(3)));
  }

  /** Parse the raw text from a capacitor input back into farads, given the
   *  unit currently displayed alongside it. Returns NaN for empty / bad
   *  input so the caller's existing isFinite guards keep working. */
  function parseCapacitorInput(raw, unit) {
    var n = sanitizeInput(raw);
    if (!Number.isFinite(n)) return NaN;
    var factor = (unit && Number.isFinite(unit.factor)) ? unit.factor : 1e-6;
    return n * factor;
  }

  // ==========================================================================
  // Soft input-range warnings (Batch 9)
  //   Most circuits live inside a narrow band of physically-reasonable
  //   values (R: 1 Ω – 10 MΩ, V: ≤ 60 V hobby, …). When a user types a
  //   value far outside that band — usually a typo or a unit confusion —
  //   we surface a non-blocking warning string so they catch it before it
  //   drives a confusing result. Returns '' when the value is in range.
  //
  //   Centralising the thresholds here means every calculator uses the
  //   same range and the same wording.
  // ==========================================================================
  var SOFT_LIMITS = {
    V:       { max: 1000,   min: 0,     msg: 'Most hobby circuits use 1 V – 60 V; verify isolation above 50 V.' },
    Vsupply: { max: 60,     min: 0,     msg: 'Most hobby supplies are 1 V – 48 V.' },
    Vin:     { max: 60,     min: 0,     msg: 'Most hobby supplies are 1 V – 48 V.' },
    Vf:      { max: 12,     min: 0,     msg: 'LED forward voltage is typically 1.6 V – 4 V.' },
    I:       { max: 10,     min: 0,     msg: 'Most circuits use 1 µA – 10 A; verify wire gauge above 10 A.' },
    R:       { max: 10e6,   min: 1,     msg: 'Most circuits use 1 Ω – 10 MΩ.' },
    R1:      { max: 10e6,   min: 1,     msg: 'Most divider resistors live in the 1 Ω – 10 MΩ range.' },
    R2:      { max: 10e6,   min: 1,     msg: 'Most divider resistors live in the 1 Ω – 10 MΩ range.' },
    RL:      { max: 100e6,  min: 1,     msg: 'Loads above 100 MΩ are unusual outside meter inputs.' },
    P:       { max: 100,    min: 0,     msg: 'Most hobby circuits dissipate < 100 W; verify heatsinking above this.' },
    C:       { max: 1,      min: 1e-13, msg: 'Most capacitors are 1 pF – 10 mF; values above 1 F are supercaps.' }
  };

  /** Look up the soft-limit message string for a quantity at a given value.
   *  Returns '' when in range or the quantity is unknown. */
  function softLimitWarning(quantity, value) {
    if (!quantity || !Number.isFinite(value)) return '';
    var lim = SOFT_LIMITS[quantity];
    if (!lim) return '';
    if (value > lim.max || (lim.min !== undefined && value > 0 && value < lim.min)) {
      return lim.msg;
    }
    return '';
  }


  // ==========================================================================
  // EF namespace bootstrap
  //   Idempotent — if a previous file already created the namespace (e.g.
  //   during hot-reload) we extend it rather than replace it. `widgets` is
  //   the per-widget registry every section pushes its onResize/onThemeChange
  //   /getState/reset/restoreState entry into.
  // ==========================================================================
  var EF = window.ElectronicsFundamentals || {};
  EF.debounce              = debounce;
  EF.copyToClipboard       = copyToClipboard;
  EF.formatNumberWithUnits = formatNumberWithUnits;
  EF.readDataIsland        = readDataIsland;
  EF.sanitizeInput         = sanitizeInput;
  EF.findWidgetByName      = findWidgetByName;
  EF.solveOhmsLaw          = solveOhmsLaw;
  EF.syncSliderToValue     = syncSliderToValue;
  EF.chartTheme            = chartTheme;
  EF.copyWithFlash         = copyWithFlash;
  EF.scrollIntoView        = scrollIntoView;
  EF.describeSvg           = describeSvg;
  EF.wireInputDescription  = wireInputDescription;
  EF.autoWireUnitHints     = autoWireUnitHints;
  EF.capUnitForValue       = capUnitForValue;
  EF.formatCapacitorValue  = formatCapacitorValue;
  EF.parseCapacitorInput   = parseCapacitorInput;
  EF.softLimitWarning      = softLimitWarning;
  if (!Array.isArray(EF.widgets)) EF.widgets = [];
  window.ElectronicsFundamentals = EF;

  // Optional page-level data island; future batches may populate this.
  EF.data = readDataIsland('electronics-data');

  // ==========================================================================
  // Theme synchronisation
  //   The site toggles theme via [data-theme] on <html>. Watch for changes
  //   so any Chart.js instance can re-skin without a full reload.
  // ==========================================================================
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }
  EF.theme = currentTheme();

  var themeObserver = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === 'data-theme') {
        EF.theme = currentTheme();
        for (var j = 0; j < EF.widgets.length; j++) {
          if (typeof EF.widgets[j].onThemeChange === 'function') {
            try { EF.widgets[j].onThemeChange(EF.theme); } catch (_) { /* ignore */ }
          }
        }
        document.dispatchEvent(new CustomEvent('electronics:theme',
          { detail: { theme: EF.theme } }));
      }
    }
  });
  themeObserver.observe(document.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] });

  // ==========================================================================
  // Resize handling
  //   Charts and the Quick Reference Wheel rebuild on viewport changes;
  //   widgets opt in by registering an `onResize` callback in their
  //   EF.widgets entry.
  // ==========================================================================
  var handleResize = debounce(function () {
    for (var i = 0; i < EF.widgets.length; i++) {
      if (typeof EF.widgets[i].onResize === 'function') {
        try { EF.widgets[i].onResize(); } catch (_) { /* ignore */ }
      }
    }
  }, 150);
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });
})();
