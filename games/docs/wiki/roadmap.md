# Roadmap

The engine is production-minded and complete for the shipped scope. Natural next
steps, roughly in priority order:

## Multiplayer hardening
- **Server-validated moves** for anti-cheat. Play is now host-authoritative
  (clients submit actions; the host validates + applies + publishes), and hidden
  info is redacted per-player — but there is no neutral *server* arbiter. Move
  validation into a Cloud Function (reusing the repo's callable pattern) for
  untrusted competitive play, and lock the `_shared` full-state slot to the host
  in RTDB rules.
- **Spectators** and **rejoin-by-seat** (claim an empty seat on reconnect).

## Engine
- **Replay player** UI on top of the existing action log (the data is already
  recorded by `MatchClient.getLog()`).
- **Simultaneous-action phases** (e.g. everyone picks at once) — currently
  strictly sequential turns.
- **Timed turns / clocks** as an engine-level option.
- **Hex grids** alongside the square grid (the board API is ready to extend).

## UX & content
- **Drag-and-drop** card/piece movement (click/keyboard is the baseline today).
- More demo games (trick-taking, set-collection, area-control) to widen the
  reference set.
- A fourth theme and printable/exportable game results.

## Tooling
- Optional engine extraction into a standalone published package (the module
  boundary already permits it).
- Property-based tests for reducer invariants.

Contributions slot in cleanly: most of the above touch one layer at a time
thanks to the strict module boundaries.
