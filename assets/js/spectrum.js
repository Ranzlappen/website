(function () {
  const table  = document.getElementById('spectrum-table');
  if (!table) return;

  const rows   = Array.from(table.querySelectorAll('tbody > tr'));
  const search = document.getElementById('spectrum-search');
  const count  = document.getElementById('spectrum-count');
  const empty  = document.getElementById('spectrum-empty');
  const tabs   = Array.from(document.querySelectorAll('.spectrum-tab'));
  const blurb  = document.getElementById('spectrum-batch-blurb');
  const dataEl = document.getElementById('spectrum-batch-data');

  let batchInfo = {};
  try { batchInfo = JSON.parse(dataEl.textContent || '{}'); } catch (_) { batchInfo = {}; }

  let activeBatch = 'all';
  const totalRows = rows.length;

  function applyFilters() {
    const q = (search.value || '').trim().toLowerCase();
    let visible = 0;
    for (const row of rows) {
      const inBatch = activeBatch === 'all' || row.dataset.batch === activeBatch;
      const matches = !q || row.textContent.toLowerCase().includes(q);
      const show = inBatch && matches;
      row.hidden = !show;
      if (show) visible++;
    }
    if (count) {
      count.textContent = (q || activeBatch !== 'all')
        ? `${visible} / ${totalRows}`
        : `${totalRows} rows`;
    }
    if (empty) empty.hidden = visible !== 0;
  }

  function setActiveBatch(id) {
    activeBatch = id;
    for (const t of tabs) {
      const isActive = t.dataset.batch === id;
      t.classList.toggle('is-active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    if (blurb) {
      const info = batchInfo[id];
      if (id === 'all' || !info) {
        blurb.hidden = true;
        blurb.innerHTML = '';
      } else {
        blurb.hidden = false;
        blurb.innerHTML = '<strong></strong><span></span>';
        blurb.querySelector('strong').textContent = info.name || '';
        blurb.querySelector('span').textContent   = info.description || '';
      }
    }
    applyFilters();
  }

  search.addEventListener('input', applyFilters);
  for (const t of tabs) {
    t.addEventListener('click', () => setActiveBatch(t.dataset.batch));
  }

  applyFilters();
})();

(function () {
  var table = document.getElementById('spectrum-table');
  if (!table) return;

  // 10 most-common abbreviations with plain-English explanations.
  var DICT = {
    'ISM':    { expansion: 'Industrial, Scientific, Medical',
                body: 'Worldwide license-free spectrum bands (e.g. 433 MHz EU, 902–928 MHz US, 2.4 GHz, 5.8 GHz) shared by Wi-Fi, Bluetooth, microwave ovens, and a long tail of consumer gadgets — anyone can transmit at low power without a license.' },
    'EIRP':   { expansion: 'Effective Isotropic Radiated Power',
                body: 'The TX power your transmitter would need to feed into a perfect omnidirectional (isotropic) antenna to match what your real antenna+amp combination radiates in its strongest direction. EIRP = TX power + antenna gain.' },
    'FR1':    { expansion: '5G NR Frequency Range 1 (sub-6 GHz)',
                body: 'The 5G NR low- and mid-band spectrum below 7.125 GHz — the cellular bands you actually get coverage on. Includes n1, n3, n7, n28, n41, n66, n71, n77, n78, n79.' },
    'FR2':    { expansion: '5G NR Frequency Range 2 (mmWave)',
                body: 'The 5G NR millimeter-wave spectrum 24.25–71 GHz — fast (multi-Gb/s) but very short range and easily blocked by buildings, hands, and rain. n257, n258, n260, n261.' },
    'ICNIRP': { expansion: 'International Commission on Non-Ionizing Radiation Protection',
                body: 'Independent body that publishes the global RF and optical exposure guidelines most national regulators (FCC OET-65, BNetzA, Ofcom) base their safe-distance rules on.' },
    'n78':    { expansion: '5G NR Band n78 — global C-band TDD',
                body: 'TDD 3300–3800 MHz — the canonical European, UK, German, and Japanese 5G C-band, plus India and large parts of Asia. The most-deployed 5G mid-band in the world.' },
    'CSI':    { expansion: 'Channel State Information',
                body: 'Per-subcarrier amplitude/phase data Wi-Fi devices already exchange to equalise the channel. Reading it (with ESP32-CSI-Tool, Atheros CSI Tool, or IEEE 802.11bf) lets you sense motion, gesture, even breathing through walls.' },
    'LoRa':   { expansion: 'Long Range (chirp-spread-spectrum)',
                body: 'Semtech’s low-power, low-data-rate radio modulation. Lets a 25 mW transmitter reach 5–15 km outdoors at the cost of just a few hundred bits per second. Foundation of LoRaWAN, Helium, and Meshtastic.' },
    'DFS':    { expansion: 'Dynamic Frequency Selection',
                body: 'Wi-Fi rule on UNII-2A and UNII-2C (5.250–5.350 / 5.470–5.725 GHz): the access point listens for weather/military radar pulses and must vacate the channel within 10 s if it hears one. Required by FCC + ETSI.' },
    'HPUE':   { expansion: 'High-Power User Equipment',
                body: 'A power-class-2 cellular phone or modem allowed to transmit at 26 dBm (≈400 mW) instead of the usual 23 dBm (200 mW). Enabled on n14 FirstNet and n41 / n78 / n79 mid-band 5G to extend uplink range.' },
    'PLC':    { expansion: 'Power-Line Communication / PowerLAN',
                body: 'Data carried over the electrical wiring already in your walls (2–30 MHz narrowband, standardised by IEEE 1901, HomePlug AV2, and ITU G.hn). Convenient for whole-home networking, but radiates as a major HF noise source and ruins reception on shortwave.' },
    'TDD':    { expansion: 'Time Division Duplex',
                body: 'Uplink and downlink share the same frequency channel and alternate in short time slots — efficient for asymmetric traffic and standard on 5G NR mid-band (n40, n41, n78, n79). Contrast with FDD where UL and DL use paired separate frequencies.' },
    'UNII':   { expansion: 'Unlicensed National Information Infrastructure',
                body: 'FCC umbrella term for the 5 GHz and 6 GHz Wi-Fi spectrum tiers — UNII-1, UNII-2A, UNII-2C, UNII-3, plus the new 6 GHz UNII-5/6/7/8 opened in 2020 for Wi-Fi 6E and Wi-Fi 7.' },
    'EME':    { expansion: 'Earth-Moon-Earth ("moonbounce")',
                body: 'Long-distance amateur-radio technique that aims a high-gain dish at the Moon and bounces signals off the lunar surface back to another station on Earth. Common on 2 m, 70 cm, 23 cm, 13 cm, 9 cm, 6 cm, 3 cm, and 1.25 cm ham bands.' }
  };

  // Sort longest first so 'FR2' is matched before 'FR'.
  var TERMS = Object.keys(DICT).sort(function (a, b) { return b.length - a.length; });
  var WORD_RE = new RegExp('\\b(' + TERMS.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\b', 'g');

  // Walk text nodes inside the table body and wrap matches in clickable spans.
  function decorate(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        // Skip nodes already inside an .abbr-trigger or inside a script/style.
        var p = node.parentNode;
        while (p && p !== root) {
          if (p.classList && p.classList.contains('abbr-trigger')) return NodeFilter.FILTER_REJECT;
          if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return WORD_RE.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    var targets = [];
    while (walker.nextNode()) targets.push(walker.currentNode);

    targets.forEach(function (node) {
      WORD_RE.lastIndex = 0;
      var text = node.nodeValue;
      var frag = document.createDocumentFragment();
      var lastIndex = 0;
      var m;
      while ((m = WORD_RE.exec(text)) !== null) {
        if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
        var span = document.createElement('span');
        span.className = 'abbr-trigger';
        span.setAttribute('data-abbr', m[1]);
        span.setAttribute('tabindex', '0');
        span.setAttribute('role', 'button');
        span.setAttribute('aria-label', m[1] + ' — click for explanation');
        span.textContent = m[1];
        frag.appendChild(span);
        lastIndex = m.index + m[1].length;
      }
      if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  // Modal infrastructure (built lazily on first open).
  var modal, termEl, expandEl, bodyEl, lastFocus;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'spectrum-abbr-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.hidden = true;
    modal.innerHTML =
      '<div class="spectrum-abbr-modal__backdrop"></div>' +
      '<div class="spectrum-abbr-modal__panel" role="document">' +
        '<button type="button" class="spectrum-abbr-modal__close" aria-label="Close">×</button>' +
        '<h3 class="spectrum-abbr-modal__term"></h3>' +
        '<p class="spectrum-abbr-modal__expansion"></p>' +
        '<p class="spectrum-abbr-modal__body"></p>' +
      '</div>';
    document.body.appendChild(modal);
    termEl   = modal.querySelector('.spectrum-abbr-modal__term');
    expandEl = modal.querySelector('.spectrum-abbr-modal__expansion');
    bodyEl   = modal.querySelector('.spectrum-abbr-modal__body');
    modal.querySelector('.spectrum-abbr-modal__backdrop').addEventListener('click', closeModal);
    modal.querySelector('.spectrum-abbr-modal__close').addEventListener('click', closeModal);
    return modal;
  }

  function openModal(term) {
    var def = DICT[term];
    if (!def) {
      // Allow custom <abbr title="..."> fallback content too.
      def = { expansion: term, body: term };
    }
    ensureModal();
    termEl.textContent = term;
    expandEl.textContent = def.expansion || '';
    bodyEl.textContent = def.body || '';
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.querySelector('.spectrum-abbr-modal__close').focus();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  // Decorate the table body (header is already short and stable).
  var tbody = table.querySelector('tbody');
  if (tbody) decorate(tbody);

  // Click / keyboard activation works document-wide so the abbreviation legend
  // cards (.abbr-card) and the in-table .abbr-trigger spans / native <abbr>
  // tags / any future [data-abbr] markup all open the same modal.
  function activateFromEvent(e) {
    var t = e.target.closest('.abbr-trigger, .abbr-card, abbr[title], [data-abbr]');
    if (!t) return;
    e.preventDefault();
    var term = t.getAttribute('data-abbr') ||
               (t.querySelector('.abbr-card__term') && t.querySelector('.abbr-card__term').textContent.trim()) ||
               t.textContent.trim();
    openModal(term);
  }
  document.addEventListener('click', activateFromEvent);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('.abbr-trigger, .abbr-card, abbr[title], [data-abbr]')) return;
    activateFromEvent(e);
  });
})();
