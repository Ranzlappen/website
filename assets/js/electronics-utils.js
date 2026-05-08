/* ============================================================================
   electronics-utils.js — utility functions + EF namespace bootstrap
   ----------------------------------------------------------------------------
   First file of the modular electronics-fundamentals JS bundle (Intermission
   Batch 2). Creates window.ElectronicsFundamentals (alias `EF`) and seeds
   it with the shared utilities (debounce, copyToClipboard,
   formatNumberWithUnits, readDataIsland, sanitizeInput) plus the
   theme/resize plumbing every widget hooks into.

   Load order (each file is its own IIFE, safe to load on any page):
     1. electronics-utils.js                  ← THIS FILE
     2. electronics-widget-core.js            (Widget/Kernel/registry/Lazy/Bookmark/ChartJS)
     3. electronics-quick-wheel.js
     4. electronics-formulas.js
     5. electronics-ohms-calculator.js
     6. electronics-led-divider-calculators.js
     7. electronics-sp-rc-calculators.js
     8. electronics-components.js
     9. electronics-fundamentals.js           (entry point — calls EF.mountAllWidgets)
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;

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

  /** Format a numeric value with an SI prefix (12000 → "12 kΩ", 0.0047 →
   *  "4.7 mΩ"). Caller picks the unit suffix. */
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

  /** Strict input sanitiser. Coerces a raw <input>.value (or any string /
   *  number) into a finite number; returns NaN for empty / null / non-numeric
   *  / ±Infinity inputs. Single source of truth across every calculator. */
  function sanitizeInput(raw) {
    if (raw === null || raw === undefined) return NaN;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
    var trimmed = String(raw).trim();
    if (trimmed === '') return NaN;
    var num = parseFloat(trimmed);
    return Number.isFinite(num) ? num : NaN;
  }

  // ==========================================================================
  // Shared widget helpers (Batch 6 deduplication)
  //   Every helper below was previously defined inline in two or more
  //   per-section files. They live here now so each section file calls
  //   EF.foo() instead of carrying its own copy.
  // ==========================================================================

  /** Walk the EF.widgets registry and return the entry whose name matches.
   *  Used by every "Open in Quick Wheel" button + the Bookmark restore path
   *  + initFormulasSection's Try-it dispatcher. Replaces ad-hoc for-loops
   *  scattered through six init functions. */
  function findWidgetByName(name) {
    if (!name) return null;
    for (var i = 0; i < EF.widgets.length; i++) {
      if (EF.widgets[i] && EF.widgets[i].name === name) return EF.widgets[i];
    }
    return null;
  }

  /** Solve Ohm's law from a 2-element `known` array
   *    [{ name: 'V', value: 12 }, { name: 'R', value: 100 }]
   *  Returns:
   *    { values: { V, I, R, P } }                        on success
   *    { error: 'Cannot derive R: …' }                   on domain violation
   *    { partial: true, values: {…} }                    when P=R=0 (under-
   *                                                      determined but valid)
   *
   *  Single shared implementation — was duplicated verbatim in the Quick
   *  Wheel and the Ohm's Law calculator before this batch. EPSILON is the
   *  divide-by-zero threshold matching typical hobby-grade meter resolution
   *  (1 µV / 1 µA / 1 µΩ). */
  function solveOhmsLaw(known) {
    var EPSILON = 1e-9;
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

  /** Clamp `value` to `slider`'s min/max and write it. No-op if value isn't
   *  finite or the slider doesn't exist. Replaces the per-calc syncSlider /
   *  syncSliderFromValue helpers in Ohm's, LED, Voltage Divider, RC Timer. */
  function syncSliderToValue(slider, value) {
    if (!slider || !Number.isFinite(value)) return;
    var min = parseFloat(slider.min);
    var max = parseFloat(slider.max);
    slider.value = String(Math.max(min, Math.min(max, value)));
  }

  /** Unified Chart.js theme palette derived from the live CSS custom
   *  properties on `<html>`. Returns the *superset* of keys any chart on the
   *  page asks for (grid / axis / angle / ticks / label / accent / fill /
   *  stroke / point / marker / loaded / bars / curveColors). Sections pick
   *  whichever they need; unused keys are harmless.
   *
   *  Replaces seven per-file `chartTheme()` definitions that all read the
   *  same CSS variables and returned overlapping shapes. */
  function chartTheme() {
    var styles = (typeof window !== 'undefined' && window.getComputedStyle)
      ? getComputedStyle(document.documentElement)
      : null;
    var dark = EF.theme !== 'light';
    function v(name, fb) {
      if (!styles) return fb;
      var raw = styles.getPropertyValue(name);
      raw = raw ? raw.trim() : '';
      return raw || fb;
    }
    return {
      grid:   dark ? 'rgba(220, 232, 226, 0.10)' : 'rgba(26, 42, 34, 0.10)',
      axis:   dark ? 'rgba(220, 232, 226, 0.18)' : 'rgba(26, 42, 34, 0.20)',
      angle:  dark ? 'rgba(220, 232, 226, 0.18)' : 'rgba(26, 42, 34, 0.20)',
      ticks:  v('--c-text-muted', dark ? '#7e948a' : '#5a7068'),
      label:  v('--c-text',       dark ? '#dce8e2' : '#1a2a22'),
      accent: v('--c-accent',     '#4ade80'),
      fill:   'rgba(74, 222, 128, 0.22)',
      stroke: '#4ade80',
      point:  '#4ade80',
      marker: '#f59e0b',
      loaded: '#f59e0b',
      // Categorical palettes — fixed across themes so individual bars /
      // V-I curves keep their identity when the visitor toggles dark/light.
      curveColors: ['#3b82f6', '#a78bfa', '#f59e0b', '#ef4444'],
      bars:        ['#3b82f6', '#a78bfa', '#f59e0b', '#ef4444',
                    '#06b6d4', '#ec4899', '#84cc16', '#eab308']
    };
  }

  /** Copy `text` to the clipboard and flash a success label on the supplied
   *  button (then revert after `ms`). Returns the same Promise<boolean> as
   *  EF.copyToClipboard so the caller can chain a failure-path setWarning.
   *
   *  Replaces the verbose copy-button handlers that were duplicated verbatim
   *  across six calculator cards. */
  function copyWithFlash(btn, text, opts) {
    opts = opts || {};
    var ms = opts.ms || 1400;
    var label = opts.label || 'Copied ✓';
    return copyToClipboard(text).then(function (ok) {
      if (ok && btn) {
        var prev = btn.textContent;
        btn.textContent = label;
        setTimeout(function () { btn.textContent = prev; }, ms);
      }
      return ok;
    });
  }

  /** Smooth-scroll an element into view, honouring prefers-reduced-motion.
   *  When the user opts out of motion, we fall back to behavior: 'auto'
   *  (instant scroll) so the element still becomes visible. */
  function scrollIntoView(el, opts) {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    opts = opts || {};
    var reduced = window.matchMedia &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      behavior: reduced ? 'auto' : (opts.behavior || 'smooth'),
      block:    opts.block    || 'start',
      inline:   opts.inline   || 'nearest'
    });
  }

  /** Inject <title> and (optional) <desc> children into an existing SVG so
   *  screen readers can announce a meaningful description. Idempotent —
   *  calling twice on the same SVG is a no-op. Used for the Quick Wheel
   *  SVG, the resistor-preview SVG, and any future inline SVG.
   *
   *  Also wires aria-labelledby on the <svg> so AT picks up the title. */
  function describeSvg(svg, title, desc) {
    if (!svg || svg.querySelector(':scope > title, :scope > desc')) return;
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var titleId = 'ef-svg-title-' + Math.random().toString(36).slice(2, 9);
    var descId  = 'ef-svg-desc-'  + Math.random().toString(36).slice(2, 9);
    if (title) {
      var t = document.createElementNS(SVG_NS, 'title');
      t.id = titleId;
      t.textContent = title;
      svg.insertBefore(t, svg.firstChild);
    }
    if (desc) {
      var d = document.createElementNS(SVG_NS, 'desc');
      d.id = descId;
      d.textContent = desc;
      var titleEl = svg.querySelector(':scope > title');
      if (titleEl && titleEl.nextSibling) svg.insertBefore(d, titleEl.nextSibling);
      else                                 svg.appendChild(d);
    }
    var ids = [];
    if (title) ids.push(titleId);
    if (desc)  ids.push(descId);
    if (ids.length) {
      // Only set aria-labelledby if the SVG doesn't already carry an
      // aria-label attribute (which takes precedence in some assistive tech).
      // We additively wire the title/desc via aria-describedby so both
      // strands are announceable.
      var existingLabelled = svg.getAttribute('aria-labelledby') || '';
      var existingDescribed = svg.getAttribute('aria-describedby') || '';
      if (title && !svg.getAttribute('aria-label') && existingLabelled.indexOf(titleId) === -1) {
        svg.setAttribute('aria-labelledby', (existingLabelled + ' ' + titleId).trim());
      }
      if (desc && existingDescribed.indexOf(descId) === -1) {
        svg.setAttribute('aria-describedby', (existingDescribed + ' ' + descId).trim());
      }
    }
  }

  /** Walk a calculator card and auto-wire `aria-describedby` on every
   *  numeric input that has a sibling/labelledby <small> unit hint. This
   *  is what each calculator init function calls so screen readers can
   *  announce the unit string ("volts", "ohms", "farads") as a description
   *  of the input independent of its name. Idempotent — skips inputs whose
   *  describedby already covers the small.
   *
   *  Resolution order:
   *    1. If the input has aria-labelledby, take that span and look for a
   *       descendent <small>. Use the FIRST <small> found.
   *    2. Else, look for a <small> within the closest .electronics-ohms-field
   *       or .electronics-calculator__field ancestor. */
  function autoWireUnitHints(card) {
    if (!card || typeof card.querySelectorAll !== 'function') return;
    var inputs = card.querySelectorAll(
      'input[type="number"].electronics-calculator__input, ' +
      'input.electronics-calculator__input[inputmode="decimal"]'
    );
    Array.prototype.forEach.call(inputs, function (input) {
      var small = null;
      var labelledById = input.getAttribute('aria-labelledby');
      if (labelledById) {
        var labelSpan = card.ownerDocument.getElementById(labelledById);
        if (labelSpan) small = labelSpan.querySelector('small');
      }
      if (!small) {
        var field = input.closest('.electronics-ohms-field, .electronics-calculator__field');
        if (field) small = field.querySelector(':scope > .electronics-ohms-field__label small, :scope small');
      }
      if (small) wireInputDescription(input, small);
    });
  }

  /** Wire `input.aria-describedby` to point at `descSpan`. Auto-generates an
   *  id on the description span if it lacks one. Idempotent. Used to link
   *  every numeric calculator input to its small unit-hint span (e.g. the
   *  "volts" / "ohms" / "farads" sub-label). */
  function wireInputDescription(input, descSpan) {
    if (!input || !descSpan) return;
    if (!descSpan.id) {
      descSpan.id = 'ef-aria-desc-' + Math.random().toString(36).slice(2, 9);
    }
    var existing = input.getAttribute('aria-describedby') || '';
    var parts = existing ? existing.split(/\s+/) : [];
    if (parts.indexOf(descSpan.id) === -1) {
      parts.push(descSpan.id);
      input.setAttribute('aria-describedby', parts.join(' '));
    }
  }

  // ==========================================================================
  // makeQrCanvas(text, scale) — minimal QR encoder (Batch 8 Share button).
  //
  // Scope: byte mode, EC level L, single-block versions 1–5 (the highest
  // versions that ship single-block at EC L per spec — versions 6+ need
  // codeword interleaving across multiple blocks which would double the
  // encoder's size). That gives a ~102-byte payload which covers most
  // share URLs this page produces. Longer URLs return null and the share
  // popup falls back to a "QR unavailable for this URL length" hint —
  // the URL is still copyable.
  //
  // Returns a <canvas> element rendered at `scale` pixels per QR module
  // (default 4 → ~148 px QR for v5). Returns null when input is too long.
  //
  // Trade-offs taken to keep the code compact:
  //   * Single-block versions only (no codeword interleaving).
  //   * Iterates all 8 mask patterns and picks the lowest-penalty one
  //     (rule 1: consecutive same-color modules) — simpler than the full
  //     four-rule penalty score but still produces scannable output.
  //   * No alphanumeric / numeric / kanji modes — byte mode encodes
  //     everything.
  //
  // Reference: ISO/IEC 18004 (QR Code 2005). Algorithm transcribed from
  // public-domain QR specs; ~5 KB of source.
  // ==========================================================================
  function makeQrCanvas(text, scale) {
    scale = scale || 4;

    // ---- GF(256) tables, primitive polynomial 0x11D (285) ----
    var EXP = new Array(256);
    var LOG = new Array(256);
    (function () {
      var x = 1;
      for (var i = 0; i < 255; i++) {
        EXP[i] = x; LOG[x] = i;
        x = x << 1; if (x & 0x100) x ^= 0x11D;
      }
      EXP[255] = EXP[0];
    })();
    function gfMul(a, b) { return (a && b) ? EXP[(LOG[a] + LOG[b]) % 255] : 0; }

    // Reed-Solomon generator polynomial of degree `n`.
    function genPoly(n) {
      var g = [1];
      for (var i = 0; i < n; i++) {
        var ng = new Array(g.length + 1);
        for (var j = 0; j < ng.length; j++) ng[j] = 0;
        for (var k = 0; k < g.length; k++) {
          ng[k]     ^= g[k];
          ng[k + 1] ^= gfMul(g[k], EXP[i]);
        }
        g = ng;
      }
      return g;
    }
    function rsEncode(data, ecLen) {
      var g = genPoly(ecLen);
      var buf = data.slice();
      for (var i = 0; i < ecLen; i++) buf.push(0);
      for (var i = 0; i < data.length; i++) {
        var coef = buf[i];
        if (coef !== 0) {
          for (var j = 0; j < g.length; j++) {
            buf[i + j] ^= gfMul(g[j], coef);
          }
        }
      }
      return buf.slice(data.length);
    }

    // EC L, single-block versions 1–5: [data codewords, EC codewords].
    // (Versions 6+ require multi-block interleaving — out of scope here.)
    var EC_L = [
      null,
      [19, 7], [34, 10], [55, 15], [80, 20], [108, 26]
    ];
    // Alignment-pattern centre coordinates per version. v1 has none;
    // v2-5 have a single alignment pattern in the bottom-right.
    var ALIGN = [
      null, [], [6, 18], [6, 22], [6, 26], [6, 30]
    ];

    // ---- UTF-8 encode ----
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) {
        bytes.push(0xC0 | (c >> 6));
        bytes.push(0x80 | (c & 0x3F));
      } else if (c >= 0xD800 && c <= 0xDBFF) {
        var lo = text.charCodeAt(++i);
        var cp = 0x10000 + ((c - 0xD800) << 10) + (lo - 0xDC00);
        bytes.push(0xF0 | (cp >> 18));
        bytes.push(0x80 | ((cp >> 12) & 0x3F));
        bytes.push(0x80 | ((cp >> 6)  & 0x3F));
        bytes.push(0x80 | (cp & 0x3F));
      } else {
        bytes.push(0xE0 | (c >> 12));
        bytes.push(0x80 | ((c >> 6) & 0x3F));
        bytes.push(0x80 | (c & 0x3F));
      }
    }

    // ---- Pick the smallest version that fits ----
    var version = -1;
    for (var v = 1; v <= 5; v++) {
      var needBits = 4 + 8 + 8 * bytes.length;     // mode + length + data
      var capBits  = EC_L[v][0] * 8;
      if (needBits + 4 <= capBits) { version = v; break; }
    }
    if (version === -1) return null;
    var dataCw = EC_L[version][0];
    var ecCw   = EC_L[version][1];
    var size   = 17 + 4 * version;

    // ---- Build bitstream ----
    var bits = [];
    function pushBits(value, n) {
      for (var i = n - 1; i >= 0; i--) bits.push((value >> i) & 1);
    }
    pushBits(0x4, 4);                    // byte mode indicator
    pushBits(bytes.length, 8);           // length (8 bits for v1-9)
    for (var i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);
    var capBits = dataCw * 8;
    var rem = capBits - bits.length;
    pushBits(0, Math.min(4, rem));       // terminator
    while (bits.length % 8) bits.push(0); // byte align
    var pads = [0xEC, 0x11];
    var pi = 0;
    while (bits.length < capBits) { pushBits(pads[pi++ & 1], 8); }
    var dataBytes = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      dataBytes.push(b);
    }
    var ecBytes = rsEncode(dataBytes, ecCw);
    var allBytes = dataBytes.concat(ecBytes);

    // ---- Build module grid ----
    // grid[y][x]: 0 = light, 1 = dark, -1 = unset
    // reserved[y][x]: true if module is reserved (function pattern)
    var grid     = new Array(size);
    var reserved = new Array(size);
    for (var y = 0; y < size; y++) {
      grid[y] = new Array(size);
      reserved[y] = new Array(size);
      for (var x = 0; x < size; x++) {
        grid[y][x] = -1;
        reserved[y][x] = false;
      }
    }
    function setMod(x, y, val) {
      grid[y][x] = val ? 1 : 0;
      reserved[y][x] = true;
    }
    // Finder pattern + separator.
    function placeFinder(cx, cy) {
      for (var dy = -1; dy <= 7; dy++) {
        for (var dx = -1; dx <= 7; dx++) {
          var x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          var on = (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) ||
                   (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6)) ||
                   (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
          setMod(x, y, on ? 1 : 0);
        }
      }
    }
    placeFinder(0, 0); placeFinder(size - 7, 0); placeFinder(0, size - 7);
    // Timing patterns.
    for (var k = 8; k < size - 8; k++) {
      setMod(k, 6, (k & 1) ? 0 : 1);
      setMod(6, k, (k & 1) ? 0 : 1);
    }
    // Dark module (always 1).
    setMod(8, size - 8, 1);
    // Alignment patterns.
    var ap = ALIGN[version];
    for (var ai = 0; ai < ap.length; ai++) {
      for (var aj = 0; aj < ap.length; aj++) {
        var ax = ap[ai], ay = ap[aj];
        // Skip if it overlaps a finder.
        if ((ax === 6 && ay === 6) ||
            (ax === 6 && ay === size - 7) ||
            (ax === size - 7 && ay === 6)) continue;
        for (var dy = -2; dy <= 2; dy++) {
          for (var dx = -2; dx <= 2; dx++) {
            var on = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
            setMod(ax + dx, ay + dy, on ? 1 : 0);
          }
        }
      }
    }
    // Reserve format-info area (filled later).
    for (var i = 0; i <= 8; i++) {
      reserved[8][i] = true; reserved[i][8] = true;
      reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true;
    }

    // ---- Place data bits in zigzag, bottom-right → top-left ----
    var dataBits = [];
    for (var i = 0; i < allBytes.length; i++) {
      for (var j = 7; j >= 0; j--) dataBits.push((allBytes[i] >> j) & 1);
    }
    var di = 0;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--; // skip vertical timing column
      for (var step = 0; step < size; step++) {
        for (var c = 0; c < 2; c++) {
          var x = col - c;
          var upward = ((col + 1) & 2) === 0;
          var y = upward ? (size - 1 - step) : step;
          if (reserved[y][x]) continue;
          grid[y][x] = (di < dataBits.length) ? dataBits[di++] : 0;
        }
      }
    }

    // ---- Mask patterns ----
    function maskFn(m) {
      switch (m) {
        case 0: return function (x, y) { return ((x + y) & 1) === 0; };
        case 1: return function (x, y) { return (y & 1) === 0; };
        case 2: return function (x)    { return (x % 3) === 0; };
        case 3: return function (x, y) { return ((x + y) % 3) === 0; };
        case 4: return function (x, y) { return ((((y / 2) | 0) + ((x / 3) | 0)) & 1) === 0; };
        case 5: return function (x, y) { return ((x * y) & 1) + ((x * y) % 3) === 0; };
        case 6: return function (x, y) { return ((((x * y) & 1) + ((x * y) % 3)) & 1) === 0; };
        case 7: return function (x, y) { return ((((x + y) & 1) + ((x * y) % 3)) & 1) === 0; };
      }
    }
    function applyMask(g, m) {
      var fn = maskFn(m);
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          if (!reserved[y][x] && fn(x, y)) g[y][x] ^= 1;
        }
      }
    }
    // Penalty rule 1: runs of >=5 same-color modules in a row/column.
    function penalty(g) {
      var p = 0;
      for (var y = 0; y < size; y++) {
        var run = 1;
        for (var x = 1; x < size; x++) {
          if (g[y][x] === g[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; }
          else run = 1;
        }
      }
      for (var x = 0; x < size; x++) {
        var run = 1;
        for (var y = 1; y < size; y++) {
          if (g[y][x] === g[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; }
          else run = 1;
        }
      }
      return p;
    }
    // Format-info bits (15-bit BCH(15,5) for EC L = 01 + 3-bit mask, masked
    // by 0x5412 for spec compliance).
    var FORMAT_BITS = {
      0: 0x77c4, 1: 0x72f3, 2: 0x7daa, 3: 0x789d,
      4: 0x662f, 5: 0x6318, 6: 0x6c41, 7: 0x6976
    };
    function placeFormat(g, m) {
      var bits = FORMAT_BITS[m];
      for (var i = 0; i < 15; i++) {
        var b = (bits >> i) & 1;
        // Strand 1 — wrap around the top-left finder.
        //   Bits 0–5  → col 8, rows 0–5
        //   Bit  6    → col 8, row  7 (skip timing row 6)
        //   Bit  7    → col 8, row  8
        //   Bit  8    → col 7, row  8 (skip timing col 6)
        //   Bits 9–14 → cols 5–0, row 8
        if      (i < 6)   g[i][8]      = b;
        else if (i === 6) g[7][8]      = b;
        else if (i === 7) g[8][8]      = b;
        else if (i === 8) g[8][7]      = b;
        else              g[8][14 - i] = b;
        // Strand 2 — top-right horizontal + bottom-left vertical.
        //   Bits 0–7   → row 8, cols size-1 .. size-8
        //   Bits 8–14  → col 8, rows size-7 .. size-1
        if (i < 8) g[8][size - 1 - i] = b;
        else       g[size - 15 + i][8] = b;
      }
      g[size - 8][8] = 1;     // immutable dark module
    }
    // Choose the lowest-penalty mask.
    var best = null, bestPen = Infinity;
    for (var m = 0; m < 8; m++) {
      // Snapshot for this trial.
      var trial = new Array(size);
      for (var y = 0; y < size; y++) trial[y] = grid[y].slice();
      applyMask(trial, m);
      placeFormat(trial, m);
      var pen = penalty(trial);
      if (pen < bestPen) { bestPen = pen; best = { mask: m, grid: trial }; }
    }

    // ---- Render to canvas ----
    var quiet = 4;                 // 4-module quiet zone (spec)
    var px = (size + 2 * quiet) * scale;
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#000';
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        if (best.grid[y][x] === 1) {
          ctx.fillRect((quiet + x) * scale, (quiet + y) * scale, scale, scale);
        }
      }
    }
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'QR code for ' + text);
    return canvas;
  }

  // ==========================================================================
  // EF namespace bootstrap
  //   Idempotent — if a previous file already created the namespace (e.g.
  //   during hot-reload) we extend it rather than replace it. `widgets` is
  //   the per-widget registry every section pushes its onResize/onThemeChange
  //   /getState/reset/restoreState entry into.
  // ==========================================================================
  var EF = window.ElectronicsFundamentals || {};
  EF.debounce              = debounce;
  EF.copyToClipboard       = copyToClipboard;
  EF.formatNumberWithUnits = formatNumberWithUnits;
  EF.readDataIsland        = readDataIsland;
  EF.sanitizeInput         = sanitizeInput;
  EF.findWidgetByName      = findWidgetByName;
  EF.solveOhmsLaw          = solveOhmsLaw;
  EF.syncSliderToValue     = syncSliderToValue;
  EF.chartTheme            = chartTheme;
  EF.copyWithFlash         = copyWithFlash;
  EF.scrollIntoView        = scrollIntoView;
  EF.describeSvg           = describeSvg;
  EF.wireInputDescription  = wireInputDescription;
  EF.autoWireUnitHints     = autoWireUnitHints;
  EF.makeQrCanvas          = makeQrCanvas;
  if (!Array.isArray(EF.widgets)) EF.widgets = [];
  window.ElectronicsFundamentals = EF;

  // Optional page-level data island; future batches may populate this.
  EF.data = readDataIsland('electronics-data');

  // ==========================================================================
  // Theme synchronisation
  //   The site toggles theme via [data-theme] on <html>. Watch for changes
  //   so any Chart.js instance can re-skin without a full reload.
  // ==========================================================================
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }
  EF.theme = currentTheme();

  var themeObserver = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === 'data-theme') {
        EF.theme = currentTheme();
        for (var j = 0; j < EF.widgets.length; j++) {
          if (typeof EF.widgets[j].onThemeChange === 'function') {
            try { EF.widgets[j].onThemeChange(EF.theme); } catch (_) { /* ignore */ }
          }
        }
        document.dispatchEvent(new CustomEvent('electronics:theme',
          { detail: { theme: EF.theme } }));
      }
    }
  });
  themeObserver.observe(document.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] });

  // ==========================================================================
  // Resize handling
  //   Charts and the Quick Reference Wheel rebuild on viewport changes;
  //   widgets opt in by registering an `onResize` callback in their
  //   EF.widgets entry.
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
})();
