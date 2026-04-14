/**
 * Admin: list users with pagination and optional filters.
 */
export declare const adminListUsers: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    users: {
        id: string;
    }[];
    hasMore: boolean;
    lastId: string | null;
}>>;
/**
 * Admin: ban a user. Sets status to banned and revokes tokens.
 */
export declare const adminBanUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>>;
/**
 * Admin: unban / reactivate a user.
 */
export declare const adminUnbanUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>>;
