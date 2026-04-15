import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Public: get aggregated platform stats for the insights dashboard.
 * No authentication required. Returns only non-sensitive aggregate data.
 */
export const getPublicStats = onCall(async () => {
  const db = getFirestore();

  // Parallel queries for aggregate counts
  const [topicsSnap, usersCount, topTopicsSnap, recentAnalyticsSnap] =
    await Promise.all([
      db.collection("topics").select("title", "totalVotes", "category", "createdAt", "trendingScore").get(),
      db.collection("users").count().get(),
      db
        .collection("topics")
        .orderBy("totalVotes", "desc")
        .limit(5)
        .select("title", "totalVotes", "category")
        .get(),
      db
        .collection("analytics")
        .orderBy("timestamp", "desc")
        .limit(30)
        .get(),
    ]);

  // Compute totals from topics
  let totalVotes = 0;
  const categoryBreakdown: Record<string, number> = {};
  for (const doc of topicsSnap.docs) {
    const data = doc.data();
    totalVotes += data.totalVotes || 0;
    const cat = data.category || "Other";
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
  }

  // Top consensus topics (by trending score)
  const trendingTopics = topicsSnap.docs
    .filter((doc) => doc.data().trendingScore != null)
    .sort((a, b) => (b.data().trendingScore || 0) - (a.data().trendingScore || 0))
    .slice(0, 5)
    .map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      votes: doc.data().totalVotes || 0,
      category: doc.data().category,
    }));

  const topTopics = topTopicsSnap.docs.map((doc) => ({
    id: doc.id,
    title: doc.data().title,
    votes: doc.data().totalVotes || 0,
    category: doc.data().category,
  }));

  // Daily trends from analytics collection (public-safe fields only)
  const dailyTrends = recentAnalyticsSnap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        date: data.date,
        totalVotes: data.totalVotes || 0,
        newTopics: data.newTopics || 0,
        activeUsers: data.activeUsers || 0,
      };
    })
    .reverse(); // chronological order

  return {
    totals: {
      topics: topicsSnap.size,
      participants: usersCount.data().count,
      totalVotes,
    },
    categoryBreakdown,
    topTopics,
    trendingTopics,
    dailyTrends,
  };
});
