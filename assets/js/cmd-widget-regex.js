/* cmd-widget-regex — regex tester with live match highlighting.
   Mounts into <section data-cmd-widget="regex">.

   Uses the browser's native RegExp (JavaScript flavour, similar to PCRE).
   The flavour selector is for orientation only — switching it flips the
   default flag set; lookaround/backref portability between BRE/ERE/PCRE
   is the user's responsibility. */
(function () {
  if (typeof window.CMDW !== 'object') return;

  CMDW.register('regex', function (root) {
    root.innerHTML = '';

    var state = {
      pattern: '\\b\\w+@\\w+\\.\\w+\\b',
      flags: 'g',
      flavour: 'js',
      input: 'Email me at alice@example.com or bob@example.org.\nLast update: 2026-05-21.'
    };

    var body = CMDW.makeShell(root, 'regex tester');
    var lede = CMDW.el('p', { className: 'cmd-widget__lede', text: 'Live-test a regular expression against a sample string. Matches highlight as you type. The flavour selector is for orientation only — the engine is JavaScript\'s native RegExp.' });

    // Pattern row
    var patternInput = CMDW.el('input', { type: 'text', className: 'cmd-widget__text cmd-widget__text--mono', value: state.pattern, placeholder: '\\d+' });
    patternInput.addEventListener('input', function () { state.pattern = patternInput.value; render(); });
    var flagsInput = CMDW.el('input', { type: 'text', className: 'cmd-widget__text cmd-widget__text--narrow cmd-widget__text--mono', value: state.flags, placeholder: 'gi' });
    flagsInput.addEventListener('input', function () { state.flags = flagsInput.value; render(); });

    var patternRow = CMDW.el('div', { className: 'cmd-widget__row' });
    patternRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'Pattern' }));
    patternRow.appendChild(patternInput);
    patternRow.appendChild(CMDW.el('span', { className: 'cmd-widget__inline-label', text: 'Flags' }));
    patternRow.appendChild(flagsInput);

    // Flavour selector
    var flavourSel = CMDW.el('select', { className: 'cmd-widget__select' });
    [
      ['js',   'JavaScript (default)'],
      ['ere',  'POSIX ERE (grep -E, awk)'],
      ['bre',  'POSIX BRE (grep, sed)'],
      ['pcre', 'PCRE (grep -P, perl)']
    ].forEach(function (opt) {
      var o = CMDW.el('option', { value: opt[0], text: opt[1] });
      if (opt[0] === state.flavour) o.selected = true;
      flavourSel.appendChild(o);
    });
    flavourSel.addEventListener('change', function () { state.flavour = flavourSel.value; render(); });
    var flavourRow = CMDW.el('div', { className: 'cmd-widget__row' });
    flavourRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'Flavour (hint)' }));
    flavourRow.appendChild(flavourSel);

    // Test string
    var textArea = CMDW.el('textarea', { className: 'cmd-widget__textarea cmd-widget__text--mono', rows: '5' });
    textArea.value = state.input;
    textArea.addEventListener('input', function () { state.input = textArea.value; render(); });
    var textRow = CMDW.el('div', { className: 'cmd-widget__row cmd-widget__row--stack' });
    textRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'Test string' }));
    textRow.appendChild(textArea);

    // Status line
    var status = CMDW.el('p', { className: 'cmd-widget__status' });

    // Match highlight pane
    var pane = CMDW.el('pre', { className: 'cmd-widget__regex-pane' });

    // Captures list
    var captures = CMDW.el('div', { className: 'cmd-widget__regex-captures' });

    body.appendChild(lede);
    body.appendChild(patternRow);
    body.appendChild(flavourRow);
    body.appendChild(textRow);
    body.appendChild(status);
    body.appendChild(pane);
    body.appendChild(captures);

    function escapeHtml(s) {
      // Also escapes quotes so the helper stays safe if ever reused in an
      // attribute context (matches main.js's copy of the same helper).
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function render() {
      var re;
      try {
        // Force global so we can iterate matches; preserve user flags.
        var flags = state.flags || '';
        if (flags.indexOf('g') === -1) flags = 'g' + flags;
        re = new RegExp(state.pattern, flags);
      } catch (err) {
        status.textContent = '⚠ ' + err.message;
        status.className = 'cmd-widget__status cmd-widget__status--error';
        pane.innerHTML = escapeHtml(state.input);
        captures.innerHTML = '';
        return;
      }
      var input = state.input;
      var matches = [];
      var m;
      var safety = 0;
      while ((m = re.exec(input)) !== null && safety++ < 10000) {
        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], groups: m.slice(1) });
        if (m.index === re.lastIndex) re.lastIndex++; // empty-match guard
      }
      status.textContent = matches.length + ' match' + (matches.length === 1 ? '' : 'es');
      status.className = 'cmd-widget__status' + (matches.length === 0 ? ' cmd-widget__status--empty' : '');

      // Highlight pane
      var html = '';
      var idx = 0;
      for (var i = 0; i < matches.length; i++) {
        var match = matches[i];
        html += escapeHtml(input.slice(idx, match.start));
        html += '<mark class="cmd-widget__regex-mark">' + escapeHtml(match.text) + '</mark>';
        idx = match.end;
      }
      html += escapeHtml(input.slice(idx));
      pane.innerHTML = html;

      // Captures
      captures.innerHTML = '';
      if (matches.length > 0 && matches[0].groups.length > 0) {
        var dl = CMDW.el('dl', { className: 'cmd-widget__regex-caps-list' });
        for (var g = 0; g < matches[0].groups.length; g++) {
          dl.appendChild(CMDW.el('dt', { text: '$' + (g + 1) }));
          dl.appendChild(CMDW.el('dd', { text: matches[0].groups[g] == null ? '(undefined)' : matches[0].groups[g] }));
        }
        var lbl = CMDW.el('p', { className: 'cmd-widget__regex-caps-label', text: 'Capture groups (first match)' });
        captures.appendChild(lbl);
        captures.appendChild(dl);
      }
    }
    render();
  });
})();
