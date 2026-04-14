/**
 * Moderator+: approve or reject a change request.
 */
export declare const adminUpdateRequestStatus: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>>;
/**
 * Moderator+: bulk approve/reject change requests.
 */
export declare const adminBulkUpdateRequests: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    count: number;
}>>;
