/**
 * Deterministic, serializable pseudo-random number generator.
 *
 * Multiplayer and replays require that, given the same seed and the same
 * sequence of draws, every client computes the identical result. We therefore
 * never touch `Math.random()` inside game logic — all randomness flows through
 * a {@link RandomSource} whose entire state is a single uint32 that lives inside
 * the match state and is persisted/synced like any other field.
 *
 * The generator is mulberry32: tiny, fast, and good enough for shuffling cards
 * and rolling dice (it is NOT cryptographically secure — do not use for secrets).
 */

/** The complete internal state of the PRNG (a uint32). */
export type RngState = number;

/** Hash an arbitrary seed (string or number) into a uint32 starting state. */
export function seedRng(seed: string | number): RngState {
  let h = 2166136261 >>> 0; // FNV-1a offset basis
  const str = typeof seed === 'number' ? String(seed) : seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Avoid a zero state, which mulberry32 tolerates but is a poor seed.
  return (h >>> 0) || 0x9e3779b9;
}

/** A read/consume interface over the PRNG. Every call advances the state. */
export interface RandomSource {
  /** Float in [0, 1). */
  float(): number;
  /** Integer in [minInclusive, maxInclusive]. */
  int(minInclusive: number, maxInclusive: number): number;
  /** True with probability `p` (default 0.5). */
  bool(p?: number): boolean;
  /** Pick one element (throws on empty array). */
  pick<T>(arr: readonly T[]): T;
  /** Return a NEW array that is a Fisher–Yates shuffle of `arr` (input untouched). */
  shuffle<T>(arr: readonly T[]): T[];
  /** Roll `count` dice of `sides` faces; returns the individual results. */
  dice(sides: number, count?: number): number[];
  /** The current serializable state — persist this back into the match. */
  getState(): RngState;
}

/** Construct a {@link RandomSource} that resumes from a given state. */
export function createRandom(state: RngState): RandomSource {
  let s = state >>> 0;

  const float = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(float() * (max - min + 1));
  };

  return {
    float,
    int,
    bool: (p = 0.5) => float() < p,
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('pick() on empty array');
      return arr[int(0, arr.length - 1)];
    },
    shuffle<T>(arr: readonly T[]): T[] {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    dice(sides: number, count = 1): number[] {
      const out: number[] = [];
      for (let i = 0; i < count; i++) out.push(int(1, sides));
      return out;
    },
    getState: () => s >>> 0,
  };
}
