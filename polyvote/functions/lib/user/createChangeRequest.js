"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChangeRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const adminOnly_1 = require("../utils/adminOnly");
/**
 * Server-validated change request creation.
 * - Validates topicId references a real topic
 * - Validates request type and description
 * - Checks user is not banned
 */
exports.createChangeRequest = (0, https_1.onCall)(async (request) => {
    const uid = (0, adminOnly_1.requireAuth)(request);
    const db = (0, firestore_1.getFirestore)();
    const { topicId, topicTitle, type, description } = request.data;
    if (!topicId || typeof topicId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "topicId is required.");
    }
    if (!topicTitle || typeof topicTitle !== "string") {
        throw new https_1.HttpsError("invalid-argument", "topicTitle is required.");
    }
    const validTypes = ["edit", "add", "delete"];
    if (!type || !validTypes.includes(type)) {
        throw new https_1.HttpsError("invalid-argument", "Type must be edit, add, or delete.");
    }
    if (!description || typeof description !== "string") {
        throw new https_1.HttpsError("invalid-argument", "Description is required.");
    }
    const trimDesc = description.trim();
    if (trimDesc.length === 0 || trimDesc.length > 2000) {
        throw new https_1.HttpsError("invalid-argument", "Description must be between 1 and 2000 characters.");
    }
    // Check if user is banned
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.status === "banned") {
        throw new https_1.HttpsError("permission-denied", "Your account has been banned.");
    }
    // Verify topic exists
    const topicDoc = await db.collection("topics").doc(topicId).get();
    if (!topicDoc.exists) {
        throw new https_1.HttpsError("not-found", "Topic not found.");
    }
    const docRef = await db.collection("requests").add({
        topicId,
        topicTitle: topicTitle.trim(),
        type,
        description: trimDesc,
        status: "pending",
        createdAt: Date.now(),
        authorId: uid,
    });
    return { id: docRef.id };
});
//# sourceMappingURL=createChangeRequest.js.map