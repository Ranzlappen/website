(function () {
  const table  = document.getElementById('spectrum-table');
  if (!table) return;

  const rows   = Array.from(table.querySelectorAll('tbody > tr'));
  const search = document.getElementById('spectrum-search');
  const count  = document.getElementById('spectrum-count');
  const empty  = document.getElementById('spectrum-empty');
  const tabs   = Array.from(document.querySelectorAll('.spectrum-tab'));
  const blurb  = document.getElementById('spectrum-batch-blurb');
  const dataEl = document.getElementById('spectrum-batch-data');

  let batchInfo = {};
  try { batchInfo = JSON.parse(dataEl.textContent || '{}'); } catch (_) { batchInfo = {}; }

  let activeBatch = 'all';
  const totalRows = rows.length;

  function applyFilters() {
    const q = (search.value || '').trim().toLowerCase();
    let visible = 0;
    for (const row of rows) {
      const inBatch = activeBatch === 'all' || row.dataset.batch === activeBatch;
      const matches = !q || row.textContent.toLowerCase().includes(q);
      const show = inBatch && matches;
      row.hidden = !show;
      if (show) visible++;
    }
    if (count) {
      count.textContent = (q || activeBatch !== 'all')
        ? `${visible} / ${totalRows}`
        : `${totalRows} rows`;
    }
    if (empty) empty.hidden = visible !== 0;
  }

  function setActiveBatch(id) {
    activeBatch = id;
    for (const t of tabs) {
      const isActive = t.dataset.batch === id;
      t.classList.toggle('is-active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    if (blurb) {
      const info = batchInfo[id];
      if (id === 'all' || !info) {
        blurb.hidden = true;
        blurb.innerHTML = '';
      } else {
        blurb.hidden = false;
        blurb.innerHTML = '<strong></strong><span></span>';
        blurb.querySelector('strong').textContent = info.name || '';
        blurb.querySelector('span').textContent   = info.description || '';
      }
    }
    applyFilters();
  }

  search.addEventListener('input', applyFilters);
  for (const t of tabs) {
    t.addEventListener('click', () => setActiveBatch(t.dataset.batch));
  }

  applyFilters();
})();

(function () {
  var table = document.getElementById('spectrum-table');
  if (!table) return;

  // Pull the abbreviation dictionary from the Liquid-rendered JSON island so
  // _data/spectrum/abbreviations.yml stays the single source of truth.
  var DICT = {};
  var abbrDataEl = document.getElementById('spectrum-abbr-data');
  if (abbrDataEl) {
    try { DICT = JSON.parse(abbrDataEl.textContent || '{}'); } catch (_) { DICT = {}; }
  }

  // Sort longest first so 'FR2' is matched before 'FR', etc.
  var TERMS = Object.keys(DICT).sort(function (a, b) { return b.length - a.length; });
  if (TERMS.length === 0) return;
  var WORD_RE = new RegExp('\\b(' + TERMS.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\b', 'g');

  // Walk text nodes inside the table body and wrap matches in clickable spans.
  function decorate(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        // Skip nodes already inside an .abbr-trigger or inside a script/style.
        var p = node.parentNode;
        while (p && p !== root) {
          if (p.classList && p.classList.contains('abbr-trigger')) return NodeFilter.FILTER_REJECT;
          if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
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

  // ---- Modal stack (recursive) -------------------------------------------
  // Each .abbr-link inside an open modal opens its own modal on top of the
  // current one. Escape / × / backdrop click close the topmost modal only.
  var modalStack = [];

  function buildModal(term, def) {
    var m = document.createElement('div');
    m.className = 'spectrum-abbr-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML =
      '<div class="spectrum-abbr-modal__backdrop"></div>' +
      '<div class="spectrum-abbr-modal__panel" role="document">' +
        '<button type="button" class="spectrum-abbr-modal__close" aria-label="Close">×</button>' +
        '<h3 class="spectrum-abbr-modal__term"></h3>' +
        '<p class="spectrum-abbr-modal__expansion"></p>' +
        '<div class="spectrum-abbr-modal__body"></div>' +
      '</div>';
    m.querySelector('.spectrum-abbr-modal__term').textContent = term;
    m.querySelector('.spectrum-abbr-modal__expansion').textContent = def.expansion || '';
    // body uses innerHTML so embedded <span class="abbr-link"> markup renders
    // and the document-level click handler picks up clicks on those spans.
    m.querySelector('.spectrum-abbr-modal__body').innerHTML = def.body || '';
    m.querySelector('.spectrum-abbr-modal__backdrop').addEventListener('click', function () { closeModal(m); });
    m.querySelector('.spectrum-abbr-modal__close').addEventListener('click', function () { closeModal(m); });
    return m;
  }

  function openModal(term) {
    var def = DICT[term] || { expansion: term, body: term };
    var m = buildModal(term, def);
    document.body.appendChild(m);
    document.body.classList.add('spectrum-modal-open');
    modalStack.push({ modal: m, lastFocus: document.activeElement });
    m.querySelector('.spectrum-abbr-modal__close').focus();
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
      document.body.classList.remove('spectrum-modal-open');
      if (entry.lastFocus && typeof entry.lastFocus.focus === 'function') entry.lastFocus.focus();
    } else {
      var top = modalStack[modalStack.length - 1].modal;
      var closeBtn = top.querySelector('.spectrum-abbr-modal__close');
      if (closeBtn) closeBtn.focus();
    }
  }

  function closeTopModal() {
    if (modalStack.length === 0) return;
    closeModal(modalStack[modalStack.length - 1].modal);
  }

  // Decorate the table body (header is already short and stable).
  var tbody = table.querySelector('tbody');
  if (tbody) decorate(tbody);

  // Click / keyboard activation works document-wide so the abbreviation legend
  // cards (.abbr-card), the in-table .abbr-trigger spans, native <abbr> tags,
  // and the .abbr-link spans embedded inside modal bodies all open the same
  // modal flow.
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
