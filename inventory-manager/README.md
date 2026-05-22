# Inventory Manager

Admin-only React/Vite SPA for managing inventory with photo attachments,
custom per-folder field schemas, CSV/JSON import-export, and eBay File
Exchange CSV export. Served at
`https://www.ranzlappen.com/inventory/`, gated by Firebase Auth admin
role (same login as Blog Admin), hidden from search engines.

This README is the **architecture handbook** for the module — start here
to understand how data flows, where things live, and how to extend the
tool.

---

## Table of contents

1. [Stack](#stack)
2. [Local development](#local-development)
3. [Authentication](#authentication)
4. [Data model](#data-model)
5. [Photo storage](#photo-storage)
6. [Persistence guarantees](#persistence-guarantees)
7. [Security](#security)
8. [eBay export](#ebay-export)
9. [Import / export](#import--export)
10. [Field types](#field-types)
11. [Barcode scanner (EAN field)](#barcode-scanner-ean-field)
12. [Extending the tool](#extending-the-tool)
13. [File map](#file-map)

---

## Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`, no separate config) |
| Routing | `react-router-dom` v7 with `basename="/inventory"` |
| State | Zustand (single store; auth + folders + items + selection + toasts) |
| Backend | Firebase: Auth (admin role), Firestore (data), Storage (photos), Cloud Functions (every write) |
| Lint | ESLint flat config |

The whole module is independent of `polyvote/` and `blog-admin/` — no
cross-imports. Logic shared with Cloud Functions (e.g. the field-schema
types) is **duplicated intentionally** between
`inventory-manager/src/types.ts` and
`polyvote/functions/src/inventory/shared.ts`, per the repo-wide
module-boundary convention in `CLAUDE.md`.

---

## Local development

```bash
cd inventory-manager
npm install
npm run dev      # http://localhost:5173 → redirects to /login
npm run lint
npm run build
```

Sign in with the same Firebase Auth account you use for
`/blog-admin/`. The user must have `role: 'admin'` set as a custom
claim. If you don't have one yet, set it via the
[`setUserRole`](../polyvote/functions/src/auth/claims.ts) callable or
the Users panel inside Blog Admin.

### One-time Firebase setup

Firebase Storage **must be enabled** in the Firebase Console for project
`proven-concept-436717-q3`. Photos go to the new-style bucket
`proven-concept-436717-q3.firebasestorage.app` (not the legacy
`.appspot.com`). The bucket name is pinned explicitly in both the SPA
(`src/firebase.ts:storageBucket`) and the Cloud Functions
(`polyvote/functions/src/inventory/photos.ts:INVENTORY_BUCKET` +
`folders.ts:INVENTORY_BUCKET`) so we never depend on whichever bucket
the Admin SDK picks as the default.

---

## Authentication

Standard Firebase email/password sign-in (`signInWithEmailAndPassword`).
On auth state change, `App.tsx` reads the user's ID token, extracts the
`role` custom claim, and writes it into the Zustand store. `AdminGuard`
blocks every protected route when `role !== 'admin'`.

Server side, every callable starts with
`requireRole(request, "admin")` from
[`polyvote/functions/src/utils/adminOnly.ts`](../polyvote/functions/src/utils/adminOnly.ts).
A non-admin token gets `HttpsError("permission-denied", ...)` before any
work runs.

---

## Data model

Three Firestore collections, all admin-read-only from the client, all
writes via Cloud Functions only.

### `inventoryFolders/{folderId}`

```ts
{
  name: string;                       // human-readable folder name
  parentFolderId: string | null;      // null at the root
  pathSegments: string[];             // denormalized breadcrumb (max depth 6)
  fieldSchema: FieldDef[];            // custom columns for this folder's items
  itemCount: number;                  // maintained by functions
  createdAt: number;                  // ms epoch
  updatedAt: number;
  createdBy: string;                  // uid
  deletedAt: number | null;           // soft delete
}

type FieldDef = {
  key: string;                        // snake_case, used as the field map key
  label: string;                      // display name
  type: 'text' | 'longtext' | 'number' | 'select' | 'boolean'
      | 'date' | 'url' | 'ean';
  options?: string[];                 // for type=select
  required: boolean;                  // required to save an item
  ebayRequired: boolean;              // required to enable ebay.syncEnabled
  ebayMapping?: string | null;        // maps this field to an eBay CSV column
  order: number;
}
```

Every new folder is seeded with a base schema (Title, Description, SKU,
Price, Quantity, Condition) so the eBay export works without any setup.

### `inventoryItems/{itemId}`

```ts
{
  folderId: string;                   // indexed
  fields: Record<string, unknown>;    // keyed by FieldDef.key
  photos: PhotoRef[];                 // ordered; photos[0] is primary
  eanCodes: string[];                 // denormalized list of every ean-typed
                                      // value on the item; used by the
                                      // scan-to-find flow for a single
                                      // array-contains query across folders.
                                      // Maintained server-side by
                                      // extractEanCodes(fields, schema) on
                                      // every write path.
  ebay: {
    syncEnabled: boolean;             // the per-row checkbox
    listingStatus: 'none' | 'ready' | 'exported' | 'listed' | 'ended' | 'error';
    listingId: string | null;         // populated once real Sell API ships
    lastExportedAt: number | null;
    lastError: string | null;
    categoryId: string | null;        // eBay category number
    conditionId: number | null;       // 1000=New, 3000=Used, etc.
    format: 'FixedPriceItem' | 'Auction';
    duration: string;                 // GTC / Days_7 / etc.
  };
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  deletedAt: number | null;
}

type PhotoRef = {
  storagePath: string;                // inventory/{itemId}/{uuid}.{ext}
  downloadUrl: string;                // public CDN URL — eBay PicURL-compatible
  filename: string;                   // original upload filename
  sizeBytes: number;
  width: number;
  height: number;
  order: number;                      // 0 = primary
}
```

### `inventoryAuditLog/{logId}`

Append-only ledger of every mutation: `{ action, actorUid, itemId?,
folderId?, before?, after?, timestamp }`. Admin-only read; the only way
to reconstruct what happened after a soft delete.

### Indexes

Composite indexes are declared in
[`polyvote/firestore.indexes.json`](../polyvote/firestore.indexes.json):

- `inventoryFolders(parentFolderId, deletedAt)` — tree render
- `inventoryFolders(deletedAt, name)` — list-all-folders sort
- `inventoryItems(folderId, deletedAt, updatedAt DESC)` — folder table view
- `inventoryItems(deletedAt, ebay.syncEnabled, updatedAt DESC)` — eBay export stage
- `inventoryItems(folderId, deletedAt, ebay.syncEnabled, updatedAt DESC)` — folder-scoped eBay stage

---

## Import a photo from a URL

Click **+ From URL** in the photo grid to fetch an image from any public
HTTPS URL — Google Drive share links, plain image URLs, anywhere with
a `Content-Type: image/(webp|png|jpeg)` response. The Cloud Function
`inventoryImportPhotoFromUrl` does the fetch server-side, validates the
mime type and 10MB size cap, then stores the bytes in our Storage
bucket like a normal upload.

Drive URLs are normalized to the public direct-download endpoint
`https://drive.google.com/uc?export=download&id=<id>`, so:

- The file must be shared as **Anyone with the link → Viewer**.
- These URL shapes work: `/file/d/<id>/view`, `/open?id=<id>`,
  `/uc?id=<id>`, or a raw 25-44-char Drive id.

For arbitrary HTTPS URLs we fetch them unchanged. CORS doesn't apply
because the fetch happens server-side.

## Browse a Google Drive folder

The **+ From Drive** button opens a thumbnail picker for any publicly-
shared Drive folder. Paste the folder share URL, tick the photos you
want, click Import — each selection runs through the same
`inventoryImportPhotoFromUrl` path so the files land in our Storage
bucket like a normal upload.

### One-time setup

1. In the same Google Cloud project that backs Firebase
   (`proven-concept-436717-q3`), enable the **Drive API** at
   `https://console.cloud.google.com/apis/library/drive.googleapis.com`.
2. Create an API key (Console → APIs & Services → Credentials → Create
   credentials → API key). For safety, restrict it to the Drive API
   only and to your project's referrers.
3. From `polyvote/`, store it as a Functions secret:
   `firebase functions:secrets:set GOOGLE_DRIVE_API_KEY`
4. Re-deploy `inventoryListDriveFolder` so the secret is picked up:
   `firebase deploy --only functions:inventoryListDriveFolder`
5. Whenever you want to use the picker, share the source folder as
   **Anyone with the link → Viewer**.

The API key + the public share are enough; the function never sees a
user's Google credentials. The last-used folder URL is remembered in
`localStorage` so subsequent opens prefill it.

## Photo storage

| Item | Value |
|---|---|
| Bucket | `proven-concept-436717-q3.firebasestorage.app` |
| Path | `inventory/{itemId}/{uuid}.{webp\|png\|jpg\|jpeg}` |
| Visibility | public-read (Storage rules deny client writes, allow all reads) |
| Public URL | `https://storage.googleapis.com/<bucket>/<path>` |
| Size limit | 10 MB per file, max 24 photos per item (eBay limit) |

Why public? eBay's File Exchange `PicURL` column needs URLs that eBay's
crawler can fetch without auth. Signed URLs would work too, but expire;
public objects are simpler and the bucket scope is admin-only by
convention.

Uploads only happen via the `inventoryUploadPhoto` Cloud Function — the
Admin SDK bypasses Storage rules. The client never touches Storage
directly for writes.

When duplicating a folder with the "Also copy items" option, every
photo is physically copied to a fresh path under the new item's id so
the two folders are fully isolated; deleting a photo from one never
affects the other.

---

## Persistence guarantees

The user explicitly asked for persistence to be paramount, so the
design ladders up:

1. **Every mutation is a `httpsCallable` round-trip.** No
   optimistic-only UI state that can be lost on a closed tab. If the
   network call fails, a toast surfaces it.
2. **ItemEditor auto-saves** every 2.5 s while dirty, plus on unmount
   (best-effort). You can also hit "Save now". Auto-save kicks in only
   *after* the initial create round-trip so we don't fire half-built
   items.
3. **Soft delete everywhere.** Folders and items get `deletedAt = now`
   rather than being removed. The Trash page (`/trash`) lists every
   soft-deleted record with a Restore button. A scheduled Cloud Function
   `inventoryPurgeDeleted` runs daily and hard-deletes anything older than
   30 days, including its photo objects in Storage.
4. **Audit log per mutation.** `inventoryAuditLog` records who did what
   and when, including the `before`/`after` payload on edits. That's
   the recovery path when soft-delete isn't enough.
5. **Schema changes are non-destructive.** Removing a key from a
   folder's `fieldSchema` does **not** strip values from existing items
   — the data hangs around in Firestore, just stops appearing in the
   table view. Re-add the key and the values come back.
6. **CSV import is idempotent on SKU.** Re-importing the same CSV
   updates existing items rather than creating duplicates, when the
   folder schema contains a `sku` field.

---

## Security

- **Firestore rules** (`polyvote/firestore.rules`) for
  `inventoryFolders`, `inventoryItems`, `inventoryAuditLog`:
  `read: if isAdmin()`, `create, update, delete: if false`.
- **Storage rules** (`polyvote/storage.rules`) for `inventory/...`:
  `read: if true`, `write: if false`.
- **Callables**: every Cloud Function starts with
  `requireRole(request, "admin")`. Non-admin tokens are rejected
  before any work.
- **Server-side input validation**: each callable trims, type-coerces,
  and rejects bad input with `HttpsError("invalid-argument", ...)`.
  The client cannot smuggle in a field type that wasn't declared in
  the folder schema — `validateItemFields` ignores unknown keys.
- **Storage write hardening**: extension whitelist (`.webp/.png/.jpg/
  .jpeg`), 10 MB cap, and `storagePath` on delete must start with the
  expected `inventory/{itemId}/` prefix to defeat client-supplied
  arbitrary paths.

---

## eBay export

Generates an [eBay File Exchange](https://www.ebay.com/help/selling/listings/creating-managing-listings/uploading-listings-file-exchange?id=4116)
CSV that you upload manually to Seller Hub. No OAuth, no live API — by
design, the same checkbox + status fields will feed the real Sell API
when that ships later.

### Lifecycle

```
none → ready → exported → listed → ended
              (toggle)   (CSV     (manual,
                         download) future API)
```

- **none** — default; item is not in the eBay queue.
- **ready** — `syncEnabled = true` and every eBay-required field is
  populated. Validated server-side; toggling on with missing fields is
  rejected.
- **exported** — was included in a CSV download. `lastExportedAt` is
  stamped.
- **listed** — to be set once the real Sell API integration ships.
- **ended** — listing concluded.
- **error** — last sync attempt failed; check `lastError`.

### CSV columns

Always emitted: `Action, Title, Description, Category, ConditionID,
StartPrice, Quantity, CustomLabel, Format, Duration,
ShippingProfileName, ReturnProfileName, PaymentProfileName, PicURL,
Country, Currency`.

Plus one `C:<mapping>` column for each schema field whose
`ebayMapping` is something other than a core eBay field — those become
[eBay item specifics](https://www.ebay.com/help/selling/listings/categorizing-your-items/item-specifics?id=4118).

`Action` is `Add` for items without a `listingId`, `Revise` once one
exists. `PicURL` is a `|`-separated list of public photo URLs.

---

## Import / export

### Export
- **CSV (full)** — header row of `id, <field keys…>, ebay_sync,
  photos`; one row per non-deleted item. `photos` is pipe-separated
  download URLs.
- **JSON (full)** — `{ folder: { id, name, fieldSchema }, items: [...] }`
  with complete item documents.

### Import
Accepts three formats:

- **CSV**: header row must match field `key` or `label`
  case-insensitively. Unknown columns are silently ignored.
- **JSON**: either a raw array of items or `{ items: [...] }`. Each
  item can be `{ fields: {...} }` or a flat record (auto-wrapped).
- **eBay CSV** (round-trip from `inventoryExportEbayCsv`): header cells
  match against each field's `ebayMapping` rather than its key/label.
  Core columns (Title, Description, StartPrice, CustomLabel, …) and
  custom `C:<label>` item-specifics both work. PicURL / Action /
  Country / Currency / Format / Duration are ignored since they have
  no schema target.

Both formats run a **dry-run** first (`Preview` button), which reports
`toCreate`, `toUpdate` (matched by SKU), and `skipped` (with the
reason per row). Commit only after reviewing the preview.

`fields.sku` is the idempotency key. Without it, every import is a
pure create.

---

## Field types

| Type | Renders as | Notes |
|---|---|---|
| `text` | single-line input | trimmed |
| `longtext` | textarea | trimmed |
| `number` | numeric input | coerced from string; rejects non-numeric |
| `select` | dropdown | requires `options[]`; rejects values outside |
| `boolean` | checkbox | accepts true/false/"true"/"1"/1 |
| `date` | date picker | YYYY-MM-DD only |
| `url` | URL input | trimmed |
| `ean` | text + **Scan** button | 8/12/13/14 digits; whitespace stripped before validation. See next section. |

Any field type can be mapped to an eBay CSV column via
`FieldDef.ebayMapping`. Pick from the dropdown of core columns or type
a custom item-specific name (becomes `C:<name>` in the CSV).

---

## Barcode scanner (EAN field)

The `ean` field type renders an input next to a **Scan** button. Tap
Scan and the browser opens the rear camera (modal overlay) and uses
the native
[`BarcodeDetector`](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)
API to find a barcode in the video stream. On detect, the digits flow
straight into the field and the scanner closes.

**Supported formats**: `ean_13`, `ean_8`, `upc_a`, `upc_e`, `itf`,
`code_128`.

**Browser support**: Chrome on Android, Chrome desktop, Edge, Safari on
iOS 17+. Firefox lacks `BarcodeDetector` — the scanner falls back to a
clear "not supported" message and you can type the code manually. No
JS dependency is added; the API is built into the browser.

**Permissions**: the browser prompts for camera access on first use.
The scanner stops the video stream on detect, on cancel, and on
unmount — the camera light goes off when you close the modal.

---

## Extending the tool

### Add a new field type

1. Backend — `polyvote/functions/src/inventory/shared.ts`:
   - Add the type to the `FieldType` union and `VALID_FIELD_TYPES`.
   - Add a `case` in `validateItemFields` that coerces/validates the
     input and throws `HttpsError("invalid-argument", ...)` on bad
     input.
2. Frontend — `inventory-manager/src/types.ts`: add the same value to
   the `FieldType` union and add an entry to `FIELD_TYPES` so it
   shows up in the schema editor.
3. Frontend — `inventory-manager/src/components/FieldInput.tsx`: add
   a `case` that renders the appropriate input control.
4. Tests — `polyvote/functions/src/inventory/__tests__/shared.test.ts`:
   add positive and negative validation tests.

### Add a new Cloud Function

1. Write it under `polyvote/functions/src/inventory/<file>.ts`,
   starting with `requireRole(request, "admin")`.
2. Export it from `polyvote/functions/src/index.ts`.
3. Add a typed `httpsCallable` wrapper to
   `inventory-manager/src/firebase.ts`.
4. Add `functions:<name>` to the `TARGETS` list in
   [`.github/workflows/firebase-deploy.yml`](../.github/workflows/firebase-deploy.yml).
5. If the function adds a new Firestore query shape, add the matching
   composite index to `polyvote/firestore.indexes.json`.

### Add a new eBay-mappable column

The `EBAY_MAPPING_OPTIONS` array in
`inventory-manager/src/types.ts` drives the schema editor's mapping
dropdown. For "real" eBay core columns, add the column name there
*and* to `EBAY_CORE_FIELDS` in
`polyvote/functions/src/inventory/shared.ts`. Anything not in
`EBAY_CORE_FIELDS` is emitted as a `C:<label>` item-specific.

---

## File map

### SPA — `inventory-manager/src/`

```
main.tsx                # BrowserRouter basename="/inventory"
App.tsx                 # Route table + onAuthStateChanged → store
firebase.ts             # Firebase init + every httpsCallable wrapper
store.ts                # Zustand (auth + folders + items + selection + toasts)
types.ts                # FieldDef, FolderDoc, ItemDoc, FIELD_TYPES, EBAY_MAPPING_OPTIONS
ebay.ts                 # EBAY_CONDITION_IDS, EBAY_DURATIONS, EBAY_FORMATS
index.css               # Tailwind import + CSS custom properties for the dark theme
components/
  AdminGuard.tsx        # blocks non-admin routes
  Toast.tsx             # bottom-right toast stack
  Header.tsx            # nav bar (Inventory, eBay export, sign out)
  FieldInput.tsx        # one component per FieldType, incl. EAN+Scan
  BarcodeScanner.tsx    # camera modal, BarcodeDetector loop
  PhotoGrid.tsx         # drag-to-reorder, drop-to-upload, delete
  ImportDialog.tsx      # CSV/JSON paste-or-file, dry-run preview, commit
  ConfirmDialog.tsx     # reusable yes/no modal
pages/
  Login.tsx
  Dashboard.tsx         # folder tree + always-visible action icons + create/rename/duplicate dialogs
  FolderTable.tsx       # item table for one folder + action bar (schema, duplicate, delete, import, export, +new)
  SchemaEditor.tsx      # per-folder fieldSchema editor; cards-on-mobile, grid-on-lg
  ItemEditor.tsx        # full item form + photo grid + eBay sidebar; auto-saves every 2.5s
  EbayExport.tsx        # cross-folder staged view of all syncEnabled items + CSV download
```

### Cloud Functions — `polyvote/functions/src/inventory/`

```
shared.ts               # FieldDef/ItemDoc types, validateFieldSchema/validateItemFields,
                        # defaultFieldSchema, defaultEbayBlock, appendAudit
folders.ts              # inventoryListFolders / Create / Update / Delete / DuplicateFolder
items.ts                # inventoryListItems / GetItem / CreateItem / UpdateItem /
                        # DeleteItem / ToggleEbaySync
photos.ts               # inventoryUploadPhoto / DeletePhoto / ReorderPhotos
                        # (uses INVENTORY_BUCKET constant for the firebasestorage.app bucket)
importExport.ts         # inventoryImport (CSV+JSON, dry-run) / inventoryExport
ebayExport.ts           # inventoryExportEbayCsv (File Exchange format, C:* item-specifics)
csv.ts                  # RFC-4180-ish parseCsv / serializeCsv / escapeCsvCell
__tests__/
  csv.test.ts
  shared.test.ts
  ebayExport.test.ts
```

### Firebase / rules / workflows

```
polyvote/firestore.rules        # admin-only reads on inventory* collections, no client writes
polyvote/firestore.indexes.json # composite indexes for inventory queries
polyvote/storage.rules          # inventory/* public-read, no client writes
polyvote/firebase.json          # registers firestore + database + storage + functions
.github/workflows/firebase-deploy.yml   # deploys rules + functions:inventory*
.github/workflows/jekyll-gh-pages.yml   # builds inventory-manager/, copies dist → _site/inventory/
.github/workflows/ci.yml                # path-filtered lint+build job for inventory-manager
```

---

## Out of scope (today)

These would be useful follow-ups, but aren't built yet:

- **Real eBay Sell API** — still File Exchange CSV. The data model and
  `listingStatus` field already accommodate a real integration; only
  the export code path needs swapping.
- **Folder drag-to-move** — you can change a folder's parent via the
  `inventoryUpdateFolder` callable, but there's no drag-and-drop UX
  yet.
- **Bulk schema operations** across multiple folders.
- **EAN-based item lookup** — scanning could find an existing item by
  EAN instead of just filling a field, which would let you scan to
  "edit this item" rather than "type the number".
