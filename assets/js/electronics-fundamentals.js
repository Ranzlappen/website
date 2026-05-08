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

    var section   = document.getElementById('electronics-quick-reference');
    var statusEl  = document.getElementById('electronics-wheel-status');
    var canvas    = document.getElementById('electronics-power-chart');
    var clearBtn  = document.getElementById('electronics-wheel-clear');
    var quadrants = wheel.querySelectorAll('.electronics-wheel__quadrant');
    var examples  = section ? section.querySelectorAll('.electronics-wheel-example') : [];

    var QTY = ['V', 'I', 'R', 'P'];
    var inputs = {};
    var fields = {};
    QTY.forEach(function (name) {
      inputs[name] = document.getElementById('ef-wheel-' + name);
      fields[name] = section ? section.querySelector('.electronics-calculator__field[data-field="' + name + '"]') : null;
    });
    if (!inputs.V || !inputs.I || !inputs.R || !inputs.P) return;

    // Anything below this is treated as zero for divide-by-zero detection. The
    // value matches typical hobby-grade meter resolution (1 µV / 1 µA / 1 µΩ).
    var EPSILON = 1e-9;

    // Order matters: when a third field receives user input, the oldest of the
    // current pair gets evicted. This keeps the "two known, two computed"
    // invariant without forcing the user to clear a field first.
    var userOrder = [];
    var userValues = {};
    var chart = null;

    // ----------------------------------------------------------------------
    // Solver: takes the two user-provided quantities and derives the other
    // two via Ohm's law (V = I·R) and the power identity (P = V·I).
    // Returns { values } on success, { error } on a divide-by-zero / domain
    // violation, or { partial: true, values } if the inputs themselves are
    // valid but trivially under-determined (e.g. P=R=0).
    // ----------------------------------------------------------------------
    function solve(known) {
      var a = known[0];
      var b = known[1];
      var pair = [a.name, b.name].sort().join('');
      var out = { V: NaN, I: NaN, R: NaN, P: NaN };
      out[a.name] = a.value;
      out[b.name] = b.value;

      function err(msg) { return { error: msg }; }

      switch (pair) {
        case 'IV': {
          var V = out.V, I = out.I;
          if (Math.abs(I) < EPSILON) return err('Cannot derive R: current is zero (open circuit).');
          out.R = V / I;
          out.P = V * I;
          break;
        }
        case 'RV': {
          var V2 = out.V, R = out.R;
          if (R < 0) return err('Resistance cannot be negative.');
          if (Math.abs(R) < EPSILON) return err('Cannot derive I: resistance is zero (short circuit).');
          out.I = V2 / R;
          out.P = (V2 * V2) / R;
          break;
        }
        case 'PV': {
          var V3 = out.V, P = out.P;
          if (P < 0) return err('Power cannot be negative.');
          if (Math.abs(V3) < EPSILON) return err('Cannot derive I or R: voltage is zero.');
          out.I = P / V3;
          out.R = Math.abs(P) < EPSILON ? Infinity : (V3 * V3) / P;
          break;
        }
        case 'IR': {
          var I2 = out.I, R2 = out.R;
          if (R2 < 0) return err('Resistance cannot be negative.');
          out.V = I2 * R2;
          out.P = I2 * I2 * R2;
          break;
        }
        case 'IP': {
          var I3 = out.I, P2 = out.P;
          if (P2 < 0) return err('Power cannot be negative.');
          if (Math.abs(I3) < EPSILON) return err('Cannot derive V or R: current is zero.');
          out.V = P2 / I3;
          out.R = P2 / (I3 * I3);
          break;
        }
        case 'PR': {
          var P3 = out.P, R3 = out.R;
          if (P3 < 0) return err('Power cannot be negative.');
          if (R3 < 0) return err('Resistance cannot be negative.');
          if (Math.abs(R3) < EPSILON && Math.abs(P3) < EPSILON) {
            return { partial: true, values: out };
          }
          if (Math.abs(R3) < EPSILON) return err('Cannot derive V: resistance is zero with non-zero power.');
          out.V = Math.sqrt(P3 * R3);
          out.I = Math.sqrt(P3 / R3);
          break;
        }
      }
      return { values: out };
    }

    // ----------------------------------------------------------------------
    // Status helpers
    // ----------------------------------------------------------------------
    function setStatus(text, type) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.classList.toggle('electronics-wheel-status--warn', type === 'warn');
      statusEl.classList.toggle('electronics-wheel-status--ok',   type === 'ok');
    }
    function summarize(v) {
      return [
        'V = ' + EF.formatNumberWithUnits(v.V, 'V'),
        'I = ' + EF.formatNumberWithUnits(v.I, 'A'),
        'R = ' + EF.formatNumberWithUnits(v.R, 'Ω'),
        'P = ' + EF.formatNumberWithUnits(v.P, 'W')
      ].join('  ·  ');
    }
    function isUserInput(name) { return Object.prototype.hasOwnProperty.call(userValues, name); }

    // ----------------------------------------------------------------------
    // Display: write computed values back into the un-edited fields.
    // ----------------------------------------------------------------------
    function clearComputedFields() {
      QTY.forEach(function (n) {
        if (!isUserInput(n)) {
          inputs[n].value = '';
        }
        if (fields[n]) fields[n].classList.remove('electronics-wheel-field--computed');
      });
    }

    function renderResult(result) {
      if (result.error) {
        setStatus('⚠ ' + result.error, 'warn');
        clearComputedFields();
        updateChart(null);
        return;
      }
      var v = result.values;
      QTY.forEach(function (n) {
        if (isUserInput(n)) {
          if (fields[n]) fields[n].classList.remove('electronics-wheel-field--computed');
          return;
        }
        var val = v[n];
        if (isFinite(val)) {
          // 4 sig figs covers hobby-grade precision and avoids 0.12000000001
          // floating-point dust.
          inputs[n].value = String(Number(val.toPrecision(4)));
          if (fields[n]) fields[n].classList.add('electronics-wheel-field--computed');
        } else {
          inputs[n].value = isFinite(val) ? '' : '∞';
          if (fields[n]) fields[n].classList.remove('electronics-wheel-field--computed');
        }
      });
      if (result.partial) {
        setStatus('All four quantities are zero — circuit has no excitation.', 'ok');
      } else {
        setStatus('✓ ' + summarize(v), 'ok');
      }
      updateChart(v);
    }

    // ----------------------------------------------------------------------
    // Recompute pipeline
    // ----------------------------------------------------------------------
    function recompute() {
      if (userOrder.length < 2) {
        clearComputedFields();
        setStatus(userOrder.length === 0
          ? 'Enter any two values to solve for the rest.'
          : 'Enter one more value (' + userOrder[0] + ' is set) to solve.');
        updateChart(null);
        return;
      }
      var pair = userOrder.slice(-2).map(function (name) {
        return { name: name, value: userValues[name] };
      });
      renderResult(solve(pair));
    }

    var debouncedRecompute = EF.debounce(recompute, 80);

    // ----------------------------------------------------------------------
    // Input plumbing
    // ----------------------------------------------------------------------
    function trackUserInput(name, value) {
      // Drop any prior tracking of this name, then push it as the newest.
      var idx = userOrder.indexOf(name);
      if (idx !== -1) userOrder.splice(idx, 1);

      if (value === '' || value === null || value === undefined) {
        delete userValues[name];
        return;
      }
      var num = parseFloat(value);
      if (!isFinite(num)) { delete userValues[name]; return; }
      userValues[name] = num;
      userOrder.push(name);

      // Cap user-provided fields at 2; evict the oldest beyond that so the
      // most recently edited pair always wins.
      while (userOrder.length > 2) {
        var dropped = userOrder.shift();
        delete userValues[dropped];
      }
    }

    QTY.forEach(function (name) {
      inputs[name].addEventListener('input', function () {
        trackUserInput(name, inputs[name].value);
        if (fields[name]) fields[name].classList.remove('electronics-wheel-field--computed');
        debouncedRecompute();
      });
      inputs[name].addEventListener('focus', function () {
        quadrants.forEach(function (q) {
          q.classList.toggle('is-focused', q.getAttribute('data-quantity') === name);
        });
      });
      inputs[name].addEventListener('blur', function () {
        quadrants.forEach(function (q) { q.classList.remove('is-focused'); });
      });
    });

    // ----------------------------------------------------------------------
    // SVG quadrant click / keyboard activation
    // ----------------------------------------------------------------------
    function focusQuantity(name) {
      var input = inputs[name];
      if (!input) return;
      quadrants.forEach(function (q) {
        q.classList.toggle('is-focused', q.getAttribute('data-quantity') === name);
      });
      input.focus();
      try { input.select(); } catch (_) { /* number inputs may reject .select() in some engines */ }
    }
    quadrants.forEach(function (q) {
      var name = q.getAttribute('data-quantity');
      q.addEventListener('click', function () { focusQuantity(name); });
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          focusQuantity(name);
        }
      });
    });

    // ----------------------------------------------------------------------
    // Example presets — each one specifies exactly two known values; the
    // solver fills in the rest.
    // ----------------------------------------------------------------------
    var EXAMPLES = {
      battery: { V: 12,  R: 100 },   // 12 V lead-acid into a 100 Ω load
      led:     { V: 5,   I: 0.02 },  // 5 V supply driving a 20 mA LED branch
      usb:     { V: 5,   I: 2 }      // USB Type-A high-power port at 5 V / 2 A
    };
    function loadExample(key) {
      var preset = EXAMPLES[key];
      if (!preset) return;
      // Reset entirely so any computed fields don't masquerade as user input.
      userOrder = [];
      userValues = {};
      QTY.forEach(function (n) { inputs[n].value = ''; });
      Object.keys(preset).forEach(function (n) {
        inputs[n].value = preset[n];
        trackUserInput(n, preset[n]);
      });
      recompute();
    }
    examples.forEach(function (btn) {
      btn.addEventListener('click', function () { loadExample(btn.getAttribute('data-example')); });
    });

    // ----------------------------------------------------------------------
    // Clear all
    // ----------------------------------------------------------------------
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        userOrder = [];
        userValues = {};
        QTY.forEach(function (n) { inputs[n].value = ''; });
        recompute();
        inputs.V.focus();
      });
    }

    // ----------------------------------------------------------------------
    // Power-Triangle radar chart (lazy-loaded Chart.js)
    //
    // V/I/R/P all live on different scales, so the radar plots
    // log10(1 + |x|) — that maps 0→0, 1→0.301, 100→2.004, 10000→4.000 and
    // keeps a 12 V / 100 Ω / 0.12 A / 1.44 W example legible without one
    // axis dwarfing the others.
    // ----------------------------------------------------------------------
    function chartTheme() {
      var dark = EF.theme !== 'light';
      return {
        grid:    dark ? 'rgba(220, 232, 226, 0.10)' : 'rgba(26, 42, 34, 0.10)',
        angle:   dark ? 'rgba(220, 232, 226, 0.18)' : 'rgba(26, 42, 34, 0.20)',
        ticks:   dark ? '#7e948a' : '#5a7068',
        label:   dark ? '#dce8e2' : '#1a2a22',
        fill:    'rgba(74, 222, 128, 0.22)',
        stroke:  '#4ade80',
        point:   '#4ade80'
      };
    }
    function logScale(x) {
      if (!isFinite(x) || x <= 0) return 0;
      return Math.log10(1 + Math.abs(x));
    }
    function chartData(v) {
      v = v || {};
      return [logScale(v.V), logScale(v.I), logScale(v.R), logScale(v.P)];
    }

    function buildChart() {
      if (!window.Chart || !canvas) return;
      var t = chartTheme();
      chart = new window.Chart(canvas, {
        type: 'radar',
        data: {
          labels: ['V', 'I', 'R', 'P'],
          datasets: [{
            label: 'log₁₀(1 + value)',
            data: [0, 0, 0, 0],
            backgroundColor: t.fill,
            borderColor: t.stroke,
            pointBackgroundColor: t.point,
            pointBorderColor: t.point,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 250 },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var labels = ['V (volts)', 'I (amps)', 'R (ohms)', 'P (watts)'];
                  return labels[ctx.dataIndex] + ' — log₁₀(1+x) = ' + ctx.parsed.r.toFixed(2);
                }
              }
            }
          },
          scales: {
            r: {
              beginAtZero: true,
              suggestedMax: 1,
              grid:        { color: t.grid },
              angleLines:  { color: t.angle },
              ticks:       { color: t.ticks, backdropColor: 'transparent', font: { size: 10 } },
              pointLabels: { color: t.label, font: { size: 13, weight: '600' } }
            }
          }
        }
      });
    }

    function updateChart(v) {
      if (!chart) return;
      chart.data.datasets[0].data = chartData(v);
      chart.update('none');
    }

    function applyChartTheme() {
      if (!chart) return;
      var t = chartTheme();
      var ds = chart.data.datasets[0];
      ds.backgroundColor      = t.fill;
      ds.borderColor          = t.stroke;
      ds.pointBackgroundColor = t.point;
      ds.pointBorderColor     = t.point;
      var r = chart.options.scales.r;
      r.grid.color        = t.grid;
      r.angleLines.color  = t.angle;
      r.ticks.color       = t.ticks;
      r.pointLabels.color = t.label;
      chart.update('none');
    }

    EF.ensureChartJs().then(function () {
      buildChart();
      // Replay any user input the visitor entered before Chart.js finished
      // loading (rare but possible on slow networks).
      recompute();
    }, function () {
      setStatus('Power-Triangle chart unavailable (Chart.js blocked or offline). Calculations still work.', 'warn');
    });

    // ----------------------------------------------------------------------
    // External API — other sections (e.g. the Formulas "Try it" buttons) can
    // load a preset by calling EF.widgets[…].setValues({V: 9, R: 100}).
    //
    // Resets state entirely so any computed fields don't masquerade as user
    // input, then writes the supplied 1-2 known values and recomputes. By
    // default scrolls the wheel into view so the visitor sees the result;
    // pass { scroll: false } to suppress.
    // ----------------------------------------------------------------------
    function setExternalValues(values, opts) {
      opts = opts || {};
      if (!values || typeof values !== 'object') return;
      userOrder = [];
      userValues = {};
      QTY.forEach(function (n) { inputs[n].value = ''; });
      Object.keys(values).forEach(function (n) {
        if (!inputs[n]) return;
        var num = parseFloat(values[n]);
        if (!isFinite(num)) return;
        inputs[n].value = String(num);
        trackUserInput(n, num);
      });
      recompute();
      if (opts.scroll !== false && section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // ----------------------------------------------------------------------
    // Widget registration — the central theme/resize plumbing handles the
    // rest, so the chart re-skins on theme toggle and resizes with viewport
    // changes without per-widget listeners.
    // ----------------------------------------------------------------------
    EF.widgets.push({
      name: 'quick-reference-wheel',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme,
      setValues: setExternalValues
    });

    // Initial state
    recompute();
  }

  // ==========================================================================
  // Section 2 — Core Formulas & Laws
  //   Wires the "Try it" button on every formula card to the Quick Reference
  //   Wheel. Each button declares its preset via data-try-* attributes
  //   (data-try-v / data-try-i / data-try-r / data-try-p); the click handler
  //   reads them, hands the resulting object to the wheel widget's
  //   setValues() method, and lets the wheel handle the recompute + scroll.
  //
  //   Falls back to a direct DOM-event dispatch when the wheel widget hasn't
  //   registered yet (e.g. if Chart.js fails to load and the wheel exits
  //   early), so Try-it remains useful even in degraded states.
  // ==========================================================================
  function initFormulasSection() {
    var grid = document.getElementById('electronics-formulas-grid');
    if (!grid) return;

    var buttons = grid.querySelectorAll('button[data-try-button]');
    if (!buttons.length) return;

    var QTY = ['V', 'I', 'R', 'P'];

    function findWheelWidget() {
      for (var i = 0; i < EF.widgets.length; i++) {
        if (EF.widgets[i].name === 'quick-reference-wheel') return EF.widgets[i];
      }
      return null;
    }

    function readPreset(btn) {
      var out = {};
      for (var i = 0; i < QTY.length; i++) {
        var raw = btn.getAttribute('data-try-' + QTY[i].toLowerCase());
        if (raw === null || raw === '') continue;
        var num = parseFloat(raw);
        if (isFinite(num)) out[QTY[i]] = num;
      }
      return out;
    }

    function fallbackFill(values) {
      // Direct DOM path — fire input events so the wheel's own listeners
      // rebuild userOrder / userValues correctly.
      QTY.forEach(function (n) {
        var input = document.getElementById('ef-wheel-' + n);
        if (!input) return;
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      Object.keys(values).forEach(function (n) {
        var input = document.getElementById('ef-wheel-' + n);
        if (!input) return;
        input.value = String(values[n]);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      var wheelSection = document.getElementById('electronics-quick-reference');
      if (wheelSection) wheelSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handleClick(btn) {
      var label = btn.getAttribute('data-try-label') || btn.textContent.trim();
      var preset = readPreset(btn);
      var keys = Object.keys(preset);

      if (keys.length < 2) {
        // eslint-disable-next-line no-console
        console.warn('🧮 Try-it: "' + label + '" needs at least two of V/I/R/P; got', preset);
        return;
      }

      var wheel = findWheelWidget();
      if (wheel && typeof wheel.setValues === 'function') {
        wheel.setValues(preset, { scroll: true });
      } else {
        fallbackFill(preset);
      }

      // eslint-disable-next-line no-console
      console.log('🧮 Try-it: loaded "' + label + '" into the Quick Wheel →', preset);
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () { handleClick(btn); });
    });

    // Future hook: if formula cards ever need theme-aware rendering (e.g.
    // syntax-highlighted equations), the registry-based theme listener is
    // already in place. For now the cards rely on CSS variables only, so no
    // onThemeChange is needed.
  }

  // ==========================================================================
  // Section 3 — Interactive Calculators
  //   Section-level dispatcher. Each calculator is a self-contained init()
  //   that mounts onto its own card; this function just wires them up.
  // ==========================================================================
  function initCalculators() {
    var grid = document.getElementById('electronics-calculators-grid');
    if (!grid) return;
    initOhmsLawCalculator();
    initLedResistorCalculator();
    initVoltageDividerCalculator();
    initSeriesParallelCalculator();
    initRcTimerCalculator();
    // TODO: future batches — op-amp gain, thermal resistance, transistor bias
    //                       calculators will be initialised here as siblings.
  }

  // --------------------------------------------------------------------------
  // Shared E-series snap helper. Returns the nearest preferred-value resistor
  // in the requested decade-multiplied series ("E12" or "E24").
  // --------------------------------------------------------------------------
  var E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  var E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
             3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
  function nearestEseries(value, seriesName) {
    if (!isFinite(value) || value <= 0) return null;
    var series = (seriesName === 'E24') ? E24 : E12;
    var decade = Math.pow(10, Math.floor(Math.log10(value)));
    var mantissa = value / decade;
    var best = series[0];
    var bestDiff = Math.abs(mantissa - series[0]);
    for (var i = 1; i < series.length; i++) {
      var diff = Math.abs(mantissa - series[i]);
      if (diff < bestDiff) { best = series[i]; bestDiff = diff; }
    }
    // Cross-decade rollover: 9.5 in this decade rounds to 10 in the next.
    if (Math.abs(mantissa - 10) < bestDiff) return decade * 10;
    return decade * best;
  }

  // --------------------------------------------------------------------------
  // Calculator 2 — LED Resistor
  //
  //   * Inputs: V_supply, LED color preset (sets V_f), V_f, target I.
  //   * Output: required series R = (V_supply − V_f) / I, snapped to the
  //     nearest E12 / E24 preferred value, plus power dissipations.
  //   * Chart: smooth I-V sigmoid centred at V_f, normalised so I(V_f) = I_target;
  //     fill under the curve hints at power; the operating-point dot is colour-
  //     coded by current safety (≤30 mA / ≤50 mA / above).
  // --------------------------------------------------------------------------
  function initLedResistorCalculator() {
    var card = document.getElementById('electronics-calc-led');
    if (!card) return;

    var inputs = {
      Vsupply: document.getElementById('ef-led-Vsupply'),
      Vf:      document.getElementById('ef-led-Vf'),
      I:       document.getElementById('ef-led-I')
    };
    var sliders = {
      Vsupply: document.getElementById('ef-led-Vsupply-slider'),
      Vf:      document.getElementById('ef-led-Vf-slider'),
      I:       document.getElementById('ef-led-I-slider')
    };
    var fields = {
      Vsupply: card.querySelector('.electronics-ohms-field[data-field="Vsupply"]'),
      Vf:      card.querySelector('.electronics-ohms-field[data-field="Vf"]'),
      I:       card.querySelector('.electronics-ohms-field[data-field="I"]')
    };
    if (!inputs.Vsupply || !inputs.Vf || !inputs.I) return;

    var colorSelect = document.getElementById('ef-led-color');
    var resultEl    = document.getElementById('electronics-led-result');
    var warningEl   = document.getElementById('electronics-led-warning');
    var clearBtn    = document.getElementById('electronics-led-clear');
    var copyBtn     = document.getElementById('electronics-led-copy');
    var openWheelBtn = document.getElementById('electronics-led-open-wheel');
    var canvas      = document.getElementById('electronics-calc-led-chart');
    var rCalcOut    = document.getElementById('ef-led-R-calc');
    var rE12Out     = document.getElementById('ef-led-R-e12');
    var rE24Out     = document.getElementById('ef-led-R-e24');
    var pillCalc    = card.querySelector('.electronics-led-eseries__pill[data-pill="calc"]');
    var pillE12     = card.querySelector('.electronics-led-eseries__pill[data-pill="e12"]');
    var pillE24     = card.querySelector('.electronics-led-eseries__pill[data-pill="e24"]');

    var data = EF.readDataIsland('electronics-calc-led-data');
    var DEFAULTS = (data && data.defaults) || { Vsupply: 5, color: 'red', Vf: 2.0, I: 0.02 };
    var PRESETS  = (data && data.presets)  || {};
    var THRESH   = (data && data.safeCurrentMa) || { ok: 30, caution: 50 };

    var lastResult = null;
    var chart = null;

    // -------- Input sync --------
    function syncSlider(name, value) {
      var s = sliders[name];
      if (!s || !isFinite(value)) return;
      var min = parseFloat(s.min), max = parseFloat(s.max);
      s.value = String(Math.max(min, Math.min(max, value)));
    }
    function readNumber(name) {
      var num = parseFloat(inputs[name].value);
      return isFinite(num) ? num : NaN;
    }

    // -------- Solver --------
    function compute() {
      var Vs = readNumber('Vsupply');
      var Vf = readNumber('Vf');
      var I  = readNumber('I');
      var ready = isFinite(Vs) && isFinite(Vf) && isFinite(I);
      if (!ready) {
        return { ready: false };
      }
      // Domain checks
      if (Vs <= 0)            return { ready: true, error: 'Supply voltage must be positive.' };
      if (Vf <= 0)            return { ready: true, error: 'Forward voltage must be positive.' };
      if (I  <= 0)            return { ready: true, error: 'Target current must be positive.' };
      if (Vs <= Vf)           return { ready: true, error: 'Supply (' + Vs.toFixed(2) + ' V) must exceed V_f (' + Vf.toFixed(2) + ' V) — the LED won\'t conduct.' };
      var Vr = Vs - Vf;
      var R  = Vr / I;
      var Pr = Vr * I;       // resistor dissipation
      var Pl = Vf * I;       // LED dissipation
      var Pt = Pr + Pl;
      return {
        ready: true,
        Vsupply: Vs, Vf: Vf, I: I, Vr: Vr, R: R,
        Pr: Pr, Pl: Pl, Pt: Pt,
        E12: nearestEseries(R, 'E12'),
        E24: nearestEseries(R, 'E24')
      };
    }

    function setResult(text, ok) {
      if (!resultEl) return;
      resultEl.textContent = text;
      resultEl.classList.toggle('electronics-ohms-result--ok', !!ok);
    }
    function setWarning(msg) {
      if (!warningEl) return;
      if (!msg) { warningEl.hidden = true; warningEl.textContent = ''; return; }
      warningEl.hidden = false;
      warningEl.textContent = '⚠ ' + msg;
    }

    function safetyTier(amps) {
      var ma = amps * 1000;
      if (ma <= THRESH.ok)      return 'safe';
      if (ma <= THRESH.caution) return 'caution';
      return 'danger';
    }
    function safetyColor(tier) {
      if (tier === 'danger')  return '#ef4444';
      if (tier === 'caution') return '#f59e0b';
      return '#4ade80';
    }
    function safetyMessage(tier, ma) {
      if (tier === 'danger')  return 'Target current ' + ma.toFixed(0) + ' mA exceeds typical 5 mm LED ratings — check the datasheet before driving this hard.';
      if (tier === 'caution') return 'Target current ' + ma.toFixed(0) + ' mA is near the limit for typical 20–30 mA indicator LEDs.';
      return '';
    }

    function pillsClear() {
      if (rCalcOut) rCalcOut.textContent = '—';
      if (rE12Out)  rE12Out.textContent  = '—';
      if (rE24Out)  rE24Out.textContent  = '—';
      [pillCalc, pillE12, pillE24].forEach(function (p) {
        if (p) p.classList.remove('electronics-led-eseries__pill--highlight');
      });
    }
    function pillsRender(r) {
      if (rCalcOut) rCalcOut.textContent = EF.formatNumberWithUnits(r.R, 'Ω');
      if (rE12Out)  rE12Out.textContent  = isFinite(r.E12) ? EF.formatNumberWithUnits(r.E12, 'Ω') : '—';
      if (rE24Out)  rE24Out.textContent  = isFinite(r.E24) ? EF.formatNumberWithUnits(r.E24, 'Ω') : '—';
      // Highlight whichever standard value is closer to the calculated R
      [pillCalc, pillE12, pillE24].forEach(function (p) {
        if (p) p.classList.remove('electronics-led-eseries__pill--highlight');
      });
      var diff12 = isFinite(r.E12) ? Math.abs(r.R - r.E12) : Infinity;
      var diff24 = isFinite(r.E24) ? Math.abs(r.R - r.E24) : Infinity;
      if (pillE12 && diff12 <= diff24 && isFinite(r.E12)) pillE12.classList.add('electronics-led-eseries__pill--highlight');
      else if (pillE24 && isFinite(r.E24))                pillE24.classList.add('electronics-led-eseries__pill--highlight');
    }

    function recompute() {
      var r = compute();
      lastResult = r;
      if (!r.ready) {
        setResult('Set a supply voltage, color, and target current.', false);
        setWarning('');
        pillsClear();
        updateChart(null);
        return;
      }
      if (r.error) {
        setResult('— ' + r.error, false);
        setWarning(r.error);
        pillsClear();
        updateChart(r);
        return;
      }
      var tier = safetyTier(r.I);
      var safetyMsg = safetyMessage(tier, r.I * 1000);
      setResult('✓  R = ' + EF.formatNumberWithUnits(r.R, 'Ω') +
                '  ·  V_R = ' + EF.formatNumberWithUnits(r.Vr, 'V') +
                '  ·  P_R = ' + EF.formatNumberWithUnits(r.Pr, 'W') +
                '  ·  P_LED = ' + EF.formatNumberWithUnits(r.Pl, 'W'), true);
      setWarning(safetyMsg);
      pillsRender(r);
      updateChart(r);
    }
    var debouncedRecompute = EF.debounce(recompute, 80);

    // -------- Wire inputs / sliders --------
    ['Vsupply', 'Vf', 'I'].forEach(function (name) {
      inputs[name].addEventListener('input', function () {
        var num = parseFloat(inputs[name].value);
        if (isFinite(num)) syncSlider(name, num);
        debouncedRecompute();
      });
      sliders[name].addEventListener('input', function () {
        inputs[name].value = sliders[name].value;
        debouncedRecompute();
      });
    });

    if (colorSelect) {
      colorSelect.addEventListener('change', function () {
        var key = colorSelect.value;
        if (key === 'custom') return;
        var preset = PRESETS[key];
        if (!preset || !isFinite(preset.vf)) return;
        inputs.Vf.value = String(preset.vf);
        syncSlider('Vf', preset.vf);
        recompute();
      });
    }

    // -------- Buttons --------
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        ['Vsupply', 'Vf', 'I'].forEach(function (name) {
          inputs[name].value = '';
          if (sliders[name]) sliders[name].value = sliders[name].min || '0';
        });
        if (colorSelect) colorSelect.value = 'custom';
        pillsClear();
        recompute();
        inputs.Vsupply.focus();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var r = lastResult;
        if (!r || !r.ready || r.error) {
          setWarning('Nothing to copy — fill in valid values first.');
          return;
        }
        var lines = [
          'LED Resistor calculator',
          'V_supply = ' + EF.formatNumberWithUnits(r.Vsupply, 'V'),
          'V_f      = ' + EF.formatNumberWithUnits(r.Vf, 'V'),
          'I_LED    = ' + EF.formatNumberWithUnits(r.I, 'A'),
          'R (calc) = ' + EF.formatNumberWithUnits(r.R, 'Ω'),
          'R (E12)  = ' + (isFinite(r.E12) ? EF.formatNumberWithUnits(r.E12, 'Ω') : '—'),
          'R (E24)  = ' + (isFinite(r.E24) ? EF.formatNumberWithUnits(r.E24, 'Ω') : '—'),
          'P_R      = ' + EF.formatNumberWithUnits(r.Pr, 'W'),
          'P_LED    = ' + EF.formatNumberWithUnits(r.Pl, 'W')
        ].join('\n');
        EF.copyToClipboard(lines).then(function (ok) {
          if (ok) {
            var prev = copyBtn.textContent;
            copyBtn.textContent = 'Copied ✓';
            setTimeout(function () { copyBtn.textContent = prev; }, 1400);
          } else {
            setWarning('Clipboard copy failed — your browser may block it on insecure pages.');
          }
        });
      });
    }

    if (openWheelBtn) {
      openWheelBtn.addEventListener('click', function () {
        var r = lastResult;
        if (!r || !r.ready || r.error) {
          setWarning('Fill in valid values before opening in the Quick Wheel.');
          return;
        }
        // Send the *resistor's* perspective: V across resistor + LED current.
        // The wheel shows R = Vr/I and P = Vr*I — coherent with this calculator.
        var values = { V: r.Vr, I: r.I };
        for (var w = 0; w < EF.widgets.length; w++) {
          if (EF.widgets[w].name === 'quick-reference-wheel' &&
              typeof EF.widgets[w].setValues === 'function') {
            EF.widgets[w].setValues(values, { scroll: true });
            // eslint-disable-next-line no-console
            console.log('🔦 LED Resistor → Quick Wheel (resistor side):', values);
            return;
          }
        }
        // Fallback: dispatch input events on wheel inputs.
        ['V', 'I', 'R', 'P'].forEach(function (n) {
          var el = document.getElementById('ef-wheel-' + n);
          if (!el) return;
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        Object.keys(values).forEach(function (n) {
          var el = document.getElementById('ef-wheel-' + n);
          if (!el) return;
          el.value = String(values[n]);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        var section = document.getElementById('electronics-quick-reference');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // -------- Chart --------
    function chartTheme() {
      var styles = getComputedStyle(document.documentElement);
      var dark = EF.theme !== 'light';
      function v(name, fb) { return styles.getPropertyValue(name).trim() || fb; }
      return {
        grid:   dark ? 'rgba(220, 232, 226, 0.10)' : 'rgba(26, 42, 34, 0.10)',
        ticks:  v('--c-text-muted', dark ? '#7e948a' : '#5a7068'),
        label:  v('--c-text',       dark ? '#dce8e2' : '#1a2a22'),
        accent: v('--c-accent',     '#4ade80')
      };
    }

    function ledIV(V, Vf, Itarget) {
      // Sigmoid centred at Vf, normalised so I(Vf) = Itarget. Steepness matches
      // the typical knee of a real LED's exponential curve closely enough for
      // a hobbyist visualisation.
      return Itarget * 2 / (1 + Math.exp(-(V - Vf) * 50));
    }

    function buildChart() {
      if (!window.Chart || !canvas) return;
      var t = chartTheme();
      chart = new window.Chart(canvas, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'I–V curve',
              data: [],
              borderColor: t.accent,
              backgroundColor: 'rgba(74, 222, 128, 0.18)',
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
              tension: 0.25
            },
            {
              label: 'Operating point',
              data: [],
              type: 'scatter',
              backgroundColor: t.accent,
              borderColor: t.accent,
              pointRadius: 7,
              pointHoverRadius: 9,
              pointStyle: 'rectRot',
              pointBorderWidth: 2,
              showLine: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 200 },
          parsing: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: t.label, font: { size: 11 }, boxWidth: 14, padding: 8 } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return ctx.dataset.label + ' — V=' + ctx.parsed.x.toFixed(2) + ' V, I=' + ctx.parsed.y.toFixed(1) + ' mA';
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear', min: 0,
              title: { display: true, text: 'V (volts)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            },
            y: {
              type: 'linear', min: 0,
              title: { display: true, text: 'I (mA)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            }
          }
        }
      });
    }

    function updateChart(r) {
      if (!chart) return;
      var Vf = (r && isFinite(r.Vf)) ? r.Vf : 2.0;
      var I  = (r && isFinite(r.I))  ? r.I  : 0.02;
      var Vmax = Math.max(Vf * 1.4, Vf + 0.4);
      var samples = 80;
      var data = new Array(samples + 1);
      for (var i = 0; i <= samples; i++) {
        var V = (i / samples) * Vmax;
        data[i] = { x: V, y: ledIV(V, Vf, I) * 1000 }; // mA
      }
      chart.data.datasets[0].data = data;

      var op = chart.data.datasets[1];
      if (r && r.ready && !r.error) {
        op.data = [{ x: Vf, y: I * 1000 }];
        var color = safetyColor(safetyTier(I));
        op.backgroundColor = color;
        op.borderColor = color;
      } else {
        op.data = [];
      }

      chart.options.scales.x.max = Vmax;
      chart.options.scales.y.max = Math.max(I * 1000 * 2.5, 50);
      chart.update('none');
    }

    function applyChartTheme() {
      if (!chart) return;
      var t = chartTheme();
      chart.options.scales.x.title.color = t.label;
      chart.options.scales.y.title.color = t.label;
      chart.options.scales.x.grid.color  = t.grid;
      chart.options.scales.y.grid.color  = t.grid;
      chart.options.scales.x.ticks.color = t.ticks;
      chart.options.scales.y.ticks.color = t.ticks;
      chart.options.plugins.legend.labels.color = t.label;
      chart.data.datasets[0].borderColor = t.accent;
      chart.update('none');
    }

    // -------- Defaults --------
    function applyDefaults() {
      if (!DEFAULTS) return;
      ['Vsupply', 'Vf', 'I'].forEach(function (name) {
        var val = DEFAULTS[name];
        if (!isFinite(val)) return;
        inputs[name].value = String(val);
        syncSlider(name, val);
      });
      if (colorSelect && DEFAULTS.color && PRESETS[DEFAULTS.color]) {
        colorSelect.value = DEFAULTS.color;
      } else if (colorSelect) {
        colorSelect.value = 'custom';
      }
    }

    EF.ensureChartJs().then(function () {
      buildChart();
      applyDefaults();
      recompute();
    }, function () {
      setWarning('Chart unavailable (Chart.js blocked or offline). Calculations still work.');
      applyDefaults();
      recompute();
    });

    EF.widgets.push({
      name: 'led-resistor-calculator',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme
    });
  }

  // --------------------------------------------------------------------------
  // Calculator 3 — Voltage Divider
  //
  //   * Inputs: V_in, R1, R2, optional R_load.
  //   * Output: unloaded V_out = V_in · R2 / (R1 + R2); loaded V_out uses
  //     R2 ‖ R_load. Reports current draw and total power.
  //   * Chart: V_out as R2 sweeps log-x from 1 Ω to 100 kΩ. When R_load > 0,
  //     a second (loaded) curve overlays so the visitor can see the sag.
  // --------------------------------------------------------------------------
  function initVoltageDividerCalculator() {
    var card = document.getElementById('electronics-calc-divider');
    if (!card) return;

    var QTY = ['Vin', 'R1', 'R2', 'RL'];
    var inputs = {}, sliders = {}, fields = {};
    QTY.forEach(function (n) {
      inputs[n]  = document.getElementById('ef-div-' + n);
      sliders[n] = document.getElementById('ef-div-' + n + '-slider');
      fields[n]  = card.querySelector('.electronics-ohms-field[data-field="' + n + '"]');
    });
    if (!inputs.Vin || !inputs.R1 || !inputs.R2 || !inputs.RL) return;

    var resultEl    = document.getElementById('electronics-div-result');
    var warningEl   = document.getElementById('electronics-div-warning');
    var clearBtn    = document.getElementById('electronics-div-clear');
    var copyBtn     = document.getElementById('electronics-div-copy');
    var openWheelBtn = document.getElementById('electronics-div-open-wheel');
    var canvas      = document.getElementById('electronics-calc-divider-chart');

    var data = EF.readDataIsland('electronics-calc-divider-data');
    var DEFAULTS = (data && data.defaults) || { Vin: 12, R1: 1000, R2: 1000, RL: 0 };

    var lastResult = null;
    var chart = null;

    function syncSlider(name, value) {
      var s = sliders[name];
      if (!s || !isFinite(value)) return;
      var min = parseFloat(s.min), max = parseFloat(s.max);
      s.value = String(Math.max(min, Math.min(max, value)));
    }
    function readNumber(name) {
      var num = parseFloat(inputs[name].value);
      return isFinite(num) ? num : NaN;
    }

    function parallel(a, b) {
      // Treat 0 or missing R_load as "unloaded" (∞ in parallel).
      if (!isFinite(b) || b <= 0) return a;
      if (a === 0) return 0;
      return (a * b) / (a + b);
    }

    function compute() {
      var Vin = readNumber('Vin');
      var R1  = readNumber('R1');
      var R2  = readNumber('R2');
      var RLraw = readNumber('RL');
      var RL = (isFinite(RLraw) && RLraw > 0) ? RLraw : 0;

      var ready = isFinite(Vin) && isFinite(R1) && isFinite(R2);
      if (!ready) return { ready: false };

      if (R1 < 0 || R2 < 0 || RL < 0) return { ready: true, error: 'Resistances cannot be negative.' };
      if (R1 === 0 && R2 === 0)        return { ready: true, error: 'R1 and R2 are both zero — short across the supply.' };
      if (R1 + R2 === 0)               return { ready: true, error: 'R1 + R2 is zero — short across the supply.' };

      var R2eff = (RL > 0) ? parallel(R2, RL) : R2;
      var denom = R1 + R2eff;
      if (denom === 0) return { ready: true, error: 'R1 + R2‖R_load is zero — divide-by-zero.' };

      var Vout    = Vin * R2eff / denom;
      var Vout_unloaded = Vin * R2 / (R1 + R2);
      var Iin     = Vin / denom;
      var Iload   = (RL > 0) ? (Vout / RL) : 0;
      var IR2     = Vout / R2;
      var Ptotal  = Vin * Iin;
      var sag     = Vout_unloaded - Vout;

      return {
        ready: true,
        Vin: Vin, R1: R1, R2: R2, RL: RL,
        Vout: Vout, Vout_unloaded: Vout_unloaded,
        Iin: Iin, IR2: IR2, Iload: Iload,
        Ptotal: Ptotal, sag: sag
      };
    }

    function setResult(text, ok) {
      if (!resultEl) return;
      resultEl.textContent = text;
      resultEl.classList.toggle('electronics-ohms-result--ok', !!ok);
    }
    function setWarning(msg) {
      if (!warningEl) return;
      if (!msg) { warningEl.hidden = true; warningEl.textContent = ''; return; }
      warningEl.hidden = false;
      warningEl.textContent = '⚠ ' + msg;
    }

    function recompute() {
      var r = compute();
      lastResult = r;
      if (!r.ready) {
        setResult('Set V_in, R1, and R2 to see V_out.', false);
        setWarning('');
        updateChart(null);
        return;
      }
      if (r.error) {
        setResult('— ' + r.error, false);
        setWarning(r.error);
        updateChart(r);
        return;
      }
      var line = '✓  V_out = ' + EF.formatNumberWithUnits(r.Vout, 'V') +
                 '  ·  I_in = ' + EF.formatNumberWithUnits(r.Iin, 'A') +
                 '  ·  R_total = ' + EF.formatNumberWithUnits(r.R1 + r.R2, 'Ω') +
                 '  ·  P = ' + EF.formatNumberWithUnits(r.Ptotal, 'W');
      setResult(line, true);

      // Soft warnings: large sag from loading, or quiescent current that's
      // surprisingly high (think battery-powered or low-power designs).
      var msgs = [];
      if (r.RL > 0 && Math.abs(r.sag) > 0.05 * r.Vout_unloaded) {
        msgs.push('Load is pulling V_out down by ' + EF.formatNumberWithUnits(r.sag, 'V') +
                  ' — divider is too "stiff" to drive this load. Lower R1 + R2 by 10× for ≤1 % sag.');
      }
      if (r.Iin > 0.1) {
        msgs.push('Quiescent current ' + EF.formatNumberWithUnits(r.Iin, 'A') +
                  ' is high for a divider — this wastes power continuously.');
      }
      setWarning(msgs.join(' · '));
      updateChart(r);
    }
    var debouncedRecompute = EF.debounce(recompute, 80);

    // -------- Wire inputs / sliders --------
    QTY.forEach(function (name) {
      inputs[name].addEventListener('input', function () {
        var num = parseFloat(inputs[name].value);
        if (isFinite(num)) syncSlider(name, num);
        debouncedRecompute();
      });
      if (sliders[name]) {
        sliders[name].addEventListener('input', function () {
          inputs[name].value = sliders[name].value;
          debouncedRecompute();
        });
      }
    });

    // -------- Buttons --------
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        QTY.forEach(function (n) {
          inputs[n].value = '';
          if (sliders[n]) sliders[n].value = sliders[n].min || '0';
        });
        recompute();
        inputs.Vin.focus();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var r = lastResult;
        if (!r || !r.ready || r.error) {
          setWarning('Nothing to copy — fill in valid values first.');
          return;
        }
        var lines = [
          'Voltage Divider calculator',
          'V_in       = ' + EF.formatNumberWithUnits(r.Vin, 'V'),
          'R1         = ' + EF.formatNumberWithUnits(r.R1, 'Ω'),
          'R2         = ' + EF.formatNumberWithUnits(r.R2, 'Ω'),
          'R_load     = ' + (r.RL > 0 ? EF.formatNumberWithUnits(r.RL, 'Ω') : 'unloaded'),
          'V_out      = ' + EF.formatNumberWithUnits(r.Vout, 'V'),
          'V_out (NL) = ' + EF.formatNumberWithUnits(r.Vout_unloaded, 'V'),
          'I_in       = ' + EF.formatNumberWithUnits(r.Iin, 'A'),
          'P_total    = ' + EF.formatNumberWithUnits(r.Ptotal, 'W')
        ].join('\n');
        EF.copyToClipboard(lines).then(function (ok) {
          if (ok) {
            var prev = copyBtn.textContent;
            copyBtn.textContent = 'Copied ✓';
            setTimeout(function () { copyBtn.textContent = prev; }, 1400);
          } else {
            setWarning('Clipboard copy failed — your browser may block it on insecure pages.');
          }
        });
      });
    }

    if (openWheelBtn) {
      openWheelBtn.addEventListener('click', function () {
        var r = lastResult;
        if (!r || !r.ready || r.error) {
          setWarning('Fill in valid values before opening in the Quick Wheel.');
          return;
        }
        // Send the input-side equivalent: V_in across R1+R2, the wheel shows
        // I_in and P_total. Clean Ohm's-law translation of the divider.
        var values = { V: r.Vin, R: r.R1 + r.R2 };
        for (var w = 0; w < EF.widgets.length; w++) {
          if (EF.widgets[w].name === 'quick-reference-wheel' &&
              typeof EF.widgets[w].setValues === 'function') {
            EF.widgets[w].setValues(values, { scroll: true });
            // eslint-disable-next-line no-console
            console.log('🔀 Voltage Divider → Quick Wheel (input side):', values);
            return;
          }
        }
        ['V', 'I', 'R', 'P'].forEach(function (n) {
          var el = document.getElementById('ef-wheel-' + n);
          if (!el) return;
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        Object.keys(values).forEach(function (n) {
          var el = document.getElementById('ef-wheel-' + n);
          if (!el) return;
          el.value = String(values[n]);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        var section = document.getElementById('electronics-quick-reference');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // -------- Chart --------
    function chartTheme() {
      var styles = getComputedStyle(document.documentElement);
      var dark = EF.theme !== 'light';
      function v(name, fb) { return styles.getPropertyValue(name).trim() || fb; }
      return {
        grid:   dark ? 'rgba(220, 232, 226, 0.10)' : 'rgba(26, 42, 34, 0.10)',
        ticks:  v('--c-text-muted', dark ? '#7e948a' : '#5a7068'),
        label:  v('--c-text',       dark ? '#dce8e2' : '#1a2a22'),
        accent: v('--c-accent',     '#4ade80'),
        loaded: '#f59e0b'
      };
    }

    function buildChart() {
      if (!window.Chart || !canvas) return;
      var t = chartTheme();
      chart = new window.Chart(canvas, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'V_out (unloaded)',
              data: [],
              borderColor: t.accent,
              backgroundColor: 'rgba(74, 222, 128, 0.15)',
              borderWidth: 2,
              pointRadius: 0,
              fill: false,
              tension: 0.2
            },
            {
              label: 'V_out (loaded)',
              data: [],
              borderColor: t.loaded,
              backgroundColor: 'transparent',
              borderWidth: 2,
              borderDash: [5, 4],
              pointRadius: 0,
              fill: false,
              tension: 0.2,
              hidden: true
            },
            {
              label: 'Operating point',
              data: [],
              type: 'scatter',
              backgroundColor: t.accent,
              borderColor: t.accent,
              pointRadius: 6,
              pointHoverRadius: 8,
              pointStyle: 'rectRot',
              pointBorderWidth: 2,
              showLine: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 200 },
          parsing: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: t.label, font: { size: 11 }, boxWidth: 14, padding: 8 } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return ctx.dataset.label + ' — R2=' + ctx.parsed.x.toFixed(0) + ' Ω, V_out=' + ctx.parsed.y.toFixed(2) + ' V';
                }
              }
            }
          },
          scales: {
            x: {
              type: 'logarithmic', min: 1, max: 100000,
              title: { display: true, text: 'R2 (ohms, log scale)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            },
            y: {
              type: 'linear', min: 0,
              title: { display: true, text: 'V_out (volts)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            }
          }
        }
      });
    }

    function updateChart(r) {
      if (!chart) return;
      var Vin = (r && isFinite(r.Vin)) ? r.Vin : 12;
      var R1  = (r && isFinite(r.R1))  ? r.R1  : 1000;
      var RL  = (r && isFinite(r.RL))  ? r.RL  : 0;

      var samples = 80;
      var unloaded = new Array(samples + 1);
      var loaded   = new Array(samples + 1);
      for (var i = 0; i <= samples; i++) {
        var R2 = Math.pow(10, (i / samples) * 5); // 10^0 .. 10^5
        unloaded[i] = { x: R2, y: Vin * R2 / (R1 + R2) };
        if (RL > 0) {
          var R2e = parallel(R2, RL);
          loaded[i] = { x: R2, y: Vin * R2e / (R1 + R2e) };
        }
      }
      chart.data.datasets[0].data = unloaded;
      chart.data.datasets[1].data = (RL > 0) ? loaded : [];
      chart.data.datasets[1].hidden = !(RL > 0);

      var op = chart.data.datasets[2];
      if (r && r.ready && !r.error && isFinite(r.R2) && r.R2 > 0) {
        op.data = [{ x: Math.max(1, Math.min(100000, r.R2)), y: r.Vout }];
      } else {
        op.data = [];
      }

      chart.options.scales.y.max = Math.max(Vin * 1.05, 1);
      chart.update('none');
    }

    function applyChartTheme() {
      if (!chart) return;
      var t = chartTheme();
      chart.options.scales.x.title.color = t.label;
      chart.options.scales.y.title.color = t.label;
      chart.options.scales.x.grid.color  = t.grid;
      chart.options.scales.y.grid.color  = t.grid;
      chart.options.scales.x.ticks.color = t.ticks;
      chart.options.scales.y.ticks.color = t.ticks;
      chart.options.plugins.legend.labels.color = t.label;
      chart.data.datasets[0].borderColor = t.accent;
      chart.data.datasets[1].borderColor = t.loaded;
      chart.data.datasets[2].backgroundColor = t.accent;
      chart.data.datasets[2].borderColor = t.accent;
      chart.update('none');
    }

    // -------- Defaults --------
    function applyDefaults() {
      if (!DEFAULTS) return;
      QTY.forEach(function (name) {
        var val = DEFAULTS[name];
        if (!isFinite(val)) return;
        inputs[name].value = String(val);
        syncSlider(name, val);
      });
    }

    EF.ensureChartJs().then(function () {
      buildChart();
      applyDefaults();
      recompute();
    }, function () {
      setWarning('Chart unavailable (Chart.js blocked or offline). Calculations still work.');
      applyDefaults();
      recompute();
    });

    EF.widgets.push({
      name: 'voltage-divider-calculator',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme
    });
  }

  // --------------------------------------------------------------------------
  // Calculator 4 — Series / Parallel Resistors & Capacitors
  //
  //   * Mode toggles: resistor vs capacitor, series vs parallel.
  //   * Dynamic component list (2–8 rows). Add / remove buttons keep the
  //     "R₁, R₂, …" / "C₁, C₂, …" labels in sync. Each row is one number
  //     input + one range slider, sized to the active mode's defaults.
  //   * Live total + bar chart (one bar per component plus a highlighted
  //     "Total" bar).
  //   * "Open in Quick Wheel" sends {R: total} when in resistor mode; the
  //     button is disabled for capacitors (Ohm's law doesn't apply).
  // --------------------------------------------------------------------------
  function initSeriesParallelCalculator() {
    var card = document.getElementById('electronics-calc-sp');
    if (!card) return;

    var rowsEl    = document.getElementById('electronics-sp-rows');
    var addBtn    = document.getElementById('electronics-sp-add');
    var resultEl  = document.getElementById('electronics-sp-result');
    var warningEl = document.getElementById('electronics-sp-warning');
    var clearBtn  = document.getElementById('electronics-sp-clear');
    var copyBtn   = document.getElementById('electronics-sp-copy');
    var openWheelBtn = document.getElementById('electronics-sp-open-wheel');
    var canvas    = document.getElementById('electronics-calc-sp-chart');
    if (!rowsEl || !addBtn) return;

    var typeRadios     = card.querySelectorAll('input[name="sp-type"]');
    var topologyRadios = card.querySelectorAll('input[name="sp-topology"]');

    var data = EF.readDataIsland('electronics-calc-sp-data');
    var MIN_ROWS = (data && data.minRows) || 2;
    var MAX_ROWS = (data && data.maxRows) || 8;
    var DEFAULTS = (data && data.defaults) || { resistor: [1000, 2200], capacitor: [10e-6, 22e-6] };
    var RANGES   = (data && data.ranges)   || {
      resistor:  { min: 1,     max: 100000, step: 1 },
      capacitor: { min: 1e-12, max: 1e-4,   step: 1e-9 }
    };

    var state = { type: 'resistor', topology: 'series', rows: [] };
    var chart = null;

    // ---- Component math ----------------------------------------------------
    function combine(values) {
      // Filter out NaN / non-positive entries so a half-typed row doesn't
      // poison the total. Both formulas need at least one valid value.
      var v = values.filter(function (x) { return isFinite(x) && x > 0; });
      if (!v.length) return { total: NaN, count: 0 };
      var total;
      if (state.type === 'resistor' && state.topology === 'series')        total = v.reduce(sum, 0);
      else if (state.type === 'resistor' && state.topology === 'parallel') total = 1 / v.reduce(recipSum, 0);
      else if (state.type === 'capacitor' && state.topology === 'series')  total = 1 / v.reduce(recipSum, 0);
      else                                                                  total = v.reduce(sum, 0);
      return { total: total, count: v.length };
    }
    function sum(acc, x)      { return acc + x; }
    function recipSum(acc, x) { return acc + (1 / x); }
    function unitFor(type)    { return type === 'capacitor' ? 'F' : 'Ω'; }
    function symbolFor(type)  { return type === 'capacitor' ? 'C' : 'R'; }
    var subscriptDigits = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
    function subscriptOf(n) {
      var s = String(n), out = '';
      for (var i = 0; i < s.length; i++) out += subscriptDigits[+s[i]] || s[i];
      return out;
    }

    // ---- Row management ----------------------------------------------------
    function buildRow(initialValue) {
      var row = document.createElement('div');
      row.className = 'electronics-sp-row';

      var label = document.createElement('span');
      label.className = 'electronics-sp-row__label';
      row.appendChild(label);

      var inputRow = document.createElement('div');
      inputRow.className = 'electronics-ohms-field__row';

      var num = document.createElement('input');
      num.type = 'number';
      num.className = 'electronics-calculator__input';
      num.step = 'any';
      num.inputMode = 'decimal';
      num.autocomplete = 'off';
      inputRow.appendChild(num);

      var slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'electronics-ohms-slider';
      inputRow.appendChild(slider);

      row.appendChild(inputRow);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'electronics-sp-row__remove';
      btn.setAttribute('aria-label', 'Remove component');
      btn.textContent = '×';
      row.appendChild(btn);

      var entry = { row: row, label: label, num: num, slider: slider, btn: btn };

      // Wire events
      num.addEventListener('input', function () {
        var n = parseFloat(num.value);
        if (isFinite(n)) {
          var min = parseFloat(slider.min), max = parseFloat(slider.max);
          slider.value = String(Math.max(min, Math.min(max, n)));
        }
        debouncedRecompute();
      });
      slider.addEventListener('input', function () {
        num.value = slider.value;
        debouncedRecompute();
      });
      btn.addEventListener('click', function () { removeRow(entry); });

      applyRangeToEntry(entry, initialValue);
      rowsEl.appendChild(row);
      state.rows.push(entry);
      relabel();
      return entry;
    }

    function applyRangeToEntry(entry, value) {
      var r = RANGES[state.type] || RANGES.resistor;
      entry.slider.min  = String(r.min);
      entry.slider.max  = String(r.max);
      entry.slider.step = String(r.step);
      if (isFinite(value)) {
        entry.num.value = String(value);
        var clamped = Math.max(r.min, Math.min(r.max, value));
        entry.slider.value = String(clamped);
      } else {
        entry.num.value = '';
        entry.slider.value = String(r.min);
      }
    }

    function relabel() {
      for (var i = 0; i < state.rows.length; i++) {
        var label = symbolFor(state.type) + subscriptOf(i + 1);
        state.rows[i].label.textContent = label;
        var lbl = state.rows[i].num.getAttribute('aria-label');
        state.rows[i].num.setAttribute('aria-label', label + ' value');
        state.rows[i].slider.setAttribute('aria-label', label + ' slider');
        state.rows[i].btn.setAttribute('aria-label', 'Remove ' + label);
        state.rows[i].btn.disabled = state.rows.length <= MIN_ROWS;
      }
      addBtn.disabled = state.rows.length >= MAX_ROWS;
    }

    function removeRow(entry) {
      if (state.rows.length <= MIN_ROWS) return;
      var idx = state.rows.indexOf(entry);
      if (idx === -1) return;
      state.rows.splice(idx, 1);
      entry.row.remove();
      relabel();
      recompute();
    }

    function clearAndSeed() {
      while (state.rows.length) {
        var e = state.rows.pop();
        e.row.remove();
      }
      var seeds = (DEFAULTS[state.type] || []).slice(0, MAX_ROWS);
      if (seeds.length < MIN_ROWS) {
        while (seeds.length < MIN_ROWS) seeds.push(NaN);
      }
      seeds.forEach(function (v) { buildRow(v); });
    }

    addBtn.addEventListener('click', function () {
      if (state.rows.length >= MAX_ROWS) return;
      buildRow(NaN);
      recompute();
    });

    // ---- Mode toggles ------------------------------------------------------
    function setType(type, opts) {
      opts = opts || {};
      if (state.type === type && !opts.force) return;
      state.type = type;
      // Re-seed defaults so values stay sensible across the unit jump.
      clearAndSeed();
      updateOpenWheelEnabled();
      recompute();
    }
    function setTopology(topology) {
      if (state.topology === topology) return;
      state.topology = topology;
      recompute();
    }
    function updateOpenWheelEnabled() {
      if (!openWheelBtn) return;
      var disabled = state.type !== 'resistor';
      openWheelBtn.disabled = disabled;
      openWheelBtn.title = disabled
        ? 'Quick Wheel is for V/I/R/P (Ohm\'s law) — capacitors don\'t fit.'
        : '';
    }
    Array.prototype.forEach.call(typeRadios, function (r) {
      r.addEventListener('change', function () { if (r.checked) setType(r.value); });
    });
    Array.prototype.forEach.call(topologyRadios, function (r) {
      r.addEventListener('change', function () { if (r.checked) setTopology(r.value); });
    });

    // ---- Recompute pipeline ------------------------------------------------
    function setResult(text, ok) {
      if (!resultEl) return;
      resultEl.textContent = text;
      resultEl.classList.toggle('electronics-ohms-result--ok', !!ok);
    }
    function setWarning(msg) {
      if (!warningEl) return;
      if (!msg) { warningEl.hidden = true; warningEl.textContent = ''; return; }
      warningEl.hidden = false;
      warningEl.textContent = '⚠ ' + msg;
    }

    function readValues() {
      return state.rows.map(function (r) {
        var n = parseFloat(r.num.value);
        return isFinite(n) ? n : NaN;
      });
    }

    var lastTotal = NaN;
    var lastValues = [];
    function recompute() {
      var values = readValues();
      lastValues = values;
      var negativeOrZero = values.some(function (x) { return isFinite(x) && x <= 0; });
      var combined = combine(values);
      lastTotal = combined.total;

      if (negativeOrZero) {
        setWarning('Component values must be positive.');
      } else {
        setWarning('');
      }

      if (!isFinite(combined.total) || combined.count < MIN_ROWS) {
        setResult('Enter at least ' + MIN_ROWS + ' positive values.', false);
        updateChart(values, NaN);
        return;
      }

      var unit = unitFor(state.type);
      var summary = state.type === 'resistor'
        ? (state.topology === 'series'
            ? 'Series resistors add directly.'
            : 'Parallel resistors: 1/R_total = Σ 1/Rᵢ.')
        : (state.topology === 'series'
            ? 'Series capacitors: 1/C_total = Σ 1/Cᵢ.'
            : 'Parallel capacitors add directly.');

      setResult('✓  ' + symbolFor(state.type) + '_total = ' +
                EF.formatNumberWithUnits(combined.total, unit) +
                '   ·   ' + summary, true);

      updateChart(values, combined.total);
    }
    var debouncedRecompute = EF.debounce(recompute, 80);

    // ---- Buttons -----------------------------------------------------------
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        state.rows.forEach(function (r) {
          r.num.value = '';
          r.slider.value = r.slider.min;
        });
        recompute();
        if (state.rows[0]) state.rows[0].num.focus();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (!isFinite(lastTotal)) {
          setWarning('Nothing to copy — enter component values first.');
          return;
        }
        var unit = unitFor(state.type);
        var lines = [
          'Series / Parallel calculator — ' + state.type + ', ' + state.topology
        ];
        for (var i = 0; i < state.rows.length; i++) {
          var v = lastValues[i];
          lines.push(symbolFor(state.type) + (i + 1) + ' = ' +
                     (isFinite(v) ? EF.formatNumberWithUnits(v, unit) : '—'));
        }
        lines.push(symbolFor(state.type) + '_total = ' +
                   EF.formatNumberWithUnits(lastTotal, unit));
        EF.copyToClipboard(lines.join('\n')).then(function (ok) {
          if (ok) {
            var prev = copyBtn.textContent;
            copyBtn.textContent = 'Copied ✓';
            setTimeout(function () { copyBtn.textContent = prev; }, 1400);
          } else {
            setWarning('Clipboard copy failed — your browser may block it on insecure pages.');
          }
        });
      });
    }

    if (openWheelBtn) {
      openWheelBtn.addEventListener('click', function () {
        if (state.type !== 'resistor') return;
        if (!isFinite(lastTotal)) {
          setWarning('Enter component values before opening in the Quick Wheel.');
          return;
        }
        var values = { R: lastTotal };
        for (var w = 0; w < EF.widgets.length; w++) {
          if (EF.widgets[w].name === 'quick-reference-wheel' &&
              typeof EF.widgets[w].setValues === 'function') {
            EF.widgets[w].setValues(values, { scroll: true });
            // eslint-disable-next-line no-console
            console.log('🪛 Series/Parallel → Quick Wheel:', values);
            return;
          }
        }
      });
    }

    // ---- Chart -------------------------------------------------------------
    function chartTheme() {
      var styles = getComputedStyle(document.documentElement);
      var dark = EF.theme !== 'light';
      function v(name, fb) { return styles.getPropertyValue(name).trim() || fb; }
      return {
        grid:   dark ? 'rgba(220, 232, 226, 0.10)' : 'rgba(26, 42, 34, 0.10)',
        ticks:  v('--c-text-muted', dark ? '#7e948a' : '#5a7068'),
        label:  v('--c-text',       dark ? '#dce8e2' : '#1a2a22'),
        accent: v('--c-accent',     '#4ade80'),
        bars:   ['#3b82f6', '#a78bfa', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#eab308']
      };
    }

    function buildChart() {
      if (!window.Chart || !canvas) return;
      var t = chartTheme();
      chart = new window.Chart(canvas, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Value', data: [], backgroundColor: [] }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 200 },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var unit = unitFor(state.type);
                  return ctx.label + ': ' + EF.formatNumberWithUnits(ctx.parsed.y, unit);
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 11 } }
            },
            y: {
              beginAtZero: true,
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            }
          }
        }
      });
    }

    function updateChart(values, total) {
      if (!chart) return;
      var t = chartTheme();
      var labels = [];
      var data = [];
      var colors = [];
      for (var i = 0; i < values.length; i++) {
        labels.push(symbolFor(state.type) + (i + 1));
        data.push(isFinite(values[i]) ? values[i] : 0);
        colors.push(t.bars[i % t.bars.length]);
      }
      labels.push('Total');
      data.push(isFinite(total) ? total : 0);
      colors.push(t.accent);
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.data.datasets[0].backgroundColor = colors;
      chart.update('none');
    }

    function applyChartTheme() {
      if (!chart) return;
      var t = chartTheme();
      chart.options.scales.x.grid.color  = t.grid;
      chart.options.scales.y.grid.color  = t.grid;
      chart.options.scales.x.ticks.color = t.ticks;
      chart.options.scales.y.ticks.color = t.ticks;
      // Re-derive bar colors so the accent always tracks the live theme.
      var values = readValues();
      updateChart(values, lastTotal);
    }

    EF.ensureChartJs().then(function () {
      buildChart();
      clearAndSeed();
      updateOpenWheelEnabled();
      recompute();
    }, function () {
      setWarning('Chart unavailable (Chart.js blocked or offline). Calculations still work.');
      clearAndSeed();
      updateOpenWheelEnabled();
      recompute();
    });

    EF.widgets.push({
      name: 'series-parallel-calculator',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme
    });
  }

  // --------------------------------------------------------------------------
  // Calculator 5 — RC Timer / Time Constant
  //
  //   * Inputs: V (supply), R, C — each with a slider.
  //   * Live derived: τ = R·C, 5τ ≈ "fully charged" time, f_c = 1/(2πRC).
  //   * Chart: V(t) = V·(1 − e^(−t/τ)) over 0…5τ, with vertical dashed
  //     markers at τ and 5τ, plus a moving cursor dataset that animates
  //     under requestAnimationFrame when Play is on.
  //   * Discharge mode flips the curve to V(t) = V·e^(−t/τ).
  //   * "Open in Quick Wheel" sends {V, R} so the wheel reports steady-
  //     state I and P (i.e. with the cap fully charged or shorted).
  // --------------------------------------------------------------------------
  function initRcTimerCalculator() {
    var card = document.getElementById('electronics-calc-rc');
    if (!card) return;

    var QTY = ['V', 'R', 'C'];
    var inputs = {}, sliders = {}, fields = {};
    QTY.forEach(function (n) {
      inputs[n]  = document.getElementById('ef-rc-' + n);
      sliders[n] = document.getElementById('ef-rc-' + n + '-slider');
      fields[n]  = card.querySelector('.electronics-ohms-field[data-field="' + n + '"]');
    });
    if (!inputs.V || !inputs.R || !inputs.C) return;

    var resultEl    = document.getElementById('electronics-rc-result');
    var warningEl   = document.getElementById('electronics-rc-warning');
    var clearBtn    = document.getElementById('electronics-rc-clear');
    var copyBtn     = document.getElementById('electronics-rc-copy');
    var openWheelBtn = document.getElementById('electronics-rc-open-wheel');
    var canvas      = document.getElementById('electronics-calc-rc-chart');
    var playBtn     = document.getElementById('electronics-rc-play');
    var modeChargeBtn    = document.getElementById('electronics-rc-mode-charge');
    var modeDischargeBtn = document.getElementById('electronics-rc-mode-discharge');
    var tauOut      = document.getElementById('ef-rc-tau');
    var fullTimeOut = document.getElementById('ef-rc-fullTime');
    var fcOut       = document.getElementById('ef-rc-fc');
    var vtOut       = document.getElementById('ef-rc-vt');

    var data = EF.readDataIsland('electronics-calc-rc-data');
    var DEFAULTS = (data && data.defaults) || { V: 5, R: 10000, C: 1e-6 };
    var ANIM_MS  = (data && data.animationMs) || 3000;

    var mode = 'charge';
    var animationId = null;
    var animationStart = 0;
    var cursorT = 0;
    var isPlaying = false;
    var lastResult = null;
    var chart = null;

    function syncSlider(name, value) {
      var s = sliders[name];
      if (!s || !isFinite(value)) return;
      var min = parseFloat(s.min), max = parseFloat(s.max);
      s.value = String(Math.max(min, Math.min(max, value)));
    }
    function readNumber(name) {
      var num = parseFloat(inputs[name].value);
      return isFinite(num) ? num : NaN;
    }
    function setResult(text, ok) {
      if (!resultEl) return;
      resultEl.textContent = text;
      resultEl.classList.toggle('electronics-ohms-result--ok', !!ok);
    }
    function setWarning(msg) {
      if (!warningEl) return;
      if (!msg) { warningEl.hidden = true; warningEl.textContent = ''; return; }
      warningEl.hidden = false;
      warningEl.textContent = '⚠ ' + msg;
    }

    function compute() {
      var V = readNumber('V');
      var R = readNumber('R');
      var C = readNumber('C');
      var ready = isFinite(V) && isFinite(R) && isFinite(C);
      if (!ready) return { ready: false };
      if (V < 0)  return { ready: true, error: 'Supply voltage cannot be negative.' };
      if (R <= 0) return { ready: true, error: 'Resistance must be positive (zero R = no time constant).' };
      if (C <= 0) return { ready: true, error: 'Capacitance must be positive (zero C = no time constant).' };
      var tau = R * C;
      var fullTime = 5 * tau;
      var fc = 1 / (2 * Math.PI * tau);
      return { ready: true, V: V, R: R, C: C, tau: tau, fullTime: fullTime, fc: fc };
    }

    function voltageAt(r, t) {
      // r = compute() result; mode applied here.
      if (!r || !r.ready || r.error) return NaN;
      var k = Math.exp(-t / r.tau);
      return mode === 'charge' ? r.V * (1 - k) : r.V * k;
    }

    function setStat(el, str) { if (el) el.textContent = str; }

    function renderStats(r) {
      if (!r || !r.ready || r.error) {
        setStat(tauOut, '—');
        setStat(fullTimeOut, '—');
        setStat(fcOut, '—');
        setStat(vtOut, '—');
        return;
      }
      setStat(tauOut,      EF.formatNumberWithUnits(r.tau, 's'));
      setStat(fullTimeOut, EF.formatNumberWithUnits(r.fullTime, 's'));
      setStat(fcOut,       EF.formatNumberWithUnits(r.fc, 'Hz'));
      setStat(vtOut,       EF.formatNumberWithUnits(voltageAt(r, cursorT), 'V'));
    }

    function recompute() {
      var r = compute();
      lastResult = r;
      if (!r.ready) {
        setResult('Set R, C, and V to see the time constant.', false);
        setWarning('');
        renderStats(null);
        rebuildCurve(null);
        return;
      }
      if (r.error) {
        setResult('— ' + r.error, false);
        setWarning(r.error);
        renderStats(null);
        rebuildCurve(null);
        return;
      }
      // Reset cursor when params change so the animation always starts at 0.
      cursorT = 0;
      var line = '✓  τ = ' + EF.formatNumberWithUnits(r.tau, 's') +
                 '  ·  5τ = ' + EF.formatNumberWithUnits(r.fullTime, 's') +
                 '  ·  f_c = ' + EF.formatNumberWithUnits(r.fc, 'Hz');
      setResult(line, true);
      // Soft warnings for cases that look like a typo more than a real circuit.
      var msgs = [];
      if (r.tau < 1e-6)  msgs.push('Time constant ' + EF.formatNumberWithUnits(r.tau, 's') + ' is below 1 µs — typical microcontroller GPIO can\'t toggle this fast.');
      if (r.tau > 60)    msgs.push('Time constant exceeds 1 minute — measurement / animation will feel sluggish.');
      setWarning(msgs.join(' · '));
      renderStats(r);
      rebuildCurve(r);
    }
    var debouncedRecompute = EF.debounce(recompute, 80);

    // ---- Inputs / sliders --------------------------------------------------
    QTY.forEach(function (name) {
      inputs[name].addEventListener('input', function () {
        var num = parseFloat(inputs[name].value);
        if (isFinite(num)) syncSlider(name, num);
        debouncedRecompute();
      });
      if (sliders[name]) {
        sliders[name].addEventListener('input', function () {
          inputs[name].value = sliders[name].value;
          debouncedRecompute();
        });
      }
    });

    // ---- Mode toggle -------------------------------------------------------
    function setMode(next) {
      if (mode === next) return;
      mode = next;
      modeChargeBtn.classList.toggle('is-active', mode === 'charge');
      modeChargeBtn.setAttribute('aria-pressed', mode === 'charge' ? 'true' : 'false');
      modeDischargeBtn.classList.toggle('is-active', mode === 'discharge');
      modeDischargeBtn.setAttribute('aria-pressed', mode === 'discharge' ? 'true' : 'false');
      cursorT = 0;
      rebuildCurve(lastResult);
      renderStats(lastResult);
    }
    if (modeChargeBtn)    modeChargeBtn.addEventListener('click', function () { setMode('charge'); });
    if (modeDischargeBtn) modeDischargeBtn.addEventListener('click', function () { setMode('discharge'); });

    // ---- Buttons -----------------------------------------------------------
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        QTY.forEach(function (n) {
          inputs[n].value = '';
          if (sliders[n]) sliders[n].value = sliders[n].min || '0';
        });
        pause();
        recompute();
        inputs.V.focus();
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var r = lastResult;
        if (!r || !r.ready || r.error) {
          setWarning('Nothing to copy — enter valid values first.');
          return;
        }
        var lines = [
          'RC Timer calculator — ' + mode,
          'V       = ' + EF.formatNumberWithUnits(r.V, 'V'),
          'R       = ' + EF.formatNumberWithUnits(r.R, 'Ω'),
          'C       = ' + EF.formatNumberWithUnits(r.C, 'F'),
          'τ       = ' + EF.formatNumberWithUnits(r.tau, 's'),
          '5τ      = ' + EF.formatNumberWithUnits(r.fullTime, 's'),
          'f_c     = ' + EF.formatNumberWithUnits(r.fc, 'Hz')
        ].join('\n');
        EF.copyToClipboard(lines).then(function (ok) {
          if (ok) {
            var prev = copyBtn.textContent;
            copyBtn.textContent = 'Copied ✓';
            setTimeout(function () { copyBtn.textContent = prev; }, 1400);
          } else {
            setWarning('Clipboard copy failed — your browser may block it on insecure pages.');
          }
        });
      });
    }
    if (openWheelBtn) {
      openWheelBtn.addEventListener('click', function () {
        var r = lastResult;
        if (!r || !r.ready || r.error) {
          setWarning('Enter valid values before opening in the Quick Wheel.');
          return;
        }
        // Steady-state Ohm's-law mapping: at t→∞ the cap is open / fully
        // charged, so I_steady = 0 for charging or V/R right at t=0 for
        // discharging. Sending {V, R} lets the wheel report the *peak* current
        // and resistor power dissipation, which is the safety-relevant figure.
        var values = { V: r.V, R: r.R };
        for (var w = 0; w < EF.widgets.length; w++) {
          if (EF.widgets[w].name === 'quick-reference-wheel' &&
              typeof EF.widgets[w].setValues === 'function') {
            EF.widgets[w].setValues(values, { scroll: true });
            // eslint-disable-next-line no-console
            console.log('⏱ RC Timer → Quick Wheel (peak):', values);
            return;
          }
        }
      });
    }

    // ---- Chart -------------------------------------------------------------
    function chartTheme() {
      var styles = getComputedStyle(document.documentElement);
      var dark = EF.theme !== 'light';
      function v(name, fb) { return styles.getPropertyValue(name).trim() || fb; }
      return {
        grid:   dark ? 'rgba(220, 232, 226, 0.10)' : 'rgba(26, 42, 34, 0.10)',
        ticks:  v('--c-text-muted', dark ? '#7e948a' : '#5a7068'),
        label:  v('--c-text',       dark ? '#dce8e2' : '#1a2a22'),
        accent: v('--c-accent',     '#4ade80'),
        marker: '#f59e0b'
      };
    }

    function buildChart() {
      if (!window.Chart || !canvas) return;
      var t = chartTheme();
      chart = new window.Chart(canvas, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'V(t)',
              data: [],
              borderColor: t.accent,
              backgroundColor: 'rgba(74, 222, 128, 0.18)',
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
              tension: 0.2
            },
            {
              label: 'τ (63.2 %)',
              data: [],
              borderColor: t.marker,
              backgroundColor: 'transparent',
              borderWidth: 1.25,
              borderDash: [4, 4],
              pointRadius: 0,
              fill: false,
              tension: 0
            },
            {
              label: '5τ (99.3 %)',
              data: [],
              borderColor: t.marker,
              backgroundColor: 'transparent',
              borderWidth: 1.25,
              borderDash: [2, 4],
              pointRadius: 0,
              fill: false,
              tension: 0
            },
            {
              label: 'Cursor',
              data: [],
              type: 'scatter',
              backgroundColor: t.accent,
              borderColor: t.accent,
              pointRadius: 6,
              pointHoverRadius: 8,
              pointStyle: 'rectRot',
              pointBorderWidth: 2,
              showLine: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          parsing: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: t.label, font: { size: 11 }, boxWidth: 14, padding: 8 } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return ctx.dataset.label + ' — t=' +
                    EF.formatNumberWithUnits(ctx.parsed.x, 's') + ', V=' +
                    ctx.parsed.y.toFixed(3) + ' V';
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear', min: 0,
              title: { display: true, text: 't (seconds)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            },
            y: {
              type: 'linear', min: 0,
              title: { display: true, text: 'V(t) (volts)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            }
          }
        }
      });
    }

    function rebuildCurve(r) {
      if (!chart) return;
      if (!r || !r.ready || r.error) {
        chart.data.datasets[0].data = [];
        chart.data.datasets[1].data = [];
        chart.data.datasets[2].data = [];
        chart.data.datasets[3].data = [];
        chart.update('none');
        return;
      }
      var samples = 80;
      var tEnd = r.fullTime;
      var data = new Array(samples + 1);
      for (var i = 0; i <= samples; i++) {
        var t = (i / samples) * tEnd;
        data[i] = { x: t, y: voltageAt(r, t) };
      }
      chart.data.datasets[0].data = data;
      chart.data.datasets[1].data = [{ x: r.tau, y: 0 }, { x: r.tau, y: r.V }];
      chart.data.datasets[2].data = [{ x: r.fullTime, y: 0 }, { x: r.fullTime, y: r.V }];
      chart.data.datasets[3].data = [{ x: cursorT, y: voltageAt(r, cursorT) }];
      chart.options.scales.x.max = tEnd;
      chart.options.scales.y.max = r.V * 1.05;
      chart.update('none');
    }

    function updateCursor() {
      if (!chart || !lastResult || !lastResult.ready || lastResult.error) return;
      chart.data.datasets[3].data = [{ x: cursorT, y: voltageAt(lastResult, cursorT) }];
      chart.update('none');
      setStat(vtOut, EF.formatNumberWithUnits(voltageAt(lastResult, cursorT), 'V'));
    }

    function applyChartTheme() {
      if (!chart) return;
      var t = chartTheme();
      chart.options.scales.x.title.color = t.label;
      chart.options.scales.y.title.color = t.label;
      chart.options.scales.x.grid.color  = t.grid;
      chart.options.scales.y.grid.color  = t.grid;
      chart.options.scales.x.ticks.color = t.ticks;
      chart.options.scales.y.ticks.color = t.ticks;
      chart.options.plugins.legend.labels.color = t.label;
      chart.data.datasets[0].borderColor = t.accent;
      chart.data.datasets[1].borderColor = t.marker;
      chart.data.datasets[2].borderColor = t.marker;
      chart.data.datasets[3].backgroundColor = t.accent;
      chart.data.datasets[3].borderColor = t.accent;
      chart.update('none');
    }

    // ---- Animation ---------------------------------------------------------
    function tick(timestamp) {
      if (!isPlaying || !lastResult || !lastResult.ready || lastResult.error) return;
      if (!animationStart) animationStart = timestamp;
      var elapsed = timestamp - animationStart;
      var fraction = elapsed / ANIM_MS;
      if (fraction >= 1) {
        // Loop: reset and start over so the visitor sees the curve fill in
        // repeatedly without having to click Play again.
        animationStart = timestamp;
        fraction = 0;
      }
      cursorT = fraction * lastResult.fullTime;
      updateCursor();
      animationId = requestAnimationFrame(tick);
    }
    function play() {
      if (isPlaying) return;
      if (!lastResult || !lastResult.ready || lastResult.error) {
        setWarning('Enter valid values before pressing Play.');
        return;
      }
      isPlaying = true;
      animationStart = 0;
      if (playBtn) {
        playBtn.textContent = '⏸ Pause';
        playBtn.setAttribute('aria-pressed', 'true');
      }
      animationId = requestAnimationFrame(tick);
    }
    function pause() {
      isPlaying = false;
      if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
      if (playBtn) {
        playBtn.textContent = '▶ Play';
        playBtn.setAttribute('aria-pressed', 'false');
      }
    }
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (isPlaying) pause(); else play();
      });
    }

    // ---- Defaults ----------------------------------------------------------
    function applyDefaults() {
      QTY.forEach(function (name) {
        var val = DEFAULTS[name];
        if (!isFinite(val)) return;
        inputs[name].value = String(val);
        syncSlider(name, val);
      });
    }

    EF.ensureChartJs().then(function () {
      buildChart();
      applyDefaults();
      recompute();
    }, function () {
      setWarning('Chart unavailable (Chart.js blocked or offline). Calculations still work.');
      applyDefaults();
      recompute();
    });

    EF.widgets.push({
      name: 'rc-timer-calculator',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme
    });
  }

  // --------------------------------------------------------------------------
  // Calculator 1 — Ohm's Law / Power
  //
  //   * Four linked number-input + range-slider pairs (V, I, R, P)
  //   * Two-known / two-computed invariant (same as the Quick Wheel)
  //   * Two Chart.js plots:
  //       - V–I characteristic family (one line per resistance value)
  //       - P-vs-R curve at the current V (log-x)
  //     Both display the live operating point as a marker.
  //   * "Open in Quick Wheel" routes the current state back to the hero
  //     widget via EF.widgets[…].setValues() and scrolls to it.
  //   * Lazy Chart.js + theme observer follow the same pattern as the wheel.
  // --------------------------------------------------------------------------
  function initOhmsLawCalculator() {
    var card = document.getElementById('electronics-calc-ohms');
    if (!card) return;

    var QTY = ['V', 'I', 'R', 'P'];
    var inputs = {}, sliders = {}, fields = {};
    QTY.forEach(function (n) {
      inputs[n]  = document.getElementById('ef-calc-' + n);
      sliders[n] = document.getElementById('ef-calc-' + n + '-slider');
      fields[n]  = card.querySelector('.electronics-ohms-field[data-field="' + n + '"]');
    });
    if (!inputs.V || !inputs.I || !inputs.R || !inputs.P) return;

    var resultEl    = document.getElementById('electronics-calc-result');
    var warningEl   = document.getElementById('electronics-calc-warning');
    var clearBtn    = document.getElementById('electronics-calc-clear');
    var copyBtn     = document.getElementById('electronics-calc-copy');
    var openWheelBtn = document.getElementById('electronics-calc-open-wheel');
    var viCanvas    = document.getElementById('electronics-calc-vi-chart');
    var prCanvas    = document.getElementById('electronics-calc-pr-chart');

    var data = EF.readDataIsland('electronics-calc-ohms-data');
    var DEFAULTS  = (data && data.defaults)  || { V: 12, R: 100 };
    var VI_CURVES = (data && data.viCurves) || [10, 100, 1000, 10000];

    var EPSILON = 1e-9;
    var userOrder  = [];
    var userValues = {};
    var viChart = null;
    var prChart = null;

    // ----- Solver (parallel to the wheel's; kept local to avoid coupling) -----
    function solve(known) {
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

    // ----- Display helpers -----
    function isUserInput(n) { return Object.prototype.hasOwnProperty.call(userValues, n); }

    function setWarning(msg) {
      if (!warningEl) return;
      if (!msg) { warningEl.hidden = true; warningEl.textContent = ''; return; }
      warningEl.hidden = false;
      warningEl.textContent = '⚠ ' + msg;
    }
    function setResult(text, ok) {
      if (!resultEl) return;
      resultEl.textContent = text;
      resultEl.classList.toggle('electronics-ohms-result--ok', !!ok);
    }
    function summarize(v) {
      return [
        'V = ' + EF.formatNumberWithUnits(v.V, 'V'),
        'I = ' + EF.formatNumberWithUnits(v.I, 'A'),
        'R = ' + EF.formatNumberWithUnits(v.R, 'Ω'),
        'P = ' + EF.formatNumberWithUnits(v.P, 'W')
      ].join('  ·  ');
    }
    function checkUnrealistic(v) {
      // Soft warnings — math is still valid, but these magnitudes deserve
      // a sanity-check before the visitor builds the circuit.
      if (isFinite(v.P) && v.P > 1000) return 'Computed power exceeds 1 kW — recheck inputs (mains/industrial scale).';
      if (isFinite(v.V) && Math.abs(v.V) > 1000) return 'Voltage above 1 kV — measure twice, cut once.';
      if (isFinite(v.I) && Math.abs(v.I) > 100)  return 'Current above 100 A — verify against the supply rating before wiring.';
      return '';
    }

    function clearComputedFields() {
      QTY.forEach(function (n) {
        if (!isUserInput(n)) inputs[n].value = '';
        if (fields[n]) fields[n].classList.remove('electronics-ohms-field--computed');
      });
    }

    function syncSliderFromValue(name, value) {
      var s = sliders[name];
      if (!s) return;
      var min = parseFloat(s.min);
      var max = parseFloat(s.max);
      if (!isFinite(value)) return;
      var clamped = Math.max(min, Math.min(max, value));
      s.value = String(clamped);
    }

    function lastValues() {
      var v = {};
      QTY.forEach(function (n) {
        var num = parseFloat(inputs[n].value);
        v[n] = isFinite(num) ? num : NaN;
      });
      return v;
    }

    function renderResult(result) {
      if (result.error) {
        setResult('— ' + result.error, false);
        setWarning(result.error);
        clearComputedFields();
        updateCharts(null);
        return;
      }
      var v = result.values;
      QTY.forEach(function (n) {
        if (isUserInput(n)) {
          if (fields[n]) fields[n].classList.remove('electronics-ohms-field--computed');
          return;
        }
        var val = v[n];
        if (isFinite(val)) {
          inputs[n].value = String(Number(val.toPrecision(4)));
          syncSliderFromValue(n, val);
          if (fields[n]) fields[n].classList.add('electronics-ohms-field--computed');
        } else {
          // Infinity (e.g. R when P=0) — show ∞ and skip slider sync.
          inputs[n].value = '∞';
          if (fields[n]) fields[n].classList.remove('electronics-ohms-field--computed');
        }
      });
      if (result.partial) {
        setResult('All four quantities zero — circuit is unexcited.', true);
        setWarning('');
      } else {
        setResult('✓  ' + summarize(v), true);
        setWarning(checkUnrealistic(v));
      }
      updateCharts(v);
    }

    function recompute() {
      if (userOrder.length < 2) {
        clearComputedFields();
        var msg = userOrder.length === 0
          ? 'Enter any two values to solve.'
          : 'Enter one more value (' + userOrder[0] + ' is set) to solve.';
        setResult(msg, false);
        setWarning('');
        updateCharts(null);
        return;
      }
      var pair = userOrder.slice(-2).map(function (n) {
        return { name: n, value: userValues[n] };
      });
      renderResult(solve(pair));
    }
    var debouncedRecompute = EF.debounce(recompute, 80);

    // ----- Two-known invariant -----
    function trackUserInput(name, raw) {
      var idx = userOrder.indexOf(name);
      if (idx !== -1) userOrder.splice(idx, 1);
      if (raw === '' || raw === null || raw === undefined) {
        delete userValues[name];
        return;
      }
      var num = parseFloat(raw);
      if (!isFinite(num)) { delete userValues[name]; return; }
      userValues[name] = num;
      userOrder.push(name);
      while (userOrder.length > 2) {
        var dropped = userOrder.shift();
        delete userValues[dropped];
      }
    }

    // ----- Input + slider plumbing (two-way binding) -----
    QTY.forEach(function (name) {
      var input = inputs[name], slider = sliders[name];

      input.addEventListener('input', function () {
        var num = parseFloat(input.value);
        if (isFinite(num)) syncSliderFromValue(name, num);
        trackUserInput(name, input.value);
        if (fields[name]) fields[name].classList.remove('electronics-ohms-field--computed');
        debouncedRecompute();
      });

      if (slider) {
        slider.addEventListener('input', function () {
          input.value = slider.value;
          trackUserInput(name, slider.value);
          if (fields[name]) fields[name].classList.remove('electronics-ohms-field--computed');
          debouncedRecompute();
        });
      }
    });

    // ----- Buttons -----
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        userOrder = [];
        userValues = {};
        QTY.forEach(function (n) {
          inputs[n].value = '';
          if (sliders[n]) sliders[n].value = sliders[n].min || '0';
          if (fields[n]) fields[n].classList.remove('electronics-ohms-field--computed');
        });
        recompute();
        inputs.V.focus();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var v = lastValues();
        var hasAny = QTY.some(function (n) { return isFinite(v[n]); });
        if (!hasAny) {
          setWarning('Nothing to copy — enter at least two values first.');
          return;
        }
        var text = [
          "Ohm's Law / Power calculator",
          'V = ' + (isFinite(v.V) ? EF.formatNumberWithUnits(v.V, 'V') : '—'),
          'I = ' + (isFinite(v.I) ? EF.formatNumberWithUnits(v.I, 'A') : '—'),
          'R = ' + (isFinite(v.R) ? EF.formatNumberWithUnits(v.R, 'Ω') : '—'),
          'P = ' + (isFinite(v.P) ? EF.formatNumberWithUnits(v.P, 'W') : '—')
        ].join('\n');
        EF.copyToClipboard(text).then(function (ok) {
          if (ok) {
            var prev = copyBtn.textContent;
            copyBtn.textContent = 'Copied ✓';
            setTimeout(function () { copyBtn.textContent = prev; }, 1400);
          } else {
            setWarning('Clipboard copy failed — your browser may block it on insecure pages.');
          }
        });
      });
    }

    if (openWheelBtn) {
      openWheelBtn.addEventListener('click', function () {
        // Prefer the explicitly-known pair; fall back to the first 2 numeric
        // input fields so an idle calculator with computed defaults still works.
        var values = {};
        if (userOrder.length >= 2) {
          userOrder.forEach(function (n) { values[n] = userValues[n]; });
        } else {
          var v = lastValues();
          var found = 0;
          for (var i = 0; i < QTY.length && found < 2; i++) {
            if (isFinite(v[QTY[i]])) { values[QTY[i]] = v[QTY[i]]; found++; }
          }
        }
        if (Object.keys(values).length < 2) {
          setWarning('Enter at least two values before opening in the Quick Wheel.');
          return;
        }
        // Try the registry first, then fall back to direct DOM dispatch.
        for (var w = 0; w < EF.widgets.length; w++) {
          if (EF.widgets[w].name === 'quick-reference-wheel' &&
              typeof EF.widgets[w].setValues === 'function') {
            EF.widgets[w].setValues(values, { scroll: true });
            // eslint-disable-next-line no-console
            console.log('🧮 Calculator → Quick Wheel:', values);
            return;
          }
        }
        QTY.forEach(function (n) {
          var el = document.getElementById('ef-wheel-' + n);
          if (!el) return;
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        Object.keys(values).forEach(function (n) {
          var el = document.getElementById('ef-wheel-' + n);
          if (!el) return;
          el.value = String(values[n]);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        var wheelSection = document.getElementById('electronics-quick-reference');
        if (wheelSection) wheelSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // ====== Charts ============================================================
    function chartTheme() {
      var styles = getComputedStyle(document.documentElement);
      var dark = EF.theme !== 'light';
      function v(name, fallback) {
        var raw = styles.getPropertyValue(name).trim();
        return raw || fallback;
      }
      return {
        grid:    dark ? 'rgba(220, 232, 226, 0.10)' : 'rgba(26, 42, 34, 0.10)',
        axis:    dark ? 'rgba(220, 232, 226, 0.18)' : 'rgba(26, 42, 34, 0.20)',
        ticks:   v('--c-text-muted', dark ? '#7e948a' : '#5a7068'),
        label:   v('--c-text',       dark ? '#dce8e2' : '#1a2a22'),
        accent:  v('--c-accent',     '#4ade80'),
        // V–I curve palette is fixed (theme-independent) so each line keeps
        // its identity when the theme toggles.
        curveColors: ['#3b82f6', '#a78bfa', '#f59e0b', '#ef4444']
      };
    }

    function buildVIChart() {
      if (!window.Chart || !viCanvas) return;
      var t = chartTheme();
      var datasets = VI_CURVES.map(function (R, idx) {
        return {
          label: 'R = ' + EF.formatNumberWithUnits(R, 'Ω'),
          data: [],
          borderColor: t.curveColors[idx % t.curveColors.length],
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          fill: false
        };
      });
      datasets.push({
        label: 'Operating point',
        data: [],
        type: 'scatter',
        backgroundColor: t.accent,
        borderColor: t.accent,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointStyle: 'rectRot',
        pointBorderWidth: 2,
        showLine: false
      });
      viChart = new window.Chart(viCanvas, {
        type: 'line',
        data: { datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 200 },
          parsing: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: t.label, font: { size: 11 }, boxWidth: 14, padding: 8 } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var d = ctx.parsed;
                  return ctx.dataset.label + ' — V=' + d.x.toFixed(2) + ' V, I=' + d.y.toFixed(3) + ' A';
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear', min: 0,
              title: { display: true, text: 'V (volts)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            },
            y: {
              type: 'linear', min: 0,
              title: { display: true, text: 'I (amps)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            }
          }
        }
      });
    }

    function buildPRChart() {
      if (!window.Chart || !prCanvas) return;
      var t = chartTheme();
      prChart = new window.Chart(prCanvas, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'P = V² ÷ R',
              data: [],
              borderColor: t.accent,
              backgroundColor: 'rgba(74, 222, 128, 0.18)',
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
              tension: 0.2
            },
            {
              label: 'Operating point',
              data: [],
              type: 'scatter',
              backgroundColor: t.accent,
              borderColor: t.accent,
              pointRadius: 6,
              pointHoverRadius: 8,
              pointStyle: 'rectRot',
              pointBorderWidth: 2,
              showLine: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 200 },
          parsing: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: t.label, font: { size: 11 }, boxWidth: 14, padding: 8 } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var d = ctx.parsed;
                  return 'R=' + d.x.toFixed(0) + ' Ω, P=' + d.y.toFixed(3) + ' W';
                }
              }
            }
          },
          scales: {
            x: {
              type: 'logarithmic', min: 1, max: 10000,
              title: { display: true, text: 'R (ohms, log scale)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            },
            y: {
              type: 'linear', min: 0,
              title: { display: true, text: 'P (watts)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            }
          }
        }
      });
    }

    function updateVIChart(v) {
      if (!viChart) return;
      var Vmax = (v && isFinite(v.V) && v.V > 0) ? v.V * 1.4 : 24;
      if (Vmax < 1) Vmax = 1;

      for (var i = 0; i < VI_CURVES.length; i++) {
        var R = VI_CURVES[i];
        viChart.data.datasets[i].data = [
          { x: 0,    y: 0 },
          { x: Vmax, y: Vmax / R }
        ];
      }
      var opDs = viChart.data.datasets[VI_CURVES.length];
      opDs.data = (v && isFinite(v.V) && isFinite(v.I)) ? [{ x: v.V, y: v.I }] : [];

      // Y-axis cap: max curve endpoint at Vmax, padded; bumped if the
      // operating point exceeds it.
      var maxI = 0;
      for (var j = 0; j < VI_CURVES.length; j++) {
        var endI = Vmax / VI_CURVES[j];
        if (endI > maxI) maxI = endI;
      }
      if (v && isFinite(v.I) && v.I > maxI) maxI = v.I;
      viChart.options.scales.x.max = Vmax;
      viChart.options.scales.y.max = maxI * 1.1;
      viChart.update('none');
    }

    function updatePRChart(v) {
      if (!prChart) return;
      var V = (v && isFinite(v.V) && v.V > 0) ? v.V : 12;

      // Sample R logarithmically from 1Ω to 10kΩ.
      var samples = 60;
      var data = new Array(samples + 1);
      for (var i = 0; i <= samples; i++) {
        var R = Math.pow(10, (i / samples) * 4);
        data[i] = { x: R, y: (V * V) / R };
      }
      prChart.data.datasets[0].data = data;
      prChart.data.datasets[0].label = 'P = (' + V.toFixed(2) + ' V)² ÷ R';

      var opDs = prChart.data.datasets[1];
      if (v && isFinite(v.R) && isFinite(v.P) && v.R > 0) {
        opDs.data = [{ x: Math.max(1, Math.min(10000, v.R)), y: v.P }];
      } else {
        opDs.data = [];
      }
      // Cap Y so the asymptote near R=1 doesn't squash the rest of the curve.
      var yCap = Math.min((V * V), 200);
      if (v && isFinite(v.P) && v.P > yCap) yCap = v.P * 1.2;
      prChart.options.scales.y.max = yCap;
      prChart.update('none');
    }

    function updateCharts(v) {
      updateVIChart(v);
      updatePRChart(v);
    }

    function applyChartTheme() {
      var t = chartTheme();
      [viChart, prChart].forEach(function (c) {
        if (!c) return;
        c.options.scales.x.title.color = t.label;
        c.options.scales.y.title.color = t.label;
        c.options.scales.x.grid.color  = t.grid;
        c.options.scales.y.grid.color  = t.grid;
        c.options.scales.x.ticks.color = t.ticks;
        c.options.scales.y.ticks.color = t.ticks;
        c.options.plugins.legend.labels.color = t.label;
      });
      if (viChart) {
        VI_CURVES.forEach(function (_R, idx) {
          viChart.data.datasets[idx].borderColor = t.curveColors[idx % t.curveColors.length];
        });
        var op = viChart.data.datasets[VI_CURVES.length];
        op.backgroundColor = t.accent;
        op.borderColor = t.accent;
        viChart.update('none');
      }
      if (prChart) {
        prChart.data.datasets[0].borderColor = t.accent;
        prChart.data.datasets[1].backgroundColor = t.accent;
        prChart.data.datasets[1].borderColor = t.accent;
        prChart.update('none');
      }
    }

    // ----- Apply defaults & boot -----
    function applyDefaults() {
      if (!DEFAULTS) return;
      Object.keys(DEFAULTS).forEach(function (n) {
        if (!inputs[n]) return;
        var val = DEFAULTS[n];
        inputs[n].value = String(val);
        syncSliderFromValue(n, val);
        trackUserInput(n, val);
      });
    }

    EF.ensureChartJs().then(function () {
      buildVIChart();
      buildPRChart();
      applyDefaults();
      recompute();
    }, function () {
      // Charts couldn't load (offline / consent withheld). Calculations still
      // work — apply defaults and run text-only.
      setWarning('Charts unavailable (Chart.js blocked or offline). Calculations still work.');
      applyDefaults();
      recompute();
    });

    EF.widgets.push({
      name: 'ohms-law-calculator',
      onResize: function () {
        if (viChart) viChart.resize();
        if (prChart) prChart.resize();
      },
      onThemeChange: applyChartTheme
    });
  }

  function initComponentCharts() {
    initComponentReferences();
  }

  // ==========================================================================
  // Section 4 — Component References & Charts
  //   Two interactive cards living inside #electronics-components-grid:
  //     1. Resistor Color-Code Decoder — 4-band / 5-band picker, live value
  //        + tolerance, CSS tolerance bar, and a Chart.js floating-bar chart
  //        that compares the nominal across every common tolerance grade.
  //     2. E-Series Standard Values — tabs for E6/E12/E24/E96, a closest-
  //        match calculator that snaps any target to the active series, and
  //        a debounced search filter.
  // ==========================================================================
  function initComponentReferences() {
    initResistorColorDecoder();
    initESeriesExplorer();
  }

  // --------------------------------------------------------------------------
  // Card 1: Resistor Color-Code Decoder
  // --------------------------------------------------------------------------
  function initResistorColorDecoder() {
    var card = document.getElementById('electronics-rcd-card');
    if (!card) return;

    var data = EF.readDataIsland('electronics-rcd-data');
    if (!data || !data.colors) return;

    var COLORS   = data.colors;
    var DEFAULTS = data.defaults || {
      '4': ['brown', 'black', 'red', 'gold'],
      '5': ['brown', 'black', 'black', 'brown', 'brown']
    };
    var CLASSES = data.toleranceClasses || [
      { label: '±20%', value: 20, color: '#94a3b8' },
      { label: '±10%', value: 10, color: '#c0c0c0' },
      { label: '±5%',  value: 5,  color: '#d4a017' },
      { label: '±2%',  value: 2,  color: '#d42d2d' },
      { label: '±1%',  value: 1,  color: '#8b4513' }
    ];

    var bandsEl     = document.getElementById('electronics-rcd-bands');
    var modeRadios  = card.querySelectorAll('input[name="rcd-bands"]');
    var valueEl     = document.getElementById('electronics-rcd-value');
    var toleranceEl = document.getElementById('electronics-rcd-tolerance');
    var rangeEl     = document.getElementById('electronics-rcd-range');
    var resetBtn    = document.getElementById('electronics-rcd-reset');
    var copyBtn     = document.getElementById('electronics-rcd-copy');
    var openWheelBtn = document.getElementById('electronics-rcd-open-wheel');
    var canvas      = document.getElementById('electronics-component-chart');
    var warningEl   = document.getElementById('electronics-rcd-warning');
    var barFill     = document.getElementById('electronics-rcd-bar-fill');
    var barMin      = document.getElementById('electronics-rcd-bar-min');
    var barNominal  = document.getElementById('electronics-rcd-bar-nominal');
    var barMax      = document.getElementById('electronics-rcd-bar-max');
    if (!bandsEl) return;

    var bandCount = 4;
    var bandColors = DEFAULTS['4'].slice();
    var chart = null;

    function setWarning(msg) {
      if (!warningEl) return;
      if (!msg) { warningEl.hidden = true; warningEl.textContent = ''; return; }
      warningEl.hidden = false;
      warningEl.textContent = '⚠ ' + msg;
    }

    // Each band position has a role: digit (first 2 of 4-band, first 3 of
    // 5-band), multiplier (penultimate), or tolerance (last). Returns the
    // array of color keys that are valid in that role.
    function rolesFor(count) {
      return count === 4
        ? ['digit', 'digit', 'multiplier', 'tolerance']
        : ['digit', 'digit', 'digit', 'multiplier', 'tolerance'];
    }
    function legendsFor(count) {
      return count === 4
        ? ['1st digit', '2nd digit', 'Multiplier', 'Tolerance']
        : ['1st digit', '2nd digit', '3rd digit', 'Multiplier', 'Tolerance'];
    }
    function validColorsForRole(role) {
      return Object.keys(COLORS).filter(function (k) {
        var c = COLORS[k];
        if (role === 'digit')      return c.digit !== null;
        if (role === 'multiplier') return c.multiplier !== null;
        if (role === 'tolerance')  return c.tolerance !== null;
        return false;
      });
    }

    // Apply the swatch's color palette as inline CSS variables so the same
    // .electronics-rcd-swatch class can render any of the 12 hues without
    // proliferating per-color modifier classes. The bg/fg pair is pulled from
    // the data island, which lets future palette tweaks ship via JSON only.
    function applySwatchColor(btn, colorKey) {
      var c = COLORS[colorKey];
      if (!c) return;
      btn.style.setProperty('--swatch-bg', c.hex);
      btn.style.setProperty('--swatch-fg', c.text);
    }

    function captionFor(colorKey, role) {
      var c = COLORS[colorKey];
      if (!c) return '';
      var label = colorKey.charAt(0).toUpperCase() + colorKey.slice(1);
      var detail = '';
      if (role === 'digit')           detail = String(c.digit);
      else if (role === 'multiplier') detail = '× ' + c.multiplier;
      else if (role === 'tolerance')  detail = '± ' + c.tolerance + '%';
      return label + ' · ' + detail;
    }

    // Short, scannable label printed inside the swatch itself — digit (0–9),
    // multiplier (×10, ×0.1, …), or tolerance (±5%, ±10%, …) so the visitor
    // can hunt by value, not by color memory.
    function swatchValueText(colorKey, role) {
      var c = COLORS[colorKey];
      if (!c) return '';
      if (role === 'digit')      return String(c.digit);
      if (role === 'multiplier') return '×' + c.multiplier;
      if (role === 'tolerance')  return '±' + c.tolerance + '%';
      return '';
    }

    function buildBands() {
      bandsEl.innerHTML = '';
      var roles   = rolesFor(bandCount);
      var legends = legendsFor(bandCount);
      for (var i = 0; i < bandCount; i++) {
        var role  = roles[i];
        var legend = legends[i];
        var valid  = validColorsForRole(role);

        // If we just toggled bandCount and an old colour isn't valid in this
        // slot anymore, snap it back to the first valid option silently.
        if (valid.indexOf(bandColors[i]) === -1) bandColors[i] = valid[0];

        var wrap = document.createElement('div');
        wrap.className = 'electronics-rcd-band';
        wrap.setAttribute('data-position', i);

        var legendEl = document.createElement('span');
        legendEl.className = 'electronics-rcd-band__legend';
        legendEl.textContent = legend;
        wrap.appendChild(legendEl);

        // Palette = a per-band radiogroup of clickable color swatches.
        var palette = document.createElement('div');
        palette.className = 'electronics-rcd-band__palette';
        palette.setAttribute('role', 'radiogroup');
        palette.setAttribute('aria-label', legend + ' color');

        var caption = document.createElement('span');
        caption.className = 'electronics-rcd-band__caption';
        caption.textContent = captionFor(bandColors[i], role);

        // One <button> per valid color — color via CSS vars, value text inside.
        // Click flips active state, aria-checked, caption, and the live result.
        valid.forEach((function (idx, roleAtIdx, capEl) {
          return function (k) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'electronics-rcd-swatch';
            btn.setAttribute('role', 'radio');
            btn.setAttribute('data-color', k);
            btn.textContent = swatchValueText(k, roleAtIdx);
            btn.setAttribute('aria-label',
              k.charAt(0).toUpperCase() + k.slice(1) +
              ' — ' + (swatchValueText(k, roleAtIdx) || k));
            applySwatchColor(btn, k);
            var isActive = (k === bandColors[idx]);
            if (isActive) btn.classList.add('is-active');
            btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
            // Native radios skip un-checked radios in tab order; we mirror
            // that so Tab lands on the active swatch, then Tab again moves
            // out of the band rather than hopping every color.
            btn.tabIndex = isActive ? 0 : -1;

            btn.addEventListener('click', function () {
              var key = btn.getAttribute('data-color');
              if (!COLORS[key]) {
                setWarning('Unrecognised color "' + key + '"; ignoring click.');
                return;
              }
              if (key === bandColors[idx]) return;
              bandColors[idx] = key;
              // Toggle active class + aria-checked + tabindex within this
              // palette only.
              var siblings = palette.querySelectorAll('.electronics-rcd-swatch');
              for (var s = 0; s < siblings.length; s++) {
                var sib = siblings[s];
                var on = (sib === btn);
                sib.classList.toggle('is-active', on);
                sib.setAttribute('aria-checked', on ? 'true' : 'false');
                sib.tabIndex = on ? 0 : -1;
              }
              capEl.textContent = captionFor(key, roleAtIdx);
              recompute();
            });

            // Arrow-key navigation within the palette so radio semantics feel
            // native to keyboard users. Left/Up = previous, Right/Down = next,
            // Home / End = first / last.
            btn.addEventListener('keydown', function (e) {
              var keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End'];
              if (keys.indexOf(e.key) === -1) return;
              e.preventDefault();
              var siblings = palette.querySelectorAll('.electronics-rcd-swatch');
              var current = Array.prototype.indexOf.call(siblings, btn);
              var next = current;
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   next = (current - 1 + siblings.length) % siblings.length;
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % siblings.length;
              if (e.key === 'Home') next = 0;
              if (e.key === 'End')  next = siblings.length - 1;
              var target = siblings[next];
              if (target) { target.focus(); target.click(); }
            });

            palette.appendChild(btn);
          };
        })(i, role, caption));

        wrap.appendChild(palette);
        wrap.appendChild(caption);
        bandsEl.appendChild(wrap);
      }
    }

    function compute() {
      var roles = rolesFor(bandCount);
      var digits = '';
      var multiplier = 1;
      var tolerance = null;
      for (var i = 0; i < bandCount; i++) {
        var c = COLORS[bandColors[i]];
        if (!c) return null;
        if (roles[i] === 'digit')           digits += String(c.digit);
        else if (roles[i] === 'multiplier') multiplier = c.multiplier;
        else if (roles[i] === 'tolerance')  tolerance  = c.tolerance;
      }
      var nominal = parseInt(digits, 10) * multiplier;
      if (!isFinite(nominal) || nominal <= 0 || tolerance === null) return null;
      return {
        nominal: nominal,
        tolerance: tolerance,
        min: nominal * (1 - tolerance / 100),
        max: nominal * (1 + tolerance / 100)
      };
    }

    function renderTolBar(r) {
      if (!barFill) return;
      // Track represents ±20% of nominal. The fill spans the actual ±tol
      // window centered on 50%. Tighter tolerances → narrower fill, which
      // intuitively conveys "this part is more precisely binned".
      var halfWidthPct = Math.min(50, (r.tolerance / 20) * 50);
      var leftPct  = 50 - halfWidthPct;
      var widthPct = halfWidthPct * 2;
      barFill.style.left  = leftPct  + '%';
      barFill.style.width = widthPct + '%';

      // Position min/max labels at the fill edges so they hug the actual
      // bounds rather than the outer ±20% reference.
      if (barMin) {
        barMin.style.left = leftPct + '%';
        barMin.style.transform = 'translateX(-50%)';
        barMin.textContent = EF.formatNumberWithUnits(r.min, 'Ω');
      }
      if (barMax) {
        barMax.style.left = (leftPct + widthPct) + '%';
        barMax.style.right = 'auto';
        barMax.style.transform = 'translateX(-50%)';
        barMax.textContent = EF.formatNumberWithUnits(r.max, 'Ω');
      }
      if (barNominal) {
        barNominal.style.left = '50%';
        barNominal.textContent = EF.formatNumberWithUnits(r.nominal, 'Ω');
      }
    }

    function recompute() {
      var r = compute();
      if (!r) {
        if (valueEl)     valueEl.textContent = '—';
        if (toleranceEl) toleranceEl.textContent = '';
        if (rangeEl)     rangeEl.textContent = '';
        setWarning('This band combination doesn\'t resolve to a valid resistor value.');
        updateChart(null);
        return;
      }
      setWarning('');
      if (valueEl)     valueEl.textContent     = EF.formatNumberWithUnits(r.nominal, 'Ω');
      if (toleranceEl) toleranceEl.textContent = '±' + r.tolerance + '%';
      if (rangeEl)     rangeEl.textContent     = EF.formatNumberWithUnits(r.min, 'Ω') + '  to  ' + EF.formatNumberWithUnits(r.max, 'Ω');
      renderTolBar(r);
      updateChart(r);
    }

    Array.prototype.forEach.call(modeRadios, function (rad) {
      rad.addEventListener('change', function () {
        if (!rad.checked) return;
        bandCount = parseInt(rad.value, 10);
        bandColors = DEFAULTS[String(bandCount)].slice();
        buildBands();
        recompute();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        bandColors = DEFAULTS[String(bandCount)].slice();
        buildBands();
        recompute();
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var r = compute();
        if (!r) {
          setWarning('Nothing to copy — pick valid colors first.');
          return;
        }
        var text = EF.formatNumberWithUnits(r.nominal, 'Ω') +
                   '  ±' + r.tolerance + '%  (' +
                   EF.formatNumberWithUnits(r.min, 'Ω') + '  to  ' +
                   EF.formatNumberWithUnits(r.max, 'Ω') + ')\n' +
                   'Bands: ' + bandColors.join(' · ');
        EF.copyToClipboard(text).then(function (ok) {
          if (ok) {
            var prev = copyBtn.textContent;
            copyBtn.textContent = 'Copied ✓';
            setTimeout(function () { copyBtn.textContent = prev; }, 1400);
          } else {
            setWarning('Clipboard copy failed — your browser may block it on insecure pages.');
          }
        });
      });
    }
    if (openWheelBtn) {
      openWheelBtn.addEventListener('click', function () {
        var r = compute();
        if (!r) {
          setWarning('Pick valid colors before opening in the Quick Wheel.');
          return;
        }
        var values = { R: r.nominal };
        for (var w = 0; w < EF.widgets.length; w++) {
          if (EF.widgets[w].name === 'quick-reference-wheel' &&
              typeof EF.widgets[w].setValues === 'function') {
            EF.widgets[w].setValues(values, { scroll: true });
            // eslint-disable-next-line no-console
            console.log('🎨 Color decoder → Quick Wheel:', values);
            return;
          }
        }
      });
    }

    // ----- Mini chart: tolerance-grade comparison -----
    function chartTheme() {
      var styles = getComputedStyle(document.documentElement);
      var dark = EF.theme !== 'light';
      function v(name, fb) { return styles.getPropertyValue(name).trim() || fb; }
      return {
        grid:   dark ? 'rgba(220, 232, 226, 0.10)' : 'rgba(26, 42, 34, 0.10)',
        ticks:  v('--c-text-muted', dark ? '#7e948a' : '#5a7068'),
        label:  v('--c-text',       dark ? '#dce8e2' : '#1a2a22'),
        accent: v('--c-accent',     '#4ade80')
      };
    }

    function buildChart() {
      if (!window.Chart || !canvas) return;
      var t = chartTheme();
      chart = new window.Chart(canvas, {
        type: 'bar',
        data: {
          labels: CLASSES.map(function (c) { return c.label; }),
          datasets: [{
            label: 'Tolerance range',
            data: [],
            backgroundColor: CLASSES.map(function (c) { return c.color; }),
            borderColor: CLASSES.map(function () { return 'transparent'; }),
            borderWidth: 2,
            borderRadius: 4,
            barPercentage: 0.7
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 200 },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var d = ctx.raw;
                  if (!d || d.length !== 2) return '';
                  return EF.formatNumberWithUnits(d[0], 'Ω') + '  to  ' + EF.formatNumberWithUnits(d[1], 'Ω');
                }
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Resistance (Ω)', color: t.label, font: { size: 11 } },
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 10 } }
            },
            y: {
              grid: { color: t.grid },
              ticks: { color: t.ticks, font: { size: 11 } }
            }
          }
        }
      });
    }

    function updateChart(r) {
      if (!chart) return;
      var nominal = r ? r.nominal : 1000;
      var data = CLASSES.map(function (c) {
        var f = c.value / 100;
        return [nominal * (1 - f), nominal * (1 + f)];
      });
      chart.data.datasets[0].data = data;
      // Highlight whichever class matches the current selection with an outline.
      var t = chartTheme();
      var borders = CLASSES.map(function (c) {
        return r && c.value === r.tolerance ? t.accent : 'transparent';
      });
      chart.data.datasets[0].borderColor = borders;
      chart.update('none');
    }

    function applyChartTheme() {
      if (!chart) return;
      var t = chartTheme();
      chart.options.scales.x.title.color = t.label;
      chart.options.scales.x.grid.color  = t.grid;
      chart.options.scales.y.grid.color  = t.grid;
      chart.options.scales.x.ticks.color = t.ticks;
      chart.options.scales.y.ticks.color = t.ticks;
      var r = compute();
      var borders = CLASSES.map(function (c) {
        return r && c.value === r.tolerance ? t.accent : 'transparent';
      });
      chart.data.datasets[0].borderColor = borders;
      chart.update('none');
    }

    EF.ensureChartJs().then(function () {
      buildChart();
      buildBands();
      recompute();
    }, function () {
      setWarning('Mini-chart unavailable (Chart.js blocked or offline). Decoder still works.');
      buildBands();
      recompute();
    });

    EF.widgets.push({
      name: 'resistor-color-decoder',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme
    });
  }

  // --------------------------------------------------------------------------
  // Card 2: E-Series Explorer
  // --------------------------------------------------------------------------
  function initESeriesExplorer() {
    var card = document.getElementById('electronics-eseries-card');
    if (!card) return;

    var data = EF.readDataIsland('electronics-eseries-data');
    if (!data || !data.series) return;

    var SERIES = data.series;
    var activeKey = data.active && SERIES[data.active] ? data.active : 'E24';

    var tabs       = Array.prototype.slice.call(card.querySelectorAll('.electronics-eseries-tab'));
    var grid       = document.getElementById('electronics-eseries-grid');
    var search     = document.getElementById('electronics-eseries-search');
    var countEl    = document.getElementById('electronics-eseries-count');
    var emptyEl    = document.getElementById('electronics-eseries-empty');
    var targetIn   = document.getElementById('electronics-eseries-target');
    var closestOut = document.getElementById('electronics-eseries-closest');
    if (!grid) return;

    var closestMantissa = null;

    function format(value, key) {
      var decimals = key === 'E96' ? 2 : 1;
      return value.toFixed(decimals);
    }

    function findClosest(target, key) {
      if (!isFinite(target) || target <= 0) return null;
      var s = SERIES[key];
      if (!s || !s.length) return null;
      var decade = Math.pow(10, Math.floor(Math.log10(target)));
      var mantissa = target / decade;
      var best = s[0], bestDiff = Math.abs(mantissa - s[0]);
      for (var i = 1; i < s.length; i++) {
        var diff = Math.abs(mantissa - s[i]);
        if (diff < bestDiff) { best = s[i]; bestDiff = diff; }
      }
      // Cross-decade rollover: 9.5 in this decade rounds to 10 in the next.
      if (Math.abs(mantissa - 10) < bestDiff) {
        return { value: decade * 10, mantissa: s[0], decade: decade * 10 };
      }
      return { value: decade * best, mantissa: best, decade: decade };
    }

    function renderGrid() {
      var values = SERIES[activeKey] || [];
      var q = search ? (search.value || '').trim().toLowerCase() : '';
      grid.innerHTML = '';
      var visible = 0;
      values.forEach(function (v) {
        var label = format(v, activeKey);
        if (q && label.indexOf(q) === -1) return;
        visible++;
        var chip = document.createElement('div');
        chip.className = 'electronics-eseries-value';
        chip.setAttribute('role', 'listitem');
        chip.textContent = label;
        if (closestMantissa !== null && Math.abs(v - closestMantissa) < 1e-4) {
          chip.classList.add('is-closest');
          chip.setAttribute('aria-label', label + ' (closest match)');
        }
        grid.appendChild(chip);
      });
      if (emptyEl) emptyEl.hidden = visible !== 0;
      if (countEl) {
        var total = values.length;
        countEl.textContent = q ? (visible + ' / ' + total) : (total + ' values');
      }
    }

    function recomputeClosest() {
      if (!targetIn) return;
      var raw = (targetIn.value || '').trim();
      if (raw === '') {
        closestMantissa = null;
        if (closestOut) closestOut.textContent = '—';
        renderGrid();
        return;
      }
      var target = parseFloat(raw);
      if (!isFinite(target) || target <= 0) {
        closestMantissa = null;
        if (closestOut) closestOut.textContent = 'invalid';
        renderGrid();
        return;
      }
      var c = findClosest(target, activeKey);
      if (!c) {
        closestMantissa = null;
        if (closestOut) closestOut.textContent = '—';
      } else {
        closestMantissa = c.mantissa;
        // Snapped value with E-series tag so the visitor can copy it directly.
        if (closestOut) {
          closestOut.textContent = activeKey + ': ' + EF.formatNumberWithUnits(c.value, 'Ω');
        }
      }
      renderGrid();
    }

    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        activeKey = t.getAttribute('data-series');
        tabs.forEach(function (tt) {
          var on = tt === t;
          tt.classList.toggle('is-active', on);
          tt.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        recomputeClosest();
      });
    });

    if (search)   search.addEventListener('input',   EF.debounce(renderGrid,        60));
    if (targetIn) targetIn.addEventListener('input', EF.debounce(recomputeClosest,  80));

    renderGrid();
  }

  // ==========================================================================
  // Section 5 — Circuit Design Guides & Practical Tips
  //   Static cards laid out by Liquid; this hook adds the interactive
  //   filtering UI on top: tier pills (best-practice / warning / danger) plus
  //   a free-text search that walks each card's data-topic + body text.
  // ==========================================================================
  function initDesignGuides() {
    var section = document.getElementById('electronics-design-guides');
    if (!section) return;
    var grid = document.getElementById('electronics-guides-grid');
    if (!grid) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.electronics-guide'));
    if (!cards.length) return;

    var search    = document.getElementById('electronics-guides-search');
    var countEl   = document.getElementById('electronics-guides-count');
    var emptyEl   = document.getElementById('electronics-guides-empty');
    var filterBtns = Array.prototype.slice.call(section.querySelectorAll('.electronics-guides-filter'));

    var activeTier = 'all';
    var total = cards.length;

    // Pre-compute lower-cased haystacks once so per-keystroke filtering stays
    // cheap even with dozens of cards.
    var haystacks = cards.map(function (card) {
      var topic = (card.getAttribute('data-topic') || '').toLowerCase();
      var text  = card.textContent.toLowerCase();
      return topic + ' ' + text;
    });

    function applyFilters() {
      var q = search ? (search.value || '').trim().toLowerCase() : '';
      var visible = 0;
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var tierOk = activeTier === 'all' || card.getAttribute('data-tier') === activeTier;
        var textOk = !q || haystacks[i].indexOf(q) !== -1;
        var show = tierOk && textOk;
        card.hidden = !show;
        if (show) visible++;
      }
      if (emptyEl) emptyEl.hidden = visible !== 0;
      if (countEl) {
        countEl.textContent = (q || activeTier !== 'all')
          ? visible + ' / ' + total
          : total + ' tips';
      }
    }
    var debouncedFilter = EF.debounce(applyFilters, 60);

    if (search) {
      search.addEventListener('input', debouncedFilter);
    }

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeTier = btn.getAttribute('data-filter') || 'all';
        filterBtns.forEach(function (b) {
          var on = (b === btn);
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        applyFilters();
      });
    });

    applyFilters();
  }

  // ==========================================================================
  // Section 6 — Reference Tables
  //   Tabs swap between SI prefixes, resistor color codes, capacitor codes,
  //   wire-gauge ratings, logic-family thresholds, and battery-cell voltages.
  //   A single search input filters rows live in whichever table is showing.
  // ==========================================================================
  function initReferenceTables() {
    var section = document.getElementById('electronics-tables');
    if (!section) return;
    var grid = document.getElementById('electronics-tables-grid');
    if (!grid) return;

    var wrappers = Array.prototype.slice.call(
      grid.querySelectorAll('.electronics-table-wrapper[data-table]')
    );
    if (!wrappers.length) return;

    var tabs    = Array.prototype.slice.call(section.querySelectorAll('.electronics-tables-tab'));
    var search  = document.getElementById('electronics-tables-search');
    var countEl = document.getElementById('electronics-tables-count');
    var emptyEl = document.getElementById('electronics-tables-empty');

    // Pre-cache rows per table + their lower-cased text so per-keystroke
    // filtering stays cheap on tables with dozens of rows.
    var byKey = {};
    wrappers.forEach(function (w) {
      var key = w.getAttribute('data-table');
      var rows = Array.prototype.slice.call(w.querySelectorAll('tbody tr'));
      byKey[key] = {
        wrapper: w,
        rows: rows,
        haystacks: rows.map(function (r) { return r.textContent.toLowerCase(); })
      };
    });

    var activeKey = (wrappers[0] && wrappers[0].getAttribute('data-table')) || null;

    function applyFilters() {
      var entry = byKey[activeKey];
      if (!entry) return;
      var q = search ? (search.value || '').trim().toLowerCase() : '';
      var visible = 0;
      var total = entry.rows.length;
      for (var i = 0; i < total; i++) {
        var show = !q || entry.haystacks[i].indexOf(q) !== -1;
        entry.rows[i].hidden = !show;
        if (show) visible++;
      }
      if (emptyEl) emptyEl.hidden = visible !== 0;
      if (countEl) {
        countEl.textContent = q
          ? visible + ' / ' + total
          : total + ' rows';
      }
    }

    function showTable(key) {
      if (!byKey[key]) return;
      activeKey = key;
      wrappers.forEach(function (w) {
        w.hidden = w.getAttribute('data-table') !== key;
      });
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-table') === key;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      applyFilters();
    }

    var debouncedFilter = EF.debounce(applyFilters, 60);
    if (search) search.addEventListener('input', debouncedFilter);

    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        showTable(t.getAttribute('data-table'));
      });
    });

    showTable(activeKey);
  }

  // ==========================================================================
  // Boot
  // ==========================================================================
  function boot() {
    initQuickReferenceWheel();
    initFormulasSection();
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
