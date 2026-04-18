# PolyVote — Multi-Metric Community Voting

A self-contained **Vite + React 19 + TypeScript + Tailwind CSS v3** app that lets communities vote across multiple dimensions on any topic and see results in real-time radar charts. Built as one of three independent modules in the [`ranzlappen/website`](../README.md) repo; deployed as a subfolder (`/polyvote/`) within the Jekyll site.

---

## Quick Start

```bash
cd polyvote
npm install
npm run dev
```

Dev server: **http://localhost:5173/** — the `/polyvote/` base path only applies in the production build.

### Prerequisites

- **Node 22** (matches CI and Cloud Functions runtime)
- A Firebase project with Firestore + Anonymous Auth enabled. Client keys live in [`src/firebase.ts`](./src/firebase.ts); security is enforced by [`firestore.rules`](./firestore.rules) and the Cloud Functions in [`functions/`](./functions).

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on `:5173` with HMR |
| `npm run build` | Type-check (`tsc`) + production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over `src/` (flat config) |
| `npm run test` | Vitest unit tests (single run) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run format` | Prettier — write changes |
| `npm run format:check` | Prettier — check only |
| `npm run seed` | **Optional.** Populate Firestore with 6 demo topics across 3 categories. Writes to the real Firebase project configured in `src/firebase.ts` — not a local emulator. |

---

## How This Fits Into the Repo

PolyVote is one of three independent modules. It is built in isolation and copied into `_site/polyvote/` by `.github/workflows/jekyll-gh-pages.yml` during the Jekyll deploy.

- **All client writes go through Cloud Functions** (`httpsCallable`) — never direct Firestore SDK writes. See [`functions/`](./functions) for the callable endpoints.
- **No cross-module imports.** PolyVote does not import from `blog-admin/` or the Jekyll root. If logic must be shared, duplicate it intentionally (see [`CLAUDE.md`](../CLAUDE.md)).
- **Production URL:** served under `/polyvote/` on the main domain (the `base` is set in [`vite.config.ts`](./vite.config.ts)).

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19 |
| Language | TypeScript | 6 |
| Build | Vite | 5 |
| Styling | Tailwind CSS | 3 (`darkMode: 'class'`) |
| Routing | react-router-dom | 6 |
| State | Zustand | 5 |
| Database | Cloud Firestore (Firebase modular SDK) | 12 |
| Auth | Firebase Anonymous Auth | 12 |
| Charts | Chart.js + react-chartjs-2 | 4 + 5 |
| Animations | Framer Motion | 11 |
| Icons | lucide-react | latest |
| Dates | date-fns | 4 |
| Tests | Vitest + Testing Library | 4 |
| PWA | vite-plugin-pwa | 1 |

---

## Firestore Rules & Indexes

Files in this directory are the source of truth for the backend configuration:

- **[`firestore.rules`](./firestore.rules)** — security rules for `topics`, `requests`, `topicRequests`, and related collections
- **[`firestore.indexes.json`](./firestore.indexes.json)** — composite index definitions
- **[`database.rules.json`](./database.rules.json)** — Realtime Database rules (blog vote aggregates)
- **[`firebase.json`](./firebase.json)** — Firebase CLI config
- **[`.firebaserc`](./.firebaserc)** — Firebase project mapping

---

## Deployment

Two workflows are involved — both fire on push to `main`:

| Workflow | Builds | Deploys |
|---|---|---|
| `jekyll-gh-pages.yml` | Jekyll + PolyVote + Blog Admin | Full site to GitHub Pages |
| `firebase-deploy.yml` | Cloud Functions | Firestore rules + indexes, RTDB rules, `castBlogVote` function |

### Manual fallbacks

Run from `polyvote/` after `firebase login`:

```bash
firebase deploy --only firestore           # rules + indexes
firebase deploy --only database            # RTDB rules
firebase deploy --only functions:<name>    # a single function
```

---

## Features

- **Homepage** — hero, collapsible category tabs, search/filter/sort, responsive topic grid with mini radar previews
- **Topic detail** — per-metric single-select voting cards, live radar chart, participant count, request-changes modal
- **Requests page** — topic proposals with endorsement/promotion system; change requests with approve/reject controls
- **Topic proposals** — structured form to propose new topics with metrics and choices; community endorsement promotes to main voting
- **Real-time** — all data updates via Firestore `onSnapshot` listeners
- **Anonymous voting** — Firebase anonymous auth; duplicate-vote prevention per browser via localStorage
- **Dark mode** — dark-first with green accent palette matching the parent site (user-toggleable, persisted in Zustand/localStorage)
- **Responsive** — mobile-first layout with Framer Motion transitions

---

## Project Structure

```
polyvote/
├── index.html              # Vite entry HTML
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite config (base: '/polyvote/')
├── tailwind.config.js      # Tailwind theme (dark-mode class toggle)
├── tsconfig.json           # TypeScript configuration
├── firebase.json           # Firebase CLI config
├── .firebaserc             # Firebase project mapping
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Composite indexes
├── database.rules.json     # Realtime Database rules
├── functions/              # Cloud Functions (see functions/README.md)
└── src/
    ├── main.tsx            # React mount point
    ├── App.tsx             # Root component + routes
    ├── firebase.ts         # Firebase client init (public keys)
    ├── index.css           # Tailwind directives + globals
    ├── types/              # TypeScript interfaces
    ├── hooks/              # Zustand store + Firestore hooks
    ├── components/         # Reusable UI components
    ├── pages/              # Route-level pages + admin/
    ├── __tests__/          # Vitest tests
    └── utils/              # Seed script and helpers
```

---

## Troubleshooting

- **Auth fails in production** — add your Pages/custom domain in **Firebase Console → Authentication → Settings → Authorized domains**.
- **`firebase: command not found`** — install the CLI with `npm install -g firebase-tools`, then `firebase login`. (The npm package is `firebase-tools`; the binary it installs is `firebase`.)
- **`npm run seed` fails with permission errors** — your Firestore rules probably don't allow writes for unauthenticated users. Sign in once in the app, or run seed against a permissive dev project.
- **Port 5173 is in use** — Vite will auto-increment to `:5174` etc. Check the terminal output.

---

## Related Documentation

- **Architecture source of truth:** [`../CLAUDE.md`](../CLAUDE.md)
- **Blog content guide (non-developer):** [`../README.md`](../README.md)
- **Cloud Functions:** [`./functions/README.md`](./functions/README.md)
- **Blog Admin:** [`../blog-admin/README.md`](../blog-admin/README.md)
