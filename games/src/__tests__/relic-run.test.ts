import { describe, it, expect } from 'vitest';
import { applyAction, createMatch, Zones, type MatchState } from '../engine';
import { handZone, relicRun, type RelicState } from '../games/relic-run';

const players = [
  { id: 'p0', name: 'Ann' },
  { id: 'p1', name: 'Bo' },
];

describe('Relic Run', () => {
  it('starts in the roll phase and rolling moves + switches to action', () => {
    const m = createMatch(relicRun, { seed: 's', players });
    expect(m.turn.phase).toBe('roll');
    const r = applyAction(relicRun, m, { type: 'ROLL' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.game.die).toBeGreaterThanOrEqual(1);
    expect(r.state.turn.phase).toBe('action');
    expect(r.state.game.positions.p0).toBe(r.state.game.die);
  });

  it('cannot roll during the action phase', () => {
    const base = createMatch(relicRun, { seed: 's', players });
    const crafted: MatchState<RelicState> = { ...base, turn: { ...base.turn, phase: 'action' } };
    expect(applyAction(relicRun, crafted, { type: 'ROLL' }).ok).toBe(false);
  });

  it('passing ends the turn and returns to the roll phase', () => {
    const base = createMatch(relicRun, { seed: 's', players });
    const crafted: MatchState<RelicState> = { ...base, turn: { ...base.turn, phase: 'action' } };
    const r = applyAction(relicRun, crafted, { type: 'PASS' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.turn.current).toBe('p1');
    expect(r.state.turn.phase).toBe('roll');
  });

  it('a Ward card banks a relic and the fourth relic wins', () => {
    const base = createMatch(relicRun, { seed: 's', players });
    const crafted: MatchState<RelicState> = {
      ...base,
      turn: { ...base.turn, phase: 'action' },
      game: {
        ...base.game,
        relics: { p0: 3, p1: 0 },
        zones: Zones.setCards(base.game.zones, handZone('p0'), [
          { id: 'w1', kind: 'ward', faceUp: true },
        ]),
      },
    };
    const r = applyAction(relicRun, crafted, { type: 'PLAY', payload: { cardId: 'w1' } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.game.relics.p0).toBe(4);
    expect(r.state.status).toBe('finished');
    expect(r.state.result?.winners).toEqual(['p0']);
  });
});
