# `_data/web-dev-tech-stack/` — Web Dev Tech Stack Data

Source data for the [`/references/web-dev-tech-stack/`](../../pages/references/web-dev-tech-stack.html) page. Every row in the table and every category tab comes from a YAML file here; the glossary lives separately at `_data/abbreviations/web-dev-tech-stack.yml`. **You don't need to touch the page template to add or edit content** — Jekyll re-reads these files on every build.

---

## File layout

| File | Role |
|---|---|
| `01-languages.yml` … `15-package-managers.yml` | One file per **category** of technologies. Each file contributes one tab and a chunk of table rows. |

Jekyll exposes everything under `site.data["web-dev-tech-stack"].<basename>` (bracketed because the directory name has hyphens). The numeric prefix (`01-`, `02-`, …) only controls **display order**; basenames after sort drive the iteration loop in [`pages/references/web-dev-tech-stack.html`](../../pages/references/web-dev-tech-stack.html).

---

## Batch file schema

Every `NN-*.yml` file has exactly two top-level keys: `batch:` (metadata) and `entries:` (an array of technologies).

```yaml
batch:
  id: "frontend-frameworks"         # stable slug used for tab data-batch attribute
  order: 3                           # display order; matches the filename prefix
  name: "Frontend UI Frameworks"
  short_name: "Frontend"             # tab label (falls back to name if empty)
  description: >
    One short paragraph shown in the active-tab blurb above the table.
  last_updated: "2026-06-26"         # ISO date; the page surfaces the most recent across all batches

entries:
  - name: "React"
    slug: "react"                    # optional; defaults to name | slugify. Used for the row anchor (#row-<slug>) that cross-links target.
    tagline: "The component-based UI library that defined modern frontend."
    layer: [frontend]                # array; one or more of the eight layer values below
    maturity: industry-standard      # one of: industry-standard | mainstream | rising | legacy
    learning_curve: moderate         # one of: gentle | moderate | steep
    first_released: 2013             # integer year
    description: >
      What it is, in 1–3 sentences. Markdown + inline HTML allowed (escape
      literal <…> placeholders). Cross-reference glossary terms with
      <span class="abbr-link" data-abbr="DOM">DOM</span>.
    use_cases:
      - "Interactive SPAs and dashboards with lots of dynamic state."
      - "Design systems / reusable component libraries."
    prerequisites:
      - { name: "JavaScript", slug: "javascript" }   # slug → links to that row; omit slug for plain text
      - { name: "HTML", slug: "html" }
    key_features:
      - "Component model with hooks for state and side-effects."
      - "Virtual DOM diffing and reconciliation."
    pairs_well_with:
      - { name: "Vite", slug: "vite" }
      - { name: "TypeScript", slug: "typescript" }
    alternatives:
      - { name: "Vue", slug: "vue" }
      - { name: "Svelte", slug: "svelte" }
    example:
      lang: "tsx"                     # informational only (not currently rendered)
      code: |-
        function Counter() {
          const [n, setN] = useState(0);
          return <button onClick={() => setN(n + 1)}>{n}</button>;
        }
      explain: >
        A function component using the useState hook — clicking increments
        state and React re-renders just this component.
    gotchas: >
      The pitfall that bites people. Markdown + inline <code> allowed.
    maintained_by: "Meta + OSS community"
    language: "JavaScript"            # implementation language
    license: "MIT"                    # free string; the page colour-codes it (see below)
    docs:
      - { label: "react.dev", url: "https://react.dev" }
```

### Required fields per entry (the quality bar `lint.sh` enforces)

- `name` — string; the technology name (rendered bold in the sticky first column).
- `description` — string; 1–3 sentences. Markdown + inline HTML (`markdownify`).
- `use_cases` — array of ≥1 string; "reach for it when…".
- `maturity` — one of `industry-standard` | `mainstream` | `rising` | `legacy`.
- `layer` — array of ≥1 of the eight layer values.
- `docs` — array of ≥1 link (see `docs` below).

### Optional fields per entry

- `slug` — kebab-case override for the row anchor ID (default `name | slugify`). **Cross-links target `#row-<slug>`, so keep slugs stable and match them in `prerequisites`/`pairs_well_with`/`alternatives`.**
- `tagline` — one-line hook shown under the name.
- `learning_curve` — `gentle` | `moderate` | `steep`. Sortable.
- `first_released` — integer year. Sortable (the **Since** column).
- `prerequisites` / `pairs_well_with` / `alternatives` — arrays of `{name, slug?}`. An entry with a `slug` renders as an in-page anchor (`#row-<slug>`); without one it's plain text. Point slugs at real rows so the table is navigable.
- `key_features` — array of strings. Collapsible cell.
- `example` — a single `{code, explain, lang?}` object. `code` is the snippet (CLI command, JSX, config…); `explain` is one plain-English sentence. Rendered as a clickable button that opens an explanation modal (and glossary terms inside the code become clickable). Both `code` and `explain` are required when `example` is present.
- `gotchas` — string (folded scalar `>`). Markdown + inline `<code>`.
- `maintained_by` — org/company/community. Sortable.
- `language` — implementation language (the **Built in** column). Sortable.
- `license` — free string (e.g. `MIT`, `Apache-2.0`, `BSL 1.1`, `proprietary`). The page maps it to a colour band: **permissive** (MIT/Apache/BSD/ISC), **copyleft** (GPL/MPL/EPL), **source-available** (BSL/SSPL/Elastic), else **proprietary**.

### `layer` values

Use **only** these eight string literals (they drive the Layer column badges *and* the secondary Layer `<select>` filter):

| Value | Meaning |
|---|---|
| `language` | Programming / markup language |
| `frontend` | Runs in / targets the browser UI |
| `backend` | Runs on the server |
| `fullstack` | Spans both client and server |
| `styling` | CSS / styling tooling |
| `database` | Data store |
| `tooling` | Build / test / lint / package tooling |
| `infrastructure` | Hosting / deploy / CI-CD / containers |

Multiple values per entry are encouraged when accurate — e.g. Next.js → `[fullstack, frontend]`, TypeScript → `[language, tooling]`, Vite → `[tooling, frontend]`.

---

## YAML conventions

- **Block-folded strings (`>`) for `description` and `gotchas`**, single-line strings for everything else.
- **Real Unicode dashes**: `–` (en-dash) for ranges, `—` (em-dash) for parentheticals. Avoid `--` in prose.
- **Escape `"` inside double-quoted strings** with `\"`. Single-quoted strings need no escaping.
- **Escape literal angle brackets in `description` / `gotchas`.** Both are emitted through `markdownify` (raw HTML works). A bare placeholder like `<Component>` or `<script>` is parsed as a real element and will corrupt the table DOM from that row onward. Write placeholders as escaped, code-wrapped text: `` `<Component>` `` or `<code>&lt;Component&gt;</code>`. (`example.code` is exempt — the template runs it through `| escape`.) `lint.sh` fails the build if any rawtext/script tag lands inside the table.
- **Do not duplicate glossary glosses inside cells** — write the term once in the glossary YAML and let the click-to-explain modal handle it; reference it inline with `<span class="abbr-link" data-abbr="TERM">TERM</span>`.

---

## Common edits

### Add a technology to an existing category
Open the relevant `NN-*.yml`, add an entry under `entries:` keeping the required schema, bump `batch.last_updated`, push.

### Add a new category
1. Create `NN-<slug>.yml` with the next free order prefix.
2. Copy the `batch:` block from a neighbour and adjust `id`, `order`, `name`, `short_name`, `description`, `last_updated`.
3. Add at least one entry under `entries:`.
4. No template edits required — the page re-iterates `site.data["web-dev-tech-stack"].*` on the next build.

### Lint
```bash
bundle exec jekyll build && bash _data/web-dev-tech-stack/lint.sh
```

---

## How the page consumes this directory

```
pages/references/web-dev-tech-stack.html
├── {%- assign webdev_data = site.data["web-dev-tech-stack"] | sort -%}
│   └── iterates every YAML file alphabetically, skipping non-batch
│       entries via {% if entry[1].batch %} guards
├── {%- assign abbreviations = site.data.abbreviations["web-dev-tech-stack"] -%}
│   └── passed into {% include abbreviations-section.html data=abbreviations … %}
├── /assets/css/reference-table.css     ← shared big-table scaffolding
├── /assets/css/web-dev-tech-stack.css  ← maturity/lc/layer/license palettes + column widths
├── /assets/css/abbreviations.css       ← shared glossary styling
├── /assets/js/reference-table.js       ← shared tab/search/sort/filter logic
├── /assets/js/web-dev-tech-stack.js    ← thin wrapper calling initReferenceTable + example modal
└── /assets/js/abbreviations.js         ← shared modal + tbody decorator
```
