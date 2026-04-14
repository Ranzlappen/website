import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "../utils/adminOnly";

/**
 * Server-validated voting.
 * - Checks user is authenticated and not banned
 * - Deduplicates via `votes` collection (composite key: userId_topicId_metricId)
 * - Atomically updates topic metrics and vote record in a transaction
 */
export const castVote = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = getFirestore();

  const { topicId, metricId, choiceId } = request.data as {
    topicId: string;
    metricId: string;
    choiceId: string;
  };

  if (!topicId || !metricId || !choiceId) {
    throw new HttpsError(
      "invalid-argument",
      "topicId, metricId, and choiceId are required."
    );
  }

  // Check if user is banned
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists && userDoc.data()?.status === "banned") {
    throw new HttpsError("permission-denied", "Your account has been banned.");
  }

  const voteId = `${uid}_${topicId}_${metricId}`;
  const voteRef = db.collection("votes").doc(voteId);
  const topicRef = db.collection("topics").doc(topicId);

  const result = await db.runTransaction(async (tx) => {
    const [topicSnap, voteSnap] = await Promise.all([
      tx.get(topicRef),
      tx.get(voteRef),
    ]);

    if (!topicSnap.exists) {
      throw new HttpsError("not-found", "Topic not found.");
    }

    const topicData = topicSnap.data()!;
    const existingVote = voteSnap.exists ? voteSnap.data() : null;
    const previousChoiceId = existingVote?.choiceId as string | undefined;

    // If voting for the same choice, no-op
    if (previousChoiceId === choiceId) {
      return { changed: false };
    }

    const isChange = !!previousChoiceId;

    // Update the metrics array
    const metrics = (topicData.metrics ?? []).map(
      (m: { id: string; choices: { id: string; votes: number }[] }) => {
        if (m.id !== metricId) return m;
        return {
          ...m,
          choices: m.choices.map(
            (c: { id: string; votes: number; [key: string]: unknown }) => {
              if (c.id === choiceId) {
                return { ...c, votes: (c.votes || 0) + 1 };
              }
              if (isChange && c.id === previousChoiceId) {
                return { ...c, votes: Math.max((c.votes || 0) - 1, 0) };
              }
              return c;
            }
          ),
        };
      }
    );

    // Update topic
    tx.update(topicRef, {
      metrics,
      totalVotes: isChange
        ? topicData.totalVotes || 0
        : (topicData.totalVotes || 0) + 1,
    });

    // Write/update vote record
    tx.set(voteRef, {
      userId: uid,
      topicId,
      metricId,
      choiceId,
      previousChoiceId: previousChoiceId || null,
      timestamp: Date.now(),
    });

    // Update user vote count for new votes
    if (!isChange) {
      const userRef = db.collection("users").doc(uid);
      tx.update(userRef, { votesCount: FieldValue.increment(1) });
    }

    return { changed: true, isChange };
  });

  return result;
});
