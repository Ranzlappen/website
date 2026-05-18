import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { requireRole } from "../utils/adminOnly";
import { appendAudit, type ItemDoc, type PhotoRef } from "./shared";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function publicUrl(bucket: string, path: string): string {
  // Storage objects made public are served by Google's CDN under this URL.
  // eBay's PicURL field requires publicly-fetchable URLs.
  return `https://storage.googleapis.com/${bucket}/${path}`;
}

export const inventoryUploadPhoto = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { itemId, filename, base64Data, width, height } = request.data as {
    itemId: string;
    filename: string;
    base64Data: string;
    width?: number;
    height?: number;
  };

  if (!itemId || !filename || !base64Data) {
    throw new HttpsError(
      "invalid-argument",
      "itemId, filename, and base64Data are required."
    );
  }

  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  const contentType = ALLOWED_EXTENSIONS[ext];
  if (!contentType) {
    throw new HttpsError(
      "invalid-argument",
      `File type must be one of: ${Object.keys(ALLOWED_EXTENSIONS).join(", ")}`
    );
  }

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0) {
    throw new HttpsError("invalid-argument", "Empty file.");
  }
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new HttpsError(
      "invalid-argument",
      `Image must be under ${MAX_SIZE_BYTES / 1024 / 1024}MB.`
    );
  }

  const itemRef = db.collection("inventoryItems").doc(itemId);
  const snap = await itemRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "item not found.");
  }
  const existing = snap.data() as ItemDoc;
  if (existing.deletedAt) {
    throw new HttpsError("failed-precondition", "item is deleted.");
  }
  if ((existing.photos ?? []).length >= 24) {
    // eBay allows up to 24 photos per listing.
    throw new HttpsError("failed-precondition", "Photo limit (24) reached.");
  }

  const storagePath = `inventory/${itemId}/${randomUUID()}${ext}`;
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        uploadedBy: uid,
        itemId,
        originalFilename: filename,
      },
    },
  });
  await file.makePublic();

  const photo: PhotoRef = {
    storagePath,
    downloadUrl: publicUrl(bucket.name, storagePath),
    filename,
    sizeBytes: buffer.length,
    width: typeof width === "number" ? width : 0,
    height: typeof height === "number" ? height : 0,
    order: (existing.photos ?? []).length,
  };

  await itemRef.update({
    photos: [...(existing.photos ?? []), photo],
    updatedAt: Date.now(),
  });

  await appendAudit({
    action: "photo.upload",
    actorUid: uid,
    itemId,
    folderId: existing.folderId,
    after: { storagePath, filename },
  });

  return photo;
});

export const inventoryDeletePhoto = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { itemId, storagePath } = request.data as {
    itemId: string;
    storagePath: string;
  };
  if (!itemId || !storagePath) {
    throw new HttpsError(
      "invalid-argument",
      "itemId and storagePath are required."
    );
  }
  if (!storagePath.startsWith(`inventory/${itemId}/`)) {
    // Defence in depth: don't let the client name an arbitrary object.
    throw new HttpsError("permission-denied", "storagePath mismatch.");
  }

  const itemRef = db.collection("inventoryItems").doc(itemId);
  const snap = await itemRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "item not found.");
  }
  const existing = snap.data() as ItemDoc;
  const filtered = (existing.photos ?? [])
    .filter((p) => p.storagePath !== storagePath)
    .map((p, i) => ({ ...p, order: i }));

  try {
    await getStorage().bucket().file(storagePath).delete({ ignoreNotFound: true });
  } catch (e) {
    // Best effort — even if the object is already gone, drop it from the doc.
    console.warn("storage delete failed", storagePath, e);
  }

  await itemRef.update({ photos: filtered, updatedAt: Date.now() });

  await appendAudit({
    action: "photo.delete",
    actorUid: uid,
    itemId,
    folderId: existing.folderId,
    before: { storagePath },
  });

  return { success: true, photos: filtered };
});

export const inventoryReorderPhotos = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { itemId, photoOrder } = request.data as {
    itemId: string;
    photoOrder: string[];
  };
  if (!itemId || !Array.isArray(photoOrder)) {
    throw new HttpsError(
      "invalid-argument",
      "itemId and photoOrder[] are required."
    );
  }

  const itemRef = db.collection("inventoryItems").doc(itemId);
  const snap = await itemRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "item not found.");
  }
  const existing = snap.data() as ItemDoc;
  const map = new Map((existing.photos ?? []).map((p) => [p.storagePath, p]));

  const reordered: PhotoRef[] = [];
  photoOrder.forEach((path, i) => {
    const p = map.get(path);
    if (p) reordered.push({ ...p, order: i });
  });
  // Append any photos not mentioned in the reorder list (defensive).
  existing.photos?.forEach((p) => {
    if (!photoOrder.includes(p.storagePath)) {
      reordered.push({ ...p, order: reordered.length });
    }
  });

  await itemRef.update({ photos: reordered, updatedAt: Date.now() });

  await appendAudit({
    action: "photo.reorder",
    actorUid: uid,
    itemId,
    folderId: existing.folderId,
  });

  return { success: true, photos: reordered };
});
