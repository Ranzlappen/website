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
  // View Toggle (Grid / List / Rolodex)
  // -------------------------------------------------------
  // CHANGE: Extended view toggle to support Rolodex 3D parallax mode
  // REASON: Implement visually impressive card-stack scroll effect on /blog/
  // DATE: 2026-04-04
  var viewGrid = document.getElementById('view-grid');
  var viewList = document.getElementById('view-list');
  var viewRolodex = document.getElementById('view-rolodex');
  var postsGrid = document.getElementById('posts-grid');
  var postsList = document.getElementById('posts-list');
  var postsRolodex = document.getElementById('posts-rolodex');

  if (viewGrid && viewList) {
    var saved = localStorage.getItem('viewMode') || 'rolodex';
    applyView(saved);

    viewGrid.addEventListener('click', function () { applyView('grid'); });
    viewList.addEventListener('click', function () { applyView('list'); });
    if (viewRolodex) {
      viewRolodex.addEventListener('click', function () { applyView('rolodex'); });
    }
  }

  function applyView(mode) {
    if (!postsGrid || !postsList) return;
    var containers = [postsGrid, postsList];
    var buttons = [viewGrid, viewList];
    if (postsRolodex) containers.push(postsRolodex);
    if (viewRolodex) buttons.push(viewRolodex);

    containers.forEach(function (c) { c.hidden = true; });
    buttons.forEach(function (b) { b.classList.remove('active'); });

    document.documentElement.classList.remove('rolodex-active');
    destroyRolodexObserver();

    if (mode === 'list') {
      postsList.hidden = false;
      viewList.classList.add('active');
    } else if (mode === 'rolodex' && postsRolodex) {
      postsRolodex.hidden = false;
      if (viewRolodex) viewRolodex.classList.add('active');
      document.documentElement.classList.add('rolodex-active');
      initRolodexObserver();
    } else {
      mode = 'grid';
      postsGrid.hidden = false;
      viewGrid.classList.add('active');
    }
    localStorage.setItem('viewMode', mode);
  }

  // -------------------------------------------------------
  // Rolodex scroll-driven sticky card stack engine
  // -------------------------------------------------------
  // When CSS animation-timeline: view() is supported the browser handles
  // transforms + opacity via @keyframes rolodex-card-peel; JS only manages
  // z-index and the is-focused class in that case.
  var cssScrollDriven = CSS && CSS.supports && CSS.supports('animation-timeline', 'view()');
  var rolodexRAF = null;
  var rolodexScrollHandler = null;

  function initRolodexObserver() {
    if (rolodexScrollHandler || !postsRolodex) return;
    var cards = postsRolodex.querySelectorAll('.rolodex-card');
    if (!cards.length) return;
    var n = cards.length;

    // Smooth easing: easeInOutCubic for natural acceleration/deceleration
    function ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    function onScroll() {
      if (rolodexRAF) return;
      rolodexRAF = requestAnimationFrame(function () {
        rolodexRAF = null;
        var vh = window.innerHeight;
        var anchorY = vh * 0.40;
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

        // Apply transforms via CSS custom properties — no filter/blur
        for (var i = 0; i < n; i++) {
          var card = cards[i];
          var rect = rects[i];
          var mid = rect.top + rect.height * 0.5;
          var dist = (mid - anchorY) / vh;

          // Off-screen culling
          if (rect.bottom < -100 || rect.top > vh + 250) {
            if (!cssScrollDriven) card.style.opacity = '0';
            card.style.zIndex = '1';
            card.classList.remove('is-focused');
            continue;
          }

          var opacity, shadow;
          var absDist = Math.abs(dist);

          if (absDist < 0.08) {
            // Active zone — fully visible
            opacity = 1;
            shadow = 1;
          } else if (absDist < 0.55) {
            // Fading zone — smooth fade from 1 to 0
            var t = ease(clamp((absDist - 0.08) / 0.47, 0, 1));
            opacity = 1 - t;
            shadow = 1 - t;
          } else {
            // Gone — fully invisible
            opacity = 0;
            shadow = 0;
          }

          // Z-index: focused card highest, others fall off by distance
          var zi;
          if (i === focusIdx) {
            zi = n + 10;
          } else if (i < focusIdx) {
            zi = Math.max(1, n - (focusIdx - i));
          } else {
            zi = Math.max(1, n - (i - focusIdx));
          }

          card.style.zIndex = zi;

          // Focus class for accent glow, shine, and hover flip
          if (i === focusIdx && Math.abs(dist) < 0.18) {
            card.classList.add('is-focused');
          } else {
            card.classList.remove('is-focused');
          }

          // When CSS scroll-driven animations handle transforms + opacity,
          // skip inline style overrides so the @keyframes values take effect.
          if (cssScrollDriven) continue;

          card.style.opacity = opacity;
          card.style.setProperty('--r-shadow', shadow);
        }
      });
    }

    rolodexScrollHandler = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function destroyRolodexObserver() {
    if (rolodexScrollHandler) {
      window.removeEventListener('scroll', rolodexScrollHandler);
      rolodexScrollHandler = null;
    }
    if (rolodexRAF) {
      cancelAnimationFrame(rolodexRAF);
      rolodexRAF = null;
    }
    // Clean up focus classes
    if (postsRolodex) {
      var cards = postsRolodex.querySelectorAll('.rolodex-card');
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
    var countLabel = count === 0 ? 'empty' : count;
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
    var domain = location.hostname;
    var path = '/';
    var isSecure = location.protocol === 'https:';
    var html = '';
    cookies.forEach(function (c) {
      html += '<div class="cookie-card">';
      html += '  <div class="cookie-card__name">' + escapeHtml(truncate(c.name, 40)) + '</div>';
      html += '  <div class="cookie-card__grid">';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Value</span><span class="cookie-card__value">' + escapeHtml(truncate(c.value, 60)) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Domain</span><span class="cookie-card__value">' + escapeHtml(domain) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Path</span><span class="cookie-card__value">' + path + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Secure</span>' + flagHtml(isSecure) + '</div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">HttpOnly</span><span class="cookie-card__value cookie-card__value--flag cookie-card__value--no">N/A</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">SameSite</span><span class="cookie-card__value cookie-card__value--flag cookie-card__value--no">N/A</span></div>';
      html += '  </div>';
      html += '  <div class="cookie-timeline"><div class="cookie-timeline__row"><span>Session cookie (expiry not visible to client JS)</span></div>';
      html += '    <div class="cookie-timeline__bar"><div class="cookie-timeline__fill" style="width: 0%"></div></div>';
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

  // -- Orchestrator --

  function buildModalContent() {
    var cookies = parseCookies();
    var localItems = parseStorage(localStorage);
    var sessionItems = parseStorage(sessionStorage);
    var hasCacheApi = 'caches' in window;

    var totalSync = cookies.length + (localItems ? localItems.length : 0) + (sessionItems ? sessionItems.length : 0);

    var html = '';
    html += buildSection('cookies', '🍪', 'Cookies', cookies.length, false, buildCookieCardHtml(cookies));
    html += buildSection('local', '💾', 'localStorage', localItems ? localItems.length : 0, false, buildStorageCards(localItems));
    html += buildSection('session', '📋', 'sessionStorage', sessionItems ? sessionItems.length : 0, true, buildStorageCards(sessionItems));

    if (hasCacheApi) {
      html += buildSection('cache', '📦', 'Cache Storage', '…', true, '<p class="storage-section__loading">Loading cache data…</p>');
    }

    if (totalSync === 0 && !hasCacheApi) {
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

})();
