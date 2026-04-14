"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminListReports = exports.adminReviewReport = exports.adminDeleteComment = exports.reportContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const adminOnly_1 = require("../utils/adminOnly");
const validation_1 = require("../utils/validation");
/**
 * Any authenticated user: report content (comment, topic, or topicRequest).
 */
exports.reportContent = (0, https_1.onCall)(async (request) => {
    const uid = (0, adminOnly_1.requireAuth)(request);
    const db = (0, firestore_1.getFirestore)();
    const { type, targetId, parentId, reason, description } = request.data;
    if (!["comment", "topic", "topicRequest"].includes(type)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid content type.");
    }
    if (!targetId) {
        throw new https_1.HttpsError("invalid-argument", "targetId is required.");
    }
    const validReasons = [
        "spam",
        "harassment",
        "misinformation",
        "inappropriate",
        "other",
    ];
    if (!validReasons.includes(reason)) {
        throw new https_1.HttpsError("invalid-argument", `reason must be one of: ${validReasons.join(", ")}`);
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
        throw new https_1.HttpsError("resource-exhausted", "Too many reports. Please try again later.");
    }
    const report = {
        type,
        targetId,
        parentId: parentId || null,
        reporterId: uid,
        reason,
        description: description
            ? (0, validation_1.validateString)(description, "description", 500)
            : null,
        status: "pending",
        createdAt: Date.now(),
    };
    const ref = await db.collection("reports").add(report);
    return { id: ref.id };
});
/**
 * Moderator+: delete a comment from a topic's comments subcollection.
 */
exports.adminDeleteComment = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "moderator");
    const db = (0, firestore_1.getFirestore)();
    const { topicId, commentId } = request.data;
    if (!topicId || !commentId) {
        throw new https_1.HttpsError("invalid-argument", "topicId and commentId are required.");
    }
    const commentRef = db
        .collection("topics")
        .doc(topicId)
        .collection("comments")
        .doc(commentId);
    const snap = await commentRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Comment not found.");
    }
    await commentRef.delete();
    // Decrement comment count on author
    const authorId = snap.data()?.authorId;
    if (authorId) {
        const userRef = db.collection("users").doc(authorId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            await userRef.update({ commentsCount: firestore_1.FieldValue.increment(-1) });
        }
    }
    // Audit
    await db.collection("auditLog").add({
        action: "comment.deleted",
        actorId: request.auth.uid,
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
exports.adminReviewReport = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "moderator");
    const db = (0, firestore_1.getFirestore)();
    const { reportId, status } = request.data;
    if (!reportId) {
        throw new https_1.HttpsError("invalid-argument", "reportId is required.");
    }
    const validStatuses = ["reviewed", "action-taken", "dismissed"];
    if (!validStatuses.includes(status)) {
        throw new https_1.HttpsError("invalid-argument", `status must be one of: ${validStatuses.join(", ")}`);
    }
    const reportRef = db.collection("reports").doc(reportId);
    const snap = await reportRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Report not found.");
    }
    await reportRef.update({
        status,
        reviewedBy: request.auth.uid,
        reviewedAt: Date.now(),
    });
    return { success: true };
});
/**
 * Moderator+: list reports with optional filters.
 */
exports.adminListReports = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "moderator");
    const db = (0, firestore_1.getFirestore)();
    const { pageSize = 20, statusFilter, startAfter } = request.data;
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
//# sourceMappingURL=moderation.js.map