# Creating Games

Adding a game takes two files and two import lines. The engine, gallery, lobby,
router, save/load, undo/redo and online play all work automatically.

## The recipe

1. **Define the game** in `src/games/<id>.ts`:
   - a state type `G`,
   - a `defineGame<G>({ …meta, setup, moves, endIf, … })` call describing the
     ruleset declaratively (see [Engine Concepts](./engine-concepts.md)),
   - a `registerGame(def)` call at the bottom.
2. **Add a view** in `src/games/views/<Name>View.tsx` that calls
   `registerView(id, Component)`.
3. **Wire the imports:** add the def to `src/games/index.ts` and the view to
   `src/games/views/index.ts`.

That's all. Below, the three categories with the canonical examples.

## A card game

Reference: **`src/games/crown-rush.ts`**.

```ts
import { Cards, Rules, Zones, defineGame, registerGame } from '../engine';

interface MyState {
  zones: Zones.ZoneMap;   // stock/discard/hands live here → auto-redaction
  hasDrawn: boolean;
}

const def = defineGame<MyState>({
  id: 'my-card-game', name: 'My Card Game', description: '…',
  category: 'card', minPlayers: 2, maxPlayers: 4,

  setup(ctx) {
    const deck = ctx.random.shuffle(Cards.standard52());
    const { hands, rest } = Cards.deal(deck, ctx.players.map((p) => p.id), 5);
    return {
      zones: Zones.makeZones(
        Zones.makeZone('stock', 'hidden', rest),
        Zones.makeZone('discard', 'public'),
        ...ctx.players.map((p) =>
          Zones.makeZone(Zones.zoneId('hand', p.id), 'owner', hands[p.id], p.id),
        ),
      ),
      hasDrawn: false,
    };
  },

  moves: {
    DRAW: {
      validate: (g) => Rules.check(!g.hasDrawn, 'Already drawn.'),
      apply: (g, _p, ctx) => ({
        ...g,
        zones: Zones.draw(g.zones, 'stock', Zones.zoneId('hand', ctx.actor), 1, {
          faceUp: true, reshuffleFrom: 'discard', keepTop: true, random: ctx.random,
        }),
        hasDrawn: true,
      }),
    },
    DISCARD: {
      validate: (g, p: { cardId: string }, ctx) =>
        Rules.check(g.hasDrawn, 'Draw first.'),
      apply: (g, p: { cardId: string }, ctx) => ({
        ...g,
        zones: Zones.moveCard(g.zones, Zones.zoneId('hand', ctx.actor), 'discard', p.cardId, { faceUp: true }),
      }),
      enumerate: (g, ctx) =>
        Zones.cardsIn(g.zones, Zones.zoneId('hand', ctx.actor)).map((c) => ({ cardId: c.id })),
      endsTurn: true,
    },
  },

  onTurnBegin: (g) => ({ ...g, hasDrawn: false }),
  endIf: (g, ctx) => /* scan hands, return a GameResult or null */ null,
});
registerGame(def);
```

Key points: shuffle/deal via `ctx.random`; keep state immutable (every helper
returns new objects); keep hidden cards in zones so redaction is automatic;
reveal hands in the **view**, not the state.

## A board game

Reference: **`src/games/lantern-hunt.ts`**.

- Build a `Board.makeGrid(w, h, walls)` in `setup`; store pawn positions as
  `Record<PlayerId, cellId>` and tokens as cell-id arrays.
- Two moves: `ROLL` (guarded by `die === null`) and `MOVE` (with `endsTurn:
  true`), using `ctx.random` / `Dice.d6`.
- Compute legal cells with `Board.reachable(grid, from, die, { blocked })`,
  return them from the move's `enumerate`, and export the helper so the
  **view** can highlight them (`<GridBoard legalCells …>`).
- `endIf` centralises the win check (target score, or empty board → best score).

## A hybrid game

Reference: **`src/games/relic-run.ts`** — cards **and** board **and** tokens.

- A looping track (`CellKind[]`), relic tokens, plus zones for a hidden
  action-card deck, a public discard and per-player hands.
- Phase flow declared on the moves: `ROLL` has `phase: 'roll'` and
  `nextPhase: 'action'`; `PLAY`/`PASS` have `phase: 'action'`,
  `nextPhase: 'roll'` and `endsTurn: true`.
- The deck is a `Cards.deckFromSpec` composition and each card kind maps to an
  effect function in a table — adding a card is one spec line + one entry.

## Hooks on the spec

| Hook | Powers |
|---|---|
| per-move `enumerate` | Hints, move highlighting, and a generic bot — always filtered through validation. |
| `ai(game, ctx)` | A smarter bot for solo play (auto-driven by the Play screen). Omit it and bots take the first legal action. |
| `endIf(game, ctx)` | Declarative end-of-game check (alternative to `events.endGame`). |
| per-move `describe(payload, name)` | Human-readable event-log lines. |
| `onTurnBegin(game, ctx)` | Start-of-turn upkeep for the incoming player. |
| `redact(game, viewerId)` | Only needed when hidden info lives **outside** zones — zone-based states are redacted automatically. |

## Writing the view

A view receives `{ state, dispatch, viewerId, canAct }` (see
`src/games/views/types.ts`). Render the table from `state.game`; reveal private
info for `viewerId`; gate inputs on `canAct`; call `dispatch({ type, payload })`.
Compose the shared assets — `PlayingCard`, `CardFan`, `Pile`, `TileCard`, `Die`,
`DiceTray`, `Pawn`, `Token`, `GridBoard`, `LoopTrack` — and theme classes
(`.tt-felt`, `.tt-cell`, `.tt-card`). Register it with `registerView(id, View)`.

For assets and themes, see [Assets & Themes](./assets-and-themes.md).
