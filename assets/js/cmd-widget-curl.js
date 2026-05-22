/* cmd-widget-curl — curl request composer.
   Mounts into <section data-cmd-widget="curl">. */
(function () {
  if (typeof window.CMDW !== 'object') return;

  CMDW.register('curl', function (root) {
    root.innerHTML = '';

    var state = {
      url: 'https://api.example.com/v1/users',
      method: 'GET',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: '',
      followRedirects: true,
      silent: false,
      basicAuth: false,
      user: '',
      pass: ''
    };

    var title = CMDW.el('h3', { className: 'cmd-widget__title', text: 'curl composer' });
    var lede = CMDW.el('p', { className: 'cmd-widget__lede', text: 'Compose a `curl` invocation. The output is shell-escaped (single-quotes) and ready to paste into a terminal or a CI step.' });

    // URL row
    var urlInput = CMDW.el('input', { type: 'text', value: state.url, className: 'cmd-widget__text', placeholder: 'https://example.com/api' });
    urlInput.addEventListener('input', function () { state.url = urlInput.value; render(); });
    var urlRow = CMDW.el('div', { className: 'cmd-widget__row' });
    urlRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'URL' }));
    urlRow.appendChild(urlInput);

    // Method row
    var methodSel = CMDW.el('select', { className: 'cmd-widget__select' });
    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].forEach(function (mth) {
      var o = CMDW.el('option', { value: mth, text: mth });
      if (mth === state.method) o.selected = true;
      methodSel.appendChild(o);
    });
    methodSel.addEventListener('change', function () { state.method = methodSel.value; render(); });

    var followCb = CMDW.el('input', { type: 'checkbox', id: 'curl-follow' });
    followCb.checked = state.followRedirects;
    followCb.addEventListener('change', function () { state.followRedirects = followCb.checked; render(); });

    var silentCb = CMDW.el('input', { type: 'checkbox', id: 'curl-silent' });
    silentCb.checked = state.silent;
    silentCb.addEventListener('change', function () { state.silent = silentCb.checked; render(); });

    var methodRow = CMDW.el('div', { className: 'cmd-widget__row' });
    methodRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'Method' }));
    methodRow.appendChild(methodSel);
    methodRow.appendChild(CMDW.el('label', { className: 'cmd-widget__inline-check', 'for': 'curl-follow' }, [followCb, document.createTextNode(' -L follow redirects')]));
    methodRow.appendChild(CMDW.el('label', { className: 'cmd-widget__inline-check', 'for': 'curl-silent' }, [silentCb, document.createTextNode(' -sS silent + show errors')]));

    // Headers section
    var headersWrap = CMDW.el('div', { className: 'cmd-widget__row cmd-widget__row--stack' });
    headersWrap.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'Headers' }));
    var headersList = CMDW.el('div', { className: 'cmd-widget__headers-list' });
    headersWrap.appendChild(headersList);
    var addBtn = CMDW.el('button', { type: 'button', className: 'cmd-widget__add-row', text: '+ add header' });
    addBtn.addEventListener('click', function () { state.headers.push({ key: '', value: '' }); renderHeaders(); render(); });
    headersWrap.appendChild(addBtn);

    function renderHeaders() {
      headersList.innerHTML = '';
      state.headers.forEach(function (h, idx) {
        var k = CMDW.el('input', { type: 'text', className: 'cmd-widget__text', value: h.key, placeholder: 'Header' });
        var v = CMDW.el('input', { type: 'text', className: 'cmd-widget__text', value: h.value, placeholder: 'value' });
        var rm = CMDW.el('button', { type: 'button', className: 'cmd-widget__remove-row', text: '×', 'aria-label': 'remove header' });
        k.addEventListener('input', function () { state.headers[idx].key = k.value; render(); });
        v.addEventListener('input', function () { state.headers[idx].value = v.value; render(); });
        rm.addEventListener('click', function () { state.headers.splice(idx, 1); renderHeaders(); render(); });
        var r = CMDW.el('div', { className: 'cmd-widget__header-row' });
        r.appendChild(k); r.appendChild(v); r.appendChild(rm);
        headersList.appendChild(r);
      });
    }
    renderHeaders();

    // Body
    var bodyTa = CMDW.el('textarea', { className: 'cmd-widget__textarea cmd-widget__text--mono', rows: '4', placeholder: '{"key":"value"}' });
    bodyTa.value = state.body;
    bodyTa.addEventListener('input', function () { state.body = bodyTa.value; render(); });
    var bodyRow = CMDW.el('div', { className: 'cmd-widget__row cmd-widget__row--stack' });
    bodyRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'Body (-d)' }));
    bodyRow.appendChild(bodyTa);

    // Basic auth
    var authCb = CMDW.el('input', { type: 'checkbox', id: 'curl-auth' });
    authCb.addEventListener('change', function () { state.basicAuth = authCb.checked; renderAuth(); render(); });
    var authUser = CMDW.el('input', { type: 'text', className: 'cmd-widget__text', placeholder: 'user' });
    var authPass = CMDW.el('input', { type: 'text', className: 'cmd-widget__text', placeholder: 'pass' });
    authUser.addEventListener('input', function () { state.user = authUser.value; render(); });
    authPass.addEventListener('input', function () { state.pass = authPass.value; render(); });
    var authRow = CMDW.el('div', { className: 'cmd-widget__row' });
    authRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label cmd-widget__inline-check', 'for': 'curl-auth' }, [authCb, document.createTextNode(' Basic auth')]));
    authRow.appendChild(authUser);
    authRow.appendChild(authPass);
    function renderAuth() {
      authUser.disabled = !state.basicAuth;
      authPass.disabled = !state.basicAuth;
    }
    renderAuth();

    var out = CMDW.makeOutput('Composed command');

    root.appendChild(title);
    root.appendChild(lede);
    root.appendChild(urlRow);
    root.appendChild(methodRow);
    root.appendChild(headersWrap);
    root.appendChild(bodyRow);
    root.appendChild(authRow);
    root.appendChild(out.el);

    function render() {
      var parts = ['curl'];
      if (state.silent) parts.push('-sS');
      if (state.followRedirects) parts.push('-L');
      if (state.method && state.method !== 'GET') {
        parts.push('-X');
        parts.push(state.method);
      }
      state.headers.forEach(function (h) {
        if (!h.key) return;
        parts.push('-H');
        parts.push(CMDW.shellEscape(h.key + ': ' + (h.value || '')));
      });
      if (state.body) {
        parts.push('-d');
        parts.push(CMDW.shellEscape(state.body));
      }
      if (state.basicAuth && (state.user || state.pass)) {
        parts.push('-u');
        parts.push(CMDW.shellEscape(state.user + ':' + state.pass));
      }
      parts.push(CMDW.shellEscape(state.url || ''));
      out.set(parts.join(' '));
    }
    render();
  });
})();
