/**
 * Server-validated topic request endorsement.
 * - Uses transaction to prevent race conditions and duplicate endorsements
 * - Checks user is not banned
 * - Prevents self-endorsement by author (author auto-endorses on creation)
 * - Atomically updates endorsers array and count
 */
export declare const endorseTopicRequest: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    newCount: any;
}>>;
