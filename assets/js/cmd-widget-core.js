/* ============================================================================
 * cmd-widget-core
 * Tiny registry + mount loop + helpers for the CLI cheat-sheet widgets.
 * Each widget calls `CMDW.register('<name>', function (root) { ... })` to
 * hook into a `<section data-cmd-widget="<name>">` element on the page.
 *
 * Deliberately small — duplicated rather than imported from
 * electronics-*.js per CLAUDE.md's "duplicate intentionally" rule.
 * ============================================================================ */
(function () {
  var widgets = {};

  function register(name, factory) {
    widgets[name] = factory;
  }

  function mountAll() {
    var nodes = document.querySelectorAll('[data-cmd-widget]');
    for (var i = 0; i < nodes.length; i++) {
      var name = nodes[i].getAttribute('data-cmd-widget');
      var factory = widgets[name];
      if (typeof factory === 'function') {
        try { factory(nodes[i]); }
        catch (err) {
          /* eslint-disable no-console */
          if (typeof console !== 'undefined' && console.error) {
            console.error('cmd-widget ' + name + ' failed to mount:', err);
          }
        }
      }
    }
  }

  function flashCopied(btn) {
    if (!btn) return;
    var prev = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('is-copied');
    setTimeout(function () {
      btn.textContent = prev;
      btn.classList.remove('is-copied');
    }, 1500);
  }

  function copyToClipboard(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flashCopied(btn); },
        function () { fallbackCopy(text, btn); }
      );
    } else {
      fallbackCopy(text, btn);
    }
  }

  function fallbackCopy(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flashCopied(btn); }
    catch (_) { /* swallow */ }
    finally { document.body.removeChild(ta); }
  }

  /* POSIX-compatible single-quote shell escape.
   * Bare-safe tokens (letters, digits, _ . / -) pass through. Anything else
   * is wrapped in single quotes; embedded single quotes become '\''. */
  function shellEscape(s) {
    if (s === '') return "''";
    if (/^[A-Za-z0-9_./:=@%+-]+$/.test(s)) return s;
    return "'" + String(s).replace(/'/g, "'\\''") + "'";
  }

  /* Build a labelled <pre><code> output block with a "Copy" button.
   * Returns { el, set(text), code }. */
  function makeOutput(label) {
    var wrap = document.createElement('div');
    wrap.className = 'cmd-widget__output';

    var header = document.createElement('div');
    header.className = 'cmd-widget__output-header';
    var lbl = document.createElement('span');
    lbl.className = 'cmd-widget__output-label';
    lbl.textContent = label || 'Output';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmd-widget__copy';
    btn.textContent = 'Copy';
    header.appendChild(lbl);
    header.appendChild(btn);

    var pre = document.createElement('pre');
    pre.className = 'cmd-widget__output-pre';
    var code = document.createElement('code');
    pre.appendChild(code);

    wrap.appendChild(header);
    wrap.appendChild(pre);

    btn.addEventListener('click', function () {
      copyToClipboard(code.textContent || '', btn);
    });

    return {
      el: wrap,
      code: code,
      set: function (text) { code.textContent = text; }
    };
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === 'className') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else node.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c == null) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  window.CMDW = {
    register: register,
    mountAll: mountAll,
    copyToClipboard: copyToClipboard,
    shellEscape: shellEscape,
    makeOutput: makeOutput,
    el: el
  };
})();
