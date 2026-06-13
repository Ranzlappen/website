# Accessibility Guide

Accessibility is built into the shared components and assets, so games inherit it
by using them.

## Keyboard

- **Cards** rendered with an `onClick` become `role="button"`, `tabIndex={0}`,
  and respond to **Enter/Space** (`PlayingCard`). Selected cards expose
  `aria-pressed`.
- **Board cells** that are legal moves are focusable and activate on Enter/Space
  (`tt-cell--legal` cells in the views).
- All controls are native `<button>` / `<select>` / `<input>` elements, so tab
  order and activation are free. Focus is always visible via
  `:focus-visible` outlines (`.tt-btn`, `.tt-card`).

## Screen readers

- Cards carry descriptive `aria-label`s ("K of hearts", "Face-down card");
  decorative glyphs are `aria-hidden`.
- The **turn banner** is `role="status"` + `aria-live="polite"`, so whose turn it
  is and the active phase are announced. The **"waiting for…"** notice and the
  **result banner** are also live regions.
- Dice, pawns and tokens have `aria-label`/`role="img"` (or are hidden when
  purely decorative).
- Board cells are labelled with their coordinates and state ("Cell 3,4 wall",
  "… reachable").

## Reduced motion

`@media (prefers-reduced-motion: reduce)` in `index.css` collapses all
animation/transition durations to ~0, including card hover lifts, the dice roll
spin, and overlay pops. No motion-only information is conveyed.

## Colour & contrast

- Each theme's `--tt-ink` / surface pairings target WCAG-AA body-text contrast;
  the neon and parchment skins keep card faces high-contrast against the table.
- Player identity is never colour-only: badges pair the seat colour with the
  player's **name** (and a 🤖 marker for bots), and the active player is shown by
  both a coloured ring **and** the textual turn banner.

## Touch & responsive

- Layouts are mobile-first: the board uses `width: min(92vw, 460px)` with a
  square `aspect-ratio`; hands wrap; controls stack. Tap targets are full
  buttons/cards.
- `viewport-fit=cover` + safe-area-friendly spacing in `index.html`.

## Checklist for new views

- Use `<PlayingCard onClick>` / focusable `tt-cell--legal` for interactions.
- Give every meaningful element an `aria-label`; mark decoration `aria-hidden`.
- Gate inputs on `canAct`; never rely on colour alone for state.
