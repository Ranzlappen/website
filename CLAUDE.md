# ranzlappen.com

Personal blog + PolyVote community voting platform + Blog Admin dashboard + Inventory Manager + Tabletop game engine, hosted on GitHub Pages.

## Architecture

**Hybrid project** with five independent builds plus a build-time tooling module:

- **Jekyll blog** (root) — Static site built by GitHub Pages. Posts in `_posts/`, layouts in `_layouts/`, includes in `_includes/`, pages in `pages/`. Config: `_config.yml`.
- **PolyVote** (`polyvote/`) — React 19 SPA built with Vite. Backend: Firebase (Firestore, Auth, Cloud Functions). Deployed as a subfolder within the Jekyll `_site/`.
- **Blog Admin** (`blog-admin/`) — React 19 SPA built with Vite for managing blog drafts and publishing. Uses Firebase (Firestore, Auth), CodeMirror 6 for Markdown editing, and Zustand for state. Deployed as a subfolder within the Jekyll `_site/`.
- **Inventory Manager** (`inventory-manager/`) — React 19 SPA built with Vite for managing inventory with folders, custom per-folder field schemas, photos in Firebase Storage, CSV/JSON import-export, and **multi-platform export** (per-folder "platform tags" drive required columns + a per-platform CSV/TSV/XML export for eBay, Amazon, Kleinanzeigen, Whatnot, Facebook, idealo, billiger.de, Geizhals). Admin-only via Firebase Auth custom claim (same login as Blog Admin). Hidden from crawlers (robots.txt `Disallow: /inventory/` + `noindex` meta tags + not listed in nav). Deployed as a subfolder within the Jekyll `_site/` at `/inventory/`. **See [`inventory-manager/README.md`](./inventory-manager/README.md) for the architecture handbook** (data model, persistence, the platform registry + export formats, how to add field types or functions).
- **Tabletop** (`games/`) — React 19 SPA built with Vite: a **reusable browser game engine for card and board games**. The engine core (`games/src/engine/`) is framework-agnostic TypeScript (state, players, turns, phases, a deterministic seeded RNG, pure `applyAction` reducer, serialization, undo/redo, registries) with no React/Firebase imports; the React layer (`games/src/ui/`), persistence (`games/src/storage/`) and a backend-agnostic multiplayer `SyncAdapter` (`games/src/net/` — a zero-config cross-tab Local adapter plus an optional Firebase RTDB adapter, default local) sit on top. Ships three playable demo games (Crown Rush — card; Lantern Hunt — board; Lantern/Relic Run — hybrid), three themes, an all-SVG/CSS asset library, and 64 Vitest tests. Modes: solo vs bots, hot-seat, online rooms (join by code/link, presence, ready, reconnect). Online has two trust models behind the one adapter interface (selected by `adapter.serverAuthoritative`): the default **Local** adapter is *client* host-authoritative (cross-tab), while the optional **Firebase** adapter is *server* authoritative — the engine is mirrored into `polyvote/functions/src/games/` and the `gamesCreateMatch`/`gamesSubmitAction` Cloud Functions validate + apply every move (actor = authenticated anon-auth uid) and write per-player redacted RTDB slots (clients read only their own; `database.rules.json` denies client state writes). Deployed as a subfolder within the Jekyll `_site/` at `/games/`. **See [`games/README.md`](./games/README.md) and the handbook at [`games/docs/wiki/README.md`](./games/docs/wiki/README.md)** (architecture, engine concepts, how to add a card/board/hybrid game, assets, themes, Firebase, testing, accessibility, performance, API reference).
- **Search Crawler** (`search-crawler/`) — Node 22, **dependency-free** build tooling (not deployed). Crawls off-site content (`*.ranzlappen.com` subdomains, `*.ranzlappen.github.io`, `github.com/Ranzlappen` repos + gists) and writes the committed static index `search-external.json`, which the blog's grouped cross-domain search merges with the Jekyll-generated `search.json`. Run on demand via the `search-crawl.yml` workflow or `npm run crawl`. **See [`search-crawler/README.md`](./search-crawler/README.md).**

## Build & Development

### Blog (Jekyll)
```bash
bundle exec jekyll serve          # Local dev server at :4000
```

### PolyVote (React/Vite)
```bash
cd polyvote
npm install                       # Install dependencies
npm run dev                       # Local dev server at :5173
npm run build                     # Production build (tsc + vite build)
npm run lint                      # ESLint (flat config)
npm test                          # Vitest (unit tests)
npm run format                    # Prettier formatting
```

### Blog Admin (React/Vite)
```bash
cd blog-admin
npm install                       # Install dependencies
npm run dev                       # Local dev server
npm run build                     # Production build (tsc + vite build)
npm run lint                      # ESLint (flat config)
npm run format                    # Prettier formatting
```

### Inventory Manager (React/Vite)
```bash
cd inventory-manager
npm install                       # Install dependencies
npm run dev                       # Local dev server
npm run build                     # Production build (tsc + vite build)
npm run lint                      # ESLint (flat config)
npm run format                    # Prettier formatting
```

### Tabletop game engine (React/Vite)
```bash
cd games
npm install                       # Install dependencies
npm run dev                       # Local dev server (/games/)
npm run build                     # Production build (tsc -b + vite build)
npm run lint                      # ESLint (flat config)
npm test                          # Vitest (engine core + demos + render smoke)
npm run format                    # Prettier formatting
```

### Search Crawler (Node)
```bash
cd search-crawler
npm run crawl                     # Build ../search-external.json (web works; repos/gists need GITHUB_TOKEN)
GITHUB_TOKEN=<pat> npm run crawl  # Include the repos/gists groups (raises API limit 60→5000/hr)
npm run lint                      # node --check syntax pass (what CI runs)
```

### Cloud Functions
```bash
cd polyvote/functions
npm install
npm run build                     # Compile TypeScript
npm run lint                      # tsc --noEmit
npm test                          # Vitest (unit tests)
```

Production deploys of `castBlogVote`, the Blog Admin callables (`blogSaveDraft`, `blogListDrafts`, `blogGetDraft`, `blogDeleteDraft`, `blogListExistingPosts`, `blogFetchExistingPost`, `blogImportPostForEdit`, `blogPublishToGitHub`, `blogUploadImage`, `blogListSeriesUsage`), the admin user-management callables shared with the Blog Admin Users panel (`setUserRole`, `adminListUsers`, `adminBanUser`, `adminUnbanUser`), and the Inventory Manager callables (`inventoryListFolders`, `inventoryCreateFolder`, `inventoryUpdateFolder`, `inventoryDeleteFolder`, `inventoryDuplicateFolder`, `inventoryListItems`, `inventoryGetItem`, `inventoryCreateItem`, `inventoryUpdateItem`, `inventoryDeleteItem`, `inventoryToggleEbaySync`, `inventoryUploadPhoto`, `inventoryDeletePhoto`, `inventoryReorderPhotos`, `inventoryImport`, `inventoryExport`, `inventoryExportPlatforms`), and the Tabletop online arbiter callables (`gamesCreateMatch`, `gamesSubmitAction`) are automated (see CI/CD below). Manual deploys of anything else use `firebase deploy --only functions:<name>` from `polyvote/`.

## Key Conventions

- **Module boundaries**: `polyvote/`, `blog-admin/`, `inventory-manager/`, `games/`, and the Jekyll root (blog) are five independent modules, with `polyvote/functions/` as a sixth nested module and `search-crawler/` as a seventh (dependency-free build tooling, not deployed). The `games/` module enforces its own internal layering on top of this: `games/src/engine/` is framework-agnostic (no React/Firebase); the React/network/storage layers depend on the engine, never the reverse (see `games/docs/wiki/architecture.md`). Each has its own `package.json`/`Gemfile`, TypeScript/ESLint/Tailwind config, and deploy path. Run install/lint/test/build/format from within the module's own directory (see **Build & Development**). Do **not** cross-import source between modules — there is no monorepo tooling and no shared package. If logic truly needs to be shared, duplicate it intentionally (e.g. `polyvote/functions/src/inventory/shared.ts` is mirrored in `inventory-manager/src/types.ts`, and the platform registry `polyvote/functions/src/inventory/platforms.ts` is mirrored data-only in `inventory-manager/src/platforms.ts` — backend keeps the value-transform functions the frontend doesn't need; and the Tabletop **engine core + game definitions are mirrored** from `games/src/engine/` + `games/src/games/*.ts` into `polyvote/functions/src/games/engine/` + `.../defs/` so the server arbiter validates/applies moves with the exact same deterministic logic as the client — keep the two copies in sync when changing engine rules or a game's reducer). Scope PRs to a single module when possible so CI's per-app path filters stay meaningful.
- **Post status**: Posts use a `status` field in front matter (`published`, `draft`, `placeholder`, `unpublished`). Only `published` and `placeholder` appear in the sitemap and feed.
- **Post categories**: Posts set a singular `category:` field in front matter. The string `"Projects"` (capitalized, exact match) is canonical and routes the post to `/projects/`; everything else lands on `/blog/`. Homepage and `/categories/` show all categories. Liquid's `==` is case-sensitive — keep the exact casing.
- **Post hero images**: A post's `image:` (card cover, rendered 600×340) and `backdrop:` (full-bleed parallax hero on the post page) live at `/assets/images/<slug>/<slug>-hero.webp` (usually the same file for both). They double as the homepage prefetch payload (see the landing-page hub in `_layouts/home.html`), so keep them lean: **genuine WebP** (not a JPEG/PNG renamed `.webp` — browsers sniff content so a mislabeled file still renders, but it bloats the file and ships EXIF), ~1280px wide, metadata stripped, **target ≤50 KB**. Encode with `cwebp -q 80 -m 6 -metadata none in.png -o out.webp`, and for stubborn photos size-target instead (`cwebp -mt -m 6 -pass 10 -size 50000 -metadata none …`). Some heroes are SVG (vector, already tiny) — those are fine as-is.
- **Navigation**: Centralized in `_data/pages.yml` — single source of truth for nav and footer links. Reference pages are reached via the top-nav **References** entry, which routes to `/references/` — a hand-rolled index page (`pages/references/index.html`) that lists Spectrum, Electronics Fundamentals, the CLI Cheat Sheet, and the Web Dev Tech Stack as cards. Don't add individual reference URLs to `_data/pages.yml`; add a new card to the index page instead.
- **Abbreviations / glossary**: Reference pages share one utility for term cards + click-to-explain modal + opt-in in-content decoration. Per-page YAML datasets live under `_data/abbreviations/<page>.yml`; markup is `_includes/abbreviations-section.html`; styles `/assets/css/abbreviations.css`; behaviour `/assets/js/abbreviations.js`. To add it to a page: include the partial with `data=site.data.abbreviations.<page>`, pull in the CSS+JS, and add `data-abbr-decorate` to any element whose text should auto-link matched terms. Per-page datasets are isolated, so the same key can have different definitions on different pages with no collision. Entry schema: `term` + `full_form` + `explanation` (required) plus optional `plain` (beginner-first prose), `example` (shell/code snippet rendered as `<pre><code>` in the modal — string or array; literal text, not HTML), `interpretation` (structured table with `title`/`columns`/`rows`/`footnote`), and `aliases` (array of case/plural variants emitted into the JSON island as `{"aliasOf": term}` so they decorate and open the canonical card without rendering their own card — this is how lowercase `posix` / plural `globs` become clickable). All optional fields are additive — existing entries without them render identically. `abbreviations.js` exposes `window.Glossary = { openTerm, openInline, decorate }` for pages that drive the modal directly (the CLI cheat sheet wires worked-example clicks to `openInline`, which uses the modal's visible `lead` field). Decoration normally skips `<code>`, but a `<code class="abbr-decorate-code">` opts back in so command tokens inside worked examples become clickable glossary triggers.
- **Reference-table scaffolding**: The sticky tab strip + live-search + scrollable big-table pattern used by `/references/spectrum/`, `/references/cmd-cheat-sheet/`, and `/references/web-dev-tech-stack/` is shared. Styles live in `/assets/css/reference-table.css` (controls, tabs, search, sticky thead, `.is-sticky-col` hook for the pinned column, generic legend swatches, `.reference-badge` base, the `.cell-collapse` family). Behaviour lives in `/assets/js/reference-table.js` and exposes one function — `window.initReferenceTable({tableId, tabSelector, searchId, countId, emptyId, blurbId, batchDataId, sortable, osFilterId, osAttr})` — that each page's thin wrapper calls with its own IDs. The last three are opt-in: `sortable: true` injects a click-to-sort control into every `<th>` (cycles ascending → descending → original; a cell's sort key is its `data-sort` attribute, else its text, numeric when both compared values parse as numbers; one column at a time), and `osFilterId`/`osAttr` wire a secondary `<select>` filter (the `.reference-osfilter` control) that ANDs a token match against a per-row attribute (default `data-os`) on top of the tab + search filters. The CLI cheat sheet passes all three; Spectrum passes none (unchanged). Per-page CSS files (`spectrum.css`, `cmd-cheat-sheet.css`, `web-dev-tech-stack.css`) layer column widths and palette modifiers on top, scoped under `.reference-page--<slug>` so overrides cannot leak between pages. The Web Dev Tech Stack page (`/references/web-dev-tech-stack/`, data in `_data/web-dev-tech-stack/*.yml`, ~120 technologies across 15 category tabs) is the newest example: it passes `sortable: true` plus reuses the generic `osFilterId`/`osAttr` secondary `<select>` as a **Layer** filter (`data-layer`), renders `maturity` / `learning_curve` / `layer` / `license` as colour-coded `.reference-badge` palettes, makes `prerequisites`/`pairs_well_with`/`alternatives` clickable cross-links to other rows' `#row-<slug>` anchors, and wires a per-row code `example` to `window.Glossary.openInline`. `_data/web-dev-tech-stack/lint.sh` enforces its quality bar (see that dir's README for the entry schema). To add a third reference page: opt in via `<section class="reference-page reference-page--<slug>">`, load the shared CSS/JS before the per-page ones, and write a thin wrapper that calls `initReferenceTable`. The shared CSS also carries a tablet breakpoint (`641–1024px` drops the search box onto its own full-width row). The table wrapper is a bounded sticky scroll box (sticky thead + sticky `.is-sticky-col`) on **all** viewports including phones; on mobile the `max-height` is capped lower (`calc(100vh - header - 9rem)`) so the page footer sits cleanly below the box and stays reachable by scrolling past it (no static/un-pin override — an earlier touch-un-pin hack was removed because it killed the sticky header and let the footer bleed into the table). The bounded box is deliberate: a horizontal-scroll container is required for the wide table, and that same container is what lets the sticky thead + sticky first column pin (a pure page-flow table can't scroll wide content horizontally without breaking the viewport-pinned header). The controls strip's sticky `top` and the wrapper's `top`/`max-height` key off the global `--header-offset` custom property (defaults to `--header-height`), so unpinning the site header (which sets `--header-offset: 0` — see the header sticky-toggle under **Theme**) collapses the gap and grows the box to reclaim that height. The wrapper's `top`/`max-height` *also* add `--reference-controls-h` — the **real measured height of the `.reference-controls` strip**, which `reference-table.js` publishes on `<html>` (once on init, then live via a `ResizeObserver` on the strip + a debounced `resize` listener) — so the box pins *exactly* below the controls instead of a hardcoded gap. This fixes the mobile bug where the controls strip stacks to 2–3 rows (taller than the old `5.25rem` gap) and its `z-index: 10` covered the sticky thead, leaving the reader with no column header; the `3.25rem`/`5.25rem` literals now survive only as no-JS fallbacks. `/assets/js/resize-handle.js` is a shared, self-attaching util that replaces the tiny native textarea resize corner with a large pointer+keyboard drag grabber on any `textarea[data-resize]` or `.cmd-widget__textarea`; load it after whatever builds the textareas. The CLI cheat sheet's table adds five columns beyond Spectrum's pattern — **OS / Appliance** (sortable; its `<select>` drives the secondary OS filter), **Danger** (sortable via a numeric `data-sort` rank: safe `0` < caution `1` < destructive `2`), **Recipes/Combos** (`recipes` = array of `{code, explain}`), **Modern alt** (`modern` string), and **Docs** (renders the existing `references` field) — and renders `examples` (now `{code, explain}` objects) as clickable buttons that open an explanation modal via `window.Glossary.openInline`. The per-row OS badge pills **and** the `danger` chip (`safe`/`caution`/`destructive`) *also* render stacked beneath the command name inside the sticky first column: this is intentional redundancy — the stacked copy stays visible during horizontal scroll, while the dedicated **OS / Appliance** and **Danger** columns are the sortable + filterable/searchable ones (each `<tr>` carries `data-os` + `data-danger` for the filter/sort, and the OS column renders text labels so search matches "linux", "macos", … too). **Raw-HTML cells**: `description`, flag `description`, `modern`, and `gotchas` are emitted as raw HTML so inline `<code>` works — literal placeholder angle brackets (`<script>`, `<path>`, …) must be escaped (`&lt;…&gt;`) in the data or they break the table DOM (a literal `<script>` swallows the rest of the table so the footer renders inside it). `_data/cmd-cheat-sheet/lint.sh` fails the build if any rawtext/script tag lands inside the command table.
- **Content tables (blog posts + static pages)**: Every `<table>` inside `.post-body` (posts) or `.page-body` (pages) is auto-styled in `assets/css/style.css` (search "Content tables") to match the reference-page tables — a rounded bordered card on `--c-surface` with a soft shadow, an uppercase sticky `thead` on `--c-surface-alt`, `--c-border-light` row separators, and a row-hover highlight (deliberately mirrors `reference-table.css` / `electronics-fundamentals.css`, theme-aware via CSS vars). **Authors write a plain Markdown table (or a bare HTML `<table>`) with no inline `style=` and no wrapper `<div>`** — the shared CSS does everything; the old per-table inline-style + `overflow-x` wrapper pattern is retired (it just fights the global CSS). The **only** content table that intentionally opts out of this look is the CLI Command Cheat Sheet, which uses the sortable/filterable reference-table scaffolding instead. See the README's "Add a Data Table" guide.
- **cmd-widgets (Interactive Tools section on the CLI cheat sheet)**: Four browser-only widgets — chmod calculator, find builder, regex tester, curl composer — live on `/references/cmd-cheat-sheet/`. JS lives in `/assets/js/cmd-widget-core.js` (registry + `CMDW.mountAll()` + `CMDW.copyToClipboard()` + `CMDW.shellEscape()` + `CMDW.makeOutput()`/`CMDW.el()` helpers) and four `cmd-widget-<name>.js` files that each call `CMDW.register('<name>', factory)`. The entry point `cmd-widget-bundle.js` calls `mountAll()` on DOMContentLoaded; the loader scans for `<section data-cmd-widget="<name>">` and invokes the matching factory. Each factory builds its UI into a collapsible `<details>` shell via `CMDW.makeShell(root, title)` (returns the body element to append into; the title becomes the `<summary>` heading). Styles in `/assets/css/cmd-widgets.css`. Adding a fifth widget: create `cmd-widget-<name>.js` (call `CMDW.makeShell` first, append controls to the returned body), drop a `<section data-cmd-widget="<name>">` on the page, add the script tag, optionally hook a `see_also: ["widget-<name>"]` entry from a cmd row (the see-also renderer in `cmd-cheat-sheet.html` routes `widget-*` slugs to `#widget-<name>` instead of `#cmd-<slug>`). Per CLAUDE.md's "duplicate intentionally" rule, the widget core deliberately mirrors EF's pattern rather than importing it — they're independent.
- **External apps**: The user's external apps (standalone subdomains like `ticked.ranzlappen.com`) are **not** in the navbar. They're listed in `_data/projects.yml` and rendered as a favicon strip in the footer via `_includes/footer.html`. Favicons are committed locally under `assets/images/favicons/` — **do not hotlink** upstream favicons (privacy-first: hotlinking leaks visitor IP/UA to the subdomain on every page load, before consent). These footer favicons are **48×48 PNG downscales of each app's master icon** from the shared "icon universe" (the same minimalist blue-emblem family used for the site's own icons) — generate them by downscaling the brand master, not by curling the live site. The blog's **own** favicons / PWA icons live in **`/icons/`** at the repo root (`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`), wired in `_includes/head.html` + `site.webmanifest`. The icon set is generated **full-bleed** from masters that carry their own dark glassy-shield background, so every favicon / install / home-screen icon is a consistent dark tile (the `maskable` variants are the same full-bleed art — the master's built-in dark margin keeps the emblem clear of circular/squircle mask crops). PolyVote ships its own set in `polyvote/public/` (referenced by the `vite-plugin-pwa` manifest in `polyvote/vite.config.ts`). **Blog Admin and Inventory Manager** likewise each ship their own installable home-screen icon set + a static `manifest.webmanifest` in their `public/` dir (`blog-admin/public/`, `inventory-manager/public/`) — full-bleed dark glassy-shield tiles from the brand masters (an "A" shield for Blog Admin, an open-box shield for Inventory). The `any`-purpose icons (`icon-192.png`/`icon-512.png`), favicons, and apple-touch icons are the full-bleed art; the **`maskable` variants (`icon-maskable-192.png`/`icon-maskable-512.png`) are downscaled + re-centered on the tile's dark background so the glowing shield occupies ~0.625 of the height** — matching PolyVote's dedicated maskable framing (`polyvote/public/pwa-maskable-512x512.png`). This gives Android's adaptive-icon safe zone real padding: the earlier approach of reusing the full-bleed art as the maskable made the home-screen emblem render noticeably larger/tighter than PolyVote's. Regenerate the maskables from the full-bleed `icon-512.png` with the Pillow script pattern (scale the whole tile by `0.625 / measured-shield-hfrac`, paste centered on the corner-sampled background color, then downscale 512→192). These are wired in each app's `index.html` head (favicon links + `apple-touch-icon` + `<link rel="manifest">` + `theme-color`). These two have **no** `vite-plugin-pwa` / service worker — just a plain manifest so Android/iOS "Add to Home Screen" picks up a real icon (`scope`/`start_url` are `/blog-admin/` and `/inventory/`; `theme_color`/`background_color` match the apps' `#0b1210` UI). Inventory's manifest does not undermine its crawler-hiding — `robots.txt` still `Disallow: /inventory/` and the SPA stays `noindex`.
- **Blog PWA (installable + offline)**: The Jekyll blog is an installable PWA — `site.webmanifest` is `display: standalone`, and a hand-written, dependency-free `sw.js` (repo root) precaches a small shell + `offline.html` (cache-first static, network-first navigations). It is registered from `_includes/head.html` on `load`. The worker **deliberately ignores the sub-app SPAs** (`/polyvote/`, `/blog-admin/`, `/inventory/`) — PolyVote ships its own `vite-plugin-pwa` worker — so it never caches or controls them. Bump `CACHE_VERSION` in `sw.js` when the precached shell changes.
- **Search (blog)**: The `Ctrl/Cmd+K` modal (`_includes/search-modal.html`, `assets/js/search.js`) runs **client-side Lunr** over two merged indexes, rendering results **grouped by source** (order: `blog`, `pages`, `references`, `apps`, `gh-pages`, `repos`, `gists`). Local content is generated fresh by Jekyll into `/search.json` (posts + `site.html_pages` + reference pages, each tagged with a `group`); off-site content is a committed crawl snapshot in `/search-external.json` (produced by `search-crawler/`). The merge stays behind the existing **functional-cookie consent gate** and loads nothing third-party at query time beyond the already-gated Lunr CDN script — keep it that way. `url` is the Lunr `ref` and must stay unique across both files (local entries are root-relative, external are absolute). To widen scope, add a `{ url, group }` seed in `search-crawler/sources.config.js` (and a matching label in the `GROUPS` array in `search.js`) — don't add a query-time third-party search service.
- **Firebase keys**: Public client-side keys in `_config.yml`, `polyvote/src/firebase.ts`, `blog-admin/src/firebase.ts`, and `inventory-manager/src/firebase.ts`. Security is enforced via Firestore rules, Storage rules, and Cloud Functions.
- **Server-validated writes**: All client writes go through Cloud Functions (`httpsCallable`), never direct Firestore SDK writes. This applies to PolyVote user actions (votes, comments, requests), Blog Admin operations (drafts, publishing), **and** Inventory Manager operations (folders, items, photos, import/export, eBay CSV). Keep `blog-admin/src/firebase.ts` and `inventory-manager/src/firebase.ts` free of `addDoc`/`setDoc`/`updateDoc`/`deleteDoc`.
- **Inventory Manager hiding**: The tool lives at `/inventory/` and must stay invisible to crawlers. Three layers guard this: `robots.txt` carries `Disallow: /inventory/`; the SPA's `index.html` ships `<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">`; nothing in `_data/pages.yml` or `_data/projects.yml` links to it. Do **not** add it to nav, footer, or any public-facing page.
- **Inventory Storage**: Photos go to Firebase Storage bucket `proven-concept-436717-q3.firebasestorage.app` (the new-style bucket — not the legacy `.appspot.com`) at `inventory/{itemId}/{uuid}.{ext}` and are made public-read so eBay's `PicURL` field can fetch them. The bucket name is pinned in `polyvote/functions/src/inventory/photos.ts` (`INVENTORY_BUCKET` constant) and in `inventory-manager/src/firebase.ts` (`storageBucket`). Storage rules in `polyvote/storage.rules` block all client writes; uploads only happen via the `inventoryUploadPhoto` Cloud Function (admin SDK bypasses rules). Firebase Storage must be enabled in the Firebase Console for this to work — one-time manual setup.
- **Tabletop online (server arbiter)**: The `/games/` app's Firebase multiplayer is **server-authoritative**. Clients call the `gamesSubmitAction` / `gamesCreateMatch` Cloud Functions; the server sets the actor from the **authenticated anonymous-auth uid** (clients can't spoof `playerId`), validates + applies the move with the mirrored engine, and writes per-player **redacted** state to `games-states/{room}/{uid}`. RTDB rules (`polyvote/database.rules.json`) deny **all** client writes to `games-states` (only the admin SDK writes) and allow a client to read only its own slot (`$slot === auth.uid`); the authoritative `_full` slot is server-only. Lobby (`games-rooms`) is client-managed under `auth != null`. **One-time manual setup:** enable **Anonymous Authentication** in the Firebase Console (Authentication → Sign-in method) — without it online play can't sign in. The local cross-tab backend (default) needs no setup and uses the lighter client host-relay. Keep the mirrored engine/defs in `polyvote/functions/src/games/` in sync with `games/src/engine` + `games/src/games` (see Module boundaries).
- **Blog import flow**: Importing an existing `_posts/` file from Blog Admin offers two explicit modes — **Edit** (links the draft to the GitHub file via `blogDrafts.sourceFilename`, so re-imports reopen the same draft and publish updates in place) and **Copy** (unlinked draft seeded with a `-copy` slug for creating a new post). `blogPublishToGitHub` requires `confirmOverwrite: true` when a draft would silently overwrite an unlinked GitHub file.
- **Privacy-first**: No Google Analytics. Cookie consent is GDPR-compliant with functional category.
- **Theme**: Dark mode is default across all four modules. The blog and reference pages (Spectrum, Electronics Fundamentals) share one dark/light toggle driven by CSS custom properties on `<html data-theme>`. PolyVote uses Tailwind + CSS variables persisted via Zustand/localStorage. Blog Admin and Inventory Manager are dark-only by design — no theme toggle, no `.light` CSS variant.
- **Header sticky-toggle (global, blog)**: A pin/unpin button in the header's `.nav-actions` (`#header-sticky-toggle`, mirrors the theme toggle's localStorage + pre-paint bootstrap + two-icon swap) lets the visitor unpin the normally-`fixed` site header so it scrolls away with the page. State lives in `localStorage.headerSticky` (`on` default / `off`), bootstrapped synchronously in `_includes/head.html` (sets `<html data-header-sticky="off">` before paint) and toggled in `assets/js/main.js`. CSS in `style.css`: `html[data-header-sticky="off"]` sets `--header-offset: 0rem` (the default is `--header-offset: var(--header-height)`) and switches `.site-header` to `position: absolute` (so it scrolls away — `main#main-content`'s `padding-top` still reserves its height). Throughout the whole `off` state the `.header-sticky-toggle` is `position: fixed`, positioned (`top: calc((var(--header-height) - 2rem) / 2)`; `right: calc((100vw - min(100vw, var(--max-width))) / 2 + var(--space-lg))`, plus `+ 2rem + var(--space-sm)` at `≤48rem` where the hamburger sits to its right) to overlay its in-header slot **exactly** — so the absolute header scrolls away beneath it and the pin never moves (no teleport). Because it left the flex flow, `html[data-header-sticky="off"] .theme-toggle` gets `margin-right: calc(2rem + var(--space-sm))` to reserve the vacated slot so search/theme/hamburger don't shift. The pin renders as a bare button while the header is on screen; only once the header has actually left the viewport (`html[data-header-sticky="off"].is-scrolled`, a class `main.js` toggles on every page from `scrollY`) does a slightly-faded chip (surface bg + 1px border + soft shadow, `opacity: 0.85`, full on hover/focus) **fade in** — only background/border/box-shadow/opacity transition, never `position`, which is what keeps both scroll-away and pin↔unpin toggling smooth. (Earlier the toggle was in-flow until `.is-scrolled` then snapped to a `0.6rem/0.6rem` corner floater — a `position`-type change that teleported instead of transitioning; the fixed-from-the-start overlay replaces it.) `--header-offset` (not the raw `--header-height`) drives the global `scroll-padding-top`, the post-body `h2` **`position: sticky` `top`** *and* its `scroll-margin-top`, plus the reference pages' `.cmd-widget` / `.electronics-section` `scroll-margin-top` and the reference-table controls + wrapper (see **Reference-table scaffolding**), so unpinning re-anchors sticky headings flush to the very top (no empty header-height gap above them — the gap bug) and reclaims that vertical space for the big tables. The sticky-h2 IntersectionObserver in `main.js` also keys its threshold off `--header-offset`; since that offset changes on toggle and `rootMargin` is baked in at observer creation, the toggle handler dispatches a `headersticky:change` event on `<html>` that the sticky-h2 module listens for to rebuild its observer (sentinels/content-spans stay one-time; only the observer is recreated).

- **Brand splash / onboarding loader (global, blog)**: A full-screen animated loader of the brand emblem (the glowing blue glassy-shield "R" from the icon universe) shows **once per browser session** on the first blog page load. Assets live in `assets/images/loader/` — `brand-loader.mp4` (play-once H.264 video, ~72 KB; a 600×600, **12 fps** clip of a 3D spin of the emblem, **decimated from a 960×960/10 s/24 fps master down to every 14th frame (18 frames) so it plays through in ~1.5 s** — short on purpose so the once-per-session splash never delays the first paint; the clip has **no baked fade** — the whole overlay fades instead, see dismissal below) and `brand-loader-poster.webp` (~14 KB static first-frame — the face-on emblem — used as the `<video poster>`, the `prefers-reduced-motion` fallback, and the instant placeholder; WebP not PNG since it compresses far smaller lossy). Shipped as a muted autoplay `<video playsinline>` — **no `loop`**, because the splash plays through exactly once before dismissing (not an `<img>` because H.264 compresses this rendered 3D motion far smaller than an animated GIF/WebP would). The emblem is rendered **full-bleed** — `.brand-splash__media` is `width: 100vw; height: 100dvh; object-fit: contain` at `opacity: 0.88` — so it fills the whole screen for an immersive load; because the clip/poster is a square on the same dark-blue tile (`~#0a121d`) as the backdrop, `contain` looks edge-to-edge with no seam and never crops the "R". The full-res spin master is **not** committed (it's a ~5 MB source) — keep it outside the repo and re-derive the optimized clip from it. Gated like the theme/header bootstraps: `_includes/head.html` synchronously sets `<html data-splash="show">` before paint **only when `sessionStorage.brandSplashShown` is unset** (so it never flashes on repeat visits or no-JS loads). Markup + dismissal live in `_includes/brand-splash.html` (included at the top of `<body>` in `_layouts/default.html`, so all layouts inherit it); the inline script writes the `sessionStorage` flag immediately, then fades the overlay only once **both** gates clear — the page has fired `window.load` **and** the clip has reached its last 25% (a `timeupdate` listener fires at `FADE_AT = 0.75` × duration; `ended`/`error`/reduced-motion satisfy it immediately and fall back to the `MIN_MS` 900 ms floor). The fade is the **whole `.brand-splash` element's** opacity transition (`0.375s` ≈ the clip's last quarter), so the emblem **and** the dark backdrop fade out **together** with the clip, revealing the page — when the page is already loaded the fade starts at 75% playtime and ends exactly as the clip does. A `MAX_MS` (9 s) backstop guarantees the overlay can never get stuck if a gate never fires. CSS in `style.css` (search `.brand-splash`): fixed `z-index: 100000` over everything, fixed dark-blue backdrop (`#0a121d`, matching the loader clip's corner so there's no seam on either theme), opacity fade; under `prefers-reduced-motion` it swaps to the static poster and drops the fade. Both loader assets are precached by `sw.js` (bump `CACHE_VERSION` when they change). To retune length/size, re-encode from the spin master with ffmpeg — keep every Nth frame and set the framerate so duration = frames/fps (current is every 14th @ 12 fps → 18 frames/1.5 s: `-an -vf "select='not(mod(n\,14))',setpts=N/12/TB,scale=600:600:flags=lanczos" -r 12 -c:v libx264 -crf 36 -pix_fmt yuv420p`; raise N / lower fps to drop more frames, raise `-crf` to compress harder). No `fade` filter — the overlay's CSS opacity fade handles the fade-out; if you change the clip duration, keep `transition: opacity` on `.brand-splash` ≈ 25% of it and `FADE_AT` at 0.75 so the two stay in sync. Then re-derive the poster from its first frame as WebP (`ffmpeg -i brand-loader.mp4 -frames:v 1 first.png` then `cwebp -q 80 first.png -o brand-loader-poster.webp`); a tiny H.264 clip beats any GIF/WebP — don't ship a raw GIF.

## Deployment & CI/CD

Seven GitHub Actions workflows live in `.github/workflows/`. The four auto-trigger workflows are each scoped with `paths` / `paths-ignore` filters so they only fire when their inputs change; the other three are manual-trigger-capable.

| Workflow | Trigger | Scope | Deploys |
|---|---|---|---|
| `ci.yml` | PR → `main` | Per-app jobs gated by `dorny/paths-filter` — only changed apps run lint/test/build. | Nothing (validation only). |
| `jekyll-gh-pages.yml` | Push → `main` | Skips docs, Firebase configs, Cloud Functions, and Firestore/RTDB/Storage rules. | Full site to GitHub Pages (Jekyll + PolyVote + Blog Admin + Inventory Manager + Tabletop/games). |
| `feature-preview.yml` | Push → `test` + manual `workflow_dispatch` (with optional `ref` input, defaults to `test`) | Same `paths-ignore` as `jekyll-gh-pages.yml`. | Combined GitHub Pages artifact: main rebuilt at root (Jekyll + PolyVote + Blog Admin + Inventory Manager + Tabletop/games, identical to `jekyll-gh-pages.yml`'s output) plus the `test` branch (or dispatch `ref`) rebuilt **Jekyll-only** under `/test/` via `bundle exec jekyll build --baseurl /test`. Preview URL: `https://ranzlappen.com/test/` (custom domain serves the artifact root, no `/<repo>/` prefix). Shares the `pages` concurrency group with `jekyll-gh-pages.yml` so the two queue, never overlap. |
| `firebase-deploy.yml` | Push → `main` (Firebase/Functions paths) + manual | Builds Cloud Functions, then deploys. | Firestore rules + indexes, RTDB rules, Storage rules, `castBlogVote`, all Blog Admin callables, admin user-management callables (`setUserRole`, `adminListUsers`, `adminBanUser`, `adminUnbanUser`), and all Inventory Manager callables (`inventory*`). |
| `firebase-deploy-manual.yml` | Manual only (`workflow_dispatch`) | Accepts a `target` input passed straight to `firebase deploy --only`. Default `functions` redeploys every function in `polyvote/functions/src/index.ts` — future-proof for newly added functions. Shares the `firebase-deploy` concurrency group with the auto-deploy. | Whatever the `target` input specifies (default: all Cloud Functions). |
| `search-crawl.yml` | Manual only (`workflow_dispatch`) | Runs the `search-crawler` module (Node 22, no install) with the auto-provided `GITHUB_TOKEN`, then opens a PR with the refreshed `search-external.json` via the pre-installed `gh` CLI (pushes a side branch + `gh pr create`; main is protected, so it never pushes there directly — and no third-party action to download). Merging the PR triggers `jekyll-gh-pages.yml` and redeploys with the new index. `contents: write` + `pull-requests: write`; `search-crawl` concurrency group. **One-time setup:** enable Settings → Actions → "Allow GitHub Actions to create and approve pull requests". The bot PR is GITHUB_TOKEN-authored, so CI does not auto-run on it (a data-only change — just merge it). | Opens a PR bumping `search-external.json` (no deploy itself). |

**Preview limitations**: `feature-preview.yml` ships **Jekyll-only** under `/test/`. PolyVote, Blog Admin, Inventory Manager, and Tabletop/games are not rebuilt at the preview subpath because their Vite `base` and React Router `basename` are hardcoded to `/polyvote/`, `/blog-admin/`, `/inventory/`, and `/games/`. Navbar links to those apps will 404 inside the preview tree. To enable SPA previews later, make `base` env-driven in `polyvote/vite.config.ts`, `blog-admin/vite.config.ts`, `inventory-manager/vite.config.ts`, `games/vite.config.ts`, the four `main.tsx` files, PolyVote's `ShareButton.tsx`, and PolyVote's PWA manifest (defaults preserve current paths exactly).

**What fires on a given change:**

| Change | CI (on PR to `main`) | Pages prod (push → `main`) | Pages preview (push → `test`) | Firebase (push → `main`) |
|---|:---:|:---:|:---:|:---:|
| Blog post / Jekyll page | — | ✓ | ✓ | — |
| `polyvote/src/**` | polyvote | ✓ | ✓ (rebuilt from main only) | — |
| `blog-admin/src/**` | blog-admin | ✓ | ✓ (rebuilt from main only) | — |
| `inventory-manager/src/**` | inventory-manager | ✓ | ✓ (rebuilt from main only) | — |
| `games/**` (engine/UI/tests) | games (lint + test + build) | ✓ | ✓ (rebuilt from main only) | — |
| `polyvote/functions/**` | functions | — | — | ✓ |
| `firestore.rules` / `firestore.indexes.json` | — | — | — | ✓ |
| `database.rules.json` / `storage.rules` | — | — | — | ✓ |
| `search-crawler/**` (crawler code) | search-crawler | — | — | — |
| `search-external.json` (crawl output) | — | ✓ | ✓ | — |
| `CLAUDE.md` / `README.md` / `LICENSE` | — | — | — | — |

**Concurrency**: CI cancels superseded runs per PR branch. Pages deploys (both `jekyll-gh-pages.yml` and `feature-preview.yml`) and Firebase deploys **queue** (no cancel) to avoid half-applied state.

**Node version**: All JS jobs (CI + Pages build) run on Node 22.

**Action pinning**: Third-party Actions (anything outside the GitHub-maintained `actions/*` org — currently `dorny/paths-filter` in `ci.yml` and `dependabot/fetch-metadata` in `dependabot-auto-merge.yml`) are pinned to a full commit SHA with a trailing `# vX.Y.Z` comment, not a mutable tag. Dependabot's `github-actions` ecosystem bumps the SHA *and* the comment, so pins stay current. (SHA-pinning is a supply-chain safeguard against a moved/compromised tag; it does **not** prevent transient `codeload.github.com` download outages — those are cleared by re-running the job. `actions/*` and the `ruby/setup-ruby@v1` moving branch stay on tags.)

**Required secrets**:
- `FIREBASE_SERVICE_ACCOUNT` (JSON service-account key) for `firebase-deploy.yml`.
- `GOOGLE_DRIVE_API_KEY` (Firebase Functions secret, set via `firebase functions:secrets:set`) for the inventory `inventoryListDriveFolder` callable. Restrict the key to the Drive API in the GCP console. **This secret MUST exist in the project for ANY functions deploy to succeed** — `firebase deploy` analyzes the *entire* functions codebase and validates every `defineSecret`-declared secret up front, even functions excluded from the `--only TARGETS`; in non-interactive (CI) mode an unset secret aborts the whole deploy (rules included) before anything is applied (this broke `firebase-deploy.yml` once — the fix is to set the secret, a placeholder value is enough to pass analysis). `inventoryListDriveFolder` is still excluded from `firebase-deploy.yml`'s auto-deploy `TARGETS` (so the auto-deploy never tries to bind/redeploy it); deploy it manually (`firebase deploy --only functions:inventoryListDriveFolder`) or via `firebase-deploy-manual.yml` once a real key is stored. The Drive folder picker is unavailable until a real key is set, but the rest of inventory deploys fine **as long as the secret exists**.

**Dependabot** (`.github/dependabot.yml`): weekly updates for all five npm packages (polyvote, polyvote/functions, blog-admin, inventory-manager, games), bundler, and GitHub Actions. Minor+patch are grouped. Each PR runs CI — `ci.yml` triggers on every PR to `main` (no `paths:` filter) so the `ci-required` aggregator always appears as a status check.

**Auto-merge** (`.github/workflows/dependabot-auto-merge.yml`): every Dependabot PR is queued for GitHub native auto-merge (`gh pr merge --auto --merge`) and lands once required status checks pass. **Requires branch protection on `main` to mark `ci-required` as a required status check** — without that, `--auto` merges immediately without waiting and a failing CI won't block the merge (this happened with PR #236, a `firebase-admin` v12→v13 major bump whose `functions` job failed but landed anyway because no required check was configured). `ci-required` is a single aggregator job in `ci.yml` that succeeds only when every conditional app job (`polyvote`, `functions`, `blog-admin`, `inventory-manager`, `games`) either passed or was skipped via path filter; mark it required and the conditional-job deadlock problem disappears.

**Manual fallbacks**:
- Trigger `firebase-deploy-manual.yml` via `workflow_dispatch` (preferred) — deploys via GitHub Actions using the shared service-account secret. Default target is `functions` (all Cloud Functions); override with any `--only` target, e.g. `functions:blogSaveDraft,functions:blogPublishToGitHub` or `functions,database,firestore`.
- Or, from `polyvote/` authenticated via `firebase login`:
  - `firebase deploy --only firestore` — rules + indexes
  - `firebase deploy --only functions:<name>` — a specific function
- Re-run Pages: trigger `jekyll-gh-pages.yml` via `workflow_dispatch`

## Tech Stack

| Layer | Blog | PolyVote | Blog Admin | Inventory Manager | Tabletop (games) |
|-------|------|----------|------------|-------------------|------------------|
| Framework | Jekyll (Ruby) | React 19 + TypeScript | React 19 + TypeScript | React 19 + TypeScript | React 19 + TypeScript (framework-agnostic engine core) |
| Styling | Custom CSS — main `style.css` (~3,200 lines), per-page stylesheets (`spectrum.css`, `electronics-fundamentals.css`, `cmd-cheat-sheet.css`), the shared `abbreviations.css`, and the shared `reference-table.css` (sticky-tab + live-search big-table scaffolding used by Spectrum and the CLI cheat sheet) | Tailwind CSS v3 + Framer Motion | Tailwind CSS v4 (via `@tailwindcss/vite`) | Tailwind CSS v4 (via `@tailwindcss/vite`) | Tailwind CSS v4 + CSS-variable theme system (3 skins) |
| Router | — | react-router-dom v6 | react-router-dom v7 | react-router-dom v7 | react-router-dom v7 |
| State | Vanilla JS | Zustand | Zustand | Zustand | Engine reducers + MatchClient; Zustand for UI |
| Backend | GitHub Pages (static) | Firebase (Firestore, Auth, Functions) | Firebase (Firestore, Auth) | Firebase (Firestore, Auth, Storage) | Local (localStorage + BroadcastChannel); optional Firebase RTDB |
| Comments | Giscus (GitHub Discussions) | Firebase subcollections | — | — | — |
| Editor | — | — | CodeMirror 6 | — | — |
| Testing | — | Vitest | — | — | Vitest (64 tests) |
| Deployment | `jekyll-gh-pages.yml` → GitHub Pages | Built by `jekyll-gh-pages.yml` into `_site/polyvote/` | Built by `jekyll-gh-pages.yml` into `_site/blog-admin/` | Built by `jekyll-gh-pages.yml` into `_site/inventory/` | Built by `jekyll-gh-pages.yml` into `_site/games/` |

## Project Structure

```
├── _config.yml                 # Jekyll configuration
├── _data/
│   ├── pages.yml               # Navigation registry (nav + footer)
│   ├── projects.yml            # External app + reference-page favicons (footer strip)
│   ├── abbreviations/          # Per-page glossary datasets (shared utility)
│   │   ├── cmd-cheat-sheet.yml
│   │   ├── electronics.yml
│   │   ├── spectrum.yml
│   │   └── web-dev-tech-stack.yml
│   ├── cmd-cheat-sheet/        # CLI cheat sheet command data + maintenance README
│   ├── spectrum/               # EM spectrum band data + maintenance README
│   ├── web-dev-tech-stack/     # Web dev tech stack data (15 category files) + README + lint.sh
│   └── references/electronics/ # Architecture / maintenance README for the EF page
├── _includes/                  # Jekyll partials (head, header, footer…)
│   └── abbreviations-section.html  # Shared glossary partial — see Key Conventions
├── _layouts/                   # Page templates (default, home, post, page)
├── _posts/                     # Blog content (Markdown)
├── assets/
│   ├── css/
│   │   ├── style.css                    # Main blog stylesheet
│   │   ├── abbreviations.css            # Shared glossary styling
│   │   ├── reference-table.css          # Shared big-table scaffolding (Spectrum + cmd cheat sheet + web dev tech stack)
│   │   ├── references-index.css         # /references/ landing-page cards
│   │   ├── spectrum.css                 # Spectrum reference page (overrides)
│   │   ├── electronics-fundamentals.css # Electronics reference page
│   │   ├── cmd-cheat-sheet.css          # CLI cheat sheet reference page (overrides)
│   │   ├── cmd-widgets.css              # CLI cheat sheet Interactive Tools widgets
│   │   ├── web-dev-tech-stack.css       # Web dev tech stack reference page (overrides)
│   │   └── cookie-consent.css
│   ├── js/
│   │   ├── abbreviations.js             # Shared glossary modal + decoration
│   │   ├── reference-table.js           # Shared tab/search/empty/blurb wiring for big tables
│   │   ├── spectrum.js                  # Spectrum: thin wrapper over reference-table.js
│   │   ├── cmd-cheat-sheet.js           # CLI cheat sheet: reference-table wrapper + worked-example modal wiring
│   │   ├── cmd-widget-*.js              # CLI cheat sheet Interactive Tools (chmod/find/regex/curl + core + bundle)
│   │   ├── web-dev-tech-stack.js        # Web dev tech stack: reference-table wrapper + example modal wiring
│   │   ├── resize-handle.js             # Shared custom textarea resize grabber (reference pages)
│   │   └── electronics-*.js             # 9-file EF widget bundle
│   └── images/favicons/                 # Local copies of external app + reference page favicons
├── pages/                      # Static pages (about, contact, privacy, references/*…)
├── feed.xml                    # Atom feed (custom, status-filtered)
├── sitemap.xml                 # Sitemap (custom, status-filtered)
├── search.json                 # Local search index (posts + pages + references), Liquid-generated, group-tagged
├── search-external.json        # External search index (subdomains/gh-pages/repos/gists), crawler-generated snapshot
├── .github/
│   ├── dependabot.yml          # Weekly dependency updates
│   └── workflows/
│       ├── ci.yml                      # PR validation (per-app jobs)
│       ├── dependabot-auto-merge.yml   # Queue Dependabot PRs for GitHub native auto-merge
│       ├── feature-preview.yml         # Build + deploy main + `test` preview to Pages
│       ├── firebase-deploy.yml         # Deploy Firestore/RTDB rules + castBlogVote + Blog Admin callables
│       ├── firebase-deploy-manual.yml  # Manual Cloud Functions deploys (workflow_dispatch)
│       ├── jekyll-gh-pages.yml         # Build + deploy prod site to Pages
│       └── search-crawl.yml            # Manual re-crawl of search-external.json (workflow_dispatch)
├── search-crawler/             # Dependency-free Node crawler → search-external.json (see README)
│   ├── crawl.mjs               # Orchestrator entry point
│   ├── sources.config.js       # Declarative seeds (web hosts + groups, github user, caps)
│   └── src/                    # util / extract / web / github fetchers
├── blog-admin/
│   ├── src/
│   │   ├── components/         # Editor UI, auth, dialogs
│   │   ├── pages/              # Dashboard, Editor, Login
│   │   ├── firebase.ts         # Firebase client config
│   │   ├── store.ts            # Zustand store
│   │   └── types.ts            # TypeScript interfaces
│   └── eslint.config.js        # ESLint flat config
├── inventory-manager/
│   ├── src/
│   │   ├── components/         # AdminGuard, Toast, Header, FieldInput, PhotoGrid, ImportDialog, ConfirmDialog
│   │   ├── pages/              # Dashboard, FolderTable, SchemaEditor, ItemEditor, EbayExport, Login
│   │   ├── firebase.ts         # Firebase client config + httpsCallable wrappers
│   │   ├── store.ts            # Zustand store (auth, folders, items, selection, toasts)
│   │   ├── types.ts            # TypeScript interfaces (mirrors functions/src/inventory/shared.ts)
│   │   ├── ebay.ts             # eBay condition IDs, durations, formats
│   │   └── index.css           # Tailwind import + theme variables
│   ├── eslint.config.js        # ESLint flat config
│   └── vite.config.ts          # base: '/inventory/'
├── games/                      # Tabletop — reusable card/board game engine SPA (base: '/games/')
│   ├── src/
│   │   ├── engine/             # Framework-agnostic core: types, rng, match (applyAction), client (undo/redo), serialize, registry, cards, board, dice, rules
│   │   ├── games/              # GameDefinitions (crown-rush, lantern-hunt, relic-run) + views/ (React view per game)
│   │   ├── net/                # SyncAdapter: local (cross-tab) + Firebase RTDB (optional) + selector
│   │   ├── storage/            # localStorage save/load
│   │   ├── ui/                 # theme, assets (SVG cards/dice/pawns), components, hooks, GameSurface, store
│   │   ├── pages/              # Home (gallery), Setup, Play, Online, Room, NotFound
│   │   └── __tests__/          # Vitest suite (engine + demos + render smoke)
│   ├── docs/wiki/              # Handbook (architecture, engine concepts, creating games, Firebase, a11y, API…)
│   ├── eslint.config.js        # ESLint flat config
│   ├── vitest.config.ts        # jsdom test env
│   └── vite.config.ts          # base: '/games/'
└── polyvote/
    ├── src/
    │   ├── components/         # React components
    │   ├── pages/              # Route-level pages + admin/
    │   ├── hooks/              # Zustand store, Firestore hooks
    │   ├── types/              # TypeScript interfaces
    │   └── __tests__/          # Vitest tests
    ├── functions/src/          # Firebase Cloud Functions (TypeScript)
    │   ├── inventory/          # Inventory Manager callables (folders, items, photos, import/export, eBay CSV)
    │   └── games/              # Tabletop online arbiter (gamesCreateMatch/gamesSubmitAction) + mirrored engine/defs
    ├── firestore.rules         # Firestore security rules
    ├── firestore.indexes.json  # Firestore composite indexes
    ├── database.rules.json     # Realtime Database rules (vote aggregates)
    ├── storage.rules           # Firebase Storage rules (inventory photos, public-read)
    ├── firebase.json           # Firebase project config
    ├── .firebaserc             # Firebase project ID
    └── eslint.config.js        # ESLint flat config
```

## Post-task self-check

After every turn that produces a branch, PR, feature, or bug fix, do a quick self-check before replying: does the change introduce anything worth codifying in docs or automation? Scan for new env vars, npm scripts, path filters, deploy targets, secrets, setup steps, dependencies, or conventions that should be reflected in `README.md`, `CLAUDE.md`, `.github/workflows/*.yml`, or `.github/dependabot.yml`.

Decide per case:

- **Auto-implement** small, unambiguous updates — e.g. noting a newly introduced env var in README, extending a workflow `paths` filter to a new directory, adding a new npm script to the relevant command list, bumping a Node version already changed in one workflow to match the others. Make the edit in the same turn and call it out in the summary.
- **Prompt first** for anything ambiguous, opinionated, or structurally significant — rewriting a README section, adding a new top-level doc, restructuring a workflow, or changes whose wording/location isn't obvious.

If nothing is warranted, say "no doc/workflow updates needed" in one line. Skip this self-check entirely for pure Q&A turns that don't change code.
