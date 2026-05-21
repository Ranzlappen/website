/* CLI Command Cheat Sheet — wires the shared reference-table behaviour
   (assets/js/reference-table.js) to this page's DOM IDs. */
(function () {
  if (typeof window.initReferenceTable !== 'function') return;
  window.initReferenceTable({
    tableId:     'cmd-table',
    tabSelector: '.reference-tab',
    searchId:    'cmd-search',
    countId:     'cmd-count',
    emptyId:     'cmd-empty',
    blurbId:     'cmd-batch-blurb',
    batchDataId: 'cmd-batch-data',
    rowsLabel:   'commands',
  });
})();
