import { describe, it, expect } from 'vitest';
import { applyAction, createMatch, type MatchState } from '../engine';
import type { Card } from '../engine/cards';
import { crownRush, type CrownState } from '../games/crown-rush';

const players = [
  { id: 'p0', name: 'Ann' },
  { id: 'p1', name: 'Bo' },
];

const card = (id: string, rank: string): Card => ({
  id,
  rank: rank as Card['rank'],
  suit: 'spades',
  faceUp: true,
  owner: 'p0',
});

describe('Crown Rush', () => {
  it('setup is deterministic for a given seed', () => {
    const a = createMatch(crownRush, { matchId: 'm', seed: 's', players });
    const b = createMatch(crownRush, { matchId: 'm', seed: 's', players });
    expect(a.game).toEqual(b.game);
  });

  it('deals three to each hand, one to discard, rest to stock', () => {
    const m = createMatch(crownRush, { seed: 's', players });
    expect(m.game.hands.p0).toHaveLength(3);
    expect(m.game.hands.p1).toHaveLength(3);
    expect(m.game.discard).toHaveLength(1);
    expect(m.game.draw).toHaveLength(52 - 6 - 1);
  });

  it('enforces draw-then-discard within a turn', () => {
    const m = createMatch(crownRush, { seed: 's', players });
    // Cannot discard before drawing.
    expect(applyAction(crownRush, m, {
      type: 'DISCARD',
      payload: { cardId: m.game.hands.p0[0].id },
    }).ok).toBe(false);

    const drawn = applyAction(crownRush, m, { type: 'DRAW', payload: { from: 'stock' } });
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.state.game.hasDrawn).toBe(true);
    expect(drawn.state.game.hands.p0).toHaveLength(4);

    // Cannot draw twice.
    expect(applyAction(crownRush, drawn.state, { type: 'DRAW', payload: { from: 'stock' } }).ok).toBe(false);

    const discardId = drawn.state.game.hands.p0[0].id;
    const discarded = applyAction(crownRush, drawn.state, {
      type: 'DISCARD',
      payload: { cardId: discardId },
    });
    expect(discarded.ok).toBe(true);
    if (!discarded.ok) return;
    expect(discarded.state.game.hands.p0).toHaveLength(3);
    expect(discarded.state.turn.current).toBe('p1'); // turn passed
    expect(discarded.state.game.hasDrawn).toBe(false);
  });

  it('wins when the hand becomes three of a kind after discarding', () => {
    const base = createMatch(crownRush, { seed: 's', players });
    const crafted: MatchState<CrownState> = {
      ...base,
      game: {
        ...base.game,
        hasDrawn: true,
        hands: {
          ...base.game.hands,
          p0: [card('KS', 'K'), card('KH', 'K'), card('KC', 'K'), card('2D', '2')],
        },
      },
    };
    const r = applyAction(crownRush, crafted, { type: 'DISCARD', payload: { cardId: '2D' } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.status).toBe('finished');
    expect(r.state.result?.winners).toEqual(['p0']);
  });
});
