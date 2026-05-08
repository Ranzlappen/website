/* ============================================================================
   Electronics Fundamentals Reference — page behaviour
   ----------------------------------------------------------------------------
   Companion script for /references/electronics-fundamentals/. Mirrors the
   structural patterns of assets/js/spectrum.js (top-level IIFE, no globals,
   silent no-op when the page-specific markup is absent).

   Six locked sections will be filled in incrementally:
     1. Quick Reference Wheel       (Batch 4)
     2. Core Formulas & Laws        (Batch 5)
     3. Interactive Calculators     (Batch 6)
     4. Component References/Charts (Batch 7)
     5. Circuit Design Guides       (Batch 8)
     6. Reference Tables            (Batch 9)

   Chart.js is loaded lazily (and only when consent is granted) so the page
   stays fast for the formula/calculator sections that don't need it.
   ========================================================================== */
(function () {
  'use strict';

  // Bail out cleanly on every other page on the site.
  var page = document.querySelector('.electronics-page');
  if (!page) return;

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

  /** Format a numeric value with an SI prefix (12000 → "12 kΩ", 0.0047 → "4.7 mΩ").
   *  Returns a plain string; the caller picks the unit suffix. */
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

  // Expose a tiny namespace for later batches to hang helpers / shared state
  // off of, instead of dotting more globals onto window.
  var EF = {
    debounce: debounce,
    copyToClipboard: copyToClipboard,
    formatNumberWithUnits: formatNumberWithUnits,
    readDataIsland: readDataIsland,
    // Each section's init() will register itself here so resize/theme handlers
    // can iterate every active widget without reaching back into the DOM.
    widgets: []
  };
  window.ElectronicsFundamentals = EF;

  // ==========================================================================
  // Data island loader
  //   <script type="application/json" id="electronics-data"> … </script>
  //   Future Liquid-rendered batches will populate this with formula
  //   definitions, calculator metadata, table rows, etc.
  // ==========================================================================
  EF.data = readDataIsland('electronics-data');

  // ==========================================================================
  // Theme synchronisation
  //   The site toggles theme via [data-theme] on <html>. Watch for changes so
  //   any future Chart.js instances can re-skin themselves on toggle without
  //   a full reload.
  // ==========================================================================
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }
  EF.theme = currentTheme();

  var themeObserver = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === 'data-theme') {
        EF.theme = currentTheme();
        // TODO: Batch 7+ — re-skin live Chart.js widgets here.
        for (var j = 0; j < EF.widgets.length; j++) {
          if (typeof EF.widgets[j].onThemeChange === 'function') {
            try { EF.widgets[j].onThemeChange(EF.theme); } catch (_) { /* ignore */ }
          }
        }
        document.dispatchEvent(new CustomEvent('electronics:theme', { detail: { theme: EF.theme } }));
      }
    }
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ==========================================================================
  // Resize handling
  //   Charts and the Quick Reference Wheel will need to rebuild on viewport
  //   changes; widgets opt in by registering an `onResize` callback.
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

  // ==========================================================================
  // Chart.js lazy-load
  //   Many sections (formulas, design guides, reference tables) won't need
  //   Chart.js at all. Sections that DO (e.g. component charts in Batch 7)
  //   call EF.ensureChartJs() and receive a Promise that resolves once the
  //   library is on `window.Chart`.
  //
  //   Honours the site's cookie-consent pattern (see _layouts/default.html):
  //   if the visitor hasn't accepted functional cookies yet, the loader waits
  //   on the `consent-updated` event before injecting the CDN <script>.
  // ==========================================================================
  var CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
  var chartPromise = null;

  function loadChartScript() {
    return new Promise(function (resolve, reject) {
      if (window.Chart) { resolve(window.Chart); return; }
      // Re-use any tag the post-layout loader may have already injected.
      var existing = document.querySelector('script[data-electronics-chart]') ||
                     document.querySelector('script[src="' + CHART_CDN + '"]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.Chart); });
        existing.addEventListener('error', function () { reject(new Error('Chart.js failed to load')); });
        return;
      }
      var s = document.createElement('script');
      s.src = CHART_CDN;
      s.async = true;
      s.setAttribute('data-electronics-chart', '');
      s.onload = function () { resolve(window.Chart); };
      s.onerror = function () { reject(new Error('Chart.js failed to load')); };
      document.head.appendChild(s);
    });
  }

  EF.ensureChartJs = function () {
    if (chartPromise) return chartPromise;
    chartPromise = new Promise(function (resolve, reject) {
      var consent = window.__cookieConsent;
      if (consent && consent.functional) {
        loadChartScript().then(resolve, reject);
        return;
      }
      window.addEventListener('consent-updated', function handler(e) {
        if (e && e.detail && e.detail.functional) {
          window.removeEventListener('consent-updated', handler);
          loadChartScript().then(resolve, reject);
        }
      });
    });
    return chartPromise;
  };

  // ==========================================================================
  // Section bootstrap — placeholder hooks for each batch
  //   Each init function below is a no-op until its batch lands. Keeping the
  //   wiring in place now means later batches only have to fill in the body,
  //   not touch DOMContentLoaded plumbing.
  // ==========================================================================
  function initQuickReferenceWheel() {
    var wheel = document.getElementById('electronics-wheel');
    if (!wheel) return;
    // TODO: Batch 4 will implement the Ohm's Law Wheel here.
  }

  function initFormulas() {
    var grid = document.getElementById('electronics-formulas-grid');
    if (!grid) return;
    // TODO: Batch 5 will render formula cards from EF.data.formulas here.
  }

  function initCalculators() {
    var grid = document.getElementById('electronics-calculators-grid');
    if (!grid) return;
    // TODO: Batch 6 will wire up the interactive calculators here
    //       (Ohm's law, voltage divider, LED resistor, RC time constant…).
  }

  function initComponentCharts() {
    var grid = document.getElementById('electronics-components-grid');
    if (!grid) return;
    // TODO: Batch 7 will render the resistor color-code chart, capacitor
    //       markings, and E-series tables here. Charts that need Chart.js
    //       should call EF.ensureChartJs().then(...).
  }

  function initDesignGuides() {
    var grid = document.getElementById('electronics-guides-grid');
    if (!grid) return;
    // TODO: Batch 8 will populate the design-guide cards here.
  }

  function initReferenceTables() {
    var grid = document.getElementById('electronics-tables-grid');
    if (!grid) return;
    // TODO: Batch 9 will render SI prefixes, unit conversions, and schematic
    //       symbols here.
  }

  // ==========================================================================
  // Boot
  // ==========================================================================
  function boot() {
    initQuickReferenceWheel();
    initFormulas();
    initCalculators();
    initComponentCharts();
    initDesignGuides();
    initReferenceTables();
    // eslint-disable-next-line no-console
    console.log('✅ Electronics Fundamentals JS initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
