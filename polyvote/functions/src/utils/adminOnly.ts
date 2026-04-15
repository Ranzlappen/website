import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

/** Roles ordered by privilege level */
export type Role = "user" | "author" | "moderator" | "admin";

const ROLE_LEVELS: Record<Role, number> = {
  user: 0,
  author: 1,
  moderator: 2,
  admin: 3,
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

/**
 * Verify that the authenticated user is not banned.
 * Throws HttpsError if the user's Firestore status is "banned".
 * Returns whether the user profile document exists (useful for
 * callers that need to conditionally update user stats).
 */
export async function requireNotBanned(uid: string): Promise<boolean> {
  const db = getFirestore();
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists && userDoc.data()?.status === "banned") {
    throw new HttpsError("permission-denied", "Your account has been banned.");
  }
  return userDoc.exists;
}
