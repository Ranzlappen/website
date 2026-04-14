"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postComment = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const adminOnly_1 = require("../utils/adminOnly");
/**
 * Server-validated comment posting.
 * - Checks user is authenticated and not banned
 * - Validates text length
 * - Rate limits to 10 comments per minute per user
 * - Atomically increments user's commentsCount
 */
exports.postComment = (0, https_1.onCall)(async (request) => {
    const uid = (0, adminOnly_1.requireAuth)(request);
    const db = (0, firestore_1.getFirestore)();
    const { topicId, text, parentId } = request.data;
    if (!topicId || typeof topicId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "topicId is required.");
    }
    if (!text || typeof text !== "string") {
        throw new https_1.HttpsError("invalid-argument", "Comment text is required.");
    }
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) {
        throw new https_1.HttpsError("invalid-argument", "Comment must be between 1 and 2000 characters.");
    }
    // Check if user is banned
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.status === "banned") {
        throw new https_1.HttpsError("permission-denied", "Your account has been banned.");
    }
    // Check topic exists
    const topicDoc = await db.collection("topics").doc(topicId).get();
    if (!topicDoc.exists) {
        throw new https_1.HttpsError("not-found", "Topic not found.");
    }
    // Rate limit: max 10 comments per minute
    const oneMinuteAgo = Date.now() - 60_000;
    const recentComments = await db
        .collectionGroup("comments")
        .where("authorId", "==", uid)
        .where("createdAt", ">", oneMinuteAgo)
        .count()
        .get();
    if (recentComments.data().count >= 10) {
        throw new https_1.HttpsError("resource-exhausted", "Too many comments. Please wait a moment.");
    }
    // Validate parentId if provided
    if (parentId) {
        const parentDoc = await db
            .collection("topics")
            .doc(topicId)
            .collection("comments")
            .doc(parentId)
            .get();
        if (!parentDoc.exists) {
            throw new https_1.HttpsError("not-found", "Parent comment not found.");
        }
    }
    // Generate display name from UID
    const hash = uid.slice(-4).toUpperCase();
    const displayName = `Voter #${hash}`;
    const now = Date.now();
    const batch = db.batch();
    // Create comment
    const commentRef = db
        .collection("topics")
        .doc(topicId)
        .collection("comments")
        .doc();
    batch.create(commentRef, {
        text: trimmed,
        authorId: uid,
        displayName,
        createdAt: now,
        ...(parentId ? { parentId } : {}),
    });
    // Increment user's commentsCount
    if (userDoc.exists) {
        batch.update(db.collection("users").doc(uid), {
            commentsCount: firestore_1.FieldValue.increment(1),
        });
    }
    await batch.commit();
    return { id: commentRef.id };
});
//# sourceMappingURL=postComment.js.map