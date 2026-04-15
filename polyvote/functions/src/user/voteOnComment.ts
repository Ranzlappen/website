import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireAuth, requireNotBanned } from "../utils/adminOnly";

/**
 * Vote on a comment (upvote or downvote).
 * - One vote per user per comment (toggle to remove, switch direction)
 * - Uses a subcollection `commentVotes` for deduplication
 */
export const voteOnComment = onCall(async (request) => {
  const uid = requireAuth(request);
  await requireNotBanned(uid);

  const { topicId, commentId, direction } = request.data as {
    topicId: string;
    commentId: string;
    direction: "up" | "down";
  };

  if (!topicId || typeof topicId !== "string") {
    throw new HttpsError("invalid-argument", "topicId is required.");
  }
  if (!commentId || typeof commentId !== "string") {
    throw new HttpsError("invalid-argument", "commentId is required.");
  }
  if (direction !== "up" && direction !== "down") {
    throw new HttpsError("invalid-argument", "direction must be 'up' or 'down'.");
  }

  const db = getFirestore();
  const commentRef = db
    .collection("topics")
    .doc(topicId)
    .collection("comments")
    .doc(commentId);

  const voteRef = commentRef.collection("commentVotes").doc(uid);

  return db.runTransaction(async (tx) => {
    const commentSnap = await tx.get(commentRef);
    if (!commentSnap.exists) {
      throw new HttpsError("not-found", "Comment not found.");
    }

    const voteSnap = await tx.get(voteRef);
    const existing = voteSnap.exists
      ? (voteSnap.data()!.direction as "up" | "down")
      : null;

    if (existing === direction) {
      // Same direction = remove vote (toggle off)
      tx.delete(voteRef);
      tx.update(commentRef, {
        [direction === "up" ? "upvotes" : "downvotes"]: FieldValue.increment(-1),
      });
      return { action: "removed" };
    }

    if (existing) {
      // Switching direction: decrement old, increment new
      tx.update(commentRef, {
        [existing === "up" ? "upvotes" : "downvotes"]: FieldValue.increment(-1),
        [direction === "up" ? "upvotes" : "downvotes"]: FieldValue.increment(1),
      });
    } else {
      // New vote
      tx.update(commentRef, {
        [direction === "up" ? "upvotes" : "downvotes"]: FieldValue.increment(1),
      });
    }

    tx.set(voteRef, { direction, userId: uid, timestamp: Date.now() });
    return { action: existing ? "changed" : "voted" };
  });
});
