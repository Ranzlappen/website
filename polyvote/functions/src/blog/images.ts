import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { requireRole } from "../utils/adminOnly";
import { Octokit } from "@octokit/rest";

const githubToken = defineSecret("GITHUB_PAT");

const REPO_OWNER = "ranzlappen";
const REPO_NAME = "website";
const BRANCH = "main";

const ALLOWED_EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Upload an image to the GitHub repo at assets/images/{slug}/{filename}.
 */
export const blogUploadImage = onCall(
  { secrets: [githubToken] },
  async (request) => {
    requireRole(request, "author");
    const db = getFirestore();
    const uid = request.auth!.uid;

    const { slug, filename, base64Data } = request.data as {
      slug: string;
      filename: string;
      base64Data: string;
    };

    if (!slug || !filename || !base64Data) {
      throw new HttpsError(
        "invalid-argument",
        "slug, filename, and base64Data are required."
      );
    }

    // Validate slug
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
      throw new HttpsError("invalid-argument", "Invalid slug format.");
    }

    // Validate filename
    const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new HttpsError(
        "invalid-argument",
        `File type must be one of: ${ALLOWED_EXTENSIONS.join(", ")}`
      );
    }

    if (!/^[a-z0-9][a-z0-9._-]*$/.test(filename)) {
      throw new HttpsError(
        "invalid-argument",
        "Filename must be lowercase alphanumeric with hyphens, dots, or underscores."
      );
    }

    // Validate size
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new HttpsError(
        "invalid-argument",
        "Image must be under 5MB."
      );
    }

    // Rate limiting: max 20 uploads per hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentUploads = await db
      .collection("blogPublishLog")
      .where("actorUid", "==", uid)
      .where("action", "==", "image-upload")
      .where("timestamp", ">", oneHourAgo)
      .count()
      .get();

    if (recentUploads.data().count >= 20) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many uploads. Max 20 per hour."
      );
    }

    const filePath = `assets/images/${slug}/${filename}`;
    const octokit = new Octokit({ auth: githubToken.value() });

    // Check if file already exists
    let existingSha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: filePath,
        ref: BRANCH,
      });
      if (!Array.isArray(data) && data.type === "file") {
        existingSha = data.sha;
      }
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status !== 404) throw e;
    }

    const result = await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      message: `blog: upload image ${slug}/${filename}`,
      content: base64Data,
      sha: existingSha,
      branch: BRANCH,
    });

    // Audit log
    await db.collection("blogPublishLog").add({
      draftId: null,
      filename: filePath,
      action: "image-upload",
      actorUid: uid,
      commitSha: result.data.commit.sha,
      commitUrl: result.data.commit.html_url ?? null,
      timestamp: Date.now(),
    });

    return {
      path: `/${filePath}`,
      commitSha: result.data.commit.sha,
    };
  }
);
