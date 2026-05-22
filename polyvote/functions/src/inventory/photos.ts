import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { requireRole } from "../utils/adminOnly";
import { appendAudit, type ItemDoc, type PhotoRef } from "./shared";

// The project's Firebase Storage bucket. Pinned explicitly so we don't
// depend on whichever bucket the Admin SDK picks as "default" — Firebase
// projects created after the 2024 switchover use `.firebasestorage.app`
// rather than the legacy `.appspot.com` naming.
const INVENTORY_BUCKET = "proven-concept-436717-q3.firebasestorage.app";

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
  const bucket = getStorage().bucket(INVENTORY_BUCKET);
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
    await getStorage()
      .bucket(INVENTORY_BUCKET)
      .file(storagePath)
      .delete({ ignoreNotFound: true });
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

/**
 * Parse a user-supplied URL into a fetchable image URL.
 *
 * Accepts:
 *  - https://drive.google.com/file/d/<ID>/view…
 *  - https://drive.google.com/open?id=<ID>
 *  - https://drive.google.com/uc?id=<ID>…
 *  - raw 25–44-char Drive file id
 *  - any other HTTPS URL (passed through unchanged)
 *
 * Drive URLs are normalized to the public direct-download endpoint
 * `https://drive.google.com/uc?export=download&id=<ID>` so unauthenticated
 * fetch works as long as the file is shared "anyone with the link".
 */
export function resolveImageUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new HttpsError("invalid-argument", "url is required.");

  // Raw Drive file id heuristic.
  if (/^[a-zA-Z0-9_-]{25,60}$/.test(trimmed)) {
    return `https://drive.google.com/uc?export=download&id=${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpsError("invalid-argument", "url must be a valid URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new HttpsError("invalid-argument", "url must be http(s).");
  }

  // Drive variants → normalize to the direct-download endpoint.
  if (parsed.hostname === "drive.google.com") {
    let id: string | null = parsed.searchParams.get("id");
    if (!id) {
      const m = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      if (m) id = m[1];
    }
    if (id) {
      return `https://drive.google.com/uc?export=download&id=${id}`;
    }
  }

  return parsed.toString();
}

/**
 * Server-side fetch an image from a public URL (Drive direct link or any
 * other HTTPS image) and upload it to our Storage like a regular photo.
 * No user OAuth involved — the target must be publicly shared.
 */
export const inventoryImportPhotoFromUrl = onCall(
  { timeoutSeconds: 60 },
  async (request) => {
    requireRole(request, "admin");
    const db = getFirestore();
    const uid = request.auth!.uid;

    const { itemId, url } = request.data as { itemId: string; url: string };
    if (!itemId || !url) {
      throw new HttpsError("invalid-argument", "itemId and url are required.");
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
      throw new HttpsError("failed-precondition", "Photo limit (24) reached.");
    }

    const fetchUrl = resolveImageUrl(url);

    let res: Response;
    try {
      res = await fetch(fetchUrl, { redirect: "follow" });
    } catch (e) {
      throw new HttpsError(
        "unavailable",
        `Could not fetch URL: ${e instanceof Error ? e.message : "unknown error"}.`
      );
    }
    if (!res.ok) {
      throw new HttpsError(
        "unavailable",
        `Fetch returned HTTP ${res.status}. If this is a Drive link, ensure the file is shared "Anyone with the link".`
      );
    }

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const extByType: Record<string, string> = {
      "image/webp": ".webp",
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
    };
    const ext = extByType[contentType];
    if (!ext) {
      throw new HttpsError(
        "invalid-argument",
        `Unsupported image content-type: ${contentType || "unknown"}.`
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) {
      throw new HttpsError("invalid-argument", "Empty image body.");
    }
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new HttpsError(
        "invalid-argument",
        `Image must be under ${MAX_SIZE_BYTES / 1024 / 1024}MB.`
      );
    }

    const storagePath = `inventory/${itemId}/${randomUUID()}${ext}`;
    const bucket = getStorage().bucket(INVENTORY_BUCKET);
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000, immutable",
        metadata: {
          uploadedBy: uid,
          itemId,
          sourceUrl: fetchUrl,
        },
      },
    });
    await file.makePublic();

    const photo: PhotoRef = {
      storagePath,
      downloadUrl: publicUrl(bucket.name, storagePath),
      filename: fetchUrl.split("/").pop()?.split("?")[0] || "imported",
      sizeBytes: buffer.length,
      width: 0,
      height: 0,
      order: (existing.photos ?? []).length,
    };

    await itemRef.update({
      photos: [...(existing.photos ?? []), photo],
      updatedAt: Date.now(),
    });

    await appendAudit({
      action: "photo.importFromUrl",
      actorUid: uid,
      itemId,
      folderId: existing.folderId,
      after: { storagePath, sourceUrl: fetchUrl },
    });

    return photo;
  }
);
