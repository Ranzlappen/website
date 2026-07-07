# Board System

`engine/board.ts` provides coordinates, rectangular grids with walls, distance
metrics, neighbour/reachability search (for legal-move highlighting), and a
looping/clamping track for race games.

## Coordinates & cells

```ts
interface Coord { x: number; y: number; }   // x→right, y→down
cellId({ x: 3, y: 5 })  // "3,5"  (use as object keys / occupancy maps)
parseCell("3,5")        // { x: 3, y: 5 }
```

## Grids & walls

```ts
import { Board } from './engine';

const grid = Board.makeGrid(7, 7, ['3,3', '2,4']); // width, height, wall cells
Board.inBounds(grid, c);     // within the rectangle?
Board.isPassable(grid, c);   // in bounds AND not a wall
```

## Distances

```ts
Board.manhattan(a, b);  // orthogonal step count
Board.chebyshev(a, b);  // king-move count (diagonals cost 1)
```

## Neighbours & reachability

```ts
Board.neighbors(grid, c);              // passable orthogonal neighbours
Board.neighbors(grid, c, true);        // include diagonals
Board.reachable(grid, start, maxSteps, { diagonal?, blocked? });
```

`reachable` is a breadth-first flood fill returning every cell within
`maxSteps`, honouring walls **and** dynamic `blocked` cells (e.g. other pawns).
It excludes the start cell. This is exactly what powers Lantern Hunt's
highlighted legal moves:

```ts
const targets = Board.reachable(grid, from, die, { blocked: otherPawns });
```

## Tracks (race games)

```ts
const track = { cells: [...coords], loop: true };
Board.advanceOnTrack(track, index, steps); // loops or clamps the index
```

## Tokens & pieces

Tokens are game-state — usually a `Record<cellId, ...>` or arrays of cell ids
(Lantern Hunt stores lanterns as `string[]` of cell ids and pawns as
`Record<PlayerId, cellId>`). The renderer (`Pawn`, `Token` in `ui/assets/`)
draws them; the engine never assumes a specific token shape.

## Rendering boards

Views don't hand-roll grid markup: `<GridBoard grid legalCells onCellActivate
renderCell />` renders the cells with wall styling, legal-move highlighting and
click/keyboard activation built in, and `<LoopTrack count renderCell />` does
the same for race tracks. See [Assets & Themes](./assets-and-themes.md).

See **Lantern Hunt** (`src/games/lantern-hunt.ts`) for grid + dice + tokens +
legal-move highlighting + scoring, and **Relic Run** for a looping track.
