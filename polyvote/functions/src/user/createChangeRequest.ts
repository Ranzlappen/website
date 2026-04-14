import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireAuth } from "../utils/adminOnly";
import { moderateFields } from "../utils/contentFilter";

interface ProposedChange {
  changeId: string;
  action:
    | "edit-metric"
    | "delete-metric"
    | "edit-choice"
    | "delete-choice"
    | "add-metric"
    | "add-choice";
  metricId: string;
  choiceId?: string;
  oldValue?: { label?: string; color?: string };
  newValue?: {
    label?: string;
    color?: string;
    choices?: { id: string; label: string; color: string; votes: number }[];
  };
  status: "pending";
}

const VALID_ACTIONS = [
  "edit-metric",
  "delete-metric",
  "edit-choice",
  "delete-choice",
  "add-metric",
  "add-choice",
];

/**
 * Server-validated change request creation with structured changes.
 * Each change targets a specific metric or choice with a specific action.
 */
export const createChangeRequest = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = getFirestore();

  const { topicId, topicTitle, description, changes } = request.data as {
    topicId: string;
    topicTitle: string;
    description: string;
    changes: ProposedChange[];
  };

  if (!topicId || typeof topicId !== "string") {
    throw new HttpsError("invalid-argument", "topicId is required.");
  }

  if (!topicTitle || typeof topicTitle !== "string") {
    throw new HttpsError("invalid-argument", "topicTitle is required.");
  }

  if (!Array.isArray(changes) || changes.length === 0) {
    throw new HttpsError("invalid-argument", "At least one change is required.");
  }

  if (changes.length > 50) {
    throw new HttpsError("invalid-argument", "Too many changes (max 50).");
  }

  // Validate each change
  for (const change of changes) {
    if (!change.changeId || typeof change.changeId !== "string") {
      throw new HttpsError("invalid-argument", "Each change must have a changeId.");
    }
    if (!VALID_ACTIONS.includes(change.action)) {
      throw new HttpsError("invalid-argument", `Invalid action: ${change.action}`);
    }
    if (!change.metricId || typeof change.metricId !== "string") {
      throw new HttpsError("invalid-argument", "Each change must have a metricId.");
    }

    // Validate action-specific fields
    switch (change.action) {
      case "edit-metric":
        if (!change.newValue?.label?.trim()) {
          throw new HttpsError("invalid-argument", "edit-metric requires a new label.");
        }
        break;
      case "edit-choice":
        if (!change.choiceId) {
          throw new HttpsError("invalid-argument", "edit-choice requires a choiceId.");
        }
        if (!change.newValue?.label?.trim() && !change.newValue?.color) {
          throw new HttpsError(
            "invalid-argument",
            "edit-choice requires a new label or color."
          );
        }
        break;
      case "delete-metric":
        break;
      case "delete-choice":
        if (!change.choiceId) {
          throw new HttpsError("invalid-argument", "delete-choice requires a choiceId.");
        }
        break;
      case "add-choice":
        if (!change.newValue?.label?.trim() || !change.newValue?.color) {
          throw new HttpsError(
            "invalid-argument",
            "add-choice requires a label and color."
          );
        }
        break;
      case "add-metric":
        if (!change.newValue?.label?.trim()) {
          throw new HttpsError("invalid-argument", "add-metric requires a label.");
        }
        if (
          !Array.isArray(change.newValue?.choices) ||
          change.newValue.choices.length < 2
        ) {
          throw new HttpsError(
            "invalid-argument",
            "add-metric requires at least 2 choices."
          );
        }
        break;
    }
  }

  // Content moderation on all text fields in changes
  const fieldsToCheck: { name: string; value: string }[] = [];
  if (description?.trim()) {
    fieldsToCheck.push({ name: "description", value: description.trim() });
  }
  for (const c of changes) {
    if (c.newValue?.label) {
      fieldsToCheck.push({ name: `change ${c.action}`, value: c.newValue.label });
    }
    if (c.newValue?.choices) {
      for (const ch of c.newValue.choices) {
        fieldsToCheck.push({ name: `choice "${ch.label}"`, value: ch.label });
      }
    }
  }
  if (fieldsToCheck.length > 0) {
    const modResult = moderateFields(fieldsToCheck);
    if (modResult.blocked) {
      throw new HttpsError(
        "invalid-argument",
        `${modResult.reason} (in ${modResult.field})`
      );
    }
  }

  // Check if user is banned
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists && userDoc.data()?.status === "banned") {
    throw new HttpsError("permission-denied", "Your account has been banned.");
  }

  // Verify topic exists
  const topicDoc = await db.collection("topics").doc(topicId).get();
  if (!topicDoc.exists) {
    throw new HttpsError("not-found", "Topic not found.");
  }

  // Sanitize changes: ensure all statuses are pending
  const sanitizedChanges = changes.map((c) => ({
    changeId: c.changeId,
    action: c.action,
    metricId: c.metricId,
    ...(c.choiceId ? { choiceId: c.choiceId } : {}),
    ...(c.oldValue ? { oldValue: c.oldValue } : {}),
    ...(c.newValue ? { newValue: c.newValue } : {}),
    status: "pending" as const,
  }));

  const docRef = await db.collection("requests").add({
    topicId,
    topicTitle: topicTitle.trim(),
    description: description?.trim() || "",
    changes: sanitizedChanges,
    status: "pending",
    createdAt: Date.now(),
    authorId: uid,
  });

  return { id: docRef.id };
});
