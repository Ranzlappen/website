/**
 * Rules / legality helpers — small, composable validators that games combine in
 * their `validate` hook. Each returns `true` when the condition holds or a
 * human-readable reason string when it fails, matching the shape the engine
 * expects from {@link GameDefinition.validate}.
 */
import type { ReducerContext } from './types';

export type Verdict = true | string;

/** Combine several verdicts; the first failure wins. */
export function all(...verdicts: Verdict[]): Verdict {
  for (const v of verdicts) if (v !== true) return v;
  return true;
}

/** The actor must be the player whose turn it is. */
export function requireCurrentPlayer(ctx: ReducerContext): Verdict {
  return ctx.actor === ctx.turn.current
    ? true
    : 'It is not your turn.';
}

/** The match must be in a specific phase. */
export function requirePhase(ctx: ReducerContext, phase: string): Verdict {
  return ctx.turn.phase === phase
    ? true
    : `This action is only allowed during the "${phase}" phase.`;
}

/** Generic boolean guard with a custom message. */
export function require(condition: boolean, reason: string): Verdict {
  return condition ? true : reason;
}
