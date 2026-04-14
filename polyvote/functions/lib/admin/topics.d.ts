/**
 * Admin: create a topic directly (bypasses proposal flow).
 */
export declare const adminCreateTopic: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    title: string;
    description: string;
    category: "Politics" | "Technology" | "Science" | "Culture" | "Environment" | "Health" | "Sports" | "Other";
    metrics: {
        choices: {
            votes: number;
            id: string;
            label: string;
            color: string;
        }[];
        id: string;
        label: string;
    }[];
    totalVotes: number;
    createdAt: number;
    id: string;
}>>;
/**
 * Admin: edit a topic (bypasses immutability rules).
 */
export declare const adminEditTopic: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>>;
/**
 * Admin: delete a topic and its comments subcollection.
 */
export declare const adminDeleteTopic: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>>;
