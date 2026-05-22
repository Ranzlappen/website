import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { requireRole } from "../utils/adminOnly";
import { appendAudit, type FolderDoc, type ItemDoc } from "./shared";

const INVENTORY_BUCKET = "proven-concept-436717-q3.firebasestorage.app";

/** Items + folders soft-deleted longer than this are auto-purged. */
const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * List recently soft-deleted folders and items. Default limit 100 each;
 * ordered by `deletedAt` desc. The Trash page calls this on mount.
 */
export const inventoryListDeleted = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const { limit } = request.data as { limit?: number };
  const cap = Math.min(Math.max(limit ?? 100, 1), 500);

  const [itemsSnap, foldersSnap] = await Promise.all([
    db
      .collection("inventoryItems")
      .where("deletedAt", ">", 0)
      .orderBy("deletedAt", "desc")
      .limit(cap)
      .get(),
    db
      .collection("inventoryFolders")
      .where("deletedAt", ">", 0)
      .orderBy("deletedAt", "desc")
      .limit(cap)
      .get(),
  ]);

  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as ItemDoc) }));
  const folders = foldersSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as FolderDoc),
  }));

  return { items, folders, purgeAfterMs: PURGE_AFTER_MS };
});

/** Clear `deletedAt` on a single item; bump the parent folder's count. */
export const inventoryRestoreItem = onCall(async (request) => {
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
  const data = snap.data() as ItemDoc;
  if (!data.deletedAt) {
    return { success: true, alreadyLive: true };
  }

  const now = Date.now();
  await ref.update({ deletedAt: null, updatedAt: now });
  await db
    .collection("inventoryFolders")
    .doc(data.folderId)
    .update({
      itemCount: FieldValue.increment(1),
      updatedAt: now,
    });

  await appendAudit({
    action: "item.restore",
    actorUid: uid,
    itemId,
    folderId: data.folderId,
  });

  return { success: true };
});

/**
 * Restore a folder. With `cascade: true`, also restores every descendant
 * folder and every item inside any restored folder. Without cascade,
 * descendants stay deleted (admin can restore them individually later).
 */
export const inventoryRestoreFolder = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { folderId, cascade } = request.data as {
    folderId: string;
    cascade?: boolean;
  };
  if (!folderId) {
    throw new HttpsError("invalid-argument", "folderId is required.");
  }

  const rootRef = db.collection("inventoryFolders").doc(folderId);
  const rootSnap = await rootRef.get();
  if (!rootSnap.exists) {
    throw new HttpsError("not-found", "folder not found.");
  }

  const now = Date.now();
  let folderCount = 0;
  let itemCount = 0;
  let batch = db.batch();
  let writes = 0;
  const flush = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  const queue: string[] = [folderId];
  const visited: string[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.includes(id)) continue;
    visited.push(id);

    const ref = db.collection("inventoryFolders").doc(id);
    batch.update(ref, { deletedAt: null, updatedAt: now });
    folderCount++;
    writes++;
    if (writes >= 400) await flush();

    // Restore items belonging to this folder.
    const items = await db
      .collection("inventoryItems")
      .where("folderId", "==", id)
      .where("deletedAt", ">", 0)
      .get();
    let restoredHere = 0;
    for (const it of items.docs) {
      batch.update(it.ref, { deletedAt: null, updatedAt: now });
      restoredHere++;
      itemCount++;
      writes++;
      if (writes >= 400) await flush();
    }
    if (restoredHere > 0) {
      batch.update(ref, {
        itemCount: FieldValue.increment(restoredHere),
      });
      writes++;
    }

    if (cascade) {
      const children = await db
        .collection("inventoryFolders")
        .where("parentFolderId", "==", id)
        .where("deletedAt", ">", 0)
        .get();
      children.docs.forEach((c) => queue.push(c.id));
    }
  }

  await flush();

  await appendAudit({
    action: "folder.restore",
    actorUid: uid,
    folderId,
    after: { cascade: !!cascade, folderCount, itemCount },
  });

  return { success: true, folderCount, itemCount };
});

/**
 * Scheduled hard-purge of records soft-deleted longer than PURGE_AFTER_MS.
 * Runs daily. Deletes Firestore docs + Storage photo objects + writes an
 * audit-log entry per record.
 */
export const inventoryPurgeDeleted = onSchedule(
  "every 24 hours",
  async () => {
    const db = getFirestore();
    const cutoff = Date.now() - PURGE_AFTER_MS;
    const bucket = getStorage().bucket(INVENTORY_BUCKET);

    // Items first (so the folder doc count stays at zero by the time the
    // folder itself is hard-deleted).
    const items = await db
      .collection("inventoryItems")
      .where("deletedAt", ">", 0)
      .where("deletedAt", "<", cutoff)
      .limit(500)
      .get();

    for (const doc of items.docs) {
      const data = doc.data() as ItemDoc;
      for (const photo of data.photos ?? []) {
        try {
          await bucket.file(photo.storagePath).delete({ ignoreNotFound: true });
        } catch (e) {
          console.warn("purge: storage delete failed", photo.storagePath, e);
        }
      }
      await doc.ref.delete();
      await db.collection("inventoryAuditLog").add({
        action: "auto-purge.item",
        actorUid: "system",
        itemId: doc.id,
        folderId: data.folderId,
        timestamp: Date.now(),
      });
    }

    const folders = await db
      .collection("inventoryFolders")
      .where("deletedAt", ">", 0)
      .where("deletedAt", "<", cutoff)
      .limit(500)
      .get();

    for (const doc of folders.docs) {
      await doc.ref.delete();
      await db.collection("inventoryAuditLog").add({
        action: "auto-purge.folder",
        actorUid: "system",
        folderId: doc.id,
        timestamp: Date.now(),
      });
    }
  }
);
