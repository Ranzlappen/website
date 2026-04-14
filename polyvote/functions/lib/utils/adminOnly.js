"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
exports.requireAuth = requireAuth;
const https_1 = require("firebase-functions/v2/https");
const ROLE_LEVELS = {
    user: 0,
    moderator: 1,
    admin: 2,
};
/**
 * Verify that the caller is authenticated and has at least the required role.
 * Throws an HttpsError if not authorized.
 */
function requireRole(request, minRole) {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in.");
    }
    const userRole = request.auth.token.role || "user";
    if (ROLE_LEVELS[userRole] < ROLE_LEVELS[minRole]) {
        throw new https_1.HttpsError("permission-denied", `Requires ${minRole} role or higher.`);
    }
}
/**
 * Verify the caller is authenticated (any role, including anonymous).
 */
function requireAuth(request) {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in.");
    }
    return request.auth.uid;
}
//# sourceMappingURL=adminOnly.js.map