import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";
import {
  validateString,
  validateCategory,
  validateMetrics,
} from "../utils/validation";

/**
 * Admin: create a topic directly (bypasses proposal flow).
 */
export const adminCreateTopic = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const title = validateString(request.data.title, "title", 200);
  const description = validateString(
    request.data.description,
    "description",
    2000
  );
  const category = validateCategory(request.data.category);
  const metrics = validateMetrics(request.data.metrics);

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
    actorId: request.auth!.uid,
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
export const adminEditTopic = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const { topicId, updates } = request.data as {
    topicId: string;
    updates: Record<string, unknown>;
  };

  if (!topicId) {
    throw new HttpsError("invalid-argument", "topicId is required.");
  }

  const topicRef = db.collection("topics").doc(topicId);
  const snap = await topicRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Topic not found.");
  }

  // Build safe update object
  const safeUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) {
    safeUpdates.title = validateString(updates.title, "title", 200);
  }
  if (updates.description !== undefined) {
    safeUpdates.description = validateString(
      updates.description,
      "description",
      2000
    );
  }
  if (updates.category !== undefined) {
    safeUpdates.category = validateCategory(updates.category);
  }
  if (updates.metrics !== undefined) {
    safeUpdates.metrics = validateMetrics(updates.metrics);
  }

  if (Object.keys(safeUpdates).length === 0) {
    throw new HttpsError("invalid-argument", "No valid fields to update.");
  }

  await topicRef.update(safeUpdates);

  // Audit
  await db.collection("auditLog").add({
    action: "topic.edited",
    actorId: request.auth!.uid,
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
export const adminDeleteTopic = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const { topicId } = request.data as { topicId: string };
  if (!topicId) {
    throw new HttpsError("invalid-argument", "topicId is required.");
  }

  const topicRef = db.collection("topics").doc(topicId);
  const snap = await topicRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Topic not found.");
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
    actorId: request.auth!.uid,
    targetType: "topic",
    targetId: topicId,
    metadata: { title },
    timestamp: Date.now(),
  });

  return { success: true };
});
