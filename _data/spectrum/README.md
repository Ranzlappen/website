# `_data/spectrum/` — Electromagnetic Spectrum Reference Data

Source data for the [`/references/spectrum/`](../../pages/references/spectrum.html) page. Every row in the table, every entry in the abbreviations glossary, and every batch tab on that page comes from a YAML file in this directory. **You don't need to touch the page template to add or edit content** — Jekyll re-reads these files on every build.

---

## File layout

| File | Role |
|---|---|
| `01-below-dc-static.yml` … `21-beyond-gamma.yml` | One file per **batch** of bands, ordered low frequency → high. Each file contributes one tab and a chunk of table rows. |
| `abbreviations.yml` | Single alphabetical glossary of acronyms (ISM, EIRP, FR1, FT8, …) used by the cards under "Abbreviations & Quick Reference" **and** the in-table modal lookups. |

Jekyll exposes everything here under `site.data.spectrum.<basename>`. The numeric prefix (`01-`, `02-`, …) only controls **display order**; basenames after sort drive the iteration loop in [`pages/references/spectrum.html`](../../pages/references/spectrum.html).

---

## Batch file schema

Every `NN-*.yml` file is exactly two top-level keys: `batch:` (metadata) and `bands:` (an array of rows).

```yaml
---
batch:
  id: "uhf-ism-900-wifi-bt-lora"          # stable slug used for tab data-batch attribute
  order: 11                               # display order; matches the filename prefix
  name: "UHF ISM 868 / 902–928 MHz + 2.4 GHz Wi-Fi / Bluetooth / Zigbee"
  short_name: "UHF ISM + 2.4 GHz"         # tab label (falls back to name if empty)
  description: >
    One short paragraph shown in the active-batch blurb above the table.
  last_updated: "2026-05-07"              # ISO date; the page surfaces the most recent across all batches

bands:
  - frequency_range: "863 MHz – 870 MHz (SRD, Europe/Germany — ITU Region 1 / EU)"
    key_frequencies_channels: "..."
    band_name_designation: "..."
    primary_uses_hobbyist_relevance: "..."
    hardware_modules: "..."
    antenna_diy_considerations: "..."
    legal_licensing_notes: "..."
    max_power_restrictions_eirp: "..."
    propagation_interference_notes: "..."
    safety_exposure_limits: "..."
    technologies_example_devices: "..."
    hobbyist_project_ideas: "..."
    wavelength: "λ = c/ν ≈ 12.4 cm at 2.4 GHz"
    photon_energy: "N/A (RF — E = hν ≈ 10 μeV)"
    sources_citations: "..."
    usability_badge: "🟢 Public / ISM / Unlicensed"
```

### Required band fields

All 16 fields below are rendered as columns in the same order. **Fill every field** — empty strings render as empty cells but are still part of the table:

`frequency_range`, `key_frequencies_channels`, `band_name_designation`, `primary_uses_hobbyist_relevance`, `hardware_modules`, `antenna_diy_considerations`, `legal_licensing_notes`, `max_power_restrictions_eirp`, `propagation_interference_notes`, `safety_exposure_limits`, `technologies_example_devices`, `hobbyist_project_ideas`, `wavelength`, `photon_energy`, `sources_citations`, `usability_badge`.

### `wavelength` and `photon_energy` formatting

Use proper technical notation in these two columns:

- **Greek letters**: `λ` for wavelength, `ν` for frequency, `μ` for micro (μm, μeV).
- **HTML sub/superscripts** for powers and units: `10<sup>9</sup> Hz`, `W/m<sup>2</sup>`, `λ ≈ 10<sup>−27</sup> m`.
- **Equation form** where it adds clarity: `λ = c/ν ≈ X` and `E = hν ≈ X` or `E = hc/λ ≈ X`.
- **Photon energy unit ladder**: `meV` (sub-IR, far-IR), `eV` (IR / visible / UV-A/B), `keV` (UV-C / X-ray), `MeV` (gamma).
- **For radio bands** (≤ 300 GHz, files 01–17), use `"N/A (RF)"` or `"N/A (RF / mmWave — E = hν ≈ X μeV)"` — RF photons sit far below any chemical / biological energy threshold.
- The associated column headers should preserve case (e.g. "Wavelength (λ)", "Photon Energy") rather than being forced to all-caps, because Greek letters do not have a meaningful uppercase form in this context.

### `frequency_range` formatting

The page splits this string on `" – "` (space, en-dash, space) to render the low/high endpoints stacked on mobile. **Use a real en-dash (`–`, U+2013) with spaces** — not a hyphen, not `--`. Trailing parenthetical context after the range is preserved as-is:

```yaml
frequency_range: "863 MHz – 870 MHz (SRD, Europe/Germany — ITU Region 1 / EU)"
```

### `usability_badge` values

Use one of these four exact strings — they're matched against the legend swatches:

```
🟢 Public / ISM / Unlicensed
🔵 Amateur Radio (Ham-only)
🟡 Licensed / Regulated
🔴 Restricted / Scientific / Military
```

---

## `abbreviations.yml` schema

Flat alphabetical array. Each entry is one card in the "Abbreviations & Quick Reference" section **and** one row in the JSON dictionary the in-table modal reads from. Keep `explanation` to **1–3 sentences**, beginner-friendly.

```yaml
- term: "EIRP"
  full_form: "Effective Isotropic Radiated Power"
  explanation: >-
    TX power × antenna gain — what your strongest direction actually
    radiates compared to a perfect omnidirectional antenna. Most legal
    power limits (<span class="abbr-link" data-abbr="FCC">FCC</span>
    Part 15, <span class="abbr-link" data-abbr="ETSI">ETSI</span>
    EN 300 220) are written in EIRP, not transmitter watts.
```

Adding a term here automatically:

1. Renders an alphabetised card under "Show all abbreviations".
2. Adds the term to the in-table click-to-explain regex (`assets/js/spectrum.js` reads `#spectrum-abbr-data` at runtime).

**Use the `>-` folded scalar** for `explanation` so embedded HTML doesn't need quote-escaping and the value lands in JSON as a clean single-line string.

### Cross-references

Wrap any other glossary term that appears inside an explanation in:

```html
<span class="abbr-link" data-abbr="TERM">TERM</span>
```

The runtime renders these as link-styled clickable spans; clicking opens a new modal stacked on top of the current one (recursive — Escape unwinds the stack one step at a time). Cross-reference rules:

- The `data-abbr` value **must exactly match** an existing `term` in this file (case-sensitive). Misses fall back to a generic modal that just echoes the term.
- Wrap the **first occurrence** of a term in each explanation only — repeat-wrapping the same term every time it appears creates visual noise.
- When you add a new term, sweep earlier explanations and wrap its first occurrence anywhere it's mentioned. The cross-reference graph is what makes the glossary feel alive.

**Keep entries sorted alphabetically by `term`.** Mixed case is fine (`LoRa`, `mmWave`, `Z-Wave`) — the page renders the value verbatim.

---

## Common edits

### Add a new row to an existing batch

Open the relevant `NN-*.yml`, add a new entry under `bands:` keeping the 16-field schema, bump `batch.last_updated`, push.

### Add a new batch

1. Create a new YAML file. Name it `NN-<slug>.yml` where `NN` is the next free order index — files are sorted by basename, so the prefix dictates where the tab appears.
2. Copy the `batch:` block from a neighbour and adjust `id`, `order`, `name`, `short_name`, `description`, `last_updated`.
3. Add at least one entry under `bands:`.
4. No template edits required — the page re-iterates `site.data.spectrum.*` on the next build.

### Add or edit an abbreviation

Append to `abbreviations.yml` (keeping alphabetical order). No JS or HTML edits required — the JSON island in `pages/references/spectrum.html` is regenerated on each build, and `assets/js/spectrum.js` reads the dictionary at runtime.

### Reorder batches

Rename the file's numeric prefix. The `batch.order` field is informational; sort order is driven entirely by the basename.

---

## YAML conventions

- **Block-folded strings (`>`) for descriptions**, single-line strings for everything else. Keep cell content compact — long blocks are fine but avoid hard line-wraps that don't reflow.
- **Real Unicode dashes**: `–` (en-dash) for ranges, `—` (em-dash) for parentheticals. The frequency split parser depends on `" – "` specifically.
- **HTML inside cells is permitted** but should be minimal — `<br>` for forced breaks, the rest is plain text. Anything more elaborate should live in the page template.
- **Do not duplicate abbreviation glosses inside band cells** — write the term once in `abbreviations.yml` and let the click-to-explain modal handle it.

---

## How the page consumes this directory

```
pages/references/spectrum.html
├── {%- assign batches = site.data.spectrum | sort -%}
│   └── iterates every YAML file alphabetically, skipping non-batch
│       entries via {% if entry[1].batch %} guards
├── {%- assign abbreviations = site.data.spectrum.abbreviations -%}
│   └── powers the alphabetical card grid + #spectrum-abbr-data island
├── assets/css/spectrum.css   ← all styling
└── assets/js/spectrum.js     ← search, batch tabs, modal, decorator regex
```

If a change to this data needs a corresponding template/style/script change, scope the PR to include all three so the page never lands in a half-broken state.
