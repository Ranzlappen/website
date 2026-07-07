# Assets & Themes

## Asset library

All artwork is **original, procedurally-drawn SVG/CSS** — nothing copyrighted,
nothing hot-linked. Assets live in `src/ui/assets.tsx` and recolour with the
active theme via CSS custom properties.

| Component | What it draws |
|---|---|
| `<PlayingCard card width? selected? forceBack? onClick? />` | A full card face (rank corners + centre suit) or a themed lattice back. |
| `<CardBackArt />` | The reusable card-back pattern (an SVG `<pattern>`). |
| `<SuitGlyph suit size? />` | A coloured suit symbol. |
| `<Die value size? rolling? />` | A six-sided die face with proper pip layouts. |
| `<Pawn seat size? />` | A board pawn coloured by seat (`SEAT_COLORS`). |
| `<Token glyph color? size? />` | A round chip/relic/lantern token. |

Card geometry is driven by the `--w` custom property on `.tt-card`, so a single
`width` prop scales the whole card (corners, glyphs, radius) proportionally.

Other "assets" are CSS, not images:

- **Board surfaces / felt:** `.tt-felt` (radial gradient + inset shadow).
- **Cells, walls, legal-move highlights:** `.tt-cell`, `.tt-cell--wall`,
  `.tt-cell--legal`.
- **Empty / error / loading states:** `EmptyState`, `ErrorBanner`, `Loading`
  in `ui/components.tsx`.
- **Lobby/room visuals, turn/phase indicators, player badges:** `PlayerBadge`,
  `TurnBanner`, `Scoreboard`, `ResultBanner`.

## Themes

Three skins ship today, selected by `data-theme` on `<html>`:

| id | Name | Vibe |
|---|---|---|
| `classic` | Classic Felt | Casino green, ivory cards, gold. |
| `neon` | Neon Arcade | Dark glass, cyan/magenta glow. |
| `parchment` | Parchment | Warm paper and ink (fantasy). |

Each is a block of CSS variables in `src/index.css` (`--tt-bg`, `--tt-felt`,
`--tt-card-face`, `--tt-accent`, …). The picker lives in the header; the choice
is persisted in `localStorage` and applied before first paint in `main.tsx`.

### Adding a theme

1. Add a `[data-theme='yourtheme'] { … }` block in `src/index.css` defining the
   full `--tt-*` variable set (copy an existing block).
2. Add an entry to `THEMES` in `src/ui/theme.ts` (`id`, `name`, `swatch`,
   `blurb`) and widen the `ThemeId` union.

That's it — every component already reads the variables, so the new skin applies
everywhere instantly.

### Adding an asset

Add a component to `src/ui/assets.tsx` that draws SVG/CSS using `--tt-*`
variables (and `SEAT_COLORS` for per-player colour). Keep it presentational and
prop-driven so any game can reuse it.
