import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";
import { parseCsv, serializeCsv } from "./csv";
import {
  appendAudit,
  defaultEbayBlock,
  extractEanCodes,
  missingEbayRequiredFields,
  validateItemFields,
  type FolderDoc,
  type ItemDoc,
} from "./shared";

interface ImportSummary {
  toCreate: number;
  toUpdate: number;
  skipped: { row: number; reason: string }[];
}

export const inventoryExport = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const { folderId, format } = request.data as {
    folderId: string;
    format: "csv" | "json";
  };
  if (!folderId) {
    throw new HttpsError("invalid-argument", "folderId is required.");
  }

  const folderSnap = await db.collection("inventoryFolders").doc(folderId).get();
  if (!folderSnap.exists) {
    throw new HttpsError("not-found", "folder not found.");
  }
  const folder = folderSnap.data() as FolderDoc;

  const itemSnap = await db
    .collection("inventoryItems")
    .where("folderId", "==", folderId)
    .where("deletedAt", "==", null)
    .orderBy("updatedAt", "desc")
    .limit(5000)
    .get();

  const items = itemSnap.docs.map((d) => ({ id: d.id, ...(d.data() as ItemDoc) }));

  if (format === "json") {
    return {
      format: "json",
      filename: `${folder.name}-${new Date().toISOString().slice(0, 10)}.json`,
      body: JSON.stringify(
        {
          folder: { id: folderId, name: folder.name, fieldSchema: folder.fieldSchema },
          items,
        },
        null,
        2
      ),
    };
  }

  // CSV: columns are the folder's field keys, plus a leading `id` and a
  // trailing `photos` column (pipe-separated public URLs).
  const headerKeys = folder.fieldSchema.map((f) => f.key);
  const header = ["id", ...headerKeys, "ebay_sync", "photos"];
  const rows: (string | number | null)[][] = [header];
  for (const item of items) {
    const row: (string | number | null)[] = [item.id];
    for (const key of headerKeys) {
      const v = item.fields?.[key];
      row.push(v === undefined || v === null ? "" : String(v));
    }
    row.push(item.ebay.syncEnabled ? "1" : "0");
    row.push((item.photos ?? []).map((p) => p.downloadUrl).join("|"));
    rows.push(row);
  }

  return {
    format: "csv",
    filename: `${folder.name}-${new Date().toISOString().slice(0, 10)}.csv`,
    body: serializeCsv(rows),
  };
});

export const inventoryImport = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { folderId, format, data, dryRun } = request.data as {
    folderId: string;
    format: "csv" | "json" | "ebay-csv";
    data: string;
    dryRun?: boolean;
  };

  if (!folderId || !format || typeof data !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "folderId, format and data are required."
    );
  }

  const folderRef = db.collection("inventoryFolders").doc(folderId);
  const folderSnap = await folderRef.get();
  if (!folderSnap.exists) {
    throw new HttpsError("not-found", "folder not found.");
  }
  const folder = folderSnap.data() as FolderDoc;

  // Build per-row { fields, importKey, existingId? } records.
  type Row = {
    rowIndex: number;
    fields: Record<string, unknown>;
    importKey: string | null;
    existingId?: string;
  };
  const records: Row[] = [];
  const summary: ImportSummary = { toCreate: 0, toUpdate: 0, skipped: [] };

  // SKU is our idempotency key (matches the default schema). Fallback to id.
  const hasSkuField = folder.fieldSchema.some((f) => f.key === "sku");
  const idempotencyKey = hasSkuField ? "sku" : null;

  if (format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new HttpsError("invalid-argument", "Invalid JSON.");
    }
    const rawItems = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { items?: unknown }).items)
        ? ((parsed as { items: unknown[] }).items as unknown[])
        : null;
    if (!rawItems) {
      throw new HttpsError("invalid-argument", "JSON must be an array or { items: [...] }.");
    }
    rawItems.forEach((raw, idx) => {
      const f =
        raw && typeof raw === "object"
          ? ((raw as { fields?: unknown }).fields as Record<string, unknown>) ?? (raw as Record<string, unknown>)
          : null;
      if (!f) {
        summary.skipped.push({ row: idx, reason: "not an object" });
        return;
      }
      try {
        const cleaned = validateItemFields(f, folder.fieldSchema, {
          enforceRequired: false,
        });
        records.push({
          rowIndex: idx,
          fields: cleaned,
          importKey: idempotencyKey ? String(cleaned[idempotencyKey] ?? "") : null,
        });
      } catch (e) {
        summary.skipped.push({
          row: idx,
          reason: e instanceof Error ? e.message : "invalid",
        });
      }
    });
  } else {
    const isEbay = format === "ebay-csv";
    const rows = parseCsv(data).filter((r) => r.some((c) => c.trim() !== ""));
    if (rows.length < 2) {
      throw new HttpsError("invalid-argument", "CSV must have a header row and at least one data row.");
    }
    const header = rows[0].map((h) => h.trim());

    let keyByCol: (string | null)[];
    if (isEbay) {
      // Map by ebayMapping. Core columns like "Title" match
      // `f.ebayMapping === "Title"`; custom item-specifics like
      // "C:Brand" match `f.ebayMapping === "Brand"`. PicURL / Action /
      // Country / Currency have no schema target and are ignored.
      keyByCol = header.map((col) => {
        const mapping = col.startsWith("C:") ? col.slice(2) : col;
        // Skip non-mappable columns entirely.
        if (
          ["Action", "PicURL", "Country", "Currency", "Format", "Duration"].includes(
            col
          )
        ) {
          return null;
        }
        const def = folder.fieldSchema.find((f) => f.ebayMapping === mapping);
        return def ? def.key : null;
      });
    } else {
      // Default CSV: match by field key or label, case-insensitive.
      keyByCol = header.map((col) => {
        const lower = col.toLowerCase();
        const def = folder.fieldSchema.find(
          (f) => f.key.toLowerCase() === lower || f.label.toLowerCase() === lower
        );
        return def ? def.key : null;
      });
    }
    rows.slice(1).forEach((row, i) => {
      const obj: Record<string, unknown> = {};
      keyByCol.forEach((key, c) => {
        if (key) obj[key] = row[c];
      });
      try {
        const cleaned = validateItemFields(obj, folder.fieldSchema, {
          enforceRequired: false,
        });
        records.push({
          rowIndex: i + 2,
          fields: cleaned,
          importKey: idempotencyKey ? String(cleaned[idempotencyKey] ?? "") : null,
        });
      } catch (e) {
        summary.skipped.push({
          row: i + 2,
          reason: e instanceof Error ? e.message : "invalid",
        });
      }
    });
  }

  // Resolve idempotency: look up existing items by SKU in this folder.
  if (idempotencyKey) {
    const uniqueKeys = Array.from(
      new Set(records.map((r) => r.importKey).filter((k): k is string => !!k))
    );
    // Firestore `in` queries take 30 values max. Chunk it.
    const existing = new Map<string, string>();
    for (let i = 0; i < uniqueKeys.length; i += 30) {
      const chunk = uniqueKeys.slice(i, i + 30);
      if (chunk.length === 0) continue;
      const q = await db
        .collection("inventoryItems")
        .where("folderId", "==", folderId)
        .where(`fields.${idempotencyKey}`, "in", chunk)
        .get();
      q.docs.forEach((d) => {
        const v = (d.data() as ItemDoc).fields?.[idempotencyKey];
        if (typeof v === "string") existing.set(v, d.id);
      });
    }
    records.forEach((r) => {
      if (r.importKey && existing.has(r.importKey)) {
        r.existingId = existing.get(r.importKey);
        summary.toUpdate++;
      } else {
        summary.toCreate++;
      }
    });
  } else {
    summary.toCreate = records.length;
  }

  if (dryRun) {
    return { dryRun: true, summary };
  }

  // Commit. Batch writes 400 at a time.
  let batch = db.batch();
  let writes = 0;
  const flush = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };
  const now = Date.now();
  let created = 0;
  let updated = 0;

  for (const r of records) {
    const eanCodes = extractEanCodes(r.fields, folder.fieldSchema);
    if (r.existingId) {
      const ref = db.collection("inventoryItems").doc(r.existingId);
      batch.update(ref, { fields: r.fields, eanCodes, updatedAt: now });
      updated++;
    } else {
      const ref = db.collection("inventoryItems").doc();
      const doc: ItemDoc = {
        folderId,
        fields: r.fields,
        photos: [],
        ebay: defaultEbayBlock(),
        eanCodes,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        deletedAt: null,
      };
      batch.set(ref, doc);
      created++;
    }
    writes++;
    if (writes >= 400) await flush();
  }
  await flush();

  if (created > 0) {
    await folderRef.update({
      itemCount: FieldValue.increment(created),
      updatedAt: now,
    });
  }

  await appendAudit({
    action: "items.import",
    actorUid: uid,
    folderId,
    after: { created, updated, skipped: summary.skipped.length },
  });

  return { dryRun: false, summary: { ...summary, toCreate: created, toUpdate: updated } };
});

export { missingEbayRequiredFields }; // re-export for ebayExport convenience
