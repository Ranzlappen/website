# PolyVote Cloud Functions

Firebase Cloud Functions backing three things:

1. **PolyVote voting & moderation** — `castVote`, topic request triggers, admin CRUD for topics/users/reports/requests, analytics.
2. **Blog Admin publishing** — `blogSaveDraft`, `blogListDrafts`, `blogGetDraft`, `blogDeleteDraft`, `blogPublishToGitHub`, `blogUploadImage`, `blogListExistingPosts`, `blogFetchExistingPost`.
3. **Jekyll blog voting sidebar** — `castBlogVote` (writes counters to Realtime Database).

Full export list: [`src/index.ts`](./src/index.ts).

---

## Quick Start

```bash
cd polyvote/functions
npm install
npm run build
```

### Prerequisites

- **Node 22** (enforced by `engines.node` in `package.json` — Firebase rejects other versions at deploy time)
- Firebase CLI: `npm install -g firebase-tools`, then `firebase login`
- For `blogPublishToGitHub`: a GitHub personal access token with `contents:write` on this repo, stored as a Firebase runtime config / secret

---

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Compile TypeScript to `lib/` |
| `npm run build:watch` | Rebuild on change (pair with emulator) |
| `npm run serve` | Build then start the Firebase **Functions emulator** |
| `npm run shell` | Build then drop into `firebase functions:shell` for interactive invocation |
| `npm run deploy` | `firebase deploy --only functions` (all functions) — usually prefer the single-function form below |
| `npm run lint` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |

---

## Local Emulator Workflow

```bash
npm run serve
```

In a second terminal, run the client app you want to exercise (`cd polyvote && npm run dev` or `cd blog-admin && npm run dev`). Point the client at the emulator by calling `connectFunctionsEmulator(functions, 'localhost', 5001)` in the Firebase init — guard it behind `import.meta.env.DEV` so it never ships to production.

`firebase.json` (in `polyvote/`) controls emulator ports.

---

## Deployment

### Automated — `castBlogVote` only

Pushes to `main` that touch `polyvote/functions/**` (or the relevant rules files) trigger [`.github/workflows/firebase-deploy.yml`](../../.github/workflows/firebase-deploy.yml). That workflow deploys:

- Firestore rules + indexes
- Realtime Database rules
- **Only the `castBlogVote` function** (`firebase deploy --only database,firestore,functions:castBlogVote`)

Required repo secret: `FIREBASE_SERVICE_ACCOUNT` (a service-account JSON key).

### Manual — everything else

All other functions deploy manually (to avoid surprise production changes on every push):

```bash
cd polyvote
firebase deploy --only functions:<name>
# e.g.
firebase deploy --only functions:blogPublishToGitHub
firebase deploy --only functions:castVote
```

To deploy a whole group:

```bash
firebase deploy --only functions:adminCreateTopic,functions:adminEditTopic,functions:adminDeleteTopic
```

---

## Conventions

- **All client writes go through here.** PolyVote and Blog Admin must never call `addDoc`/`setDoc`/`updateDoc`/`deleteDoc` directly — every mutation is a callable. See [`../../CLAUDE.md`](../../CLAUDE.md) "Server-validated writes".
- **Auth.** Callables verify `context.auth.uid` and (for admin functions) the `role` custom claim.
- **No cross-module imports.** This module stays self-contained — Blog Admin's client code and PolyVote's client code do not share source with functions.

---

## Project Structure

```
polyvote/functions/
├── package.json            # engines.node: "22"
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts            # Re-exports all callables/triggers
    ├── auth/               # onCreate, setUserRole, bootstrapAdmin
    ├── voting/             # castVote
    ├── triggers/           # onEndorse, onExpire, computeTrending
    ├── admin/              # topics, users, moderation, requests, analytics, publicStats
    ├── blog/               # drafts, publish, images, github, castBlogVote
    ├── user/               # per-user utilities
    └── utils/              # shared helpers
```

---

## Related Documentation

- **Architecture source of truth:** [`../../CLAUDE.md`](../../CLAUDE.md)
- **PolyVote client:** [`../README.md`](../README.md)
- **Blog Admin client:** [`../../blog-admin/README.md`](../../blog-admin/README.md)
- **Deploy workflow:** [`../../.github/workflows/firebase-deploy.yml`](../../.github/workflows/firebase-deploy.yml)
