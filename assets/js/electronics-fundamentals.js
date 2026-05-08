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
