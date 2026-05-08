/* ============================================================================
   electronics-fundamentals.js — entry point for the modular bundle
   ----------------------------------------------------------------------------
   This file is the LAST script loaded for /references/electronics-fundamentals/.
   By the time DOMContentLoaded fires, the eight earlier files in the bundle
   have already populated window.ElectronicsFundamentals (alias `EF`) and
   registered every widget against EF._registry via EF._registerSection.

   This entry point's only jobs are:
     1. Mount every registered widget via EF.mountAllWidgets() (which also
        runs EF.syncAllWidgetThemes() to close the dark-mode safety net).
     2. Restore any URL-hash bookmark via EF.Bookmark.restoreFromHash().
     3. Log a summary to the console.

   The whole modular bundle in load order:
     1. electronics-utils.js                 (utilities + EF namespace)
     2. electronics-widget-core.js           (Widget/Kernel/registry/Lazy/Bookmark/ChartJS)
     3. electronics-quick-wheel.js           (Section 1)
     4. electronics-formulas.js              (Section 2)
     5. electronics-ohms-calculator.js       (Section 3 / Calc 1)
     6. electronics-led-divider-calculators.js (Section 3 / Calcs 2 & 3)
     7. electronics-sp-rc-calculators.js     (Section 3 / Calcs 4 & 5)
     8. electronics-components.js            (Sections 4, 5, 6 + page chrome)
     9. electronics-fundamentals.js          ← THIS FILE
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;
  var EF = window.ElectronicsFundamentals;
  if (!EF || typeof EF.mountAllWidgets !== 'function') {
    // The earlier files in the bundle didn't load (or loaded out of order).
    // Surface the diagnostic; the page itself stays usable in static form.
    // eslint-disable-next-line no-console
    console.error('Electronics Fundamentals: bundle entry point ran without EF.mountAllWidgets — load order broken.');
    return;
  }

  function boot() {
    EF.mountAllWidgets();
    // After mount, attempt to restore any state encoded in the URL hash.
    // Widgets that expose restoreState() pick up the values; others ignore.
    try { EF.Bookmark.restoreFromHash(); } catch (_) { /* ignore */ }
    var count = (EF._instances && EF._instances.length) || 0;
    // eslint-disable-next-line no-console
    console.log('✅ Electronics Fundamentals JS initialized — ' + count + ' widgets mounted');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
