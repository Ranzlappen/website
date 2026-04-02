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
  // View Toggle (Grid / List)
  // -------------------------------------------------------
  var viewGrid = document.getElementById('view-grid');
  var viewList = document.getElementById('view-list');
  var postsGrid = document.getElementById('posts-grid');
  var postsList = document.getElementById('posts-list');

  if (viewGrid && viewList) {
    var saved = localStorage.getItem('viewMode') || 'grid';
    applyView(saved);

    viewGrid.addEventListener('click', function () { applyView('grid'); });
    viewList.addEventListener('click', function () { applyView('list'); });
  }

  function applyView(mode) {
    if (!postsGrid || !postsList) return;
    if (mode === 'list') {
      postsGrid.hidden = true;
      postsList.hidden = false;
      viewGrid.classList.remove('active');
      viewList.classList.add('active');
    } else {
      postsGrid.hidden = false;
      postsList.hidden = true;
      viewGrid.classList.add('active');
      viewList.classList.remove('active');
    }
    localStorage.setItem('viewMode', mode);
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
  // Cookie Viewer Modal
  // -------------------------------------------------------
  var cookieToggle = document.getElementById('cookie-toggle');
  var cookieOverlay = document.getElementById('cookie-overlay');
  var cookieClose = document.getElementById('cookie-close');
  var cookieBody = document.getElementById('cookie-body');

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

  function truncate(str, max) {
    if (!str) return '—';
    return str.length > max ? str.substring(0, max) + '…' : str;
  }

  function formatDate(d) {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function timeRemaining(expires) {
    var now = Date.now();
    var diff = expires - now;
    if (diff <= 0) return 'Expired';
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return days + 'd ' + hours + 'h remaining';
    var mins = Math.floor((diff % 3600000) / 60000);
    return hours + 'h ' + mins + 'm remaining';
  }

  function agePct(created, expires) {
    var now = Date.now();
    if (expires <= now) return 100;
    var total = expires - created;
    if (total <= 0) return 100;
    var elapsed = now - created;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }

  function flagHtml(val) {
    if (val) return '<span class="cookie-card__value cookie-card__value--flag cookie-card__value--yes">Yes</span>';
    return '<span class="cookie-card__value cookie-card__value--flag cookie-card__value--no">No</span>';
  }

  function buildCookieCards() {
    var cookies = parseCookies();
    if (!cookies.length) {
      cookieBody.innerHTML = '<p class="cookie-empty">No cookies found for this domain.</p>';
      return;
    }

    var html = '';
    cookies.forEach(function (c) {
      // Client JS can only see name=value; other attributes are not exposed.
      // We show what's available and note the limitation.
      var domain = location.hostname;
      var path = '/';
      var isSecure = location.protocol === 'https:';

      // Try to detect expiry from known cookie patterns (not possible from document.cookie)
      var expiresTs = null;
      var createdTs = null;

      // Build card
      html += '<div class="cookie-card">';
      html += '  <div class="cookie-card__name">' + truncate(c.name, 40) + '</div>';
      html += '  <div class="cookie-card__grid">';

      // Value
      html += '    <div class="cookie-card__field">';
      html += '      <span class="cookie-card__label">Value</span>';
      html += '      <span class="cookie-card__value">' + truncate(c.value, 60) + '</span>';
      html += '    </div>';

      // Domain
      html += '    <div class="cookie-card__field">';
      html += '      <span class="cookie-card__label">Domain</span>';
      html += '      <span class="cookie-card__value">' + domain + '</span>';
      html += '    </div>';

      // Path
      html += '    <div class="cookie-card__field">';
      html += '      <span class="cookie-card__label">Path</span>';
      html += '      <span class="cookie-card__value">' + path + '</span>';
      html += '    </div>';

      // Secure
      html += '    <div class="cookie-card__field">';
      html += '      <span class="cookie-card__label">Secure</span>';
      html += '      ' + flagHtml(isSecure);
      html += '    </div>';

      // HttpOnly
      html += '    <div class="cookie-card__field">';
      html += '      <span class="cookie-card__label">HttpOnly</span>';
      html += '      <span class="cookie-card__value cookie-card__value--flag cookie-card__value--no">N/A<\/span>';
      html += '    </div>';

      // SameSite
      html += '    <div class="cookie-card__field">';
      html += '      <span class="cookie-card__label">SameSite</span>';
      html += '      <span class="cookie-card__value cookie-card__value--flag cookie-card__value--no">N/A<\/span>';
      html += '    </div>';

      html += '  </div>';

      // Timeline — session cookie (no expiry visible from JS)
      html += '  <div class="cookie-timeline">';
      html += '    <div class="cookie-timeline__row">';
      html += '      <span>Session cookie (expiry not visible to client JS)</span>';
      html += '    </div>';
      html += '    <div class="cookie-timeline__bar">';
      html += '      <div class="cookie-timeline__fill" style="width: 0%"></div>';
      html += '    </div>';
      html += '  </div>';

      html += '</div>';
    });

    cookieBody.innerHTML = html;
  }

  function openCookieModal() {
    if (!cookieOverlay) return;
    buildCookieCards();
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

  // Escape key closes cookie modal (integrate with existing keydown handler)
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
