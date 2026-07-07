# Card System

`engine/cards.ts` provides serializable cards and **immutable** helpers. Every
card has a stable `id` so the UI can target and animate it regardless of array
position.

```ts
interface Card {
  id: string;
  suit?: Suit; rank?: Rank; value?: number;
  faceUp?: boolean;
  owner?: PlayerId | null;
  [extra: string]: unknown;   // game-specific fields welcome
}
```

## Building & shuffling

```ts
import { Cards } from './engine';

const deck = Cards.shuffle(Cards.standard52(), ctx.random); // deterministic
```

`standard52()` returns 52 face-down cards (`AS`, `KH`, …). `shuffle` returns a
**new** array (Fisher–Yates via the seeded RNG) and leaves the input untouched.

## Dealing

```ts
const { hands, rest } = Cards.deal(deck, ['p0', 'p1'], 3);
// hands = { p0: Card[3], p1: Card[3] }, rest = remaining draw pile
```

Dealing is round-robin (one card per player per pass).

## Zones (piles, hands, discards)

Zones are just `Card[]` (top = last element). All operations are pure:

| Helper | Purpose |
|---|---|
| `topOf(pile)` | Peek the top card. |
| `drawN(pile, n)` | `{ drawn, rest }` off the top. |
| `removeCard(zone, id)` | `{ card, rest }` by id. |
| `addCard(zone, card, faceUp?)` | Append (optionally flipping). |
| `flip(card, faceUp)` | New card with a new face state. |
| `publicView(card)` | Hide the face when face-down (for opponent views). |

## Hidden information

State stores the *real* cards. Whether a player **sees** them is a rendering
concern: `GameSurface` computes a `viewerId` (the current player in hot-seat, or
"you" online) and passes it to the view, which reveals only that player's hand
and renders everyone else's as backs (`<PlayingCard forceBack />`).

> Online, hidden state is protected by the game's optional `redact(game, viewerId)`
> hook (Crown Rush and Relic Run implement it). On the Firebase backend this is
> **server-enforced**: a Cloud Function writes each player's redacted view to a
> slot only that player can read (RTDB rules), and the full state is server-only.
> On the local cross-tab backend the client host publishes the same redacted
> views. See [Firebase Multiplayer](./firebase-multiplayer.md).

See **Crown Rush** (`src/games/crown-rush.ts`) for a complete worked example:
draw/discard, reshuffle when the stock empties, and a three-of-a-kind win.
