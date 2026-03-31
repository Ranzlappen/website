(function () {
  'use strict';

  // Exit early if not on a post page
  var postBody = document.querySelector('.post-body');
  var sidebar = document.getElementById('voting-sidebar');
  var mobileBar = document.getElementById('voting-mobile-bar');
  if (!postBody || !sidebar) return;

  var postSlug = window.__POST_SLUG || 'unknown';
  var headings = postBody.querySelectorAll('h2[id]');
  if (headings.length === 0) return;

  // -------------------------------------------------------
  // Firebase Setup (loaded dynamically)
  // -------------------------------------------------------
  var db = null;
  var firebaseReady = false;
  var visitorHash = null;

  function loadFirebase() {
    // Read config from meta tags or global
    var cfg = window.__FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) {
      console.warn('Voting sidebar: Firebase not configured. Votes will not persist.');
      return Promise.resolve(false);
    }

    return new Promise(function (resolve) {
      var s1 = document.createElement('script');
      s1.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
      s1.onload = function () {
        var loaded = 0;
        var total = 2;
        function onReady() {
          loaded++;
          if (loaded < total) return;
          try {
            var app = firebase.initializeApp(cfg);
            firebase.appCheck().activate(
              new firebase.appCheck.ReCaptchaEnterpriseProvider(cfg.recaptchaSiteKey),
              true
            );
            db = firebase.database();
            firebaseReady = true;
            resolve(true);
          } catch (e) {
            console.warn('Firebase init error:', e);
            resolve(false);
          }
        }

        var s2 = document.createElement('script');
        s2.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js';
        s2.onload = onReady;
        document.head.appendChild(s2);

        var s3 = document.createElement('script');
        s3.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js';
        s3.onload = onReady;
        document.head.appendChild(s3);
      };
      document.head.appendChild(s1);
    });
  }

  // Get a hashed visitor ID via ipify + simple hash
  function getVisitorHash() {
    if (visitorHash) return Promise.resolve(visitorHash);

    return fetch('https://api.ipify.org?format=json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        // Simple hash of IP
        var ip = data.ip || 'anonymous';
        var hash = 0;
        for (var i = 0; i < ip.length; i++) {
          var c = ip.charCodeAt(i);
          hash = ((hash << 5) - hash) + c;
          hash |= 0;
        }
        visitorHash = 'v' + Math.abs(hash).toString(36);
        return visitorHash;
      })
      .catch(function () {
        // Fallback: use a random ID stored in localStorage
        visitorHash = localStorage.getItem('voter_id');
        if (!visitorHash) {
          visitorHash = 'v' + Math.random().toString(36).substr(2, 9);
          localStorage.setItem('voter_id', visitorHash);
        }
        return visitorHash;
      });
  }

  // -------------------------------------------------------
  // Build Sidebar UI
  // -------------------------------------------------------
  var sections = [];

  headings.forEach(function (h, i) {
    var id = h.id;
    var label = h.textContent.trim();
    var shortLabel = label.length > 12 ? label.substring(0, 12) + '…' : label;

    var section = {
      id: id,
      label: label,
      el: h,
      up: 0,
      down: 0,
      voted: false,
      commentCount: 0
    };
    sections.push(section);

    // Desktop sidebar element
    var div = document.createElement('div');
    div.className = 'vote-section';
    div.setAttribute('data-section', id);
    div.innerHTML =
      '<div class="vote-section__label" title="' + label + '">' + shortLabel + '</div>' +
      '<div class="vote-btns">' +
        '<button class="vote-btn" data-vote="up" data-idx="' + i + '" aria-label="Helpful">👍</button>' +
        '<button class="vote-btn" data-vote="down" data-idx="' + i + '" aria-label="Not helpful">👎</button>' +
      '</div>' +
      '<div class="vote-pct" data-pct-idx="' + i + '">—</div>' +
      '<div class="vote-comments" data-comments-idx="' + i + '"></div>';

    // Click to scroll to section
    div.addEventListener('click', function (e) {
      if (e.target.closest('.vote-btn')) return;
      h.scrollIntoView({ behavior: 'smooth' });
    });

    sidebar.appendChild(div);
  });

  // -------------------------------------------------------
  // Scroll Spy
  // -------------------------------------------------------
  var sidebarSections = sidebar.querySelectorAll('.vote-section');
  var activeIdx = 0;

  function updateScrollSpy() {
    var scrollPos = window.scrollY + window.innerHeight * 0.3;
    var newIdx = 0;

    for (var i = sections.length - 1; i >= 0; i--) {
      if (sections[i].el.offsetTop <= scrollPos) {
        newIdx = i;
        break;
      }
    }

    if (newIdx !== activeIdx) {
      sidebarSections[activeIdx].classList.remove('active');
      sidebarSections[newIdx].classList.add('active');
      activeIdx = newIdx;

      // Update mobile bar
      if (mobileBar) {
        var s = sections[activeIdx];
        document.getElementById('mobile-current-section').textContent = s.label;
        updateMobilePct(activeIdx);
      }
    }
  }

  sidebarSections[0].classList.add('active');
  window.addEventListener('scroll', updateScrollSpy, { passive: true });

  // -------------------------------------------------------
  // Voting Logic
  // -------------------------------------------------------
  function castVote(idx, direction) {
    var s = sections[idx];
    if (s.voted) return;
    s.voted = true;

    if (direction === 'up') s.up++;
    else s.down++;

    updatePctDisplay(idx);

    // Mark buttons as voted
    var btns = sidebar.querySelectorAll('[data-idx="' + idx + '"]');
    btns.forEach(function (b) { b.classList.add('voted'); });

    // Persist to Firebase
    if (firebaseReady && db) {
      var ref = db.ref('votes/' + postSlug + '/' + s.id);
      getVisitorHash().then(function (hash) {
        ref.child('voters/' + hash).set(direction);
        ref.child(direction === 'up' ? 'up' : 'down')
          .transaction(function (v) { return (v || 0) + 1; });
      });
    }

    // Store locally too
    try {
      var key = 'voted_' + postSlug;
      var voted = JSON.parse(localStorage.getItem(key) || '{}');
      voted[s.id] = direction;
      localStorage.setItem(key, JSON.stringify(voted));
    } catch (e) {}
  }

  function updatePctDisplay(idx) {
    var s = sections[idx];
    var total = s.up + s.down;
    var pct = total > 0 ? Math.round((s.up / total) * 100) : 0;
    var pctEl = sidebar.querySelector('[data-pct-idx="' + idx + '"]');
    if (pctEl) pctEl.textContent = total > 0 ? pct + '%' : '—';
  }

  function updateMobilePct(idx) {
    var s = sections[idx];
    var total = s.up + s.down;
    var pct = total > 0 ? Math.round((s.up / total) * 100) : 0;
    var el = document.getElementById('mobile-vote-pct');
    if (el) el.textContent = total > 0 ? pct + '% helpful' : '—';
  }

  // Event delegation for vote buttons
  sidebar.addEventListener('click', function (e) {
    var btn = e.target.closest('.vote-btn');
    if (!btn) return;
    e.stopPropagation();
    var idx = parseInt(btn.getAttribute('data-idx'), 10);
    var dir = btn.getAttribute('data-vote');
    castVote(idx, dir);
  });

  // Mobile vote buttons
  if (mobileBar) {
    document.getElementById('mobile-vote-up').addEventListener('click', function () {
      castVote(activeIdx, 'up');
      updateMobilePct(activeIdx);
    });
    document.getElementById('mobile-vote-down').addEventListener('click', function () {
      castVote(activeIdx, 'down');
      updateMobilePct(activeIdx);
    });
  }

  // -------------------------------------------------------
  // Load existing votes from Firebase
  // -------------------------------------------------------
  function loadVotes() {
    if (!firebaseReady || !db) return;

    var ref = db.ref('votes/' + postSlug);
    ref.on('value', function (snap) {
      var data = snap.val() || {};

      sections.forEach(function (s, idx) {
        var sectionData = data[s.id] || {};
        s.up = sectionData.up || 0;
        s.down = sectionData.down || 0;
        updatePctDisplay(idx);
      });
      updateMobilePct(activeIdx);
    });

    // Check if this visitor already voted
    getVisitorHash().then(function (hash) {
      var votedLocal = {};
      try {
        votedLocal = JSON.parse(localStorage.getItem('voted_' + postSlug) || '{}');
      } catch (e) {}

      sections.forEach(function (s, idx) {
        if (votedLocal[s.id]) {
          s.voted = true;
          var btns = sidebar.querySelectorAll('[data-idx="' + idx + '"]');
          btns.forEach(function (b) { b.classList.add('voted'); });
        }
      });
    });
  }

  // -------------------------------------------------------
  // Init
  // -------------------------------------------------------
  loadFirebase().then(function (ok) {
    if (ok) {
      firebase.appCheck().getToken().then(function () {
        loadVotes();
      }).catch(function () {
        loadVotes();
      });
    }
  });

  // Set initial mobile bar content
  if (mobileBar && sections.length > 0) {
    document.getElementById('mobile-current-section').textContent = sections[0].label;
  }
})();
