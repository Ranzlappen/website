/* Web Dev Tech Stack — wires the shared reference-table behaviour
   (assets/js/reference-table.js) to this page's DOM IDs, and routes code-example
   clicks to the glossary modal (assets/js/abbreviations.js).

   The shared secondary <select> filter (osFilterId/osAttr) is reused here as a
   Layer filter — it ANDs the selected value against each row's data-layer. */
(function () {
  if (typeof window.initReferenceTable === 'function') {
    window.initReferenceTable({
      tableId:     'webdev-table',
      tabSelector: '.reference-tab',
      searchId:    'webdev-search',
      countId:     'webdev-count',
      emptyId:     'webdev-empty',
      blurbId:     'webdev-batch-blurb',
      batchDataId: 'webdev-batch-data',
      rowsLabel:   'technologies',
      sortable:    true,
      osFilterId:  'webdev-layer-filter',
      osAttr:      'data-layer',
    });
  }

  // Code-example explanations. Each `.webdev-example` button carries the
  // explanation in data-explain and the technology name in data-heading;
  // clicking opens an inline glossary modal (heading = tech, example = the code,
  // lead = the explanation). Clicks that land on a decorated glossary term
  // inside the example are left to abbreviations.js's own handler so the term
  // modal opens instead of the example modal.
  function openExample(btn) {
    if (!window.Glossary || typeof window.Glossary.openInline !== 'function') return;
    var code = btn.querySelector('.webdev-example__code');
    window.Glossary.openInline({
      heading: btn.getAttribute('data-heading') || 'Example',
      example: code ? code.textContent : '',
      lead: btn.getAttribute('data-explain') || ''
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('.abbr-trigger, .abbr-link')) return;
    var btn = e.target.closest('.webdev-example');
    if (!btn) return;
    e.preventDefault();
    openExample(btn);
  });
})();
