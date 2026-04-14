import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireAuth } from "../utils/adminOnly";

const REQUEST_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Server-validated topic request creation.
 * - Validates all fields (title, description, category, metrics structure)
 * - Checks user is not banned
 * - Initializes endorsers with author
 * - Sets proper timestamps
 */
export const createTopicRequest = onCall(async (request) => {
  const uid = requireAuth(request);
  const db = getFirestore();

  const { title, description, category, metrics } = request.data as {
    title: string;
    description: string;
    category: string;
    metrics: {
      id: string;
      label: string;
      choices: { id: string; label: string; color: string; votes: number }[];
    }[];
  };

  // Validate title
  if (!title || typeof title !== "string") {
    throw new HttpsError("invalid-argument", "Title is required.");
  }
  const trimTitle = title.trim();
  if (trimTitle.length === 0 || trimTitle.length > 200) {
    throw new HttpsError(
      "invalid-argument",
      "Title must be between 1 and 200 characters."
    );
  }

  // Validate description
  if (!description || typeof description !== "string") {
    throw new HttpsError("invalid-argument", "Description is required.");
  }
  if (description.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Description cannot be empty.");
  }

  // Validate category
  const validCategories = [
    "Politics",
    "Technology",
    "Science",
    "Culture",
    "Environment",
    "Health",
    "Sports",
    "Other",
  ];
  if (!category || !validCategories.includes(category)) {
    throw new HttpsError("invalid-argument", "Invalid category.");
  }

  // Validate metrics
  if (!Array.isArray(metrics) || metrics.length === 0 || metrics.length > 6) {
    throw new HttpsError(
      "invalid-argument",
      "Must have between 1 and 6 metrics."
    );
  }

  for (const m of metrics) {
    if (!m.id || !m.label || typeof m.label !== "string" || !m.label.trim()) {
      throw new HttpsError("invalid-argument", "Each metric must have a label.");
    }
    if (
      !Array.isArray(m.choices) ||
      m.choices.length < 2 ||
      m.choices.length > 6
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Each metric must have 2-6 choices."
      );
    }
    for (const c of m.choices) {
      if (!c.id || !c.label || typeof c.label !== "string" || !c.label.trim()) {
        throw new HttpsError(
          "invalid-argument",
          "Each choice must have a label."
        );
      }
      if (!c.color || typeof c.color !== "string") {
        throw new HttpsError(
          "invalid-argument",
          "Each choice must have a color."
        );
      }
    }
  }

  // Check if user is banned
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists && userDoc.data()?.status === "banned") {
    throw new HttpsError("permission-denied", "Your account has been banned.");
  }

  const now = Date.now();

  // Sanitize metrics: ensure votes start at 0
  const sanitizedMetrics = metrics.map((m) => ({
    id: m.id,
    label: m.label.trim(),
    choices: m.choices.map((c) => ({
      id: c.id,
      label: c.label.trim(),
      color: c.color,
      votes: 0,
    })),
  }));

  const docRef = await db.collection("topicRequests").add({
    title: trimTitle,
    description: description.trim(),
    category,
    metrics: sanitizedMetrics,
    status: "pending",
    createdAt: now,
    expiresAt: now + REQUEST_TIMEOUT_MS,
    authorId: uid,
    endorsers: [uid],
    endorsementCount: 1,
  });

  return { id: docRef.id };
});
