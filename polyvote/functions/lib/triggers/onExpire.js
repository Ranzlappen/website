"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupExpiredRequests = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
/**
 * Scheduled function: runs every 5 minutes to archive expired pending topic requests.
 */
exports.cleanupExpiredRequests = (0, scheduler_1.onSchedule)("every 5 minutes", async () => {
    const db = (0, firestore_1.getFirestore)();
    const now = Date.now();
    const expiredSnap = await db
        .collection("topicRequests")
        .where("status", "==", "pending")
        .where("expiresAt", "<", now)
        .get();
    if (expiredSnap.empty)
        return;
    const batch = db.batch();
    let count = 0;
    expiredSnap.docs.forEach((doc) => {
        batch.update(doc.ref, { status: "archived" });
        count++;
    });
    await batch.commit();
    // Audit log
    const auditRef = db.collection("auditLog").doc();
    await auditRef.set({
        action: "requests.cleanup",
        actorId: "system",
        targetType: "topicRequests",
        targetId: "batch",
        metadata: { archivedCount: count },
        timestamp: Date.now(),
    });
});
//# sourceMappingURL=onExpire.js.map