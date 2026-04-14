"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endorseTopicRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const adminOnly_1 = require("../utils/adminOnly");
/**
 * Server-validated topic request endorsement.
 * - Uses transaction to prevent race conditions and duplicate endorsements
 * - Checks user is not banned
 * - Prevents self-endorsement by author (author auto-endorses on creation)
 * - Atomically updates endorsers array and count
 */
exports.endorseTopicRequest = (0, https_1.onCall)(async (request) => {
    const uid = (0, adminOnly_1.requireAuth)(request);
    const db = (0, firestore_1.getFirestore)();
    const { requestId } = request.data;
    if (!requestId || typeof requestId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "requestId is required.");
    }
    // Check if user is banned
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.status === "banned") {
        throw new https_1.HttpsError("permission-denied", "Your account has been banned.");
    }
    const reqRef = db.collection("topicRequests").doc(requestId);
    const result = await db.runTransaction(async (tx) => {
        const reqSnap = await tx.get(reqRef);
        if (!reqSnap.exists) {
            throw new https_1.HttpsError("not-found", "Topic request not found.");
        }
        const data = reqSnap.data();
        if (data.status !== "pending") {
            throw new https_1.HttpsError("failed-precondition", "This request is no longer accepting endorsements.");
        }
        if (data.expiresAt <= Date.now()) {
            throw new https_1.HttpsError("failed-precondition", "This request has expired.");
        }
        const endorsers = data.endorsers || [];
        if (endorsers.includes(uid)) {
            throw new https_1.HttpsError("already-exists", "You have already endorsed this request.");
        }
        tx.update(reqRef, {
            endorsers: firestore_1.FieldValue.arrayUnion(uid),
            endorsementCount: firestore_1.FieldValue.increment(1),
        });
        return { newCount: (data.endorsementCount || 0) + 1 };
    });
    return result;
});
//# sourceMappingURL=endorseTopicRequest.js.map