/* cmd-widget-cron — cronjob time format calculator.
   Mounts into <section data-cmd-widget="cron">.

   Parses a standard 5-field cron expression (minute hour day-of-month
   month day-of-week — no seconds/year), renders a per-field breakdown,
   a plain-English schedule sentence, and the next few run times computed
   in the browser's local time zone. Aliases (@daily etc.) are expanded;
   @reboot is recognised but has no time-based schedule to compute. */
(function () {
  if (typeof window.CMDW !== 'object') return;

  var MONTH_NAMES = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  var MONTH_LABELS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW_NAMES = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  var DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var ALIASES = {
    '@yearly': '0 0 1 1 *',
    '@annually': '0 0 1 1 *',
    '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0',
    '@daily': '0 0 * * *',
    '@midnight': '0 0 * * *',
    '@hourly': '0 * * * *'
  };
  var PRESETS = [
    ['', 'Presets…'],
    ['* * * * *', 'Every minute'],
    ['*/5 * * * *', 'Every 5 minutes'],
    ['*/15 9-17 * * 1-5', 'Every 15 min, 9–17 Mon–Fri'],
    ['0 * * * *', 'Hourly'],
    ['0 9 * * 1-5', 'Weekdays at 09:00'],
    ['0 0 * * *', 'Daily at midnight'],
    ['0 0 * * 0', 'Weekly (Sun 00:00)'],
    ['0 0 1 * *', 'Monthly (1st, 00:00)'],
    ['0 0 1 1 *', 'Yearly (Jan 1, 00:00)']
  ];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function resolveValue(token, min, max, nameMap) {
    token = token.trim();
    var num;
    if (nameMap && Object.prototype.hasOwnProperty.call(nameMap, token.toUpperCase())) {
      num = nameMap[token.toUpperCase()];
    } else if (/^\d+$/.test(token)) {
      num = parseInt(token, 10);
    } else {
      throw new Error('"' + token + '" is not a valid value');
    }
    if (num < min || num > max) throw new Error('"' + token + '" is out of range ' + min + '-' + max);
    return num;
  }

  /* Parses one raw cron field into { set: Set<number>, isWildcard, raw }.
     `max7` lets day-of-week accept the 0-7 alias range (7 === Sunday). */
  function parseField(raw, min, max, nameMap, max7) {
    raw = raw.trim();
    if (raw === '') throw new Error('field is empty');
    var isWildcard = (raw === '*' || raw === '?');
    var hi = max7 ? 7 : max;
    var set = new Set();
    raw.split(',').forEach(function (part) {
      part = part.trim();
      if (part === '') throw new Error('empty item in "' + raw + '"');
      var stepMatch = part.match(/^(.+)\/(\d+)$/);
      var step = 1;
      var base = part;
      if (stepMatch) {
        base = stepMatch[1];
        step = parseInt(stepMatch[2], 10);
        if (!step || step < 1) throw new Error('invalid step in "' + part + '"');
      }
      var start, end;
      if (base === '*') {
        start = min; end = hi;
      } else {
        var rangeMatch = base.match(/^([^-]+)-([^-]+)$/);
        if (rangeMatch) {
          start = resolveValue(rangeMatch[1], min, hi, nameMap);
          end = resolveValue(rangeMatch[2], min, hi, nameMap);
        } else {
          start = end = resolveValue(base, min, hi, nameMap);
        }
      }
      if (start > end) throw new Error('range "' + part + '" runs backwards');
      for (var v = start; v <= end; v += step) set.add(max7 && v === 7 ? 0 : v);
    });
    return { set: set, isWildcard: isWildcard, raw: raw };
  }

  function parseExpression(input) {
    var trimmed = input.trim();
    if (trimmed === '') throw new Error('Enter a cron expression.');
    if (trimmed.charAt(0) === '@') {
      var alias = trimmed.toLowerCase();
      if (alias === '@reboot') {
        var err = new Error('@reboot runs once at system boot — it has no time-based schedule to compute.');
        err.isReboot = true;
        throw err;
      }
      if (!Object.prototype.hasOwnProperty.call(ALIASES, alias)) {
        throw new Error('Unknown alias "' + trimmed + '". Supported: ' + Object.keys(ALIASES).concat(['@reboot']).join(', ') + '.');
      }
      trimmed = ALIASES[alias];
    }
    var tokens = trimmed.split(/\s+/);
    if (tokens.length !== 5) {
      throw new Error('Expected 5 fields (minute hour day-of-month month day-of-week), found ' + tokens.length + '. Seconds/year (Quartz-style 6–7 field) are not supported.');
    }
    return [
      parseField(tokens[0], 0, 59, null, false),
      parseField(tokens[1], 0, 23, null, false),
      parseField(tokens[2], 1, 31, null, false),
      parseField(tokens[3], 1, 12, MONTH_NAMES, false),
      parseField(tokens[4], 0, 6, DOW_NAMES, true)
    ];
  }

  function timeWord(desc, label) {
    return /^every /.test(desc) ? desc : (label + ' ' + desc);
  }

  function describePartText(raw, min, max, nameMap, singular, plural, formatter) {
    if (raw === '*' || raw === '?') return 'every ' + singular;
    return raw.split(',').map(function (part) {
      part = part.trim();
      var m = part.match(/^(\*|[^/]+)(?:\/(\d+))?$/);
      var base = m[1], step = m[2] ? parseInt(m[2], 10) : null;
      if (base === '*') return step ? ('every ' + step + ' ' + plural) : ('every ' + singular);
      var rangeMatch = base.match(/^([^-]+)-([^-]+)$/);
      if (rangeMatch) {
        var a = formatter(resolveValue(rangeMatch[1], min, max, nameMap));
        var b = formatter(resolveValue(rangeMatch[2], min, max, nameMap));
        return step ? ('every ' + step + ' ' + plural + ' from ' + a + ' to ' + b) : (a + '–' + b);
      }
      var val = formatter(resolveValue(base, min, max, nameMap));
      return step ? ('every ' + step + ' ' + plural + ' from ' + val) : val;
    }).join(', ');
  }

  function describeCron(fields) {
    var minute = fields[0], hour = fields[1], dom = fields[2], month = fields[3], dow = fields[4];
    var minuteDesc = describePartText(minute.raw, 0, 59, null, 'minute', 'minutes', pad2);
    var hourDesc = describePartText(hour.raw, 0, 23, null, 'hour', 'hours', pad2);
    var domDesc = describePartText(dom.raw, 1, 31, null, 'day', 'days', function (v) { return String(v); });
    var monthDesc = describePartText(month.raw, 1, 12, MONTH_NAMES, 'month', 'months', function (v) { return MONTH_LABELS[v]; });
    var dowDesc = describePartText(dow.raw, 0, 7, DOW_NAMES, 'day-of-week', 'days-of-week', function (v) { return DOW_LABELS[v % 7]; });

    var timePhrase;
    if (/^\d+$/.test(minute.raw) && /^\d+$/.test(hour.raw)) {
      timePhrase = 'At ' + pad2(parseInt(hour.raw, 10)) + ':' + pad2(parseInt(minute.raw, 10));
    } else {
      var hourPhrase = hour.isWildcard ? 'every hour' : timeWord(hourDesc, 'hour');
      timePhrase = 'At ' + timeWord(minuteDesc, 'minute') + ' past ' + hourPhrase;
    }

    var extra = [];
    if (!dom.isWildcard) extra.push('on ' + timeWord(domDesc, 'day-of-month'));
    if (!month.isWildcard) extra.push('in ' + timeWord(monthDesc, 'month'));
    if (!dow.isWildcard) extra.push('on ' + timeWord(dowDesc, 'weekday'));

    var sentence = timePhrase + (extra.length ? ', ' + extra.join(', ') : '') + '.';
    if (!dom.isWildcard && !dow.isWildcard) {
      sentence += ' Runs when EITHER the day-of-month OR the day-of-week matches — cron’s classic gotcha.';
    }
    return sentence;
  }

  /* Standard coarse-jump next-occurrence walk: skip whole months/days/hours
     that can't match before falling back to minute-by-minute. Bounded to
     `maxYears` from now so an impossible schedule (e.g. Feb 30) terminates. */
  function computeNextRuns(fields, count, maxYears) {
    var minutes = fields[0], hours = fields[1], doms = fields[2], months = fields[3], dows = fields[4];
    var domRestricted = !doms.isWildcard;
    var dowRestricted = !dows.isWildcard;

    var candidate = new Date();
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);
    var limit = new Date(candidate.getTime());
    limit.setFullYear(limit.getFullYear() + (maxYears || 5));

    var results = [];
    var guard = 0;
    var GUARD_MAX = 200000;
    while (results.length < count && candidate < limit && guard++ < GUARD_MAX) {
      var month = candidate.getMonth() + 1;
      if (!months.set.has(month)) {
        candidate.setMonth(candidate.getMonth() + 1, 1);
        candidate.setHours(0, 0, 0, 0);
        continue;
      }
      var dom = candidate.getDate();
      var dow = candidate.getDay();
      var dayMatches;
      if (domRestricted && dowRestricted) dayMatches = doms.set.has(dom) || dows.set.has(dow);
      else if (domRestricted) dayMatches = doms.set.has(dom);
      else if (dowRestricted) dayMatches = dows.set.has(dow);
      else dayMatches = true;
      if (!dayMatches) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(0, 0, 0, 0);
        continue;
      }
      var hour = candidate.getHours();
      if (!hours.set.has(hour)) {
        candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
        continue;
      }
      var minute = candidate.getMinutes();
      if (!minutes.set.has(minute)) {
        candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
        continue;
      }
      results.push(new Date(candidate.getTime()));
      candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
    }
    return results;
  }

  function formatRun(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) +
      ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ' (' + DOW_LABELS[date.getDay()] + ')';
  }

  CMDW.register('cron', function (root) {
    root.innerHTML = '';

    var state = { expression: '*/15 9-17 * * 1-5' };

    var body = CMDW.makeShell(root, 'cronjob time calculator');
    var lede = CMDW.el('p', { className: 'cmd-widget__lede', text: 'Parse a 5-field cron expression (minute hour day-of-month month day-of-week — no seconds/year) into a plain-English schedule and the next run times in your browser’s local time zone.' });

    var exprInput = CMDW.el('input', { type: 'text', className: 'cmd-widget__text cmd-widget__text--mono', value: state.expression, placeholder: '*/15 9-17 * * 1-5' });
    exprInput.addEventListener('input', function () { state.expression = exprInput.value; render(); });

    var presetSel = CMDW.el('select', { className: 'cmd-widget__select' });
    PRESETS.forEach(function (p) {
      presetSel.appendChild(CMDW.el('option', { value: p[0], text: p[1] }));
    });
    presetSel.addEventListener('change', function () {
      if (!presetSel.value) return;
      state.expression = presetSel.value;
      exprInput.value = presetSel.value;
      presetSel.value = '';
      render();
    });

    var exprRow = CMDW.el('div', { className: 'cmd-widget__row' });
    exprRow.appendChild(CMDW.el('label', { className: 'cmd-widget__row-label', text: 'Expression' }));
    exprRow.appendChild(exprInput);
    exprRow.appendChild(presetSel);

    var status = CMDW.el('p', { className: 'cmd-widget__status' });
    var fieldsList = CMDW.el('dl', { className: 'cmd-widget__cron-fields' });
    var scheduleOut = CMDW.makeOutput('Schedule (human-readable)');
    var runsOut = CMDW.makeOutput('Next 5 runs (local time)');

    body.appendChild(lede);
    body.appendChild(exprRow);
    body.appendChild(status);
    body.appendChild(fieldsList);
    body.appendChild(scheduleOut.el);
    body.appendChild(runsOut.el);

    var FIELD_LABELS = ['Minute', 'Hour', 'Day of month', 'Month', 'Day of week'];

    function renderFields(fields) {
      fieldsList.innerHTML = '';
      for (var i = 0; i < fields.length; i++) {
        fieldsList.appendChild(CMDW.el('dt', { text: FIELD_LABELS[i] }));
        fieldsList.appendChild(CMDW.el('dd', { text: fields[i].raw }));
      }
    }

    function render() {
      var fields;
      try {
        fields = parseExpression(state.expression);
      } catch (err) {
        status.textContent = '⚠ ' + err.message;
        status.className = 'cmd-widget__status cmd-widget__status--error';
        fieldsList.innerHTML = '';
        scheduleOut.set('');
        runsOut.set('');
        return;
      }
      status.textContent = 'Valid 5-field expression.';
      status.className = 'cmd-widget__status';
      renderFields(fields);
      scheduleOut.set(describeCron(fields));
      var runs = computeNextRuns(fields, 5, 5);
      runsOut.set(runs.length ? runs.map(formatRun).join('\n') : 'No upcoming run found within the next 5 years — this schedule may never occur (e.g. February 30).');
    }
    render();
  });
})();
