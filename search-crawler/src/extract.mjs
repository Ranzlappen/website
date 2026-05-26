// Dependency-free HTML / Markdown text extraction. Good enough for
// search snippets - not a full DOM parser. (Note: SPA shells fetched
// without JS execution yield only their static title/meta + skeleton
// text; see README "Limitations".)

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decode(str) {
  return (str || "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function stripTags(html) {
  return (html || "").replace(/<[^>]*>/g, " ");
}

// Extract a {title, description, text} document from raw HTML.
export function htmlToDoc(html) {
  let title = "";
  const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (tm) title = decode(stripTags(tm[1])).replace(/\s+/g, " ").trim();

  let description = "";
  const dm = html.match(
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
  );
  if (dm) description = decode(dm[1]).replace(/\s+/g, " ").trim();

  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  const text = decode(stripTags(body)).replace(/\s+/g, " ").trim();

  return { title, description, text };
}

// Absolute same-document links found in raw HTML, resolved against baseUrl.
export function extractLinks(html, baseUrl) {
  const links = [];
  const re = /href=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      links.push(new URL(m[1], baseUrl).href);
    } catch {
      /* skip malformed href */
    }
  }
  return links;
}

// Reduce Markdown to readable plain text for indexing.
export function markdownToText(md) {
  return (md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>~|#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
