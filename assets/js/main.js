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
  // Status Banner (dismiss + sessionStorage)
  // -------------------------------------------------------
  var statusBanner = document.getElementById('status-banner');
  if (statusBanner) {
    var bannerKey = 'dismissed-banner-' + statusBanner.getAttribute('data-slug');
    if (sessionStorage.getItem(bannerKey)) {
      statusBanner.remove();
    } else {
      statusBanner.querySelector('.status-banner__close').addEventListener('click', function () {
        statusBanner.classList.add('is-hidden');
        sessionStorage.setItem(bannerKey, '1');
        setTimeout(function () { statusBanner.remove(); }, 300);
      });
    }
  }

})();
