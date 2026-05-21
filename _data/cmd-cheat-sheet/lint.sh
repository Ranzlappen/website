#!/usr/bin/env bash
# Lint the built CLI cheat-sheet page for entries below the minimum quality bar
# (≥1 flag, ≥1 example). The template emits <!-- LINT: ... --> HTML comments
# for under-spec entries; this script greps them out of _site/.
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
  echo "lint: $matches under-spec entries (minimum bar: ≥1 flag, ≥1 example):" >&2
  grep -oE '<!-- LINT:[^>]+-->' "$out" | sed 's/<!-- /  /; s/ -->//' >&2
  exit 1
fi
echo "lint: clean ($(grep -c '<tr id=\"cmd-' "$out") entries)"
