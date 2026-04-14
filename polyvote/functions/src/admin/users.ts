import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";

/**
 * Admin: list users with pagination and optional filters.
 */
export const adminListUsers = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const {
    pageSize = 20,
    startAfter,
    roleFilter,
    statusFilter,
    searchQuery,
  } = request.data as {
    pageSize?: number;
    startAfter?: string;
    roleFilter?: string;
    statusFilter?: string;
    searchQuery?: string;
  };

  let q = db.collection("users").orderBy("createdAt", "desc");

  if (roleFilter) {
    q = q.where("role", "==", roleFilter);
  }
  if (statusFilter) {
    q = q.where("status", "==", statusFilter);
  }
  if (startAfter) {
    const startDoc = await db.collection("users").doc(startAfter).get();
    if (startDoc.exists) {
      q = q.startAfter(startDoc);
    }
  }

  const snap = await q.limit(Math.min(pageSize, 50)).get();
  const users = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Apply search filter client-side (Firestore doesn't support text search)
  let filtered = users;
  if (searchQuery) {
    const lower = searchQuery.toLowerCase();
    filtered = users.filter(
      (u: Record<string, unknown>) =>
        (u.displayName as string)?.toLowerCase().includes(lower) ||
        (u.email as string)?.toLowerCase().includes(lower) ||
        (u.uid as string)?.includes(lower)
    );
  }

  return {
    users: filtered,
    hasMore: snap.docs.length === Math.min(pageSize, 50),
    lastId: snap.docs[snap.docs.length - 1]?.id || null,
  };
});

/**
 * Admin: ban a user. Sets status to banned and revokes tokens.
 */
export const adminBanUser = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();
  const authAdmin = getAuth();

  const { uid, reason } = request.data as { uid: string; reason?: string };
  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required.");
  }

  // Prevent banning yourself
  if (uid === request.auth!.uid) {
    throw new HttpsError("invalid-argument", "You cannot ban yourself.");
  }

  // Check target isn't a higher-role user
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found.");
  }
  if (userDoc.data()?.role === "admin") {
    throw new HttpsError(
      "permission-denied",
      "Cannot ban another admin. Remove their admin role first."
    );
  }

  await db.collection("users").doc(uid).update({
    status: "banned",
    bannedAt: Date.now(),
    banReason: reason || "No reason provided",
  });

  // Revoke tokens to force immediate sign-out
  await authAdmin.revokeRefreshTokens(uid);

  // Audit
  await db.collection("auditLog").add({
    action: "user.banned",
    actorId: request.auth!.uid,
    targetType: "user",
    targetId: uid,
    metadata: { reason: reason || "No reason provided" },
    timestamp: Date.now(),
  });

  return { success: true };
});

/**
 * Admin: unban / reactivate a user.
 */
export const adminUnbanUser = onCall(async (request) => {
  requireRole(request, "admin");
  const db = getFirestore();

  const { uid } = request.data as { uid: string };
  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required.");
  }

  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  await db.collection("users").doc(uid).update({
    status: "active",
    bannedAt: null,
    banReason: null,
  });

  // Audit
  await db.collection("auditLog").add({
    action: "user.unbanned",
    actorId: request.auth!.uid,
    targetType: "user",
    targetId: uid,
    metadata: {},
    timestamp: Date.now(),
  });

  return { success: true };
});
