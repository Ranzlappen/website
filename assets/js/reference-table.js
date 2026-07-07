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
       sortable:   true,                   // optional: click-to-sort every column
       osFilterId: 'cmd-os-filter',        // optional: <select> id for a 2nd filter
       osAttr:     'data-os',              // optional: row attr the 2nd filter tests
     });

   When `sortable`, each <th> (unless it carries `data-no-sort`) gets a sort
   button cycling ascending → descending → original order. A cell's sort key is
   its `data-sort` attribute when present, else its text; numeric when both
   compared values parse as numbers. Only one column sorts at a time.

   Pinned clone header: the wrapper is a horizontal-only scroll box in page
   flow, so the real thead cannot viewport-pin (see reference-table.css).
   buildTheadPin() clones the thead into a 0-height sticky rail
   (`.reference-thead-pin`, aria-hidden) inserted just before the wrapper:
   - horizontal sync: the clone viewport is overflow:hidden and its scrollLeft
     is set from the wrapper's scroll (a real scrollport, so the cloned corner
     `.is-sticky-col` keeps left-pinning via the shared CSS rule);
   - width sync: per-column offsetWidths are copied to the clone (ResizeObserver
     on table+wrapper, plus an explicit resync after filtering — hiding rows
     redistributes column widths without resizing the table's own box);
   - visibility: an IntersectionObserver with the pin offset as rootMargin
     shows the clone only while the real thead is above the pin line AND the
     wrapper is still on screen; rebuilt on `headersticky:change` and when the
     controls strip resizes (the pin line moved);
   - sorting: clicks on cloned sort buttons delegate to the real ones, and the
     real sort handler mirrors th classes/aria-sort back onto the clone.
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

    var tbody  = table.tBodies[0];
    var rows   = Array.prototype.slice.call(table.querySelectorAll('tbody > tr'));
    var originalRows = rows.slice();   // initial DOM order, for "neutral" sort reset
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

    // Optional secondary filter (e.g. OS / appliance) driven by a <select>.
    var osSelect = o.osFilterId ? document.getElementById(o.osFilterId) : null;
    var osAttr   = o.osAttr || 'data-os';
    var activeOs = '';

    var activeBatch = allValue;
    var totalRows = rows.length;

    // Row text is static after load — cache the lowercased haystack instead
    // of recomputing textContent.toLowerCase() per row per keystroke.
    var rowText = null;
    function ensureRowText() {
      if (rowText) return;
      rowText = new Array(rows.length);
      for (var i = 0; i < rows.length; i++) {
        rowText[i] = rows[i].textContent.toLowerCase();
      }
    }

    function applyFilters() {
      var q = ((search && search.value) || '').trim().toLowerCase();
      if (q) ensureRowText();
      var visible = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var inBatch = activeBatch === allValue || row.dataset[datasetKey] === activeBatch;
        var matches = !q || rowText[i].indexOf(q) !== -1;
        var inOs = true;
        if (activeOs) {
          var osVal = row.getAttribute(osAttr) || '';
          inOs = osVal.split(/\s+/).indexOf(activeOs) !== -1;
        }
        var show = inBatch && matches && inOs;
        row.hidden = !show;
        if (show) visible++;
      }
      if (count) {
        count.textContent = (q || activeBatch !== allValue || activeOs)
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

    // ---- Sorting (opt-in via opts.sortable) ----
    var sortState = { th: null, dir: null };

    function cellSortValue(row, idx) {
      var cell = row.cells[idx];
      if (!cell) return '';
      var ds = cell.getAttribute('data-sort');
      return ds != null ? ds : (cell.textContent || '').trim();
    }

    function applySort() {
      var ordered;
      if (!sortState.th || !sortState.dir) {
        ordered = originalRows;
      } else {
        var idx = sortState.th.cellIndex;
        var dir = sortState.dir === 'desc' ? -1 : 1;
        ordered = rows.slice().sort(function (a, b) {
          var av = cellSortValue(a, idx), bv = cellSortValue(b, idx);
          var an = parseFloat(av), bn = parseFloat(bv);
          var cmp = (av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn))
            ? an - bn
            : av.toLowerCase().localeCompare(bv.toLowerCase());
          return cmp * dir;
        });
      }
      for (var i = 0; i < ordered.length; i++) tbody.appendChild(ordered[i]);
    }

    function initSorting() {
      var ths = Array.prototype.slice.call(table.querySelectorAll('thead th'));
      ths.forEach(function (th) {
        if (th.hasAttribute('data-no-sort')) return;
        var inner = document.createElement('span');
        inner.className = 'ref-th-inner';
        while (th.firstChild) inner.appendChild(th.firstChild);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ref-sort';
        btn.setAttribute('aria-label', 'Sort by ' + (inner.textContent || 'column').trim());
        inner.appendChild(btn);
        th.appendChild(inner);
        th.classList.add('is-sortable');

        btn.addEventListener('click', function () {
          var dir;
          if (sortState.th === th) {
            dir = sortState.dir === 'asc' ? 'desc' : (sortState.dir === 'desc' ? null : 'asc');
          } else {
            dir = 'asc';
          }
          ths.forEach(function (t) {
            t.removeAttribute('aria-sort');
            t.classList.remove('is-sorted-asc', 'is-sorted-desc');
          });
          sortState = { th: dir ? th : null, dir: dir };
          if (dir) {
            th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
            th.classList.add(dir === 'asc' ? 'is-sorted-asc' : 'is-sorted-desc');
          }
          applySort();
          applyFilters();
        });
      });
    }

    var searchTimer;
    if (search) {
      search.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, 120);
      });
    }
    for (var j = 0; j < tabs.length; j++) {
      (function (t) {
        t.addEventListener('click', function () { setActiveBatch(t.dataset[datasetKey]); });
      })(tabs[j]);
    }
    if (osSelect) {
      osSelect.addEventListener('change', function () {
        activeOs = osSelect.value || '';
        applyFilters();
      });
    }
    if (o.sortable) initSorting();

    // Publish the controls strip's real height as --reference-controls-h so
    // the pinned clone header (reference-table.css) pins exactly below it.
    // The strip wraps to a taller multi-row stack on mobile (and grows with
    // font scaling / long tab labels / the row-count text), so a hardcoded gap
    // would let the z-10 controls cover the pinned header. Mirrors main.js's
    // JS-sets-a-CSS-var pattern for --header-offset.
    var controls = (table.closest('.reference-container') || document)
      .querySelector('.reference-controls');
    function syncControlsHeight() {
      if (!controls) return;
      var mb = parseFloat(getComputedStyle(controls).marginBottom) || 0;
      document.documentElement.style.setProperty(
        '--reference-controls-h', (controls.offsetHeight + mb) + 'px'
      );
    }
    syncControlsHeight();
    if (controls && 'ResizeObserver' in window) {
      new ResizeObserver(syncControlsHeight).observe(controls);
    }
    var rcResizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(rcResizeTimer);
      rcResizeTimer = setTimeout(syncControlsHeight, 100);
    }, { passive: true });

    applyFilters();
  }

  window.initReferenceTable = initReferenceTable;
})();
