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
