/**
 * Any authenticated user: report content (comment, topic, or topicRequest).
 */
export declare const reportContent: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    id: string;
}>>;
/**
 * Moderator+: delete a comment from a topic's comments subcollection.
 */
export declare const adminDeleteComment: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>>;
/**
 * Moderator+: review a report (mark as reviewed, action-taken, or dismissed).
 */
export declare const adminReviewReport: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>>;
/**
 * Moderator+: list reports with optional filters.
 */
export declare const adminListReports: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    reports: {
        id: string;
    }[];
    hasMore: boolean;
    lastId: string | null;
}>>;
