"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDeleteTopic = exports.adminEditTopic = exports.adminCreateTopic = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const adminOnly_1 = require("../utils/adminOnly");
const validation_1 = require("../utils/validation");
/**
 * Admin: create a topic directly (bypasses proposal flow).
 */
exports.adminCreateTopic = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "admin");
    const db = (0, firestore_1.getFirestore)();
    const title = (0, validation_1.validateString)(request.data.title, "title", 200);
    const description = (0, validation_1.validateString)(request.data.description, "description", 2000);
    const category = (0, validation_1.validateCategory)(request.data.category);
    const metrics = (0, validation_1.validateMetrics)(request.data.metrics);
    const topicRef = db.collection("topics").doc();
    const topic = {
        title,
        description,
        category,
        metrics: metrics.map((m) => ({
            ...m,
            choices: m.choices.map((c) => ({ ...c, votes: 0 })),
        })),
        totalVotes: 0,
        createdAt: Date.now(),
    };
    await topicRef.set(topic);
    // Audit
    await db.collection("auditLog").add({
        action: "topic.created",
        actorId: request.auth.uid,
        targetType: "topic",
        targetId: topicRef.id,
        metadata: { title },
        timestamp: Date.now(),
    });
    return { id: topicRef.id, ...topic };
});
/**
 * Admin: edit a topic (bypasses immutability rules).
 */
exports.adminEditTopic = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "admin");
    const db = (0, firestore_1.getFirestore)();
    const { topicId, updates } = request.data;
    if (!topicId) {
        throw new https_1.HttpsError("invalid-argument", "topicId is required.");
    }
    const topicRef = db.collection("topics").doc(topicId);
    const snap = await topicRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Topic not found.");
    }
    // Build safe update object
    const safeUpdates = {};
    if (updates.title !== undefined) {
        safeUpdates.title = (0, validation_1.validateString)(updates.title, "title", 200);
    }
    if (updates.description !== undefined) {
        safeUpdates.description = (0, validation_1.validateString)(updates.description, "description", 2000);
    }
    if (updates.category !== undefined) {
        safeUpdates.category = (0, validation_1.validateCategory)(updates.category);
    }
    if (updates.metrics !== undefined) {
        safeUpdates.metrics = (0, validation_1.validateMetrics)(updates.metrics);
    }
    if (Object.keys(safeUpdates).length === 0) {
        throw new https_1.HttpsError("invalid-argument", "No valid fields to update.");
    }
    await topicRef.update(safeUpdates);
    // Audit
    await db.collection("auditLog").add({
        action: "topic.edited",
        actorId: request.auth.uid,
        targetType: "topic",
        targetId: topicId,
        metadata: { updatedFields: Object.keys(safeUpdates) },
        timestamp: Date.now(),
    });
    return { success: true };
});
/**
 * Admin: delete a topic and its comments subcollection.
 */
exports.adminDeleteTopic = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "admin");
    const db = (0, firestore_1.getFirestore)();
    const { topicId } = request.data;
    if (!topicId) {
        throw new https_1.HttpsError("invalid-argument", "topicId is required.");
    }
    const topicRef = db.collection("topics").doc(topicId);
    const snap = await topicRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Topic not found.");
    }
    const title = snap.data()?.title;
    // Delete all comments in the subcollection
    const commentsSnap = await topicRef.collection("comments").get();
    const batch = db.batch();
    commentsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(topicRef);
    await batch.commit();
    // Delete related vote records
    const votesSnap = await db
        .collection("votes")
        .where("topicId", "==", topicId)
        .get();
    if (!votesSnap.empty) {
        const voteBatch = db.batch();
        votesSnap.docs.forEach((doc) => voteBatch.delete(doc.ref));
        await voteBatch.commit();
    }
    // Audit
    await db.collection("auditLog").add({
        action: "topic.deleted",
        actorId: request.auth.uid,
        targetType: "topic",
        targetId: topicId,
        metadata: { title },
        timestamp: Date.now(),
    });
    return { success: true };
});
//# sourceMappingURL=topics.js.map