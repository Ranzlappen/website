/* cmd-widget-chmod — octal/symbolic permission calculator.
   Mounts into <section data-cmd-widget="chmod">. */
(function () {
  if (typeof window.CMDW !== 'object') return;

  var ROLES = [
    { key: 'u', label: 'Owner' },
    { key: 'g', label: 'Group' },
    { key: 'o', label: 'Others' }
  ];
  var PERMS = [
    { key: 'r', label: 'r', value: 4 },
    { key: 'w', label: 'w', value: 2 },
    { key: 'x', label: 'x', value: 1 }
  ];
  // Defaults: 755 (rwxr-xr-x) — the typical executable / directory mode.
  var DEFAULTS = { u: { r: true, w: true, x: true }, g: { r: true, w: false, x: true }, o: { r: true, w: false, x: true } };
  var SPECIAL = [
    { key: 'setuid', label: 'setuid', mask: 4 },
    { key: 'setgid', label: 'setgid', mask: 2 },
    { key: 'sticky', label: 'sticky', mask: 1 }
  ];

  CMDW.register('chmod', function (root) {
    root.innerHTML = '';

    var state = { u: {}, g: {}, o: {} };
    for (var r = 0; r < ROLES.length; r++) state[ROLES[r].key] = Object.assign({}, DEFAULTS[ROLES[r].key]);
    var special = { setuid: false, setgid: false, sticky: false };
    var pathName = '<file>';

    var title = CMDW.el('h3', { className: 'cmd-widget__title', text: 'chmod calculator' });
    var lede  = CMDW.el('p', { className: 'cmd-widget__lede', text: 'Toggle the per-role read/write/execute boxes and the special bits to see the octal mode, the symbolic form, and a ready-to-copy chmod invocation.' });

    // Permission grid
    var grid = CMDW.el('div', { className: 'cmd-widget__grid cmd-widget--chmod__grid' });
    // Header row
    grid.appendChild(CMDW.el('span', { className: 'cmd-widget__grid-corner', text: '' }));
    for (var p = 0; p < PERMS.length; p++) {
      grid.appendChild(CMDW.el('span', { className: 'cmd-widget__grid-col', text: PERMS[p].label }));
    }
    // Body rows
    var checkboxes = {};
    for (var i = 0; i < ROLES.length; i++) {
      var role = ROLES[i];
      grid.appendChild(CMDW.el('span', { className: 'cmd-widget__grid-row', text: role.label }));
      checkboxes[role.key] = {};
      for (var j = 0; j < PERMS.length; j++) {
        var perm = PERMS[j];
        var cb = CMDW.el('input', { type: 'checkbox', 'data-role': role.key, 'data-perm': perm.key });
        if (state[role.key][perm.key]) cb.checked = true;
        cb.addEventListener('change', recompute);
        checkboxes[role.key][perm.key] = cb;
        grid.appendChild(CMDW.el('label', { className: 'cmd-widget__cell' }, [cb]));
      }
    }

    // Special bits
    var specialWrap = CMDW.el('div', { className: 'cmd-widget__row' });
    specialWrap.appendChild(CMDW.el('span', { className: 'cmd-widget__row-label', text: 'Special bits' }));
    for (var s = 0; s < SPECIAL.length; s++) {
      var sp = SPECIAL[s];
      (function (sp) {
        var cb = CMDW.el('input', { type: 'checkbox', id: 'chmod-' + sp.key });
        cb.addEventListener('change', function () { special[sp.key] = cb.checked; recompute(); });
        var lbl = CMDW.el('label', { className: 'cmd-widget__inline-check', 'for': 'chmod-' + sp.key }, [cb, document.createTextNode(' ' + sp.label)]);
        specialWrap.appendChild(lbl);
      })(sp);
    }

    // Filename input
    var nameWrap = CMDW.el('div', { className: 'cmd-widget__row' });
    nameWrap.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', 'for': 'chmod-target', text: 'Target' }));
    var nameInput = CMDW.el('input', { type: 'text', id: 'chmod-target', value: pathName, className: 'cmd-widget__text' });
    nameInput.addEventListener('input', function () { pathName = nameInput.value || '<file>'; recompute(); });
    nameWrap.appendChild(nameInput);

    var recursiveWrap = CMDW.el('label', { className: 'cmd-widget__inline-check' });
    var recursiveCb = CMDW.el('input', { type: 'checkbox', id: 'chmod-recursive' });
    var recursive = false;
    recursiveCb.addEventListener('change', function () { recursive = recursiveCb.checked; recompute(); });
    recursiveWrap.appendChild(recursiveCb);
    recursiveWrap.appendChild(document.createTextNode(' -R (recursive)'));
    nameWrap.appendChild(recursiveWrap);

    var octalOut = CMDW.makeOutput('Octal mode');
    var symbolicOut = CMDW.makeOutput('Symbolic');
    var cmdOut = CMDW.makeOutput('Command');

    root.appendChild(title);
    root.appendChild(lede);
    root.appendChild(grid);
    root.appendChild(specialWrap);
    root.appendChild(nameWrap);
    root.appendChild(octalOut.el);
    root.appendChild(symbolicOut.el);
    root.appendChild(cmdOut.el);

    function recompute() {
      // Sync state from checkboxes
      for (var r = 0; r < ROLES.length; r++) {
        for (var p = 0; p < PERMS.length; p++) {
          state[ROLES[r].key][PERMS[p].key] = checkboxes[ROLES[r].key][PERMS[p].key].checked;
        }
      }
      // Compute octal per role
      var digits = [];
      for (var rr = 0; rr < ROLES.length; rr++) {
        var k = ROLES[rr].key;
        var v = 0;
        if (state[k].r) v += 4;
        if (state[k].w) v += 2;
        if (state[k].x) v += 1;
        digits.push(v);
      }
      var specialDigit = 0;
      if (special.setuid) specialDigit += 4;
      if (special.setgid) specialDigit += 2;
      if (special.sticky) specialDigit += 1;
      var octal = (specialDigit > 0 ? String(specialDigit) : '') + digits.join('');
      if (octal === '') octal = '0';
      // Symbolic
      var sym = '';
      for (var rs = 0; rs < ROLES.length; rs++) {
        var rk = ROLES[rs].key;
        sym += (state[rk].r ? 'r' : '-');
        sym += (state[rk].w ? 'w' : '-');
        // setuid/setgid/sticky modify the x slot
        var xChar = state[rk].x ? 'x' : '-';
        if (rk === 'u' && special.setuid) xChar = state[rk].x ? 's' : 'S';
        if (rk === 'g' && special.setgid) xChar = state[rk].x ? 's' : 'S';
        if (rk === 'o' && special.sticky) xChar = state[rk].x ? 't' : 'T';
        sym += xChar;
      }
      octalOut.set(octal);
      symbolicOut.set(sym);
      cmdOut.set('chmod' + (recursive ? ' -R' : '') + ' ' + octal + ' ' + CMDW.shellEscape(pathName));
    }
    recompute();
  });
})();
