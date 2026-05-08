/* ============================================================================
   electronics-ohms-calculator.js — Section 3 / Calculator 1: Ohm's Law / Power
   ----------------------------------------------------------------------------
   Depends on electronics-utils.js + electronics-widget-core.js.
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;
  var EF = window.ElectronicsFundamentals;
  if (!EF || typeof EF._registerSection !== 'function') return;

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
          animation: EF.prefersReducedMotion() ? false : { duration: 200 },
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
          animation: EF.prefersReducedMotion() ? false : { duration: 200 },
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

    // Apply defaults + run text-only recompute immediately so the page
    // shows live values even before the charts paint.
    applyDefaults();
    recompute();

    EF.ensureChartJs().then(function () {
      // Lazy-build via EF.LazyChartManager. Both VI and PR charts share one
      // registration against their common parent (.electronics-ohms-charts)
      // so they activate together — avoids the LRU ping-pong that two
      // separate registrations would cause when the user is looking at the
      // Ohm's section.
      var wrapper = card.querySelector('.electronics-ohms-charts');
      if (!wrapper || !EF.LazyChartManager || typeof EF.LazyChartManager.register !== 'function') {
        buildVIChart(); buildPRChart(); recompute();
        return;
      }
      EF.LazyChartManager.register('ohms-law-charts', wrapper, {
        build: function () {
          buildVIChart();
          buildPRChart();
          recompute();
          return viChart || prChart;
        },
        pause: function () {
          if (viChart && typeof viChart.destroy === 'function') { viChart.destroy(); viChart = null; }
          if (prChart && typeof prChart.destroy === 'function') { prChart.destroy(); prChart = null; }
        },
        resume: function () {
          buildVIChart();
          buildPRChart();
          recompute();
          return viChart || prChart;
        }
      });
    }, function () {
      // Charts couldn't load (offline / consent withheld). Calculations still
      // work — text-only mode already booted above.
      setWarning('Charts unavailable (Chart.js blocked or offline). Calculations still work.');
    });

    EF.widgets.push({
      name: 'ohms-law-calculator',
      onResize: function () {
        if (viChart) viChart.resize();
        if (prChart) prChart.resize();
      },
      onThemeChange: applyChartTheme,
      getState: function () {
        var snap = {};
        QTY.forEach(function (n) { snap[n] = isFinite(userValues[n]) ? userValues[n] : null; });
        return { userOrder: userOrder.slice(), userValues: snap };
      },
      reset: function () { if (clearBtn) clearBtn.click(); },
      restoreState: function (snap) {
        if (!snap || !snap.userValues) return;
        userOrder = [];
        userValues = {};
        QTY.forEach(function (n) { inputs[n].value = ''; });
        var order = Array.isArray(snap.userOrder) ? snap.userOrder : Object.keys(snap.userValues);
        order.forEach(function (n) {
          var v = snap.userValues[n];
          if (!isFinite(v) || !inputs[n]) return;
          inputs[n].value = String(v);
          if (typeof syncSliderFromValue === 'function') syncSliderFromValue(n, v);
          trackUserInput(n, v);
        });
        recompute();
      }
    });
  }

  EF._registerSection('ohms-law-calculator', initOhmsLawCalculator);
})();
