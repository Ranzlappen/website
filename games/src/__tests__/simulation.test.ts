import { describe, it, expect } from 'vitest';
import {
  applyAction,
  createMatch,
  pickBotAction,
  type GameDefinition,
  type MatchState,
} from '../engine';
import { crownRush } from '../games/crown-rush';
import { lanternHunt } from '../games/lantern-hunt';
import { relicRun } from '../games/relic-run';

const players = [
  { id: 'p0', name: 'Ann', isBot: true },
  { id: 'p1', name: 'Bo', isBot: true },
  { id: 'p2', name: 'Cy', isBot: true },
];

/** Drive a match with bots until it finishes (or the safety cap trips). */
function playOut<G>(
  def: GameDefinition<G>,
  seed: string,
  cap = 3000,
): MatchState<G> {
  let state = createMatch(def, { seed, players });
  for (let i = 0; i < cap && state.status === 'active'; i++) {
    const action = pickBotAction(def, state);
    if (!action) throw new Error(`${def.id}: bot has no legal action at v${state.version}`);
    const r = applyAction(def, state, action);
    if (!r.ok) throw new Error(`${def.id}: bot move rejected: ${r.error}`);
    state = r.state;
  }
  return state;
}

// Full bot-vs-bot games exercise every move, reshuffles, phase flow and the
// win conditions end-to-end — and prove no ruleset can stall the engine.
describe.each([
  ['crown-rush', crownRush as GameDefinition<unknown>],
  ['lantern-hunt', lanternHunt as GameDefinition<unknown>],
  ['relic-run', relicRun as GameDefinition<unknown>],
])('bot simulation: %s', (_id, def) => {
  it.each(['alpha', 'beta', 'gamma'])('plays to completion (seed %s)', (seed) => {
    const finished = playOut(def, seed);
    expect(finished.status).toBe('finished');
    expect(finished.result).not.toBeNull();
  });

  it('is deterministic: same seed ⇒ identical final state', () => {
    const a = playOut(def, 'repeat');
    const b = playOut(def, 'repeat');
    expect(a.game).toEqual(b.game);
    expect(a.version).toBe(b.version);
    expect(a.result).toEqual(b.result);
  });
});
