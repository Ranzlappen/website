import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { requireRole } from "../utils/adminOnly";
import { Octokit } from "@octokit/rest";
import matter from "gray-matter";

export const githubToken: ReturnType<typeof defineSecret> =
  defineSecret("GITHUB_PAT");

export const REPO_OWNER = "ranzlappen";
export const REPO_NAME = "website";
export const BRANCH = "main";

export interface ParsedGitHubPost {
  filename: string;
  slug: string;
  frontMatter: {
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
  };
  body: string;
  sha: string;
}

/**
 * Fetch a `_posts/{filename}` file from GitHub and parse its YAML front matter
 * into our camelCase shape. Shared by `blogFetchExistingPost` (read-only UI
 * preview) and `blogImportPostForEdit` (create/update draft).
 *
 * Callers are responsible for `requireRole` and filename validation.
 */
export async function parseGitHubPost(
  filename: string,
  token: string
): Promise<ParsedGitHubPost> {
  const octokit = new Octokit({ auth: token });

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

  const fm = parsed.data as Record<string, unknown>;
  const str = (v: unknown, fallback = ""): string =>
    typeof v === "string" ? v : fallback;
  const arrStr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  const strOrNull = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;

  const dateRaw = fm.date;
  const date =
    typeof dateRaw === "string"
      ? dateRaw
      : dateRaw instanceof Date
        ? dateRaw.toISOString().split("T")[0]
        : "";

  const seriesOrderRaw = fm.series_order;
  const seriesOrder =
    typeof seriesOrderRaw === "number" ? seriesOrderRaw : null;

  const frontMatter = {
    title: str(fm.title),
    description: str(fm.description),
    date,
    category: str(fm.category),
    tags: arrStr(fm.tags),
    image: str(fm.image),
    status: str(fm.status, "published"),
    series: strOrNull(fm.series),
    seriesOrder,
    comments: fm.comments !== false,
    author: strOrNull(fm.author),
    keywords: arrStr(fm.keywords),
    backdrop: strOrNull(fm.backdrop),
    polyvoteTopic: strOrNull(fm.polyvote_topic),
  };

  return {
    filename,
    slug,
    frontMatter,
    body: parsed.content.trim(),
    sha: data.sha,
  };
}

export function validateImportFilename(filename: unknown): string {
  if (typeof filename !== "string" || !filename.endsWith(".md")) {
    throw new HttpsError(
      "invalid-argument",
      "filename is required and must end with .md"
    );
  }
  if (filename.includes("/") || filename.includes("..")) {
    throw new HttpsError("invalid-argument", "Invalid filename.");
  }
  return filename;
}

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
    const safeFilename = validateImportFilename(filename);

    return parseGitHubPost(safeFilename, githubToken.value());
  }
);
