import { describe, it, expect } from 'vitest';
import { applyAction, createMatch, type MatchState } from '../engine';
import { lanternHunt, legalTargets, type LanternState } from '../games/lantern-hunt';

const players = [
  { id: 'p0', name: 'Ann' },
  { id: 'p1', name: 'Bo' },
];

describe('Lantern Hunt', () => {
  it('requires a roll before moving', () => {
    const m = createMatch(lanternHunt, { seed: 's', players });
    expect(applyAction(lanternHunt, m, { type: 'MOVE', payload: { cell: '0,1' } }).ok).toBe(false);
  });

  it('roll then move advances the turn and clears the die', () => {
    const m = createMatch(lanternHunt, { seed: 's', players });
    const rolled = applyAction(lanternHunt, m, { type: 'ROLL' });
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) return;
    expect(rolled.state.game.die).toBeGreaterThanOrEqual(1);
    expect(rolled.state.game.die).toBeLessThanOrEqual(6);

    // Cannot roll twice.
    expect(applyAction(lanternHunt, rolled.state, { type: 'ROLL' }).ok).toBe(false);

    const targets = legalTargets(rolled.state.game, 'p0');
    expect(targets.length).toBeGreaterThan(0);

    const moved = applyAction(lanternHunt, rolled.state, {
      type: 'MOVE',
      payload: { cell: targets[0] },
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.state.game.die).toBeNull();
    expect(moved.state.turn.current).toBe('p1');
    expect(moved.state.game.positions.p0).toBe(targets[0]);
  });

  it('rejects moving to an unreachable cell', () => {
    const m = createMatch(lanternHunt, { seed: 's', players });
    const rolled = applyAction(lanternHunt, m, { type: 'ROLL' });
    if (!rolled.ok) return;
    expect(applyAction(lanternHunt, rolled.state, { type: 'MOVE', payload: { cell: '6,6' } }).ok).toBe(false);
  });

  it('collecting the third lantern wins', () => {
    const base = createMatch(lanternHunt, { seed: 's', players });
    const crafted: MatchState<LanternState> = {
      ...base,
      game: {
        ...base.game,
        positions: { p0: '0,0', p1: '6,6' },
        lanterns: ['0,1'],
        scores: { p0: 2, p1: 0 },
        die: 1,
      },
    };
    const r = applyAction(lanternHunt, crafted, { type: 'MOVE', payload: { cell: '0,1' } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.status).toBe('finished');
    expect(r.state.result?.winners).toEqual(['p0']);
    expect(r.state.game.scores.p0).toBe(3);
  });
});
