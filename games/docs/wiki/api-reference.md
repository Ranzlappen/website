# API Reference

Import everything from the engine barrel: `import { … } from '../engine'`.
Subsystems are namespaced: `Cards`, `Board`, `Dice`, `Rules`, `Zones`.

## Match lifecycle

```ts
createMatch<G>(def, {
  players: { id, name, isBot? }[],
  matchId?, seed?, startingPlayer?,
}): MatchState<G>

applyAction<G>(def, state, action): ApplyResult<G>
//  → { ok: true,  state, action } | { ok: false, error, state }

nextPlayer(order, current): PlayerId
botAction<G>(def, state): GameAction | null       // via def.ai
pickBotAction<G>(def, state): GameAction | null    // ai, validated; falls back to a legal action
legalActions<G>(def, state): GameAction[]          // via def.enumerate
redactFor<G>(def, state, viewerId): MatchState<G>  // per-viewer hidden-info redaction (via def.redact)
```

## defineGame (declarative rulesets)

```ts
defineGame<G>(spec: GameSpec<G>): GameDefinition<G>

interface GameSpec<G> {
  id; name; description; category; minPlayers; maxPlayers;
  tags?; accent?; emoji?; startingPhase?;
  setup(ctx: SetupContext): G;
  moves: Record<string, MoveDef<G>>;       // the ruleset
  endIf?(game, ctx): GameResult | null | undefined;
  ai?(game, ctx): GameAction | null;       // omit → first legal action
  onTurnBegin?(game, ctx): G;              // start-of-turn upkeep
  redact?(game, viewerId): G;              // omit → automatic zone redaction
}

interface MoveDef<G, P = unknown> {
  phase?: string | string[];               // phase gate (omit = any)
  anyPlayer?: boolean;                     // default: current player only
  validate?(game, payload: P, ctx): true | string;
  apply(game, payload: P, ctx): G;
  enumerate?(game, ctx): P[];              // candidates, re-validated
  nextPhase?: string | ((game, payload, ctx) => string);
  endsTurn?: boolean | ((game, payload, ctx) => boolean);
  describe?(payload: P, playerName: string): string;
}
```

## GameDefinition

The compiled shape (hand-write it only when the spec can't express the rules):

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
  onTurnBegin?(game, ctx): G;              // runs when the active player changes
  describeAction?(action, state): string;
  redact?(game, viewerId): G;
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
deserializeMatch<G>(json): { schema, savedAt, state }
// throws on corrupt input, newer schema, or older-than-MIN schema
SAVE_SCHEMA_VERSION: number
MIN_SAVE_SCHEMA_VERSION: number
```

## Registry

```ts
registerGame(def) · getGame(id) · listGames() · hasGame(id)
```

## Cards (`Cards.*`)

`standard52()` · `deckFromSpec([{ kind, count, data? }])` · `shuffle(deck, rng)` ·
`deal(deck, ids, perPlayer)` · `drawN(pile, n)` · `removeCard(zone, id)` ·
`addCard(zone, card, faceUp?)` · `topOf(pile)` · `flip(card, faceUp)` ·
`publicView(card)` · `rankValue(rank, aceHigh?)` · `SUITS` · `RANKS` · `SUIT_COLOR`

## Zones (`Zones.*`)

```ts
makeZone(id, 'public' | 'owner' | 'hidden', cards?, owner?)
makeZones(...zones): ZoneMap                 // throws on duplicate ids
zoneId(prefix, playerId)                     // 'hand:p0' convention
getZone · cardsIn · countIn · topCard · findCard
setCards · addCards(zones, id, cards, { faceUp? })
moveCard(zones, from, to, cardId, { faceUp? })   // throws if absent
moveTop(zones, from, to, n?, { faceUp? })
draw(zones, from, to, n?, { faceUp?, reshuffleFrom?, keepTop?, random? })
shuffleZone(zones, id, rng)
redactZones(zones, viewerId): ZoneMap        // per-viewer view by policy
```

## Board (`Board.*`)

`makeGrid(w, h, walls?)` · `cellId(c)` · `parseCell(id)` · `coordsEqual(a, b)` ·
`inBounds` · `isWall` · `isPassable` · `manhattan` · `chebyshev` ·
`neighbors(grid, c, diagonal?)` · `reachable(grid, start, maxSteps, { diagonal?, blocked? })`
· `advanceOnTrack(track, index, steps)`

## Dice (`Dice.*`)

`roll(rng, sides?, count?) → { dice, total }` · `d6(rng)`

## Rules (`Rules.*`)

`all(...verdicts)` · `requireCurrentPlayer(ctx)` · `requirePhase(ctx, phase)` ·
`check(cond, reason)` — each returns `true | string`.

## Network (`src/net`)

```ts
getSyncAdapter(): SyncAdapter
getNetMode() / setNetMode('local' | 'firebase')
firebaseAvailable(): boolean
makeRoomCode(): string

interface SyncAdapter {
  kind: 'local' | 'firebase';
  serverAuthoritative: boolean;           // firebase = server arbiter; local = client host
  ensureIdentity(): Promise<string>;      // local id, or anonymous-auth uid
  startMatch(roomId): Promise<void>;       // server-authoritative start (host-gated)
  createRoom({ gameId, host }) ; joinRoom(roomId, { id, name }) ; leaveRoom ;
  setReady ; setPresence ; setStatus ;
  pushState(roomId, state, viewerId?) ;           // host; per-viewer slot when viewerId given
  submitAction(roomId, playerId, action) ;        // non-host clients
  ackAction(roomId, actionId) ;                    // host
  subscribeRoom(roomId, cb) → off ;
  subscribeState(roomId, cb, viewerId?) → off ;    // viewer slot, falls back to shared
  subscribeActions(roomId, cb) → off ;             // host consumes the queue
}

// helpers: makeRoomCode(), withPresence(room), actionId()
```

## Storage (`src/storage/local`)

`saveMatch(state)` · `loadMatch<G>(matchId)` · `listSaves()` · `deleteSave(matchId)`
