# ranzlappen.com

Personal blog + PolyVote community voting platform + Blog Admin dashboard, hosted on GitHub Pages.

## Architecture

**Hybrid project** with three independent builds:

- **Jekyll blog** (root) — Static site built by GitHub Pages. Posts in `_posts/`, layouts in `_layouts/`, includes in `_includes/`, pages in `pages/`. Config: `_config.yml`.
- **PolyVote** (`polyvote/`) — React 19 SPA built with Vite. Backend: Firebase (Firestore, Auth, Cloud Functions). Deployed as a subfolder within the Jekyll `_site/`.
- **Blog Admin** (`blog-admin/`) — React 19 SPA built with Vite for managing blog drafts and publishing. Uses Firebase (Firestore, Auth), CodeMirror 6 for Markdown editing, and Zustand for state. Deployed as a subfolder within the Jekyll `_site/`.

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

### Cloud Functions
```bash
cd polyvote/functions
npm install
npm run build                     # Compile TypeScript
npm run lint                      # tsc --noEmit
npm test                          # Vitest (unit tests)
```

Production deploys of `castBlogVote`, the Blog Admin callables (`blogSaveDraft`, `blogListDrafts`, `blogGetDraft`, `blogDeleteDraft`, `blogListExistingPosts`, `blogFetchExistingPost`, `blogImportPostForEdit`, `blogPublishToGitHub`, `blogUploadImage`, `blogListSeriesUsage`), and the admin user-management callables shared with the Blog Admin Users panel (`setUserRole`, `adminListUsers`, `adminBanUser`, `adminUnbanUser`) are automated (see CI/CD below). Manual deploys of anything else use `firebase deploy --only functions:<name>` from `polyvote/`.

## Key Conventions

- **Module boundaries**: `polyvote/`, `blog-admin/`, and the Jekyll root (blog) are three independent modules, with `polyvote/functions/` as a fourth nested module. Each has its own `package.json`/`Gemfile`, TypeScript/ESLint/Tailwind config, and deploy path. Run install/lint/test/build/format from within the module's own directory (see **Build & Development**). Do **not** cross-import source between modules — there is no monorepo tooling and no shared package. If logic truly needs to be shared, duplicate it intentionally. Scope PRs to a single module when possible so CI's per-app path filters stay meaningful.
- **Post status**: Posts use a `status` field in front matter (`published`, `draft`, `placeholder`, `unpublished`). Only `published` and `placeholder` appear in the sitemap and feed.
- **Post categories**: Posts set a singular `category:` field in front matter. The string `"Projects"` (capitalized, exact match) is canonical and routes the post to `/projects/`; everything else lands on `/blog/`. Homepage and `/categories/` show all categories. Liquid's `==` is case-sensitive — keep the exact casing.
- **Navigation**: Centralized in `_data/pages.yml` — single source of truth for nav and footer links.
- **External apps**: The user's external apps (standalone subdomains like `ticked.ranzlappen.com`) are **not** in the navbar. They're listed in `_data/projects.yml` and rendered as a favicon strip in the footer via `_includes/footer.html`. Favicons are committed locally under `assets/images/favicons/` — **do not hotlink** upstream favicons (privacy-first: hotlinking leaks visitor IP/UA to the subdomain on every page load, before consent). To refresh a favicon, `curl` the upstream `<link rel="icon">` target into `assets/images/favicons/<name>.png` and commit.
- **Firebase keys**: Public client-side keys in `_config.yml`, `polyvote/src/firebase.ts`, and `blog-admin/src/firebase.ts`. Security is enforced via Firestore rules and Cloud Functions.
- **Server-validated writes**: All client writes go through Cloud Functions (`httpsCallable`), never direct Firestore SDK writes. This applies to PolyVote user actions (votes, comments, requests) **and** to Blog Admin operations (drafts, publishing). Keep `blog-admin/src/firebase.ts` free of `addDoc`/`setDoc`/`updateDoc`/`deleteDoc`.
- **Blog import flow**: Importing an existing `_posts/` file from Blog Admin offers two explicit modes — **Edit** (links the draft to the GitHub file via `blogDrafts.sourceFilename`, so re-imports reopen the same draft and publish updates in place) and **Copy** (unlinked draft seeded with a `-copy` slug for creating a new post). `blogPublishToGitHub` requires `confirmOverwrite: true` when a draft would silently overwrite an unlinked GitHub file.
- **Privacy-first**: No Google Analytics. Cookie consent is GDPR-compliant with functional category.
- **Theme**: Dark mode is default across all three modules. The blog (CSS custom properties) and PolyVote (Tailwind + CSS variables, persisted via Zustand/localStorage) support a dark/light toggle. Blog Admin is dark-only by design — it has no theme toggle and no `.light` CSS variant.

## Deployment & CI/CD

Five GitHub Actions workflows live in `.github/workflows/`. The three auto-trigger workflows are each scoped with `paths` / `paths-ignore` filters so they only fire when their inputs change; the other two are manual-trigger-capable.

| Workflow | Trigger | Scope | Deploys |
|---|---|---|---|
| `ci.yml` | PR → `main` | Per-app jobs gated by `dorny/paths-filter` — only changed apps run lint/test/build. | Nothing (validation only). |
| `jekyll-gh-pages.yml` | Push → `main` | Skips docs, Firebase configs, Cloud Functions, and Firestore/RTDB rules. | Full site to GitHub Pages (Jekyll + PolyVote + Blog Admin). |
| `feature-preview.yml` | Push → `test` + manual `workflow_dispatch` (with optional `ref` input, defaults to `test`) | Same `paths-ignore` as `jekyll-gh-pages.yml`. | Combined GitHub Pages artifact: main rebuilt at root (Jekyll + PolyVote + Blog Admin, identical to `jekyll-gh-pages.yml`'s output) plus the `test` branch (or dispatch `ref`) rebuilt **Jekyll-only** under `/test/` via `bundle exec jekyll build --baseurl /test`. Preview URL: `https://www.ranzlappen.com/test/` (custom domain serves the artifact root, no `/<repo>/` prefix). Shares the `pages` concurrency group with `jekyll-gh-pages.yml` so the two queue, never overlap. |
| `firebase-deploy.yml` | Push → `main` (Firebase/Functions paths) + manual | Builds Cloud Functions, then deploys. | Firestore rules + indexes, RTDB rules, `castBlogVote`, all Blog Admin callables, and admin user-management callables (`setUserRole`, `adminListUsers`, `adminBanUser`, `adminUnbanUser`). |
| `firebase-deploy-manual.yml` | Manual only (`workflow_dispatch`) | Accepts a `target` input passed straight to `firebase deploy --only`. Default `functions` redeploys every function in `polyvote/functions/src/index.ts` — future-proof for newly added functions. Shares the `firebase-deploy` concurrency group with the auto-deploy. | Whatever the `target` input specifies (default: all Cloud Functions). |

**Preview limitations**: `feature-preview.yml` ships **Jekyll-only** under `/test/`. PolyVote and Blog Admin are not rebuilt at the preview subpath because their Vite `base` and React Router `basename` are hardcoded to `/polyvote/` and `/blog-admin/`. Navbar links to those apps will 404 inside the preview tree. To enable SPA previews later, make `base` env-driven in `polyvote/vite.config.ts`, `blog-admin/vite.config.ts`, both `main.tsx` files, PolyVote's `ShareButton.tsx`, and PolyVote's PWA manifest (defaults preserve current paths exactly).

**What fires on a given change:**

| Change | CI (on PR to `main`) | Pages prod (push → `main`) | Pages preview (push → `test`) | Firebase (push → `main`) |
|---|:---:|:---:|:---:|:---:|
| Blog post / Jekyll page | — | ✓ | ✓ | — |
| `polyvote/src/**` | polyvote | ✓ | ✓ (rebuilt from main only) | — |
| `blog-admin/src/**` | blog-admin | ✓ | ✓ (rebuilt from main only) | — |
| `polyvote/functions/**` | functions | — | — | ✓ |
| `firestore.rules` / `firestore.indexes.json` | — | — | — | ✓ |
| `database.rules.json` | — | — | — | ✓ |
| `CLAUDE.md` / `README.md` / `LICENSE` | — | — | — | — |

**Concurrency**: CI cancels superseded runs per PR branch. Pages deploys (both `jekyll-gh-pages.yml` and `feature-preview.yml`) and Firebase deploys **queue** (no cancel) to avoid half-applied state.

**Node version**: All JS jobs (CI + Pages build) run on Node 22.

**Required secret**: `FIREBASE_SERVICE_ACCOUNT` (JSON service-account key) for `firebase-deploy.yml`.

**Dependabot** (`.github/dependabot.yml`): weekly updates for all three npm packages, bundler, and GitHub Actions. Minor+patch are grouped. Each PR runs CI.

**Manual fallbacks**:
- Trigger `firebase-deploy-manual.yml` via `workflow_dispatch` (preferred) — deploys via GitHub Actions using the shared service-account secret. Default target is `functions` (all Cloud Functions); override with any `--only` target, e.g. `functions:blogSaveDraft,functions:blogPublishToGitHub` or `functions,database,firestore`.
- Or, from `polyvote/` authenticated via `firebase login`:
  - `firebase deploy --only firestore` — rules + indexes
  - `firebase deploy --only functions:<name>` — a specific function
- Re-run Pages: trigger `jekyll-gh-pages.yml` via `workflow_dispatch`

## Tech Stack

| Layer | Blog | PolyVote | Blog Admin |
|-------|------|----------|------------|
| Framework | Jekyll (Ruby) | React 19 + TypeScript | React 19 + TypeScript |
| Styling | Custom CSS (~2970 lines) | Tailwind CSS v3 + Framer Motion | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Router | — | react-router-dom v6 | react-router-dom v7 |
| State | Vanilla JS | Zustand | Zustand |
| Backend | GitHub Pages (static) | Firebase (Firestore, Auth, Functions) | Firebase (Firestore, Auth) |
| Comments | Giscus (GitHub Discussions) | Firebase subcollections | — |
| Editor | — | — | CodeMirror 6 |
| Deployment | `jekyll-gh-pages.yml` → GitHub Pages | Built by `jekyll-gh-pages.yml` into `_site/polyvote/` | Built by `jekyll-gh-pages.yml` into `_site/blog-admin/` |

## Project Structure

```
├── _config.yml                 # Jekyll configuration
├── _data/pages.yml             # Navigation registry
├── _includes/                  # Jekyll partials (head, header, footer, etc.)
├── _layouts/                   # Page templates (default, home, post, page)
├── _posts/                     # Blog content (Markdown)
├── assets/                     # CSS, JS, images
├── pages/                      # Static pages (about, contact, privacy, etc.)
├── feed.xml                    # Atom feed (custom, status-filtered)
├── sitemap.xml                 # Sitemap (custom, status-filtered)
├── .github/
│   ├── dependabot.yml          # Weekly dependency updates
│   └── workflows/
│       ├── ci.yml                      # PR validation (per-app jobs)
│       ├── jekyll-gh-pages.yml         # Build + deploy prod site to Pages
│       ├── feature-preview.yml         # Build + deploy main + `test` preview to Pages
│       ├── firebase-deploy.yml         # Deploy Firestore/RTDB rules + castBlogVote + Blog Admin callables
│       └── firebase-deploy-manual.yml  # Manual Cloud Functions deploys (workflow_dispatch)
├── blog-admin/
│   ├── src/
│   │   ├── components/         # Editor UI, auth, dialogs
│   │   ├── pages/              # Dashboard, Editor, Login
│   │   ├── firebase.ts         # Firebase client config
│   │   ├── store.ts            # Zustand store
│   │   └── types.ts            # TypeScript interfaces
│   └── eslint.config.js        # ESLint flat config
└── polyvote/
    ├── src/
    │   ├── components/         # React components
    │   ├── pages/              # Route-level pages + admin/
    │   ├── hooks/              # Zustand store, Firestore hooks
    │   ├── types/              # TypeScript interfaces
    │   └── __tests__/          # Vitest tests
    ├── functions/src/          # Firebase Cloud Functions (TypeScript)
    ├── firestore.rules         # Firestore security rules
    ├── firestore.indexes.json  # Firestore composite indexes
    ├── database.rules.json     # Realtime Database rules (vote aggregates)
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
