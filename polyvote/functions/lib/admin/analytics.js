"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyAnalyticsAggregation = exports.adminGetVotingTrends = exports.adminGetAnalytics = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const adminOnly_1 = require("../utils/adminOnly");
/**
 * Admin: get overview analytics (totals, recent activity).
 */
exports.adminGetAnalytics = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "admin");
    const db = (0, firestore_1.getFirestore)();
    // Parallel count queries
    const [topicsCount, usersCount, requestsCount, reportsCount] = await Promise.all([
        db.collection("topics").count().get(),
        db.collection("users").count().get(),
        db.collection("requests").count().get(),
        db.collection("reports").where("status", "==", "pending").count().get(),
    ]);
    // Get total votes across all topics
    const topicsSnap = await db.collection("topics").get();
    let totalVotes = 0;
    const categoryBreakdown = {};
    const topTopics = [];
    topicsSnap.docs.forEach((doc) => {
        const data = doc.data();
        totalVotes += data.totalVotes || 0;
        categoryBreakdown[data.category] =
            (categoryBreakdown[data.category] || 0) + 1;
        topTopics.push({
            id: doc.id,
            title: data.title,
            votes: data.totalVotes || 0,
        });
    });
    // Sort by votes descending, take top 10
    topTopics.sort((a, b) => b.votes - a.votes);
    // Recent activity from audit log
    const recentActivity = await db
        .collection("auditLog")
        .orderBy("timestamp", "desc")
        .limit(20)
        .get();
    const activity = recentActivity.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));
    // Recent users
    const recentUsers = await db
        .collection("users")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();
    const newUsersToday = recentUsers.docs.filter((doc) => {
        const created = doc.data().createdAt;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return created >= today.getTime();
    }).length;
    return {
        totals: {
            topics: topicsCount.data().count,
            users: usersCount.data().count,
            requests: requestsCount.data().count,
            pendingReports: reportsCount.data().count,
            totalVotes,
            newUsersToday,
        },
        topTopics: topTopics.slice(0, 10),
        categoryBreakdown,
        recentActivity: activity,
    };
});
/**
 * Admin: get voting trends over time.
 */
exports.adminGetVotingTrends = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "admin");
    const db = (0, firestore_1.getFirestore)();
    const { days = 30 } = request.data;
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
exports.dailyAnalyticsAggregation = (0, scheduler_1.onSchedule)("every day 00:00", async () => {
    const db = (0, firestore_1.getFirestore)();
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const dayStart = new Date(dateStr).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    // Count votes cast today
    const votesSnap = await db
        .collection("votes")
        .where("timestamp", ">=", dayStart)
        .where("timestamp", "<", dayEnd)
        .count()
        .get();
    // Count new users today
    const usersSnap = await db
        .collection("users")
        .where("createdAt", ">=", dayStart)
        .where("createdAt", "<", dayEnd)
        .count()
        .get();
    // Count new topics today
    const topicsSnap = await db
        .collection("topics")
        .where("createdAt", ">=", dayStart)
        .where("createdAt", "<", dayEnd)
        .count()
        .get();
    // Active users: distinct voters today
    const activeVoters = await db
        .collection("votes")
        .where("timestamp", ">=", dayStart)
        .where("timestamp", "<", dayEnd)
        .get();
    const uniqueVoters = new Set(activeVoters.docs.map((doc) => doc.data().userId));
    // Get top topics
    const allTopics = await db
        .collection("topics")
        .orderBy("totalVotes", "desc")
        .limit(10)
        .get();
    const topTopics = allTopics.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
        votes: doc.data().totalVotes || 0,
    }));
    // Category breakdown
    const allTopicsSnap = await db.collection("topics").get();
    const categoryBreakdown = {};
    allTopicsSnap.docs.forEach((doc) => {
        const cat = doc.data().category;
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });
    await db
        .collection("analytics")
        .doc(dateStr)
        .set({
        date: dateStr,
        timestamp: dayStart,
        totalVotes: votesSnap.data().count,
        newTopics: topicsSnap.data().count,
        newUsers: usersSnap.data().count,
        activeUsers: uniqueVoters.size,
        topTopics,
        categoryBreakdown,
    });
});
//# sourceMappingURL=analytics.js.map