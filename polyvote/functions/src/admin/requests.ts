import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";

interface ProposedChange {
  changeId: string;
  action: string;
  metricId: string;
  choiceId?: string;
  oldValue?: { label?: string; color?: string };
  newValue?: {
    label?: string;
    color?: string;
    choices?: { id: string; label: string; color: string; votes: number }[];
  };
  status: string;
}

/**
 * Apply a single approved change to a topic's metrics array.
 * Returns the updated metrics array.
 */
function applyChange(
  metrics: {
    id: string;
    label: string;
    choices: { id: string; label: string; color: string; votes: number }[];
  }[],
  change: ProposedChange
): typeof metrics {
  switch (change.action) {
    case "edit-metric":
      return metrics.map((m) =>
        m.id === change.metricId
          ? { ...m, label: change.newValue?.label ?? m.label }
          : m
      );

    case "delete-metric":
      return metrics.filter((m) => m.id !== change.metricId);

    case "edit-choice":
      return metrics.map((m) => {
        if (m.id !== change.metricId) return m;
        return {
          ...m,
          choices: m.choices.map((c) => {
            if (c.id !== change.choiceId) return c;
            return {
              ...c,
              label: change.newValue?.label ?? c.label,
              color: change.newValue?.color ?? c.color,
            };
          }),
        };
      });

    case "delete-choice":
      return metrics.map((m) => {
        if (m.id !== change.metricId) return m;
        return {
          ...m,
          choices: m.choices.filter((c) => c.id !== change.choiceId),
        };
      });

    case "add-choice":
      return metrics.map((m) => {
        if (m.id !== change.metricId) return m;
        const newChoiceId =
          change.newValue?.label
            ?.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || `choice-${Date.now()}`;
        return {
          ...m,
          choices: [
            ...m.choices,
            {
              id: newChoiceId,
              label: change.newValue?.label ?? "",
              color: change.newValue?.color ?? "#888888",
              votes: 0,
            },
          ],
        };
      });

    case "add-metric": {
      const newMetricId =
        change.newValue?.label
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || `metric-${Date.now()}`;
      const newChoices = (change.newValue?.choices ?? []).map((c) => ({
        id: c.id || c.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label: c.label,
        color: c.color,
        votes: 0,
      }));
      return [...metrics, { id: newMetricId, label: change.newValue?.label ?? "", choices: newChoices }];
    }

    default:
      return metrics;
  }
}

/**
 * Moderator+: review individual changes within a request.
 * Accepts per-change statuses and applies approved changes to the topic.
 */
export const adminUpdateRequestStatus = onCall(async (request) => {
  requireRole(request, "moderator");
  const db = getFirestore();

  const { requestId, changeStatuses } = request.data as {
    requestId: string;
    changeStatuses: { changeId: string; status: "approved" | "rejected" }[];
  };

  if (!requestId) {
    throw new HttpsError("invalid-argument", "requestId is required.");
  }

  if (!Array.isArray(changeStatuses) || changeStatuses.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "changeStatuses array is required."
    );
  }

  const reqRef = db.collection("requests").doc(requestId);
  const snap = await reqRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Request not found.");
  }

  const reqData = snap.data()!;
  if (reqData.status !== "pending") {
    throw new HttpsError(
      "failed-precondition",
      "Can only update pending requests."
    );
  }

  const changes = (reqData.changes ?? []) as ProposedChange[];

  // Build a map of changeId → new status
  const statusMap = new Map(
    changeStatuses.map((cs) => [cs.changeId, cs.status])
  );

  // Update each change's status
  const updatedChanges = changes.map((c) => ({
    ...c,
    status: statusMap.get(c.changeId) ?? c.status,
  }));

  // Determine overall request status
  const allApproved = updatedChanges.every((c) => c.status === "approved");
  const allRejected = updatedChanges.every((c) => c.status === "rejected");
  const allReviewed = updatedChanges.every((c) => c.status !== "pending");
  let overallStatus: string;
  if (allApproved) overallStatus = "approved";
  else if (allRejected) overallStatus = "rejected";
  else if (allReviewed) overallStatus = "partial";
  else overallStatus = "pending";

  // Apply approved changes to the topic
  const approvedChanges = updatedChanges.filter(
    (c) => statusMap.get(c.changeId) === "approved"
  );

  if (approvedChanges.length > 0) {
    const topicRef = db.collection("topics").doc(reqData.topicId);
    const topicSnap = await topicRef.get();

    if (topicSnap.exists) {
      let metrics = topicSnap.data()!.metrics ?? [];

      for (const change of approvedChanges) {
        metrics = applyChange(metrics, change);
      }

      await topicRef.update({ metrics });
    }
  }

  // Update the request document
  await reqRef.update({
    changes: updatedChanges,
    status: overallStatus,
    reviewedBy: request.auth!.uid,
    reviewedAt: Date.now(),
  });

  // Audit
  await db.collection("auditLog").add({
    action: `request.reviewed`,
    actorId: request.auth!.uid,
    targetType: "changeRequest",
    targetId: requestId,
    metadata: {
      topicId: reqData.topicId,
      approvedCount: approvedChanges.length,
      rejectedCount: updatedChanges.filter((c) => c.status === "rejected").length,
      overallStatus,
    },
    timestamp: Date.now(),
  });

  return { success: true, status: overallStatus };
});

/**
 * Moderator+: bulk approve/reject entire change requests.
 */
export const adminBulkUpdateRequests = onCall(async (request) => {
  requireRole(request, "moderator");
  const db = getFirestore();

  const { requestIds, status } = request.data as {
    requestIds: string[];
    status: "approved" | "rejected";
  };

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "requestIds must be a non-empty array."
    );
  }
  if (requestIds.length > 50) {
    throw new HttpsError(
      "invalid-argument",
      "Can update at most 50 requests at once."
    );
  }

  const now = Date.now();

  for (const id of requestIds) {
    const ref = db.collection("requests").doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.status !== "pending") continue;

    const reqData = snap.data()!;
    const changes = (reqData.changes ?? []) as ProposedChange[];

    // Set all changes to the bulk status
    const updatedChanges = changes.map((c) => ({
      ...c,
      status,
    }));

    // If approving, apply all changes to topic
    if (status === "approved" && changes.length > 0) {
      const topicRef = db.collection("topics").doc(reqData.topicId);
      const topicSnap = await topicRef.get();
      if (topicSnap.exists) {
        let metrics = topicSnap.data()!.metrics ?? [];
        for (const change of changes) {
          metrics = applyChange(metrics, change);
        }
        await topicRef.update({ metrics });
      }
    }

    await ref.update({
      changes: updatedChanges,
      status,
      reviewedBy: request.auth!.uid,
      reviewedAt: now,
    });
  }

  // Audit
  await db.collection("auditLog").add({
    action: `requests.bulk_${status}`,
    actorId: request.auth!.uid,
    targetType: "changeRequests",
    targetId: "batch",
    metadata: { count: requestIds.length, requestIds },
    timestamp: now,
  });

  return { success: true, count: requestIds.length };
});
