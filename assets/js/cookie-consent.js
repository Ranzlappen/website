/*
  Cookie Consent Manager — DSGVO/TTDSG compliant
  Vanilla JS, no external dependencies
  DATE: 2026-04-11
*/
(function () {
  'use strict';

  var STORAGE_KEY = 'cookie_consent';
  var CONSENT_VERSION = 1;
  var EXPIRY_DAYS = 365;

  // State bootstrapped by inline script in <head>
  var state = window.__cookieConsent || { functional: false, resolved: false };

  // ── Persistence ───────────────────────────────────────────
  function saveConsent(functional) {
    state.functional = functional;
    state.resolved = true;
    window.__cookieConsent = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: CONSENT_VERSION,
        functional: functional,
        timestamp: Date.now(),
        expires: new Date(Date.now() + EXPIRY_DAYS * 86400000).toISOString()
      }));
    } catch (e) { /* private browsing */ }
  }

  // ── Script activation ─────────────────────────────────────
  function activateDeferredScripts() {
    var blocked = document.querySelectorAll(
      'script[type="text/plain"][data-consent-category="functional"]'
    );
    for (var i = 0; i < blocked.length; i++) {
      var el = blocked[i];
      var newScript = document.createElement('script');
      for (var j = 0; j < el.attributes.length; j++) {
        var attr = el.attributes[j];
        if (attr.name === 'type' || attr.name === 'data-consent-category') continue;
        newScript.setAttribute(attr.name, attr.value);
      }
      if (!el.getAttribute('src') && el.textContent.trim()) {
        newScript.textContent = el.textContent;
      }
      el.parentNode.replaceChild(newScript, el);
    }
  }

  function applyConsent() {
    if (state.functional) {
      document.documentElement.classList.add('consent-functional');
      activateDeferredScripts();
    } else {
      document.documentElement.classList.remove('consent-functional');
    }
    // Notify other scripts
    window.dispatchEvent(new CustomEvent('consent-updated', {
      detail: { functional: state.functional }
    }));
  }

  // ── Banner DOM ────────────────────────────────────────────
  var banner = null;

  function createBanner() {
    if (banner) return;

    banner = document.createElement('div');
    banner.id = 'cc-banner';
    banner.className = 'cc-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie & Privacy Settings');
    banner.setAttribute('aria-modal', 'true');
    banner.hidden = true;

    banner.innerHTML =
      '<div class="cc-banner__inner">' +

        '<div class="cc-banner__content">' +
          '<p class="cc-banner__title">Cookie &amp; Privacy Settings</p>' +
          '<p class="cc-banner__desc">' +
            'This site uses cookies and third-party services for features like voting, ' +
            'comments, spam protection, and search. Essential functions (theme, preferences) ' +
            'always work without consent. You decide which optional services to enable.' +
          '</p>' +
        '</div>' +

        '<div class="cc-banner__settings" id="cc-settings" hidden>' +
          '<div class="cc-category">' +
            '<div class="cc-category__header">' +
              '<label class="cc-toggle">' +
                '<input type="checkbox" checked disabled aria-label="Essential cookies (always active)">' +
                '<span class="cc-toggle__slider cc-toggle__slider--locked"></span>' +
              '</label>' +
              '<div class="cc-category__info">' +
                '<strong>Essential</strong>' +
                '<span class="cc-badge">Always active</span>' +
              '</div>' +
            '</div>' +
            '<p class="cc-category__desc">' +
              'Theme preference, view mode, core site functionality. ' +
              'Uses only localStorage — no third-party services.' +
            '</p>' +
          '</div>' +
          '<div class="cc-category">' +
            '<div class="cc-category__header">' +
              '<label class="cc-toggle">' +
                '<input type="checkbox" id="cc-functional" aria-label="Functional services">' +
                '<span class="cc-toggle__slider"></span>' +
              '</label>' +
              '<div class="cc-category__info">' +
                '<strong>Functional Services</strong>' +
              '</div>' +
            '</div>' +
            '<p class="cc-category__desc">' +
              'Firebase (voting system), Giscus (comments via GitHub), ' +
              'hCaptcha (spam protection), Chart.js &amp; Lunr.js via CDN (charts, search).' +
            '</p>' +
          '</div>' +
        '</div>' +

        '<div class="cc-banner__actions">' +
          '<button class="cc-btn" id="cc-reject" type="button">Reject All</button>' +
          '<button class="cc-btn" id="cc-customize" type="button" aria-expanded="false">Customize</button>' +
          '<button class="cc-btn" id="cc-accept" type="button">Accept All</button>' +
        '</div>' +

      '</div>';

    document.body.appendChild(banner);

    // ── Bind events ──
    document.getElementById('cc-accept').addEventListener('click', function () {
      saveConsent(true);
      closeBanner();
      applyConsent();
    });

    document.getElementById('cc-reject').addEventListener('click', function () {
      saveConsent(false);
      closeBanner();
      applyConsent();
    });

    var customizeBtn = document.getElementById('cc-customize');
    var settingsPanel = document.getElementById('cc-settings');

    customizeBtn.addEventListener('click', function () {
      if (settingsPanel.hidden) {
        settingsPanel.hidden = false;
        customizeBtn.textContent = 'Save Settings';
        customizeBtn.setAttribute('aria-expanded', 'true');
      } else {
        var cb = document.getElementById('cc-functional');
        saveConsent(cb.checked);
        closeBanner();
        applyConsent();
      }
    });

    // Keyboard: Escape rejects, Tab trapped
    banner.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        saveConsent(false);
        closeBanner();
        applyConsent();
        return;
      }
      if (e.key === 'Tab') {
        var focusable = banner.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        var arr = Array.prototype.slice.call(focusable);
        if (!arr.length) return;
        var first = arr[0];
        var last = arr[arr.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  function openBanner() {
    createBanner();
    // Reset UI state
    var settingsPanel = document.getElementById('cc-settings');
    var customizeBtn = document.getElementById('cc-customize');
    var cb = document.getElementById('cc-functional');
    if (settingsPanel) settingsPanel.hidden = true;
    if (customizeBtn) {
      customizeBtn.textContent = 'Customize';
      customizeBtn.setAttribute('aria-expanded', 'false');
    }
    if (cb) cb.checked = state.functional;

    banner.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add('cc-banner--visible');
        var firstBtn = banner.querySelector('.cc-btn');
        if (firstBtn) firstBtn.focus();
      });
    });
  }

  function closeBanner() {
    if (!banner) return;
    banner.classList.remove('cc-banner--visible');
    setTimeout(function () { banner.hidden = true; }, 300);
    // Return focus to trigger element if available
    var trigger = document.getElementById('cc-footer-settings');
    if (trigger && trigger.offsetParent !== null) trigger.focus();
  }

  // ── Public API ────────────────────────────────────────────
  window.CookieConsent = {
    show: openBanner,
    hasConsent: function (cat) {
      if (cat === 'essential') return true;
      if (cat === 'functional') return state.resolved && state.functional;
      return false;
    },
    isResolved: function () { return state.resolved; }
  };

  // ── Init ──────────────────────────────────────────────────
  function init() {
    if (state.resolved) {
      applyConsent();
    } else {
      openBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
