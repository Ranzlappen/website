import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { requireRole } from "../utils/adminOnly";
import {
  appendAudit,
  defaultEbayBlock,
  defaultFieldSchema,
  extractEanCodes,
  validateFieldSchema,
  type FieldDef,
  type FolderDoc,
  type ItemDoc,
  type PhotoRef,
} from "./shared";

// Must match the bucket constant in `./photos.ts`.
const INVENTORY_BUCKET = "proven-concept-436717-q3.firebasestorage.app";

function publicUrl(bucket: string, path: string): string {
  return `https://storage.googleapis.com/${bucket}/${path}`;
}

const MAX_NAME = 80;
const MAX_DEPTH = 6;

function validateName(input: unknown): string {
  if (typeof input !== "string") {
    throw new HttpsError("invalid-argument", "name is required.");
  }
  const name = input.trim();
  if (!name || name.length > MAX_NAME) {
    throw new HttpsError("invalid-argument", `name must be 1-${MAX_NAME} chars.`);
  }
  return name;
}

async function resolvePath(
  parentFolderId: string | null,
  name: string
): Promise<string[]> {
  if (!parentFolderId) return [name];
  const db = getFirestore();
  const parent = await db.collection("inventoryFolders").doc(parentFolderId).get();
  if (!parent.exists) {
    throw new HttpsError("not-found", "parent folder not found.");
  }
  const parentData = parent.data() as FolderDoc;
  if (parentData.deletedAt) {
    throw new HttpsError("failed-precondition", "parent folder is deleted.");
  }
  const segments = [...parentData.pathSegments, name];
  if (segments.length > MAX_DEPTH) {
    throw new HttpsError(
      "failed-precondition",
      `folder nesting exceeds max depth of ${MAX_DEPTH}.`
    );
  }
  return segments;
}

export const inventoryListFolders = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const snap = await db
    .collection("inventoryFolders")
    .where("deletedAt", "==", null)
    .orderBy("name")
    .limit(500)
    .get();

  const folders = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { folders, total: folders.length };
});

export const inventoryCreateFolder = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { parentFolderId, name, fieldSchema } = request.data as {
    parentFolderId?: string | null;
    name: string;
    fieldSchema?: FieldDef[];
  };

  const cleanName = validateName(name);
  const parent = parentFolderId ?? null;
  const pathSegments = await resolvePath(parent, cleanName);

  const schema = fieldSchema
    ? validateFieldSchema(fieldSchema)
    : defaultFieldSchema();

  const now = Date.now();
  const ref = db.collection("inventoryFolders").doc();
  const doc: FolderDoc = {
    name: cleanName,
    parentFolderId: parent,
    pathSegments,
    fieldSchema: schema,
    itemCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
    deletedAt: null,
  };
  await ref.set(doc);

  await appendAudit({
    action: "folder.create",
    actorUid: uid,
    folderId: ref.id,
    after: { name: cleanName, parentFolderId: parent },
  });

  return { id: ref.id, ...doc };
});

export const inventoryUpdateFolder = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { folderId, name, fieldSchema, parentFolderId } = request.data as {
    folderId: string;
    name?: string;
    fieldSchema?: FieldDef[];
    parentFolderId?: string | null;
  };

  if (!folderId) {
    throw new HttpsError("invalid-argument", "folderId is required.");
  }

  const ref = db.collection("inventoryFolders").doc(folderId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "folder not found.");
  }
  const existing = snap.data() as FolderDoc;
  if (existing.deletedAt) {
    throw new HttpsError("failed-precondition", "folder is deleted.");
  }

  const updates: Partial<FolderDoc> & { updatedAt: number } = {
    updatedAt: Date.now(),
  };

  if (typeof name === "string") {
    updates.name = validateName(name);
  }

  // Recompute path if name or parent changed.
  const newName = updates.name ?? existing.name;
  const newParent =
    parentFolderId === undefined ? existing.parentFolderId : parentFolderId ?? null;
  if (newParent === folderId) {
    throw new HttpsError("failed-precondition", "folder cannot be its own parent.");
  }
  if (newName !== existing.name || newParent !== existing.parentFolderId) {
    updates.parentFolderId = newParent;
    updates.pathSegments = await resolvePath(newParent, newName);
  }

  if (fieldSchema) {
    const cleaned = validateFieldSchema(fieldSchema);
    // Soft guard: warn-but-allow when shrinking the schema. We keep item data
    // intact even for removed keys (they just stop showing in the UI).
    updates.fieldSchema = cleaned;
  }

  await ref.update(updates);

  await appendAudit({
    action: "folder.update",
    actorUid: uid,
    folderId,
    before: { name: existing.name, parentFolderId: existing.parentFolderId },
    after: { name: newName, parentFolderId: newParent },
  });

  const fresh = await ref.get();
  return { id: folderId, ...fresh.data() };
});

export const inventoryDeleteFolder = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { folderId } = request.data as { folderId: string };
  if (!folderId) {
    throw new HttpsError("invalid-argument", "folderId is required.");
  }

  const ref = db.collection("inventoryFolders").doc(folderId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "folder not found.");
  }
  const now = Date.now();

  // Cascade: soft-delete this folder, all descendant folders, and all items
  // belonging to any of them. Done in batches so we don't blow past the
  // 500-write limit per Firestore batch.
  const queue: string[] = [folderId];
  const allFolderIds: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    allFolderIds.push(id);
    const children = await db
      .collection("inventoryFolders")
      .where("parentFolderId", "==", id)
      .where("deletedAt", "==", null)
      .get();
    children.docs.forEach((d) => queue.push(d.id));
  }

  let batch = db.batch();
  let writes = 0;
  const flush = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const id of allFolderIds) {
    batch.update(db.collection("inventoryFolders").doc(id), {
      deletedAt: now,
      updatedAt: now,
    });
    writes++;
    if (writes >= 400) await flush();

    const items = await db
      .collection("inventoryItems")
      .where("folderId", "==", id)
      .where("deletedAt", "==", null)
      .get();

    for (const item of items.docs) {
      batch.update(item.ref, { deletedAt: now, updatedAt: now });
      writes++;
      if (writes >= 400) await flush();
    }
  }
  await flush();

  await appendAudit({
    action: "folder.delete",
    actorUid: uid,
    folderId,
    before: { folderIds: allFolderIds },
  });

  return { success: true, deletedFolderCount: allFolderIds.length };
});

/**
 * Duplicate a folder. Always copies the schema; when `copyItems` is true
 * also clones every item and re-uploads its photos to fresh Storage paths
 * under the new item ids so the two folders are fully isolated.
 *
 * eBay state (`listingId`, `listingStatus`) is intentionally NOT copied —
 * duplicates are not relistings.
 */
export const inventoryDuplicateFolder = onCall(
  { timeoutSeconds: 300 },
  async (request) => {
    requireRole(request, "admin");
    const db = getFirestore();
    const uid = request.auth!.uid;

    const { folderId, newName, copyItems } = request.data as {
      folderId: string;
      newName?: string;
      copyItems?: boolean;
    };

    if (!folderId) {
      throw new HttpsError("invalid-argument", "folderId is required.");
    }

    const srcSnap = await db.collection("inventoryFolders").doc(folderId).get();
    if (!srcSnap.exists) {
      throw new HttpsError("not-found", "folder not found.");
    }
    const src = srcSnap.data() as FolderDoc;
    if (src.deletedAt) {
      throw new HttpsError("failed-precondition", "folder is deleted.");
    }

    const cleanName =
      (typeof newName === "string" && newName.trim()) || `${src.name} (copy)`;
    if (cleanName.length > MAX_NAME) {
      throw new HttpsError("invalid-argument", `name must be 1-${MAX_NAME} chars.`);
    }

    const pathSegments = await resolvePath(src.parentFolderId, cleanName);
    const now = Date.now();

    const newFolderRef = db.collection("inventoryFolders").doc();
    const newFolderDoc: FolderDoc = {
      name: cleanName,
      parentFolderId: src.parentFolderId,
      pathSegments,
      fieldSchema: src.fieldSchema,
      itemCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      deletedAt: null,
    };
    await newFolderRef.set(newFolderDoc);

    let itemCount = 0;
    let photoCount = 0;

    if (copyItems) {
      const itemsSnap = await db
        .collection("inventoryItems")
        .where("folderId", "==", folderId)
        .where("deletedAt", "==", null)
        .limit(5000)
        .get();

      const bucket = getStorage().bucket(INVENTORY_BUCKET);

      for (const srcItemDoc of itemsSnap.docs) {
        const srcItem = srcItemDoc.data() as ItemDoc;
        const newItemRef = db.collection("inventoryItems").doc();

        // Deep-copy each photo to a fresh Storage path under the new item id.
        const newPhotos: PhotoRef[] = [];
        for (const photo of srcItem.photos ?? []) {
          const ext = photo.storagePath.substring(
            photo.storagePath.lastIndexOf(".")
          );
          const newPath = `inventory/${newItemRef.id}/${randomUUID()}${ext}`;
          try {
            await bucket.file(photo.storagePath).copy(bucket.file(newPath));
            await bucket.file(newPath).makePublic();
            newPhotos.push({
              ...photo,
              storagePath: newPath,
              downloadUrl: publicUrl(INVENTORY_BUCKET, newPath),
              order: newPhotos.length,
            });
            photoCount++;
          } catch (e) {
            // Skip photos that fail to copy (source missing / permission). Logged for the operator.
            console.warn("photo copy failed", photo.storagePath, e);
          }
        }

        const newItem: ItemDoc = {
          folderId: newFolderRef.id,
          fields: srcItem.fields,
          photos: newPhotos,
          ebay: defaultEbayBlock(),
          eanCodes: extractEanCodes(srcItem.fields, src.fieldSchema),
          createdAt: now,
          updatedAt: now,
          createdBy: uid,
          deletedAt: null,
        };
        await newItemRef.set(newItem);
        itemCount++;
      }

      if (itemCount > 0) {
        await newFolderRef.update({ itemCount, updatedAt: now });
      }
    }

    await appendAudit({
      action: "folder.duplicate",
      actorUid: uid,
      folderId: newFolderRef.id,
      before: { srcFolderId: folderId },
      after: { copyItems: !!copyItems, itemCount, photoCount },
    });

    const fresh = await newFolderRef.get();
    return { id: newFolderRef.id, ...fresh.data(), itemCount, photoCount };
  }
);
