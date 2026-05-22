import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";
import type { ItemDoc } from "./shared";

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
