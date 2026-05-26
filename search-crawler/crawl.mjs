// Entry point: crawl every configured source, then write the merged,
// deduped, group-sorted index to ../search-external.json (repo root) with
// stable key order + trailing newline for clean diffs on re-crawl.
//
//   node crawl.mjs            # local run (web works; GitHub needs token/quota)
//   GITHUB_TOKEN=... node crawl.mjs
//
// The web and GitHub phases are isolated so one failing never aborts the
// other - a partial index is preferable to none.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import config from "./sources.config.js";
import { crawlWeb } from "./src/web.mjs";
import { crawlGitHub } from "./src/github.mjs";
import { dedupeByUrl } from "./src/util.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "search-external.json");

// External-source render order (must match the tail of search.js GROUPS).
const GROUP_ORDER = ["apps", "gh-pages", "repos", "gists"];
const KEYS = ["title", "url", "content", "group", "tags", "category", "date", "source"];

async function main() {
  const collected = [];

  try {
    collected.push(...(await crawlWeb(config.web, config.crawl)));
  } catch (err) {
    console.warn(`Web crawl error: ${err.message}`);
  }

  try {
    collected.push(...(await crawlGitHub(config.github, config.crawl)));
  } catch (err) {
    console.warn(`GitHub crawl error: ${err.message}`);
  }

  const sorted = dedupeByUrl(collected).sort((a, b) => {
    const g = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    return g !== 0 ? g : (a.title || "").localeCompare(b.title || "");
  });

  const normalized = sorted.map((e) => {
    const o = {};
    for (const k of KEYS) {
      if (e[k] !== undefined && e[k] !== "") o[k] = e[k];
    }
    return o;
  });

  await writeFile(OUT, JSON.stringify(normalized, null, 2) + "\n", "utf8");

  const byGroup = {};
  for (const e of normalized) byGroup[e.group] = (byGroup[e.group] || 0) + 1;
  console.log(`\nWrote ${normalized.length} entries to ${OUT}`);
  console.log("By group:", JSON.stringify(byGroup));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
