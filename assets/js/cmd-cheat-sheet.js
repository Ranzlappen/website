/* CLI Command Cheat Sheet — wires the shared reference-table behaviour
   (assets/js/reference-table.js) to this page's DOM IDs, and routes worked-
   example clicks to the glossary modal (assets/js/abbreviations.js). */
(function () {
  if (typeof window.initReferenceTable === 'function') {
    window.initReferenceTable({
      tableId:     'cmd-table',
      tabSelector: '.reference-tab',
      searchId:    'cmd-search',
      countId:     'cmd-count',
      emptyId:     'cmd-empty',
      blurbId:     'cmd-batch-blurb',
      batchDataId: 'cmd-batch-data',
      rowsLabel:   'commands',
      sortable:    true,
      osFilterId:  'cmd-os-filter',
      osAttr:      'data-os',
    });
  }

  // Worked-example explanations. Each `.cmd-example` button carries the
  // explanation in data-explain and the command name in data-heading; clicking
  // opens an inline glossary modal (heading = command, example = the code,
  // lead = the explanation). Clicks that land on a decorated glossary term
  // inside the example are left to abbreviations.js's own handler so the term
  // modal opens instead of the example modal.
  function openExample(btn) {
    if (!window.Glossary || typeof window.Glossary.openInline !== 'function') return;
    var code = btn.querySelector('.cmd-example__code');
    window.Glossary.openInline({
      heading: btn.getAttribute('data-heading') || 'Example',
      example: code ? code.textContent : '',
      lead: btn.getAttribute('data-explain') || ''
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('.abbr-trigger, .abbr-link')) return;
    var btn = e.target.closest('.cmd-example');
    if (!btn) return;
    e.preventDefault();
    openExample(btn);
  });
})();
