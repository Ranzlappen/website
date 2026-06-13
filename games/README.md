# Tabletop — browser game engine

A reusable, framework-agnostic engine for **card and board games**, plus a
polished React SPA that ships it. Built as the fifth independent module of
[ranzlappen.com](https://www.ranzlappen.com) and deployed as a subfolder of the
Jekyll site at **`/games/`** (mirrors `polyvote/`, `blog-admin/`,
`inventory-manager/`).

Play **solo vs bots**, **hot-seat** on one device, or **online** in a room
(cross-tab out of the box; Firebase-ready for the open internet).

```bash
cd games
npm install
npm run dev      # local dev server
npm run build    # tsc -b && vite build  → dist/  (copied to _site/games/)
npm run lint     # eslint (flat config)
npm test         # vitest (engine + demos + render smoke)
npm run format   # prettier
```

## What's inside

| Area | Path | Notes |
|---|---|---|
| **Engine core** | `src/engine/` | Pure TypeScript, **no React, no backend.** State, turns, phases, deterministic RNG, reducers, serialization, undo/redo, registry. |
| Card subsystem | `src/engine/cards.ts` | Decks, shuffling, dealing, immutable zone ops. |
| Board subsystem | `src/engine/board.ts` | Grids, walls, distances, BFS reachability, tracks. |
| Dice / rules | `src/engine/dice.ts`, `rules.ts` | Deterministic dice + composable legality helpers. |
| Demo games | `src/games/` | Crown Rush (card), Lantern Hunt (board), Relic Run (hybrid). |
| Persistence | `src/storage/` | Save/load to `localStorage`. |
| Multiplayer | `src/net/` | `SyncAdapter` interface + Local (cross-tab) and Firebase RTDB adapters. |
| React UI | `src/ui/` | Themes, assets (SVG cards/dice/pawns), shared components, hooks, GameSurface. |
| Game views | `src/games/views/` | One React view per game, kept out of the engine. |
| Pages | `src/pages/` | Gallery, setup, play, online hub, room. |
| Tests | `src/__tests__/` | 50 tests: RNG determinism, match flow, cards, board, serialization, client, each demo, render smoke. |
| Docs | `docs/wiki/` | The handbook — start at [`docs/wiki/README.md`](./docs/wiki/README.md). |

## Design principles

- **Engine is framework-agnostic.** `src/engine/` never imports React or
  Firebase. The React layer and the network layer depend on the engine, never
  the other way around.
- **Deterministic transitions.** All randomness flows through a seeded,
  serializable RNG stored inside the match state, so replays and online play
  stay in sync.
- **Game logic vs. engine flow are separate.** A game's `reducer` only edits its
  own state; turn/phase/end-game changes are *requested* via `ctx.events` and
  applied by the engine.
- **Add a game without touching the engine.** Register a `GameDefinition` and a
  React view; it appears in the gallery, lobby and router automatically.

See the [wiki](./docs/wiki/README.md) for the full handbook, including
step-by-step guides for building new card/board/hybrid games.
