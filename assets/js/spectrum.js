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

  // Modal infrastructure (built lazily on first open).
  var modal, termEl, expandEl, bodyEl, lastFocus;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'spectrum-abbr-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.hidden = true;
    modal.innerHTML =
      '<div class="spectrum-abbr-modal__backdrop"></div>' +
      '<div class="spectrum-abbr-modal__panel" role="document">' +
        '<button type="button" class="spectrum-abbr-modal__close" aria-label="Close">×</button>' +
        '<h3 class="spectrum-abbr-modal__term"></h3>' +
        '<p class="spectrum-abbr-modal__expansion"></p>' +
        '<p class="spectrum-abbr-modal__body"></p>' +
      '</div>';
    document.body.appendChild(modal);
    termEl   = modal.querySelector('.spectrum-abbr-modal__term');
    expandEl = modal.querySelector('.spectrum-abbr-modal__expansion');
    bodyEl   = modal.querySelector('.spectrum-abbr-modal__body');
    modal.querySelector('.spectrum-abbr-modal__backdrop').addEventListener('click', closeModal);
    modal.querySelector('.spectrum-abbr-modal__close').addEventListener('click', closeModal);
    return modal;
  }

  function openModal(term) {
    var def = DICT[term];
    if (!def) {
      // Allow custom <abbr title="..."> fallback content too.
      def = { expansion: term, body: term };
    }
    ensureModal();
    termEl.textContent = term;
    expandEl.textContent = def.expansion || '';
    bodyEl.textContent = def.body || '';
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.querySelector('.spectrum-abbr-modal__close').focus();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  // Decorate the table body (header is already short and stable).
  var tbody = table.querySelector('tbody');
  if (tbody) decorate(tbody);

  // Click / keyboard activation works document-wide so the abbreviation legend
  // cards (.abbr-card) and the in-table .abbr-trigger spans / native <abbr>
  // tags / any future [data-abbr] markup all open the same modal.
  function activateFromEvent(e) {
    var t = e.target.closest('.abbr-trigger, .abbr-card, abbr[title], [data-abbr]');
    if (!t) return;
    e.preventDefault();
    var term = t.getAttribute('data-abbr') ||
               (t.querySelector('.abbr-card__term') && t.querySelector('.abbr-card__term').textContent.trim()) ||
               t.textContent.trim();
    openModal(term);
  }
  document.addEventListener('click', activateFromEvent);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('.abbr-trigger, .abbr-card, abbr[title], [data-abbr]')) return;
    activateFromEvent(e);
  });
})();
