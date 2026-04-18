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

Production deploy of `castBlogVote` is automated (see CI/CD below). Manual deploys of other functions use `firebase deploy --only functions:<name>` from `polyvote/`.

## Key Conventions

- **Post status**: Posts use a `status` field in front matter (`published`, `draft`, `placeholder`, `unpublished`). Only `published` and `placeholder` appear in the sitemap and feed.
- **Navigation**: Centralized in `_data/pages.yml` — single source of truth for nav and footer links.
- **Firebase keys**: Public client-side keys in `_config.yml`, `polyvote/src/firebase.ts`, and `blog-admin/src/firebase.ts`. Security is enforced via Firestore rules and Cloud Functions.
- **Server-validated writes**: All user actions (votes, comments, requests) go through Cloud Functions, not direct Firestore writes.
- **Privacy-first**: No Google Analytics. Cookie consent is GDPR-compliant with functional category.
- **Theme**: Dark mode is default. Both the blog (CSS custom properties) and PolyVote (Tailwind + CSS variables) support dark/light toggle.

## Deployment & CI/CD

Three GitHub Actions workflows live in `.github/workflows/`. Each is scoped with `paths` / `paths-ignore` filters so it only fires when its inputs change.

| Workflow | Trigger | Scope | Deploys |
|---|---|---|---|
| `ci.yml` | PR → `main` | Per-app jobs gated by `dorny/paths-filter` — only changed apps run lint/test/build. | Nothing (validation only). |
| `jekyll-gh-pages.yml` | Push → `main` | Skips docs, Firebase configs, Cloud Functions, and Firestore/RTDB rules. | Full site to GitHub Pages (Jekyll + PolyVote + Blog Admin). |
| `firebase-deploy.yml` | Push → `main` (Firebase/Functions paths) + manual | Builds Cloud Functions, then deploys. | Firestore rules + indexes, RTDB rules, and the `castBlogVote` function. |

**What fires on a given change:**

| Change | CI (on PR) | Pages (on merge) | Firebase (on merge) |
|---|:---:|:---:|:---:|
| Blog post / Jekyll page | — | ✓ | — |
| `polyvote/src/**` | polyvote | ✓ | — |
| `blog-admin/src/**` | blog-admin | ✓ | — |
| `polyvote/functions/**` | functions | — | ✓ |
| `firestore.rules` / `firestore.indexes.json` | — | — | ✓ |
| `database.rules.json` | — | — | ✓ |
| `CLAUDE.md` / `README.md` / `LICENSE` | — | — | — |

**Concurrency**: CI cancels superseded runs per PR branch. Pages and Firebase deploys **queue** (no cancel) to avoid half-applied state.

**Node version**: All JS jobs (CI + Pages build) run on Node 22.

**Required secret**: `FIREBASE_SERVICE_ACCOUNT` (JSON service-account key) for `firebase-deploy.yml`.

**Dependabot** (`.github/dependabot.yml`): weekly updates for all three npm packages, bundler, and GitHub Actions. Minor+patch are grouped. Each PR runs CI.

**Manual fallbacks** (from `polyvote/`, authenticated via `firebase login`):
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
│       ├── ci.yml              # PR validation (per-app jobs)
│       ├── jekyll-gh-pages.yml # Build + deploy site to Pages
│       └── firebase-deploy.yml # Deploy Firestore/RTDB rules + castBlogVote
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
