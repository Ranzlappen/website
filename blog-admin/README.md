# Blog Admin — Markdown Editor & Publisher

A React 19 + Vite admin dashboard for authoring, previewing, and publishing blog posts to the Jekyll site. Authenticates with Firebase Auth; writes drafts to Firestore and publishes via Cloud Functions that commit Markdown files to the GitHub repo. One of three independent modules in the [`ranzlappen/website`](../README.md) repo; deployed as `/blog-admin/` inside the Jekyll site.

---

## Quick Start

```bash
cd blog-admin
npm install
npm run dev
```

Dev server: **http://localhost:5173/** — the `/blog-admin/` base path only applies in the production build.

### Prerequisites

- **Node 22** (matches CI and Cloud Functions runtime)
- A Firebase account with Firestore write permission on the project. Admins are bootstrapped via the `bootstrapAdmin` Cloud Function; elevated roles come from custom claims on the user's ID token.
- Client Firebase config in [`src/firebase.ts`](./src/firebase.ts) (public keys only — access is gated by Firestore rules and Cloud Functions).

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on `:5173` with HMR |
| `npm run build` | TypeScript project-references build (`tsc -b`) + Vite production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over the repo (flat config) |
| `npm run format` | Prettier — write changes to `src/` |

> No test suite yet. If you add one, wire it into the `blog-admin` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

---

## How This Fits Into the Repo

Blog Admin is one of three independent modules. It is built in isolation and copied into `_site/blog-admin/` by [`.github/workflows/jekyll-gh-pages.yml`](../.github/workflows/jekyll-gh-pages.yml).

- **Server-validated writes only.** Clients never call `addDoc`/`setDoc`/`updateDoc`/`deleteDoc` directly. Every mutation goes through a Cloud Function (`blogSaveDraft`, `blogPublishToGitHub`, `blogUploadImage`, `blogDeleteDraft`, etc.) — see [`../polyvote/functions/src/blog/`](../polyvote/functions/src/blog/).
- **Publishing flow:** editor → `blogSaveDraft` (Firestore draft) → `blogPublishToGitHub` (Cloud Function commits a file under `_posts/` on the default branch via the GitHub API) → Jekyll rebuilds on push → post is live.
- **No cross-module imports.** Blog Admin does not import from `polyvote/` or the Jekyll root. If logic truly needs to be shared, duplicate it intentionally (see [`../CLAUDE.md`](../CLAUDE.md)).
- **Access:** the app is routable at `/blog-admin/` but gated by `AuthGuard` + role claims — only authenticated users with the right role see the dashboard.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19 |
| Language | TypeScript | 6 |
| Build | Vite | 8 |
| Styling | Tailwind CSS | **4** (via `@tailwindcss/vite` plugin) |
| Routing | react-router-dom | **7** |
| State | Zustand | 5 |
| Editor | CodeMirror | 6 (`state`, `view`, `commands`, `search`, `lang-markdown`, `language-data`) |
| Markdown preview | react-markdown + remark-gfm + rehype-raw | latest |
| Database | Cloud Firestore (Firebase modular SDK) | 12 |
| Auth | Firebase Auth (email/password + custom claims) | 12 |

---

## Conventions

- **Dark-only.** By design — no light theme, no toggle, no `.light` CSS variant. Styling uses CSS custom properties set once on `:root`.
- **No direct Firestore writes** from the client. Keep [`src/firebase.ts`](./src/firebase.ts) free of `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`. Reads via `getDoc`/`onSnapshot` are fine where rules allow.
- **Role-based auth.** `AuthGuard` reads the user's custom claims (`role: 'admin' | 'user'` etc.) from the ID token — not a Firestore document. Claims are set by the `setUserRole` Cloud Function.
- **No monorepo tooling.** Install/lint/build/format commands run from inside `blog-admin/`.

---

## Routes

Defined in [`src/App.tsx`](./src/App.tsx):

| Path | Component | Guard |
|---|---|---|
| `/login` | `Login` | public |
| `/` | `Dashboard` | `AuthGuard` |
| `/new` | `Editor` (new draft) | `AuthGuard` |
| `/edit/:draftId` | `Editor` (existing draft) | `AuthGuard` |
| `/import/:filename` | `Editor` (import from GitHub) | `AuthGuard` |
| `*` | redirects to `/` | — |

---

## Project Structure

```
blog-admin/
├── index.html              # Vite entry HTML
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite + @tailwindcss/vite plugin (base: '/blog-admin/')
├── tsconfig.json           # TypeScript project references
├── eslint.config.js        # ESLint flat config
└── src/
    ├── main.tsx            # React mount point
    ├── App.tsx             # Routes + auth bootstrapping
    ├── firebase.ts         # Firebase client init (public keys)
    ├── store.ts            # Zustand store (auth, toasts, draft state)
    ├── types.ts            # TypeScript interfaces
    ├── index.css           # Tailwind v4 import + CSS variables
    ├── pages/              # Login, Dashboard, Editor
    ├── components/         # AuthGuard, Toast, editor UI, dialogs
    └── __tests__/          # (if/when tests are added)
```

---

## Deployment

Built and deployed by [`.github/workflows/jekyll-gh-pages.yml`](../.github/workflows/jekyll-gh-pages.yml) on every push to `main` that touches `blog-admin/src/**` (or any non-ignored path). Artifact lands at `_site/blog-admin/` and ships with the rest of the site to GitHub Pages.

The `blogPublishToGitHub` Cloud Function needs a GitHub token with `contents:write` on this repo — see [`../polyvote/functions/README.md`](../polyvote/functions/README.md) for how that's configured.

---

## Differences vs PolyVote

Both apps live in this repo but differ in non-obvious ways. If you've worked on one, watch for these when jumping to the other:

| | PolyVote | Blog Admin |
|---|---|---|
| Tailwind | v3 (config file + directives) | **v4** (Vite plugin + `@import "tailwindcss"`) |
| Router | react-router-dom v6 | react-router-dom **v7** |
| Theme | dark/light toggle (Zustand-persisted) | **dark-only**, no toggle |
| Editor | — | CodeMirror 6 |
| Tests | Vitest + Testing Library | none yet |
| TS build | `tsc && vite build` | `tsc -b && vite build` (project refs) |
| Auth | anonymous | email/password + custom claims |

---

## Troubleshooting

- **"Auth domain not authorized"** — add your domain in **Firebase Console → Authentication → Settings → Authorized domains**.
- **"Missing or insufficient permissions"** on a callable — your account lacks the required role claim. Admins must set it via the `setUserRole` Cloud Function; the first admin is bootstrapped once via `bootstrapAdmin`.
- **Tailwind styles aren't applying** — this app uses Tailwind **v4**. Check that `@import "tailwindcss";` is present in `src/index.css` and that `@tailwindcss/vite` is in the `plugins` array of `vite.config.ts`. Do **not** add `@tailwind base/components/utilities` directives (that's v3 syntax).
- **`tsc -b` fails with stale output** — delete `dist/` and `*.tsbuildinfo`, then rerun `npm run build`.

---

## Related Documentation

- **Architecture source of truth:** [`../CLAUDE.md`](../CLAUDE.md)
- **Blog content guide (non-developer):** [`../README.md`](../README.md)
- **PolyVote app:** [`../polyvote/README.md`](../polyvote/README.md)
- **Cloud Functions (where Blog Admin's writes actually run):** [`../polyvote/functions/README.md`](../polyvote/functions/README.md)
