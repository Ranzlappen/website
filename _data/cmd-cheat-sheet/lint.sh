#!/usr/bin/env bash
# Lint the built CLI cheat-sheet page for entries below the minimum quality bar
# (≥1 flag, ≥1 example, and every example carrying both `code` and `explain`).
# The template emits <!-- LINT: ... --> HTML comments for under-spec entries;
# this script greps them out of _site/.
#
# Exit codes:
#   0 — no lint warnings (clean)
#   1 — one or more LINT: comments found in built output
#   2 — built page not found (run `bundle exec jekyll build` first)
#
# Usage:
#   bundle exec jekyll build && bash _data/cmd-cheat-sheet/lint.sh
set -eu

out=_site/references/cmd-cheat-sheet/index.html
if [ ! -f "$out" ]; then
  echo "lint: $out not found — run \`bundle exec jekyll build\` first" >&2
  exit 2
fi

matches=$(grep -c '<!-- LINT:' "$out" || true)
if [ "$matches" -gt 0 ]; then
  echo "lint: $matches under-spec entries (bar: ≥1 flag, ≥1 example, each example needs code+explain):" >&2
  grep -oE '<!-- LINT:[^>]+-->' "$out" | sed 's/<!-- /  /; s/ -->//' >&2
  exit 1
fi

# Guard against raw HTML injection from unescaped angle brackets in raw-rendered
# fields (descriptions, flag descriptions, modern, gotchas). A literal placeholder
# like <script> in a description is parsed as a real element and corrupts the table
# DOM from that row on (this caused the "footer inside the table" regression). The
# table body must never contain a rawtext/script/embedded tag — those belong only
# in the head/JSON islands, never inside the command table.
injected=$(ruby -e '
  h = File.read(ARGV[0], encoding: "UTF-8")
  t = h[/<table\b.*?<\/table>/m] or abort "lint: no <table> found in built page"
  hits = t.scan(/<(script|style|textarea|title|xmp|noscript|iframe)\b/i).flatten.map(&:downcase).uniq
  puts hits.join(" ")
' "$out")
if [ -n "$injected" ]; then
  echo "lint: raw HTML injection inside the command table — stray <$injected> tag(s)." >&2
  echo "      A raw-rendered field (description / flag description / modern / gotchas) likely" >&2
  echo "      contains an unescaped placeholder like <script>. Escape it (&lt;…&gt;) or wrap in <code>." >&2
  exit 1
fi

echo "lint: clean ($(grep -c '<tr id=\"cmd-' "$out") entries)"
