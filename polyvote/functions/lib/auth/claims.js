"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserRole = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const adminOnly_1 = require("../utils/adminOnly");
const VALID_ROLES = ["user", "moderator", "admin"];
/**
 * Admin-only callable: set a user's role (custom claims + Firestore profile).
 */
exports.setUserRole = (0, https_1.onCall)(async (request) => {
    (0, adminOnly_1.requireRole)(request, "admin");
    const { uid, role } = request.data;
    if (!uid || typeof uid !== "string") {
        throw new https_1.HttpsError("invalid-argument", "uid is required.");
    }
    if (!VALID_ROLES.includes(role)) {
        throw new https_1.HttpsError("invalid-argument", `role must be one of: ${VALID_ROLES.join(", ")}`);
    }
    const authAdmin = (0, auth_1.getAuth)();
    const db = (0, firestore_1.getFirestore)();
    // Set custom claims on the Auth user
    await authAdmin.setCustomUserClaims(uid, { role });
    // Mirror in Firestore profile
    await db.collection("users").doc(uid).update({ role });
    // Revoke refresh tokens so the new claims take effect immediately
    await authAdmin.revokeRefreshTokens(uid);
    return { success: true, uid, role };
});
//# sourceMappingURL=claims.js.map