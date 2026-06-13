# Creating Games

Adding a game takes two files and two import lines. The engine, gallery, lobby,
router, save/load, undo/redo and online play all work automatically.

## The recipe

1. **Define the game** in `src/games/<id>.ts`:
   - a state type `G`,
   - a `GameDefinition<G, Action>` with `setup` + `reducer` (+ optional
     `validate`, `enumerate`, `endIf`, `ai`, `describeAction`),
   - a `registerGame(def)` call at the bottom.
2. **Add a view** in `src/games/views/<Name>View.tsx` that calls
   `registerView(id, Component)`.
3. **Wire the imports:** add the def to `src/games/index.ts` and the view to
   `src/games/views/index.ts`.

That's all. Below, the three categories with the canonical examples.

## A card game

Reference: **`src/games/crown-rush.ts`**.

```ts
import { Cards, Rules, registerGame, type GameDefinition, type GameAction } from '../engine';

interface MyState { draw: Cards.Card[]; hands: Record<string, Cards.Card[]>; /* … */ }
type MyAction = GameAction<'DRAW', { from: 'stock' | 'discard' }> | GameAction<'DISCARD', { cardId: string }>;

const def: GameDefinition<MyState, MyAction> = {
  id: 'my-card-game', name: 'My Card Game', description: '…',
  category: 'card', minPlayers: 2, maxPlayers: 4,
  setup(ctx) {
    const deck = Cards.shuffle(Cards.standard52(), ctx.random);
    const { hands, rest } = Cards.deal(deck, ctx.players.map(p => p.id), 5);
    return { draw: rest, hands /* … */ };
  },
  validate(game, action, ctx) {
    return Rules.all(Rules.requireCurrentPlayer(ctx) /* , … */);
  },
  reducer(game, action, ctx) {
    // edit `game`, then drive flow:
    ctx.events.endTurn();            // or ctx.events.endGame({ status: 'win', winners: [ctx.actor] })
    return nextGame;
  },
};
registerGame(def);
```

Key points: shuffle/deal via `ctx.random`; keep state immutable (return new
objects); reveal hidden hands in the **view**, not the state.

## A board game

Reference: **`src/games/lantern-hunt.ts`**.

- Build a `Board.makeGrid(w, h, walls)` in `setup`; store pawn positions as
  `Record<PlayerId, cellId>` and tokens as cell-id arrays.
- A two-step turn (`ROLL` then `MOVE`) using `ctx.random` / `Dice.d6`.
- Compute legal moves with `Board.reachable(grid, from, die, { blocked })` and
  export that helper so the **view** can highlight cells.
- `validate` rejects moves outside the reachable set; `reducer` moves the pawn,
  resolves the cell, and calls `endTurn` / `endGame`.

## A hybrid game

Reference: **`src/games/relic-run.ts`** — cards **and** board **and** tokens.

- A looping track (`CellKind[]`), a shared action-card deck, hidden per-player
  hands, and relic tokens.
- Phases (`startingPhase: 'roll'` → `'action'`) with `ctx.events.setPhase`.
- `endIf(game)` centralises the win check (first to four relics).

## Optional hooks

| Hook | Powers |
|---|---|
| `enumerate(game, ctx)` | Hints, move highlighting, and a generic random bot. |
| `ai(game, ctx)` | A smarter bot for solo play (auto-driven by the Play screen). |
| `endIf(game, ctx)` | Declarative end-of-game check (alternative to `events.endGame`). |
| `describeAction(action, state)` | Human-readable event-log lines. |

## Writing the view

A view receives `{ state, dispatch, viewerId, canAct }` (see
`src/games/views/types.ts`). Render the table from `state.game`; reveal private
info for `viewerId`; gate inputs on `canAct`; call `dispatch({ type, payload })`.
Use the shared assets (`PlayingCard`, `Die`, `Pawn`, `Token`) and theme classes
(`.tt-felt`, `.tt-cell`, `.tt-card`). Register it with `registerView(id, View)`.

For assets and themes, see [Assets & Themes](./assets-and-themes.md).
