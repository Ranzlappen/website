/* ============================================================================
   electronics-components.js — Sections 4, 5, 6 + page chrome
   ----------------------------------------------------------------------------
   * Section 4 — Visual Component Lab
       - Resistor Color-Code Decoder
       - E-Series Standard Values
       - Live Resistor Preview (SVG, mirrors decoder bands)
       - E-Series Value Cloud (popularity-tier classes)
       - Tolerance-chart toggle
   * Section 5 — Circuit Design Guides
   * Section 6 — Reference Tables
   * Page chrome — Sticky TOC, Floating Reset All, Bookmark/Share injector

   Depends on electronics-utils.js + electronics-widget-core.js.
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;
  var EF = window.ElectronicsFundamentals;
  if (!EF || typeof EF._registerSection !== 'function') return;

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
        EF.copyWithFlash(copyBtn, text).then(function (ok) {
          if (!ok) setWarning('Clipboard copy failed — your browser may block it on insecure pages.');
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
        var wheel = EF.findWidgetByName('quick-reference-wheel');
        if (wheel && typeof wheel.setValues === 'function') {
          wheel.setValues(values, { scroll: true });
          // eslint-disable-next-line no-console
          console.log('🎨 Color decoder → Quick Wheel:', values);
        }
      });
    }

    // ----- Mini chart: tolerance-grade comparison -----
    // chartTheme delegated to EF.chartTheme (Batch 6 deduplication).
    var chartTheme = EF.chartTheme;

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
          animation: EF.prefersReducedMotion() ? false : { duration: 200 },
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

    // Build the bands picker + run text-only recompute immediately so the
    // value / tolerance / range readouts and the CSS tolerance bar work
    // even before Chart.js / the mini-chart appears.
    buildBands();
    recompute();

    EF.ensureChartJs().then(function () {
      var wrapper = canvas && canvas.parentElement;
      if (!wrapper || !EF.LazyChartManager || typeof EF.LazyChartManager.register !== 'function') {
        buildChart(); recompute();
        return;
      }
      EF.LazyChartManager.register('resistor-tolerance-chart', wrapper, {
        build: function () { buildChart(); recompute(); return chart; },
        pause: function () {
          if (chart && typeof chart.destroy === 'function') { chart.destroy(); chart = null; }
        },
        resume: function () { buildChart(); recompute(); return chart; }
      });
    }, function () {
      setWarning('Mini-chart unavailable (Chart.js blocked or offline). Decoder still works.');
    });

    // Batch 8 — common-values preset row. Each button carries a comma-
    // separated `data-rcd-preset` of color keys (4 or 5 colors). Clicking
    // applies the preset by setting the band-mode radio, swapping colors,
    // rebuilding bands, and recomputing.
    var presetRoot = document.getElementById('electronics-rcd-presets');
    if (presetRoot) {
      var presetBtns = presetRoot.querySelectorAll('.electronics-rcd-presets__btn');
      function syncPresetActive() {
        var current = bandColors.join(',');
        Array.prototype.forEach.call(presetBtns, function (b) {
          var match = (b.getAttribute('data-rcd-preset') || '') === current;
          b.classList.toggle('is-active', match);
          b.setAttribute('aria-pressed', match ? 'true' : 'false');
        });
      }
      Array.prototype.forEach.call(presetBtns, function (btn) {
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', function () {
          var seq = (btn.getAttribute('data-rcd-preset') || '').split(',')
            .map(function (s) { return s.trim(); }).filter(Boolean);
          if (seq.length !== 4 && seq.length !== 5) return;
          // Validate every color exists in COLORS — drop the apply silently
          // if the data island doesn't define one of them (defensive).
          for (var i = 0; i < seq.length; i++) {
            if (!COLORS[seq[i]]) {
              setWarning('Preset references unknown color "' + seq[i] + '".');
              return;
            }
          }
          bandCount = seq.length;
          bandColors = seq.slice();
          // Sync the band-count radio so the rest of the widget agrees.
          Array.prototype.forEach.call(modeRadios, function (r) {
            r.checked = (r.value === String(bandCount));
          });
          buildBands();
          recompute();
          syncPresetActive();
        });
      });
      // Wrap recompute to keep the active highlight in sync after every
      // change (manual swatch click, reset, restoreState, etc.).
      var _origRecompute = recompute;
      recompute = function () { _origRecompute(); syncPresetActive(); };
      syncPresetActive();
    }

    EF.widgets.push({
      name: 'resistor-color-decoder',
      onResize: function () { if (chart) chart.resize(); },
      onThemeChange: applyChartTheme,
      getState: function () {
        var r = compute();
        return {
          bandCount: bandCount,
          bandColors: bandColors.slice(),
          nominal: r ? r.nominal : null,
          tolerance: r ? r.tolerance : null
        };
      },
      reset: function () { if (resetBtn) resetBtn.click(); }
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
        // Render each value as a real <button> so SR users can tab to it,
        // arrow-key around the cloud, and Enter/Space to copy. Click copies
        // the formatted mantissa to the clipboard — a quick lookup workflow
        // that doesn't disturb the closest-finder state.
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'electronics-eseries-value';
        chip.setAttribute('data-value', label);
        chip.textContent = label;
        var ariaLabel = activeKey + ' ' + label;
        if (closestMantissa !== null && Math.abs(v - closestMantissa) < 1e-4) {
          chip.classList.add('is-closest');
          chip.setAttribute('aria-current', 'true');
          ariaLabel += ' — closest match';
        }
        chip.setAttribute('aria-label', ariaLabel);
        chip.addEventListener('click', function () {
          EF.copyWithFlash(chip, label, { label: '✓', ms: 800 });
        });
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

  // ==========================================================================
  // Page-level enhancement widgets (Batch 9.8)
  //   These are page-scoped chrome — TOC, floating reset, bookmark injector,
  //   live resistor preview, E-series cloud, tolerance-chart toggle. Each is
  //   registered through the same EF.registerWidget factory so they get the
  //   uniform mount lifecycle.
  // ==========================================================================

  // --------------------------------------------------------------------------
  // initStickyToc — IntersectionObserver-driven scroll-spy TOC.
  //   The aside is rendered once in HTML; this hook just wires up the
  //   active-link highlighting + smooth-scroll behaviour.
  // --------------------------------------------------------------------------
  function initStickyToc() {
    var toc = document.getElementById('electronics-toc');
    if (!toc) return;
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    if (!links.length) return;

    var sections = links.map(function (a) {
      var id = a.getAttribute('href').slice(1);
      return { link: a, target: document.getElementById(id) };
    }).filter(function (entry) { return entry.target; });

    function setActive(id) {
      sections.forEach(function (s) {
        var on = s.link.getAttribute('href') === '#' + id;
        s.link.classList.toggle('is-active', on);
        s.link.setAttribute('aria-current', on ? 'true' : 'false');
      });
    }

    // Scroll-spy is a progressive enhancement: without IntersectionObserver
    // we still wire the click-to-scroll handler below, just no live highlight.
    if (typeof IntersectionObserver !== 'undefined' && sections.length) {
      var observer = new IntersectionObserver(function (entries) {
        // Pick the entry closest to the top of the viewport that's visible.
        var top = null;
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          if (!top || e.boundingClientRect.top < top.boundingClientRect.top) top = e;
        });
        if (top && top.target.id) setActive(top.target.id);
      }, { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.1, 0.5, 1] });

      sections.forEach(function (s) { observer.observe(s.target); });
      if (sections[0]) setActive(sections[0].target.id);
      EF.widgets.push({
        name: 'sticky-toc-observer',
        destroy: function () { try { observer.disconnect(); } catch (_) { /* ignore */ } }
      });
    } else if (sections[0]) {
      // Static highlight on the first link as a sane default.
      setActive(sections[0].target.id);
    }

    // Smooth-scroll fallback for browsers without scroll-behavior: smooth.
    // EF.scrollIntoView honours prefers-reduced-motion automatically.
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        EF.scrollIntoView(target, { block: 'start' });
        history.pushState(null, '', '#' + id);
      });
    });
  }

  // --------------------------------------------------------------------------
  // initFloatingResetAll — bottom-right pill that triggers EF.resetAllWidgets().
  //   Shown only after the visitor scrolls past the hero so it doesn't
  //   compete with the disclaimer / "How to use" text.
  // --------------------------------------------------------------------------
  function initFloatingResetAll() {
    var btn = document.getElementById('electronics-reset-all-floating');
    if (!btn) return;
    var hero = document.querySelector('.electronics-hero');
    var observer = null;
    var firstReveal = true;
    function reveal(visible) {
      // The hero observer reports "visible" while the hero IS on-screen, so
      // we hide the pill in that case and reveal otherwise.
      btn.hidden = visible;
      if (!visible && firstReveal) {
        firstReveal = false;
        // Subtle pulse the FIRST time the pill appears so the user notices
        // the new global control without it being annoying. CSS handles the
        // animation (.is-pulsing) and respects prefers-reduced-motion.
        btn.classList.add('is-pulsing');
        setTimeout(function () { btn.classList.remove('is-pulsing'); }, 3200);
      }
    }
    if (!hero || typeof IntersectionObserver === 'undefined') {
      // Fallback: always visible so the button isn't lost.
      reveal(false);
    } else {
      observer = new IntersectionObserver(function (entries) {
        var visible = entries[0] ? entries[0].isIntersecting : true;
        reveal(visible);
      }, { threshold: 0 });
      observer.observe(hero);
    }
    btn.addEventListener('click', function () {
      // Custom focus-trapping ARIA dialog — replaces window.confirm() so the
      // page styling stays intact and screen readers get a proper modal.
      var prompt = EF.confirmModal({
        title: 'Reset every calculator?',
        message: 'This will return every calculator on this page (Ohm’s Law, LED, Divider, S/P, RC, Color Decoder, Quick Wheel) to its default values. Bookmarks and the URL hash are not cleared.',
        confirmText: 'Reset all',
        cancelText: 'Cancel',
        dangerous: true
      });
      prompt.then(function (ok) {
        if (!ok) return;
        EF.resetAllWidgets();
        // Brief affordance so the user knows the click registered.
        var prev = btn.textContent;
        btn.textContent = '✓ Reset';
        setTimeout(function () { btn.textContent = prev; }, 1100);
      });
    });
    if (observer) {
      EF.widgets.push({
        name: 'floating-reset-observer',
        destroy: function () { try { observer.disconnect(); } catch (_) { /* ignore */ } }
      });
    }
  }

  // --------------------------------------------------------------------------
  // initBookmarkInjector — finds every .electronics-ohms-actions row inside
  // a registered widget's card and injects a "Bookmark" button. Click stores
  // widget.getState() in localStorage + URL hash via EF.Bookmark.save.
  // --------------------------------------------------------------------------
  function initBookmarkInjector() {
    // Map: actions row → widget name. We discover the widget name by walking
    // up to the nearest [id^="electronics-"] container and matching against
    // EF.widgets entries. Falls back to the container's id otherwise. We
    // accept BOTH `.electronics-ohms-actions` (the 5 calculator cards) and
    // `.electronics-wheel-actions` (the Quick Wheel) so the wheel also gets
    // bookmark + share buttons.
    var actionRows = document.querySelectorAll(
      '.electronics-ohms-actions, .electronics-wheel-actions'
    );

    // Container DOM ids ↔ EF.widgets entry names. Kept as an explicit map
    // because the two namespaces don't share clean substrings (e.g. the wheel
    // sits in #electronics-quick-reference but registers as "quick-reference-
    // wheel"), so a heuristic substring search would miss the wheel and
    // mis-match neighbours.
    var ID_TO_WIDGET = {
      'electronics-quick-reference': 'quick-reference-wheel',
      'electronics-calc-ohms':       'ohms-law-calculator',
      'electronics-calc-led':        'led-resistor-calculator',
      'electronics-calc-divider':    'voltage-divider-calculator',
      'electronics-calc-sp':         'series-parallel-calculator',
      'electronics-calc-rc':         'rc-timer-calculator',
      'electronics-rcd-card':        'resistor-color-decoder'
    };

    // Pre-register every widget's container with EF.Bookmark so
    // restoreFromHash can scroll to it even when no bookmark button got
    // injected (e.g. the wheel before this batch).
    if (typeof EF.Bookmark.registerContainer === 'function') {
      Object.keys(ID_TO_WIDGET).forEach(function (id) {
        var card = document.getElementById(id);
        if (card) EF.Bookmark.registerContainer(ID_TO_WIDGET[id], card);
      });
    }

    if (!actionRows.length) return;

    function widgetNameForRow(row) {
      var node = row;
      while (node && node !== document.body) {
        if (node.id && ID_TO_WIDGET[node.id]) return ID_TO_WIDGET[node.id];
        node = node.parentNode;
      }
      return null;
    }

    function findWidgetEntry(name) {
      for (var i = 0; i < EF.widgets.length; i++) {
        if (EF.widgets[i].name === name) return EF.widgets[i];
      }
      return null;
    }

    /** Build a result label that surfaces quota errors visibly, instead of
     *  silently failing to localStorage. EF.Bookmark.save now returns true
     *  whenever the URL hash was updated (which is enough to re-load), but
     *  exposes EF.Bookmark.lastResult.{persisted, hashed, quotaExceeded} so
     *  we can tell the user which strand actually worked. */
    function summariseSave(savedFlag) {
      var r = EF.Bookmark.lastResult || {};
      if (!savedFlag && !r.hashed && !r.persisted) return '⚠ Save failed';
      if (r.quotaExceeded && r.hashed)  return '✓ URL saved (storage full)';
      if (r.quotaExceeded && !r.hashed) return '⚠ Storage full';
      if (r.hashed && r.persisted)      return '✓ Saved (URL + storage)';
      if (r.hashed)                     return '✓ Saved to URL';
      if (r.persisted)                  return '✓ Saved (URL pending)';
      return '⚠ Save failed';
    }

    Array.prototype.forEach.call(actionRows, function (row) {
      // Don't double-inject if we re-run this function.
      if (row.querySelector('.electronics-bookmark-btn')) return;
      var name = widgetNameForRow(row);
      if (!name) return;

      // Hint to EF.Bookmark.restoreFromHash about which DOM node to scroll to.
      var card = row.closest('[id^="electronics-"]') || row.parentNode;
      if (card && typeof EF.Bookmark.registerContainer === 'function') {
        EF.Bookmark.registerContainer(name, card);
      }

      // ----- 🔖 Bookmark — saves to localStorage + URL hash. -----
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'electronics-calculator__reset electronics-bookmark-btn';
      btn.textContent = '🔖 Bookmark';
      btn.setAttribute('aria-label', 'Bookmark current values for ' + name);
      btn.addEventListener('click', function () {
        var entry = findWidgetEntry(name);
        if (!entry || typeof entry.getState !== 'function') {
          // eslint-disable-next-line no-console
          console.warn('Cannot bookmark "' + name + '" — no getState() available.');
          return;
        }
        var state = entry.getState();
        var ok = EF.Bookmark.save(name, state);
        btn.textContent = summariseSave(ok);
        setTimeout(function () { btn.textContent = '🔖 Bookmark'; }, 2200);
      });
      row.appendChild(btn);

      // ----- 🔗 Share — Batch 8: opens a popup with the URL pre-selected
      // for copy-paste AND a small QR code. Bookmark stays the "I'll come
      // back to this myself" flow; Share is "send to a friend / phone".
      var shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'electronics-calculator__reset electronics-share-btn';
      shareBtn.textContent = '🔗 Share';
      shareBtn.setAttribute('aria-label', 'Share current ' + name + ' state — copy URL or scan QR');
      shareBtn.addEventListener('click', function () {
        var entry = findWidgetEntry(name);
        if (!entry || typeof entry.getState !== 'function') return;
        var state = entry.getState();
        var saved = EF.Bookmark.save(name, state);
        var r = EF.Bookmark.lastResult || {};
        if (!saved || !r.hashed) {
          shareBtn.textContent = r.quotaExceeded ? '⚠ Storage full' : '⚠ Save failed';
          setTimeout(function () { shareBtn.textContent = '🔗 Share'; }, 2200);
          return;
        }
        var url = window.location.href;
        // Body content for the modal: pre-selected URL input + QR canvas.
        var body = document.createElement('div');
        body.className = 'electronics-share-popup';

        var popupRow = document.createElement('div');
        popupRow.className = 'electronics-share-popup__row';

        // QR — falls back to a "scan via URL" hint if generation fails
        // (e.g. URL too long for v1-9 byte mode).
        var qrWrap = document.createElement('div');
        qrWrap.className = 'electronics-share-popup__qr';
        var qr = null;
        try { qr = EF.makeQrCanvas(url, 4); } catch (_) { qr = null; }
        if (qr) qrWrap.appendChild(qr);
        else    qrWrap.textContent = 'QR unavailable for this URL length';

        var urlBox = document.createElement('div');
        urlBox.className = 'electronics-share-popup__url';
        var urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.readOnly = true;
        urlInput.value = url;
        urlInput.setAttribute('aria-label', 'Shareable URL');
        urlInput.addEventListener('focus', function () { urlInput.select(); });

        var copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'electronics-calculator__reset';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', function () {
          EF.copyToClipboard(url).then(function (ok) {
            copyBtn.textContent = ok ? '✓ Copied' : '⚠ Copy failed';
            setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1600);
          });
        });
        urlBox.appendChild(urlInput);
        urlBox.appendChild(copyBtn);

        popupRow.appendChild(qrWrap);
        popupRow.appendChild(urlBox);
        body.appendChild(popupRow);

        var hint = document.createElement('p');
        hint.className = 'electronics-share-popup__hint';
        hint.textContent = qr
          ? 'Scan the QR with a phone, or copy the URL above. The state is encoded in the # of the URL — bookmarks and history capture it automatically.'
          : 'Copy the URL above to share. The state is encoded in the # of the URL.';
        body.appendChild(hint);

        EF.confirmModal({
          title: '🔗 Share this ' + name.replace(/-/g, ' '),
          bodyNode: body,
          variant: 'info',
          confirmText: 'Done',
          hideCancel: true
        });
        // Auto-select the URL on open so the user can hit ⌘C / Ctrl+C
        // without an extra click.
        setTimeout(function () { try { urlInput.select(); } catch (_) {} }, 50);
      });
      row.appendChild(shareBtn);
    });
  }

  // --------------------------------------------------------------------------
  // initLiveResistorPreview — renders an SVG resistor whose stripe colors
  // mirror the Color-Code Decoder's current band selection. Watches the
  // decoder's swatch palette via MutationObserver so we don't have to reach
  // into the decoder's closure.
  // --------------------------------------------------------------------------
  function initLiveResistorPreview() {
    var preview = document.getElementById('electronics-rcd-resistor-svg');
    var bandsRoot = document.getElementById('electronics-rcd-bands');
    if (!preview || !bandsRoot) return;
    var data = EF.readDataIsland('electronics-rcd-data');
    var COLORS = data && data.colors ? data.colors : {};

    function readBandColors() {
      var bands = bandsRoot.querySelectorAll('.electronics-rcd-band');
      var out = [];
      Array.prototype.forEach.call(bands, function (band) {
        var active = band.querySelector('.electronics-rcd-swatch.is-active');
        if (active) out.push(active.getAttribute('data-color'));
      });
      return out;
    }

    function render() {
      var colors = readBandColors();
      if (!colors.length) return;
      // Body width 200, height 40, centered. Stripe positions distributed
      // across the body interior with the tolerance band pulled toward the
      // right end (real-resistor convention).
      var bodyX = 50;
      var bodyW = 200;
      var stripeW = 14;
      var n = colors.length;
      var startGap = 28;        // gap from left body edge to first stripe
      var tolGap   = 28;        // gap from last digit/multiplier to tolerance
      var availW = bodyW - startGap - tolGap;
      var dataBands = n - 1;    // every band except tolerance
      var step = dataBands > 1 ? availW / (dataBands - 1) : 0;

      var stripes = colors.map(function (key, i) {
        var c = COLORS[key];
        var fill = (c && c.hex) ? c.hex : '#888';
        var x;
        if (i === n - 1) {
          // Tolerance band — pulled to the right edge area.
          x = bodyX + bodyW - tolGap - (stripeW / 2);
        } else {
          x = bodyX + startGap + step * i - (stripeW / 2);
        }
        // Stripes (y=16, height=28 → 16…44) sit centred on viewBox y=30,
        // matching the body and lead-line midline.
        return '<rect x="' + x.toFixed(1) + '" y="16" width="' + stripeW +
               '" height="28" fill="' + fill + '" />';
      }).join('');

      // Geometry (Batch 5 centring fix). The SVG viewBox is 0 0 300 60.
      //   * Lead lines run along the vertical midline at y=30.
      //   * Resistor body is y=14…46 (height 32, centred on y=30).
      //   * Stripes are y=16…44 (height 28, centred on y=30, see above).
      preview.innerHTML =
        '<line x1="0"   y1="30" x2="50"  y2="30" stroke="currentColor" stroke-width="2" />' +
        '<line x1="250" y1="30" x2="300" y2="30" stroke="currentColor" stroke-width="2" />' +
        '<rect x="50" y="14" width="200" height="32" rx="4" ry="4" fill="#d6c19a" stroke="rgba(0,0,0,0.35)" stroke-width="1" />' +
        stripes;

      // Inject (or refresh) accessible <title>/<desc> describing the current
      // band sequence. describeSvg is idempotent: if the title already exists
      // we update its text in place rather than spawn a duplicate.
      var titleEl = preview.querySelector(':scope > title');
      var descEl  = preview.querySelector(':scope > desc');
      var humanColors = colors.map(function (k) {
        var c = COLORS[k];
        return (c && c.name) ? c.name : k;
      }).join(', ');
      var titleText = 'Resistor preview, ' + colors.length + ' bands';
      var descText  = 'Stripe colors from left to right: ' + humanColors + '.';
      if (titleEl) titleEl.textContent = titleText;
      if (descEl)  descEl.textContent  = descText;
      if (!titleEl && !descEl && typeof EF.describeSvg === 'function') {
        EF.describeSvg(preview, titleText, descText);
      }
    }

    // Re-render when any swatch in the decoder is clicked OR the band-count
    // toggle rebuilds the bands.
    var observer = new MutationObserver(function () { render(); });
    observer.observe(bandsRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    render();

    // Disconnect the observer if the page tears the widget down (SPA-style
    // hot-reloads, future EF.unmountAllWidgets).
    EF.widgets.push({
      name: 'live-resistor-preview',
      destroy: function () { try { observer.disconnect(); } catch (_) { /* ignore */ } }
    });
  }

  // --------------------------------------------------------------------------
  // initESeriesValueCloud — adds popularity-derived font-size classes to the
  // E-series chips so values that appear in multiple series stand out as a
  // "tag cloud". Watches the grid for changes (tab switches, search filter).
  // --------------------------------------------------------------------------
  function initESeriesValueCloud() {
    var grid = document.getElementById('electronics-eseries-grid');
    if (!grid) return;
    var data = EF.readDataIsland('electronics-eseries-data');
    if (!data || !data.series) return;

    // popularity[mantissa] = count of series the value belongs to (1..4).
    var popularity = {};
    Object.keys(data.series).forEach(function (key) {
      data.series[key].forEach(function (v) {
        var rounded = Math.round(v * 100) / 100;
        popularity[rounded] = (popularity[rounded] || 0) + 1;
      });
    });

    function applyCloudClasses() {
      var chips = grid.querySelectorAll('.electronics-eseries-value');
      Array.prototype.forEach.call(chips, function (chip) {
        var n = parseFloat(chip.textContent);
        if (!isFinite(n)) return;
        var rounded = Math.round(n * 100) / 100;
        var pop = popularity[rounded] || 1;
        // 1 → tier-1 (smallest), 4 → tier-4 (largest).
        chip.classList.remove(
          'electronics-eseries-value--t1',
          'electronics-eseries-value--t2',
          'electronics-eseries-value--t3',
          'electronics-eseries-value--t4'
        );
        chip.classList.add('electronics-eseries-value--t' + pop);
      });
    }

    var observer = new MutationObserver(function () { applyCloudClasses(); });
    observer.observe(grid, { childList: true, subtree: false });
    applyCloudClasses();

    EF.widgets.push({
      name: 'eseries-value-cloud',
      destroy: function () { try { observer.disconnect(); } catch (_) { /* ignore */ } }
    });
  }

  // --------------------------------------------------------------------------
  // initToleranceChartToggle — turns Section 4's tolerance Chart.js into an
  // opt-in feature. Default: hidden (CSS fallback bars visible). Click the
  // toggle to lazy-build the chart via EF.LazyChartManager.
  // --------------------------------------------------------------------------
  function initToleranceChartToggle() {
    var toggle = document.getElementById('electronics-rcd-chart-toggle');
    var wrapper = document.querySelector('.electronics-rcd-chart-wrapper');
    var fallback = document.getElementById('electronics-rcd-chart-fallback');
    if (!toggle || !wrapper) return;

    // Hide the canvas wrapper by default; the existing widget's chart build
    // path stays untouched but becomes a no-op (its query selector returns a
    // hidden element which Chart.js still renders into; that's fine, it's
    // just not visible). We toggle .is-shown to display.
    function setShown(shown) {
      wrapper.classList.toggle('is-shown', shown);
      if (fallback) fallback.classList.toggle('is-hidden', shown);
      toggle.setAttribute('aria-pressed', shown ? 'true' : 'false');
      toggle.textContent = shown ? '📊 Chart on' : '📊 Show chart';
      // When showing for the first time, force a Chart.js resize so it
      // measures the now-visible parent correctly.
      if (shown) {
        for (var i = 0; i < EF.widgets.length; i++) {
          if (EF.widgets[i].name === 'resistor-color-decoder' &&
              typeof EF.widgets[i].onResize === 'function') {
            try { EF.widgets[i].onResize(); } catch (_) { /* ignore */ }
          }
        }
      }
    }

    setShown(false);
    toggle.addEventListener('click', function () {
      var shown = !wrapper.classList.contains('is-shown');
      setShown(shown);
    });
  }

  // --------------------------------------------------------------------------
  // initHelpTrigger — Batch 8 delight. Reveals the "?" help button in the
  // hero (kept hidden in HTML so it only appears when JS is alive) and
  // opens a keyboard-shortcuts overlay via EF.confirmModal({ variant:'info',
  // hideCancel:true, bodyNode }). Keyboard short-cut: Shift+? from anywhere
  // outside an editable element.
  // --------------------------------------------------------------------------
  function initHelpTrigger() {
    var trigger = document.getElementById('electronics-help-trigger');
    if (!trigger) return;
    trigger.hidden = false;

    function buildShortcutList() {
      // Document the user-facing shortcuts that already exist on this page,
      // plus the new Shift+? to reopen this overlay. Keep the list small and
      // accurate — listing nothing is better than listing wrong shortcuts.
      var entries = [
        { keys: ['Shift', '?'],         desc: 'Open this shortcut overlay' },
        { keys: ['Tab'],                desc: 'Cycle through inputs / wheel quadrants / buttons' },
        { keys: ['Enter', 'Space'],     desc: 'Activate the focused button or wheel quadrant' },
        { keys: ['Esc'],                desc: 'Dismiss any open dialog (this overlay, Reset All confirm)' },
        { keys: ['1', '2', '3', '4'],   desc: 'Resistor decoder — focus the corresponding band when one is focused' }
      ];
      var dl = document.createElement('dl');
      dl.className = 'electronics-shortcut-list';
      entries.forEach(function (e) {
        var dt = document.createElement('dt');
        e.keys.forEach(function (k, idx) {
          if (idx > 0) dt.appendChild(document.createTextNode(' '));
          var kbd = document.createElement('kbd');
          kbd.textContent = k;
          dt.appendChild(kbd);
        });
        var dd = document.createElement('dd');
        dd.textContent = e.desc;
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
      var hint = document.createElement('p');
      hint.style.margin = '1rem 0 0';
      hint.style.fontSize = '0.85rem';
      hint.style.color = 'var(--c-text-muted)';
      hint.textContent = 'Tip — every calculator has Bookmark, Share, and Reset buttons; ' +
        'a global "Reset all" pill appears at the bottom-right after you scroll past the hero.';
      var wrap = document.createElement('div');
      wrap.appendChild(dl);
      wrap.appendChild(hint);
      return wrap;
    }

    function openOverlay() {
      EF.confirmModal({
        title: 'Keyboard shortcuts & tips',
        bodyNode: buildShortcutList(),
        variant: 'info',
        confirmText: 'Got it',
        hideCancel: true
      });
    }

    trigger.addEventListener('click', openOverlay);

    // Global Shift+? — only when the user isn't typing in an input.
    function onKey(e) {
      if (e.key !== '?' || !e.shiftKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      openOverlay();
    }
    document.addEventListener('keydown', onKey);

    EF.widgets.push({
      name: 'help-trigger',
      destroy: function () { document.removeEventListener('keydown', onKey); }
    });
  }

  EF._registerSection('resistor-color-decoder',  initResistorColorDecoder);
  EF._registerSection('e-series-explorer',       initESeriesExplorer);
  EF._registerSection('design-guides-section',   initDesignGuides);
  EF._registerSection('reference-tables-section',initReferenceTables);
  EF._registerSection('live-resistor-preview',   initLiveResistorPreview);
  EF._registerSection('eseries-value-cloud',     initESeriesValueCloud);
  EF._registerSection('tolerance-chart-toggle',  initToleranceChartToggle);
  EF._registerSection('sticky-toc',              initStickyToc);
  EF._registerSection('floating-reset-all',      initFloatingResetAll);
  EF._registerSection('bookmark-injector',       initBookmarkInjector);
  EF._registerSection('help-trigger',            initHelpTrigger);
})();
