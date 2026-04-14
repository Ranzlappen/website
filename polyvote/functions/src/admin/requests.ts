import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";

/**
 * Moderator+: approve or reject a change request.
 */
export const adminUpdateRequestStatus = onCall(async (request) => {
  requireRole(request, "moderator");
  const db = getFirestore();

  const { requestId, status } = request.data as {
    requestId: string;
    status: "approved" | "rejected";
  };

  if (!requestId) {
    throw new HttpsError("invalid-argument", "requestId is required.");
  }
  if (!["approved", "rejected"].includes(status)) {
    throw new HttpsError(
      "invalid-argument",
      'status must be "approved" or "rejected".'
    );
  }

  const reqRef = db.collection("requests").doc(requestId);
  const snap = await reqRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Request not found.");
  }

  if (snap.data()?.status !== "pending") {
    throw new HttpsError(
      "failed-precondition",
      "Can only update pending requests."
    );
  }

  await reqRef.update({
    status,
    reviewedBy: request.auth!.uid,
    reviewedAt: Date.now(),
  });

  // Audit
  await db.collection("auditLog").add({
    action: `request.${status}`,
    actorId: request.auth!.uid,
    targetType: "changeRequest",
    targetId: requestId,
    metadata: {
      topicId: snap.data()?.topicId,
      type: snap.data()?.type,
    },
    timestamp: Date.now(),
  });

  return { success: true };
});

/**
 * Moderator+: bulk approve/reject change requests.
 */
export const adminBulkUpdateRequests = onCall(async (request) => {
  requireRole(request, "moderator");
  const db = getFirestore();

  const { requestIds, status } = request.data as {
    requestIds: string[];
    status: "approved" | "rejected";
  };

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "requestIds must be a non-empty array."
    );
  }
  if (requestIds.length > 50) {
    throw new HttpsError(
      "invalid-argument",
      "Can update at most 50 requests at once."
    );
  }

  const batch = db.batch();
  const now = Date.now();

  for (const id of requestIds) {
    const ref = db.collection("requests").doc(id);
    batch.update(ref, {
      status,
      reviewedBy: request.auth!.uid,
      reviewedAt: now,
    });
  }

  await batch.commit();

  // Audit
  await db.collection("auditLog").add({
    action: `requests.bulk_${status}`,
    actorId: request.auth!.uid,
    targetType: "changeRequests",
    targetId: "batch",
    metadata: { count: requestIds.length, requestIds },
    timestamp: Date.now(),
  });

  return { success: true, count: requestIds.length };
});
