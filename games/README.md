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
| Declarative rulesets | `src/engine/flow.ts` | `defineGame` — describe a game as moves (phase gates, validate/apply/enumerate, `nextPhase`/`endsTurn`) and get a full GameDefinition compiled. |
| Card subsystem | `src/engine/cards.ts` | Standard + spec-built custom decks, shuffling, dealing, immutable pile ops. |
| Zone subsystem | `src/engine/zones.ts` | Named card zones with visibility policies (`public`/`owner`/`hidden`), move/draw/auto-reshuffle, and **automatic per-viewer redaction**. |
| Board subsystem | `src/engine/board.ts` | Grids, walls, distances, BFS reachability, tracks. |
| Dice / rules | `src/engine/dice.ts`, `rules.ts` | Deterministic dice + composable legality helpers. |
| Demo games | `src/games/` | Crown Rush (card), Lantern Hunt (board), Relic Run (hybrid) — all authored on the declarative layer. |
| Persistence | `src/storage/` | Save/load to `localStorage`. |
| Multiplayer | `src/net/` | `SyncAdapter` interface — Local (cross-tab, client host-relay) + Firebase (server-authoritative via Cloud Function arbiter). |
| React UI | `src/ui/` | Themes, the `ui/assets/` library (SVG cards/dice/pawns + table primitives: CardFan, Pile, TileCard, GridBoard, LoopTrack), shared components, hooks, GameSurface. |
| Game views | `src/games/views/` | One React view per game, kept out of the engine. |
| Pages | `src/pages/` | Gallery, setup, play, online hub, room. |
| Tests | `src/__tests__/` | 100 tests: RNG determinism, match flow, cards, zones, the defineGame compiler, board, serialization, client, each demo, render smoke. |
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
- **Rules are declarative.** Games are authored with `defineGame` — a map of
  moves with phase gates and declared flow transitions — and hidden information
  lives in visibility-typed zones so network redaction is derived, not
  hand-written. The compiled output is a plain `GameDefinition`, so hand-rolled
  games remain first-class.
- **Add a game without touching the engine.** Register a `GameDefinition` and a
  React view; it appears in the gallery, lobby and router automatically.

See the [wiki](./docs/wiki/README.md) for the full handbook, including
step-by-step guides for building new card/board/hybrid games.
