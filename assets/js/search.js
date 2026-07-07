(function () {
  'use strict';

  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  if (!searchInput || !searchResults) return;

  var lunrIndex = null;
  var documents = [];
  var loaded = false;
  var consentPending = false;

  // Source groups: render order + human labels. Local groups (blog/pages/
  // references) come from /search.json; the rest from /search-external.json.
  var GROUPS = [
    { key: 'blog', label: 'Blog' },
    { key: 'pages', label: 'Pages' },
    { key: 'references', label: 'References' },
    { key: 'apps', label: 'Apps' },
    { key: 'gh-pages', label: 'GitHub Pages' },
    { key: 'repos', label: 'GitHub Repos' },
    { key: 'gists', label: 'Gists' }
  ];
  var PER_GROUP = 4;
  var TOTAL_CAP = 12;

  // Load search index on first focus (consent-gated)
  searchInput.addEventListener('focus', loadIndex, { once: true });

  function loadIndex() {
    if (loaded) return;

    // Gate behind functional consent (Lunr.js is loaded from unpkg CDN)
    if (!window.__cookieConsent || !window.__cookieConsent.functional) {
      if (!consentPending) {
        consentPending = true;
        searchResults.innerHTML =
          '<div style="padding:1rem;text-align:center;color:var(--c-text-faint);font-size:0.85rem;">' +
            'Search requires functional cookies.<br>' +
            '<button onclick="CookieConsent.show()" style="margin-top:0.5rem;padding:0.3rem 0.7rem;' +
            'border:1px solid var(--c-border);border-radius:0.375rem;background:var(--c-surface-alt);' +
            'color:var(--c-text);font-size:0.8rem;cursor:pointer;font-family:inherit;">Cookie Settings</button>' +
          '</div>';
        window.addEventListener('consent-updated', function handler(e) {
          if (e.detail && e.detail.functional) {
            consentPending = false;
            searchResults.innerHTML = '';
            actuallyLoadIndex();
            window.removeEventListener('consent-updated', handler);
          }
        });
      }
      return;
    }

    actuallyLoadIndex();
  }

  function actuallyLoadIndex() {
    if (loaded) return;
    loaded = true;

    // Determine the baseurl from a meta tag or fallback
    var siteBase = document.querySelector('meta[name="baseurl"]');
    var prefix = siteBase ? siteBase.content : '';

    var script = document.createElement('script');
    script.src = 'https://unpkg.com/lunr@2.3.9/lunr.min.js';
    script.onload = function () {
      // Local (Jekyll) index + crawled external snapshot. A missing/failed
      // external file degrades gracefully to local-only results.
      Promise.all([
        fetch(prefix + '/search.json').then(function (r) { return r.json(); }).catch(function () { return []; }),
        fetch(prefix + '/search-external.json').then(function (r) { return r.json(); }).catch(function () { return []; })
      ]).then(function (parts) {
        documents = [].concat(parts[0] || [], parts[1] || []);
        lunrIndex = lunr(function () {
          this.ref('url');
          this.field('title', { boost: 10 });
          this.field('content');
          this.field('tags', { boost: 5 });
          this.field('category', { boost: 3 });
          documents.forEach(function (doc) { this.add(doc); }, this);
        });
        // Re-run any query typed before the index finished loading.
        if (searchInput.value.trim()) doSearch();
      }).catch(function (err) {
        console.warn('Search index failed to load:', err);
      });
    };
    document.head.appendChild(script);
  }

  // Debounced search
  var debounce;
  searchInput.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(doSearch, 200);
  });

  function doSearch() {
    var query = searchInput.value.trim();
    searchResults.innerHTML = '';

    if (!query || !lunrIndex) return;

    var results;
    try {
      results = lunrIndex.search(query + '~1'); // fuzzy
    } catch (e) {
      try {
        results = lunrIndex.search(query);
      } catch (e2) {
        return;
      }
    }

    if (results.length === 0) {
      searchResults.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--c-text-faint);font-size:0.9rem;">No results found.</div>';
      return;
    }

    // Bucket ranked results by group, preserving Lunr's relevance order.
    var byGroup = {};
    results.forEach(function (r) {
      var doc = documents.find(function (d) { return d.url === r.ref; });
      if (!doc) return;
      var g = doc.group || 'pages';
      (byGroup[g] = byGroup[g] || []).push(doc);
    });

    var total = 0;
    GROUPS.forEach(function (group) {
      if (total >= TOTAL_CAP) return;
      var docs = byGroup[group.key];
      if (!docs || docs.length === 0) return;

      var show = docs.slice(0, Math.min(PER_GROUP, TOTAL_CAP - total));
      if (show.length === 0) return;

      var label = document.createElement('div');
      label.className = 'search-group-label';
      label.textContent = group.label;
      searchResults.appendChild(label);

      show.forEach(function (doc) {
        total++;
        var item = document.createElement('a');
        item.className = 'search-result-item';
        item.href = doc.url;
        // External (absolute) results open in a new tab.
        if (/^https?:\/\//i.test(doc.url)) {
          item.target = '_blank';
          item.rel = 'noopener';
        }

        var title = document.createElement('h4');
        title.textContent = doc.title;

        var snippet = document.createElement('p');
        var text = doc.content || '';
        var snip = text.substring(0, 120) + (text.length > 120 ? '…' : '');
        if (doc.source) snip = snip ? snip + ' — ' + doc.source : doc.source;
        snippet.textContent = snip;

        item.appendChild(title);
        item.appendChild(snippet);
        searchResults.appendChild(item);
      });
    });
  }
})();
