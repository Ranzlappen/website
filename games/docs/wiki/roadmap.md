# Roadmap

The engine is production-minded and complete for the shipped scope. Natural next
steps, roughly in priority order:

## Multiplayer hardening
- **Done — server-validated moves.** The Firebase backend is server-authoritative:
  the `gamesSubmitAction` / `gamesCreateMatch` Cloud Functions validate + apply
  every move (actor = authenticated uid), and RTDB rules deny all client state
  writes while letting each client read only its own redacted slot. The local
  backend keeps the lighter client host-relay for zero-config play.
- **Remaining:** tighter lobby `.validate` rules; **spectators** and
  **rejoin-by-seat** (claim an empty seat on reconnect); optional App Check on
  the arbiter callables.

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
