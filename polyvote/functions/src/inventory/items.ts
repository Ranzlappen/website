import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";
import { buildDuplicatedItem } from "./folders";
import {
  appendAudit,
  defaultEbayBlock,
  extractEanCodes,
  missingEbayRequiredFields,
  validateItemFields,
  type FolderDoc,
  type ItemDoc,
} from "./shared";

async function loadFolder(folderId: string): Promise<FolderDoc & { id: string }> {
  const snap = await getFirestore()
    .collection("inventoryFolders")
    .doc(folderId)
    .get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "folder not found.");
  }
  const data = snap.data() as FolderDoc;
  if (data.deletedAt) {
    throw new HttpsError("failed-precondition", "folder is deleted.");
  }
  return { id: snap.id, ...data };
}

export const inventoryListItems = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const { folderId, limit, cursor, ebayOnly } = request.data as {
    folderId?: string;
    limit?: number;
    cursor?: number;
    ebayOnly?: boolean;
  };

  const pageSize = Math.min(Math.max(limit ?? 100, 1), 500);

  let query: FirebaseFirestore.Query = db
    .collection("inventoryItems")
    .where("deletedAt", "==", null);

  if (folderId) {
    query = query.where("folderId", "==", folderId);
  }
  if (ebayOnly) {
    query = query.where("ebay.syncEnabled", "==", true);
  }

  query = query.orderBy("updatedAt", "desc").limit(pageSize);
  if (typeof cursor === "number") {
    query = query.startAfter(cursor);
  }

  const snap = await query.get();
  const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const nextCursor =
    items.length === pageSize
      ? (items[items.length - 1] as unknown as { updatedAt: number }).updatedAt
      : null;

  return { items, nextCursor };
});

export const inventoryGetItem = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const { itemId } = request.data as { itemId: string };
  if (!itemId) {
    throw new HttpsError("invalid-argument", "itemId is required.");
  }

  const snap = await db.collection("inventoryItems").doc(itemId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "item not found.");
  }
  return { id: snap.id, ...snap.data() };
});

export const inventoryCreateItem = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { folderId, fields, ebay } = request.data as {
    folderId: string;
    fields: Record<string, unknown>;
    ebay?: Partial<ItemDoc["ebay"]>;
  };

  if (!folderId) {
    throw new HttpsError("invalid-argument", "folderId is required.");
  }

  const folder = await loadFolder(folderId);
  const cleanFields = validateItemFields(fields, folder.fieldSchema, {
    enforceRequired: true,
  });

  const ebayBlock = { ...defaultEbayBlock(), ...(ebay ?? {}) };
  if (ebayBlock.syncEnabled) {
    const missing = missingEbayRequiredFields(cleanFields, folder.fieldSchema);
    if (missing.length) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot enable eBay sync — missing required fields: ${missing.join(", ")}.`
      );
    }
    ebayBlock.listingStatus = "ready";
  }

  const now = Date.now();
  const itemRef = db.collection("inventoryItems").doc();
  const doc: ItemDoc = {
    folderId,
    fields: cleanFields,
    photos: [],
    ebay: ebayBlock,
    eanCodes: extractEanCodes(cleanFields, folder.fieldSchema),
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
    deletedAt: null,
  };
  await itemRef.set(doc);

  await db
    .collection("inventoryFolders")
    .doc(folderId)
    .update({
      itemCount: FieldValue.increment(1),
      updatedAt: now,
    });

  await appendAudit({
    action: "item.create",
    actorUid: uid,
    itemId: itemRef.id,
    folderId,
    after: { fields: cleanFields },
  });

  return { id: itemRef.id, ...doc };
});

export const inventoryUpdateItem = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { itemId, fields, ebay } = request.data as {
    itemId: string;
    fields?: Record<string, unknown>;
    ebay?: Partial<ItemDoc["ebay"]>;
  };

  if (!itemId) {
    throw new HttpsError("invalid-argument", "itemId is required.");
  }

  const ref = db.collection("inventoryItems").doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "item not found.");
  }
  const existing = snap.data() as ItemDoc;
  if (existing.deletedAt) {
    throw new HttpsError("failed-precondition", "item is deleted.");
  }

  const folder = await loadFolder(existing.folderId);

  const updates: Partial<ItemDoc> & { updatedAt: number } = {
    updatedAt: Date.now(),
  };

  let nextFields = existing.fields;
  if (fields !== undefined) {
    nextFields = validateItemFields(fields, folder.fieldSchema, {
      enforceRequired: true,
    });
    updates.fields = nextFields;
    updates.eanCodes = extractEanCodes(nextFields, folder.fieldSchema);
  }

  if (ebay !== undefined) {
    const nextEbay = { ...existing.ebay, ...ebay };
    if (nextEbay.syncEnabled) {
      const missing = missingEbayRequiredFields(nextFields, folder.fieldSchema);
      if (missing.length) {
        throw new HttpsError(
          "failed-precondition",
          `Cannot enable eBay sync — missing required fields: ${missing.join(", ")}.`
        );
      }
      if (nextEbay.listingStatus === "none") {
        nextEbay.listingStatus = "ready";
      }
    } else if (nextEbay.listingStatus === "ready") {
      // Toggling sync off without ever exporting clears the status.
      nextEbay.listingStatus = "none";
    }
    updates.ebay = nextEbay;
  }

  await ref.update(updates);

  await appendAudit({
    action: "item.update",
    actorUid: uid,
    itemId,
    folderId: existing.folderId,
    before: { fields: existing.fields, ebay: existing.ebay },
    after: { fields: updates.fields ?? existing.fields, ebay: updates.ebay ?? existing.ebay },
  });

  const fresh = await ref.get();
  return { id: itemId, ...fresh.data() };
});

export const inventoryDeleteItem = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { itemId } = request.data as { itemId: string };
  if (!itemId) {
    throw new HttpsError("invalid-argument", "itemId is required.");
  }

  const ref = db.collection("inventoryItems").doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "item not found.");
  }
  const existing = snap.data() as ItemDoc;
  if (existing.deletedAt) {
    return { success: true };
  }

  const now = Date.now();
  await ref.update({ deletedAt: now, updatedAt: now });
  await db
    .collection("inventoryFolders")
    .doc(existing.folderId)
    .update({
      itemCount: FieldValue.increment(-1),
      updatedAt: now,
    });

  await appendAudit({
    action: "item.delete",
    actorUid: uid,
    itemId,
    folderId: existing.folderId,
    before: { fields: existing.fields },
  });

  return { success: true };
});

export const inventoryToggleEbaySync = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { itemId, enabled } = request.data as {
    itemId: string;
    enabled: boolean;
  };
  if (!itemId) {
    throw new HttpsError("invalid-argument", "itemId is required.");
  }

  const ref = db.collection("inventoryItems").doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "item not found.");
  }
  const existing = snap.data() as ItemDoc;

  const folder = await loadFolder(existing.folderId);

  const nextEbay = { ...existing.ebay, syncEnabled: !!enabled };
  if (enabled) {
    const missing = missingEbayRequiredFields(existing.fields, folder.fieldSchema);
    if (missing.length) {
      throw new HttpsError(
        "failed-precondition",
        `Missing required fields: ${missing.join(", ")}.`
      );
    }
    if (nextEbay.listingStatus === "none") nextEbay.listingStatus = "ready";
  } else if (nextEbay.listingStatus === "ready") {
    nextEbay.listingStatus = "none";
  }

  await ref.update({ ebay: nextEbay, updatedAt: Date.now() });

  await appendAudit({
    action: "item.ebayToggle",
    actorUid: uid,
    itemId,
    folderId: existing.folderId,
    before: { syncEnabled: existing.ebay.syncEnabled },
    after: { syncEnabled: nextEbay.syncEnabled },
  });

  return { success: true, ebay: nextEbay };
});

/**
 * Bulk update on a list of items. `action` controls the operation:
 *  - 'delete'      → soft-delete each selected item
 *  - 'toggleEbay'  → set ebay.syncEnabled (payload: { enabled })
 *  - 'move'        → reparent to a different folder (payload: { targetFolderId })
 *  - 'setField'    → write a single field on every item (payload: { fieldKey, value })
 *
 * Validates each item per-action; skips items where the operation isn't
 * legal (e.g. enabling eBay sync without all required fields), and returns
 * `{ ok, skipped: [{ id, reason }] }`.
 */
export const inventoryBulkUpdate = onCall(
  { timeoutSeconds: 180 },
  async (request) => {
    requireRole(request, "admin");
    const db = getFirestore();
    const uid = request.auth!.uid;

    const { itemIds, action, payload } = request.data as {
      itemIds: string[];
      action: "delete" | "toggleEbay" | "move" | "setField";
      payload?: Record<string, unknown>;
    };

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw new HttpsError("invalid-argument", "itemIds[] is required.");
    }
    if (itemIds.length > 500) {
      throw new HttpsError("invalid-argument", "Max 500 items per bulk action.");
    }

    // Load every item one-by-one (Firestore `in` caps at 30, so a get-per-id
    // loop is simpler and the volume is admin-bounded anyway).
    const docs = await Promise.all(
      itemIds.map((id) => db.collection("inventoryItems").doc(id).get())
    );
    const items: { id: string; data: ItemDoc }[] = docs
      .filter((d) => d.exists)
      .map((d) => ({ id: d.id, data: d.data() as ItemDoc }))
      .filter(({ data }) => !data.deletedAt);

    if (items.length === 0) {
      throw new HttpsError("failed-precondition", "No live items matched.");
    }

    // Pre-load every folder referenced so schema-aware actions are fast.
    const folderIds = Array.from(new Set(items.map((i) => i.data.folderId)));
    const folderById = new Map<string, FolderDoc>();
    await Promise.all(
      folderIds.map(async (fid) => {
        const f = await db.collection("inventoryFolders").doc(fid).get();
        if (f.exists) folderById.set(fid, f.data() as FolderDoc);
      })
    );

    const now = Date.now();
    const skipped: { id: string; reason: string }[] = [];
    let updated = 0;
    let batch = db.batch();
    let writes = 0;
    const flush = async () => {
      if (writes === 0) return;
      await batch.commit();
      batch = db.batch();
      writes = 0;
    };
    const folderCountDelta = new Map<string, number>();

    if (action === "delete") {
      for (const { id, data } of items) {
        batch.update(db.collection("inventoryItems").doc(id), {
          deletedAt: now,
          updatedAt: now,
        });
        folderCountDelta.set(
          data.folderId,
          (folderCountDelta.get(data.folderId) ?? 0) - 1
        );
        updated++;
        writes++;
        if (writes >= 400) await flush();
      }
    } else if (action === "toggleEbay") {
      const enabled = (payload as { enabled?: boolean })?.enabled === true;
      for (const { id, data } of items) {
        const folder = folderById.get(data.folderId);
        if (!folder) {
          skipped.push({ id, reason: "folder not found" });
          continue;
        }
        if (enabled) {
          const missing = missingEbayRequiredFields(data.fields, folder.fieldSchema);
          if (missing.length) {
            skipped.push({
              id,
              reason: `missing required fields: ${missing.join(", ")}`,
            });
            continue;
          }
        }
        const nextEbay = {
          ...data.ebay,
          syncEnabled: enabled,
          listingStatus: enabled
            ? data.ebay.listingStatus === "none"
              ? ("ready" as const)
              : data.ebay.listingStatus
            : data.ebay.listingStatus === "ready"
              ? ("none" as const)
              : data.ebay.listingStatus,
        };
        batch.update(db.collection("inventoryItems").doc(id), {
          ebay: nextEbay,
          updatedAt: now,
        });
        updated++;
        writes++;
        if (writes >= 400) await flush();
      }
    } else if (action === "move") {
      const targetFolderId = (payload as { targetFolderId?: string })?.targetFolderId;
      if (!targetFolderId) {
        throw new HttpsError("invalid-argument", "payload.targetFolderId is required.");
      }
      const targetSnap = await db
        .collection("inventoryFolders")
        .doc(targetFolderId)
        .get();
      if (!targetSnap.exists) {
        throw new HttpsError("not-found", "target folder not found.");
      }
      const target = targetSnap.data() as FolderDoc;
      if (target.deletedAt) {
        throw new HttpsError("failed-precondition", "target folder is deleted.");
      }
      for (const { id, data } of items) {
        if (data.folderId === targetFolderId) {
          skipped.push({ id, reason: "already in target folder" });
          continue;
        }
        // Recompute eanCodes against the *new* schema (a removed ean key in
        // the target would silently drop from the lookup; that's fine — the
        // value still lives in `fields`).
        const newEan = extractEanCodes(data.fields, target.fieldSchema);
        batch.update(db.collection("inventoryItems").doc(id), {
          folderId: targetFolderId,
          eanCodes: newEan,
          updatedAt: now,
        });
        folderCountDelta.set(
          data.folderId,
          (folderCountDelta.get(data.folderId) ?? 0) - 1
        );
        folderCountDelta.set(
          targetFolderId,
          (folderCountDelta.get(targetFolderId) ?? 0) + 1
        );
        updated++;
        writes++;
        if (writes >= 400) await flush();
      }
    } else if (action === "setField") {
      const fieldKey = (payload as { fieldKey?: string })?.fieldKey;
      const rawValue = (payload as { value?: unknown })?.value;
      if (!fieldKey) {
        throw new HttpsError("invalid-argument", "payload.fieldKey is required.");
      }
      for (const { id, data } of items) {
        const folder = folderById.get(data.folderId);
        if (!folder) {
          skipped.push({ id, reason: "folder not found" });
          continue;
        }
        const def = folder.fieldSchema.find((f) => f.key === fieldKey);
        if (!def) {
          skipped.push({
            id,
            reason: `field "${fieldKey}" not in this item's schema`,
          });
          continue;
        }
        let cleaned: Record<string, unknown>;
        try {
          cleaned = validateItemFields(
            { ...data.fields, [fieldKey]: rawValue },
            folder.fieldSchema,
            { enforceRequired: false }
          );
        } catch (e) {
          skipped.push({
            id,
            reason: e instanceof Error ? e.message : "invalid value",
          });
          continue;
        }
        batch.update(db.collection("inventoryItems").doc(id), {
          fields: cleaned,
          eanCodes: extractEanCodes(cleaned, folder.fieldSchema),
          updatedAt: now,
        });
        updated++;
        writes++;
        if (writes >= 400) await flush();
      }
    } else {
      throw new HttpsError("invalid-argument", `unknown action: ${action}`);
    }

    await flush();

    // Apply folder itemCount deltas.
    for (const [fid, delta] of folderCountDelta) {
      if (delta === 0) continue;
      await db
        .collection("inventoryFolders")
        .doc(fid)
        .update({
          itemCount: FieldValue.increment(delta),
          updatedAt: now,
        });
    }

    await appendAudit({
      action: `bulk.${action}`,
      actorUid: uid,
      after: { requested: itemIds.length, updated, skipped: skipped.length },
    });

    return { ok: true, updated, skipped };
  }
);

/**
 * Duplicate a single item inside its current folder. Deep-copies photos
 * to fresh Storage paths so the two items are fully isolated. eBay state
 * is reset on the copy.
 */
export const inventoryDuplicateItem = onCall(
  { timeoutSeconds: 120 },
  async (request) => {
    requireRole(request, "admin");
    const db = getFirestore();
    const uid = request.auth!.uid;

    const { itemId, copyPhotos } = request.data as {
      itemId: string;
      copyPhotos?: boolean;
    };
    if (!itemId) {
      throw new HttpsError("invalid-argument", "itemId is required.");
    }

    const srcSnap = await db.collection("inventoryItems").doc(itemId).get();
    if (!srcSnap.exists) {
      throw new HttpsError("not-found", "item not found.");
    }
    const src = srcSnap.data() as ItemDoc;
    if (src.deletedAt) {
      throw new HttpsError("failed-precondition", "item is deleted.");
    }

    const folder = await loadFolder(src.folderId);

    const now = Date.now();
    const newItemRef = db.collection("inventoryItems").doc();
    const { doc: newDoc, photoCount } = await buildDuplicatedItem({
      srcItem: src,
      srcSchema: folder.fieldSchema,
      targetFolderId: src.folderId,
      newItemId: newItemRef.id,
      uid,
      copyPhotos: copyPhotos !== false,
      now,
    });
    await newItemRef.set(newDoc);
    await db
      .collection("inventoryFolders")
      .doc(src.folderId)
      .update({
        itemCount: FieldValue.increment(1),
        updatedAt: now,
      });

    await appendAudit({
      action: "item.duplicate",
      actorUid: uid,
      itemId: newItemRef.id,
      folderId: src.folderId,
      before: { srcItemId: itemId },
      after: { photoCount },
    });

    return { id: newItemRef.id, ...newDoc, photoCount };
  }
);
