import { describe, it, expect } from 'vitest';
import {
  applyAction,
  createMatch,
  legalActions,
  botAction,
  type GameDefinition,
} from '../engine';
import { Rules } from '../engine';

// A minimal two-player game for exercising the engine in isolation.
interface CountState {
  n: number;
}
const counter: GameDefinition<CountState> = {
  id: 'test-counter',
  name: 'Counter',
  description: 'Increment to win.',
  category: 'board',
  minPlayers: 2,
  maxPlayers: 2,
  setup: () => ({ n: 0 }),
  validate: (_g, a, ctx) =>
    a.type === 'INC' ? Rules.requireCurrentPlayer(ctx) : 'Unknown action.',
  reducer: (g, _a, ctx) => {
    const n = g.n + 1;
    if (n >= 3) ctx.events.endGame({ status: 'win', winners: [ctx.actor] });
    else ctx.events.endTurn();
    return { n };
  },
  enumerate: () => [{ type: 'INC' }],
  ai: () => ({ type: 'INC' }),
};

const players = [
  { id: 'p0', name: 'Ann' },
  { id: 'p1', name: 'Bo' },
];

describe('createMatch', () => {
  it('initialises engine-managed fields', () => {
    const m = createMatch(counter, { matchId: 'm1', players });
    expect(m.status).toBe('active');
    expect(m.turn.current).toBe('p0');
    expect(m.turn.turnNumber).toBe(1);
    expect(m.version).toBe(0);
    expect(m.players[1].seat).toBe(1);
    expect(m.game.n).toBe(0);
  });

  it('rejects an out-of-range player count', () => {
    expect(() => createMatch(counter, { players: [players[0]] })).toThrow();
  });
});

describe('applyAction', () => {
  it('applies a legal action, advances the turn, and bumps the version', () => {
    const m = createMatch(counter, { players });
    const r = applyAction(counter, m, { type: 'INC' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.game.n).toBe(1);
    expect(r.state.turn.current).toBe('p1');
    expect(r.state.turn.turnNumber).toBe(2);
    expect(r.state.version).toBe(1);
    expect(m.game.n).toBe(0); // input untouched
  });

  it('rejects an action taken out of turn without mutating state', () => {
    const m = createMatch(counter, { players });
    const r = applyAction(counter, m, { type: 'INC', playerId: 'p1' });
    expect(r.ok).toBe(false);
    expect(r.state.version).toBe(0);
  });

  it('rejects unknown actions', () => {
    const m = createMatch(counter, { players });
    const r = applyAction(counter, m, { type: 'NOPE' });
    expect(r.ok).toBe(false);
  });

  it('reaches a terminal win state and then refuses further actions', () => {
    let m = createMatch(counter, { players });
    for (let i = 0; i < 3; i++) {
      const r = applyAction(counter, m, { type: 'INC' });
      expect(r.ok).toBe(true);
      if (r.ok) m = r.state;
    }
    expect(m.status).toBe('finished');
    expect(m.result?.status).toBe('win');
    // p0 acted on turns 1 and 3 -> p0 wins.
    expect(m.result?.winners).toEqual(['p0']);

    const after = applyAction(counter, m, { type: 'INC' });
    expect(after.ok).toBe(false);
  });
});

describe('helpers', () => {
  it('legalActions / botAction read through enumerate / ai', () => {
    const m = createMatch(counter, { players });
    expect(legalActions(counter, m)).toEqual([{ type: 'INC' }]);
    expect(botAction(counter, m)).toEqual({ type: 'INC' });
  });
});
