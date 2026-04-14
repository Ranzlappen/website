"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUnbanUser = exports.adminBanUser = exports.adminListUsers = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const adminOnly_1 = require("../utils/adminOnly");
/**
 * Admin: list users with pagination and optional filters.
 */
exports.adminListUsers = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "admin");
    const db = (0, firestore_1.getFirestore)();
    const { pageSize = 20, startAfter, roleFilter, statusFilter, searchQuery, } = request.data;
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
        filtered = users.filter((u) => u.displayName?.toLowerCase().includes(lower) ||
            u.email?.toLowerCase().includes(lower) ||
            u.uid?.includes(lower));
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
exports.adminBanUser = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "admin");
    const db = (0, firestore_1.getFirestore)();
    const authAdmin = (0, auth_1.getAuth)();
    const { uid, reason } = request.data;
    if (!uid) {
        throw new https_1.HttpsError("invalid-argument", "uid is required.");
    }
    // Prevent banning yourself
    if (uid === request.auth.uid) {
        throw new https_1.HttpsError("invalid-argument", "You cannot ban yourself.");
    }
    // Check target isn't a higher-role user
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError("not-found", "User not found.");
    }
    if (userDoc.data()?.role === "admin") {
        throw new https_1.HttpsError("permission-denied", "Cannot ban another admin. Remove their admin role first.");
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
        actorId: request.auth.uid,
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
exports.adminUnbanUser = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "admin");
    const db = (0, firestore_1.getFirestore)();
    const { uid } = request.data;
    if (!uid) {
        throw new https_1.HttpsError("invalid-argument", "uid is required.");
    }
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError("not-found", "User not found.");
    }
    await db.collection("users").doc(uid).update({
        status: "active",
        bannedAt: null,
        banReason: null,
    });
    // Audit
    await db.collection("auditLog").add({
        action: "user.unbanned",
        actorId: request.auth.uid,
        targetType: "user",
        targetId: uid,
        metadata: {},
        timestamp: Date.now(),
    });
    return { success: true };
});
//# sourceMappingURL=users.js.map