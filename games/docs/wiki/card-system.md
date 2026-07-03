# Card System

`engine/cards.ts` provides serializable cards and **immutable** helpers;
`engine/zones.ts` provides the named, visibility-typed containers that card
games keep them in. Every card has a stable `id` so the UI can target and
animate it regardless of array position.

```ts
interface Card {
  id: string;
  suit?: Suit; rank?: Rank; value?: number;
  kind?: string;              // template tag for custom cards (deckFromSpec)
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

Custom decks are a declarative composition — cards get stable ids (`leap-0`,
`leap-1`, …) and carry their `kind` plus any `data` fields:

```ts
const deck = ctx.random.shuffle(
  Cards.deckFromSpec([
    { kind: 'leap', count: 5 },
    { kind: 'steal', count: 4 },
    { kind: 'ward', count: 3, data: { rare: true } },
  ]),
);
```

Pair a spec with an **effect table** (`Record<kind, (game, me, ctx) => G>`) and
adding a new card to a game is one spec line + one effect entry — see
`src/games/relic-run.ts`.

## Dealing

```ts
const { hands, rest } = Cards.deal(deck, ['p0', 'p1'], 3);
// hands = { p0: Card[3], p1: Card[3] }, rest = remaining draw pile
```

Dealing is round-robin (one card per player per pass).

## Zones (named, visibility-typed)

`engine/zones.ts` is where cards live during play. A zone is a named container
with a **visibility policy**; a game keeps all of them in one `ZoneMap` under a
`zones` key in its state:

```ts
import { Zones } from './engine';

const zones = Zones.makeZones(
  Zones.makeZone('stock', 'hidden', stockCards),          // nobody sees order
  Zones.makeZone('discard', 'public'),                     // everyone sees
  ...players.map((p) =>
    Zones.makeZone(Zones.zoneId('hand', p.id), 'owner', dealt[p.id], p.id),
  ),                                                       // only the owner sees
);
```

All operations are pure — each returns a new `ZoneMap`:

| Helper | Purpose |
|---|---|
| `moveCard(zones, from, to, cardId, { faceUp? })` | Move one specific card (throws if absent — surfaces reducer bugs). |
| `moveTop(zones, from, to, n?, { faceUp? })` | Move the top *n* cards. |
| `draw(zones, from, to, n?, { faceUp?, reshuffleFrom?, keepTop?, random? })` | Draw with **auto-reshuffle** of a linked discard when the pile runs dry. |
| `addCards` / `setCards` / `shuffleZone` | Building blocks. |
| `cardsIn` / `countIn` / `topCard` / `findCard` / `getZone` | Lookups. |
| `redactZones(zones, viewerId)` | The per-viewer view derived from the policies (below). |

Low-level `Card[]` helpers remain in `Cards.*` for ad-hoc piles: `topOf`,
`drawN`, `removeCard`, `addCard`, `flip`, `publicView`.

## Hidden information

State stores the *real* cards. Two layers keep them hidden:

- **Rendering:** `GameSurface` computes a `viewerId` (the current player in
  hot-seat, or "you" online) and the view reveals only that player's zones,
  rendering everyone else's as backs (`<CardFan forceBack />`).
- **Redaction:** for networked play, `redactZones` derives what each viewer may
  receive straight from the visibility policies — `public` zones keep their
  cards (face-down faces masked via `publicView`), `owner` zones are intact for
  their owner and replaced by anonymous stubs for everyone else, `hidden` zones
  are stubbed for all (counts always survive, so piles still render). Games
  authored with `defineGame` whose state has a `zones` property get this wired
  up automatically — no hand-written `redact` hook.

> On the Firebase backend redaction is **server-enforced**: a Cloud Function
> writes each player's redacted view to a slot only that player can read (RTDB
> rules), and the full state is server-only. On the local cross-tab backend the
> client host publishes the same redacted views. See
> [Firebase Multiplayer](./firebase-multiplayer.md).

See **Crown Rush** (`src/games/crown-rush.ts`) for a complete worked example:
zone setup, draw/discard moves, auto-reshuffle when the stock empties, and a
three-of-a-kind win.
