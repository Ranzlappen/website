# ranzlappen.com

Personal blog + PolyVote community voting platform, hosted on GitHub Pages.

## Architecture

**Hybrid project** with two independent builds:

- **Jekyll blog** (root) — Static site built by GitHub Pages. Posts in `_posts/`, layouts in `_layouts/`, includes in `_includes/`, pages in `pages/`. Config: `_config.yml`.
- **PolyVote** (`polyvote/`) — React 18 SPA built with Vite. Backend: Firebase (Firestore, Auth, Cloud Functions). Deployed as a subfolder within the Jekyll `_site/`.

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

### Cloud Functions
```bash
cd polyvote/functions
npm install
npm run build                     # Compile TypeScript
npm run lint                      # tsc --noEmit
firebase deploy --only functions  # Deploy to Firebase
```

## Key Conventions

- **Post status**: Posts use a `status` field in front matter (`published`, `draft`, `placeholder`, `unpublished`). Only `published` and `placeholder` appear in the sitemap and feed.
- **Navigation**: Centralized in `_data/pages.yml` — single source of truth for nav and footer links.
- **Firebase keys**: Public client-side keys in `_config.yml` and `polyvote/src/firebase.ts`. Security is enforced via Firestore rules and Cloud Functions.
- **Server-validated writes**: All user actions (votes, comments, requests) go through Cloud Functions, not direct Firestore writes.
- **Privacy-first**: No Google Analytics. Cookie consent is GDPR-compliant with functional category.
- **Theme**: Dark mode is default. Both the blog (CSS custom properties) and PolyVote (Tailwind + CSS variables) support dark/light toggle.

## Tech Stack

| Layer | Blog | PolyVote |
|-------|------|----------|
| Framework | Jekyll (Ruby) | React 18 + TypeScript |
| Styling | Custom CSS (2700+ lines) | Tailwind CSS + Framer Motion |
| State | Vanilla JS | Zustand |
| Backend | GitHub Pages (static) | Firebase (Firestore, Auth, Functions) |
| Comments | Giscus (GitHub Discussions) | Firebase subcollections |
| Deployment | GitHub Actions → GitHub Pages | Built into `_site/polyvote/` |

## Project Structure

```
├── _config.yml              # Jekyll configuration
├── _data/pages.yml          # Navigation registry
├── _includes/               # Jekyll partials (head, header, footer, etc.)
├── _layouts/                # Page templates (default, home, post, page)
├── _posts/                  # Blog content (Markdown)
├── assets/                  # CSS, JS, images
├── pages/                   # Static pages (about, contact, privacy, etc.)
├── feed.xml                 # Atom feed (custom, status-filtered)
├── sitemap.xml              # Sitemap (custom, status-filtered)
├── polyvote/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Route-level pages + admin/
│   │   ├── hooks/           # Zustand store, Firestore hooks
│   │   ├── types/           # TypeScript interfaces
│   │   └── __tests__/       # Vitest tests
│   ├── functions/src/       # Firebase Cloud Functions (TypeScript)
│   ├── firestore.rules      # Firestore security rules
│   └── eslint.config.js     # ESLint flat config
└── .github/workflows/       # CI/CD (build + lint + test + deploy)
```
