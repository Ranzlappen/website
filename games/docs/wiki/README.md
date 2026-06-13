# Tabletop Engine — Handbook

The complete guide to the Tabletop game engine: how it's built, how to play, and
how to ship a new game on top of it.

## Contents

1. [Overview & Quick Start](./overview.md)
2. [Architecture](./architecture.md)
3. [Engine Concepts](./engine-concepts.md) — game lifecycle, state model, action/event model
4. [Card System](./card-system.md)
5. [Board System](./board-system.md)
6. [Assets & Themes](./assets-and-themes.md)
7. [Firebase Multiplayer & Offline Mode](./firebase-multiplayer.md)
8. [Creating Games](./creating-games.md) — card, board, hybrid; adding assets & themes
9. [Testing Guide](./testing.md)
10. [Accessibility Guide](./accessibility.md)
11. [Performance Guide](./performance.md)
12. [Troubleshooting](./troubleshooting.md)
13. [Roadmap](./roadmap.md)
14. [API Reference](./api-reference.md)

## The one-paragraph version

The **engine core** (`src/engine/`) is pure TypeScript: it owns players, turns,
phases, a deterministic RNG, serialization and undo/redo. A **`GameDefinition`**
describes a game with a `setup` and a pure `reducer`; the engine's single
`applyAction` function is the deterministic transition every move flows through
— local, hot-seat, AI or networked. The **React layer** (`src/ui/`) renders it
with themeable SVG assets, and a **`SyncAdapter`** (`src/net/`) handles online
rooms with a local cross-tab backend by default and an optional Firebase one.
Three demo games prove it's reusable. Add your own by registering a definition
plus a view — no engine changes required.
