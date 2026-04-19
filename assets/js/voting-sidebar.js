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
  var functionsSdk = null;
  var firebaseReady = false;
  var appCheckReady = false;

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
        var total = 4;
        function onReady() {
          loaded++;
          if (loaded < total) return;
          try {
            if (!firebase.apps || !firebase.apps.length) {
              firebase.initializeApp(cfg);
            }
            db = firebase.database();
            functionsSdk = firebase.functions();
            firebaseReady = true;

            if (cfg.recaptchaSiteKey) {
              try {
                firebase.appCheck().activate(
                  new firebase.appCheck.ReCaptchaEnterpriseProvider(cfg.recaptchaSiteKey),
                  true
                );
                appCheckReady = true;
              } catch (appCheckError) {
                console.warn('App Check activation failed; continuing without App Check token prefetch:', appCheckError);
              }
            } else {
              console.warn('Voting sidebar: recaptchaSiteKey missing. App Check is disabled for this session.');
            }

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

        var s4 = document.createElement('script');
        s4.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js';
        s4.onload = onReady;
        document.head.appendChild(s4);

        var s5 = document.createElement('script');
        s5.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js';
        s5.onload = onReady;
        document.head.appendChild(s5);
      };
      document.head.appendChild(s1);
    });
  }

  // Rules require `auth != null` on reads. Anonymous auth is cheap
  // (persists in IndexedDB across pageviews) and keeps the scanner happy.
  function ensureSignedIn() {
    return new Promise(function (resolve) {
      var auth = firebase.auth();
      if (auth.currentUser) return resolve(true);
      auth.signInAnonymously()
        .then(function () { resolve(true); })
        .catch(function (err) {
          console.warn('Voting sidebar: anonymous sign-in failed:', err);
          resolve(false);
        });
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

    // Persist via Cloud Function (server-validated; App Check enforced)
    if (firebaseReady && functionsSdk) {
      functionsSdk.httpsCallable('castBlogVote')({
        postSlug: postSlug,
        sectionId: s.id,
        direction: direction
      }).catch(function (err) {
        console.warn('Voting sidebar: vote call failed:', err && err.message);
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

    // Rules grant public read only on the leaf `up`/`down` counters,
    // so subscribe per-section rather than reading the whole subtree.
    sections.forEach(function (s, idx) {
      var base = 'votes/' + postSlug + '/' + s.id;
      db.ref(base + '/up').on('value', function (snap) {
        s.up = snap.val() || 0;
        updatePctDisplay(idx);
        if (idx === activeIdx) updateMobilePct(activeIdx);
      }, function (err) {
        console.warn('Voting sidebar: failed to read up counter:', err);
      });
      db.ref(base + '/down').on('value', function (snap) {
        s.down = snap.val() || 0;
        updatePctDisplay(idx);
        if (idx === activeIdx) updateMobilePct(activeIdx);
      }, function (err) {
        console.warn('Voting sidebar: failed to read down counter:', err);
      });
    });

    // Restore "already voted" UI state from localStorage (server still
    // enforces dedup by IP hash; this just gives instant feedback).
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
  }

  // -------------------------------------------------------
  // Init (gated behind cookie consent for DSGVO compliance)
  // -------------------------------------------------------
  function initFirebaseVoting() {
    loadFirebase().then(function (ok) {
      if (!ok) return;
      var tokenStep = appCheckReady
        ? firebase.appCheck().getToken(/* forceRefresh */ false)
            .catch(function (err) {
              console.warn('Voting sidebar: App Check token fetch failed:', err);
            })
        : Promise.resolve();
      tokenStep
        .then(ensureSignedIn)
        .then(function () { loadVotes(); });
    });
  }

  // Only load Firebase after functional consent is given
  if (window.__cookieConsent && window.__cookieConsent.functional) {
    initFirebaseVoting();
  } else {
    window.addEventListener('consent-updated', function handler(e) {
      if (e.detail && e.detail.functional) {
        initFirebaseVoting();
        window.removeEventListener('consent-updated', handler);
      }
    });
  }

  // Set initial mobile bar content
  if (mobileBar && sections.length > 0) {
    document.getElementById('mobile-current-section').textContent = sections[0].label;
  }
})();
