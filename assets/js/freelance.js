/* ============================================================
   Freelance Project Request tool (/freelance/)
   Live summary, "no preference" stack toggle, validation, and
   submission. Submission reuses the contact form's pipeline:
   POST to the configured proxy endpoint when present, else open
   a pre-filled GitHub Issue (label: freelance-request).
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('fl-form');
  if (!form) return;

  var submitBtn = document.getElementById('fl-submit');
  var statusEl = document.getElementById('fl-status');
  var noPref = document.getElementById('fl-stack-nopref');
  var stackGroups = document.getElementById('fl-stack-groups');
  var descEl = document.getElementById('fl-description');
  var charcountEl = document.getElementById('fl-charcount');

  var DESC_MIN = 30;
  var SUMMARY_LIST_MAX = 6; // stack/feature names shown before "+N more"

  // ── State helpers ──────────────────────────────────────────

  function checkedValues(name) {
    return Array.prototype.map.call(
      form.querySelectorAll('input[name="' + name + '"]:checked'),
      function (el) { return el.value; }
    );
  }

  function radioValue(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function field(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function collect() {
    var amount = field('fl-budget-amount');
    return {
      type: radioValue('fl-type'),
      noPref: noPref.checked,
      stack: checkedValues('fl-stack'),
      features: checkedValues('fl-feature'),
      ai: radioValue('fl-ai'),
      timeline: field('fl-timeline'),
      budgetType: field('fl-budget-type'),
      amount: amount,
      currency: field('fl-budget-currency'),
      flexible: document.getElementById('fl-budget-flexible').checked,
      name: field('fl-name'),
      email: field('fl-email'),
      company: field('fl-company'),
      title: field('fl-title'),
      links: field('fl-links'),
      description: field('fl-description')
    };
  }

  function offerText(s) {
    if (!s.amount) return 'Open to proposal';
    var text = Number(s.amount).toLocaleString() + ' ' + s.currency;
    text += ' — ' + s.budgetType.toLowerCase();
    if (s.flexible) text += ', negotiable';
    return text;
  }

  function stackText(s) {
    if (s.noPref) return 'No preference — recommend a stack';
    return s.stack;
  }

  // ── Live summary ───────────────────────────────────────────

  function setSummary(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    var empty = el.getAttribute('data-empty');
    if (Array.isArray(value)) {
      if (!value.length) {
        el.textContent = empty || '—';
        el.classList.remove('fl-sum-filled');
        return;
      }
      var shown = value.slice(0, SUMMARY_LIST_MAX).join(', ');
      if (value.length > SUMMARY_LIST_MAX) {
        shown += ' +' + (value.length - SUMMARY_LIST_MAX) + ' more';
      }
      el.textContent = shown;
      el.classList.add('fl-sum-filled');
      return;
    }
    if (!value) {
      el.textContent = empty || '—';
      el.classList.remove('fl-sum-filled');
      return;
    }
    el.textContent = value;
    el.classList.add('fl-sum-filled');
  }

  function setCount(id, n) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = n === 0;
    el.textContent = n + ' selected';
  }

  function update() {
    var s = collect();
    setSummary('fl-sum-type', s.type);
    setSummary('fl-sum-stack', stackText(s));
    setSummary('fl-sum-features', s.features);
    setSummary('fl-sum-ai', s.ai);
    setSummary('fl-sum-timeline', s.timeline);
    setSummary('fl-sum-offer', offerText(s));
    setCount('fl-stack-count', s.noPref ? 0 : s.stack.length);
    setCount('fl-features-count', s.features.length);

    if (charcountEl) {
      var len = s.description.length;
      charcountEl.textContent = len === 0
        ? ''
        : len < DESC_MIN
          ? len + ' characters — a bit more detail gets a better reply (' + DESC_MIN + '+ recommended)'
          : len.toLocaleString() + ' characters';
    }
  }

  // ── "No preference" stack toggle ───────────────────────────

  function applyNoPref() {
    var disabled = noPref.checked;
    stackGroups.classList.toggle('fl-disabled', disabled);
    Array.prototype.forEach.call(
      stackGroups.querySelectorAll('input[name="fl-stack"]'),
      function (el) {
        el.disabled = disabled;
        if (disabled) el.checked = false;
      }
    );
  }

  // ── Validation ─────────────────────────────────────────────

  function markSection(id, invalid) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('fl-section--invalid', invalid);
  }

  function validate(s) {
    var problems = [];

    var typeMissing = !s.type;
    markSection('fl-section-type', typeMissing);
    if (typeMissing) problems.push('pick a project type');

    var nameMissing = !s.name;
    var emailInvalid = !s.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email);
    var descMissing = !s.description;
    markSection('fl-section-contact', nameMissing || emailInvalid || descMissing);
    if (nameMissing) problems.push('add your name');
    if (emailInvalid) problems.push('add a valid email so I can reply');
    if (descMissing) problems.push('describe the project');

    return problems;
  }

  // ── Submission ─────────────────────────────────────────────

  function buildIssue(s) {
    var stack = s.noPref
      ? 'No preference — recommend a stack'
      : (s.stack.length ? s.stack.join(', ') : 'Not specified');
    var features = s.features.length ? s.features.join(', ') : 'Not specified';

    var title = '[Freelance] ' + (s.title || s.type) + ' — ' + s.name;

    var body =
      '**From:** ' + s.name + (s.company ? ' (' + s.company + ')' : '') + '\n' +
      '**Email:** ' + s.email + '\n' +
      (s.title ? '**Project:** ' + s.title + '\n' : '') +
      '**Type:** ' + s.type + '\n' +
      '**Tech stack:** ' + stack + '\n' +
      '**Features:** ' + features + '\n' +
      '**AI collaboration:** ' + s.ai + '\n' +
      '**Timeline:** ' + s.timeline + '\n' +
      '**Offer:** ' + offerText(s) + '\n' +
      (s.links ? '**Links:** ' + s.links + '\n' : '') +
      '\n---\n\n' + s.description + '\n\n' +
      '---\n*Submitted via the freelance project request tool*';

    return { title: title, body: body };
  }

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'form-status ' + type;
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Sending…' : 'Send Project Request';
  }

  submitBtn.addEventListener('click', function () {
    var s = collect();

    var problems = validate(s);
    if (problems.length) {
      showStatus('Almost there — please ' + problems.join(', ') + '.', 'error');
      return;
    }

    var captchaResponse = '';
    if (typeof hcaptcha !== 'undefined') {
      captchaResponse = hcaptcha.getResponse();
      if (!captchaResponse) {
        showStatus('Please complete the CAPTCHA.', 'error');
        return;
      }
    }

    var issue = buildIssue(s);
    var endpoint = form.getAttribute('data-endpoint');

    if (!endpoint) {
      // Fallback: open a pre-filled GitHub Issue URL.
      var url = 'https://github.com/' + form.getAttribute('data-repo') + '/issues/new?' +
        'title=' + encodeURIComponent(issue.title) +
        '&body=' + encodeURIComponent(issue.body) +
        '&labels=freelance-request';
      window.open(url, '_blank');
      showStatus('Redirecting to GitHub to submit your request…', 'success');
      return;
    }

    setBusy(true);
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: issue.title,
        body: issue.body,
        captcha: captchaResponse
      })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Server error');
        return r.json();
      })
      .then(function () {
        showStatus('Request sent! You’ll hear back personally, usually within 3 business days.', 'success');
        form.reset();
        applyNoPref();
        update();
        if (typeof hcaptcha !== 'undefined') hcaptcha.reset();
      })
      .catch(function (err) {
        showStatus('Failed to send. Please try again, or email me directly instead.', 'error');
        console.error(err);
      })
      .finally(function () {
        setBusy(false);
      });
  });

  // ── Wiring ─────────────────────────────────────────────────

  noPref.addEventListener('change', function () {
    applyNoPref();
    update();
  });
  form.addEventListener('change', update);
  form.addEventListener('input', update);

  update();
})();
