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
  // 'μeV'. Requires the `u` flag. Wrapped in try/catch: a lookbehind here is
  // unsupported on older Safari (<16.4), and `new RegExp` would otherwise throw
  // at module load — killing the modal + `window.Glossary` along with it. On
  // failure WORD_RE stays null and only auto-decoration is skipped; click-to-
  // explain on cards/triggers still works everywhere.
  var WORD_RE = null;
  try {
    WORD_RE = new RegExp(
      '(?<![\\p{L}\\p{N}_])(' +
        TERMS.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') +
      ')(?![\\p{L}\\p{N}_])',
      'gu'
    );
  } catch (_) { WORD_RE = null; }

  // ---- Auto-decoration (opt-in) -------------------------------------------
  // Ancestor tag names whose text content must never be rewrapped: replacing
  // text inside SVG <text> with HTML <span>s breaks SVG rendering; <code>
  // contains part numbers / unit values that collide with future glossary
  // terms; form controls have no prose-text descendants worth touching.
  // Carve-out: a <code class="abbr-decorate-code"> opts back in — used by the
  // CLI cheat sheet so command tokens inside worked examples (grep, curl, |,
  // regex…) become clickable glossary triggers. Over-matching risk accepted.
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, INPUT: 1, TEXTAREA: 1,
                    SELECT: 1, SVG: 1 };

  function decorate(root) {
    if (!WORD_RE || !root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        // Skip nodes already inside an .abbr-trigger / .abbr-link / .abbr-section,
        // inside a SKIP_TAGS element, or inside an SVG namespace subtree.
        var p = node.parentNode;
        while (p && p !== root) {
          if (p.classList && (p.classList.contains('abbr-trigger') ||
                              p.classList.contains('abbr-link') ||
                              p.classList.contains('abbr-section'))) {
            return NodeFilter.FILTER_REJECT;
          }
          if (p.tagName && SKIP_TAGS[p.tagName.toUpperCase()]) return NodeFilter.FILTER_REJECT;
          if (p.tagName && p.tagName.toUpperCase() === 'CODE' &&
              !(p.classList && p.classList.contains('abbr-decorate-code'))) {
            return NodeFilter.FILTER_REJECT;
          }
          if (p.namespaceURI === 'http://www.w3.org/2000/svg') return NodeFilter.FILTER_REJECT;
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

  // NOTE: the page-wide decoration pass runs at the END of this IIFE (after the
  // modal API + listeners are live), wrapped in try/catch, so a decoration
  // failure can never stop the modal/`window.Glossary` from initialising.

  // ---- Modal stack (recursive) -------------------------------------------
  // Each .abbr-link inside an open modal opens its own modal on top of the
  // current one. Escape / × / backdrop click close the topmost modal only.
  var modalStack = [];

  // Make embedded .abbr-link spans keyboard-activatable (the YAML ships them
  // as bare markup; tabindex/role/aria are added here so the recursive flow
  // is reachable without a mouse).
  function wireAbbrLinks(root) {
    if (!root) return;
    var links = root.querySelectorAll('.abbr-link');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (!a.hasAttribute('tabindex')) a.setAttribute('tabindex', '0');
      if (!a.hasAttribute('role')) a.setAttribute('role', 'link');
      if (!a.hasAttribute('aria-label')) {
        var t = a.getAttribute('data-abbr') || a.textContent.trim();
        a.setAttribute('aria-label', t + ' — click or press Enter for explanation');
      }
    }
  }

  function buildInterpretationTable(interp) {
    var wrap = document.createElement('div');
    wrap.className = 'abbr-interp-table-wrap';
    var table = document.createElement('table');
    table.className = 'abbr-interp-table';
    var thead = document.createElement('thead');
    var hrow = document.createElement('tr');
    (interp.columns || []).forEach(function (c) {
      var th = document.createElement('th');
      th.textContent = c;
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    (interp.rows || []).forEach(function (row) {
      var tr = document.createElement('tr');
      (row || []).forEach(function (cell, idx) {
        var td = document.createElement('td');
        if (idx === 0) td.className = 'abbr-interp-table__head';
        td.textContent = cell == null ? '' : String(cell);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function buildModal(term, def) {
    var m = document.createElement('div');
    m.className = 'abbr-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');

    var hasPlain = !!(def.plain && def.plain.length);
    var hasInterp = !!(def.interpretation && def.interpretation.columns && def.interpretation.rows);

    var panel = document.createElement('div');
    panel.className = 'abbr-modal__panel';
    panel.setAttribute('role', 'document');

    var backdrop = document.createElement('div');
    backdrop.className = 'abbr-modal__backdrop';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'abbr-modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';

    var termEl = document.createElement('h3');
    termEl.className = 'abbr-modal__term';
    termEl.textContent = term;

    var expansionEl = document.createElement('p');
    expansionEl.className = 'abbr-modal__expansion';
    expansionEl.textContent = def.expansion || '';

    panel.appendChild(closeBtn);
    panel.appendChild(termEl);
    panel.appendChild(expansionEl);

    // Visible lead prose (not collapsed). Used by inline example modals to
    // show "what this command does" up front; glossary terms inside it are
    // auto-decorated so the reader can drill further.
    if (def.lead) {
      var leadEl = document.createElement('div');
      leadEl.className = 'abbr-modal__lead';
      leadEl.innerHTML = def.lead;
      wireAbbrLinks(leadEl);
      decorate(leadEl);
      panel.appendChild(leadEl);
    }

    // Plain-English section (beginner-first).
    if (hasPlain) {
      var plainWrap = document.createElement('div');
      plainWrap.className = 'abbr-modal__plain';
      var plainLabel = document.createElement('span');
      plainLabel.className = 'abbr-modal__plain-label';
      plainLabel.textContent = 'In plain English';
      var plainBody = document.createElement('div');
      plainBody.className = 'abbr-modal__plain-body';
      plainBody.innerHTML = def.plain;
      wireAbbrLinks(plainBody);
      plainWrap.appendChild(plainLabel);
      plainWrap.appendChild(plainBody);
      panel.appendChild(plainWrap);
    }

    // Optional shell/code example. Rendered as a <pre><code> block with
    // textContent (literal — escape sequences shown verbatim, not interpreted
    // as HTML). Accepts either a string or an array of strings.
    if (def.example) {
      var exampleText = Array.isArray(def.example) ? def.example.join('\n') : String(def.example);
      var exampleLabel = document.createElement('span');
      exampleLabel.className = 'abbr-modal__example-label';
      exampleLabel.textContent = 'Example';
      var examplePre = document.createElement('pre');
      examplePre.className = 'abbr-modal__example';
      var exampleCode = document.createElement('code');
      exampleCode.textContent = exampleText;
      examplePre.appendChild(exampleCode);
      panel.appendChild(exampleLabel);
      panel.appendChild(examplePre);
    }

    // Interpretation table (the beginner aid — open by default).
    if (hasInterp) {
      var interpDetails = document.createElement('details');
      interpDetails.className = 'abbr-modal__interpretation';
      interpDetails.open = true;
      var interpSummary = document.createElement('summary');
      interpSummary.textContent = def.interpretation.title || 'How to read it';
      interpDetails.appendChild(interpSummary);
      interpDetails.appendChild(buildInterpretationTable(def.interpretation));
      if (def.interpretation.footnote) {
        var footnote = document.createElement('p');
        footnote.className = 'abbr-modal__footnote';
        footnote.innerHTML = def.interpretation.footnote;
        wireAbbrLinks(footnote);
        interpDetails.appendChild(footnote);
      }
      panel.appendChild(interpDetails);
    }

    // Technical body. Collapsed by default when a plain blurb exists so
    // beginners see the friendly text first; open by default otherwise so
    // entries without a plain blurb behave identically to before. Skipped
    // entirely when there's no body (e.g. inline example modals that carry
    // only a lead + example).
    if (def.body) {
      var technicalDetails = document.createElement('details');
      technicalDetails.className = 'abbr-modal__technical';
      technicalDetails.open = !hasPlain;
      var technicalSummary = document.createElement('summary');
      technicalSummary.textContent = 'Technical detail';
      technicalDetails.appendChild(technicalSummary);
      var bodyEl = document.createElement('div');
      bodyEl.className = 'abbr-modal__body';
      bodyEl.innerHTML = def.body || '';
      wireAbbrLinks(bodyEl);
      technicalDetails.appendChild(bodyEl);
      panel.appendChild(technicalDetails);
    }

    m.appendChild(backdrop);
    m.appendChild(panel);

    backdrop.addEventListener('click', function () { closeModal(m); });
    closeBtn.addEventListener('click', function () { closeModal(m); });
    return m;
  }

  // Resolve a lookup key to its canonical {term, def}. An entry whose only
  // field is `aliasOf` redirects to its canonical term (so `globs`, `regexes`,
  // lowercase `posix` etc. open the real Glob / Regex / POSIX card).
  function resolveDef(term) {
    var def = DICT[term];
    if (def && def.aliasOf && DICT[def.aliasOf]) {
      return { term: def.aliasOf, def: DICT[def.aliasOf] };
    }
    return { term: term, def: def || { expansion: term, body: term } };
  }

  function pushModal(m) {
    document.body.appendChild(m);
    document.body.classList.add('abbr-modal-open');
    modalStack.push({ modal: m, lastFocus: document.activeElement });
    m.querySelector('.abbr-modal__close').focus();
  }

  function openModal(term) {
    var r = resolveDef(term);
    pushModal(buildModal(r.term, r.def));
  }

  // Open a modal from inline content rather than a dictionary entry. Used for
  // the cheat sheet's worked-example explanations: heading = command name,
  // example = the invocation, lead = what it does (with terms auto-linked).
  function openInline(opts) {
    opts = opts || {};
    pushModal(buildModal(opts.heading || 'Example', {
      expansion: opts.expansion || '',
      lead: opts.lead || '',
      example: opts.example || null
    }));
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
    if (e.key === 'Tab') { trapTabInTopModal(e); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest(ACTIVATE_SELECTOR)) return;
    activateFromEvent(e);
  });

  // Keep Tab inside the topmost modal while one is open (aria-modal dialogs
  // must not let keyboard focus wander into the page behind them).
  function trapTabInTopModal(e) {
    if (modalStack.length === 0) return;
    var top = modalStack[modalStack.length - 1].modal;
    var focusable = top.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    var arr = Array.prototype.filter.call(focusable, function (el) {
      return el.offsetParent !== null;
    });
    if (!arr.length) return;
    var first = arr[0];
    var last = arr[arr.length - 1];
    if (e.shiftKey && (document.activeElement === first || !top.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !top.contains(document.activeElement))) {
      e.preventDefault();
      first.focus();
    }
  }

  // Public API for pages that need to drive the modal/decoration directly
  // (e.g. cmd-cheat-sheet.js wires worked-example clicks to openInline).
  window.Glossary = {
    openTerm: openModal,
    openInline: openInline,
    decorate: decorate
  };

  // Page-wide auto-decoration runs LAST and defensively: each root is decorated
  // in its own try/catch so one problematic subtree can't abort the whole pass,
  // and the pass as a whole can never prevent the modal API + listeners above
  // from being set up (the cause of dead "?" buttons when decoration threw).
  var decorateRoots = document.querySelectorAll('[data-abbr-decorate]');
  for (var d = 0; d < decorateRoots.length; d++) {
    try {
      decorate(decorateRoots[d]);
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('Glossary decoration failed for a root:', err);
      }
    }
  }
})();
