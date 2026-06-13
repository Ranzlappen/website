# Performance Guide

## Bundle

- Production build is a small React SPA. The Firebase SDK is **dynamically
  imported** by `FirebaseSyncAdapter` (`await import('firebase/database')`), so
  the offline/local experience never downloads it. `firebase/app` is only pulled
  in when the Firebase client is initialised.
- Assets are inline SVG/CSS — **no image downloads**, no sprite sheets, and they
  scale crisply at any size.
- No animation library; transitions are CSS.

## Runtime

- **Immutable, shallow updates.** Reducers return new objects but share
  unchanged sub-trees, so React re-renders cheaply. Keep game state shallow and
  avoid deep clones in hot paths.
- **`useSyncExternalStore`.** Components subscribe to a `MatchClient`'s exact
  snapshot; only subscribed components re-render on a state change.
- **BFS reachability** (`Board.reachable`) is bounded by `maxSteps` and grid
  size — trivial for the board sizes here. Cache it per render if a board grows
  large.
- **Determinism is O(1) per draw.** The RNG state is a single uint32; resuming
  costs nothing (no replay-to-fast-forward).

## Tips for larger games

- Keep `MatchState.game` JSON-plain and reasonably small — it's serialized on
  every save and every online `pushState`.
- For very chatty games, debounce non-authoritative UI state locally and only
  `pushState` on committed actions (the engine already only pushes on `ok`
  transitions).
- Memoize expensive derived values (legal-move sets, layout maps) with
  `useMemo` keyed on `state.version`.
- Prefer `enumerate`/`reachable` over re-deriving legality ad hoc in the view.
