import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Scheduled: recompute trending scores for all topics every hour.
 *
 * Score formula (Hacker News-inspired with activity signals):
 *   trendingScore = (recentVotes * 3 + recentComments * 2 + log(totalVotes + 1)) / (ageHours + 2)^1.5
 *
 * "Recent" = last 24 hours.
 */
export const computeTrending = onSchedule("every 60 minutes", async () => {
  const db = getFirestore();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Get all topics (select only needed fields)
  const topicsSnap = await db
    .collection("topics")
    .select("totalVotes", "createdAt")
    .get();

  if (topicsSnap.empty) return;

  // Get recent votes (last 24h)
  const recentVotesSnap = await db
    .collection("votes")
    .where("timestamp", ">=", oneDayAgo)
    .select("topicId")
    .get();

  // Count recent votes per topic
  const recentVotesByTopic = new Map<string, number>();
  for (const doc of recentVotesSnap.docs) {
    const topicId = doc.data().topicId;
    recentVotesByTopic.set(topicId, (recentVotesByTopic.get(topicId) || 0) + 1);
  }

  // Batch update trending scores (Firestore limit: 500 per batch)
  const batches: FirebaseFirestore.WriteBatch[] = [db.batch()];
  let opCount = 0;

  for (const topicDoc of topicsSnap.docs) {
    const data = topicDoc.data();
    const totalVotes = data.totalVotes || 0;
    const ageHours = Math.max((now - data.createdAt) / 3_600_000, 1);
    const recentVotes = recentVotesByTopic.get(topicDoc.id) || 0;

    const score =
      (recentVotes * 3 + Math.log(totalVotes + 1)) /
      Math.pow(ageHours + 2, 1.5);

    let batch = batches[batches.length - 1];
    if (opCount >= 499) {
      batch = db.batch();
      batches.push(batch);
      opCount = 0;
    }

    batch.update(topicDoc.ref, { trendingScore: Math.round(score * 10000) / 10000 });
    opCount++;
  }

  await Promise.all(batches.map((b) => b.commit()));
});
