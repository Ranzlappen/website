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
8. [Platforms & export](#platforms--export)
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
  platformTags: string[];             // selling platforms this folder targets
                                      // (e.g. ["ebay","amazon"]); drives which
                                      // columns are generated + the badges
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
  platforms: string[];                // platform tag ids this column serves
                                      // (drives the header badges); [] = custom
  order: number;
}
```

A new folder's schema is generated from its `platformTags` (the union of
every tag's required canonical columns). An untagged folder gets a small
canonical core (Title, SKU, Price, Quantity, Description, Condition).
Applying a tag later generates its columns; stripping a tag keeps the columns
and their data — only the badges disappear. See **Platforms & export**.

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

`inventoryListDriveFolder` is **not** auto-deployed by
`firebase-deploy.yml` — it declares `GOOGLE_DRIVE_API_KEY` via
`defineSecret()`, and Firebase refuses to deploy a function whose
secret isn't set when running non-interactively in CI. Until you've
finished the setup below, every other function deploys normally; only
the Drive folder picker is unavailable.

1. In the same Google Cloud project that backs Firebase
   (`proven-concept-436717-q3`), enable the **Drive API** at
   `https://console.cloud.google.com/apis/library/drive.googleapis.com`.
2. Create an API key (Console → APIs & Services → Credentials → Create
   credentials → API key). Restrict it to the Drive API only.
3. From `polyvote/`, authenticated via `firebase login`, store the key
   as a Functions secret:
   ```
   firebase functions:secrets:set GOOGLE_DRIVE_API_KEY
   ```
   Paste the key value when prompted. (Or pipe it in:
   `printf '%s' YOUR_KEY | firebase functions:secrets:set GOOGLE_DRIVE_API_KEY --data-file -`)
4. Deploy the function so the secret is bound:
   ```
   firebase deploy --only functions:inventoryListDriveFolder
   ```
   Alternative: trigger `firebase-deploy-manual.yml` via
   `workflow_dispatch` with target
   `functions:inventoryListDriveFolder`. The CI service account has
   permission to read the secret you just stored.
5. Share each source folder as **Anyone with the link → Viewer** in
   Google Drive before using the picker.

The API key + the public share are enough; the function never sees a
user's Google credentials. The last-used folder URL is remembered in
`localStorage` so subsequent opens prefill it.

**Rotating the key:** repeat step 3 (the secret-set command creates a
new version), then redeploy the function so it picks up the new version
on cold start. Old versions can be cleaned up via
`firebase functions:secrets:prune`.

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

## Platforms & export

The tool exports to eight selling platforms. The single source of truth is the
**platform registry**, duplicated (data-only on the frontend) between:

- `polyvote/functions/src/inventory/platforms.ts` — canonical fields, every
  platform's exact column names, required flags, supported formats, **and the
  value-transform functions + CSV delimiter** the serializers use.
- `inventory-manager/src/platforms.ts` — the same data minus transforms (the
  browser never serializes), plus the schema helpers the UI shares.

### Canonical fields ↔ per-platform columns

One **canonical** field (e.g. `price`) maps to a *different exact column name
per platform's file* (`*StartPrice` on eBay, `standard_price` on Amazon,
`price` on Facebook/idealo/billiger…). `platformsForField(key)` powers the ⓘ
info button next to each column that lists every platform's exact name.

A folder's `platformTags` decide which canonical columns it needs
(`fieldsForTags` / `ensureTagColumns`). Adding a tag generates its required
columns and stamps the tag into each column's `platforms[]` (the color-coded
header badges). Stripping a tag is non-destructive: `ensureTagColumns` keeps
the columns + item data and just drops the tag from `platforms[]`.

### Per-field syntax help (the ⓔ button)

Next to the ⓘ column-name popover sits an **ⓔ "explain"** button
(`components/FieldHelpButton.tsx`) that opens a modal documenting the required
**syntax/format and allowed values per platform** for that field — e.g. the
`category` field explains eBay's numeric leaf-category ID, Facebook's Google
product taxonomy, idealo's `categoryPath`, etc. It also appears next to the
eBay-only Export-sidebar inputs (Category ID, Condition ID, Format, Duration)
via synthetic keys `ebay-category` / `ebay-condition` / `ebay-format` /
`ebay-duration`.

The prose lives in `src/platformHelp.ts` (`PLATFORM_FIELD_HELP` keyed
`fieldKey → platformId`, plus `FIELD_HELP_INTRO` and the eBay-listing entries).
`fieldHelpSections(fieldKey)` merges that prose with the live registry
(`platformsForField`, `PLATFORM_BY_ID`) and the `ebay.ts` enums, so column
names, required flags, and the eBay dropdown values never drift. **To extend
it:** add/edit an entry under `PLATFORM_FIELD_HELP[field][platform]` — a missing
entry falls back to a generic "exported as-is" note, so partial coverage is
safe.

### Platforms, formats & quirks

| Platform | Formats | Notes |
|---|---|---|
| eBay | CSV / Tab | File Exchange; asterisk headers (`*Title`…), numeric `*ConditionID`, `PicURL` pipe-joined, `C:` item-specifics, `Country=DE`/`Currency=EUR`. |
| Amazon | Tab (`.txt`) | Category flat-file tokens (`item_name`, `standard_price`, `condition_type`…), `external_product_id_type=EAN`. |
| Kleinanzeigen | CSV / OpenImmo XML | ⚠ No official general product CSV — CSV tokens are best-effort, `price` integer; XML is a minimal real-estate OpenImmo skeleton. |
| Whatnot | CSV | `Category`/`Sub Category`/`Title`/…/`Image URL 1..8`. |
| Facebook | CSV / XML (RSS) | Meta catalog feed; `price` `"<n> EUR"`, `condition` new/used/refurbished; XML is RSS 2.0 with the `g:` namespace. |
| idealo | CSV / XML | `eans`/`hans`(MPN)/`imageUrls`; `.` decimal, `;` list-separator. |
| billiger.de | CSV / XML | solute schema (`aid`, `GTIN`, `dlv_cost`…). |
| Geizhals | CSV (`;`) / XML | No fixed column names — we pick our own headers. |

Output format is chosen per platform in the export dialog (a CSV/XML toggle
appears for platforms offering both; the registry flags a default). XML is
hand-built in `xml.ts` (no dependency, mirrors `csv.ts`).

### Export flow

`inventoryExportPlatforms({ folderId?, itemIds?, scope, selections: [{platform, format}] })`
returns `{ files: [{platform, filename, body, fileExt}], blocked, skipped }`.
Only items whose folder carries a platform's tag feed that platform's file;
items missing that platform's required columns are skipped and reported in
`blocked` (a partial export still succeeds). The client downloads a single
file directly, or zips 2+ with **JSZip** into `inventory-export-<date>.zip`.

`ebay.syncEnabled` is the per-item **"Include in exports"** opt-in (the table
checkbox / bulk bar). The eBay file still stamps `listingStatus → exported`
and `lastExportedAt` on the items it contains; the `none → ready → exported →
listed → ended` lifecycle + `categoryId`/`conditionId`/`format`/`duration`
overrides remain eBay-specific (ItemEditor shows them only when the folder has
the `ebay` tag).

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
- **Platform CSV** (round-trip from `inventoryExportPlatforms`): pick a
  platform; header cells are matched against that platform's exact column
  names via the registry (`column → canonical field`), honoring the
  platform's delimiter (e.g. Geizhals `;`). Columns with no canonical target
  (computed/constant/photo columns) are ignored.

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

A field's per-platform export column names aren't stored on the field — they
live in the platform registry, keyed by the field's canonical `key`. The
schema editor's ⓘ button (next to each column's platform badges) shows every
platform's exact column name for that field.

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

### Add a new platform (or canonical field)

Everything lives in the **registry** (`platforms.ts`, both copies):

1. **New canonical field**: add it to `CANONICAL_FIELDS` (key/label/type/
   options) in both copies. Reference it from a platform's `columns`.
2. **New platform**: add an entry to `PLATFORM_IDS` + `PLATFORMS` in both
   copies — `id`, `name`, `badge` (Tailwind classes), `formats` (CSV/TSV/XML
   with delimiter or `dialect`), and `columns` (`{ field, column, xmlTag?,
   required }`). On the backend add any `transform` / `constants`. If it needs
   a new XML envelope, add a `dialect` branch in `xml.ts`.
3. Tests in `__tests__/platforms.test.ts` + `platformExport.test.ts`.

No schema migration is needed — `ensureTagColumns` generates the columns the
first time the tag is applied to a folder.

---

## File map

### SPA — `inventory-manager/src/`

```
main.tsx                # BrowserRouter basename="/inventory"
App.tsx                 # Route table + onAuthStateChanged → store
firebase.ts             # Firebase init + every httpsCallable wrapper
store.ts                # Zustand (auth + folders + items + selection + toasts); normalizes legacy folders
types.ts                # FieldDef, FolderDoc, ItemDoc, FIELD_TYPES
platforms.ts            # platform registry (data-only mirror) + schema/overlap helpers
ebay.ts                 # EBAY_CONDITION_IDS, EBAY_DURATIONS, EBAY_FORMATS
platformHelp.ts         # per-field × per-platform syntax/format guidance (the ⓔ button doc) + fieldHelpSections()
fieldFormat.ts          # formatFieldValue(def, value): read-only display text for table cells
index.css               # Tailwind import + CSS custom properties for the dark theme
components/
  AdminGuard.tsx        # blocks non-admin routes
  Toast.tsx             # bottom-right toast stack
  Header.tsx            # nav bar (Inventory, Export, sign out)
  FieldInput.tsx        # one component per FieldType, incl. EAN+Scan
  BarcodeScanner.tsx    # camera modal, BarcodeDetector loop
  PhotoGrid.tsx         # drag-to-reorder, drop-to-upload, delete
  PlatformBadges.tsx    # color-coded platform badges + per-column exact-name info popover + ⓔ help button
  FieldHelpButton.tsx   # ⓔ "explain" button: modal with per-platform syntax/format/args (reads platformHelp.ts)
  PlatformTagSelector.tsx # toggle chips for a folder's platform tags
  ImportDialog.tsx      # CSV/JSON/Platform-CSV paste-or-file, dry-run preview, commit
  ExportDialog.tsx      # platform checkboxes + CSV/XML toggle; JSZip-zips 2+ files
  ConfirmDialog.tsx     # reusable yes/no modal; awaits async onConfirm, stays open + spins until resolved
  Spinner.tsx           # inline currentColor SVG spinner (animate-spin); shown on every in-flight DB-action button
  EditableCell.tsx      # click-to-edit table cell; reuses FieldInput, commits on Enter/blur (Esc cancels)
pages/
  Login.tsx
  Dashboard.tsx         # folder tree + create (with platform tags)/rename/duplicate dialogs
  FolderTable.tsx       # item table for one folder; renders the full fieldSchema with inline-editable cells; header platform badges; Export… dialog
  SchemaEditor.tsx      # per-folder platform tags + fieldSchema editor
  ItemEditor.tsx        # full item form + photo grid + per-tag readiness + eBay sidebar; auto-saves
  ExportCenter.tsx      # cross-folder /export: per-platform ready/blocked tally + Export… dialog
```

### Cloud Functions — `polyvote/functions/src/inventory/`

```
shared.ts               # FieldDef/ItemDoc types, validateFieldSchema/validateItemFields,
                        # defaultEbayBlock, appendAudit
platforms.ts            # platform registry: canonical fields, per-platform exact columns +
                        # required + transforms + formats; fieldsForTags/ensureTagColumns/
                        # platformsForField/missingForPlatform
folders.ts              # inventoryListFolders / Create / Update / Delete / DuplicateFolder
                        # (Create/Update accept platformTags → ensureTagColumns)
items.ts                # inventoryListItems / GetItem / CreateItem / UpdateItem /
                        # DeleteItem / ToggleEbaySync (export inclusion; no per-field gating)
photos.ts               # inventoryUploadPhoto / DeletePhoto / ReorderPhotos
                        # (uses INVENTORY_BUCKET constant for the firebasestorage.app bucket)
importExport.ts         # inventoryImport (CSV+JSON+platform-csv, dry-run) / inventoryExport
platformExport.ts       # inventoryExportPlatforms + buildPlatformFile (CSV/TSV/XML per platform)
csv.ts                  # RFC-4180-ish parseCsv / serializeCsv / escapeCsvCell (delimiter-aware)
xml.ts                  # escapeXml / serializeXml (rss-google / solute / openimmo / flat …)
__tests__/
  csv.test.ts
  shared.test.ts
  platforms.test.ts
  platformExport.test.ts
  xml.test.ts
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
