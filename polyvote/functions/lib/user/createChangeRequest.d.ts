/**
 * Server-validated change request creation.
 * - Validates topicId references a real topic
 * - Validates request type and description
 * - Checks user is not banned
 */
export declare const createChangeRequest: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    id: string;
}>>;
