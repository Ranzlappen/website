/* ============================================================================
   electronics-battery-calculator.js — Section 3 / Calculator 6

   Real-world battery charge & capacity calculator. Four modes:
     A. Charge time:  capacity + start% + target% + (current OR power+V) + η  → hours
     B. Runtime:      capacity + V + (current OR power)                       → hours
     C. Capacity:     known load_current_mA + observed runtime_h              → mAh
     D. SOC:          chemistry + measured cell voltage                       → %

   Linear approximation — does not model the CC/CV taper above ~80 %. The
   efficiency knob folds in switching + heat losses. Five preset pills
   preload Mode A with phone / laptop / 18650 / power bank / car battery
   scenarios.

   Depends on electronics-utils.js + electronics-widget-core.js.
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;
  var EF = window.ElectronicsFundamentals;
  if (!EF || typeof EF._registerSection !== 'function') return;

  // ------------------------------------------------------------------------
  // SOC interpolation: piecewise-linear between 0%/50%/100% voltage anchors.
  // Returned percent is clamped to [0, 100]; out-of-range voltages flag a
  // warning in the result UI.
  // ------------------------------------------------------------------------
  function interpolateSOC(curve, v) {
    if (!curve || !Number.isFinite(v)) return null;
    var v0 = curve.v0, v50 = curve.v50, v100 = curve.v100;
    if (v <= v0)   return { pct: 0,   clamped: 'below' };
    if (v >= v100) return { pct: 100, clamped: 'above' };
    var pct;
    if (v <= v50) {
      pct = ((v - v0)  / (v50  - v0))  * 50;
    } else {
      pct = 50 + ((v - v50) / (v100 - v50)) * 50;
    }
    return { pct: Math.max(0, Math.min(100, pct)), clamped: null };
  }

  function formatHours(h) {
    if (!Number.isFinite(h) || h < 0) return '—';
    if (h < (1 / 3600)) return '< 1 s';
    if (h < (1 / 60)) {
      return (h * 3600).toFixed(0) + ' s';
    }
    if (h < 1) {
      return Math.round(h * 60) + ' min';
    }
    var hours = Math.floor(h);
    var mins  = Math.round((h - hours) * 60);
    if (mins === 60) { hours += 1; mins = 0; }
    if (hours >= 24) {
      var days = Math.floor(hours / 24);
      var rem  = hours - days * 24;
      return days + ' d ' + rem + ' h';
    }
    return hours + ' h ' + (mins < 10 ? '0' : '') + mins + ' m';
  }

  function initBatteryCalculator() {
    var card = document.getElementById('electronics-calc-battery');
    if (!card) return;

    var data    = EF.readDataIsland('electronics-calc-battery-data') || {};
    var DEF     = data.defaults  || {};
    var PRESETS = data.presets   || {};
    var CURVES  = data.soc_curves || {};

    var modeRadios = card.querySelectorAll('input[name="bat-mode"]');
    var panels     = card.querySelectorAll('.electronics-bat-panel');
    var warningEl  = card.querySelector('#electronics-bat-warning');
    var clearBtn   = card.querySelector('#electronics-bat-clear');
    var copyBtn    = card.querySelector('#electronics-bat-copy');
    var presetBtns = card.querySelectorAll('[data-bat-preset]');

    // ---- Mode A: Charge time ---------------------------------------------
    var chargeCap   = card.querySelector('#ef-bat-charge-cap');
    var chargeStart = card.querySelector('#ef-bat-charge-start');
    var chargeTgt   = card.querySelector('#ef-bat-charge-target');
    var chargeKind  = card.querySelector('#ef-bat-charge-kind');
    var chargeI     = card.querySelector('#ef-bat-charge-I');
    var chargeP     = card.querySelector('#ef-bat-charge-P');
    var chargeV     = card.querySelector('#ef-bat-charge-V');
    var chargeEff   = card.querySelector('#ef-bat-charge-eff');
    var chargeIRow  = card.querySelector('[data-field="ChargeI"]');
    var chargePRow  = card.querySelector('[data-field="ChargeP"]');
    var chargeVRow  = card.querySelector('#ef-bat-charge-V').closest('[data-field]');
    var chargeBar   = card.querySelector('#ef-bat-charge-bar');
    var chargeBarStart = card.querySelector('#ef-bat-charge-bar-start');
    var chargeBarEnd   = card.querySelector('#ef-bat-charge-bar-end');
    var chargeResult   = card.querySelector('#electronics-bat-charge-result');

    // ---- Mode B: Runtime --------------------------------------------------
    var runCap     = card.querySelector('#ef-bat-run-cap');
    var runV       = card.querySelector('#ef-bat-run-V');
    var runKind    = card.querySelector('#ef-bat-run-kind');
    var runI       = card.querySelector('#ef-bat-run-I');
    var runP       = card.querySelector('#ef-bat-run-P');
    var runIRow    = card.querySelector('[data-field="LoadI"]');
    var runPRow    = card.querySelector('[data-field="LoadP"]');
    var runResult  = card.querySelector('#electronics-bat-run-result');

    // ---- Mode C: Capacity from test --------------------------------------
    var capI       = card.querySelector('#ef-bat-cap-I');
    var capTime    = card.querySelector('#ef-bat-cap-time');
    var capResult  = card.querySelector('#electronics-bat-cap-result');

    // ---- Mode D: SOC ------------------------------------------------------
    var socChem    = card.querySelector('#ef-bat-soc-chem');
    var socV       = card.querySelector('#ef-bat-soc-V');
    var socBar     = card.querySelector('#ef-bat-soc-bar');
    var socResult  = card.querySelector('#electronics-bat-soc-result');

    var currentMode = 'charge';

    function setWarning(msg) {
      if (!warningEl) return;
      if (!msg) { warningEl.hidden = true; warningEl.textContent = ''; }
      else      { warningEl.hidden = false; warningEl.textContent = msg; }
    }

    function applyDefaults() {
      var d = DEF.charge || {};
      chargeCap.value   = d.capacity_mAh != null ? d.capacity_mAh : 5000;
      chargeStart.value = d.start_pct    != null ? d.start_pct    : 0;
      chargeTgt.value   = d.target_pct   != null ? d.target_pct   : 100;
      chargeKind.value  = d.kind || 'current';
      chargeI.value     = d.I_A   != null ? d.I_A   : 3;
      chargeP.value     = d.P_W   != null ? d.P_W   : 15;
      chargeV.value     = d.V     != null ? d.V     : 3.7;
      chargeEff.value   = d.eff_pct != null ? d.eff_pct : 85;
      syncChargeKindRow();

      var r = DEF.runtime || {};
      runCap.value   = r.capacity_mAh != null ? r.capacity_mAh : 10000;
      runV.value     = r.V    != null ? r.V    : 3.7;
      runKind.value  = r.kind || 'current';
      runI.value     = r.I_A  != null ? r.I_A  : 0.5;
      runP.value     = r.P_W  != null ? r.P_W  : 2;
      syncRunKindRow();

      var c = DEF.capacity || {};
      capI.value    = c.I_mA  != null ? c.I_mA  : 500;
      capTime.value = c.time_h != null ? c.time_h : 6;

      var s = DEF.soc || {};
      socChem.value = s.chemistry || 'liion';
      socV.value    = s.V != null ? s.V : 3.7;
    }

    function syncChargeKindRow() {
      var byPower = chargeKind.value === 'power';
      if (chargeIRow) chargeIRow.hidden = byPower;
      if (chargePRow) chargePRow.hidden = !byPower;
      // V is always visible in Mode A — used by power → current conversion
      // and by the "battery voltage" caption regardless of input style.
      if (chargeVRow) chargeVRow.hidden = false;
    }

    function syncRunKindRow() {
      var byPower = runKind.value === 'power';
      if (runIRow) runIRow.hidden = byPower;
      if (runPRow) runPRow.hidden = !byPower;
    }

    function setMode(mode) {
      currentMode = mode;
      panels.forEach(function (p) {
        p.hidden = p.getAttribute('data-bat-mode') !== mode;
      });
      modeRadios.forEach(function (r) {
        if (r.value === mode && !r.checked) r.checked = true;
      });
      recompute();
    }

    // ---- Compute Mode A: Charge time -------------------------------------
    function computeCharge() {
      var capMah = EF.sanitizeInput(chargeCap.value);
      var start  = EF.sanitizeInput(chargeStart.value);
      var target = EF.sanitizeInput(chargeTgt.value);
      var V      = EF.sanitizeInput(chargeV.value);
      var effPct = EF.sanitizeInput(chargeEff.value);
      var byPower = chargeKind.value === 'power';
      var I, P;
      if (byPower) {
        P = EF.sanitizeInput(chargeP.value);
        if (Number.isFinite(P) && Number.isFinite(V) && V > 0) {
          I = P / V;
        }
      } else {
        I = EF.sanitizeInput(chargeI.value);
      }

      if (!Number.isFinite(capMah) || capMah <= 0) {
        chargeResult.textContent = 'Enter a battery capacity above 0 mAh.';
        if (chargeBar) chargeBar.style.width = '0%';
        return;
      }
      if (!Number.isFinite(start) || start < 0 || start > 100) {
        chargeResult.textContent = 'Start charge must be between 0 and 100 %.';
        return;
      }
      if (!Number.isFinite(target) || target < 0 || target > 100) {
        chargeResult.textContent = 'Target charge must be between 0 and 100 %.';
        return;
      }
      if (target <= start) {
        chargeResult.textContent = 'Target charge must be higher than start charge.';
        if (chargeBar) chargeBar.style.width = '0%';
        return;
      }
      if (!Number.isFinite(I) || I <= 0) {
        chargeResult.textContent = byPower
          ? 'Enter charger power and battery voltage above 0.'
          : 'Enter a charge current above 0 A.';
        return;
      }
      if (!Number.isFinite(effPct) || effPct <= 0 || effPct > 100) {
        chargeResult.textContent = 'Efficiency must be between 1 and 100 %.';
        return;
      }

      var capAh   = capMah / 1000;
      var deltaAh = capAh * (target - start) / 100;
      var hours   = deltaAh / (I * (effPct / 100));

      var startStr  = (Math.round(start * 10) / 10) + '%';
      var targetStr = (Math.round(target * 10) / 10) + '%';
      var iStr = EF.formatNumberWithUnits(I, 'A');
      var msg  = 'Charging ' + capMah.toLocaleString() + ' mAh from ' + startStr +
                 ' to ' + targetStr + ' at ' + iStr +
                 ' (η ' + effPct + ' %): ' + formatHours(hours) + '.';
      if (byPower && Number.isFinite(P)) {
        msg += ' [' + P + ' W ÷ ' + V + ' V = ' + iStr + ']';
      }
      chargeResult.textContent = msg;

      if (chargeBar) {
        chargeBar.style.left  = start + '%';
        chargeBar.style.width = (target - start) + '%';
      }
      if (chargeBarStart) chargeBarStart.textContent = startStr;
      if (chargeBarEnd)   chargeBarEnd.textContent   = targetStr;
    }

    // ---- Compute Mode B: Runtime -----------------------------------------
    function computeRuntime() {
      var capMah = EF.sanitizeInput(runCap.value);
      var V      = EF.sanitizeInput(runV.value);
      var byPower = runKind.value === 'power';
      var I, P;
      if (byPower) {
        P = EF.sanitizeInput(runP.value);
        if (Number.isFinite(P) && Number.isFinite(V) && V > 0) {
          I = P / V;
        }
      } else {
        I = EF.sanitizeInput(runI.value);
      }
      if (!Number.isFinite(capMah) || capMah <= 0) {
        runResult.textContent = 'Enter a battery capacity above 0 mAh.';
        return;
      }
      if (!Number.isFinite(I) || I <= 0) {
        runResult.textContent = byPower
          ? 'Enter load power and battery voltage above 0.'
          : 'Enter a load current above 0 A.';
        return;
      }
      var capAh = capMah / 1000;
      var hours = capAh / I;
      var iStr  = EF.formatNumberWithUnits(I, 'A');
      var msg   = capMah.toLocaleString() + ' mAh @ ' + iStr +
                  ' lasts about ' + formatHours(hours) + '.';
      if (byPower && Number.isFinite(P) && Number.isFinite(V)) {
        msg += ' [' + P + ' W ÷ ' + V + ' V = ' + iStr + ']';
      }
      runResult.textContent = msg;
    }

    // ---- Compute Mode C: Capacity ----------------------------------------
    function computeCapacity() {
      var I_mA  = EF.sanitizeInput(capI.value);
      var t_h   = EF.sanitizeInput(capTime.value);
      if (!Number.isFinite(I_mA) || I_mA <= 0) {
        capResult.textContent = 'Enter the test load current above 0 mA.';
        return;
      }
      if (!Number.isFinite(t_h) || t_h <= 0) {
        capResult.textContent = 'Enter the observed runtime above 0 h.';
        return;
      }
      var mAh = I_mA * t_h;
      capResult.textContent = 'Estimated capacity at this discharge rate: ' +
        Math.round(mAh).toLocaleString() + ' mAh (' +
        I_mA + ' mA × ' + t_h + ' h).';
    }

    // ---- Compute Mode D: SOC ---------------------------------------------
    function computeSOC() {
      var chem = socChem.value;
      var v    = EF.sanitizeInput(socV.value);
      var curve = CURVES[chem];
      if (!curve) {
        socResult.textContent = 'Pick a chemistry to estimate SOC.';
        if (socBar) socBar.style.width = '0%';
        return;
      }
      if (!Number.isFinite(v) || v <= 0) {
        socResult.textContent = 'Enter the measured cell voltage above 0 V.';
        if (socBar) socBar.style.width = '0%';
        return;
      }
      var res = interpolateSOC(curve, v);
      if (!res) {
        socResult.textContent = 'Could not interpolate — check inputs.';
        return;
      }
      var pctStr = res.pct.toFixed(0) + ' %';
      var msg;
      if (res.clamped === 'below') {
        msg = curve.label + ' at ' + v + ' V is below the discharge cutoff (' +
              curve.v0 + ' V) — treat as 0 %. ' + curve.load_note;
      } else if (res.clamped === 'above') {
        msg = curve.label + ' at ' + v + ' V is above the full-charge voltage (' +
              curve.v100 + ' V) — treat as 100 %. ' +
              (chem === 'liion' || chem === 'lipo'
                ? 'Charging beyond ' + curve.v100 + ' V damages Li cells.'
                : '');
      } else {
        msg = curve.label + ' at ' + v + ' V ≈ ' + pctStr + ' SOC. ' +
              'Accuracy ' + curve.accuracy + '. ' + curve.load_note;
      }
      socResult.textContent = msg;
      if (socBar) socBar.style.width = res.pct + '%';
    }

    function recompute() {
      setWarning('');
      try {
        if (currentMode === 'charge')   computeCharge();
        if (currentMode === 'runtime')  computeRuntime();
        if (currentMode === 'capacity') computeCapacity();
        if (currentMode === 'soc')      computeSOC();
      } catch (e) {
        setWarning('Internal error in battery calculator: ' + (e && e.message));
      }
    }

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------
    var debouncedRecompute = EF.debounce(recompute, 50);

    [chargeCap, chargeStart, chargeTgt, chargeI, chargeP, chargeV, chargeEff,
     runCap, runV, runI, runP,
     capI, capTime,
     socV].forEach(function (el) {
      if (el) el.addEventListener('input', debouncedRecompute);
    });
    if (chargeKind) chargeKind.addEventListener('change', function () {
      syncChargeKindRow(); recompute();
    });
    if (runKind) runKind.addEventListener('change', function () {
      syncRunKindRow(); recompute();
    });
    if (socChem) socChem.addEventListener('change', recompute);

    modeRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (r.checked) setMode(r.value);
      });
    });

    presetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-bat-preset');
        var p = PRESETS[key];
        if (!p) return;
        // All current presets target Mode A (charge); future presets can
        // declare their own mode field.
        var mode = p.mode || 'charge';
        if (mode === 'charge') {
          if (p.capacity_mAh != null) chargeCap.value   = p.capacity_mAh;
          if (p.start_pct    != null) chargeStart.value = p.start_pct;
          if (p.target_pct   != null) chargeTgt.value   = p.target_pct;
          if (p.kind         != null) chargeKind.value  = p.kind;
          if (p.I_A          != null) chargeI.value     = p.I_A;
          if (p.P_W          != null) chargeP.value     = p.P_W;
          if (p.V            != null) chargeV.value     = p.V;
          if (p.eff_pct      != null) chargeEff.value   = p.eff_pct;
          syncChargeKindRow();
        }
        setMode(mode);
      });
    });

    if (clearBtn) clearBtn.addEventListener('click', function () {
      applyDefaults();
      setMode('charge');
    });
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var lines = [];
      var modeLabel = {
        charge:   'Charge time',
        runtime:  'Runtime',
        capacity: 'Capacity from test',
        soc:      'Voltage → SOC'
      }[currentMode] || currentMode;
      lines.push('Battery calculator — ' + modeLabel);
      var resultEl = card.querySelector(
        '#electronics-bat-' +
        (currentMode === 'charge' ? 'charge' :
         currentMode === 'runtime' ? 'run' :
         currentMode === 'capacity' ? 'cap' : 'soc') +
        '-result'
      );
      if (resultEl) lines.push(resultEl.textContent.trim());
      EF.copyWithFlash(copyBtn, lines.join('\n'), { label: 'Copied ✓' });
    });

    // Boot
    applyDefaults();
    setMode('charge');

    EF.widgets.push({
      name: 'battery-calculator',
      onResize:      function () {},
      onThemeChange: function () {},
      getState:      function () {
        return {
          mode: currentMode,
          charge: {
            capacity_mAh: chargeCap.value, start_pct: chargeStart.value,
            target_pct: chargeTgt.value,   kind: chargeKind.value,
            I_A: chargeI.value, P_W: chargeP.value,
            V: chargeV.value,   eff_pct: chargeEff.value
          },
          runtime: {
            capacity_mAh: runCap.value, V: runV.value,
            kind: runKind.value, I_A: runI.value, P_W: runP.value
          },
          capacity: { I_mA: capI.value, time_h: capTime.value },
          soc:      { chemistry: socChem.value, V: socV.value }
        };
      },
      reset: function () {
        applyDefaults();
        setMode('charge');
      },
      restoreState: function (snap) {
        if (!snap) return;
        var c = snap.charge || {};
        if (c.capacity_mAh != null) chargeCap.value   = c.capacity_mAh;
        if (c.start_pct    != null) chargeStart.value = c.start_pct;
        if (c.target_pct   != null) chargeTgt.value   = c.target_pct;
        if (c.kind         != null) chargeKind.value  = c.kind;
        if (c.I_A          != null) chargeI.value     = c.I_A;
        if (c.P_W          != null) chargeP.value     = c.P_W;
        if (c.V            != null) chargeV.value     = c.V;
        if (c.eff_pct      != null) chargeEff.value   = c.eff_pct;
        syncChargeKindRow();
        var r = snap.runtime || {};
        if (r.capacity_mAh != null) runCap.value  = r.capacity_mAh;
        if (r.V            != null) runV.value    = r.V;
        if (r.kind         != null) runKind.value = r.kind;
        if (r.I_A          != null) runI.value    = r.I_A;
        if (r.P_W          != null) runP.value    = r.P_W;
        syncRunKindRow();
        var cap = snap.capacity || {};
        if (cap.I_mA   != null) capI.value    = cap.I_mA;
        if (cap.time_h != null) capTime.value = cap.time_h;
        var s = snap.soc || {};
        if (s.chemistry != null) socChem.value = s.chemistry;
        if (s.V         != null) socV.value    = s.V;
        setMode(snap.mode || 'charge');
      }
    });
  }

  EF._registerSection('battery-calculator', initBatteryCalculator);
})();
