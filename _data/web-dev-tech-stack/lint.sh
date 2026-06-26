#!/usr/bin/env bash
# Lint the built Web Dev Tech Stack page for entries below the minimum quality
# bar (a description, ≥1 use case, a maturity rating, ≥1 layer, and ≥1 docs
# link; plus every example carrying both `code` and `explain`).
# The template emits <!-- LINT: ... --> HTML comments for under-spec entries;
# this script greps them out of _site/.
#
# Exit codes:
#   0 — no lint warnings (clean)
#   1 — one or more LINT: comments found in built output
#   2 — built page not found (run `bundle exec jekyll build` first)
#
# Usage:
#   bundle exec jekyll build && bash _data/web-dev-tech-stack/lint.sh
set -eu

out=_site/references/web-dev-tech-stack/index.html
if [ ! -f "$out" ]; then
  echo "lint: $out not found — run \`bundle exec jekyll build\` first" >&2
  exit 2
fi

matches=$(grep -c '<!-- LINT:' "$out" || true)
if [ "$matches" -gt 0 ]; then
  echo "lint: $matches under-spec entries (bar: description, ≥1 use case, maturity, ≥1 layer, ≥1 docs link; examples need code+explain):" >&2
  grep -oE '<!-- LINT:[^>]+-->' "$out" | sed 's/<!-- /  /; s/ -->//' >&2
  exit 1
fi

# Guard against raw HTML injection from unescaped angle brackets in raw-rendered
# fields (description, gotchas — both markdownify'd). A literal placeholder like
# <Component> in a description is parsed as a real element and corrupts the table
# DOM from that row on. The table body must never contain a rawtext/script tag.
injected=$(ruby -e '
  h = File.read(ARGV[0], encoding: "UTF-8")
  t = h[/<table\b.*?<\/table>/m] or abort "lint: no <table> found in built page"
  hits = t.scan(/<(script|style|textarea|title|xmp|noscript|iframe)\b/i).flatten.map(&:downcase).uniq
  puts hits.join(" ")
' "$out")
if [ -n "$injected" ]; then
  echo "lint: raw HTML injection inside the tech-stack table — stray <$injected> tag(s)." >&2
  echo "      A raw-rendered field (description / gotchas) likely contains an" >&2
  echo "      unescaped placeholder like <Component>. Escape it (&lt;…&gt;) or wrap in <code>." >&2
  exit 1
fi

echo "lint: clean ($(grep -c '<tr id="row-' "$out") entries)"
