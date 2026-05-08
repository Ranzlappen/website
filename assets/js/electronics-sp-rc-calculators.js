/* ============================================================================
   electronics-sp-rc-calculators.js — Section 3 / Calculators 4 & 5
   ----------------------------------------------------------------------------
   * Calculator 4 — Series / Parallel Resistors & Capacitors
   * Calculator 5 — RC Timer / Time Constant

   Depends on electronics-utils.js + electronics-widget-core.js.
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;
  var EF = window.ElectronicsFundamentals;
  if (!EF || typeof EF._registerSection !== 'function') return;


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
      // Strictly filter to finite, positive numbers so a half-typed row, a
      // just-deleted row whose closure was already evicted, an Infinity from
      // an upstream divide-by-zero, or a NaN from parseFloat('') can never
      // poison the total. Both formulas need at least one valid value.
      var v = (values || []).filter(function (x) {
        return Number.isFinite(x) && x > 0;
      });
      if (!v.length) return { total: NaN, count: 0 };
      var total;
      if (state.type === 'resistor' && state.topology === 'series')        total = v.reduce(sum, 0);
      else if (state.type === 'resistor' && state.topology === 'parallel') total = 1 / v.reduce(recipSum, 0);
      else if (state.type === 'capacitor' && state.topology === 'series')  total = 1 / v.reduce(recipSum, 0);
      else                                                                  total = v.reduce(sum, 0);
      // The reciprocal formulas can hand back Infinity for degenerate cases
      // (e.g. one row entered as something parseFloat resolved to 0). Coerce
      // to NaN so renderResult's guard catches it cleanly.
      if (!Number.isFinite(total)) return { total: NaN, count: v.length };
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
      // Defence in depth: tolerate a stale `entry` reference (e.g. a
      // double-click during a debounced recompute, or a programmatic call
      // after the row was already spliced) so we never end up with an
      // out-of-range splice that leaves a phantom node in the DOM.
      if (!entry || !entry.row) return;
      if (state.rows.length <= MIN_ROWS) return;
      var idx = state.rows.indexOf(entry);
      if (idx === -1) {
        // Entry wasn't in state.rows but its DOM node may still hang around.
        try { entry.row.remove(); } catch (_) { /* node already detached */ }
        return;
      }
      state.rows.splice(idx, 1);
      try { entry.row.remove(); } catch (_) { /* already detached */ }
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
        // EF.sanitizeInput already returns NaN for empty / non-numeric /
        // Infinity inputs; this single-line read replaces the prior
        // parseFloat + isFinite pair.
        return EF.sanitizeInput(r && r.num ? r.num.value : '');
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
        EF.copyWithFlash(copyBtn, lines.join('\n')).then(function (ok) {
          if (!ok) setWarning('Clipboard copy failed — your browser may block it on insecure pages.');
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
        var wheel = EF.findWidgetByName('quick-reference-wheel');
        if (wheel && typeof wheel.setValues === 'function') {
          wheel.setValues(values, { scroll: true });
          // eslint-disable-next-line no-console
          console.log('🪛 Series/Parallel → Quick Wheel:', values);
        }
      });
    }

    // ---- Chart -------------------------------------------------------------
    // chartTheme delegated to EF.chartTheme — its `bars` palette already
    // matches the 8-hue cycle this calc was using (Batch 6 deduplication).
    var chartTheme = EF.chartTheme;

    function buildChart() {
      if (!window.Chart || !canvas) return;
      var t = chartTheme();
      chart = new window.Chart(canvas, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Value', data: [], backgroundColor: [] }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: EF.prefersReducedMotion() ? false : { duration: 200 },
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

    // Boot text-only mode immediately so rows + total work even before chart.
    clearAndSeed();
    updateOpenWheelEnabled();
    recompute();

    EF.ensureChartJs().then(function () {
      var wrapper = canvas && canvas.parentElement;
      if (!wrapper || !EF.LazyChartManager || typeof EF.LazyChartManager.register !== 'function') {
        buildChart(); recompute();
        return;
      }
      EF.LazyChartManager.register('series-parallel-chart', wrapper, {
        build: function () { buildChart(); recompute(); return chart; },
        pause: function () {
          if (chart && typeof chart.destroy === 'function') { chart.destroy(); chart = null; }
        },
        resume: function () { buildChart(); recompute(); return chart; }
      });
    }, function () {
      setWarning('Chart unavailable (Chart.js blocked or offline). Calculations still work.');
    });

    EF.widgets.push({
      name: 'series-parallel-calculator',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme,
      getState: function () {
        return {
          type: state.type,
          topology: state.topology,
          rowCount: state.rows.length,
          values: lastValues.filter(function (v) { return Number.isFinite(v); })
        };
      },
      reset: function () { if (clearBtn) clearBtn.click(); },
      restoreState: function (snap) {
        if (!snap) return;
        // 1) Sync the type/topology radios programmatically. Clicking
        //    matching radios fires the change handler which routes through
        //    setType/setTopology — that already re-seeds rows + updates
        //    the Open-in-Quick-Wheel enabled state, so we just feed it.
        if (snap.type && (snap.type === 'resistor' || snap.type === 'capacitor')) {
          var typeRadio = card.querySelector('input[name="sp-type"][value="' + snap.type + '"]');
          if (typeRadio && !typeRadio.checked) { typeRadio.checked = true; setType(snap.type, { force: true }); }
        }
        if (snap.topology && (snap.topology === 'series' || snap.topology === 'parallel')) {
          var topoRadio = card.querySelector('input[name="sp-topology"][value="' + snap.topology + '"]');
          if (topoRadio && !topoRadio.checked) { topoRadio.checked = true; setTopology(snap.topology); }
        }
        // 2) Match row count to the snapshot (within MIN/MAX bounds).
        var values = Array.isArray(snap.values) ? snap.values : [];
        var target = Math.max(MIN_ROWS, Math.min(MAX_ROWS, values.length || state.rows.length));
        while (state.rows.length < target) buildRow(NaN);
        while (state.rows.length > target) {
          var last = state.rows[state.rows.length - 1];
          if (!last) break;
          removeRow(last);
        }
        // 3) Inject the saved values into each row's input + slider.
        for (var i = 0; i < state.rows.length; i++) {
          var v = EF.sanitizeInput(values[i]);
          if (!Number.isFinite(v) || v <= 0) continue;
          state.rows[i].num.value = String(v);
          var slider = state.rows[i].slider;
          if (slider) {
            var min = parseFloat(slider.min);
            var max = parseFloat(slider.max);
            slider.value = String(Math.max(min, Math.min(max, v)));
          }
        }
        recompute();
      }
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

    // Slider clamp delegated to EF.syncSliderToValue (Batch 6).
    function syncSlider(name, value) { EF.syncSliderToValue(sliders[name], value); }
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
        EF.copyWithFlash(copyBtn, lines).then(function (ok) {
          if (!ok) setWarning('Clipboard copy failed — your browser may block it on insecure pages.');
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
        var wheel = EF.findWidgetByName('quick-reference-wheel');
        if (wheel && typeof wheel.setValues === 'function') {
          wheel.setValues(values, { scroll: true });
          // eslint-disable-next-line no-console
          console.log('⏱ RC Timer → Quick Wheel (peak):', values);
        }
      });
    }

    // ---- Chart -------------------------------------------------------------
    // chartTheme delegated to EF.chartTheme — its `marker` key (orange)
    // already matches what RC Timer used (Batch 6 deduplication).
    var chartTheme = EF.chartTheme;

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
      // Honour prefers-reduced-motion: snap the cursor straight to the
      // 5τ end-state instead of animating the rAF loop. The visitor
      // still sees the curve and the V(t) stat pill at full charge.
      if (EF.prefersReducedMotion()) {
        cursorT = lastResult.fullTime;
        updateCursor();
        if (playBtn) {
          playBtn.textContent = '▶ Play';
          playBtn.setAttribute('aria-pressed', 'false');
        }
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

    // Boot text-only mode immediately so τ / 5τ / f_c stat pills update
    // even before the chart paints.
    applyDefaults();
    recompute();

    EF.ensureChartJs().then(function () {
      var wrapper = canvas && canvas.parentElement;
      if (!wrapper || !EF.LazyChartManager || typeof EF.LazyChartManager.register !== 'function') {
        buildChart(); recompute();
        return;
      }
      EF.LazyChartManager.register('rc-timer-chart', wrapper, {
        build: function () { buildChart(); recompute(); return chart; },
        pause: function () {
          // Off-screen → kill the animation loop too, otherwise rAF keeps
          // ticking on a destroyed chart.
          if (typeof pause === 'function') { try { pause(); } catch (_) {} }
          if (chart && typeof chart.destroy === 'function') { chart.destroy(); chart = null; }
        },
        resume: function () { buildChart(); recompute(); return chart; }
      });
    }, function () {
      setWarning('Chart unavailable (Chart.js blocked or offline). Calculations still work.');
    });

    EF.widgets.push({
      name: 'rc-timer-calculator',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme,
      getState: function () {
        var snap = {};
        QTY.forEach(function (n) {
          var v = EF.sanitizeInput(inputs[n].value);
          snap[n] = Number.isFinite(v) ? v : null;
        });
        snap.mode = mode;
        return snap;
      },
      reset: function () {
        if (typeof pause === 'function') pause();
        if (clearBtn) clearBtn.click();
      },
      restoreState: function (snap) {
        if (!snap) return;
        if (typeof pause === 'function') pause();
        if (snap.mode && snap.mode !== mode) {
          // Programmatic mode swap goes through the existing setMode logic
          // so the toggle button states stay in sync with the curve direction.
          setMode(snap.mode);
        }
        QTY.forEach(function (n) {
          var v = EF.sanitizeInput(snap[n]);
          if (!Number.isFinite(v) || v < 0) return;
          inputs[n].value = String(v);
          syncSlider(n, v);
        });
        recompute();
      }
    });
  }

  EF._registerSection('series-parallel-calculator', initSeriesParallelCalculator);
  EF._registerSection('rc-timer-calculator',        initRcTimerCalculator);
})();
