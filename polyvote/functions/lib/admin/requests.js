"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminBulkUpdateRequests = exports.adminUpdateRequestStatus = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const adminOnly_1 = require("../utils/adminOnly");
/**
 * Moderator+: approve or reject a change request.
 */
exports.adminUpdateRequestStatus = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "moderator");
    const db = (0, firestore_1.getFirestore)();
    const { requestId, status } = request.data;
    if (!requestId) {
        throw new https_1.HttpsError("invalid-argument", "requestId is required.");
    }
    if (!["approved", "rejected"].includes(status)) {
        throw new https_1.HttpsError("invalid-argument", 'status must be "approved" or "rejected".');
    }
    const reqRef = db.collection("requests").doc(requestId);
    const snap = await reqRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Request not found.");
    }
    if (snap.data()?.status !== "pending") {
        throw new https_1.HttpsError("failed-precondition", "Can only update pending requests.");
    }
    await reqRef.update({
        status,
        reviewedBy: request.auth.uid,
        reviewedAt: Date.now(),
    });
    // Audit
    await db.collection("auditLog").add({
        action: `request.${status}`,
        actorId: request.auth.uid,
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
exports.adminBulkUpdateRequests = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "moderator");
    const db = (0, firestore_1.getFirestore)();
    const { requestIds, status } = request.data;
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "requestIds must be a non-empty array.");
    }
    if (requestIds.length > 50) {
        throw new https_1.HttpsError("invalid-argument", "Can update at most 50 requests at once.");
    }
    const batch = db.batch();
    const now = Date.now();
    for (const id of requestIds) {
        const ref = db.collection("requests").doc(id);
        batch.update(ref, {
            status,
            reviewedBy: request.auth.uid,
            reviewedAt: now,
        });
    }
    await batch.commit();
    // Audit
    await db.collection("auditLog").add({
        action: `requests.bulk_${status}`,
        actorId: request.auth.uid,
        targetType: "changeRequests",
        targetId: "batch",
        metadata: { count: requestIds.length, requestIds },
        timestamp: Date.now(),
    });
    return { success: true, count: requestIds.length };
});
//# sourceMappingURL=requests.js.map