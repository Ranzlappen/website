/**
 * Trigger: fires when a topicRequest document is updated.
 * When endorsementCount reaches the threshold, automatically promote:
 *   1. Create a new topic in the `topics` collection
 *   2. Mark the request as `promoted`
 */
export declare const onTopicRequestEndorsed: import("firebase-functions/v2/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").Change<import("firebase-functions/v2/firestore").QueryDocumentSnapshot> | undefined, {
    requestId: string;
}>>;
