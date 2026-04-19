import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";

const VALID_STATUSES = ["published", "draft", "placeholder", "unpublished"];
const VALID_CATEGORIES = [
  "Media",
  "Projects",
  "Technology",
  "Privacy",
  "UX Design",
];
const VALID_SERIES = [
  "media-trust",
  "project-showcases",
  "privacy-and-control",
];

interface FrontMatter {
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  image: string;
  status: string;
  series: string | null;
  seriesOrder: number | null;
  comments: boolean;
  author: string | null;
  keywords: string[];
  backdrop: string | null;
  polyvoteTopic: string | null;
}

function validateFrontMatter(data: unknown): FrontMatter {
  const d = data as Record<string, unknown>;
  if (!d || typeof d !== "object") {
    throw new HttpsError("invalid-argument", "frontMatter is required.");
  }

  const title = typeof d.title === "string" ? d.title.trim() : "";
  if (!title || title.length > 200) {
    throw new HttpsError(
      "invalid-argument",
      "title is required (max 200 chars)."
    );
  }

  const description =
    typeof d.description === "string" ? d.description.trim() : "";
  if (description.length > 500) {
    throw new HttpsError(
      "invalid-argument",
      "description must be under 500 chars."
    );
  }

  const date = typeof d.date === "string" ? d.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError(
      "invalid-argument",
      "date must be in YYYY-MM-DD format."
    );
  }

  const category = typeof d.category === "string" ? d.category.trim() : "";
  if (!VALID_CATEGORIES.includes(category)) {
    throw new HttpsError(
      "invalid-argument",
      `category must be one of: ${VALID_CATEGORIES.join(", ")}`
    );
  }

  const tags = Array.isArray(d.tags)
    ? d.tags.filter((t): t is string => typeof t === "string")
    : [];

  const image = typeof d.image === "string" ? d.image.trim() : "";

  const status = typeof d.status === "string" ? d.status.trim() : "draft";
  if (!VALID_STATUSES.includes(status)) {
    throw new HttpsError(
      "invalid-argument",
      `status must be one of: ${VALID_STATUSES.join(", ")}`
    );
  }

  const series =
    typeof d.series === "string" && d.series.trim() ? d.series.trim() : null;
  if (series && !VALID_SERIES.includes(series)) {
    throw new HttpsError(
      "invalid-argument",
      `series must be one of: ${VALID_SERIES.join(", ")}`
    );
  }

  const seriesOrder =
    series && typeof d.seriesOrder === "number" && d.seriesOrder > 0
      ? d.seriesOrder
      : null;

  const comments = d.comments !== false;

  const author =
    typeof d.author === "string" && d.author.trim() ? d.author.trim() : null;

  const keywords = Array.isArray(d.keywords)
    ? d.keywords.filter((k): k is string => typeof k === "string")
    : [];

  const backdrop =
    typeof d.backdrop === "string" && d.backdrop.trim()
      ? d.backdrop.trim()
      : null;

  const polyvoteTopic =
    typeof d.polyvoteTopic === "string" && d.polyvoteTopic.trim()
      ? d.polyvoteTopic.trim()
      : null;

  return {
    title,
    description,
    date,
    category,
    tags,
    image,
    status,
    series,
    seriesOrder,
    comments,
    author,
    keywords,
    backdrop,
    polyvoteTopic,
  };
}

function validateSlug(slug: unknown): string {
  if (typeof slug !== "string" || !slug.trim()) {
    throw new HttpsError("invalid-argument", "slug is required.");
  }
  const s = slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s) && s.length > 1) {
    throw new HttpsError(
      "invalid-argument",
      "slug must be lowercase alphanumeric with hyphens."
    );
  }
  if (s.length > 100) {
    throw new HttpsError("invalid-argument", "slug must be under 100 chars.");
  }
  return s;
}

/**
 * Save (create or update) a blog draft in Firestore.
 */
export const blogSaveDraft = onCall(async (request) => {
  requireRole(request, "author");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { draftId, slug, body } = request.data as {
    draftId?: string;
    slug: string;
    body: string;
  };

  const validSlug = validateSlug(slug);
  const frontMatter = validateFrontMatter(request.data.frontMatter);

  if (typeof body !== "string") {
    throw new HttpsError("invalid-argument", "body must be a string.");
  }

  const filename = `${frontMatter.date}-${validSlug}.md`;
  const now = Date.now();

  if (draftId) {
    // Update existing draft
    const draftRef = db.collection("blogDrafts").doc(draftId);
    const snap = await draftRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Draft not found.");
    }
    const existing = snap.data()!;
    // Only owner or admin can edit
    const callerRole = (request.auth!.token.role as string) || "user";
    if (existing.authorUid !== uid && callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Not your draft.");
    }

    await draftRef.update({
      slug: validSlug,
      filename,
      frontMatter,
      body,
      updatedAt: now,
    });

    return { id: draftId, updatedAt: now };
  } else {
    // Create new draft. Regular saves never link to a GitHub source file —
    // that's exclusively set by `blogImportPostForEdit`.
    const draftRef = db.collection("blogDrafts").doc();
    await draftRef.set({
      slug: validSlug,
      filename,
      frontMatter,
      body,
      authorUid: uid,
      createdAt: now,
      updatedAt: now,
      githubSha: null,
      lastPublishedAt: null,
      draftStatus: "editing",
      sourceFilename: null,
    });

    return { id: draftRef.id, updatedAt: now };
  }
});

/**
 * List blog drafts. Authors see their own; admins see all.
 */
export const blogListDrafts = onCall(async (request) => {
  requireRole(request, "author");
  const db = getFirestore();
  const uid = request.auth!.uid;
  const callerRole = (request.auth!.token.role as string) || "user";

  let query: FirebaseFirestore.Query = db
    .collection("blogDrafts")
    .orderBy("updatedAt", "desc");

  // Authors only see their own drafts; admins see all
  if (callerRole !== "admin") {
    query = query.where("authorUid", "==", uid);
  }

  const snap = await query.limit(100).get();
  const drafts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return { drafts, total: drafts.length };
});

/**
 * Get a single blog draft by ID.
 */
export const blogGetDraft = onCall(async (request) => {
  requireRole(request, "author");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { draftId } = request.data as { draftId: string };
  if (!draftId) {
    throw new HttpsError("invalid-argument", "draftId is required.");
  }

  const snap = await db.collection("blogDrafts").doc(draftId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Draft not found.");
  }

  const data = snap.data()!;
  const callerRole = (request.auth!.token.role as string) || "user";
  if (data.authorUid !== uid && callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Not your draft.");
  }

  return { id: snap.id, ...data };
});

/**
 * Delete a blog draft.
 */
export const blogDeleteDraft = onCall(async (request) => {
  requireRole(request, "author");
  const db = getFirestore();
  const uid = request.auth!.uid;

  const { draftId } = request.data as { draftId: string };
  if (!draftId) {
    throw new HttpsError("invalid-argument", "draftId is required.");
  }

  const draftRef = db.collection("blogDrafts").doc(draftId);
  const snap = await draftRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Draft not found.");
  }

  const data = snap.data()!;
  const callerRole = (request.auth!.token.role as string) || "user";
  if (data.authorUid !== uid && callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Not your draft.");
  }

  await draftRef.delete();

  return { success: true };
});
