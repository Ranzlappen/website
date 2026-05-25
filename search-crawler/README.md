# search-crawler

On-demand crawler that builds **`../search-external.json`** — the static
"hardcoded" index of content that lives _outside_ the Jekyll site, so the
site search can return grouped results spanning all of RanzLappen's web
presence without any third-party search service or query-time crawling.

This is an **independent module** (per the repo's module-boundary
convention): its own `package.json`, no cross-imports, **zero runtime
dependencies** (Node 22 built-ins only — native `fetch`, regex-based HTML
parsing). It is excluded from the Jekyll build (`_config.yml`).

## Why a crawler + static snapshot?

The site is a static GitHub Pages deploy with a privacy-first stance (no
Google, consent-gated). A browser can't crawl external domains at query
time (CORS), and we don't want a third-party search widget. So we crawl
**server-side, on demand**, commit the result as a versioned JSON snapshot,
and the client merges it with the always-fresh local index. Nothing
third-party loads when a visitor searches.

## What it covers

| group | source |
|---|---|
| `apps` | `*.ranzlappen.com` subdomains (ticked, tools, twitch-mood-radar) |
| `gh-pages` | `ranzlappen.github.io/*`, `*.ranzlappen.github.io` |
| `repos` | `github.com/Ranzlappen/*` public repos (+ README, topics) |
| `gists` | `gist.github.com/Ranzlappen/*` |

Local content (blog posts, pages, reference pages → groups `blog`, `pages`,
`references`) is **not** crawled — it's emitted fresh by Jekyll into
`../search.json`. The client (`../assets/js/search.js`) loads both files,
merges them into one Lunr index, and renders results grouped by `group` in
the order above.

## Output schema (`../search-external.json`)

A JSON array; keys emitted in this order, empty values omitted:

```json
{
  "title":   "…",
  "url":     "https://… (absolute — also the unique Lunr ref)",
  "content": "plain-text snippet (~300 chars)",
  "group":   "apps | gh-pages | repos | gists",
  "tags":    "space-joined (repo topics)",
  "date":    "YYYY-MM-DD",
  "source":  "host (shown in the result snippet)"
}
```

## Run it

```bash
cd search-crawler
npm run crawl                 # web crawl works anywhere with network
GITHUB_TOKEN=<pat> npm run crawl   # add a token for the repos/gists groups
npm run lint                  # node --check syntax pass (CI uses this)
```

- **GitHub rate limit:** unauthenticated is 60 requests/hr. Without a token
  the `repos`/`gists` groups may come back empty (the run logs a rate-limit
  warning and continues — a partial index is preferable to none). The
  `search-crawl.yml` workflow passes the Actions `GITHUB_TOKEN`
  (5000/hr), so the canonical refresh path is the workflow.
- Output is written to the **repo root**, deduped by URL, sorted by group
  then title, with a trailing newline for clean diffs.

## Refresh in production

Trigger **Actions → "Re-crawl external search index" → Run workflow**
(`.github/workflows/search-crawl.yml`). It runs the crawler with the Actions
token and commits an updated `search-external.json` to `main`, which then
triggers the Pages deploy and ships the refreshed index.

## Layout

```
search-crawler/
  package.json        # type:module; scripts: crawl, lint; no deps
  sources.config.js   # seeds (web hosts + groups), github user, crawl caps
  crawl.mjs           # orchestrator → writes ../search-external.json
  src/
    util.mjs          # fetch-with-timeout, sleep, truncate, dedupeByUrl
    extract.mjs       # regex HTML→{title,desc,text}, links, markdown→text
    web.mjs           # sitemap-first, else shallow same-host BFS (caps)
    github.mjs        # REST: repos + gists (Link pagination, 403 backoff)
```

### Adding a seed

Add `{ url, group }` to `web` in `sources.config.js` (group must be one of
the taxonomy keys above), then re-crawl. Tune `crawl` caps
(`maxPagesPerHost`, `maxDepth`, `delayMs`, `timeoutMs`, `snippetChars`)
there too.

## Limitations

- **SPA shallow indexing.** ticked/tools/twitch-mood-radar are React SPAs.
  A plain server-side fetch retrieves the static HTML shell, so indexing is
  shallow (title/meta + skeleton text), not the JS-rendered content. A
  future upgrade could add Playwright/Puppeteer headless rendering for full
  SPA text.
- **Snapshot, not live.** Results reflect the last crawl only; refresh is
  manual (run the workflow).
- **Unreachable seeds** (e.g. a 404 `ranzlappen.github.io` root) are skipped
  gracefully — they never abort the run.
