import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole, type Role } from "../utils/adminOnly";

const VALID_ROLES: Role[] = ["user", "author", "moderator", "admin"];

/**
 * Admin-only callable: set a user's role (custom claims + Firestore profile).
 */
export const setUserRole = onCall(async (request) => {
  requireRole(request, "admin");

  const { uid, role } = request.data as { uid: string; role: Role };

  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "uid is required.");
  }
  if (!VALID_ROLES.includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      `role must be one of: ${VALID_ROLES.join(", ")}`
    );
  }

  const authAdmin = getAuth();
  const db = getFirestore();

  // Set custom claims on the Auth user
  await authAdmin.setCustomUserClaims(uid, { role });

  // Mirror in Firestore profile
  await db.collection("users").doc(uid).update({ role });

  // Revoke refresh tokens so the new claims take effect immediately
  await authAdmin.revokeRefreshTokens(uid);

  return { success: true, uid, role };
});
