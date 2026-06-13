# Architecture

Tabletop is layered so each ring depends only on the ones beneath it. The engine
core never imports React or a backend.

```
┌─────────────────────────────────────────────────────────────┐
│  pages/         Gallery · Setup · Play · Online · Room        │  React routes
├─────────────────────────────────────────────────────────────┤
│  ui/            themes · assets (SVG) · components · hooks ·   │  React layer
│                 GameSurface (shared chrome)                    │
│  games/views/   one React view per game (registry)            │
├───────────────────────────────┬───────────────────────────────┤
│  net/  SyncAdapter             │  storage/  save/load           │  adapters
│   ├─ LocalSyncAdapter (tabs)   │   (localStorage)               │
│   └─ FirebaseSyncAdapter (RTDB)│                                │
├───────────────────────────────┴───────────────────────────────┤
│  games/         GameDefinition + reducer per game (registry)   │  game defs
├─────────────────────────────────────────────────────────────┤
│  engine/        types · rng · match (applyAction) · client ·  │  ENGINE CORE
│                 serialize · registry · cards · board · dice ·  │  (pure TS, no
│                 rules                                          │   React/Firebase)
└─────────────────────────────────────────────────────────────┘
```

## Module boundaries

| Layer | Imports | Never imports |
|---|---|---|
| `engine/` | nothing app-specific | React, Firebase, `net/`, `ui/` |
| `games/*.ts` (defs) | `engine/` | React |
| `games/views/*` | `engine/`, `ui/` | `net/` |
| `net/` | `engine/` | React, `ui/` |
| `storage/` | `engine/` | React |
| `ui/`, `pages/` | everything below | — |

This is the same "independent module, duplicate intentionally" discipline the
rest of the repo follows. The engine could be extracted to its own package
without code changes.

## The two registries

- **Engine registry** (`engine/registry.ts`) — maps `gameId → GameDefinition`.
  Framework-agnostic. Populated by each game file's `registerGame(def)`.
- **View registry** (`games/views/registry.tsx`) — maps `gameId → React view`.
  Kept separate precisely so the engine stays React-free.

`GameSurface` ties them together at render time: it looks up both by
`state.gameId`, computes the viewer perspective, and renders the view inside
shared chrome (turn banner, scoreboard, result, error, event log, toolbar).

## Why a separate flow-event channel?

A game's `reducer(game, action, ctx)` returns only the next **game** state. To
end a turn, change phase or end the game it calls `ctx.events.endTurn()` /
`setPhase()` / `endGame()`. The engine collects those requests and applies them
to the **engine-managed** `TurnState`/`status` *after* the reducer returns. This
keeps generic flow logic out of every game and game-specific logic out of the
engine. See [Engine Concepts](./engine-concepts.md).
