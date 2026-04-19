import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { Octokit } from "@octokit/rest";
import { requireRole } from "../utils/adminOnly";
import {
  githubToken,
  REPO_OWNER,
  REPO_NAME,
  BRANCH,
  parseGitHubPost,
} from "./github";

interface PostUsage {
  source: "published";
  series: string;
  seriesOrder: number | null;
  title: string;
  filename: string;
  status: string;
}

interface DraftUsage {
  source: "draft";
  series: string;
  seriesOrder: number | null;
  title: string;
  filename: string;
  draftId: string;
}

/**
 * List every post + draft that references a series, along with its
 * `seriesOrder`. Used by the admin editor to warn authors when an order number
 * is already taken within a series.
 */
export const blogListSeriesUsage = onCall(
  { secrets: [githubToken] },
  async (request) => {
    requireRole(request, "author");

    const token = githubToken.value();
    const octokit = new Octokit({ auth: token });

    // 1. Published posts from GitHub _posts/
    const { data: dir } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: "_posts",
      ref: BRANCH,
    });
    if (!Array.isArray(dir)) {
      throw new HttpsError("internal", "Unexpected response from GitHub.");
    }
    const mdFiles = dir.filter(
      (f) => f.type === "file" && f.name.endsWith(".md")
    );

    const parsed = await Promise.all(
      mdFiles.map(async (f) => {
        try {
          return await parseGitHubPost(f.name, token);
        } catch {
          return null;
        }
      })
    );

    const posts: PostUsage[] = [];
    for (const p of parsed) {
      if (!p || !p.frontMatter.series) continue;
      posts.push({
        source: "published",
        series: p.frontMatter.series,
        seriesOrder: p.frontMatter.seriesOrder,
        title: p.frontMatter.title,
        filename: p.filename,
        status: p.frontMatter.status,
      });
    }

    // 2. Drafts from Firestore (scoped by role, matching blogListDrafts)
    const db = getFirestore();
    const uid = request.auth!.uid;
    const callerRole = (request.auth!.token.role as string) || "user";

    let query: FirebaseFirestore.Query = db.collection("blogDrafts");
    if (callerRole !== "admin") {
      query = query.where("authorUid", "==", uid);
    }
    const snap = await query.limit(500).get();

    const drafts: DraftUsage[] = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      const fm = (data.frontMatter || {}) as Record<string, unknown>;
      const series = typeof fm.series === "string" ? fm.series : null;
      if (!series) continue;
      const seriesOrder =
        typeof fm.seriesOrder === "number" ? fm.seriesOrder : null;
      drafts.push({
        source: "draft",
        series,
        seriesOrder,
        title: typeof fm.title === "string" ? fm.title : "(untitled)",
        filename: typeof data.filename === "string" ? data.filename : "",
        draftId: doc.id,
      });
    }

    return { posts, drafts };
  }
);
