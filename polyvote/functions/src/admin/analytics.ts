import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";

/**
 * Admin: get overview analytics (totals, recent activity).
 */
export const adminGetAnalytics = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  // Parallel queries: counts, top topics (limited), recent activity, new users today.
  // Use allSettled so a single query failure doesn't crash the entire endpoint.
  const results = await Promise.allSettled([
    db.collection("topics").count().get(),
    db.collection("users").count().get(),
    db.collection("requests").count().get(),
    db.collection("reports").where("status", "==", "pending").count().get(),
    db
      .collection("topics")
      .orderBy("totalVotes", "desc")
      .limit(10)
      .get(),
    db
      .collection("auditLog")
      .orderBy("timestamp", "desc")
      .limit(20)
      .get(),
    db
      .collection("users")
      .where("createdAt", ">=", todayStart)
      .count()
      .get(),
  ]);

  const settled = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === "fulfilled" ? r.value : fallback;

  const emptySnap = { docs: [] as never[], data: () => ({ count: 0 }) };
  const topicsCount = settled(results[0], emptySnap as never);
  const usersCount = settled(results[1], emptySnap as never);
  const requestsCount = settled(results[2], emptySnap as never);
  const reportsCount = settled(results[3], emptySnap as never);
  const topTopicsSnap = settled(results[4], emptySnap as never);
  const recentActivitySnap = settled(results[5], emptySnap as never);
  const newUsersTodayCount = settled(results[6], emptySnap as never);

  // Build top topics list and sum their votes
  const topTopics: { id: string; title: string; votes: number }[] = [];
  topTopicsSnap.docs.forEach((doc) => {
    const data = doc.data();
    topTopics.push({
      id: doc.id,
      title: data.title,
      votes: data.totalVotes || 0,
    });
  });

  // Use the latest daily aggregation for totalVotes and categoryBreakdown
  const latestAggSnap = await db
    .collection("analytics")
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  let totalVotes = 0;
  let categoryBreakdown: Record<string, number> = {};
  if (!latestAggSnap.empty) {
    const agg = latestAggSnap.docs[0].data();
    totalVotes = agg.totalVotes || 0;
    categoryBreakdown = agg.categoryBreakdown || {};
  }

  const activity = recentActivitySnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    totals: {
      topics: topicsCount.data().count,
      users: usersCount.data().count,
      requests: requestsCount.data().count,
      pendingReports: reportsCount.data().count,
      totalVotes,
      newUsersToday: newUsersTodayCount.data().count,
    },
    topTopics,
    categoryBreakdown,
    recentActivity: activity,
  };
});

/**
 * Admin: get voting trends over time.
 */
export const adminGetVotingTrends = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const { days = 30 } = request.data as { days?: number };
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  // Get daily analytics documents
  const analyticsSnap = await db
    .collection("analytics")
    .where("timestamp", ">=", since)
    .orderBy("timestamp", "asc")
    .get();

  const trends = analyticsSnap.docs.map((doc) => ({
    date: doc.id,
    ...doc.data(),
  }));

  return { trends, days };
});

/**
 * Scheduled: aggregate daily analytics at midnight.
 */
export const dailyAnalyticsAggregation = onSchedule(
  "every day 00:00",
  async () => {
    const db = getFirestore();
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const dayStart = new Date(dateStr).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    // Parallel count queries — avoid fetching full documents
    const [votesCount, usersCount, topicsCount, topTopicsSnap, activeVotersSnap] =
      await Promise.all([
        db
          .collection("votes")
          .where("timestamp", ">=", dayStart)
          .where("timestamp", "<", dayEnd)
          .count()
          .get(),
        db
          .collection("users")
          .where("createdAt", ">=", dayStart)
          .where("createdAt", "<", dayEnd)
          .count()
          .get(),
        db
          .collection("topics")
          .where("createdAt", ">=", dayStart)
          .where("createdAt", "<", dayEnd)
          .count()
          .get(),
        db
          .collection("topics")
          .orderBy("totalVotes", "desc")
          .limit(10)
          .select("title", "totalVotes", "category")
          .get(),
        db
          .collection("votes")
          .where("timestamp", ">=", dayStart)
          .where("timestamp", "<", dayEnd)
          .select("userId")
          .get(),
      ]);

    // Distinct voters from today's votes (only userId field fetched)
    const uniqueVoters = new Set(
      activeVotersSnap.docs.map((doc) => doc.data().userId)
    );

    const topTopics = topTopicsSnap.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      votes: doc.data().totalVotes || 0,
    }));

    // Category breakdown from the top-topics query + remaining topics
    // Use a single select query for just the category field
    const allCategoriesSnap = await db
      .collection("topics")
      .select("category")
      .get();
    const categoryBreakdown: Record<string, number> = {};
    allCategoriesSnap.docs.forEach((doc) => {
      const cat = doc.data().category;
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    await db
      .collection("analytics")
      .doc(dateStr)
      .set({
        date: dateStr,
        timestamp: dayStart,
        totalVotes: votesCount.data().count,
        newTopics: topicsCount.data().count,
        newUsers: usersCount.data().count,
        activeUsers: uniqueVoters.size,
        topTopics,
        categoryBreakdown,
      });
  }
);
