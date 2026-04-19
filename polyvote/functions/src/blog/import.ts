import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "../utils/adminOnly";
import {
  githubToken,
  parseGitHubPost,
  validateImportFilename,
} from "./github";

type AuthorChoice =
  | { kind: "default" }
  | { kind: "keep" }
  | { kind: "custom"; value: string };

function parseAuthorChoice(raw: unknown): AuthorChoice {
  if (raw && typeof raw === "object") {
    const v = (raw as { value?: unknown }).value;
    if (typeof v === "string") {
      return { kind: "custom", value: v };
    }
  }
  if (raw === "keep") return { kind: "keep" };
  return { kind: "default" };
}

/**
 * Import an existing `_posts/` file as a draft in "Edit" mode.
 *
 * If the caller already has a draft linked to this filename (via
 * `sourceFilename`), reuse it — applying the optional author override to its
 * front matter. Otherwise, create a fresh draft seeded from the GitHub content.
 *
 * Returns the draft id so the UI can navigate to /edit/:draftId.
 */
export const blogImportPostForEdit = onCall(
  { secrets: [githubToken] },
  async (request) => {
    requireRole(request, "author");
    const db = getFirestore();
    const uid = request.auth!.uid;
    const callerRole = (request.auth!.token.role as string) || "user";

    const { filename, authorChoice: rawAuthorChoice } = request.data as {
      filename: string;
      authorChoice?: unknown;
    };
    const safeFilename = validateImportFilename(filename);
    const authorChoice = parseAuthorChoice(rawAuthorChoice);

    // Find an existing linked draft. Authors can only match their own.
    // Admins can reuse any draft linked to this filename so we don't create a
    // second admin-owned duplicate for the same source file.
    let query: FirebaseFirestore.Query = db
      .collection("blogDrafts")
      .where("sourceFilename", "==", safeFilename);
    if (callerRole !== "admin") {
      query = query.where("authorUid", "==", uid);
    }
    const snap = await query.orderBy("updatedAt", "desc").limit(1).get();

    const parsed = await parseGitHubPost(safeFilename, githubToken.value());

    const resolvedAuthor = (() => {
      if (authorChoice.kind === "default") return null;
      if (authorChoice.kind === "keep") return parsed.frontMatter.author;
      const trimmed = authorChoice.value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })();

    const now = Date.now();

    if (!snap.empty) {
      const existing = snap.docs[0];
      // Update only the author field; leave body / other edits intact so a
      // user who's been editing the draft doesn't lose work on re-import.
      await existing.ref.update({
        "frontMatter.author": resolvedAuthor,
        updatedAt: now,
      });
      return { draftId: existing.id, created: false };
    }

    const frontMatter = {
      ...parsed.frontMatter,
      author: resolvedAuthor,
    };
    const draftRef = db.collection("blogDrafts").doc();
    await draftRef.set({
      slug: parsed.slug,
      filename: safeFilename,
      frontMatter,
      body: parsed.body,
      authorUid: uid,
      createdAt: now,
      updatedAt: now,
      githubSha: parsed.sha,
      lastPublishedAt: null,
      draftStatus: "editing",
      sourceFilename: safeFilename,
    });

    return { draftId: draftRef.id, created: true };
  }
);
