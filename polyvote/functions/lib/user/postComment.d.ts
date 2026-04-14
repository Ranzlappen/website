/**
 * Server-validated comment posting.
 * - Checks user is authenticated and not banned
 * - Validates text length
 * - Rate limits to 10 comments per minute per user
 * - Atomically increments user's commentsCount
 */
export declare const postComment: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    id: string;
}>>;
