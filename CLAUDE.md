# ranzlappen.com

Personal blog + PolyVote community voting platform + Blog Admin dashboard + Inventory Manager, hosted on GitHub Pages.

## Architecture

**Hybrid project** with four independent builds plus a build-time tooling module:

- **Jekyll blog** (root) — Static site built by GitHub Pages. Posts in `_posts/`, layouts in `_layouts/`, includes in `_includes/`, pages in `pages/`. Config: `_config.yml`.
- **PolyVote** (`polyvote/`) — React 19 SPA built with Vite. Backend: Firebase (Firestore, Auth, Cloud Functions). Deployed as a subfolder within the Jekyll `_site/`.
- **Blog Admin** (`blog-admin/`) — React 19 SPA built with Vite for managing blog drafts and publishing. Uses Firebase (Firestore, Auth), CodeMirror 6 for Markdown editing, and Zustand for state. Deployed as a subfolder within the Jekyll `_site/`.
- **Inventory Manager** (`inventory-manager/`) — React 19 SPA built with Vite for managing inventory with folders, custom per-folder field schemas, photos in Firebase Storage, CSV/JSON import-export, and **multi-platform export** (per-folder "platform tags" drive required columns + a per-platform CSV/TSV/XML export for eBay, Amazon, Kleinanzeigen, Whatnot, Facebook, idealo, billiger.de, Geizhals). Admin-only via Firebase Auth custom claim (same login as Blog Admin). Hidden from crawlers (robots.txt `Disallow: /inventory/` + `noindex` meta tags + not listed in nav). Deployed as a subfolder within the Jekyll `_site/` at `/inventory/`. **See [`inventory-manager/README.md`](./inventory-manager/README.md) for the architecture handbook** (data model, persistence, the platform registry + export formats, how to add field types or functions).
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

Production deploys of `castBlogVote`, the Blog Admin callables (`blogSaveDraft`, `blogListDrafts`, `blogGetDraft`, `blogDeleteDraft`, `blogListExistingPosts`, `blogFetchExistingPost`, `blogImportPostForEdit`, `blogPublishToGitHub`, `blogUploadImage`, `blogListSeriesUsage`), the admin user-management callables shared with the Blog Admin Users panel (`setUserRole`, `adminListUsers`, `adminBanUser`, `adminUnbanUser`), and the Inventory Manager callables (`inventoryListFolders`, `inventoryCreateFolder`, `inventoryUpdateFolder`, `inventoryDeleteFolder`, `inventoryDuplicateFolder`, `inventoryListItems`, `inventoryGetItem`, `inventoryCreateItem`, `inventoryUpdateItem`, `inventoryDeleteItem`, `inventoryToggleEbaySync`, `inventoryUploadPhoto`, `inventoryDeletePhoto`, `inventoryReorderPhotos`, `inventoryImport`, `inventoryExport`, `inventoryExportPlatforms`) are automated (see CI/CD below). Manual deploys of anything else use `firebase deploy --only functions:<name>` from `polyvote/`.

## Key Conventions

- **Module boundaries**: `polyvote/`, `blog-admin/`, `inventory-manager/`, and the Jekyll root (blog) are four independent modules, with `polyvote/functions/` as a fifth nested module and `search-crawler/` as a sixth (dependency-free build tooling, not deployed). Each has its own `package.json`/`Gemfile`, TypeScript/ESLint/Tailwind config, and deploy path. Run install/lint/test/build/format from within the module's own directory (see **Build & Development**). Do **not** cross-import source between modules — there is no monorepo tooling and no shared package. If logic truly needs to be shared, duplicate it intentionally (e.g. `polyvote/functions/src/inventory/shared.ts` is mirrored in `inventory-manager/src/types.ts`, and the platform registry `polyvote/functions/src/inventory/platforms.ts` is mirrored data-only in `inventory-manager/src/platforms.ts` — backend keeps the value-transform functions the frontend doesn't need). Scope PRs to a single module when possible so CI's per-app path filters stay meaningful.
- **Post status**: Posts use a `status` field in front matter (`published`, `draft`, `placeholder`, `unpublished`). Only `published` and `placeholder` appear in the sitemap and feed.
- **Post categories**: Posts set a singular `category:` field in front matter. The string `"Projects"` (capitalized, exact match) is canonical and routes the post to `/projects/`; everything else lands on `/blog/`. Homepage and `/categories/` show all categories. Liquid's `==` is case-sensitive — keep the exact casing.
- **Navigation**: Centralized in `_data/pages.yml` — single source of truth for nav and footer links. Reference pages are reached via the top-nav **References** entry, which routes to `/references/` — a hand-rolled index page (`pages/references/index.html`) that lists Spectrum, Electronics Fundamentals, and the CLI Cheat Sheet as cards. Don't add individual reference URLs to `_data/pages.yml`; add a new card to the index page instead.
- **Abbreviations / glossary**: Reference pages share one utility for term cards + click-to-explain modal + opt-in in-content decoration. Per-page YAML datasets live under `_data/abbreviations/<page>.yml`; markup is `_includes/abbreviations-section.html`; styles `/assets/css/abbreviations.css`; behaviour `/assets/js/abbreviations.js`. To add it to a page: include the partial with `data=site.data.abbreviations.<page>`, pull in the CSS+JS, and add `data-abbr-decorate` to any element whose text should auto-link matched terms. Per-page datasets are isolated, so the same key can have different definitions on different pages with no collision. Entry schema: `term` + `full_form` + `explanation` (required) plus optional `plain` (beginner-first prose), `example` (shell/code snippet rendered as `<pre><code>` in the modal — string or array; literal text, not HTML), `interpretation` (structured table with `title`/`columns`/`rows`/`footnote`), and `aliases` (array of case/plural variants emitted into the JSON island as `{"aliasOf": term}` so they decorate and open the canonical card without rendering their own card — this is how lowercase `posix` / plural `globs` become clickable). All optional fields are additive — existing entries without them render identically. `abbreviations.js` exposes `window.Glossary = { openTerm, openInline, decorate }` for pages that drive the modal directly (the CLI cheat sheet wires worked-example clicks to `openInline`, which uses the modal's visible `lead` field). Decoration normally skips `<code>`, but a `<code class="abbr-decorate-code">` opts back in so command tokens inside worked examples become clickable glossary triggers.
- **Reference-table scaffolding**: The sticky tab strip + live-search + scrollable big-table pattern used by `/references/spectrum/` and `/references/cmd-cheat-sheet/` is shared. Styles live in `/assets/css/reference-table.css` (controls, tabs, search, sticky thead, `.is-sticky-col` hook for the pinned column, generic legend swatches, `.reference-badge` base, the `.cell-collapse` family). Behaviour lives in `/assets/js/reference-table.js` and exposes one function — `window.initReferenceTable({tableId, tabSelector, searchId, countId, emptyId, blurbId, batchDataId, sortable, osFilterId, osAttr})` — that each page's thin wrapper calls with its own IDs. The last three are opt-in: `sortable: true` injects a click-to-sort control into every `<th>` (cycles ascending → descending → original; a cell's sort key is its `data-sort` attribute, else its text, numeric when both compared values parse as numbers; one column at a time), and `osFilterId`/`osAttr` wire a secondary `<select>` filter (the `.reference-osfilter` control) that ANDs a token match against a per-row attribute (default `data-os`) on top of the tab + search filters. The CLI cheat sheet passes all three; Spectrum passes none (unchanged). Per-page CSS files (`spectrum.css`, `cmd-cheat-sheet.css`) layer column widths and palette modifiers on top, scoped under `.reference-page--<slug>` so overrides cannot leak between pages. To add a third reference page: opt in via `<section class="reference-page reference-page--<slug>">`, load the shared CSS/JS before the per-page ones, and write a thin wrapper that calls `initReferenceTable`. The shared CSS also carries a tablet breakpoint (`641–1024px` drops the search box onto its own full-width row). The table wrapper is a bounded sticky scroll box (sticky thead + sticky `.is-sticky-col`) on **all** viewports including phones; on mobile the `max-height` is capped lower (`calc(100vh - header - 9rem)`) so the page footer sits cleanly below the box and stays reachable by scrolling past it (no static/un-pin override — an earlier touch-un-pin hack was removed because it killed the sticky header and let the footer bleed into the table). The bounded box is deliberate: a horizontal-scroll container is required for the wide table, and that same container is what lets the sticky thead + sticky first column pin (a pure page-flow table can't scroll wide content horizontally without breaking the viewport-pinned header). The controls strip's sticky `top` and the wrapper's `top`/`max-height` key off the global `--header-offset` custom property (defaults to `--header-height`), so unpinning the site header (which sets `--header-offset: 0` — see the header sticky-toggle under **Theme**) collapses the gap and grows the box to reclaim that height. `/assets/js/resize-handle.js` is a shared, self-attaching util that replaces the tiny native textarea resize corner with a large pointer+keyboard drag grabber on any `textarea[data-resize]` or `.cmd-widget__textarea`; load it after whatever builds the textareas. The CLI cheat sheet's table adds five columns beyond Spectrum's pattern — **OS / Appliance** (sortable; its `<select>` drives the secondary OS filter), **Danger** (sortable via a numeric `data-sort` rank: safe `0` < caution `1` < destructive `2`), **Recipes/Combos** (`recipes` = array of `{code, explain}`), **Modern alt** (`modern` string), and **Docs** (renders the existing `references` field) — and renders `examples` (now `{code, explain}` objects) as clickable buttons that open an explanation modal via `window.Glossary.openInline`. The per-row OS badge pills **and** the `danger` chip (`safe`/`caution`/`destructive`) *also* render stacked beneath the command name inside the sticky first column: this is intentional redundancy — the stacked copy stays visible during horizontal scroll, while the dedicated **OS / Appliance** and **Danger** columns are the sortable + filterable/searchable ones (each `<tr>` carries `data-os` + `data-danger` for the filter/sort, and the OS column renders text labels so search matches "linux", "macos", … too). **Raw-HTML cells**: `description`, flag `description`, `modern`, and `gotchas` are emitted as raw HTML so inline `<code>` works — literal placeholder angle brackets (`<script>`, `<path>`, …) must be escaped (`&lt;…&gt;`) in the data or they break the table DOM (a literal `<script>` swallows the rest of the table so the footer renders inside it). `_data/cmd-cheat-sheet/lint.sh` fails the build if any rawtext/script tag lands inside the command table.
- **cmd-widgets (Interactive Tools section on the CLI cheat sheet)**: Four browser-only widgets — chmod calculator, find builder, regex tester, curl composer — live on `/references/cmd-cheat-sheet/`. JS lives in `/assets/js/cmd-widget-core.js` (registry + `CMDW.mountAll()` + `CMDW.copyToClipboard()` + `CMDW.shellEscape()` + `CMDW.makeOutput()`/`CMDW.el()` helpers) and four `cmd-widget-<name>.js` files that each call `CMDW.register('<name>', factory)`. The entry point `cmd-widget-bundle.js` calls `mountAll()` on DOMContentLoaded; the loader scans for `<section data-cmd-widget="<name>">` and invokes the matching factory. Each factory builds its UI into a collapsible `<details>` shell via `CMDW.makeShell(root, title)` (returns the body element to append into; the title becomes the `<summary>` heading). Styles in `/assets/css/cmd-widgets.css`. Adding a fifth widget: create `cmd-widget-<name>.js` (call `CMDW.makeShell` first, append controls to the returned body), drop a `<section data-cmd-widget="<name>">` on the page, add the script tag, optionally hook a `see_also: ["widget-<name>"]` entry from a cmd row (the see-also renderer in `cmd-cheat-sheet.html` routes `widget-*` slugs to `#widget-<name>` instead of `#cmd-<slug>`). Per CLAUDE.md's "duplicate intentionally" rule, the widget core deliberately mirrors EF's pattern rather than importing it — they're independent.
- **External apps**: The user's external apps (standalone subdomains like `ticked.ranzlappen.com`) are **not** in the navbar. They're listed in `_data/projects.yml` and rendered as a favicon strip in the footer via `_includes/footer.html`. Favicons are committed locally under `assets/images/favicons/` — **do not hotlink** upstream favicons (privacy-first: hotlinking leaks visitor IP/UA to the subdomain on every page load, before consent). To refresh a favicon, `curl` the upstream `<link rel="icon">` target into `assets/images/favicons/<name>.png` and commit.
- **Search (blog)**: The `Ctrl/Cmd+K` modal (`_includes/search-modal.html`, `assets/js/search.js`) runs **client-side Lunr** over two merged indexes, rendering results **grouped by source** (order: `blog`, `pages`, `references`, `apps`, `gh-pages`, `repos`, `gists`). Local content is generated fresh by Jekyll into `/search.json` (posts + `site.html_pages` + reference pages, each tagged with a `group`); off-site content is a committed crawl snapshot in `/search-external.json` (produced by `search-crawler/`). The merge stays behind the existing **functional-cookie consent gate** and loads nothing third-party at query time beyond the already-gated Lunr CDN script — keep it that way. `url` is the Lunr `ref` and must stay unique across both files (local entries are root-relative, external are absolute). To widen scope, add a `{ url, group }` seed in `search-crawler/sources.config.js` (and a matching label in the `GROUPS` array in `search.js`) — don't add a query-time third-party search service.
- **Firebase keys**: Public client-side keys in `_config.yml`, `polyvote/src/firebase.ts`, `blog-admin/src/firebase.ts`, and `inventory-manager/src/firebase.ts`. Security is enforced via Firestore rules, Storage rules, and Cloud Functions.
- **Server-validated writes**: All client writes go through Cloud Functions (`httpsCallable`), never direct Firestore SDK writes. This applies to PolyVote user actions (votes, comments, requests), Blog Admin operations (drafts, publishing), **and** Inventory Manager operations (folders, items, photos, import/export, eBay CSV). Keep `blog-admin/src/firebase.ts` and `inventory-manager/src/firebase.ts` free of `addDoc`/`setDoc`/`updateDoc`/`deleteDoc`.
- **Inventory Manager hiding**: The tool lives at `/inventory/` and must stay invisible to crawlers. Three layers guard this: `robots.txt` carries `Disallow: /inventory/`; the SPA's `index.html` ships `<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">`; nothing in `_data/pages.yml` or `_data/projects.yml` links to it. Do **not** add it to nav, footer, or any public-facing page.
- **Inventory Storage**: Photos go to Firebase Storage bucket `proven-concept-436717-q3.firebasestorage.app` (the new-style bucket — not the legacy `.appspot.com`) at `inventory/{itemId}/{uuid}.{ext}` and are made public-read so eBay's `PicURL` field can fetch them. The bucket name is pinned in `polyvote/functions/src/inventory/photos.ts` (`INVENTORY_BUCKET` constant) and in `inventory-manager/src/firebase.ts` (`storageBucket`). Storage rules in `polyvote/storage.rules` block all client writes; uploads only happen via the `inventoryUploadPhoto` Cloud Function (admin SDK bypasses rules). Firebase Storage must be enabled in the Firebase Console for this to work — one-time manual setup.
- **Blog import flow**: Importing an existing `_posts/` file from Blog Admin offers two explicit modes — **Edit** (links the draft to the GitHub file via `blogDrafts.sourceFilename`, so re-imports reopen the same draft and publish updates in place) and **Copy** (unlinked draft seeded with a `-copy` slug for creating a new post). `blogPublishToGitHub` requires `confirmOverwrite: true` when a draft would silently overwrite an unlinked GitHub file.
- **Privacy-first**: No Google Analytics. Cookie consent is GDPR-compliant with functional category.
- **Theme**: Dark mode is default across all four modules. The blog and reference pages (Spectrum, Electronics Fundamentals) share one dark/light toggle driven by CSS custom properties on `<html data-theme>`. PolyVote uses Tailwind + CSS variables persisted via Zustand/localStorage. Blog Admin and Inventory Manager are dark-only by design — no theme toggle, no `.light` CSS variant.
- **Header sticky-toggle (global, blog)**: A pin/unpin button in the header's `.nav-actions` (`#header-sticky-toggle`, mirrors the theme toggle's localStorage + pre-paint bootstrap + two-icon swap) lets the visitor unpin the normally-`fixed` site header so it scrolls away with the page. State lives in `localStorage.headerSticky` (`on` default / `off`), bootstrapped synchronously in `_includes/head.html` (sets `<html data-header-sticky="off">` before paint) and toggled in `assets/js/main.js`. CSS in `style.css`: `html[data-header-sticky="off"]` sets `--header-offset: 0rem` (the default is `--header-offset: var(--header-height)`) and switches `.site-header` to `position: absolute` (so it scrolls away — `main#main-content`'s `padding-top` still reserves its height). Throughout the whole `off` state the `.header-sticky-toggle` is `position: fixed`, positioned (`top: calc((var(--header-height) - 2rem) / 2)`; `right: calc((100vw - min(100vw, var(--max-width))) / 2 + var(--space-lg))`, plus `+ 2rem + var(--space-sm)` at `≤48rem` where the hamburger sits to its right) to overlay its in-header slot **exactly** — so the absolute header scrolls away beneath it and the pin never moves (no teleport). Because it left the flex flow, `html[data-header-sticky="off"] .theme-toggle` gets `margin-right: calc(2rem + var(--space-sm))` to reserve the vacated slot so search/theme/hamburger don't shift. The pin renders as a bare button while the header is on screen; only once the header has actually left the viewport (`html[data-header-sticky="off"].is-scrolled`, a class `main.js` toggles on every page from `scrollY`) does a slightly-faded chip (surface bg + 1px border + soft shadow, `opacity: 0.85`, full on hover/focus) **fade in** — only background/border/box-shadow/opacity transition, never `position`, which is what keeps both scroll-away and pin↔unpin toggling smooth. (Earlier the toggle was in-flow until `.is-scrolled` then snapped to a `0.6rem/0.6rem` corner floater — a `position`-type change that teleported instead of transitioning; the fixed-from-the-start overlay replaces it.) `--header-offset` (not the raw `--header-height`) drives the global `scroll-padding-top`, the post-body `h2` **`position: sticky` `top`** *and* its `scroll-margin-top`, plus the reference pages' `.cmd-widget` / `.electronics-section` `scroll-margin-top` and the reference-table controls + wrapper (see **Reference-table scaffolding**), so unpinning re-anchors sticky headings flush to the very top (no empty header-height gap above them — the gap bug) and reclaims that vertical space for the big tables. The sticky-h2 IntersectionObserver in `main.js` also keys its threshold off `--header-offset`; since that offset changes on toggle and `rootMargin` is baked in at observer creation, the toggle handler dispatches a `headersticky:change` event on `<html>` that the sticky-h2 module listens for to rebuild its observer (sentinels/content-spans stay one-time; only the observer is recreated).

## Deployment & CI/CD

Seven GitHub Actions workflows live in `.github/workflows/`. The four auto-trigger workflows are each scoped with `paths` / `paths-ignore` filters so they only fire when their inputs change; the other three are manual-trigger-capable.

| Workflow | Trigger | Scope | Deploys |
|---|---|---|---|
| `ci.yml` | PR → `main` | Per-app jobs gated by `dorny/paths-filter` — only changed apps run lint/test/build. | Nothing (validation only). |
| `jekyll-gh-pages.yml` | Push → `main` | Skips docs, Firebase configs, Cloud Functions, and Firestore/RTDB/Storage rules. | Full site to GitHub Pages (Jekyll + PolyVote + Blog Admin + Inventory Manager). |
| `feature-preview.yml` | Push → `test` + manual `workflow_dispatch` (with optional `ref` input, defaults to `test`) | Same `paths-ignore` as `jekyll-gh-pages.yml`. | Combined GitHub Pages artifact: main rebuilt at root (Jekyll + PolyVote + Blog Admin + Inventory Manager, identical to `jekyll-gh-pages.yml`'s output) plus the `test` branch (or dispatch `ref`) rebuilt **Jekyll-only** under `/test/` via `bundle exec jekyll build --baseurl /test`. Preview URL: `https://www.ranzlappen.com/test/` (custom domain serves the artifact root, no `/<repo>/` prefix). Shares the `pages` concurrency group with `jekyll-gh-pages.yml` so the two queue, never overlap. |
| `firebase-deploy.yml` | Push → `main` (Firebase/Functions paths) + manual | Builds Cloud Functions, then deploys. | Firestore rules + indexes, RTDB rules, Storage rules, `castBlogVote`, all Blog Admin callables, admin user-management callables (`setUserRole`, `adminListUsers`, `adminBanUser`, `adminUnbanUser`), and all Inventory Manager callables (`inventory*`). |
| `firebase-deploy-manual.yml` | Manual only (`workflow_dispatch`) | Accepts a `target` input passed straight to `firebase deploy --only`. Default `functions` redeploys every function in `polyvote/functions/src/index.ts` — future-proof for newly added functions. Shares the `firebase-deploy` concurrency group with the auto-deploy. | Whatever the `target` input specifies (default: all Cloud Functions). |
| `search-crawl.yml` | Manual only (`workflow_dispatch`) | Runs the `search-crawler` module (Node 22, no install) with the auto-provided `GITHUB_TOKEN`, then commits a refreshed `search-external.json` back to `main` if it changed. The commit then triggers `jekyll-gh-pages.yml`, redeploying the site with the new index. `contents: write` permission; `search-crawl` concurrency group. | Commits `search-external.json` (no deploy itself). |

**Preview limitations**: `feature-preview.yml` ships **Jekyll-only** under `/test/`. PolyVote, Blog Admin, and Inventory Manager are not rebuilt at the preview subpath because their Vite `base` and React Router `basename` are hardcoded to `/polyvote/`, `/blog-admin/`, and `/inventory/`. Navbar links to those apps will 404 inside the preview tree. To enable SPA previews later, make `base` env-driven in `polyvote/vite.config.ts`, `blog-admin/vite.config.ts`, `inventory-manager/vite.config.ts`, the three `main.tsx` files, PolyVote's `ShareButton.tsx`, and PolyVote's PWA manifest (defaults preserve current paths exactly).

**What fires on a given change:**

| Change | CI (on PR to `main`) | Pages prod (push → `main`) | Pages preview (push → `test`) | Firebase (push → `main`) |
|---|:---:|:---:|:---:|:---:|
| Blog post / Jekyll page | — | ✓ | ✓ | — |
| `polyvote/src/**` | polyvote | ✓ | ✓ (rebuilt from main only) | — |
| `blog-admin/src/**` | blog-admin | ✓ | ✓ (rebuilt from main only) | — |
| `inventory-manager/src/**` | inventory-manager | ✓ | ✓ (rebuilt from main only) | — |
| `polyvote/functions/**` | functions | — | — | ✓ |
| `firestore.rules` / `firestore.indexes.json` | — | — | — | ✓ |
| `database.rules.json` / `storage.rules` | — | — | — | ✓ |
| `search-crawler/**` (crawler code) | search-crawler | — | — | — |
| `search-external.json` (crawl output) | — | ✓ | ✓ | — |
| `CLAUDE.md` / `README.md` / `LICENSE` | — | — | — | — |

**Concurrency**: CI cancels superseded runs per PR branch. Pages deploys (both `jekyll-gh-pages.yml` and `feature-preview.yml`) and Firebase deploys **queue** (no cancel) to avoid half-applied state.

**Node version**: All JS jobs (CI + Pages build) run on Node 22.

**Required secrets**:
- `FIREBASE_SERVICE_ACCOUNT` (JSON service-account key) for `firebase-deploy.yml`.
- `GOOGLE_DRIVE_API_KEY` (Firebase Functions secret, set via `firebase functions:secrets:set`) for the inventory `inventoryListDriveFolder` callable. Restrict the key to the Drive API in the GCP console. **This secret MUST exist in the project for ANY functions deploy to succeed** — `firebase deploy` analyzes the *entire* functions codebase and validates every `defineSecret`-declared secret up front, even functions excluded from the `--only TARGETS`; in non-interactive (CI) mode an unset secret aborts the whole deploy (rules included) before anything is applied (this broke `firebase-deploy.yml` once — the fix is to set the secret, a placeholder value is enough to pass analysis). `inventoryListDriveFolder` is still excluded from `firebase-deploy.yml`'s auto-deploy `TARGETS` (so the auto-deploy never tries to bind/redeploy it); deploy it manually (`firebase deploy --only functions:inventoryListDriveFolder`) or via `firebase-deploy-manual.yml` once a real key is stored. The Drive folder picker is unavailable until a real key is set, but the rest of inventory deploys fine **as long as the secret exists**.

**Dependabot** (`.github/dependabot.yml`): weekly updates for all four npm packages (polyvote, polyvote/functions, blog-admin, inventory-manager), bundler, and GitHub Actions. Minor+patch are grouped. Each PR runs CI — `ci.yml` triggers on every PR to `main` (no `paths:` filter) so the `ci-required` aggregator always appears as a status check.

**Auto-merge** (`.github/workflows/dependabot-auto-merge.yml`): every Dependabot PR is queued for GitHub native auto-merge (`gh pr merge --auto --merge`) and lands once required status checks pass. **Requires branch protection on `main` to mark `ci-required` as a required status check** — without that, `--auto` merges immediately without waiting and a failing CI won't block the merge (this happened with PR #236, a `firebase-admin` v12→v13 major bump whose `functions` job failed but landed anyway because no required check was configured). `ci-required` is a single aggregator job in `ci.yml` that succeeds only when every conditional app job (`polyvote`, `functions`, `blog-admin`, `inventory-manager`) either passed or was skipped via path filter; mark it required and the conditional-job deadlock problem disappears.

**Manual fallbacks**:
- Trigger `firebase-deploy-manual.yml` via `workflow_dispatch` (preferred) — deploys via GitHub Actions using the shared service-account secret. Default target is `functions` (all Cloud Functions); override with any `--only` target, e.g. `functions:blogSaveDraft,functions:blogPublishToGitHub` or `functions,database,firestore`.
- Or, from `polyvote/` authenticated via `firebase login`:
  - `firebase deploy --only firestore` — rules + indexes
  - `firebase deploy --only functions:<name>` — a specific function
- Re-run Pages: trigger `jekyll-gh-pages.yml` via `workflow_dispatch`

## Tech Stack

| Layer | Blog | PolyVote | Blog Admin | Inventory Manager |
|-------|------|----------|------------|-------------------|
| Framework | Jekyll (Ruby) | React 19 + TypeScript | React 19 + TypeScript | React 19 + TypeScript |
| Styling | Custom CSS — main `style.css` (~3,200 lines), per-page stylesheets (`spectrum.css`, `electronics-fundamentals.css`, `cmd-cheat-sheet.css`), the shared `abbreviations.css`, and the shared `reference-table.css` (sticky-tab + live-search big-table scaffolding used by Spectrum and the CLI cheat sheet) | Tailwind CSS v3 + Framer Motion | Tailwind CSS v4 (via `@tailwindcss/vite`) | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Router | — | react-router-dom v6 | react-router-dom v7 | react-router-dom v7 |
| State | Vanilla JS | Zustand | Zustand | Zustand |
| Backend | GitHub Pages (static) | Firebase (Firestore, Auth, Functions) | Firebase (Firestore, Auth) | Firebase (Firestore, Auth, Storage) |
| Comments | Giscus (GitHub Discussions) | Firebase subcollections | — | — |
| Editor | — | — | CodeMirror 6 | — |
| Deployment | `jekyll-gh-pages.yml` → GitHub Pages | Built by `jekyll-gh-pages.yml` into `_site/polyvote/` | Built by `jekyll-gh-pages.yml` into `_site/blog-admin/` | Built by `jekyll-gh-pages.yml` into `_site/inventory/` |

## Project Structure

```
├── _config.yml                 # Jekyll configuration
├── _data/
│   ├── pages.yml               # Navigation registry (nav + footer)
│   ├── projects.yml            # External app + reference-page favicons (footer strip)
│   ├── abbreviations/          # Per-page glossary datasets (shared utility)
│   │   ├── cmd-cheat-sheet.yml
│   │   ├── electronics.yml
│   │   └── spectrum.yml
│   ├── cmd-cheat-sheet/        # CLI cheat sheet command data + maintenance README
│   ├── spectrum/               # EM spectrum band data + maintenance README
│   └── references/electronics/ # Architecture / maintenance README for the EF page
├── _includes/                  # Jekyll partials (head, header, footer…)
│   └── abbreviations-section.html  # Shared glossary partial — see Key Conventions
├── _layouts/                   # Page templates (default, home, post, page)
├── _posts/                     # Blog content (Markdown)
├── assets/
│   ├── css/
│   │   ├── style.css                    # Main blog stylesheet
│   │   ├── abbreviations.css            # Shared glossary styling
│   │   ├── reference-table.css          # Shared big-table scaffolding (Spectrum + cmd cheat sheet)
│   │   ├── references-index.css         # /references/ landing-page cards
│   │   ├── spectrum.css                 # Spectrum reference page (overrides)
│   │   ├── electronics-fundamentals.css # Electronics reference page
│   │   ├── cmd-cheat-sheet.css          # CLI cheat sheet reference page (overrides)
│   │   ├── cmd-widgets.css              # CLI cheat sheet Interactive Tools widgets
│   │   └── cookie-consent.css
│   ├── js/
│   │   ├── abbreviations.js             # Shared glossary modal + decoration
│   │   ├── reference-table.js           # Shared tab/search/empty/blurb wiring for big tables
│   │   ├── spectrum.js                  # Spectrum: thin wrapper over reference-table.js
│   │   ├── cmd-cheat-sheet.js           # CLI cheat sheet: reference-table wrapper + worked-example modal wiring
│   │   ├── cmd-widget-*.js              # CLI cheat sheet Interactive Tools (chmod/find/regex/curl + core + bundle)
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
└── polyvote/
    ├── src/
    │   ├── components/         # React components
    │   ├── pages/              # Route-level pages + admin/
    │   ├── hooks/              # Zustand store, Firestore hooks
    │   ├── types/              # TypeScript interfaces
    │   └── __tests__/          # Vitest tests
    ├── functions/src/          # Firebase Cloud Functions (TypeScript)
    │   └── inventory/          # Inventory Manager callables (folders, items, photos, import/export, eBay CSV)
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
