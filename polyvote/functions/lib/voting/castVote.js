"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.castVote = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const adminOnly_1 = require("../utils/adminOnly");
/**
 * Server-validated voting.
 * - Checks user is authenticated and not banned
 * - Deduplicates via `votes` collection (composite key: userId_topicId_metricId)
 * - Atomically updates topic metrics and vote record in a transaction
 */
exports.castVote = (0, https_1.onCall)(async (request) => {
    const uid = (0, adminOnly_1.requireAuth)(request);
    const db = (0, firestore_1.getFirestore)();
    const { topicId, metricId, choiceId } = request.data;
    if (!topicId || !metricId || !choiceId) {
        throw new https_1.HttpsError("invalid-argument", "topicId, metricId, and choiceId are required.");
    }
    // Check if user is banned
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.status === "banned") {
        throw new https_1.HttpsError("permission-denied", "Your account has been banned.");
    }
    const voteId = `${uid}_${topicId}_${metricId}`;
    const voteRef = db.collection("votes").doc(voteId);
    const topicRef = db.collection("topics").doc(topicId);
    const result = await db.runTransaction(async (tx) => {
        const [topicSnap, voteSnap] = await Promise.all([
            tx.get(topicRef),
            tx.get(voteRef),
        ]);
        if (!topicSnap.exists) {
            throw new https_1.HttpsError("not-found", "Topic not found.");
        }
        const topicData = topicSnap.data();
        const existingVote = voteSnap.exists ? voteSnap.data() : null;
        const previousChoiceId = existingVote?.choiceId;
        // If voting for the same choice, no-op
        if (previousChoiceId === choiceId) {
            return { changed: false };
        }
        const isChange = !!previousChoiceId;
        // Update the metrics array
        const metrics = (topicData.metrics ?? []).map((m) => {
            if (m.id !== metricId)
                return m;
            return {
                ...m,
                choices: m.choices.map((c) => {
                    if (c.id === choiceId) {
                        return { ...c, votes: (c.votes || 0) + 1 };
                    }
                    if (isChange && c.id === previousChoiceId) {
                        return { ...c, votes: Math.max((c.votes || 0) - 1, 0) };
                    }
                    return c;
                }),
            };
        });
        // Update topic
        tx.update(topicRef, {
            metrics,
            totalVotes: isChange
                ? topicData.totalVotes || 0
                : (topicData.totalVotes || 0) + 1,
        });
        // Write/update vote record
        tx.set(voteRef, {
            userId: uid,
            topicId,
            metricId,
            choiceId,
            previousChoiceId: previousChoiceId || null,
            timestamp: Date.now(),
        });
        // Update user vote count for new votes
        if (!isChange) {
            const userRef = db.collection("users").doc(uid);
            tx.update(userRef, { votesCount: firestore_1.FieldValue.increment(1) });
        }
        return { changed: true, isChange };
    });
    return result;
});
//# sourceMappingURL=castVote.js.map