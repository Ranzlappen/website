// Shared crawler utilities: timed fetch, politeness, truncation, dedupe.

export const USER_AGENT =
  "ranzlappen-search-crawler/1.0 (+https://www.ranzlappen.com)";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// fetch() with an abort-on-timeout and a default User-Agent.
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, ...(options.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Collapse whitespace and cap length, appending an ellipsis when cut.
export function truncate(str, n) {
  const s = (str || "").replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "...";
}

// Keep the first entry seen per URL (the Lunr ref must be unique).
export function dedupeByUrl(entries) {
  const seen = new Map();
  for (const e of entries) {
    if (!e || !e.url || seen.has(e.url)) continue;
    seen.set(e.url, e);
  }
  return [...seen.values()];
}
