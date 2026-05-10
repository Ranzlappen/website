/* ============================================================================
 * Abbreviations / Glossary — shared site-wide utility
 * ----------------------------------------------------------------------------
 * Paired with _includes/abbreviations-section.html and assets/css/abbreviations.css.
 * Each consuming page emits a JSON data island via the include, and optionally
 * marks one or more elements with `data-abbr-decorate` to opt into in-content
 * auto-decoration of matching terms.
 * ============================================================================ */
(function () {
  // Build the dictionary from every data island on the page (typically one).
  var DICT = {};
  var islands = document.querySelectorAll('script[type="application/json"][data-abbr-source]');
  for (var i = 0; i < islands.length; i++) {
    try {
      var partial = JSON.parse(islands[i].textContent || '{}');
      for (var key in partial) {
        if (Object.prototype.hasOwnProperty.call(partial, key)) DICT[key] = partial[key];
      }
    } catch (_) { /* ignore malformed island */ }
  }
  if (Object.keys(DICT).length === 0) return;

  // Sort longest first so 'ADS-B' is matched before 'ADS', 'Ka-band' before
  // 'K-band', 'FR2' before 'FR', etc.
  var TERMS = Object.keys(DICT).sort(function (a, b) { return b.length - a.length; });
  // Unicode-aware "word" boundaries (lookarounds excluding letters/digits/_)
  // so terms whose first or last character is a Greek letter (λ, μ, ν) match
  // table-cell text correctly, while preventing 'eV' from matching inside
  // 'μeV'. Requires the `u` flag.
  var WORD_RE = new RegExp(
    '(?<![\\p{L}\\p{N}_])(' +
      TERMS.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') +
    ')(?![\\p{L}\\p{N}_])',
    'gu'
  );

  // ---- Auto-decoration (opt-in) -------------------------------------------
  function decorate(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        // Skip nodes already inside an .abbr-trigger or .abbr-link, or inside
        // a script/style.
        var p = node.parentNode;
        while (p && p !== root) {
          if (p.classList && (p.classList.contains('abbr-trigger') ||
                              p.classList.contains('abbr-link'))) {
            return NodeFilter.FILTER_REJECT;
          }
          if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        WORD_RE.lastIndex = 0;
        return WORD_RE.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    var targets = [];
    while (walker.nextNode()) targets.push(walker.currentNode);

    targets.forEach(function (node) {
      WORD_RE.lastIndex = 0;
      var text = node.nodeValue;
      var frag = document.createDocumentFragment();
      var lastIndex = 0;
      var m;
      while ((m = WORD_RE.exec(text)) !== null) {
        if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
        var span = document.createElement('span');
        span.className = 'abbr-trigger';
        span.setAttribute('data-abbr', m[1]);
        span.setAttribute('tabindex', '0');
        span.setAttribute('role', 'button');
        span.setAttribute('aria-label', m[1] + ' — click for explanation');
        span.textContent = m[1];
        frag.appendChild(span);
        lastIndex = m.index + m[1].length;
      }
      if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  var decorateRoots = document.querySelectorAll('[data-abbr-decorate]');
  for (var d = 0; d < decorateRoots.length; d++) decorate(decorateRoots[d]);

  // ---- Modal stack (recursive) -------------------------------------------
  // Each .abbr-link inside an open modal opens its own modal on top of the
  // current one. Escape / × / backdrop click close the topmost modal only.
  var modalStack = [];

  function buildModal(term, def) {
    var m = document.createElement('div');
    m.className = 'abbr-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML =
      '<div class="abbr-modal__backdrop"></div>' +
      '<div class="abbr-modal__panel" role="document">' +
        '<button type="button" class="abbr-modal__close" aria-label="Close">×</button>' +
        '<h3 class="abbr-modal__term"></h3>' +
        '<p class="abbr-modal__expansion"></p>' +
        '<div class="abbr-modal__body"></div>' +
      '</div>';
    m.querySelector('.abbr-modal__term').textContent = term;
    m.querySelector('.abbr-modal__expansion').textContent = def.expansion || '';
    // body uses innerHTML so embedded <span class="abbr-link"> markup renders.
    var bodyEl = m.querySelector('.abbr-modal__body');
    bodyEl.innerHTML = def.body || '';
    // Make embedded .abbr-link spans keyboard-activatable (the YAML ships them
    // as bare markup; tabindex/role/aria are added here so the recursive flow
    // is reachable without a mouse).
    var links = bodyEl.querySelectorAll('.abbr-link');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (!a.hasAttribute('tabindex')) a.setAttribute('tabindex', '0');
      if (!a.hasAttribute('role')) a.setAttribute('role', 'link');
      if (!a.hasAttribute('aria-label')) {
        var t = a.getAttribute('data-abbr') || a.textContent.trim();
        a.setAttribute('aria-label', t + ' — click or press Enter for explanation');
      }
    }
    m.querySelector('.abbr-modal__backdrop').addEventListener('click', function () { closeModal(m); });
    m.querySelector('.abbr-modal__close').addEventListener('click', function () { closeModal(m); });
    return m;
  }

  function openModal(term) {
    var def = DICT[term] || { expansion: term, body: term };
    var m = buildModal(term, def);
    document.body.appendChild(m);
    document.body.classList.add('abbr-modal-open');
    modalStack.push({ modal: m, lastFocus: document.activeElement });
    m.querySelector('.abbr-modal__close').focus();
  }

  function closeModal(m) {
    var idx = -1;
    for (var i = modalStack.length - 1; i >= 0; i--) {
      if (modalStack[i].modal === m) { idx = i; break; }
    }
    if (idx === -1) return;
    var entry = modalStack.splice(idx, 1)[0];
    entry.modal.remove();
    if (modalStack.length === 0) {
      document.body.classList.remove('abbr-modal-open');
      if (entry.lastFocus && typeof entry.lastFocus.focus === 'function') entry.lastFocus.focus();
    } else {
      var top = modalStack[modalStack.length - 1].modal;
      var closeBtn = top.querySelector('.abbr-modal__close');
      if (closeBtn) closeBtn.focus();
    }
  }

  function closeTopModal() {
    if (modalStack.length === 0) return;
    closeModal(modalStack[modalStack.length - 1].modal);
  }

  // ---- Activation (works for cards, triggers, abbr[title], data-abbr) ----
  var ACTIVATE_SELECTOR = '.abbr-trigger, .abbr-card, abbr[title], [data-abbr], .abbr-link';
  function activateFromEvent(e) {
    var t = e.target.closest(ACTIVATE_SELECTOR);
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    var term = t.getAttribute('data-abbr') ||
               (t.querySelector('.abbr-card__term') && t.querySelector('.abbr-card__term').textContent.trim()) ||
               t.textContent.trim();
    openModal(term);
  }
  document.addEventListener('click', activateFromEvent);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeTopModal(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest(ACTIVATE_SELECTOR)) return;
    activateFromEvent(e);
  });
})();
