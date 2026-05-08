/* ============================================================================
   electronics-quick-wheel.js — Section 1: Ohm's Law Quick Wheel hero
   ----------------------------------------------------------------------------
   Depends on electronics-utils.js + electronics-widget-core.js.
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;
  var EF = window.ElectronicsFundamentals;
  if (!EF || typeof EF._registerSection !== 'function') return;

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

    function trackUserInput(name, value) {
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

    var EXAMPLES = {
      battery: { V: 12,  R: 100 },
      led:     { V: 5,   I: 0.02 },
      usb:     { V: 5,   I: 2 }
    };
    function loadExample(key) {
      var preset = EXAMPLES[key];
      if (!preset) return;
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

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        userOrder = [];
        userValues = {};
        QTY.forEach(function (n) { inputs[n].value = ''; });
        recompute();
        inputs.V.focus();
      });
    }

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
          animation: EF.prefersReducedMotion() ? false : { duration: 250 },
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
      // Lazy-build via EF.LazyChartManager so the chart only paints when its
      // wrapper actually enters the viewport. Off-screen / LRU-evicted →
      // chart.destroy() frees the WebGL/Canvas2D context; resume → rebuild.
      var wrapper = canvas && canvas.parentElement;
      if (!wrapper || !EF.LazyChartManager || typeof EF.LazyChartManager.register !== 'function') {
        buildChart();
        recompute();
        return;
      }
      EF.LazyChartManager.register('quick-reference-wheel-chart', wrapper, {
        build: function () { buildChart(); recompute(); return chart; },
        pause: function () {
          if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
            chart = null;
          }
        },
        resume: function () { buildChart(); recompute(); return chart; }
      });
    }, function () {
      setStatus('Power-Triangle chart unavailable (Chart.js blocked or offline). Calculations still work.', 'warn');
    });

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

    EF.widgets.push({
      name: 'quick-reference-wheel',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme,
      setValues: setExternalValues,
      getState: function () {
        var snap = {};
        QTY.forEach(function (n) { snap[n] = isFinite(userValues[n]) ? userValues[n] : null; });
        return { userOrder: userOrder.slice(), userValues: snap };
      },
      reset: function () {
        userOrder = [];
        userValues = {};
        QTY.forEach(function (n) { inputs[n].value = ''; });
        recompute();
      },
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
          trackUserInput(n, v);
        });
        recompute();
      }
    });

    recompute();
  }

  EF._registerSection('quick-reference-wheel', initQuickReferenceWheel);
})();
