/*
CHANGE: Add cookie viewer modal open/close logic and cookie parsing
REASON: Power the cookie viewer modal with JS to read and display cookies
DATE: 2026-04-02
*/
(function () {
  'use strict';

  // -------------------------------------------------------
  // Header: transparent → solid on scroll
  // -------------------------------------------------------
  var header = document.getElementById('site-header');
  var heroEl = document.querySelector('.hero');
  var scrollThreshold = heroEl ? heroEl.offsetHeight * 0.3 : 60;

  function updateHeader() {
    if (window.scrollY > scrollThreshold) {
      header.classList.remove('site-header--transparent');
      header.classList.add('site-header--solid');
    } else {
      header.classList.remove('site-header--solid');
      header.classList.add('site-header--transparent');
    }
  }
  // If no hero on this page, immediately go solid
  if (!heroEl) {
    header.classList.remove('site-header--transparent');
    header.classList.add('site-header--solid');
  } else {
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
  }

  // -------------------------------------------------------
  // Mobile Menu
  // -------------------------------------------------------
  var menuToggle = document.getElementById('mobile-menu-toggle');
  var mobileNav = document.getElementById('mobile-nav');

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', function () {
      var expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
      mobileNav.classList.toggle('is-open');
      document.body.style.overflow = expanded ? '' : 'hidden';
    });

    // Close on link click
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menuToggle.setAttribute('aria-expanded', 'false');
        mobileNav.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  // -------------------------------------------------------
  // Theme Toggle
  // -------------------------------------------------------
  var themeBtn = document.getElementById('theme-toggle');
  var iconSun = themeBtn ? themeBtn.querySelector('.icon-sun') : null;
  var iconMoon = themeBtn ? themeBtn.querySelector('.icon-moon') : null;

  function setThemeIcons() {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (iconSun && iconMoon) {
      iconSun.style.display = isLight ? 'none' : '';
      iconMoon.style.display = isLight ? '' : 'none';
    }
  }
  setThemeIcons();

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'light' ? null : 'light';
      if (next) {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
      }
      setThemeIcons();

      // Update Giscus theme if loaded
      var giscusFrame = document.querySelector('iframe.giscus-frame');
      if (giscusFrame) {
        giscusFrame.contentWindow.postMessage(
          { giscus: { setConfig: { theme: next ? 'light' : 'dark' } } },
          'https://giscus.app'
        );
      }
    });
  }

  // -------------------------------------------------------
  // View Toggle (Grid / List / Carousel)
  // -------------------------------------------------------
  var viewGrid = document.getElementById('view-grid');
  var viewList = document.getElementById('view-list');
  var viewCarousel = document.getElementById('view-carousel');
  var postsGrid = document.getElementById('posts-grid');
  var postsList = document.getElementById('posts-list');
  var postsCarousel = document.getElementById('posts-carousel');

  if (viewGrid && viewList) {
    var saved = localStorage.getItem('viewMode') || 'carousel';
    applyView(saved);

    viewGrid.addEventListener('click', function () { applyView('grid'); });
    viewList.addEventListener('click', function () { applyView('list'); });
    if (viewCarousel) {
      viewCarousel.addEventListener('click', function () { applyView('carousel'); });
    }
  }

  function applyView(mode) {
    if (!postsGrid || !postsList) return;
    var containers = [postsGrid, postsList];
    var buttons = [viewGrid, viewList];
    if (postsCarousel) containers.push(postsCarousel);
    if (viewCarousel) buttons.push(viewCarousel);

    containers.forEach(function (c) { c.hidden = true; });
    buttons.forEach(function (b) { b.classList.remove('active'); });

    document.documentElement.classList.remove('carousel-active');
    destroyCarouselObserver();

    if (mode === 'list') {
      postsList.hidden = false;
      viewList.classList.add('active');
    } else if (mode === 'carousel' && postsCarousel) {
      postsCarousel.hidden = false;
      if (viewCarousel) viewCarousel.classList.add('active');
      document.documentElement.classList.add('carousel-active');
      initCarouselObserver();
    } else {
      mode = 'grid';
      postsGrid.hidden = false;
      viewGrid.classList.add('active');
    }
    localStorage.setItem('viewMode', mode);
  }

  // -------------------------------------------------------
  // Carousel — Scroll-Driven Focus Engine
  // -------------------------------------------------------
  var carouselRAF = null;
  var carouselScrollHandler = null;

  function initCarouselObserver() {
    if (carouselScrollHandler || !postsCarousel) return;
    var cards = postsCarousel.querySelectorAll('.carousel-card');
    if (!cards.length) return;
    var n = cards.length;

    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    // Read tuning values from CSS custom properties (set in :root)
    var rootStyle = getComputedStyle(document.documentElement);
    function cssNum(name, fallback) {
      return parseFloat(rootStyle.getPropertyValue(name)) || fallback;
    }

    function onScroll() {
      if (carouselRAF) return;
      carouselRAF = requestAnimationFrame(function () {
        carouselRAF = null;
        var vh = window.innerHeight;
        var anchorY = vh * 0.45;
        var focusIdx = -1;
        var minDist = Infinity;

        // Single rect-read pass: cache rects and find focused card
        var rects = new Array(n);
        for (var i = 0; i < n; i++) {
          rects[i] = cards[i].getBoundingClientRect();
          var mid = rects[i].top + rects[i].height * 0.5;
          var d = Math.abs(mid - anchorY);
          if (d < minDist) { minDist = d; focusIdx = i; }
        }

        for (var i = 0; i < n; i++) {
          var card = cards[i];
          var rect = rects[i];
          var mid = rect.top + rect.height * 0.5;
          var dist = (mid - anchorY) / vh;
          var absDist = Math.abs(dist);

          // Off-screen culling
          if (rect.bottom < -50 || rect.top > vh + 50) {
            card.style.opacity = '0';
            card.classList.remove('is-focused');
            continue;
          }

          // Read tuning from CSS vars (cached per computed style)
          var fadeMin    = cssNum('--carousel-fade-min', 0.35);
          var scaleMin   = cssNum('--carousel-scale-min', 0.94);
          var tiltUp     = cssNum('--carousel-tilt-up', 4);
          var tiltDown   = cssNum('--carousel-tilt-down', 3);
          var focusRange = cssNum('--carousel-focus-range', 0.55);

          // Smooth interpolation: 0 at center → 1 at edges
          var t = clamp(absDist / focusRange, 0, 1);
          var tFast = t * t;

          var opacity = 1 - tFast * (1 - fadeMin);
          var rx = dist < 0 ? tiltUp * t : -tiltDown * t;
          var scale = 1 - (1 - scaleMin) * t;
          var shadow = 1 - tFast;

          // Focus class for accent glow, shimmer, and hover effects
          if (i === focusIdx && absDist < 0.30) {
            card.classList.add('is-focused');
          } else {
            card.classList.remove('is-focused');
          }

          card.style.opacity = opacity;
          card.style.setProperty('--carousel-tilt-x', rx + 'deg');
          card.style.setProperty('--carousel-scale', scale);
          card.style.setProperty('--carousel-shadow-depth', shadow);
        }
      });
    }

    carouselScrollHandler = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function destroyCarouselObserver() {
    if (carouselScrollHandler) {
      window.removeEventListener('scroll', carouselScrollHandler);
      carouselScrollHandler = null;
    }
    if (carouselRAF) {
      cancelAnimationFrame(carouselRAF);
      carouselRAF = null;
    }
    // Clean up focus classes
    if (postsCarousel) {
      var cards = postsCarousel.querySelectorAll('.carousel-card');
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('is-focused');
      }
    }
  }

  // -------------------------------------------------------
  // Reading Progress Bar
  // -------------------------------------------------------
  var progressBar = document.getElementById('reading-progress');
  if (progressBar) {
    window.addEventListener('scroll', function () {
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docH > 0 ? (window.scrollY / docH) * 100 : 0;
      progressBar.style.width = Math.min(pct, 100) + '%';
    }, { passive: true });
  }

  // -------------------------------------------------------
  // Search Modal
  // -------------------------------------------------------
  var searchToggle = document.getElementById('search-toggle');
  var searchOverlay = document.getElementById('search-overlay');
  var searchInput = document.getElementById('search-input');

  function openSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { searchInput && searchInput.focus(); }, 100);
  }

  function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (searchInput) searchInput.value = '';
    var results = document.getElementById('search-results');
    if (results) results.innerHTML = '';
  }

  if (searchToggle) {
    searchToggle.addEventListener('click', openSearch);
  }

  if (searchOverlay) {
    searchOverlay.addEventListener('click', function (e) {
      if (e.target === searchOverlay) closeSearch();
    });
  }

  // Keyboard: Ctrl/Cmd+K to open, Escape to close
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (searchOverlay && searchOverlay.classList.contains('is-open')) {
        closeSearch();
      } else {
        openSearch();
      }
    }
    if (e.key === 'Escape' && searchOverlay && searchOverlay.classList.contains('is-open')) {
      closeSearch();
    }
  });

  // -------------------------------------------------------
  // Browser Storage Viewer Modal
  // -------------------------------------------------------
  var cookieToggle = document.getElementById('cookie-toggle');
  var cookieOverlay = document.getElementById('cookie-overlay');
  var cookieClose = document.getElementById('cookie-close');
  var cookieBody = document.getElementById('cookie-body');

  // -- Helpers --

  function truncate(str, max) {
    if (!str) return '—';
    return str.length > max ? str.substring(0, max) + '…' : str;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function flagHtml(val) {
    if (val) return '<span class="cookie-card__value cookie-card__value--flag cookie-card__value--yes">Yes</span>';
    return '<span class="cookie-card__value cookie-card__value--flag cookie-card__value--no">No</span>';
  }

  function detectType(value) {
    if (value === 'true' || value === 'false') return 'boolean';
    if (value !== '' && !isNaN(Number(value))) return 'number';
    try {
      var parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return 'array';
      if (typeof parsed === 'object' && parsed !== null) return 'object';
    } catch (e) { /* not JSON */ }
    return 'string';
  }

  function byteSize(str) {
    var bytes = new Blob([str]).size;
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  // -- Data Gathering --

  function parseCookies() {
    var raw = document.cookie;
    if (!raw || !raw.trim()) return [];
    return raw.split(';').map(function (entry) {
      var parts = entry.trim().split('=');
      var name = decodeURIComponent(parts[0]);
      var value = parts.slice(1).join('=');
      try { value = decodeURIComponent(value); } catch (e) { /* keep raw */ }
      return { name: name, value: value };
    });
  }

  // CookieStore API (Chrome/Edge) — richer cookie data as progressive enhancement
  function parseCookiesAsync(callback) {
    if ('cookieStore' in window) {
      window.cookieStore.getAll().then(function (cookies) {
        callback(cookies.map(function (c) {
          return {
            name: c.name,
            value: c.value,
            domain: c.domain || location.hostname,
            path: c.path || '/',
            secure: c.secure,
            sameSite: c.sameSite || 'N/A',
            expires: c.expires ? new Date(c.expires).toISOString() : 'Session',
            source: 'CookieStore API'
          };
        }));
      })['catch'](function () { callback(null); });
    } else {
      callback(null);
    }
  }

  // Known cookies from the site's third-party services
  // Keep in sync with /pages/privacy.md third-party services table
  function getKnownCookies() {
    var consent = window.__cookieConsent || { functional: false, resolved: false };
    return [
      {
        name: '_gh_sess',
        service: 'GitHub Pages',
        purpose: 'Session management for GitHub-hosted pages',
        type: 'HttpOnly',
        category: 'Infrastructure',
        active: true
      },
      {
        name: '_octo',
        service: 'GitHub Pages',
        purpose: 'GitHub analytics and tracking token',
        type: 'HttpOnly',
        category: 'Infrastructure',
        active: true
      },
      {
        name: 'logged_in',
        service: 'GitHub',
        purpose: 'Indicates GitHub login state',
        type: 'HttpOnly',
        category: 'Infrastructure',
        active: true
      },
      {
        name: '__cf_bm',
        service: 'hCaptcha (Cloudflare)',
        purpose: 'Bot management and challenge verification',
        type: 'Third-party',
        category: 'Functional',
        active: consent.functional
      },
      {
        name: 'hc_accessibility',
        service: 'hCaptcha',
        purpose: 'Accessibility preferences for CAPTCHA challenges',
        type: 'Third-party',
        category: 'Functional',
        active: consent.functional
      },
      {
        name: 'hmt_id',
        service: 'hCaptcha',
        purpose: 'Device fingerprint for bot detection',
        type: 'Third-party',
        category: 'Functional',
        active: consent.functional
      },
      {
        name: 'firebase_auth',
        service: 'Firebase',
        purpose: 'Authentication state and session tokens',
        type: 'Third-party / IndexedDB',
        category: 'Functional',
        active: consent.functional
      }
    ];
  }

  function parseStorage(storage) {
    var items = [];
    try {
      for (var i = 0; i < storage.length; i++) {
        var key = storage.key(i);
        var val = storage.getItem(key);
        items.push({ name: key, value: val || '' });
      }
    } catch (e) {
      return null; // access denied
    }
    return items;
  }

  function parseCacheStorage(callback) {
    if (!('caches' in window)) { callback(null); return; }
    var result = [];
    caches.keys().then(function (names) {
      if (!names.length) { callback(result); return; }
      var remaining = names.length;
      names.forEach(function (name) {
        caches.open(name).then(function (cache) {
          return cache.keys();
        }).then(function (requests) {
          var urls = requests.map(function (r) { return r.url; });
          result.push({ cacheName: name, urls: urls });
          remaining--;
          if (remaining === 0) callback(result);
        })['catch'](function () {
          remaining--;
          if (remaining === 0) callback(result);
        });
      });
    })['catch'](function () {
      callback(null);
    });
  }

  // -- Section Builder --

  function buildSection(id, emoji, title, count, isCollapsed, contentHtml) {
    var expanded = isCollapsed ? 'false' : 'true';
    var collapsedClass = isCollapsed ? ' is-collapsed' : '';
    var countLabel = (typeof count === 'string') ? count : (count === 0 ? 'empty' : count);
    var html = '';
    html += '<div class="storage-section" id="storage-' + id + '">';
    html += '  <button class="storage-section__toggle" aria-expanded="' + expanded + '" aria-controls="storage-' + id + '-content">';
    html += '    <span class="storage-section__icon">' + emoji + '</span>';
    html += '    <span class="storage-section__title">' + title + '</span>';
    html += '    <span class="storage-section__count">' + countLabel + '</span>';
    html += '    <span class="storage-section__chevron">&#9658;</span>';
    html += '  </button>';
    html += '  <div class="storage-section__content' + collapsedClass + '" id="storage-' + id + '-content">';
    html += contentHtml;
    html += '  </div>';
    html += '</div>';
    return html;
  }

  // -- Card Builders --

  function buildCookieCardHtml(cookies) {
    if (!cookies.length) return '<p class="storage-section__empty">No cookies found for this domain.</p>';
    var defaultDomain = location.hostname;
    var defaultPath = '/';
    var defaultSecure = location.protocol === 'https:';
    var html = '';
    cookies.forEach(function (c) {
      var domain = c.domain || defaultDomain;
      var path = c.path || defaultPath;
      var secure = (typeof c.secure === 'boolean') ? c.secure : defaultSecure;
      var sameSite = c.sameSite || 'N/A';
      var expires = c.expires || 'Session';

      html += '<div class="cookie-card">';
      html += '  <div class="cookie-card__name">' + escapeHtml(truncate(c.name, 40)) + '</div>';
      html += '  <div class="cookie-card__grid">';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Value</span><span class="cookie-card__value">' + escapeHtml(truncate(c.value, 60)) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Domain</span><span class="cookie-card__value">' + escapeHtml(domain) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Path</span><span class="cookie-card__value">' + escapeHtml(path) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Secure</span>' + flagHtml(secure) + '</div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">SameSite</span><span class="cookie-card__value">' + escapeHtml(sameSite) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Expires</span><span class="cookie-card__value">' + escapeHtml(truncate(expires, 30)) + '</span></div>';
      html += '  </div>';
      html += '</div>';
    });
    return html;
  }

  function buildStorageCards(items) {
    if (items === null) return '<p class="storage-section__empty">Access denied (private browsing or storage blocked).</p>';
    if (!items.length) return '<p class="storage-section__empty">No items found.</p>';
    var html = '';
    items.forEach(function (item) {
      var type = detectType(item.value);
      var size = byteSize(item.name + item.value);
      html += '<div class="cookie-card">';
      html += '  <div class="cookie-card__name">' + escapeHtml(truncate(item.name, 40)) + '</div>';
      html += '  <div class="cookie-card__grid">';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Value</span><span class="cookie-card__value">' + escapeHtml(truncate(item.value, 120)) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Type</span><span class="cookie-card__value">' + type + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Size</span><span class="cookie-card__value">' + size + '</span></div>';
      html += '  </div>';
      html += '</div>';
    });
    return html;
  }

  function buildCacheCards(cacheData) {
    if (cacheData === null) return '<p class="storage-section__empty">Cache Storage API not available.</p>';
    if (!cacheData.length) return '<p class="storage-section__empty">No caches found.</p>';
    var html = '';
    cacheData.forEach(function (cache) {
      var urlCount = cache.urls.length;
      var maxUrls = 20;
      html += '<div class="cookie-card">';
      html += '  <div class="cookie-card__name">' + escapeHtml(truncate(cache.cacheName, 60)) + ' <span class="cookie-card__value" style="font-weight:400">(' + urlCount + ' entries)</span></div>';
      html += '  <ul class="cache-url-list">';
      var limit = Math.min(urlCount, maxUrls);
      for (var i = 0; i < limit; i++) {
        html += '    <li>' + escapeHtml(cache.urls[i]) + '</li>';
      }
      if (urlCount > maxUrls) {
        html += '    <li class="cache-url-list__more">and ' + (urlCount - maxUrls) + ' more…</li>';
      }
      html += '  </ul>';
      html += '</div>';
    });
    return html;
  }

  function buildKnownCookieCards(knownCookies) {
    if (!knownCookies.length) return '<p class="storage-section__empty">No known service cookies documented.</p>';
    var html = '';
    knownCookies.forEach(function (c) {
      var activeClass = c.active ? 'cookie-card__status--active' : 'cookie-card__status--inactive';
      var activeLabel = c.active ? 'Active' : 'Inactive';
      html += '<div class="cookie-card cookie-card--known">';
      html += '  <div class="cookie-card__name">';
      html += '    <span class="cookie-card__service">' + escapeHtml(c.service) + '</span>';
      html += '    ' + escapeHtml(c.name);
      html += '  </div>';
      html += '  <div class="cookie-card__grid">';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Purpose</span><span class="cookie-card__value">' + escapeHtml(c.purpose) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Type</span><span class="cookie-card__value">' + escapeHtml(c.type) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Category</span><span class="cookie-card__value">' + escapeHtml(c.category) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Status</span><span class="cookie-card__value cookie-card__value--flag ' + activeClass + '">' + activeLabel + '</span></div>';
      html += '  </div>';
      html += '</div>';
    });
    return html;
  }

  function buildCookieSectionHtml(cookies, knownCookies) {
    var html = '';

    // Info note
    html += '<div class="storage-section__info">';
    html += '<strong>Note:</strong> JavaScript cannot read HttpOnly or third-party domain cookies. ';
    html += 'The &ldquo;Known Service Cookies&rdquo; below are documented by this site&rsquo;s integrated services. ';
    html += '<a href="/pages/privacy/">See Privacy Policy</a>';
    html += '</div>';

    // Detected cookies subsection
    html += '<h4 class="storage-subsection__title">Detected Cookies</h4>';
    html += '<div class="storage-subsection__detected">';
    if (!cookies.length) {
      html += '<p class="storage-section__empty">This site uses localStorage for its own data. ';
      html += 'No first-party cookies were detected via <code>document.cookie</code>.</p>';
    } else {
      html += buildCookieCardHtml(cookies);
    }
    html += '</div>';

    // Known service cookies subsection
    html += '<h4 class="storage-subsection__title">Known Service Cookies</h4>';
    html += buildKnownCookieCards(knownCookies);

    return html;
  }

  // -- Orchestrator --

  function buildModalContent() {
    var cookies = parseCookies();
    var knownCookies = getKnownCookies();
    var localItems = parseStorage(localStorage);
    var sessionItems = parseStorage(sessionStorage);
    var hasCacheApi = 'caches' in window;

    var totalSync = cookies.length + (localItems ? localItems.length : 0) + (sessionItems ? sessionItems.length : 0);
    var cookieCountLabel = cookies.length + ' detected \u00b7 ' + knownCookies.length + ' known';

    var html = '';
    html += buildSection('cookies', '🍪', 'Cookies', cookieCountLabel, false, buildCookieSectionHtml(cookies, knownCookies));
    html += buildSection('local', '💾', 'localStorage', localItems ? localItems.length : 0, false, buildStorageCards(localItems));
    html += buildSection('session', '📋', 'sessionStorage', sessionItems ? sessionItems.length : 0, true, buildStorageCards(sessionItems));

    if (hasCacheApi) {
      html += buildSection('cache', '📦', 'Cache Storage', '…', true, '<p class="storage-section__loading">Loading cache data…</p>');
    }

    if (totalSync === 0 && !hasCacheApi && knownCookies.length === 0) {
      cookieBody.innerHTML = '<p class="cookie-empty">No browser storage data found for this domain.</p>';
      return;
    }

    cookieBody.innerHTML = html;

    // Attach toggle handlers
    var toggles = cookieBody.querySelectorAll('.storage-section__toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', function () {
        var expanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', String(!expanded));
        var contentId = this.getAttribute('aria-controls');
        var content = document.getElementById(contentId);
        if (content) content.classList.toggle('is-collapsed');
      });
    }

    // Load Cache Storage async
    if (hasCacheApi) {
      parseCacheStorage(function (cacheData) {
        var cacheContent = document.getElementById('storage-cache-content');
        var cacheSection = document.getElementById('storage-cache');
        if (!cacheContent || !cacheSection) return;

        var count = 0;
        if (cacheData) {
          cacheData.forEach(function (c) { count += c.urls.length; });
        }

        // Update count badge
        var badge = cacheSection.querySelector('.storage-section__count');
        if (badge) badge.textContent = cacheData ? count : 0;

        cacheContent.innerHTML = buildCacheCards(cacheData);
      });
    }

    // CookieStore API async enhancement (Chrome/Edge)
    parseCookiesAsync(function (richCookies) {
      if (!richCookies || !richCookies.length) return;
      var cookieSection = document.getElementById('storage-cookies');
      if (!cookieSection) return;

      // Update count badge with actual detected count
      var badge = cookieSection.querySelector('.storage-section__count');
      if (badge) badge.textContent = richCookies.length + ' detected \u00b7 ' + getKnownCookies().length + ' known';

      // Rebuild detected cookies with richer data
      var detectedEl = cookieSection.querySelector('.storage-subsection__detected');
      if (detectedEl) {
        detectedEl.innerHTML = buildCookieCardHtml(richCookies.map(function (c) {
          return { name: c.name, value: c.value, domain: c.domain, path: c.path, secure: c.secure, sameSite: c.sameSite, expires: c.expires };
        }));
      }
    });
  }

  // -- Modal Open / Close --

  function openCookieModal() {
    if (!cookieOverlay) return;
    buildModalContent();
    cookieOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { cookieClose && cookieClose.focus(); }, 100);
  }

  function closeCookieModal() {
    if (!cookieOverlay) return;
    cookieOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (cookieToggle) {
    cookieToggle.addEventListener('click', openCookieModal);
  }
  if (cookieClose) {
    cookieClose.addEventListener('click', closeCookieModal);
  }
  if (cookieOverlay) {
    cookieOverlay.addEventListener('click', function (e) {
      if (e.target === cookieOverlay) closeCookieModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && cookieOverlay && cookieOverlay.classList.contains('is-open')) {
      closeCookieModal();
    }
  });

  // -------------------------------------------------------
  // Status Banner (dismiss + sessionStorage)
  // -------------------------------------------------------
  var statusBanner = document.getElementById('status-banner');
  if (statusBanner) {
    statusBanner.querySelector('.status-banner__close').addEventListener('click', function () {
      statusBanner.classList.add('is-hidden');
      setTimeout(function () { statusBanner.remove(); }, 300);
    });
  }

  // -------------------------------------------------------
  // Parallax Backdrop
  // -------------------------------------------------------
  // Decouple the transform from the scroll event rate: scroll events only
  // update the target offset, and a RAF loop lerps the current offset toward
  // it. This keeps the image moving smoothly between the bursty scroll events
  // mobile browsers fire during momentum scrolling (the "skip on release" bug).
  var backdropImg = document.querySelector('.parallax-backdrop__img');
  if (backdropImg) {
    var reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var targetY = window.scrollY * 0.35;
    var currentY = targetY;
    var rafId = null;

    function applyBackdrop(y) {
      backdropImg.style.transform = 'translate3d(0,' + y + 'px,0)';
    }

    function tickBackdrop() {
      var dy = targetY - currentY;
      if (Math.abs(dy) < 0.25) {
        currentY = targetY;
        applyBackdrop(currentY);
        rafId = null;
        return;
      }
      currentY += dy * 0.18;
      applyBackdrop(currentY);
      rafId = requestAnimationFrame(tickBackdrop);
    }

    function scheduleBackdrop() {
      targetY = window.scrollY * 0.35;
      if (reduceMotion) {
        currentY = targetY;
        applyBackdrop(currentY);
        return;
      }
      if (rafId === null) rafId = requestAnimationFrame(tickBackdrop);
    }

    applyBackdrop(currentY);
    window.addEventListener('scroll', scheduleBackdrop, { passive: true });
  }

})();

/* --------------------------------------------------------------
   Sticky h2 single-active observer.
   `position: sticky` does NOT auto-replace sibling stickies that
   share a containing block — they all pin and overlap. To get the
   "current section banner" effect, observe a 1px sentinel placed
   immediately before each h2 (sentinels don't change size when the
   h2 toggles .is-stuck, so the observer never feedback-loops on
   itself) and apply .is-stuck only to the latest scrolled-past h2.
   Earlier h2s get .is-passed → position: relative so they fall out
   of sticky and don't stack at the top.
   See the matching CSS in assets/css/style.css.
   -------------------------------------------------------------- */
(function () {
  'use strict';

  var nodes = document.querySelectorAll(
    '.post-body[itemprop="articleBody"] h2, .page-body h2'
  );
  var headings = Array.prototype.filter.call(nodes, function (h) {
    if (h.classList.contains('no-stick')) return false;
    if (h.closest('.post--no-sticky, .page-body--no-sticky')) return false;
    return true;
  });
  if (!headings.length || !('IntersectionObserver' in window)) return;

  var rootEl    = document.documentElement;
  var headerRem = parseFloat(getComputedStyle(rootEl).getPropertyValue('--header-height')) || 3.75;
  var rootFont  = parseFloat(getComputedStyle(rootEl).fontSize) || 16;
  var headerPx  = Math.round(headerRem * rootFont);

  var sentinels = headings.map(function (h) {
    var s = document.createElement('div');
    s.className = 'sticky-h2-sentinel';
    s.setAttribute('aria-hidden', 'true');
    h.parentNode.insertBefore(s, h);
    return s;
  });

  // Wrap each h2's children in a span so .is-stuck can shrink the title via
  // `transform: scale()` without changing the h2's box height. Shrinking
  // font-size on the h2 itself reflows every sentinel below it; on a tight
  // boundary that can push the next sentinel across the threshold and cause
  // the stuck banner to flicker between two h2s.
  headings.forEach(function (h) {
    var span = document.createElement('span');
    span.className = 'sticky-h2-content';
    while (h.firstChild) span.appendChild(h.firstChild);
    h.appendChild(span);
  });

  var passedSet = new Set();

  function applyState() {
    var lastPassedIdx = -1;
    for (var i = 0; i < sentinels.length; i++) {
      if (passedSet.has(sentinels[i])) lastPassedIdx = i;
    }
    headings.forEach(function (h, i) {
      h.classList.toggle('is-stuck',  i === lastPassedIdx);
      h.classList.toggle('is-passed', i <  lastPassedIdx);
    });
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      // intersectionRatio < 1 is true for elements both above AND below the
      // adjusted root, so it can't tell us which side. Use the sentinel's
      // viewport-relative top: < threshold = scrolled past, otherwise not.
      if (entry.boundingClientRect.top < headerPx + 1) passedSet.add(entry.target);
      else passedSet.delete(entry.target);
    });
    applyState();
  }, {
    threshold: [1],
    rootMargin: '-' + (headerPx + 1) + 'px 0px 0px 0px'
  });

  sentinels.forEach(function (s) { observer.observe(s); });
})();
