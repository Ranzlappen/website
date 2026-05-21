/* ============================================================================
   Shared reference-table behaviour
   Wires up tab switching, live search, row counter, empty state, and active
   batch blurb for any page that uses the `.reference-table-*` scaffolding.

   Usage:
     window.initReferenceTable({
       tableId:    'spectrum-table',       // <table id>
       tabSelector:'.reference-tab',       // CSS selector for tab buttons
       searchId:   'spectrum-search',      // <input id>
       countId:    'spectrum-count',       // optional <span id>
       emptyId:    'spectrum-empty',       // optional empty-state node id
       blurbId:    'spectrum-batch-blurb', // optional active-batch blurb id
       batchDataId:'spectrum-batch-data',  // optional JSON island id
       groupAttr:  'data-batch',           // attribute on tabs + rows (default)
       allValue:   'all',                  // value of groupAttr that shows all
       rowsLabel:  'rows',                 // label for the unfiltered counter
     });
   ============================================================================ */
(function () {
  function initReferenceTable(opts) {
    var o = opts || {};
    var table = document.getElementById(o.tableId);
    if (!table) return;

    var groupAttr = o.groupAttr || 'data-batch';
    var allValue  = o.allValue  || 'all';
    var rowsLabel = o.rowsLabel || 'rows';
    var datasetKey = groupAttr.replace(/^data-/, '').replace(/-([a-z])/g, function (_, c) {
      return c.toUpperCase();
    });

    var rows   = Array.prototype.slice.call(table.querySelectorAll('tbody > tr'));
    var search = o.searchId ? document.getElementById(o.searchId) : null;
    var count  = o.countId  ? document.getElementById(o.countId)  : null;
    var empty  = o.emptyId  ? document.getElementById(o.emptyId)  : null;
    var tabs   = Array.prototype.slice.call(
      document.querySelectorAll(o.tabSelector || '.reference-tab')
    );
    var blurb  = o.blurbId  ? document.getElementById(o.blurbId)  : null;
    var dataEl = o.batchDataId ? document.getElementById(o.batchDataId) : null;

    var batchInfo = {};
    if (dataEl) {
      try { batchInfo = JSON.parse(dataEl.textContent || '{}'); } catch (_) { batchInfo = {}; }
    }

    var activeBatch = allValue;
    var totalRows = rows.length;

    function applyFilters() {
      var q = ((search && search.value) || '').trim().toLowerCase();
      var visible = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var inBatch = activeBatch === allValue || row.dataset[datasetKey] === activeBatch;
        var matches = !q || row.textContent.toLowerCase().indexOf(q) !== -1;
        var show = inBatch && matches;
        row.hidden = !show;
        if (show) visible++;
      }
      if (count) {
        count.textContent = (q || activeBatch !== allValue)
          ? visible + ' / ' + totalRows
          : totalRows + ' ' + rowsLabel;
      }
      if (empty) empty.hidden = visible !== 0;
    }

    function setActiveBatch(id) {
      activeBatch = id;
      for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        var isActive = t.dataset[datasetKey] === id;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
      if (blurb) {
        var info = batchInfo[id];
        if (id === allValue || !info) {
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

    if (search) search.addEventListener('input', applyFilters);
    for (var j = 0; j < tabs.length; j++) {
      (function (t) {
        t.addEventListener('click', function () { setActiveBatch(t.dataset[datasetKey]); });
      })(tabs[j]);
    }

    applyFilters();
  }

  window.initReferenceTable = initReferenceTable;
})();
