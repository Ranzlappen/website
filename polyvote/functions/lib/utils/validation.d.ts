/** Ensure a required string field is present and within length bounds. */
export declare function validateString(value: unknown, fieldName: string, maxLength?: number): string;
/** Validate a category string. */
export declare const VALID_CATEGORIES: readonly ["Politics", "Technology", "Science", "Culture", "Environment", "Health", "Sports", "Other"];
export type Category = (typeof VALID_CATEGORIES)[number];
export declare function validateCategory(value: unknown): Category;
/** Validate metrics array structure. */
export interface MetricInput {
    id: string;
    label: string;
    choices: {
        id: string;
        label: string;
        color: string;
        votes: number;
    }[];
}
export declare function validateMetrics(value: unknown): MetricInput[];
