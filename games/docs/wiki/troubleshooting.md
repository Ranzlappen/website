# Troubleshooting

### A move silently does nothing
The action was rejected by `validate`. `applyAction` returns
`{ ok: false, error }`; the UI surfaces it via the `ErrorBanner`. Check
`requireCurrentPlayer` / `requirePhase` and your payload shape. In code, inspect
`result.error`.

### "It is not your turn" online when it *is* my turn
Online control is gated on `controlSeat === turn.current`. Confirm your client
id matches a player id in the match (`createMatch` uses the room's player ids).
Re-join the room; the seat is keyed off the stable per-browser client id.

### Refreshing a local game loses undo history
Expected. Undo/redo lives in the in-memory `MatchClient`. The **state** is
autosaved to `localStorage` and reloaded on refresh, but the history stack
isn't persisted.

### Online room not found / can't join across two computers
The default backend is **local** (same browser only). Cross-machine play needs
Firebase — see [Firebase Multiplayer](./firebase-multiplayer.md). Across two tabs
of the *same* browser, the local adapter works out of the box.

### Cross-tab sync isn't updating
The local adapter uses `BroadcastChannel` + the `storage` event. Both require
the same origin. Private/incognito windows have isolated storage and won't sync
with a normal window.

### Bots don't move
Bots auto-play only on the **Play** (local) screen, driven by `botAction`, which
requires the game to define an `ai` hook. Online rooms are human-only by design.

### Build fails on `tsc -b`
The build type-checks `src/` including tests. Run `npm run build` to see the
exact file/line. Common causes: a non-JSON value in game state, or an unguarded
`undefined` from `getGame`/`getView`.

### Determinism differs between runs
A reducer called `Math.random()`/`Date.now()` instead of `ctx.random`. All
randomness must flow through `ctx.random` so replays and sync stay in lockstep.

### A new game doesn't appear in the gallery
You registered the def but forgot the import line. Add it to `src/games/index.ts`
(def) and `src/games/views/index.ts` (view) — registration happens on import.
