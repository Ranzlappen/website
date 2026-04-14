import * as functions from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Trigger: runs whenever a new Firebase Auth user is created.
 * Creates a corresponding UserProfile document in the `users` collection.
 */
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const db = getFirestore();

  const profile = {
    uid: user.uid,
    displayName:
      user.displayName || `User-${user.uid.slice(0, 6).toUpperCase()}`,
    email: user.email || null,
    role: "user" as const,
    status: "active" as const,
    isAnonymous: !user.email && !user.providerData?.length,
    createdAt: Date.now(),
    lastActive: Date.now(),
    votesCount: 0,
    commentsCount: 0,
  };

  await db.collection("users").doc(user.uid).set(profile);
});
