import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireAuth, requireNotBanned } from "../utils/adminOnly";

/**
 * Server-validated topic request endorsement.
 * - Uses transaction to prevent race conditions and duplicate endorsements
 * - Checks user is not banned
 * - Prevents self-endorsement by author (author auto-endorses on creation)
 * - Atomically updates endorsers array and count
 */
export const endorseTopicRequest = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = getFirestore();

  const { requestId } = request.data as { requestId: string };

  if (!requestId || typeof requestId !== "string") {
    throw new HttpsError("invalid-argument", "requestId is required.");
  }

  // Check if user is banned
  await requireNotBanned(uid);

  const reqRef = db.collection("topicRequests").doc(requestId);

  const result = await db.runTransaction(async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists) {
      throw new HttpsError("not-found", "Topic request not found.");
    }

    const data = reqSnap.data()!;

    if (data.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        "This request is no longer accepting endorsements."
      );
    }

    if (data.expiresAt <= Date.now()) {
      throw new HttpsError(
        "failed-precondition",
        "This request has expired."
      );
    }

    const endorsers = (data.endorsers as string[]) || [];
    if (endorsers.includes(uid)) {
      throw new HttpsError(
        "already-exists",
        "You have already endorsed this request."
      );
    }

    tx.update(reqRef, {
      endorsers: FieldValue.arrayUnion(uid),
      endorsementCount: FieldValue.increment(1),
    });

    return { newCount: (data.endorsementCount || 0) + 1 };
  });

  return result;
});
