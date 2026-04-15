/**
 * Shared constants for Cloud Functions.
 * Centralizes magic numbers used across multiple functions.
 */

// ── Rate limits ──

/** Max comments per minute per user (per topic) */
export const MAX_COMMENTS_PER_MINUTE = 10;

/** Max content reports per hour per user */
export const MAX_REPORTS_PER_HOUR = 10;

// ── Topic & metric constraints ──

/** Max metrics per topic */
export const MAX_METRICS_PER_TOPIC = 6;

/** Min choices per metric */
export const MIN_CHOICES_PER_METRIC = 2;

/** Max choices per metric */
export const MAX_CHOICES_PER_METRIC = 6;

/** Max changes in a single change request */
export const MAX_CHANGES_PER_REQUEST = 50;

/** Max requests in a bulk admin operation */
export const MAX_BULK_OPERATIONS = 50;

// ── Topic requests ──

/** Time window for a topic request to gather endorsements (10 minutes) */
export const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

/** Number of endorsements needed to promote a topic request */
export const REQUEST_ENDORSEMENTS_NEEDED = 2;

// ── Pagination ──

/** Default page size for admin list queries */
export const DEFAULT_PAGE_SIZE = 50;

/** Max page size for admin list queries */
export const MAX_PAGE_SIZE = 100;
