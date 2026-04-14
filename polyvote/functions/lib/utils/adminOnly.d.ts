import { type CallableRequest } from "firebase-functions/v2/https";
/** Roles ordered by privilege level */
export type Role = "user" | "moderator" | "admin";
/**
 * Verify that the caller is authenticated and has at least the required role.
 * Throws an HttpsError if not authorized.
 */
export declare function requireRole(request: CallableRequest, minRole: Role): void;
/**
 * Verify the caller is authenticated (any role, including anonymous).
 */
export declare function requireAuth(request: CallableRequest): string;
