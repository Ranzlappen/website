/* ============================================================================
 * resize-handle — custom drag-to-resize grabber for textareas.
 * ----------------------------------------------------------------------------
 * The native CSS resize corner is ~12px and hard to grab on touch / trackpads.
 * This replaces it with a ~24px grabber (see `.resize-handle` in
 * reference-table.css). Pointer Events cover mouse + touch + pen; arrow keys
 * provide a keyboard path.
 *
 * Opt-in: any `textarea[data-resize]` or `.cmd-widget__textarea`. Self-attaches
 * on load and re-scans once on the next tick to catch textareas that widgets
 * create during their own DOMContentLoaded mount. No-op on pages with none.
 *
 * Shared across reference pages — load AFTER any script that builds textareas
 * (e.g. cmd-widget-bundle.js).
 * ============================================================================ */
(function () {
  var SELECTOR = 'textarea[data-resize], .cmd-widget__textarea';
  var MIN_H = 56;

  function enhance(ta) {
    if (!ta || ta.dataset.resizeReady === '1') return;
    ta.dataset.resizeReady = '1';

    var host = ta.parentNode;
    if (!host || !host.classList || !host.classList.contains('resize-host')) {
      host = document.createElement('div');
      host.className = 'resize-host';
      ta.parentNode.insertBefore(host, ta);
      host.appendChild(ta);
    }
    ta.style.resize = 'none';

    var handle = document.createElement('span');
    handle.className = 'resize-handle';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'horizontal');
    handle.setAttribute('aria-label', 'Resize text area — drag, or focus and use Up / Down arrows');
    handle.setAttribute('tabindex', '0');
    host.appendChild(handle);

    var startY = 0, startH = 0, dragging = false, pointerId = null;

    function onMove(e) {
      if (!dragging) return;
      var next = Math.max(MIN_H, startH + (e.clientY - startY));
      ta.style.height = next + 'px';
      e.preventDefault();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('is-dragging');
      try { handle.releasePointerCapture(pointerId); } catch (_) { /* noop */ }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }
    handle.addEventListener('pointerdown', function (e) {
      dragging = true;
      pointerId = e.pointerId;
      startY = e.clientY;
      startH = ta.getBoundingClientRect().height;
      handle.classList.add('is-dragging');
      try { handle.setPointerCapture(pointerId); } catch (_) { /* noop */ }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      e.preventDefault();
    });
    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 40 : 12;
      var h = ta.getBoundingClientRect().height;
      if (e.key === 'ArrowDown') { ta.style.height = (h + step) + 'px'; e.preventDefault(); }
      else if (e.key === 'ArrowUp') { ta.style.height = Math.max(MIN_H, h - step) + 'px'; e.preventDefault(); }
    });
  }

  function scan(root) {
    var nodes = (root || document).querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) enhance(nodes[i]);
  }

  function init() {
    scan(document);
    setTimeout(function () { scan(document); }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ResizeHandle = { scan: scan, enhance: enhance };
})();
