# Inventory Manager

Private admin tool for managing inventory with photo attachments, CSV/JSON
import-export, and eBay File Exchange CSV export. Lives at
`https://www.ranzlappen.com/inventory/` — hidden from crawlers via
`robots.txt`, `noindex` meta tags, and Firebase Auth admin-role gating.
Uses the same Firebase Auth account as Blog Admin (admin role required).

## Architecture

- **React 19 + TypeScript + Vite + Tailwind v4**, structured exactly like
  `blog-admin/`.
- All writes go through Cloud Functions (`httpsCallable`) in
  `polyvote/functions/src/inventory/`. Never write to Firestore or Storage
  directly from this SPA.
- Photos live in Firebase Storage under `inventory/{itemId}/{uuid}.{ext}` and
  are made public so eBay's `PicURL` column can fetch them.

## Local development

```bash
npm install
npm run dev       # http://localhost:5173 (you'll be redirected to /login)
npm run lint
npm run build
```

You need a Firebase Auth account with the `admin` custom claim to use the
app. Sign in with the same credentials you use for `/blog-admin/`.

## First-time setup (one-time)

Before the Functions can save photos, **Firebase Storage must be enabled in
the Firebase Console** for project `proven-concept-436717-q3`. Photos go to
the bucket `proven-concept-436717-q3.firebasestorage.app` (the new-style
Firebase Storage bucket) — this name is pinned explicitly in
`polyvote/functions/src/inventory/photos.ts` and in the client config so
the SPA and the Cloud Functions stay in lock-step.

## Project layout

```
src/
├── main.tsx              # BrowserRouter basename="/inventory"
├── App.tsx               # Routes + Firebase auth state wiring
├── firebase.ts           # Firebase init + every Cloud Function callable
├── store.ts              # Zustand (auth, folders, items, toasts)
├── types.ts              # TypeScript interfaces, mirrors functions/src/inventory/shared.ts
├── ebay.ts               # eBay condition IDs, format/duration options
├── index.css             # Tailwind import + theme variables
└── pages/
    ├── Login.tsx
    ├── Dashboard.tsx
    ├── FolderTable.tsx
    ├── SchemaEditor.tsx
    ├── ItemEditor.tsx
    └── EbayExport.tsx
```
