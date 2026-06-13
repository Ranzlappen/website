# Overview & Quick Start

Tabletop is a reusable browser engine for **card games, board games, and hybrid
tabletop games**. It powers a polished React SPA deployed at `/games/`, but the
engine itself is framework-agnostic TypeScript you could drop into any renderer.

## Capabilities

- **Cards:** decks, hands, draw/discard piles, shuffling, dealing, face-up/down
  state, ownership, selection, hidden vs. public information.
- **Boards:** grids with walls, pawns/tokens, dice, BFS legal-move highlighting,
  looping tracks, distances, movement validation.
- **Flow:** players, seats, turns, phases, deterministic state transitions,
  win/draw conditions.
- **Modes:** solo vs. bots, hot-seat on one device, online rooms (join by code
  or link), presence, ready states, reconnect/resume.
- **Quality of life:** undo/redo, event log, save/load, three visual themes,
  full keyboard support, reduced-motion handling, mobile/touch layouts.

## Quick start (development)

```bash
cd games
npm install
npm run dev          # http://localhost:5173/games/
```

Then:

1. Open the gallery, pick a game, choose seats (humans/bots), **Start game**.
2. Or click **Online**, **Create room**, copy the link, and open it in a second
   browser tab to play multiplayer locally with zero setup.

## Quick start (play the engine in code)

```ts
import { createMatch, applyAction } from './src/engine';
import { crownRush } from './src/games/crown-rush';

let match = createMatch(crownRush, {
  seed: 'demo',
  players: [
    { id: 'p0', name: 'Ann' },
    { id: 'p1', name: 'Bo' },
  ],
});

const result = applyAction(crownRush, match, {
  type: 'DRAW',
  payload: { from: 'stock' },
});
if (result.ok) match = result.state;
```

Everything else — UI, networking, persistence — is layered on top of these two
functions. Continue to [Architecture](./architecture.md).
