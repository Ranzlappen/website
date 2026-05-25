// Crawl web hosts (subdomains + github.io). Per seed: verify reachability,
// then prefer the host's sitemap.xml, else a shallow same-host BFS.
// Unreachable seeds and failed pages are skipped without aborting the run.

import { fetchWithTimeout, sleep, truncate } from "./util.mjs";
import { htmlToDoc, extractLinks } from "./extract.mjs";

async function fetchHtml(url, timeoutMs) {
  try {
    const res = await fetchWithTimeout(url, {}, timeoutMs);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return null;
    return await res.text();
  } catch (err) {
    console.warn(`  ! fetch failed ${url}: ${err.message}`);
    return null;
  }
}

async function sitemapUrls(origin, timeoutMs) {
  try {
    const res = await fetchWithTimeout(
      new URL("/sitemap.xml", origin).href,
      {},
      timeoutMs,
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
      .map((m) => m[1])
      .filter((u) => {
        try {
          return new URL(u).origin === origin;
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

function toEntry(url, origin, group, html, snippetChars) {
  const { title, description, text } = htmlToDoc(html);
  const content = truncate(description ? `${description} ${text}` : text, snippetChars);
  if (!title && !content) return null;
  return {
    title: title || origin,
    url,
    content,
    group,
    source: new URL(url).host,
  };
}

export async function crawlWeb(seeds, crawl) {
  const { maxPagesPerHost, maxDepth, delayMs, timeoutMs, snippetChars } = crawl;
  const entries = [];

  for (const seed of seeds) {
    let origin;
    try {
      origin = new URL(seed.url).origin;
    } catch {
      continue;
    }
    console.log(`Crawling ${origin} (group: ${seed.group})`);

    const seedKey = seed.url.split("#")[0];
    const seedHtml = await fetchHtml(seedKey, timeoutMs);
    if (seedHtml === null) {
      console.warn(`  ! seed unreachable, skipping: ${seed.url}`);
      continue;
    }

    const fromSitemap = await sitemapUrls(origin, timeoutMs);
    const usingSitemap = fromSitemap.length > 0;
    const queue = usingSitemap
      ? fromSitemap.slice(0, maxPagesPerHost).map((u) => ({ url: u, depth: 0 }))
      : [{ url: seedKey, depth: 0 }];

    const visited = new Set();
    const cache = new Map([[seedKey, seedHtml]]);

    while (queue.length > 0 && visited.size < maxPagesPerHost) {
      const { url, depth } = queue.shift();
      const norm = url.split("#")[0];
      if (visited.has(norm)) continue;
      visited.add(norm);

      let html = cache.get(norm);
      if (html === undefined) {
        html = await fetchHtml(norm, timeoutMs);
        if (delayMs) await sleep(delayMs);
      }
      if (!html) continue;

      const entry = toEntry(norm, origin, seed.group, html, snippetChars);
      if (entry) entries.push(entry);

      if (!usingSitemap && depth < maxDepth) {
        for (const link of extractLinks(html, norm)) {
          try {
            if (new URL(link).origin === origin && !visited.has(link)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          } catch {
            /* skip */
          }
        }
      }
    }
    console.log(`  · indexed ${visited.size} page(s)`);
  }

  return entries;
}
