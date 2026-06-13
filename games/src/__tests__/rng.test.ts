import { describe, it, expect } from 'vitest';
import { createRandom, seedRng } from '../engine/rng';

describe('RNG determinism', () => {
  it('produces identical sequences from the same seed', () => {
    const a = createRandom(seedRng('hello'));
    const b = createRandom(seedRng('hello'));
    const seqA = Array.from({ length: 10 }, () => a.float());
    const seqB = Array.from({ length: 10 }, () => b.float());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences from different seeds', () => {
    const a = createRandom(seedRng('one'));
    const b = createRandom(seedRng('two'));
    expect(a.float()).not.toEqual(b.float());
  });

  it('floats are in [0, 1)', () => {
    const r = createRandom(seedRng('range'));
    for (let i = 0; i < 1000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('int() respects inclusive bounds', () => {
    const r = createRandom(seedRng('int'));
    for (let i = 0; i < 1000; i++) {
      const n = r.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('shuffle is deterministic, a permutation, and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = createRandom(seedRng('s')).shuffle(input);
    const b = createRandom(seedRng('s')).shuffle(input);
    expect(a).toEqual(b);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...a].sort((x, y) => x - y)).toEqual(input);
  });

  it('getState round-trips so a resumed source continues the sequence', () => {
    const r1 = createRandom(seedRng('resume'));
    r1.float();
    r1.float();
    const state = r1.getState();
    const next = r1.float();
    const r2 = createRandom(state);
    expect(r2.float()).toEqual(next);
  });

  it('dice are within [1, sides]', () => {
    const r = createRandom(seedRng('dice'));
    const rolls = r.dice(6, 100);
    expect(rolls).toHaveLength(100);
    for (const d of rolls) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
  });
});
