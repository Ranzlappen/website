import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Bootstrap the first admin account.
 * Only works if NO admin users exist yet in the system.
 * The caller must provide a matching email to verify identity.
 */
export const bootstrapAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const uid = request.auth.uid;
  const db = getFirestore();

  // Check if any admin already exists
  const existingAdmins = await db
    .collection("users")
    .where("role", "==", "admin")
    .limit(1)
    .get();

  if (!existingAdmins.empty) {
    throw new HttpsError(
      "failed-precondition",
      "An admin already exists. Use setUserRole to promote users."
    );
  }

  // Caller must be a non-anonymous user with a verified email
  const authUser = await getAuth().getUser(uid);
  if (!authUser.email) {
    throw new HttpsError(
      "failed-precondition",
      "You must sign in with an email account to become admin."
    );
  }
  if (!authUser.emailVerified) {
    throw new HttpsError(
      "failed-precondition",
      "Please verify your email address before claiming admin."
    );
  }

  // Promote the caller to admin
  await getAuth().setCustomUserClaims(uid, { role: "admin" });

  await db.collection("users").doc(uid).update({
    role: "admin",
    email: authUser.email,
  });

  // Revoke tokens so new claims take effect
  await getAuth().revokeRefreshTokens(uid);

  return { success: true, message: "You are now the admin. Please sign out and back in." };
});
