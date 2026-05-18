import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";
import { serializeCsv } from "./csv";
import {
  appendAudit,
  EBAY_CORE_FIELDS,
  missingEbayRequiredFields,
  type FieldDef,
  type FolderDoc,
  type ItemDoc,
} from "./shared";

/**
 * Build the eBay File Exchange CSV body from a list of items + their
 * folder schemas. The format closely follows eBay's documented "Add"
 * action with Fixed Price listings. Custom item specifics are emitted as
 * `C:<label>` columns per eBay's convention.
 *
 * The function does not contact eBay — the user uploads the CSV to
 * Seller Hub manually. When the real Sell API ships later, the same item
 * selection will feed it directly.
 */
export function buildEbayCsv(
  items: { id: string; data: ItemDoc }[],
  schemaByFolder: Map<string, FieldDef[]>
): { csv: string; rowCount: number; columns: string[] } {
  // Determine columns: union of all eBay-mapped fields across involved folders,
  // plus a fixed set of always-emitted columns.
  const customLabelKey = "CustomLabel";
  const baseColumns = ["Action", ...EBAY_CORE_FIELDS, "PicURL", "Country", "Currency"];
  const customSpecifics = new Set<string>();

  for (const item of items) {
    const schema = schemaByFolder.get(item.data.folderId) ?? [];
    for (const f of schema) {
      if (!f.ebayMapping) continue;
      const isCore = (EBAY_CORE_FIELDS as readonly string[]).includes(f.ebayMapping);
      if (!isCore) customSpecifics.add(f.ebayMapping);
    }
  }

  const columns = [...baseColumns, ...Array.from(customSpecifics).map((s) => `C:${s}`)];

  const rows: (string | number | null)[][] = [columns];
  for (const { id, data: item } of items) {
    const schema = schemaByFolder.get(item.folderId) ?? [];
    const cell = (col: string): string | number => {
      // PicURL: pipe-separated public photo URLs.
      if (col === "PicURL") {
        return (item.photos ?? []).map((p) => p.downloadUrl).join("|");
      }
      if (col === "Country") return "DE";
      if (col === "Currency") return "EUR";
      if (col === "Action") return item.ebay.listingId ? "Revise" : "Add";

      // Map: which schema field maps to this column?
      const isCustom = col.startsWith("C:");
      const mapping = isCustom ? col.slice(2) : col;
      const def = schema.find((f) => f.ebayMapping === mapping);
      if (!def) {
        // Fall back to ebay block for a couple of fixed columns.
        if (col === "Format") return item.ebay.format ?? "FixedPriceItem";
        if (col === "Duration") return item.ebay.duration ?? "GTC";
        if (col === "Category") return item.ebay.categoryId ?? "";
        if (col === "ConditionID") return item.ebay.conditionId ?? "";
        if (col === customLabelKey) return id; // fallback CustomLabel to doc id
        return "";
      }
      const v = item.fields?.[def.key];
      return v === undefined || v === null ? "" : (v as string | number);
    };

    rows.push(columns.map(cell));
  }

  return { csv: serializeCsv(rows), rowCount: items.length, columns };
}

export const inventoryExportEbayCsv = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { folderId, itemIds } = request.data as {
    folderId?: string;
    itemIds?: string[];
  };

  // Resolve which items to export.
  let items: { id: string; data: ItemDoc }[] = [];
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    if (itemIds.length > 500) {
      throw new HttpsError("invalid-argument", "Cannot export more than 500 items at once.");
    }
    const docs = await Promise.all(
      itemIds.map((id) => db.collection("inventoryItems").doc(id).get())
    );
    items = docs
      .filter((d) => d.exists)
      .map((d) => ({ id: d.id, data: d.data() as ItemDoc }))
      .filter((d) => !d.data.deletedAt && d.data.ebay.syncEnabled);
  } else {
    let q: FirebaseFirestore.Query = db
      .collection("inventoryItems")
      .where("deletedAt", "==", null)
      .where("ebay.syncEnabled", "==", true);
    if (folderId) q = q.where("folderId", "==", folderId);
    const snap = await q.limit(500).get();
    items = snap.docs.map((d) => ({ id: d.id, data: d.data() as ItemDoc }));
  }

  if (items.length === 0) {
    throw new HttpsError("failed-precondition", "No items to export.");
  }

  // Load all involved folder schemas in one shot.
  const folderIds = Array.from(new Set(items.map((i) => i.data.folderId)));
  const schemaByFolder = new Map<string, FieldDef[]>();
  await Promise.all(
    folderIds.map(async (fid) => {
      const f = await db.collection("inventoryFolders").doc(fid).get();
      if (f.exists) {
        schemaByFolder.set(fid, (f.data() as FolderDoc).fieldSchema);
      }
    })
  );

  // Validate every item has all eBay-required fields populated.
  const failures: { id: string; missing: string[] }[] = [];
  for (const { id, data } of items) {
    const missing = missingEbayRequiredFields(
      data.fields,
      schemaByFolder.get(data.folderId) ?? []
    );
    if (missing.length) failures.push({ id, missing });
  }
  if (failures.length) {
    throw new HttpsError(
      "failed-precondition",
      `Cannot export — ${failures.length} item(s) have missing required fields.`,
      { failures }
    );
  }

  const { csv, rowCount, columns } = buildEbayCsv(items, schemaByFolder);

  // Stamp listingStatus and lastExportedAt on every exported item.
  const now = Date.now();
  let batch = db.batch();
  let writes = 0;
  for (const { id, data } of items) {
    batch.update(db.collection("inventoryItems").doc(id), {
      "ebay.listingStatus": "exported",
      "ebay.lastExportedAt": now,
      "ebay.lastError": null,
      updatedAt: now,
    });
    writes++;
    if (writes >= 400) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
    void data; // silence unused
  }
  if (writes > 0) await batch.commit();

  await appendAudit({
    action: "ebay.exportCsv",
    actorUid: uid,
    after: { rowCount, folderId: folderId ?? null },
  });

  return {
    filename: `ebay-${new Date().toISOString().slice(0, 10)}.csv`,
    body: csv,
    rowCount,
    columns,
  };
});
