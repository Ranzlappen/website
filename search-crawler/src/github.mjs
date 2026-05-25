// Crawl a GitHub user's public repos + gists via the REST API.
// Uses process.env.GITHUB_TOKEN when present (raises the rate limit from
// 60 to 5000/hr — the re-crawl workflow passes the Actions token).
// Handles Link-header pagination and backs off on 403 (rate limit).

import { fetchWithTimeout, sleep, truncate } from "./util.mjs";
import { markdownToText } from "./extract.mjs";

const API = "https://api.github.com";

function headers() {
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function paged(path, timeoutMs) {
  const out = [];
  let url = `${API}${path}`;
  while (url) {
    let res;
    try {
      res = await fetchWithTimeout(url, { headers: headers() }, timeoutMs);
    } catch (err) {
      console.warn(`  ! GitHub fetch failed ${url}: ${err.message}`);
      break;
    }
    if (res.status === 403 || res.status === 429) {
      console.warn(`  ! GitHub rate-limited (${res.status}); stopping pagination.`);
      break;
    }
    if (!res.ok) {
      console.warn(`  ! GitHub ${res.status} at ${url}`);
      break;
    }
    const page = await res.json();
    if (Array.isArray(page)) out.push(...page);
    const link = res.headers.get("link") || "";
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return out;
}

async function readmeText(user, repo, branch, timeoutMs) {
  const url = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/README.md`;
  try {
    const res = await fetchWithTimeout(url, {}, timeoutMs);
    if (!res.ok) return "";
    return markdownToText(await res.text());
  } catch {
    return "";
  }
}

export async function crawlGitHub(config, crawl) {
  const { user, reposGroup, gistsGroup } = config;
  const { timeoutMs, snippetChars, delayMs } = crawl;
  const entries = [];

  console.log(`Fetching GitHub repos for ${user}`);
  const repos = await paged(`/users/${user}/repos?per_page=100&type=owner&sort=updated`, timeoutMs);
  for (const repo of repos) {
    if (repo.fork || repo.private) continue;
    const topics = (repo.topics || []).join(" ");
    const readme = await readmeText(user, repo.name, repo.default_branch || "HEAD", timeoutMs);
    if (delayMs) await sleep(delayMs);
    const body = [repo.description || "", topics, readme].filter(Boolean).join(" ");
    entries.push({
      title: repo.name,
      url: repo.html_url,
      content: truncate(body, snippetChars),
      group: reposGroup,
      tags: topics,
      date: (repo.pushed_at || "").slice(0, 10),
      source: "github.com",
    });
  }
  console.log(`  · indexed ${entries.length} repo(s)`);

  console.log(`Fetching GitHub gists for ${user}`);
  const before = entries.length;
  const gists = await paged(`/users/${user}/gists?per_page=100`, timeoutMs);
  for (const gist of gists) {
    const files = Object.keys(gist.files || {}).join(" ");
    const body = [gist.description || "", files].filter(Boolean).join(" ");
    entries.push({
      title: gist.description || files || gist.id,
      url: gist.html_url,
      content: truncate(body, snippetChars),
      group: gistsGroup,
      date: (gist.updated_at || "").slice(0, 10),
      source: "gist.github.com",
    });
  }
  console.log(`  · indexed ${entries.length - before} gist(s)`);

  return entries;
}
