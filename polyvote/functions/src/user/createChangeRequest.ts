import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireAuth } from "../utils/adminOnly";
import { moderateContent } from "../utils/contentFilter";

/**
 * Server-validated change request creation.
 * - Validates topicId references a real topic
 * - Validates request type and description
 * - Checks user is not banned
 */
export const createChangeRequest = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = getFirestore();

  const { topicId, topicTitle, type, description } = request.data as {
    topicId: string;
    topicTitle: string;
    type: string;
    description: string;
  };

  if (!topicId || typeof topicId !== "string") {
    throw new HttpsError("invalid-argument", "topicId is required.");
  }

  if (!topicTitle || typeof topicTitle !== "string") {
    throw new HttpsError("invalid-argument", "topicTitle is required.");
  }

  const validTypes = ["edit", "add", "delete"];
  if (!type || !validTypes.includes(type)) {
    throw new HttpsError("invalid-argument", "Type must be edit, add, or delete.");
  }

  if (!description || typeof description !== "string") {
    throw new HttpsError("invalid-argument", "Description is required.");
  }
  const trimDesc = description.trim();
  if (trimDesc.length === 0 || trimDesc.length > 2000) {
    throw new HttpsError(
      "invalid-argument",
      "Description must be between 1 and 2000 characters."
    );
  }

  // Content moderation
  const modResult = moderateContent(trimDesc);
  if (modResult.blocked) {
    throw new HttpsError("invalid-argument", modResult.reason!);
  }

  // Check if user is banned
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists && userDoc.data()?.status === "banned") {
    throw new HttpsError("permission-denied", "Your account has been banned.");
  }

  // Verify topic exists
  const topicDoc = await db.collection("topics").doc(topicId).get();
  if (!topicDoc.exists) {
    throw new HttpsError("not-found", "Topic not found.");
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
