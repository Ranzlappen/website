/* ============================================================================
   electronics-widget-core.js — widget architecture + registry + lazy
   chart manager + bookmark persistence + Chart.js loader
   ----------------------------------------------------------------------------
   Second file of the modular electronics-fundamentals JS bundle. Depends on
   electronics-utils.js (must run first — it creates window.ElectronicsFundamentals).

   Exposes on EF:
     * EF.Widget                — base class with mount/unmount/reset/
                                  getState/toJSON/destroy/addCleanup
     * EF.CalculatorKernel      — Widget + shared calculator helpers
     * EF._SectionAdapter       — bridges closure-based init() functions
                                  into the Widget lifecycle
     * EF._inherit              — helper used by all calculator files
     * EF.registerWidget        — registry-based factory
     * EF._registerSection      — convenience wrapper used by every section
     * EF.mountAllWidgets       — boot path (called from entry-point file)
     * EF.unmountAllWidgets
     * EF.resetAllWidgets       — global Reset All target
     * EF.getAllWidgetStates    — debug/snapshot helper
     * EF.syncAllWidgetThemes   — post-mount dark-mode safety net
     * EF.LazyChartManager      — IntersectionObserver/ResizeObserver chart
                                  lifecycle
     * EF.Bookmark              — URL hash + localStorage persistence
     * EF.ensureChartJs         — Promise-based, consent-gated Chart.js loader
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;
  var EF = window.ElectronicsFundamentals;
  if (!EF) {
    // electronics-utils.js must run first; bail silently if it didn't.
    // eslint-disable-next-line no-console
    console.error('electronics-widget-core.js loaded before electronics-utils.js');
    return;
  }

  // ==========================================================================
  // Chart.js lazy-load (consent-gated, matches _layouts/default.html pattern)
  // ==========================================================================
  var CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
  var chartPromise = null;

  function loadChartScript() {
    return new Promise(function (resolve, reject) {
      if (window.Chart) { resolve(window.Chart); return; }
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
  // Reduced-motion helper
  //   Single source of truth for `prefers-reduced-motion: reduce` so every
  //   chart / animation loop in the bundle reads the same boolean. Returns
  //   false on engines without matchMedia (no harm in animating).
  // ==========================================================================
  EF.prefersReducedMotion = function () {
    if (!window.matchMedia) return false;
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  };

  // ==========================================================================
  // EF.confirmModal — accessible in-page replacement for window.confirm()
  //   Builds a focus-trapping ARIA dialog. Returns a Promise that resolves
  //   to `true` (confirmed) or `false` (cancelled / dismissed via Esc /
  //   backdrop click). Used by the floating Reset All button.
  //
  //   Falls back to window.confirm() if document.body is unavailable for
  //   any reason (very early boot, ancient browser quirks).
  // ==========================================================================
  EF.confirmModal = function (opts) {
    opts = opts || {};
    var title       = opts.title       || 'Are you sure?';
    var message     = opts.message     || '';
    var confirmText = opts.confirmText || 'Confirm';
    var cancelText  = opts.cancelText  || 'Cancel';
    var dangerous   = !!opts.dangerous;
    if (!document.body) {
      return Promise.resolve(window.confirm(title + (message ? '\n\n' + message : '')));
    }
    return new Promise(function (resolve) {
      var prevFocus = document.activeElement;
      var titleId = 'ef-modal-title-' + Math.random().toString(36).slice(2, 9);
      var descId  = 'ef-modal-desc-'  + Math.random().toString(36).slice(2, 9);

      // Inline styles: the page's CSS file is intentionally not extended in
      // this batch. We use just enough inline styling that the modal looks
      // intentional in both light and dark themes (CSS variables resolve
      // against [data-theme]).
      var backdrop = document.createElement('div');
      backdrop.className = 'electronics-modal-backdrop';
      backdrop.setAttribute('role', 'presentation');
      backdrop.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:9999',
        'background:rgba(0,0,0,0.55)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:1rem',
        'animation:none'
      ].join(';');

      var dialog = document.createElement('div');
      dialog.className = 'electronics-modal';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', titleId);
      if (message) dialog.setAttribute('aria-describedby', descId);
      dialog.style.cssText = [
        'background:var(--c-bg, #1a1a1a)',
        'color:var(--c-fg, #f5f5f5)',
        'border:1px solid var(--c-border, rgba(255,255,255,0.15))',
        'border-radius:var(--border-radius, 0.5rem)',
        'padding:1.25rem 1.5rem',
        'max-width:30rem', 'width:100%',
        'box-shadow:0 12px 32px rgba(0,0,0,0.45)',
        'font-family:var(--f-body, system-ui, sans-serif)'
      ].join(';');

      var h = document.createElement('h2');
      h.id = titleId;
      h.className = 'electronics-modal__title';
      h.textContent = title;
      h.style.cssText = 'margin:0 0 0.5rem;font-size:1.1rem;line-height:1.3';

      var p = null;
      if (message) {
        p = document.createElement('p');
        p.id = descId;
        p.className = 'electronics-modal__message';
        p.textContent = message;
        p.style.cssText = 'margin:0 0 1rem;font-size:0.95rem;line-height:1.45;opacity:0.9';
      }

      var actions = document.createElement('div');
      actions.className = 'electronics-modal__actions';
      actions.style.cssText = 'display:flex;justify-content:flex-end;gap:0.5rem;flex-wrap:wrap';

      // Reuse the calculator button styling that's already in the CSS so
      // these look at home with the rest of the page.
      var btnBase = 'padding:0.5rem 1rem;border-radius:var(--border-radius-sm,0.35rem);' +
                    'border:1px solid var(--c-border, rgba(255,255,255,0.15));' +
                    'cursor:pointer;font:inherit;line-height:1;';
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'electronics-calculator__reset';
      cancelBtn.textContent = cancelText;
      cancelBtn.style.cssText = btnBase +
        'background:transparent;color:var(--c-fg, #f5f5f5);';

      var confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'electronics-calculator__reset';
      confirmBtn.textContent = confirmText;
      confirmBtn.style.cssText = btnBase + (dangerous
        ? 'background:var(--c-warn, #c0392b);color:#fff;border-color:transparent;'
        : 'background:var(--c-accent, #2c7be5);color:#fff;border-color:transparent;');

      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);

      dialog.appendChild(h);
      if (p) dialog.appendChild(p);
      dialog.appendChild(actions);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);

      // Focus trap: keep Tab inside the dialog.
      function focusables() {
        return dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), ' +
          'select:not([disabled]), textarea:not([disabled]), ' +
          '[tabindex]:not([tabindex="-1"])'
        );
      }
      function onKeyDown(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          e.preventDefault();
          done(false);
          return;
        }
        if (e.key !== 'Tab' && e.keyCode !== 9) return;
        var nodes = focusables();
        if (!nodes.length) return;
        var first = nodes[0];
        var last  = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
      function onBackdropClick(e) {
        if (e.target === backdrop) done(false);
      }
      function done(value) {
        document.removeEventListener('keydown', onKeyDown, true);
        backdrop.removeEventListener('click', onBackdropClick);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (prevFocus && typeof prevFocus.focus === 'function') {
          try { prevFocus.focus(); } catch (_) { /* ignore */ }
        }
        resolve(value);
      }

      cancelBtn.addEventListener('click',  function () { done(false); });
      confirmBtn.addEventListener('click', function () { done(true);  });
      backdrop.addEventListener('click', onBackdropClick);
      document.addEventListener('keydown', onKeyDown, true);

      // Default focus: cancel for safety on dangerous actions, confirm
      // otherwise so Enter accepts.
      setTimeout(function () {
        (dangerous ? cancelBtn : confirmBtn).focus();
      }, 0);
    });
  };

  // ==========================================================================
  // Widget base class
  // ==========================================================================
  function _inherit(Child, Parent) {
    Child.prototype = Object.create(Parent.prototype);
    Child.prototype.constructor = Child;
  }
  EF._inherit = _inherit;

  function Widget(options) {
    options = options || {};
    this.name = options.name || 'unnamed-widget';
    this.element = options.element || null;
    this.options = options;
    this._mounted = false;
    this._destroyed = false;
    this._cleanups = [];
  }
  Widget.prototype.mount = function (container) {
    if (this._destroyed) {
      throw new Error('Cannot mount destroyed widget: ' + this.name);
    }
    if (this._mounted) return this;
    if (container) this.element = container;
    this._mounted = true;
    return this;
  };
  Widget.prototype.unmount = function () {
    if (!this._mounted) return this;
    this._mounted = false;
    return this;
  };
  Widget.prototype.reset    = function () { return this; };
  Widget.prototype.getState = function () { return {}; };
  Widget.prototype.toJSON   = function () { return { name: this.name, state: this.getState() }; };
  Widget.prototype.destroy = function () {
    while (this._cleanups.length) {
      var fn = this._cleanups.pop();
      try { fn(); } catch (_) { /* swallow — destroy must finish */ }
    }
    this.unmount();
    this._destroyed = true;
    return this;
  };
  Widget.prototype.addCleanup = function (fn) {
    if (typeof fn === 'function') this._cleanups.push(fn);
  };
  EF.Widget = Widget;

  // ==========================================================================
  // CalculatorKernel — Widget + shared calculator helpers
  // ==========================================================================
  function CalculatorKernel(options) {
    Widget.call(this, options);
    this.chart = null;
    this.announcer = null;
  }
  _inherit(CalculatorKernel, Widget);
  CalculatorKernel.prototype.debounce = function (fn, wait) { return EF.debounce(fn, wait); };
  CalculatorKernel.prototype.sanitizeInput = function (raw) { return EF.sanitizeInput(raw); };
  CalculatorKernel.prototype.formatWithSI = function (value, unit) { return EF.formatNumberWithUnits(value, unit); };
  CalculatorKernel.prototype.copyToClipboardWithUnits = function (text) { return EF.copyToClipboard(text); };
  CalculatorKernel.prototype.openInQuickWheel = function (values, opts) {
    if (!values || typeof values !== 'object') return false;
    var entry = EF.findWidgetByName('quick-reference-wheel');
    if (!entry || typeof entry.setValues !== 'function') return false;
    entry.setValues(values, opts || { scroll: true });
    return true;
  };
  CalculatorKernel.prototype.themeChart = function () { /* subclass override */ };
  CalculatorKernel.prototype.registerResizeObserver = function (chart) {
    if (!chart) return;
    this.chart = chart;
  };
  CalculatorKernel.prototype.announce = function (text) {
    if (this.announcer) this.announcer.textContent = text;
  };
  EF.CalculatorKernel = CalculatorKernel;

  // ==========================================================================
  // _SectionAdapter — wraps existing closure-based init() functions in the
  // Widget lifecycle without rewriting their internals.
  // ==========================================================================
  function _SectionAdapter(options, initFn) {
    CalculatorKernel.call(this, options);
    this._initFn = initFn;
    this._entry  = null;
    this._initialised = false;
  }
  _inherit(_SectionAdapter, CalculatorKernel);
  _SectionAdapter.prototype.mount = function (container) {
    CalculatorKernel.prototype.mount.call(this, container);
    if (this._initialised) return this;
    try { this._initFn(); } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Widget init failed: ' + this.name, e);
    }
    this._initialised = true;
    for (var i = 0; i < EF.widgets.length; i++) {
      if (EF.widgets[i] && EF.widgets[i].name === this.name) {
        this._entry = EF.widgets[i];
        break;
      }
    }
    return this;
  };
  _SectionAdapter.prototype.reset = function () {
    if (this._entry && typeof this._entry.reset === 'function') {
      try { this._entry.reset(); } catch (_) { /* ignore */ }
    }
    return this;
  };
  _SectionAdapter.prototype.getState = function () {
    if (this._entry && typeof this._entry.getState === 'function') {
      try { return this._entry.getState(); } catch (_) { return {}; }
    }
    return {};
  };
  /** Chain destroy → entry.destroy so each section can disconnect its own
   *  observers / timers / DOM listeners on teardown. The entry contract:
   *  if a widget's EF.widgets entry exposes a `destroy()` function, it is
   *  invoked before the parent Widget.destroy clears _cleanups. */
  _SectionAdapter.prototype.destroy = function () {
    if (this._entry && typeof this._entry.destroy === 'function') {
      try { this._entry.destroy(); } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Widget entry.destroy failed: ' + this.name, e);
      }
    }
    return CalculatorKernel.prototype.destroy.call(this);
  };
  EF._SectionAdapter = _SectionAdapter;

  /** Convenience wrapper used by every section file:
   *    EF._registerSection('quick-reference-wheel', initQuickReferenceWheel);
   *  — equivalent to manually wiring a _SectionAdapter factory through
   *  EF.registerWidget. */
  EF._registerSection = function (name, initFn) {
    EF.registerWidget(name, function () {
      return new _SectionAdapter({ name: name }, initFn);
    });
  };

  // ==========================================================================
  // Registry + lifecycle
  // ==========================================================================
  EF._registry  = EF._registry  || [];
  EF._instances = EF._instances || [];

  EF.registerWidget = function (name, factory) {
    if (!name || typeof factory !== 'function') return;
    // De-duplicate by name so re-registration (hot reload) doesn't double up.
    for (var i = 0; i < EF._registry.length; i++) {
      if (EF._registry[i].name === name) return;
    }
    EF._registry.push({ name: name, factory: factory });
  };

  EF.mountAllWidgets = function () {
    EF._registry.forEach(function (entry) {
      try {
        var instance = entry.factory();
        if (!instance) return;
        if (typeof instance.mount === 'function') instance.mount();
        EF._instances.push(instance);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Widget mount failed: ' + entry.name, e);
      }
    });
    EF.syncAllWidgetThemes();
  };

  EF.syncAllWidgetThemes = function () {
    EF.widgets.forEach(function (entry) {
      if (entry && typeof entry.onThemeChange === 'function') {
        try { entry.onThemeChange(EF.theme); } catch (_) { /* ignore */ }
      }
    });
  };

  EF.unmountAllWidgets = function () {
    while (EF._instances.length) {
      var w = EF._instances.pop();
      try {
        if (typeof w.destroy === 'function') w.destroy();
        else if (typeof w.unmount === 'function') w.unmount();
      } catch (_) { /* ignore */ }
    }
  };

  EF.resetAllWidgets = function () {
    var seen = {};
    EF._instances.forEach(function (w) {
      if (!w || !w.name) return;
      if (typeof w.reset === 'function') {
        try { w.reset(); } catch (_) { /* ignore */ }
      }
      seen[w.name] = true;
    });
    EF.widgets.forEach(function (entry) {
      if (!entry || !entry.name || seen[entry.name]) return;
      if (typeof entry.reset === 'function') {
        try { entry.reset(); } catch (_) { /* ignore */ }
      }
    });
  };

  EF.getAllWidgetStates = function () {
    var out = {};
    EF._instances.forEach(function (w) {
      if (!w || !w.name) return;
      if (typeof w.getState === 'function') {
        try { out[w.name] = w.getState(); } catch (_) { out[w.name] = null; }
      }
    });
    EF.widgets.forEach(function (entry) {
      if (!entry || !entry.name || out[entry.name] !== undefined) return;
      if (typeof entry.getState === 'function') {
        try { out[entry.name] = entry.getState(); } catch (_) { out[entry.name] = null; }
      }
    });
    return out;
  };

  // ==========================================================================
  // EF.LazyChartManager — IntersectionObserver + ResizeObserver chart lifecycle
  // ==========================================================================
  EF.LazyChartManager = (function () {
    var MAX_ACTIVE = 2;
    var registrations = [];
    var observer = null;
    var resizeObserver = null;
    var activeQueue = [];

    function ensureObserver() {
      if (observer) return observer;
      if (typeof IntersectionObserver === 'undefined') return null;
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var reg = findByContainer(entry.target);
          if (!reg) return;
          if (entry.isIntersecting) activate(reg);
        });
      }, { rootMargin: '120px 0px', threshold: 0.05 });
      return observer;
    }

    function ensureResizeObserver() {
      if (resizeObserver) return resizeObserver;
      if (typeof ResizeObserver === 'undefined') return null;
      var pending = new WeakMap();
      resizeObserver = new ResizeObserver(function (entries) {
        entries.forEach(function (entry) {
          var reg = findByContainer(entry.target);
          if (!reg || reg.status !== 'active' || !reg.chartRef) return;
          var prior = pending.get(entry.target);
          if (prior) clearTimeout(prior);
          pending.set(entry.target, setTimeout(function () {
            pending.delete(entry.target);
            try { if (typeof reg.chartRef.resize === 'function') reg.chartRef.resize(); }
            catch (e) {
              // eslint-disable-next-line no-console
              console.error('LazyChart resize failed: ' + reg.name, e);
            }
          }, 100));
        });
      });
      return resizeObserver;
    }

    function findByContainer(el) {
      for (var i = 0; i < registrations.length; i++) {
        if (registrations[i].container === el) return registrations[i];
      }
      return null;
    }
    function findByName(name) {
      for (var i = 0; i < registrations.length; i++) {
        if (registrations[i].name === name) return registrations[i];
      }
      return null;
    }

    function activate(reg) {
      activeQueue = activeQueue.filter(function (n) { return n !== reg.name; });
      if (reg.status === 'pending') {
        try {
          reg.chartRef = reg.build() || reg.chartRef || null;
          reg.status = 'active';
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('LazyChart build failed: ' + reg.name, e);
          reg.status = 'failed';
          return;
        }
      } else if (reg.status === 'paused') {
        if (typeof reg.resume === 'function') {
          try { reg.resume(reg.chartRef); } catch (e) {
            // eslint-disable-next-line no-console
            console.error('LazyChart resume failed: ' + reg.name, e);
          }
        }
        reg.status = 'active';
      }
      if (reg.status !== 'active') return;
      activeQueue.push(reg.name);
      while (activeQueue.length > MAX_ACTIVE) {
        var evictName = activeQueue.shift();
        var evict = findByName(evictName);
        if (!evict) continue;
        if (typeof evict.pause === 'function') {
          try { evict.pause(evict.chartRef); } catch (e) {
            // eslint-disable-next-line no-console
            console.error('LazyChart pause failed: ' + evict.name, e);
          }
        }
        evict.status = 'paused';
      }
    }

    function register(name, container, callbacks) {
      if (!name || !container || !callbacks || typeof callbacks.build !== 'function') return null;
      if (findByName(name)) return findByName(name);
      var reg = {
        name: name,
        container: container,
        build: callbacks.build,
        pause: callbacks.pause || null,
        resume: callbacks.resume || null,
        status: 'pending',
        chartRef: null
      };
      registrations.push(reg);
      var obs = ensureObserver();
      if (obs) obs.observe(container);
      else activate(reg);
      var ro = ensureResizeObserver();
      if (ro) ro.observe(container);
      return reg;
    }

    function show(name) {
      var reg = findByName(name);
      if (reg) activate(reg);
      return reg;
    }

    function unregisterAll() {
      if (observer)       { observer.disconnect();       observer = null; }
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
      registrations.length = 0;
      activeQueue.length = 0;
    }

    function getStatus() {
      return registrations.map(function (r) {
        return { name: r.name, status: r.status };
      });
    }

    return { register: register, show: show, unregisterAll: unregisterAll,
             getStatus: getStatus, MAX_ACTIVE: MAX_ACTIVE };
  })();

  // ==========================================================================
  // EF.Bookmark — URL hash + localStorage state persistence
  // ==========================================================================
  EF.Bookmark = (function () {
    var STORAGE_PREFIX = 'ef:state:';
    var HASH_PREFIX    = '#ef=';
    var api = {};

    function safeStringify(obj) { try { return JSON.stringify(obj); } catch (_) { return null; } }
    function safeParse(text)    { try { return JSON.parse(text); } catch (_) { return null; } }
    function b64Encode(str) { try { return btoa(unescape(encodeURIComponent(str))); } catch (_) { return null; } }
    function b64Decode(str) { try { return decodeURIComponent(escape(atob(str))); } catch (_) { return null; } }

    function save(name, state) {
      api.lastResult = { ok: false, persisted: false, hashed: false, quotaExceeded: false };
      if (!name || !state) return false;
      var json = safeStringify(state);
      if (!json) { api.lastResult.ok = false; return false; }
      try {
        localStorage.setItem(STORAGE_PREFIX + name, json);
        api.lastResult.persisted = true;
      } catch (e) {
        // localStorage can throw in private mode or when over quota.
        // Detect quota errors so callers can show the user a visible warning.
        var quota = e && (
          e.code === 22 || e.code === 1014 ||
          /quota/i.test(e.name || '') || /quota/i.test(e.message || '')
        );
        api.lastResult.quotaExceeded = !!quota;
      }
      var b64 = b64Encode(json);
      if (b64) {
        var hash = HASH_PREFIX + encodeURIComponent(name) + ':' + b64;
        try { history.replaceState(null, '', hash); api.lastResult.hashed = true; }
        catch (_) {
          try { window.location.hash = hash; api.lastResult.hashed = true; } catch (__) { /* ignore */ }
        }
      }
      api.lastResult.ok = true;
      return true;
    }

    function load(name) {
      try {
        var raw = localStorage.getItem(STORAGE_PREFIX + name);
        if (!raw) return null;
        return safeParse(raw);
      } catch (_) { return null; }
    }

    function clear(name) {
      try { localStorage.removeItem(STORAGE_PREFIX + name); } catch (_) { /* ignore */ }
    }

    function parseHash() {
      var h = window.location.hash || '';
      if (h.indexOf(HASH_PREFIX) !== 0) return null;
      var rest = h.slice(HASH_PREFIX.length);
      var sep = rest.indexOf(':');
      if (sep < 1) return null;
      var name = decodeURIComponent(rest.slice(0, sep));
      var b64 = rest.slice(sep + 1);
      var json = b64Decode(b64);
      if (!json) return null;
      var state = safeParse(json);
      if (!state) return null;
      return { name: name, state: state };
    }

    /** Look up the DOM container associated with a widget name. We try a
     *  registered hint first (set by widget files via registerContainer) and
     *  fall back to the convention `#electronics-<name>-card` /
     *  `[data-widget="<name>"]` so older registrations still scroll. */
    function findContainer(name) {
      if (!name) return null;
      if (api._containers && api._containers[name]) {
        var hinted = api._containers[name];
        if (hinted && hinted.isConnected !== false) return hinted;
      }
      return document.querySelector('[data-widget="' + name + '"]') ||
             document.getElementById('electronics-' + name + '-card') ||
             document.getElementById(name) ||
             null;
    }

    function registerContainer(name, el) {
      if (!name || !el) return;
      if (!api._containers) api._containers = {};
      api._containers[name] = el;
    }

    function restoreFromHash() {
      var parsed = parseHash();
      if (!parsed) return false;
      for (var i = 0; i < EF.widgets.length; i++) {
        var entry = EF.widgets[i];
        if (entry && entry.name === parsed.name && typeof entry.restoreState === 'function') {
          try {
            entry.restoreState(parsed.state);
            // After a successful restore, scroll the widget into view so the
            // user lands directly on the recreated state. Honours reduced-motion.
            var container = findContainer(parsed.name);
            if (container && typeof EF.scrollIntoView === 'function') {
              setTimeout(function () { EF.scrollIntoView(container, { block: 'start' }); }, 0);
            }
            return true;
          } catch (_) { return false; }
        }
      }
      return false;
    }

    api.save = save;
    api.load = load;
    api.clear = clear;
    api.parseHash = parseHash;
    api.restoreFromHash = restoreFromHash;
    api.registerContainer = registerContainer;
    api.findContainer = findContainer;
    api.STORAGE_PREFIX = STORAGE_PREFIX;
    api.HASH_PREFIX    = HASH_PREFIX;
    api.lastResult = null;
    return api;
  })();
})();
