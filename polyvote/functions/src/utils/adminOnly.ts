import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

/** Roles ordered by privilege level */
export type Role = "user" | "moderator" | "admin";

const ROLE_LEVELS: Record<Role, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
};

/**
 * Verify that the caller is authenticated and has at least the required role.
 * Throws an HttpsError if not authorized.
 */
export function requireRole(request: CallableRequest, minRole: Role): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const userRole = (request.auth.token.role as Role) || "user";
  if (ROLE_LEVELS[userRole] < ROLE_LEVELS[minRole]) {
    throw new HttpsError(
      "permission-denied",
      `Requires ${minRole} role or higher.`
    );
  }
}

/**
 * Verify the caller is authenticated (any role, including anonymous).
 */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  return request.auth.uid;
}
