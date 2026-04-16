import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { requireRole } from "../utils/adminOnly";
import * as yaml from "js-yaml";
import { Octokit } from "@octokit/rest";

const githubToken = defineSecret("GITHUB_PAT");

const REPO_OWNER = "ranzlappen";
const REPO_NAME = "website";
const BRANCH = "main";

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

function generateMarkdownFile(frontMatter: FrontMatter, body: string): string {
  const fm: Record<string, unknown> = {
    title: frontMatter.title,
    date: frontMatter.date,
    category: frontMatter.category,
    tags: frontMatter.tags,
    status: frontMatter.status,
    comments: frontMatter.comments,
  };

  if (frontMatter.description) fm.description = frontMatter.description;
  if (frontMatter.image) fm.image = frontMatter.image;
  if (frontMatter.keywords.length) fm.keywords = frontMatter.keywords;
  if (frontMatter.series) fm.series = frontMatter.series;
  if (frontMatter.seriesOrder != null)
    fm.series_order = frontMatter.seriesOrder;
  if (frontMatter.author) fm.author = frontMatter.author;
  if (frontMatter.polyvoteTopic)
    fm.polyvote_topic = frontMatter.polyvoteTopic;
  if (frontMatter.backdrop) fm.backdrop = frontMatter.backdrop;

  const yamlStr = yaml.dump(fm, { lineWidth: -1, quotingType: '"' });
  return `---\n${yamlStr}---\n\n${body}\n`;
}

/**
 * Publish a blog draft to GitHub by creating/updating the markdown file.
 */
export const blogPublishToGitHub = onCall(
  { secrets: [githubToken] },
  async (request) => {
    requireRole(request, "author");
    const db = getFirestore();
    const uid = request.auth!.uid;

    const { draftId } = request.data as { draftId: string };
    if (!draftId) {
      throw new HttpsError("invalid-argument", "draftId is required.");
    }

    // Load draft
    const draftRef = db.collection("blogDrafts").doc(draftId);
    const draftSnap = await draftRef.get();
    if (!draftSnap.exists) {
      throw new HttpsError("not-found", "Draft not found.");
    }

    const draft = draftSnap.data()!;
    const callerRole = (request.auth!.token.role as string) || "user";
    if (draft.authorUid !== uid && callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Not your draft.");
    }

    // Generate markdown content
    const frontMatter = draft.frontMatter as FrontMatter;
    const markdown = generateMarkdownFile(frontMatter, draft.body);
    const filePath = `_posts/${draft.filename}`;

    // GitHub API
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

    // Create or update file
    const commitMessage = existingSha
      ? `blog: update ${draft.slug}`
      : `blog: add ${draft.slug}`;

    const result = await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(markdown).toString("base64"),
      sha: existingSha,
      branch: BRANCH,
    });

    const commitSha = result.data.commit.sha;
    const commitUrl = result.data.commit.html_url;
    const now = Date.now();

    // Update draft with publish info
    await draftRef.update({
      githubSha: result.data.content?.sha ?? null,
      lastPublishedAt: now,
      draftStatus: "published",
    });

    // Audit log
    await db.collection("blogPublishLog").add({
      draftId,
      filename: draft.filename,
      action: existingSha ? "update" : "create",
      actorUid: uid,
      commitSha,
      commitUrl: commitUrl ?? null,
      timestamp: now,
    });

    return { commitSha, commitUrl };
  }
);
