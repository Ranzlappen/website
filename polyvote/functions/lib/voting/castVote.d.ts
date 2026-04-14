/**
 * Server-validated voting.
 * - Checks user is authenticated and not banned
 * - Deduplicates via `votes` collection (composite key: userId_topicId_metricId)
 * - Atomically updates topic metrics and vote record in a transaction
 */
export declare const castVote: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    changed: boolean;
    isChange?: undefined;
} | {
    changed: boolean;
    isChange: boolean;
}>>;
