/* Spectrum reference page — wires the shared reference-table behaviour
   (assets/js/reference-table.js) to spectrum's DOM IDs. The shared init
   handles tab switching, live search, the row counter, the empty state,
   and the active-batch blurb.

   Abbreviation/glossary modal + decoration logic lives in
   /assets/js/abbreviations.js. The spectrum tbody opts in to in-cell
   decoration via the `data-abbr-decorate` attribute. */
(function () {
  if (typeof window.initReferenceTable !== 'function') return;
  window.initReferenceTable({
    tableId:     'spectrum-table',
    tabSelector: '.reference-tab',
    searchId:    'spectrum-search',
    countId:     'spectrum-count',
    emptyId:     'spectrum-empty',
    blurbId:     'spectrum-batch-blurb',
    batchDataId: 'spectrum-batch-data',
  });
})();
