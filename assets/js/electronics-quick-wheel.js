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

    // Inject accessible <title> + <desc> into the SVG so screen readers can
    // announce a meaningful overview of the wheel (the existing aria-label
    // is shorter; describeSvg adds longer-form description without conflict).
    var wheelSvg = wheel.querySelector('svg');
    if (wheelSvg && typeof EF.describeSvg === 'function') {
      EF.describeSvg(
        wheelSvg,
        'Ohm’s Law Quick Wheel',
        'Four quadrants — Voltage (V), Current (I), Resistance (R), and Power (P). Each quadrant lists the three formulas that solve for that quantity. Click any quadrant to focus the matching input on the right.'
      );
    }

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

    // Solver delegated to EF.solveOhmsLaw — single shared implementation
    // (Batch 6 deduplication). Same shape of return value: { values } /
    // { error } / { partial: true, values }.
    var solve = EF.solveOhmsLaw;

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
      battery:    { V: 12,  R: 100 },
      led:        { V: 5,   I: 0.02 },
      usb:        { V: 5,   I: 2 },
      battery9v:  { V: 9,   R: 1000 },
      mcu33:      { V: 3.3, I: 0.05 },
      'aa-led':   { V: 1.5, R: 220 },
      laptop:     { V: 19,  I: 3.42 },
      ledstrip:   { V: 12,  I: 1 }
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

    // chartTheme delegated to EF.chartTheme — unified palette across every
    // chart on the page (Batch 6 deduplication).
    var chartTheme = EF.chartTheme;
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
      var changed = [];
      Object.keys(values).forEach(function (n) {
        if (!inputs[n]) return;
        var num = parseFloat(values[n]);
        if (!isFinite(num)) return;
        inputs[n].value = String(num);
        trackUserInput(n, num);
        changed.push(n);
      });
      recompute();

      // Per-quadrant flash — visually signals which quantities just changed
      // when the wheel was driven from another widget (e.g. "Open in Quick
      // Wheel" on a formula card). Without this, the wheel updates silently
      // even though the user-visible focus has just moved to it.
      if (changed.length && wheelSvg) {
        changed.forEach(function (n) {
          var q = wheelSvg.querySelector('.electronics-wheel__quadrant[data-quantity="' + n + '"]');
          if (!q) return;
          q.classList.remove('is-flash');
          // Force a reflow so re-adding the class restarts the keyframe
          // when the wheel is hit twice in quick succession.
          // eslint-disable-next-line no-unused-expressions
          q.getBoundingClientRect && q.getBoundingClientRect();
          q.classList.add('is-flash');
          setTimeout(function () { q.classList.remove('is-flash'); }, 720);
        });
      }
      // ARIA announcement so screen-reader users hear the wheel changed under
      // them. Reuses the existing #electronics-wheel-status live region —
      // recompute() will overwrite the message immediately afterwards with
      // its own summary, so we deliberately skip status if recompute already
      // produced an "ok" status (it announces the same data more usefully).
      if (statusEl && changed.length) {
        var prev = statusEl.textContent;
        statusEl.textContent = 'Quick Wheel updated: ' + changed.join(', ');
        // Restore whatever recompute() decided after a beat so SR users
        // don't lose the running result text.
        setTimeout(function () {
          if (statusEl.textContent.indexOf('Quick Wheel updated') === 0) {
            statusEl.textContent = prev;
          }
        }, 1400);
      }

      if (opts.scroll !== false && section) {
        EF.scrollIntoView(section, { block: 'start' });
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
