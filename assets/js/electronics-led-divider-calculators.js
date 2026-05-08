/* ============================================================================
   electronics-led-divider-calculators.js — Section 3 / Calculators 2 & 3
   ----------------------------------------------------------------------------
   * Calculator 2 — LED Resistor
   * Calculator 3 — Voltage Divider
   Plus the shared E-series snap helper used by the LED card.

   Depends on electronics-utils.js + electronics-widget-core.js.
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;
  var EF = window.ElectronicsFundamentals;
  if (!EF || typeof EF._registerSection !== 'function') return;

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
          animation: EF.prefersReducedMotion() ? false : { duration: 200 },
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

    // Apply defaults + run text-only recompute immediately so the page
    // shows live values even before the chart paints.
    applyDefaults();
    recompute();

    EF.ensureChartJs().then(function () {
      var wrapper = canvas && canvas.parentElement;
      if (!wrapper || !EF.LazyChartManager || typeof EF.LazyChartManager.register !== 'function') {
        buildChart(); recompute();
        return;
      }
      EF.LazyChartManager.register('led-resistor-chart', wrapper, {
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
      name: 'led-resistor-calculator',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme,
      getState: function () {
        return {
          Vsupply: EF.sanitizeInput(inputs.Vsupply.value),
          Vf:      EF.sanitizeInput(inputs.Vf.value),
          I:       EF.sanitizeInput(inputs.I.value),
          color:   colorSelect ? colorSelect.value : null
        };
      },
      reset: function () { if (clearBtn) clearBtn.click(); },
      restoreState: function (snap) {
        if (!snap) return;
        if (colorSelect && snap.color && colorSelect.querySelector('option[value="' + snap.color + '"]')) {
          colorSelect.value = snap.color;
        }
        ['Vsupply', 'Vf', 'I'].forEach(function (n) {
          var v = EF.sanitizeInput(snap[n]);
          if (!Number.isFinite(v)) return;
          inputs[n].value = String(v);
          syncSlider(n, v);
        });
        recompute();
      }
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
          animation: EF.prefersReducedMotion() ? false : { duration: 200 },
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

    applyDefaults();
    recompute();

    EF.ensureChartJs().then(function () {
      var wrapper = canvas && canvas.parentElement;
      if (!wrapper || !EF.LazyChartManager || typeof EF.LazyChartManager.register !== 'function') {
        buildChart(); recompute();
        return;
      }
      EF.LazyChartManager.register('voltage-divider-chart', wrapper, {
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
      name: 'voltage-divider-calculator',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme,
      getState: function () {
        var snap = {};
        QTY.forEach(function (n) {
          var v = EF.sanitizeInput(inputs[n].value);
          snap[n] = Number.isFinite(v) ? v : null;
        });
        return snap;
      },
      reset: function () { if (clearBtn) clearBtn.click(); },
      restoreState: function (snap) {
        if (!snap) return;
        QTY.forEach(function (n) {
          var v = EF.sanitizeInput(snap[n]);
          if (!Number.isFinite(v)) return;
          inputs[n].value = String(v);
          syncSlider(n, v);
        });
        recompute();
      }
    });
  }

  EF._registerSection('led-resistor-calculator',    initLedResistorCalculator);
  EF._registerSection('voltage-divider-calculator', initVoltageDividerCalculator);
})();
