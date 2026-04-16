import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { requireRole } from "../utils/adminOnly";
import { Octokit } from "@octokit/rest";
import matter from "gray-matter";

const githubToken = defineSecret("GITHUB_PAT");

const REPO_OWNER = "ranzlappen";
const REPO_NAME = "website";
const BRANCH = "main";

/**
 * List existing blog posts from the GitHub repo _posts/ directory.
 */
export const blogListExistingPosts = onCall(
  { secrets: [githubToken] },
  async (request) => {
    requireRole(request, "author");

    const octokit = new Octokit({ auth: githubToken.value() });

    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: "_posts",
      ref: BRANCH,
    });

    if (!Array.isArray(data)) {
      throw new HttpsError("internal", "Unexpected response from GitHub.");
    }

    const posts = data
      .filter((f) => f.type === "file" && f.name.endsWith(".md"))
      .map((f) => ({
        name: f.name,
        sha: f.sha,
        size: f.size,
      }));

    return { posts };
  }
);

/**
 * Fetch and parse an existing blog post from GitHub.
 * Returns parsed front matter + body + SHA for editing.
 */
export const blogFetchExistingPost = onCall(
  { secrets: [githubToken] },
  async (request) => {
    requireRole(request, "author");

    const { filename } = request.data as { filename: string };
    if (!filename || !filename.endsWith(".md")) {
      throw new HttpsError(
        "invalid-argument",
        "filename is required and must end with .md"
      );
    }

    // Validate no path traversal
    if (filename.includes("/") || filename.includes("..")) {
      throw new HttpsError("invalid-argument", "Invalid filename.");
    }

    const octokit = new Octokit({ auth: githubToken.value() });

    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `_posts/${filename}`,
      ref: BRANCH,
    });

    if (Array.isArray(data) || data.type !== "file") {
      throw new HttpsError("not-found", "File not found.");
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const parsed = matter(content);

    // Extract slug from filename: YYYY-MM-DD-slug.md -> slug
    const slugMatch = filename.match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/);
    const slug = slugMatch ? slugMatch[1] : filename.replace(".md", "");

    // Map front matter keys to camelCase
    const fm = parsed.data;
    const frontMatter = {
      title: fm.title ?? "",
      description: fm.description ?? "",
      date:
        typeof fm.date === "string"
          ? fm.date
          : fm.date instanceof Date
            ? fm.date.toISOString().split("T")[0]
            : "",
      category: fm.category ?? "",
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      image: fm.image ?? "",
      status: fm.status ?? "published",
      series: fm.series ?? null,
      seriesOrder: fm.series_order ?? null,
      comments: fm.comments !== false,
      author: fm.author ?? null,
      keywords: Array.isArray(fm.keywords) ? fm.keywords : [],
      backdrop: fm.backdrop ?? null,
      polyvoteTopic: fm.polyvote_topic ?? null,
    };

    return {
      filename,
      slug,
      frontMatter,
      body: parsed.content.trim(),
      sha: data.sha,
    };
  }
);
