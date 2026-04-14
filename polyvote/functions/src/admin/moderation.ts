import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireRole, requireAuth } from "../utils/adminOnly";
import { validateString } from "../utils/validation";

/**
 * Any authenticated user: report content (comment, topic, or topicRequest).
 */
export const reportContent = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = getFirestore();

  const { type, targetId, parentId, reason, description } = request.data as {
    type: "comment" | "topic" | "topicRequest";
    targetId: string;
    parentId?: string;
    reason: string;
    description?: string;
  };

  if (!["comment", "topic", "topicRequest"].includes(type)) {
    throw new HttpsError("invalid-argument", "Invalid content type.");
  }
  if (!targetId) {
    throw new HttpsError("invalid-argument", "targetId is required.");
  }

  const validReasons = [
    "spam",
    "harassment",
    "misinformation",
    "inappropriate",
    "other",
  ];
  if (!validReasons.includes(reason)) {
    throw new HttpsError(
      "invalid-argument",
      `reason must be one of: ${validReasons.join(", ")}`
    );
  }

  // Rate limit: max 10 reports per hour per user
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentReports = await db
    .collection("reports")
    .where("reporterId", "==", uid)
    .where("createdAt", ">", oneHourAgo)
    .count()
    .get();

  if (recentReports.data().count >= 10) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many reports. Please try again later."
    );
  }

  const report = {
    type,
    targetId,
    parentId: parentId || null,
    reporterId: uid,
    reason,
    description: description
      ? validateString(description, "description", 500)
      : null,
    status: "pending" as const,
    createdAt: Date.now(),
  };

  const ref = await db.collection("reports").add(report);
  return { id: ref.id };
});

/**
 * Moderator+: delete a comment from a topic's comments subcollection.
 */
export const adminDeleteComment = onCall(async (request) => {
  requireRole(request, "moderator");
  const db = getFirestore();

  const { topicId, commentId } = request.data as {
    topicId: string;
    commentId: string;
  };

  if (!topicId || !commentId) {
    throw new HttpsError(
      "invalid-argument",
      "topicId and commentId are required."
    );
  }

  const commentRef = db
    .collection("topics")
    .doc(topicId)
    .collection("comments")
    .doc(commentId);
  const snap = await commentRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Comment not found.");
  }

  await commentRef.delete();

  // Decrement comment count on author
  const authorId = snap.data()?.authorId;
  if (authorId) {
    const userRef = db.collection("users").doc(authorId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      await userRef.update({ commentsCount: FieldValue.increment(-1) });
    }
  }

  // Audit
  await db.collection("auditLog").add({
    action: "comment.deleted",
    actorId: request.auth!.uid,
    targetType: "comment",
    targetId: commentId,
    metadata: { topicId, text: snap.data()?.text?.slice(0, 100) },
    timestamp: Date.now(),
  });

  return { success: true };
});

/**
 * Moderator+: review a report (mark as reviewed, action-taken, or dismissed).
 */
export const adminReviewReport = onCall(async (request) => {
  requireRole(request, "moderator");
  const db = getFirestore();

  const { reportId, status } = request.data as {
    reportId: string;
    status: "reviewed" | "action-taken" | "dismissed";
  };

  if (!reportId) {
    throw new HttpsError("invalid-argument", "reportId is required.");
  }

  const validStatuses = ["reviewed", "action-taken", "dismissed"];
  if (!validStatuses.includes(status)) {
    throw new HttpsError(
      "invalid-argument",
      `status must be one of: ${validStatuses.join(", ")}`
    );
  }

  const reportRef = db.collection("reports").doc(reportId);
  const snap = await reportRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Report not found.");
  }

  await reportRef.update({
    status,
    reviewedBy: request.auth!.uid,
    reviewedAt: Date.now(),
  });

  return { success: true };
});

/**
 * Moderator+: list reports with optional filters.
 */
export const adminListReports = onCall(async (request) => {
  requireRole(request, "moderator");
  const db = getFirestore();

  const { pageSize = 20, statusFilter, startAfter } = request.data as {
    pageSize?: number;
    statusFilter?: string;
    startAfter?: string;
  };

  let q = db.collection("reports").orderBy("createdAt", "desc");

  if (statusFilter) {
    q = q.where("status", "==", statusFilter);
  }
  if (startAfter) {
    const startDoc = await db.collection("reports").doc(startAfter).get();
    if (startDoc.exists) {
      q = q.startAfter(startDoc);
    }
  }

  const snap = await q.limit(Math.min(pageSize, 50)).get();
  const reports = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return {
    reports,
    hasMore: snap.docs.length === Math.min(pageSize, 50),
    lastId: snap.docs[snap.docs.length - 1]?.id || null,
  };
});
