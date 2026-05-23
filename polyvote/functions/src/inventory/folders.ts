import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { requireRole } from "../utils/adminOnly";
import {
  appendAudit,
  defaultEbayBlock,
  extractEanCodes,
  validateFieldSchema,
  type FieldDef,
  type FolderDoc,
  type ItemDoc,
  type PhotoRef,
} from "./shared";
import {
  ensureTagColumns,
  fieldsForTags,
  PLATFORM_IDS,
} from "./platforms";

function cleanTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input.filter(
        (t): t is string =>
          typeof t === "string" && (PLATFORM_IDS as readonly string[]).includes(t)
      )
    )
  );
}

// Must match the bucket constant in `./photos.ts`.
const INVENTORY_BUCKET = "proven-concept-436717-q3.firebasestorage.app";

function publicUrl(bucket: string, path: string): string {
  return `https://storage.googleapis.com/${bucket}/${path}`;
}

/**
 * Build a new item doc that is a deep copy of `srcItem` under `targetFolderId`.
 * Photos (if any and `copyPhotos`) are physically copied to fresh Storage
 * paths under the new item id so the two items are fully isolated.
 *
 * Returns `{ doc, photoCount }` — the caller is responsible for writing
 * the doc and incrementing folder.itemCount. eBay state is deliberately
 * reset; duplicates are not relistings.
 */
export async function buildDuplicatedItem(opts: {
  srcItem: ItemDoc;
  srcSchema: FieldDef[];
  targetFolderId: string;
  newItemId: string;
  uid: string;
  copyPhotos: boolean;
  now: number;
}): Promise<{ doc: ItemDoc; photoCount: number }> {
  const { srcItem, srcSchema, targetFolderId, newItemId, uid, copyPhotos, now } =
    opts;

  const newPhotos: PhotoRef[] = [];
  let photoCount = 0;
  if (copyPhotos && (srcItem.photos?.length ?? 0) > 0) {
    const bucket = getStorage().bucket(INVENTORY_BUCKET);
    for (const photo of srcItem.photos!) {
      const ext = photo.storagePath.substring(photo.storagePath.lastIndexOf("."));
      const newPath = `inventory/${newItemId}/${randomUUID()}${ext}`;
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
        console.warn("photo copy failed", photo.storagePath, e);
      }
    }
  }

  const doc: ItemDoc = {
    folderId: targetFolderId,
    fields: srcItem.fields,
    photos: newPhotos,
    ebay: defaultEbayBlock(),
    eanCodes: extractEanCodes(srcItem.fields, srcSchema),
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
    deletedAt: null,
  };
  return { doc, photoCount };
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

  const { parentFolderId, name, fieldSchema, platformTags } = request.data as {
    parentFolderId?: string | null;
    name: string;
    fieldSchema?: FieldDef[];
    platformTags?: string[];
  };

  const cleanName = validateName(name);
  const parent = parentFolderId ?? null;
  const pathSegments = await resolvePath(parent, cleanName);
  const tags = cleanTags(platformTags);

  // Explicit schema wins (still gets its tag columns guaranteed); otherwise
  // seed from the chosen tags (empty tags → canonical core).
  const schema = fieldSchema
    ? ensureTagColumns(validateFieldSchema(fieldSchema), tags)
    : fieldsForTags(tags);

  const now = Date.now();
  const ref = db.collection("inventoryFolders").doc();
  const doc: FolderDoc = {
    name: cleanName,
    parentFolderId: parent,
    pathSegments,
    fieldSchema: schema,
    platformTags: tags,
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
    after: { name: cleanName, parentFolderId: parent, platformTags: tags },
  });

  return { id: ref.id, ...doc };
});

export const inventoryUpdateFolder = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { folderId, name, fieldSchema, parentFolderId, platformTags } =
    request.data as {
      folderId: string;
      name?: string;
      fieldSchema?: FieldDef[];
      parentFolderId?: string | null;
      platformTags?: string[];
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

  // Tag/schema interplay: whenever either changes, recompute the schema's
  // platform columns from the folder's full tag list (adds missing columns,
  // refreshes badges, keeps removed-tag columns + their data). Non-destructive.
  const tagsProvided = platformTags !== undefined;
  const newTags = tagsProvided ? cleanTags(platformTags) : existing.platformTags ?? [];
  if (fieldSchema || tagsProvided) {
    const base = fieldSchema ? validateFieldSchema(fieldSchema) : existing.fieldSchema;
    updates.fieldSchema = ensureTagColumns(base, newTags);
  }
  if (tagsProvided) {
    updates.platformTags = newTags;
  }

  await ref.update(updates);

  await appendAudit({
    action: "folder.update",
    actorUid: uid,
    folderId,
    before: {
      name: existing.name,
      parentFolderId: existing.parentFolderId,
      platformTags: existing.platformTags ?? [],
    },
    after: { name: newName, parentFolderId: newParent, platformTags: newTags },
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
      platformTags: src.platformTags ?? [],
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

      for (const srcItemDoc of itemsSnap.docs) {
        const srcItem = srcItemDoc.data() as ItemDoc;
        const newItemRef = db.collection("inventoryItems").doc();
        const { doc: newItem, photoCount: copiedPhotos } =
          await buildDuplicatedItem({
            srcItem,
            srcSchema: src.fieldSchema,
            targetFolderId: newFolderRef.id,
            newItemId: newItemRef.id,
            uid,
            copyPhotos: true,
            now,
          });
        await newItemRef.set(newItem);
        itemCount++;
        photoCount += copiedPhotos;
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
