/* cmd-widget-find — `find` command builder.
   Mounts into <section data-cmd-widget="find">. */
(function () {
  if (typeof window.CMDW !== 'object') return;

  CMDW.register('find', function (root) {
    root.innerHTML = '';

    var state = {
      path: '.',
      name: '',
      iname: false,
      type: '',         // '', 'f', 'd', 'l'
      mtimeSign: '',    // '', '+', '-'
      mtimeDays: '',
      sizeOp: '',       // '', '+', '-'
      sizeVal: '',
      sizeUnit: 'M',
      action: 'print'   // 'print' | 'delete' | 'exec'
    };

    var title = CMDW.el('h3', { className: 'cmd-widget__title', text: 'find builder' });
    var lede = CMDW.el('p', { className: 'cmd-widget__lede', text: 'Compose a `find` invocation from a path + test fields + an action. Output is shell-escaped and ready to copy.' });

    function row(label, control) {
      var r = CMDW.el('div', { className: 'cmd-widget__row' });
      r.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: label }));
      r.appendChild(control);
      return r;
    }

    // path
    var pathInput = CMDW.el('input', { type: 'text', value: state.path, className: 'cmd-widget__text', placeholder: '.' });
    pathInput.addEventListener('input', function () { state.path = pathInput.value; render(); });

    // name + case-insensitive
    var nameInput = CMDW.el('input', { type: 'text', className: 'cmd-widget__text', placeholder: '*.log' });
    nameInput.addEventListener('input', function () { state.name = nameInput.value; render(); });
    var inameCb = CMDW.el('input', { type: 'checkbox', id: 'find-iname' });
    inameCb.addEventListener('change', function () { state.iname = inameCb.checked; render(); });
    var nameRow = CMDW.el('div', { className: 'cmd-widget__row' });
    nameRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'Name glob' }));
    nameRow.appendChild(nameInput);
    nameRow.appendChild(CMDW.el('label', { className: 'cmd-widget__inline-check', 'for': 'find-iname' }, [inameCb, document.createTextNode(' case-insensitive')]));

    // type
    var typeSel = CMDW.el('select', { className: 'cmd-widget__select' });
    [['', '(any)'], ['f', 'f — file'], ['d', 'd — dir'], ['l', 'l — symlink']].forEach(function (opt) {
      var o = CMDW.el('option', { value: opt[0], text: opt[1] });
      if (opt[0] === state.type) o.selected = true;
      typeSel.appendChild(o);
    });
    typeSel.addEventListener('change', function () { state.type = typeSel.value; render(); });

    // mtime
    var mtimeSign = CMDW.el('select', { className: 'cmd-widget__select cmd-widget__select--narrow' });
    [['', '(off)'], ['+', '> n days old'], ['-', '< n days old']].forEach(function (opt) {
      var o = CMDW.el('option', { value: opt[0], text: opt[1] });
      mtimeSign.appendChild(o);
    });
    mtimeSign.addEventListener('change', function () { state.mtimeSign = mtimeSign.value; render(); });
    var mtimeDays = CMDW.el('input', { type: 'number', className: 'cmd-widget__text cmd-widget__text--narrow', min: '0', placeholder: '30' });
    mtimeDays.addEventListener('input', function () { state.mtimeDays = mtimeDays.value; render(); });
    var mtimeRow = CMDW.el('div', { className: 'cmd-widget__row' });
    mtimeRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'mtime' }));
    mtimeRow.appendChild(mtimeSign);
    mtimeRow.appendChild(mtimeDays);

    // size
    var sizeOp = CMDW.el('select', { className: 'cmd-widget__select cmd-widget__select--narrow' });
    [['', '(off)'], ['+', '> n'], ['-', '< n']].forEach(function (opt) {
      var o = CMDW.el('option', { value: opt[0], text: opt[1] });
      sizeOp.appendChild(o);
    });
    sizeOp.addEventListener('change', function () { state.sizeOp = sizeOp.value; render(); });
    var sizeVal = CMDW.el('input', { type: 'number', className: 'cmd-widget__text cmd-widget__text--narrow', min: '0', placeholder: '100' });
    sizeVal.addEventListener('input', function () { state.sizeVal = sizeVal.value; render(); });
    var sizeUnit = CMDW.el('select', { className: 'cmd-widget__select cmd-widget__select--narrow' });
    [['c', 'bytes'], ['k', 'KB'], ['M', 'MB'], ['G', 'GB']].forEach(function (opt) {
      var o = CMDW.el('option', { value: opt[0], text: opt[1] });
      if (opt[0] === state.sizeUnit) o.selected = true;
      sizeUnit.appendChild(o);
    });
    sizeUnit.addEventListener('change', function () { state.sizeUnit = sizeUnit.value; render(); });
    var sizeRow = CMDW.el('div', { className: 'cmd-widget__row' });
    sizeRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'size' }));
    sizeRow.appendChild(sizeOp);
    sizeRow.appendChild(sizeVal);
    sizeRow.appendChild(sizeUnit);

    // action
    var actionSel = CMDW.el('select', { className: 'cmd-widget__select' });
    [
      ['print', '-print (default)'],
      ['delete', '-delete'],
      ['ls', '-ls (long listing)'],
      ['exec', '-exec rm {} +'],
      ['exec-grep', '-exec grep -l TODO {} +']
    ].forEach(function (opt) {
      var o = CMDW.el('option', { value: opt[0], text: opt[1] });
      if (opt[0] === state.action) o.selected = true;
      actionSel.appendChild(o);
    });
    actionSel.addEventListener('change', function () { state.action = actionSel.value; render(); });

    var out = CMDW.makeOutput('Composed command');

    root.appendChild(title);
    root.appendChild(lede);
    root.appendChild(row('Search path', pathInput));
    root.appendChild(nameRow);
    root.appendChild(row('Type', typeSel));
    root.appendChild(mtimeRow);
    root.appendChild(sizeRow);
    root.appendChild(row('Action', actionSel));
    root.appendChild(out.el);

    function render() {
      var parts = ['find'];
      parts.push(CMDW.shellEscape(state.path || '.'));
      if (state.name) {
        parts.push(state.iname ? '-iname' : '-name');
        parts.push(CMDW.shellEscape(state.name));
      }
      if (state.type) {
        parts.push('-type');
        parts.push(state.type);
      }
      if (state.mtimeSign && state.mtimeDays !== '') {
        parts.push('-mtime');
        parts.push(state.mtimeSign + state.mtimeDays);
      }
      if (state.sizeOp && state.sizeVal !== '') {
        parts.push('-size');
        parts.push(state.sizeOp + state.sizeVal + state.sizeUnit);
      }
      switch (state.action) {
        case 'delete': parts.push('-delete'); break;
        case 'ls':     parts.push('-ls'); break;
        case 'exec':   parts.push('-exec', 'rm', '{}', '+'); break;
        case 'exec-grep': parts.push('-exec', 'grep', '-l', 'TODO', '{}', '+'); break;
        default: /* print is default */ break;
      }
      out.set(parts.join(' '));
    }
    render();
  });
})();
