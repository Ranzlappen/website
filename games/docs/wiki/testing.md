# Testing Guide

Tests run on **Vitest** (jsdom environment). 100 tests live in
`src/__tests__/`.

```bash
cd games
npm test           # run once (CI uses this)
npm run test:watch # watch mode
```

## What's covered

| File | Focus |
|---|---|
| `rng.test.ts` | Seed determinism, ranges, shuffle immutability, `getState` round-trip. |
| `match.test.ts` | `createMatch`, turn progression, illegal/out-of-turn rejection, terminal state, `legalActions`/`botAction`. |
| `cards.test.ts` | Deck integrity, deterministic shuffle, dealing, immutable zone ops. |
| `board.test.ts` | Neighbours, BFS reachability (incl. dynamic blockers), distances, track wrap/clamp. |
| `zones.test.ts` | Zone construction, immutable move/draw ops, auto-reshuffle, visibility-driven redaction. |
| `flow.test.ts` | `defineGame` compiler: actor/phase gates, declared `nextPhase`/`endsTurn`, `onTurnBegin` upkeep, synthesized enumerate/describe, automatic zone redaction. |
| `serialize.test.ts` | Round-trip, corrupt/missing/newer-schema rejection. |
| `client.test.ts` | Dispatch + notify, undo/redo, stale-snapshot guard in `replaceState`. |
| `crown-rush.test.ts` | Deal counts, draw→discard flow, win on three of a kind, illegal sequences. |
| `lantern-hunt.test.ts` | Roll→move, reachable rejection, third-lantern win. |
| `relic-run.test.ts` | Phase gating, pass/turn flow, Ward card → fourth relic win. |
| `engine-helpers.test.ts` | `pickBotAction` falls back when `ai` is illegal; `redactFor` hides opponents' hands/stock. |
| `simulation.test.ts` | Full bot-vs-bot playthroughs of every demo game: termination, legality of every bot move, seed-identical final states. |
| `net.test.ts` | LocalSyncAdapter: create/join, ready + presence-by-id, shared vs per-viewer state, stale-version rejection, action relay + ack, room teardown. |
| `storage.test.ts` | save/load/list/delete and the `MAX_SAVES` prune. |
| `app.test.tsx` | Gallery lists all games; setup screen renders; every game view mounts without crashing. |

## Testing strategy

- **Pure engine = easy tests.** Because `applyAction` is a pure function, most
  tests are `state → action → assert`. No mocks, no DOM.
- **Determinism via fixed seeds.** Pass `seed` to `createMatch` and assert on the
  resulting `game` to lock behaviour without flakiness.
- **Craft terminal states.** To test a win without playing a whole game, build a
  match then spread-override `state.game` (and `state.turn` for phase) into the
  exact pre-win situation, then dispatch the finishing action. See the demo
  tests for the pattern.
- **Firebase boundary.** The Firebase adapter is exercised through the
  `SyncAdapter` *interface*; the local adapter is the concrete implementation
  used in tests/dev. Real RTDB isn't required locally — stub the adapter to test
  room flows in isolation if needed.

## Adding tests for a new game

Mirror a demo test: assert `setup` shape, one happy-path turn, one rejected
illegal action, and one crafted win. Keep states JSON-plain so `toEqual` works.
