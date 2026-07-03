# Engine Concepts

## Game lifecycle

```
createMatch(def, opts)  ─►  MatchState (status: 'active', version: 0)
        │
        ▼
applyAction(def, state, action)  ─►  { ok: true, state: MatchState' }   (version + 1)
        │                                    │
        │  reducer edits game state          │  ctx.events.* resolve into TurnState/status
        ▼                                    ▼
   ...repeat until endGame / endIf  ─►  status: 'finished', result: GameResult
```

- **`createMatch`** validates the player count, seats the players, seeds the
  deterministic RNG, runs `def.setup`, and returns the initial `MatchState`.
- **`applyAction`** is the single transition. It is **pure**: the input state is
  never mutated; a new state is returned. Illegal actions return
  `{ ok: false, error, state }` with the unchanged state.

## State model

```ts
interface MatchState<G> {
  matchId: string;
  gameId: string;
  players: PlayerInfo[];      // { id, name, seat, isBot? }
  status: 'active' | 'finished';
  turn: { current; phase; turnNumber; order };
  rngState: number;          // serializable PRNG state
  game: G;                   // YOUR game-specific state
  result: GameResult | null;
  version: number;           // +1 per applied action
  updatedAt: number;
}
```

Everything is **plain JSON** — no `Map`, `Set`, `Date`, or class instances in
`game`. Keep it that way and save/load and network sync are free.

## Action / event model

An **action** is what a player does: `{ type, payload?, playerId? }`. Types and
payloads are entirely game-defined. If `playerId` is omitted the engine fills in
the current player.

A reducer drives **flow** through `ctx.events`:

| Call | Effect (applied after the reducer returns) |
|---|---|
| `events.endTurn({ next? })` | Advance to the next seat (or `next`); `turnNumber++`. |
| `events.setPhase(name)` | Change `turn.phase`. |
| `events.endGame(result)` | Finish the match with a `GameResult`. |

Alternatively a game can implement `endIf(game, ctx)` returning a `GameResult`
to finish — run automatically after every action.

When a turn ends, the optional `onTurnBegin(game, ctx)` hook runs for the
incoming player (`ctx.actor` is the new current player) — the one place for
start-of-turn upkeep such as resetting per-turn flags or drawing a card.

## Declarative rulesets (`defineGame`)

Hand-writing `validate`/`reducer` switches is the low-level path. The
recommended way to author a game is the declarative layer in `engine/flow.ts`:
describe the rules as a map of **moves** and let the compiler synthesize the
GameDefinition.

```ts
const game = defineGame<MyState>({
  id: 'my-game', name: 'My Game', /* …meta… */
  startingPhase: 'roll',
  setup(ctx) { /* build initial state */ },
  moves: {
    ROLL: {
      phase: 'roll',                       // phase gate
      apply: (g, _p, ctx) => ({ ...g, die: Dice.d6(ctx.random) }),
      nextPhase: 'action',                 // declared flow transition
    },
    PLAY: {
      phase: 'action',
      validate: (g, p: { cardId: string }, ctx) => /* true | reason */,
      apply:    (g, p: { cardId: string }, ctx) => /* next state */,
      enumerate: (g, ctx) => /* candidate payloads */,
      endsTurn: true,                      // static or computed per move
      describe: (p, name) => `${name} played a card.`,
    },
  },
  onTurnBegin: (g) => ({ ...g, perTurnFlag: false }),
  endIf: (g, ctx) => /* GameResult | null */,
});
```

For each action the compiled definition checks the actor (current player unless
the move sets `anyPlayer`), the phase gate, then the move's own `validate`;
`enumerate` is synthesized from every phase-legal move's candidates filtered
through validation, so hints and bots can never disagree with the rules; and
when the game state carries a `zones` property, per-viewer `redact` is derived
automatically from the zone visibilities (see [Card System](./card-system.md)).
Games whose rules don't fit the spec can still hand-write a `GameDefinition` —
the compiler's output is exactly that shape.

## Determinism

All randomness comes from `ctx.random` (a `RandomSource`) whose state lives in
`MatchState.rngState`. `applyAction` resumes the RNG from that state, runs the
reducer, then persists the advanced state. Same seed + same actions ⇒ identical
states on every machine — the foundation for replays and authoritative sync.

> Never call `Math.random()` in a reducer. Use `ctx.random`.

## Validation

`def.validate(game, action, ctx)` returns `true` or a reason string. Compose the
helpers in `engine/rules.ts`:

```ts
validate(game, action, ctx) {
  return Rules.all(
    Rules.requireCurrentPlayer(ctx),
    Rules.requirePhase(ctx, 'play'),
    Rules.check(canDoIt(game, action), 'You cannot do that yet.'),
  );
}
```

## Client, history & sync

`MatchClient` wraps a state with an action log, **undo/redo** stacks, and a
`subscribe` API (used by React's `useSyncExternalStore`). For online play,
`replaceState(remote)` swaps in an authoritative snapshot (newer `version`
wins). See [API Reference](./api-reference.md).
