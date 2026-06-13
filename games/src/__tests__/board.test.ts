import { describe, it, expect } from 'vitest';
import {
  advanceOnTrack,
  cellId,
  chebyshev,
  inBounds,
  makeGrid,
  manhattan,
  neighbors,
  parseCell,
  reachable,
} from '../engine/board';

describe('board', () => {
  it('cellId / parseCell round-trip', () => {
    expect(parseCell(cellId({ x: 3, y: 5 }))).toEqual({ x: 3, y: 5 });
  });

  it('distances', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 2, y: 3 })).toBe(5);
    expect(chebyshev({ x: 0, y: 0 }, { x: 2, y: 3 })).toBe(3);
  });

  it('neighbors respects bounds and walls', () => {
    const grid = makeGrid(3, 3, ['1,0']);
    const n = neighbors(grid, { x: 0, y: 0 }).map(cellId);
    expect(n).toContain('0,1');
    expect(n).not.toContain('1,0'); // wall
    expect(n).not.toContain('-1,0'); // out of bounds
  });

  it('reachable expands by step count and excludes the start', () => {
    const grid = makeGrid(5, 5);
    const r1 = reachable(grid, { x: 2, y: 2 }, 1).map(cellId);
    expect(r1.sort()).toEqual(['1,2', '2,1', '2,3', '3,2'].sort());
    expect(r1).not.toContain('2,2');
    const r2 = reachable(grid, { x: 2, y: 2 }, 2);
    expect(r2.length).toBeGreaterThan(r1.length);
  });

  it('reachable treats dynamic blockers as impassable', () => {
    const grid = makeGrid(3, 1);
    const open = reachable(grid, { x: 0, y: 0 }, 2).map(cellId);
    expect(open).toContain('2,0');
    const blocked = reachable(grid, { x: 0, y: 0 }, 2, { blocked: ['1,0'] }).map(cellId);
    expect(blocked).not.toContain('2,0'); // can't pass through the blocker
  });

  it('inBounds', () => {
    const grid = makeGrid(2, 2);
    expect(inBounds(grid, { x: 1, y: 1 })).toBe(true);
    expect(inBounds(grid, { x: 2, y: 0 })).toBe(false);
  });

  it('advanceOnTrack loops and clamps', () => {
    const loop = { cells: new Array(4).fill({ x: 0, y: 0 }), loop: true };
    expect(advanceOnTrack(loop, 3, 2)).toBe(1);
    const line = { cells: new Array(4).fill({ x: 0, y: 0 }), loop: false };
    expect(advanceOnTrack(line, 3, 5)).toBe(3);
    expect(advanceOnTrack(line, 0, -2)).toBe(0);
  });
});
