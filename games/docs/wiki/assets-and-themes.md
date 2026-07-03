# Assets & Themes

## Asset library

All artwork is **original, procedurally-drawn SVG/CSS** — nothing copyrighted,
nothing hot-linked. Assets live in the `src/ui/assets/` package (`cards.tsx`,
`dice.tsx`, `tokens.tsx`, `board.tsx`; import from `ui/assets`, never the
individual modules) and recolour with the active theme via CSS custom
properties.

Art primitives:

| Component | What it draws |
|---|---|
| `<PlayingCard card width? selected? forceBack? onClick? />` | A full card face (rank corners + centre suit) or a themed lattice back. |
| `<CardBackArt />` | The reusable card-back pattern (an SVG `<pattern>`). |
| `<SuitGlyph suit size? />` | A coloured suit symbol. |
| `<Die value size? rolling? />` | A six-sided die face with proper pip layouts. |
| `<Pawn seat size? />` | A board pawn coloured by seat (`SEAT_COLORS`). |
| `<Token glyph color? size? />` | A round chip/relic/lantern token. |

Table primitives — the layout pieces game views compose instead of hand-rolling
markup:

| Component | What it renders |
|---|---|
| `<CardFan cards width? overlap? forceBack? selectedId? onCardClick? />` | An overlapping row of cards (your hand, an opponent's backs). |
| `<Pile cards label onClick? showCount? forceBack? />` | A stock/discard pile: top card (or empty slot) + labelled count chip. |
| `<TileCard title text? glyph? onClick? disabled? />` | A custom (non-standard) card: action cards, events, upgrades. |
| `<DiceTray values size? rolling? />` | A row of dice with a summed accessible label. |
| `<GridBoard grid legalCells? onCellActivate? renderCell ariaLabel />` | A square grid with walls, legal-move highlighting and click/keyboard wiring; you supply per-cell content. |
| `<LoopTrack count renderCell ariaLabel cellSize? />` | A wrapping race-track strip of cells. |

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

Add a component to the fitting module in `src/ui/assets/` (or a new module
re-exported from `src/ui/assets/index.ts`) that draws SVG/CSS using `--tt-*`
variables (and `SEAT_COLORS` for per-player colour). Keep it presentational and
prop-driven so any game can reuse it.
