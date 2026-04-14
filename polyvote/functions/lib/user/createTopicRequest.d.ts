/**
 * Server-validated topic request creation.
 * - Validates all fields (title, description, category, metrics structure)
 * - Checks user is not banned
 * - Initializes endorsers with author
 * - Sets proper timestamps
 */
export declare const createTopicRequest: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    id: string;
}>>;
