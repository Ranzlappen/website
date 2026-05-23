import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";
import { serializeCsv } from "./csv";
import { serializeXml, type XmlField } from "./xml";
import {
  CANONICAL_FIELDS,
  getPlatform,
  missingForPlatform,
  PLATFORM_IDS,
  type PlatformDef,
  type PlatformFormat,
} from "./platforms";
import { appendAudit, type FolderDoc, type ItemDoc } from "./shared";

type ItemWithId = ItemDoc & { id: string };

function resolveCell(
  col: PlatformDef["columns"][number],
  item: ItemWithId
): string | number {
  const raw =
    col.field === "photos"
      ? item.photos
      : col.field in CANONICAL_FIELDS
        ? item.fields?.[col.field]
        : undefined;
  const out = col.transform ? col.transform(raw, item) : raw;
  return out === undefined || out === null ? "" : (out as string | number);
}

/**
 * Serialize one platform's file (CSV/TSV/XML) for the given items. Items
 * missing that platform's required columns are skipped and reported in
 * `blocked` so a partial export still succeeds.
 */
export function buildPlatformFile(
  platformId: string,
  formatId: string,
  items: ItemWithId[]
): {
  filename: string;
  body: string;
  fileExt: string;
  rowCount: number;
  blocked: { id: string; missing: string[] }[];
} {
  const def = getPlatform(platformId);
  if (!def) throw new HttpsError("invalid-argument", `unknown platform: ${platformId}`);
  const fmt = def.formats.find((f) => f.id === formatId);
  if (!fmt) {
    throw new HttpsError(
      "invalid-argument",
      `platform ${platformId} does not support format ${formatId}.`
    );
  }

  const blocked: { id: string; missing: string[] }[] = [];
  const exportable: ItemWithId[] = [];
  for (const item of items) {
    const missing = missingForPlatform(item, platformId);
    if (missing.length) blocked.push({ id: item.id, missing });
    else exportable.push(item);
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${platformId}-${date}.${fmt.fileExt}`;

  let body: string;
  if (fmt.id === "xml") {
    const dialect = fmt.dialect ?? "flat";
    const rows: XmlField[][] = exportable.map((item) =>
      def.columns
        .filter((c) => c.xmlTag)
        .map((c) => ({ tag: c.xmlTag as string, value: resolveCell(c, item) }))
    );
    body = serializeXml(rows, dialect, { title: def.name });
  } else {
    const header = [
      ...def.columns.map((c) => c.column),
      ...(def.constants ?? []).map((c) => c.column),
    ];
    const rows: (string | number)[][] = [header];
    for (const item of exportable) {
      rows.push([
        ...def.columns.map((c) => resolveCell(c, item)),
        ...(def.constants ?? []).map((c) => c.value),
      ]);
    }
    body = serializeCsv(rows, fmt.delimiter ?? ",");
  }

  return { filename, body, fileExt: fmt.fileExt, rowCount: exportable.length, blocked };
}

export const inventoryExportPlatforms = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { folderId, itemIds, scope, selections } = request.data as {
    folderId?: string;
    itemIds?: string[];
    scope?: "folder" | "global";
    selections: { platform: string; format: string }[];
  };

  if (!Array.isArray(selections) || selections.length === 0) {
    throw new HttpsError("invalid-argument", "selections[] is required.");
  }
  for (const sel of selections) {
    if (!(PLATFORM_IDS as readonly string[]).includes(sel.platform)) {
      throw new HttpsError("invalid-argument", `unknown platform: ${sel.platform}`);
    }
    const def = getPlatform(sel.platform)!;
    if (!def.formats.some((f: PlatformFormat) => f.id === sel.format)) {
      throw new HttpsError(
        "invalid-argument",
        `platform ${sel.platform} does not support format ${sel.format}.`
      );
    }
  }

  // Resolve which items to export.
  let items: ItemWithId[] = [];
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    if (itemIds.length > 500) {
      throw new HttpsError("invalid-argument", "Cannot export more than 500 items at once.");
    }
    const docs = await Promise.all(
      itemIds.map((id) => db.collection("inventoryItems").doc(id).get())
    );
    items = docs
      .filter((d) => d.exists)
      .map((d) => ({ id: d.id, ...(d.data() as ItemDoc) }))
      .filter((d) => !d.deletedAt);
  } else {
    // folder scope or global → opt-in "include in export" items only.
    let q: FirebaseFirestore.Query = db
      .collection("inventoryItems")
      .where("deletedAt", "==", null)
      .where("ebay.syncEnabled", "==", true);
    if (scope !== "global" && folderId) q = q.where("folderId", "==", folderId);
    const snap = await q.limit(500).get();
    items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ItemDoc) }));
  }

  if (items.length === 0) {
    throw new HttpsError("failed-precondition", "No items to export.");
  }

  // Load each involved folder's platformTags once.
  const folderIds = Array.from(new Set(items.map((i) => i.folderId)));
  const tagsByFolder = new Map<string, string[]>();
  await Promise.all(
    folderIds.map(async (fid) => {
      const f = await db.collection("inventoryFolders").doc(fid).get();
      if (f.exists) tagsByFolder.set(fid, (f.data() as FolderDoc).platformTags ?? []);
    })
  );

  const files: { platform: string; filename: string; body: string; fileExt: string; rowCount: number }[] = [];
  const blocked: Record<string, { id: string; missing: string[] }[]> = {};
  const skipped: { platform: string; reason: string }[] = [];
  const exportedEbayIds = new Set<string>();

  for (const sel of selections) {
    const eligible = items.filter((i) =>
      (tagsByFolder.get(i.folderId) ?? []).includes(sel.platform)
    );
    if (eligible.length === 0) {
      skipped.push({ platform: sel.platform, reason: "no items in folders tagged for this platform" });
      continue;
    }
    const built = buildPlatformFile(sel.platform, sel.format, eligible);
    if (built.blocked.length) blocked[sel.platform] = built.blocked;
    if (built.rowCount === 0) {
      skipped.push({ platform: sel.platform, reason: "all eligible items blocked by missing required fields" });
      continue;
    }
    files.push({
      platform: sel.platform,
      filename: built.filename,
      body: built.body,
      fileExt: built.fileExt,
      rowCount: built.rowCount,
    });
    if (sel.platform === "ebay") {
      eligible
        .filter((i) => missingForPlatform(i, "ebay").length === 0)
        .forEach((i) => exportedEbayIds.add(i.id));
    }
  }

  if (files.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Nothing to export — no eligible items for the selected platforms.",
      { blocked, skipped }
    );
  }

  // Stamp eBay listing status on the items that made it into the eBay file.
  if (exportedEbayIds.size > 0) {
    const now = Date.now();
    let batch = db.batch();
    let writes = 0;
    for (const id of exportedEbayIds) {
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
    }
    if (writes > 0) await batch.commit();
  }

  await appendAudit({
    action: "inventory.exportPlatforms",
    actorUid: uid,
    folderId: folderId ?? null,
    after: {
      platforms: files.map((f) => `${f.platform}:${f.rowCount}`),
      skipped: skipped.length,
    },
  });

  return { files, blocked, skipped };
});
