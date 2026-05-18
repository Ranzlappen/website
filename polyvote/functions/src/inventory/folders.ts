import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";
import {
  appendAudit,
  defaultFieldSchema,
  validateFieldSchema,
  type FieldDef,
  type FolderDoc,
} from "./shared";

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
