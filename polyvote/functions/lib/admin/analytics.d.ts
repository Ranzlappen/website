/**
 * Admin: get overview analytics (totals, recent activity).
 */
export declare const adminGetAnalytics: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    totals: {
        topics: number;
        users: number;
        requests: number;
        pendingReports: number;
        totalVotes: number;
        newUsersToday: number;
    };
    topTopics: {
        id: string;
        title: string;
        votes: number;
    }[];
    categoryBreakdown: Record<string, number>;
    recentActivity: {
        id: string;
    }[];
}>>;
/**
 * Admin: get voting trends over time.
 */
export declare const adminGetVotingTrends: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    trends: {
        date: string;
    }[];
    days: number;
}>>;
/**
 * Scheduled: aggregate daily analytics at midnight.
 */
export declare const dailyAnalyticsAggregation: import("firebase-functions/v2/scheduler").ScheduleFunction;
