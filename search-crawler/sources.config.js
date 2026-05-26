// Declarative source list for the external search crawler.
//
// `web`    - hosts to crawl. Each seed is fetched, then expanded
//            sitemap-first (else a shallow same-host BFS) up to the caps
//            in `crawl`. `group` tags every entry from that host.
// `github` - the GitHub user whose public repos + gists are indexed.
// `crawl`  - politeness + size limits shared by all web crawling.
//
// To add a seed, drop a new { url, group } into `web`. Groups must match
// the taxonomy in ../assets/js/search.js and ../search-crawler/README.md.

export default {
  web: [
    { url: "https://ticked.ranzlappen.com", group: "apps" },
    { url: "https://tools.ranzlappen.com", group: "apps" },
    { url: "https://twitch-mood-radar.ranzlappen.com", group: "apps" },
    { url: "https://ranzlappen.github.io", group: "gh-pages" },
  ],

  github: {
    user: "Ranzlappen",
    reposGroup: "repos",
    gistsGroup: "gists",
  },

  crawl: {
    maxPagesPerHost: 40,
    maxDepth: 2,
    delayMs: 400,
    timeoutMs: 10000,
    snippetChars: 300,
  },
};
