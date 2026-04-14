import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";

const REQUEST_ENDORSEMENTS_NEEDED = 2;

/**
 * Trigger: fires when a topicRequest document is updated.
 * When endorsementCount reaches the threshold, automatically promote:
 *   1. Create a new topic in the `topics` collection
 *   2. Mark the request as `promoted`
 */
export const onTopicRequestEndorsed = onDocumentUpdated(
  "topicRequests/{requestId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only act if endorsement count increased and threshold is now met
    if (after.endorsementCount <= before.endorsementCount) return;
    if (after.status !== "pending") return;
    if (after.endorsementCount < REQUEST_ENDORSEMENTS_NEEDED) return;

    const db = getFirestore();
    const batch = db.batch();

    // Create the new topic
    const topicRef = db.collection("topics").doc();
    batch.create(topicRef, {
      title: after.title,
      description: after.description,
      category: after.category,
      metrics: after.metrics,
      totalVotes: 0,
      createdAt: Date.now(),
    });

    // Mark request as promoted
    batch.update(event.data!.after.ref, { status: "promoted" });

    // Audit log
    const auditRef = db.collection("auditLog").doc();
    batch.create(auditRef, {
      action: "topic.promoted",
      actorId: "system",
      targetType: "topicRequest",
      targetId: event.params.requestId,
      metadata: {
        newTopicId: topicRef.id,
        title: after.title,
        endorsementCount: after.endorsementCount,
      },
      timestamp: Date.now(),
    });

    await batch.commit();
  }
);
