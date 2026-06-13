# API Reference

Import everything from the engine barrel: `import { … } from '../engine'`.
Subsystems are namespaced: `Cards`, `Board`, `Dice`, `Rules`.

## Match lifecycle

```ts
createMatch<G>(def, {
  players: { id, name, isBot? }[],
  matchId?, seed?, startingPlayer?,
}): MatchState<G>

applyAction<G>(def, state, action): ApplyResult<G>
//  → { ok: true,  state, action } | { ok: false, error, state }

nextPlayer(order, current): PlayerId
botAction<G>(def, state): GameAction | null      // via def.ai
legalActions<G>(def, state): GameAction[]         // via def.enumerate
```

## GameDefinition

```ts
interface GameDefinition<G, A extends GameAction = GameAction> {
  id; name; description;
  category: 'card' | 'board' | 'hybrid';
  minPlayers; maxPlayers; tags?; accent?; emoji?;
  startingPhase?;                          // default 'play'
  setup(ctx: SetupContext): G;
  reducer(game: G, action: A, ctx: ReducerContext): G;
  validate?(game, action, ctx): true | string;
  enumerate?(game, ctx): A[];
  endIf?(game, ctx): GameResult | null | undefined;
  ai?(game, ctx): A | null;
  describeAction?(action, state): string;
}
```

### Contexts

```ts
SetupContext   = { random, players, turn }
ReducerContext = { random, actor, turn, players, events }
FlowEvents     = { endTurn({ next? }), setPhase(name), endGame(result) }
```

## RNG (`RandomSource`)

```ts
seedRng(seed: string | number): RngState
createRandom(state: RngState): RandomSource
//   .float() .int(min,max) .bool(p?) .pick(arr)
//   .shuffle(arr) .dice(sides,count?) .getState()
```

## MatchClient

```ts
new MatchClient(def, initialState)
  .getState() .getLog() .getError()
  .dispatch(action, { ephemeral? }) .clearError()
  .undo() .redo() .canUndo .canRedo
  .replaceState(remote)        // newer version wins; clears local history
  .subscribe(fn) → unsubscribe
```

## Serialization

```ts
serializeMatch(state): string
deserializeMatch<G>(json): { schema, savedAt, state }   // throws on corrupt/newer
SAVE_SCHEMA_VERSION: number
```

## Registry

```ts
registerGame(def) · getGame(id) · listGames() · hasGame(id)
```

## Cards (`Cards.*`)

`standard52()` · `shuffle(deck, rng)` · `deal(deck, ids, perPlayer)` ·
`drawN(pile, n)` · `removeCard(zone, id)` · `addCard(zone, card, faceUp?)` ·
`topOf(pile)` · `flip(card, faceUp)` · `publicView(card)` · `rankValue(rank, aceHigh?)`
· `SUITS` · `RANKS` · `SUIT_COLOR`

## Board (`Board.*`)

`makeGrid(w, h, walls?)` · `cellId(c)` · `parseCell(id)` · `coordsEqual(a, b)` ·
`inBounds` · `isWall` · `isPassable` · `manhattan` · `chebyshev` ·
`neighbors(grid, c, diagonal?)` · `reachable(grid, start, maxSteps, { diagonal?, blocked? })`
· `advanceOnTrack(track, index, steps)`

## Dice (`Dice.*`)

`roll(rng, sides?, count?) → { dice, total }` · `d6(rng)`

## Rules (`Rules.*`)

`all(...verdicts)` · `requireCurrentPlayer(ctx)` · `requirePhase(ctx, phase)` ·
`require(cond, reason)` — each returns `true | string`.

## Network (`src/net`)

```ts
getSyncAdapter(): SyncAdapter
getNetMode() / setNetMode('local' | 'firebase')
firebaseAvailable(): boolean
makeRoomCode(): string

interface SyncAdapter {
  kind: 'local' | 'firebase';
  createRoom({ gameId, host }) ; joinRoom(roomId, { id, name }) ; leaveRoom ;
  setReady ; setPresence ; setStatus ;
  pushState(roomId, state) ;
  subscribeRoom(roomId, cb) → off ;
  subscribeState(roomId, cb) → off ;
}
```

## Storage (`src/storage/local`)

`saveMatch(state)` · `loadMatch<G>(matchId)` · `listSaves()` · `deleteSave(matchId)`
