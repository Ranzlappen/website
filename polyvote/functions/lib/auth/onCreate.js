"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserCreate = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const firestore_1 = require("firebase-admin/firestore");
/**
 * Trigger: runs whenever a new Firebase Auth user is created.
 * Creates a corresponding UserProfile document in the `users` collection.
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
    const db = (0, firestore_1.getFirestore)();
    const profile = {
        uid: user.uid,
        displayName: user.displayName || `User-${user.uid.slice(0, 6).toUpperCase()}`,
        email: user.email || null,
        role: "user",
        status: "active",
        isAnonymous: !user.email && !user.providerData?.length,
        createdAt: Date.now(),
        lastActive: Date.now(),
        votesCount: 0,
        commentsCount: 0,
    };
    await db.collection("users").doc(user.uid).set(profile);
});
//# sourceMappingURL=onCreate.js.map