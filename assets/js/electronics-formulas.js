/* ============================================================================
   electronics-formulas.js — Section 2: Core Formulas & Laws
   ----------------------------------------------------------------------------
   Wires the "Try it" button on every formula card to the Quick Reference
   Wheel via EF.widgets[…].setValues(). Falls back to direct DOM dispatch
   if the wheel hasn't registered (e.g. Chart.js offline).
   ========================================================================== */
(function () {
  'use strict';
  if (!document.querySelector('.electronics-page')) return;
  var EF = window.ElectronicsFundamentals;
  if (!EF || typeof EF._registerSection !== 'function') return;

  function initFormulasSection() {
    var grid = document.getElementById('electronics-formulas-grid');
    if (!grid) return;

    var buttons = grid.querySelectorAll('button[data-try-button]');
    if (!buttons.length) return;

    var QTY = ['V', 'I', 'R', 'P'];

    function findWheelWidget() {
      for (var i = 0; i < EF.widgets.length; i++) {
        if (EF.widgets[i].name === 'quick-reference-wheel') return EF.widgets[i];
      }
      return null;
    }

    function readPreset(btn) {
      var out = {};
      for (var i = 0; i < QTY.length; i++) {
        var raw = btn.getAttribute('data-try-' + QTY[i].toLowerCase());
        if (raw === null || raw === '') continue;
        var num = parseFloat(raw);
        if (isFinite(num)) out[QTY[i]] = num;
      }
      return out;
    }

    function fallbackFill(values) {
      QTY.forEach(function (n) {
        var input = document.getElementById('ef-wheel-' + n);
        if (!input) return;
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      Object.keys(values).forEach(function (n) {
        var input = document.getElementById('ef-wheel-' + n);
        if (!input) return;
        input.value = String(values[n]);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      var wheelSection = document.getElementById('electronics-quick-reference');
      if (wheelSection) EF.scrollIntoView(wheelSection, { block: 'start' });
    }

    function handleClick(btn) {
      var label = btn.getAttribute('data-try-label') || btn.textContent.trim();
      var preset = readPreset(btn);
      var keys = Object.keys(preset);

      if (keys.length < 2) {
        // eslint-disable-next-line no-console
        console.warn('🧮 Try-it: "' + label + '" needs at least two of V/I/R/P; got', preset);
        return;
      }

      var wheel = findWheelWidget();
      if (wheel && typeof wheel.setValues === 'function') {
        wheel.setValues(preset, { scroll: true });
      } else {
        fallbackFill(preset);
      }

      // eslint-disable-next-line no-console
      console.log('🧮 Try-it: loaded "' + label + '" into the Quick Wheel →', preset);
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () { handleClick(btn); });
    });
  }

  EF._registerSection('formulas-section', initFormulasSection);
})();
