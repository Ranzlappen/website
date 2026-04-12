(function () {
  'use strict';

  var synth = window.speechSynthesis;
  if (!synth) return;

  var playBtn = document.getElementById('read-aloud-play');
  var stopBtn = document.getElementById('read-aloud-stop');
  var speedInput = document.getElementById('read-aloud-speed');
  var speedVal = document.getElementById('read-aloud-speed-val');
  var volumeInput = document.getElementById('read-aloud-volume');
  var voiceSelect = document.getElementById('read-aloud-voice');
  var iconPlay = playBtn ? playBtn.querySelector('.read-aloud__icon-play') : null;
  var iconPause = playBtn ? playBtn.querySelector('.read-aloud__icon-pause') : null;

  // Sticky TTS bar elements
  var stickyBar = document.getElementById('tts-sticky-bar');
  var stickyPlayBtn = document.getElementById('tts-sticky-play');
  var stickyStopBtn = document.getElementById('tts-sticky-stop');
  var stickyIconPlay = stickyPlayBtn ? stickyPlayBtn.querySelector('.tts-sticky-bar__icon-play') : null;
  var stickyIconPause = stickyPlayBtn ? stickyPlayBtn.querySelector('.tts-sticky-bar__icon-pause') : null;
  var stickyLabel = document.getElementById('tts-sticky-label');

  if (!playBtn) return;

  // --- State ---
  var sentences = [];
  var currentIndex = -1;
  var isPaused = false;
  var isStopping = false;
  var highlightedEl = null;
  var iosResumeInterval = null;
  var isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

  function startIosWorkaround() {
    if (iosResumeInterval || !isIos) return;
    iosResumeInterval = setInterval(function () {
      if (synth.speaking && !synth.paused) {
        synth.pause();
        synth.resume();
      }
    }, 14000);
  }

  function stopIosWorkaround() {
    if (iosResumeInterval) {
      clearInterval(iosResumeInterval);
      iosResumeInterval = null;
    }
  }

  // --- Extract text from post body, ignoring links/images/nav ---
  function extractSentences() {
    var body = document.querySelector('.post-body[itemprop="articleBody"]');
    if (!body) return [];

    var result = [];
    var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        var tag = parent.tagName;
        // Skip code blocks, links (href), images, nav, scripts, styles
        if (parent.closest('pre, code, nav, script, style, .post-tags, .post-nav')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    // Group text by paragraph-level parent
    var paragraphs = [];
    var lastBlock = null;
    textNodes.forEach(function (node) {
      var block = node.parentElement.closest('p, li, h2, h3, h4, h5, h6, blockquote, td, th');
      if (!block) block = node.parentElement;
      var text = node.textContent.trim();
      if (!text) return;

      if (block === lastBlock && paragraphs.length > 0) {
        paragraphs[paragraphs.length - 1].text += ' ' + text;
      } else {
        paragraphs.push({ el: block, text: text });
        lastBlock = block;
      }
    });

    // Split into sentences
    paragraphs.forEach(function (para) {
      // Split on sentence-ending punctuation
      var parts = para.text.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g);
      if (!parts) parts = [para.text];
      parts.forEach(function (s) {
        var trimmed = s.trim();
        if (trimmed.length > 0) {
          result.push({ text: trimmed, el: para.el });
        }
      });
    });

    return result;
  }

  // --- Highlight ---
  function highlightSentence(el) {
    clearHighlight();
    if (el) {
      el.classList.add('read-aloud-highlight');
      highlightedEl = el;
      // Scroll into view if needed, accounting for sticky TTS bar
      var rect = el.getBoundingClientRect();
      var mobileBar = document.querySelector('.voting-mobile-bar');
      var bottomOffset = (mobileBar && window.getComputedStyle(mobileBar).display !== 'none') ? 120 : 80;
      var topOffset = 60;
      if (stickyBar && stickyBar.classList.contains('is-visible')) {
        topOffset += stickyBar.offsetHeight;
      }
      if (rect.top < topOffset || rect.bottom > window.innerHeight - bottomOffset) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  function clearHighlight() {
    if (highlightedEl) {
      highlightedEl.classList.remove('read-aloud-highlight');
      highlightedEl = null;
    }
  }

  // --- Sticky bar visibility ---
  function showStickyBar() {
    if (!stickyBar) return;
    stickyBar.removeAttribute('hidden');
    // Force reflow so the transition triggers
    void stickyBar.offsetHeight;
    stickyBar.classList.add('is-visible');
  }

  function hideStickyBar() {
    if (!stickyBar) return;
    stickyBar.classList.remove('is-visible');
    stickyBar.addEventListener('transitionend', function handler() {
      stickyBar.removeEventListener('transitionend', handler);
      stickyBar.setAttribute('hidden', '');
    });
  }

  // --- Toggle play/pause icons ---
  function showPlayIcon() {
    if (iconPlay) iconPlay.style.display = '';
    if (iconPause) iconPause.style.display = 'none';
    playBtn.setAttribute('aria-label', 'Play');
    playBtn.setAttribute('title', 'Read aloud');
    // Sync sticky bar
    if (stickyIconPlay) stickyIconPlay.style.display = '';
    if (stickyIconPause) stickyIconPause.style.display = 'none';
    if (stickyLabel) stickyLabel.textContent = 'Paused';
  }

  function showPauseIcon() {
    if (iconPlay) iconPlay.style.display = 'none';
    if (iconPause) iconPause.style.display = '';
    playBtn.setAttribute('aria-label', 'Pause');
    playBtn.setAttribute('title', 'Pause reading');
    // Sync sticky bar
    if (stickyIconPlay) stickyIconPlay.style.display = 'none';
    if (stickyIconPause) stickyIconPause.style.display = '';
    if (stickyLabel) stickyLabel.textContent = 'Reading aloud…';
  }

  // --- Speak a sentence at index ---
  function speakAt(index) {
    if (index < 0 || index >= sentences.length) {
      // Done
      currentIndex = -1;
      showPlayIcon();
      clearHighlight();
      stopIosWorkaround();
      hideStickyBar();
      return;
    }

    currentIndex = index;
    isStopping = false;
    var sent = sentences[index];
    highlightSentence(sent.el);

    var utterance = new SpeechSynthesisUtterance(sent.text);
    utterance.rate = parseFloat(speedInput.value);
    utterance.volume = parseFloat(volumeInput.value);

    // Set voice
    var selectedVoice = getSelectedVoice();
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = 'en';

    utterance.onend = function () {
      if (!isStopping) {
        speakAt(index + 1);
      }
    };

    utterance.onerror = function (e) {
      if (!isStopping && e.error !== 'canceled' && e.error !== 'interrupted') {
        speakAt(index + 1);
      }
    };

    synth.speak(utterance);
  }

  function getSelectedVoice() {
    var voices = synth.getVoices();
    var val = voiceSelect.value;
    if (!val) return null;
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].name === val) return voices[i];
    }
    return null;
  }

  // --- Populate voices ---
  function populateVoices() {
    var voices = synth.getVoices();
    // Filter for English voices first, then all
    var english = voices.filter(function (v) { return /en[-_]/i.test(v.lang); });
    var list = english.length > 0 ? english : voices;

    voiceSelect.innerHTML = '<option value="">Default</option>';
    list.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = v.name + (v.lang ? ' (' + v.lang + ')' : '');
      if (v.default) opt.textContent += ' *';
      voiceSelect.appendChild(opt);
    });
  }

  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = populateVoices;
  }
  populateVoices();

  // --- Controls ---
  playBtn.addEventListener('click', function () {
    if (synth.speaking && !isPaused) {
      // Pause: cancel current utterance, remember position
      isStopping = true;
      synth.cancel();
      isPaused = true;
      showPlayIcon();
      stopIosWorkaround();
      return;
    }

    if (isPaused && currentIndex >= 0) {
      // Resume: re-speak current sentence from beginning
      isPaused = false;
      showPauseIcon();
      startIosWorkaround();
      speakAt(currentIndex);
      return;
    }

    // Start fresh
    sentences = extractSentences();
    if (sentences.length === 0) return;
    isPaused = false;
    showPauseIcon();
    showStickyBar();
    startIosWorkaround();
    speakAt(0);
  });

  stopBtn.addEventListener('click', function () {
    isStopping = true;
    synth.cancel();
    isPaused = false;
    currentIndex = -1;
    showPlayIcon();
    clearHighlight();
    stopIosWorkaround();
    hideStickyBar();
  });

  speedInput.addEventListener('input', function () {
    speedVal.textContent = parseFloat(this.value).toFixed(1) + 'x';
    // If currently speaking, restart current sentence with new speed
    if (synth.speaking && currentIndex >= 0) {
      isStopping = true;
      synth.cancel();
      isPaused = false;
      showPauseIcon();
      speakAt(currentIndex);
    }
  });

  // --- Sticky bar controls (delegate to main controls) ---
  if (stickyPlayBtn) {
    stickyPlayBtn.addEventListener('click', function () {
      playBtn.click();
    });
  }
  if (stickyStopBtn) {
    stickyStopBtn.addEventListener('click', function () {
      stopBtn.click();
    });
  }

  // --- Settings panel toggle (mobile) ---
  var settingsToggle = document.getElementById('read-aloud-settings-toggle');
  var settingsPanel = document.getElementById('read-aloud-settings-panel');

  if (settingsToggle && settingsPanel) {
    settingsToggle.addEventListener('click', function () {
      var isOpen = settingsPanel.classList.toggle('is-open');
      settingsToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', function (e) {
      if (!settingsPanel.contains(e.target) && !settingsToggle.contains(e.target)) {
        settingsPanel.classList.remove('is-open');
        settingsToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Clean up on page leave
  window.addEventListener('beforeunload', function () {
    isStopping = true;
    synth.cancel();
    stopIosWorkaround();
    hideStickyBar();
  });

})();
