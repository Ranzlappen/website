/**
 * Dice subsystem. Thin, deterministic wrappers over a {@link RandomSource} so
 * dice rolls replay identically and stay in sync across the network.
 */
import type { RandomSource } from './rng';

export interface RollResult {
  /** Individual die results. */
  dice: number[];
  /** Sum of all dice. */
  total: number;
}

/** Roll `count` dice of `sides` faces. */
export function roll(
  random: RandomSource,
  sides = 6,
  count = 1,
): RollResult {
  const dice = random.dice(sides, count);
  return { dice, total: dice.reduce((a, b) => a + b, 0) };
}

/** Roll a single d6. */
export function d6(random: RandomSource): number {
  return random.int(1, 6);
}
