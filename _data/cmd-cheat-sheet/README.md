# `_data/cmd-cheat-sheet/` — CLI Command Cheat Sheet Data

Source data for the [`/references/cmd-cheat-sheet/`](../../pages/references/cmd-cheat-sheet.html) page. Every row in the table, every entry in the abbreviations glossary, and every category tab on that page comes from a YAML file here (or, for the glossary, from `_data/abbreviations/cmd-cheat-sheet.yml`). **You don't need to touch the page template to add or edit content** — Jekyll re-reads these files on every build.

---

## File layout

| File | Role |
|---|---|
| `01-files-and-dirs.yml` … `13-shell-operators-and-redirection.yml` | One file per **category** of commands. Each file contributes one tab and a chunk of table rows. |

Jekyll exposes everything under `site.data["cmd-cheat-sheet"].<basename>` (bracketed because the directory name has hyphens). The numeric prefix (`01-`, `02-`, …) only controls **display order**; basenames after sort drive the iteration loop in [`pages/references/cmd-cheat-sheet.html`](../../pages/references/cmd-cheat-sheet.html).

The glossary lives separately at `_data/abbreviations/cmd-cheat-sheet.yml` and is consumed by the shared `_includes/abbreviations-section.html` partial.

---

## Batch file schema

Every `NN-*.yml` file has exactly two top-level keys: `batch:` (metadata) and `entries:` (an array of commands).

```yaml
batch:
  id: "version-control"            # stable slug used for tab data-batch attribute
  order: 6                          # display order; matches the filename prefix
  name: "Version Control (git)"
  short_name: "Version Control"     # tab label (falls back to name if empty)
  description: >
    One short paragraph shown in the active-tab blurb above the table.
  last_updated: "2026-05-21"        # ISO date; the page surfaces the most recent across all batches

entries:
  - name: "git commit"
    slug: "git-commit"              # optional; defaults to name | slugify
    description: "Record staged changes as a new commit."
    syntax: "git commit [-m \"<msg>\"] [-a] [--amend]"
    os: [cross-platform]            # one or more of: linux, macos, windows, cross-platform, root, android
    flags:
      - flag: "-m <msg>"
        description: "Inline commit message; skips $EDITOR."
      - flag: "-a"
        description: "Stage all tracked, modified files before committing."
    examples:
      - code: "git commit -m \"fix typo\""
        explain: "Record staged changes with a one-line message, skipping the editor."
      - code: "git commit -am \"quick fix\""
        explain: "Stage all tracked modifications and commit them in one step."
    recipes:
      - code: "git add -A && git commit -m \"wip\""
        explain: "Stage everything (including new + deleted files) then commit."
    danger: "caution"
    modern: "<code>gh</code> for GitHub-side operations"
    gotchas: >
      Never --amend a commit that's already pushed to a shared branch
      without coordinating a force-push.
    see_also: ["git add", "git push", "git reset"]
    references:
      - "man 1 git-commit"
```

### Required fields per entry

- `name` — string; the command (mono-rendered as the row label).
- `description` — string; one short sentence.
- `syntax` — string; the canonical form in `man(1)` notation
  (`<placeholders>` in angle brackets, `[optional]` in square brackets).
- `os` — array of one or more of: `linux`, `macos`, `windows`, `cross-platform`, `root`, `android`.

### Optional fields per entry

- `slug` — string; kebab-case override for the in-page anchor ID (default: `name | slugify`).
- `flags` — array of `{flag, description}` pairs. Rendered into a collapsible `<dl>` inside the Flags cell.
- `examples` — array of **`{code, explain}` objects**. `code` is the exact command line; `explain` is one plain-English sentence about what that invocation does. Each renders as a clickable button that opens an explanation modal (and command tokens inside `code` that match a glossary term become clickable too). The quality bar wants **≥2 examples per entry**, each with both keys.
- `recipes` — array of `{code, explain}` objects (same shape as `examples`), for multi-command combos / pipelines. Rendered in the **Recipes / Combos** column, collapsed when there's more than one.
- `danger` — one of `safe` | `caution` | `destructive`. Rendered as a colour-coded badge stacked in the sticky first column, beneath the command name and OS pills (there is no standalone Danger column). `safe` = read-only / trivially reversible; `caution` = writes or changes state but recoverable; `destructive` = irreversible data loss possible.
- `modern` — string (inline `<code>` allowed) naming a modern replacement, shown in the **Modern alt** column. Omit when there's no obvious alternative.
- `gotchas` — string (use the folded scalar `>` for paragraph blocks). Markdown is supported; inline `<code>` works.
- `see_also` — array of command names. Each one is rendered as a link to `#cmd-<slug>` of the matching entry in the page.
- `references` — array of free-form strings (man-page references, URLs). Rendered in the **Docs** column — entries containing `://` become outbound links, the rest render as `<code>` (e.g. `man 1 ls`).

### `os` values

Use **only** these six string literals (no other values are recognised):

| Value | Badge |
|---|---|
| `linux` | 🐧 Linux |
| `macos` | 🍎 macOS |
| `windows` | 🪟 Windows |
| `cross-platform` | ⚙️ Runs everywhere |
| `root` | 🛡 Requires elevated privileges (sudo / Administrator) |
| `android` | 🤖 Available in Termux |

Multiple values per command are encouraged when accurate — e.g. `[linux, macos, cross-platform]` or `[linux, root]`. The badge order in the row follows the YAML array order.

### Sub-action commands as separate entries

Each sub-action of a multi-command tool gets its own row. `git commit`, `git push`, `git rebase` are three separate `entries`, not three sub-flags of one `git` entry. Distinct flags of a *single* command stay in the `flags` array of that one row.

---

## Common edits

### Add a new command to an existing category

Open the relevant `NN-*.yml`, add a new entry under `entries:` keeping the required schema, bump `batch.last_updated`, push.

### Add a new category

1. Create `NN-<slug>.yml` with the next free order prefix — files are sorted by basename, so the prefix dictates where the tab appears.
2. Copy the `batch:` block from a neighbour and adjust `id`, `order`, `name`, `short_name`, `description`, `last_updated`.
3. Add at least one entry under `entries:`.
4. No template edits required — the page re-iterates `site.data["cmd-cheat-sheet"].*` on the next build.

### Add or edit a glossary term

Append to `_data/abbreviations/cmd-cheat-sheet.yml` (keeping alphabetical order). No JS or HTML edits required — the shared abbreviations include regenerates the JSON island on each build, and `/assets/js/abbreviations.js` reads the dictionary at runtime.

Add an optional `aliases: [..]` array to an entry to register case/plural variants (e.g. `Glob → ["glob", "globs", "globbing"]`). Aliases decorate in-content and open the canonical card; they don't render a card of their own. This is how lowercase `posix` / plural `globs` in a command cell become clickable even though the canonical key is `POSIX` / `Glob`.

---

## YAML conventions

- **Block-folded strings (`>`) for descriptions and gotchas**, single-line strings for everything else.
- **Real Unicode dashes**: `–` (en-dash) for ranges, `—` (em-dash) for parentheticals. Avoid `--` in prose.
- **Escape `"` inside double-quoted strings** with `\"`. Single-quoted strings need no escaping but don't expand any escapes.
- **HTML inside cells is permitted** but should be minimal — inline `<code>` for terms, `<br>` for forced breaks.
- **Escape literal angle brackets in raw-rendered fields.** `description`, flag `description`, `modern`, and `gotchas` are emitted as raw HTML (so inline `<code>` works). A bare placeholder like `<script>`, `<repl>`, or `<path>` is therefore parsed as a real element — and a literal `<script>` will silently corrupt the table DOM from that row onward (the footer ends up rendered inside the table). Write placeholders as escaped, code-wrapped text: `<code>&lt;script&gt;</code>`. (The `syntax` field is exempt — the template runs it through `| escape`, so raw `<placeholders>` there are safe.) `lint.sh` fails the build if any rawtext/script tag ends up inside the command table.
- **Do not duplicate abbreviation glosses inside command cells** — write the term once in the glossary YAML and let the click-to-explain modal handle it.

---

## How the page consumes this directory

```
pages/references/cmd-cheat-sheet.html
├── {%- assign cmd_data = site.data["cmd-cheat-sheet"] | sort -%}
│   └── iterates every YAML file alphabetically, skipping non-batch
│       entries via {% if entry[1].batch %} guards
├── {%- assign abbreviations = site.data.abbreviations["cmd-cheat-sheet"] -%}
│   └── passed into {% include abbreviations-section.html data=abbreviations … %}
├── /assets/css/reference-table.css   ← shared big-table scaffolding
├── /assets/css/cmd-cheat-sheet.css   ← OS-badge palette + column widths
├── /assets/css/abbreviations.css     ← shared glossary styling
├── /assets/js/reference-table.js     ← shared tab/search/empty/blurb logic
├── /assets/js/cmd-cheat-sheet.js     ← thin wrapper calling initReferenceTable
└── /assets/js/abbreviations.js       ← shared modal + tbody decorator
```

If a change to this data needs a corresponding template/style/script change, scope the PR to include all three so the page never lands in a half-broken state.
