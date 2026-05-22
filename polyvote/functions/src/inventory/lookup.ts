import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";
import type { ItemDoc } from "./shared";

const MAX_SCAN = 1000;

/**
 * Find any non-deleted items whose denormalized `eanCodes` array contains
 * the scanned code. Used by the global scan-to-find button: 0 matches → offer
 * to create new; 1 match → jump straight to its editor; 2+ → show a picker.
 */
export const inventoryFindByEan = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const { code } = request.data as { code: string };
  const clean = (code ?? "").toString().trim();
  if (!clean) {
    throw new HttpsError("invalid-argument", "code is required.");
  }

  // array-contains uses the auto-created single-field index on `eanCodes`.
  // Filter `deletedAt` client-side here in the function — small N keeps it cheap
  // and avoids the composite index dance.
  const snap = await db
    .collection("inventoryItems")
    .where("eanCodes", "array-contains", clean)
    .limit(20)
    .get();

  const matches = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as ItemDoc) }))
    .filter((it) => !it.deletedAt);

  return { matches };
});

/**
 * Global free-text search across all non-deleted items. Loads up to
 * MAX_SCAN docs (ordered by updatedAt desc) and filters in-memory by
 * checking if any string field value or eanCodes entry contains the
 * lowercased query. `truncated` signals the user that some items past
 * the cap weren't considered — fine for now; we can move to a denormalized
 * searchText field once the inventory grows past a few thousand items.
 */
export const inventorySearchItems = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const { query, limit } = request.data as { query: string; limit?: number };
  const q = (query ?? "").toString().trim().toLowerCase();
  if (!q) {
    throw new HttpsError("invalid-argument", "query is required.");
  }
  const cap = Math.min(Math.max(limit ?? 200, 1), 500);

  const snap = await db
    .collection("inventoryItems")
    .where("deletedAt", "==", null)
    .orderBy("updatedAt", "desc")
    .limit(MAX_SCAN)
    .get();

  const truncated = snap.size >= MAX_SCAN;
  const out: (ItemDoc & { id: string })[] = [];

  for (const doc of snap.docs) {
    const data = doc.data() as ItemDoc;
    const haystack: string[] = [];
    for (const v of Object.values(data.fields ?? {})) {
      if (typeof v === "string") haystack.push(v.toLowerCase());
      else if (typeof v === "number") haystack.push(String(v));
    }
    (data.eanCodes ?? []).forEach((c) => haystack.push(c));
    if (data.ebay?.listingId) haystack.push(String(data.ebay.listingId).toLowerCase());

    if (haystack.some((s) => s.includes(q))) {
      out.push({ id: doc.id, ...data });
      if (out.length >= cap) break;
    }
  }

  return { items: out, truncated };
});
