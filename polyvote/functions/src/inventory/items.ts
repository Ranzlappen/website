import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";
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
