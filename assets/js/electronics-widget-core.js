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
    for (var i = 0; i < EF.widgets.length; i++) {
      var entry = EF.widgets[i];
      if (entry && entry.name === 'quick-reference-wheel' && typeof entry.setValues === 'function') {
        entry.setValues(values, opts || { scroll: true });
        return true;
      }
    }
    return false;
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

    function safeStringify(obj) { try { return JSON.stringify(obj); } catch (_) { return null; } }
    function safeParse(text)    { try { return JSON.parse(text); } catch (_) { return null; } }
    function b64Encode(str) { try { return btoa(unescape(encodeURIComponent(str))); } catch (_) { return null; } }
    function b64Decode(str) { try { return decodeURIComponent(escape(atob(str))); } catch (_) { return null; } }

    function save(name, state) {
      if (!name || !state) return false;
      var json = safeStringify(state);
      if (!json) return false;
      try { localStorage.setItem(STORAGE_PREFIX + name, json); } catch (_) { /* private mode */ }
      var b64 = b64Encode(json);
      if (b64) {
        var hash = HASH_PREFIX + encodeURIComponent(name) + ':' + b64;
        try { history.replaceState(null, '', hash); } catch (_) { window.location.hash = hash; }
      }
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

    function restoreFromHash() {
      var parsed = parseHash();
      if (!parsed) return false;
      for (var i = 0; i < EF.widgets.length; i++) {
        var entry = EF.widgets[i];
        if (entry && entry.name === parsed.name && typeof entry.restoreState === 'function') {
          try { entry.restoreState(parsed.state); return true; } catch (_) { return false; }
        }
      }
      return false;
    }

    return { save: save, load: load, clear: clear, parseHash: parseHash,
             restoreFromHash: restoreFromHash,
             STORAGE_PREFIX: STORAGE_PREFIX, HASH_PREFIX: HASH_PREFIX };
  })();
})();
