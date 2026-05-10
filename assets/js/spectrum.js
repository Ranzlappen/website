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

// Abbreviation/glossary modal + decoration logic now lives in
// /assets/js/abbreviations.js (shared site-wide). The spectrum table opts in
// to in-cell decoration via the `data-abbr-decorate` attribute on its tbody.
