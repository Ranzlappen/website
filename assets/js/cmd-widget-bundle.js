/* cmd-widget-bundle — entry point. Calls CMDW.mountAll() once the DOM is
   ready. All widget files must be loaded BEFORE this one (they register
   their factories on import; mountAll dispatches by name). */
(function () {
  if (typeof window.CMDW !== 'object' || typeof window.CMDW.mountAll !== 'function') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.CMDW.mountAll);
  } else {
    window.CMDW.mountAll();
  }
})();
