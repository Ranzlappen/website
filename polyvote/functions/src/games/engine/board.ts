/**
 * Board subsystem — square grids, coordinates, distances, neighbours,
 * reachability (for legal-move highlighting) and simple path tracks.
 *
 * Coordinates are `{x, y}` with `x` increasing right and `y` increasing down.
 * A cell id is the canonical `"x,y"` string so cells can be used as object keys
 * (e.g. a token-occupancy map) and remain JSON-serializable.
 */

export interface Coord {
  x: number;
  y: number;
}

export function cellId(c: Coord): string {
  return `${c.x},${c.y}`;
}

export function parseCell(id: string): Coord {
  const [x, y] = id.split(',').map(Number);
  return { x, y };
}

export function coordsEqual(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

/** A rectangular grid with optional impassable cells (walls). */
export interface Grid {
  width: number;
  height: number;
  /** Set of cell ids that cannot be entered. */
  walls?: string[];
}

export function makeGrid(width: number, height: number, walls: string[] = []): Grid {
  return { width, height, walls };
}

export function inBounds(grid: Grid, c: Coord): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < grid.width && c.y < grid.height;
}

export function isWall(grid: Grid, c: Coord): boolean {
  return !!grid.walls?.includes(cellId(c));
}

export function isPassable(grid: Grid, c: Coord): boolean {
  return inBounds(grid, c) && !isWall(grid, c);
}

/** Manhattan (taxicab) distance — orthogonal step count. */
export function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Chebyshev distance — king-move step count (diagonals cost 1). */
export function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const ORTHO: Coord[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];
const DIAG: Coord[] = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
];

/** Passable neighbours of a cell (orthogonal, or include diagonals). */
export function neighbors(grid: Grid, c: Coord, diagonal = false): Coord[] {
  const dirs = diagonal ? [...ORTHO, ...DIAG] : ORTHO;
  return dirs
    .map((d) => ({ x: c.x + d.x, y: c.y + d.y }))
    .filter((n) => isPassable(grid, n));
}

/**
 * Breadth-first reachability: all cells reachable from `start` within
 * `maxSteps` movement, treating walls/out-of-bounds as blocked. `start` itself
 * is excluded from the result. `blocked` adds dynamic obstacles (e.g. other
 * pieces) on top of the grid's static walls.
 */
export function reachable(
  grid: Grid,
  start: Coord,
  maxSteps: number,
  opts: { diagonal?: boolean; blocked?: string[] } = {},
): Coord[] {
  const blocked = new Set(opts.blocked ?? []);
  const seen = new Set<string>([cellId(start)]);
  const out: Coord[] = [];
  let frontier: Coord[] = [start];
  for (let step = 0; step < maxSteps; step++) {
    const next: Coord[] = [];
    for (const cell of frontier) {
      for (const n of neighbors(grid, cell, opts.diagonal)) {
        const id = cellId(n);
        if (seen.has(id) || blocked.has(id)) continue;
        seen.add(id);
        out.push(n);
        next.push(n);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return out;
}

/**
 * A linear/looping track of cells (for race-style board games). Movement is by
 * index; `loop` wraps the index, otherwise it clamps at the final cell.
 */
export interface Track {
  cells: Coord[];
  loop: boolean;
}

export function advanceOnTrack(track: Track, index: number, steps: number): number {
  const raw = index + steps;
  if (track.loop) {
    return ((raw % track.cells.length) + track.cells.length) % track.cells.length;
  }
  return Math.max(0, Math.min(track.cells.length - 1, raw));
}
