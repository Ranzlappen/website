import { describe, it, expect } from 'vitest';
import {
  createMatch,
  pickBotAction,
  redactFor,
  Rules,
  type GameDefinition,
} from '../engine';
import { crownRush, type CrownState } from '../games/crown-rush';

// A game whose `ai` deliberately returns an illegal move, to prove the
// fallback to a legal action.
const buggy: GameDefinition<{ n: number }> = {
  id: 'buggy-ai',
  name: 'Buggy',
  description: '',
  category: 'board',
  minPlayers: 2,
  maxPlayers: 2,
  setup: () => ({ n: 0 }),
  validate: (_g, a, ctx) =>
    a.type === 'INC' ? Rules.requireCurrentPlayer(ctx) : 'Unknown action.',
  reducer: (g, _a, ctx) => {
    ctx.events.endTurn();
    return { n: g.n + 1 };
  },
  enumerate: () => [{ type: 'INC' }],
  ai: () => ({ type: 'TOTALLY_ILLEGAL' }),
};

const players = [
  { id: 'p0', name: 'Ann' },
  { id: 'p1', name: 'Bo' },
];

describe('pickBotAction', () => {
  it('falls back to a legal action when ai() returns an illegal one', () => {
    const m = createMatch(buggy, { players });
    const action = pickBotAction(buggy, m);
    expect(action).toEqual({ type: 'INC' });
  });

  it('returns null on a finished match', () => {
    const m = createMatch(buggy, { players });
    const finished = { ...m, status: 'finished' as const };
    expect(pickBotAction(buggy, finished)).toBeNull();
  });
});

describe('redactFor', () => {
  it('hides opponents’ hands and the stock but keeps your own hand', () => {
    const m = createMatch(crownRush, { seed: 's', players });
    const view = redactFor(crownRush, m, 'p0');
    const g = view.game as CrownState;

    // Your own hand is intact.
    expect(g.hands.p0).toEqual((m.game as CrownState).hands.p0);
    // Opponent's hand is anonymized + face-down, same count.
    expect(g.hands.p1).toHaveLength(3);
    expect(g.hands.p1.every((c) => c.faceUp === false && c.rank === undefined)).toBe(true);
    // The stock is hidden too.
    expect(g.draw.every((c) => c.rank === undefined)).toBe(true);
    // The public discard is unchanged.
    expect(g.discard).toEqual((m.game as CrownState).discard);
  });

  it('is a no-op for a game without a redact hook', () => {
    const def: GameDefinition<{ x: number }> = {
      id: 'no-redact',
      name: 'NR',
      description: '',
      category: 'board',
      minPlayers: 1,
      maxPlayers: 1,
      setup: () => ({ x: 1 }),
      reducer: (s) => s,
    };
    const m = createMatch(def, { players: [{ id: 'p0', name: 'Solo' }] });
    expect(redactFor(def, m, 'p0')).toBe(m);
  });
});
