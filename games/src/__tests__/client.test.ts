import { describe, it, expect } from 'vitest';
import { MatchClient, createMatch, type GameDefinition } from '../engine';

interface S {
  n: number;
}
const def: GameDefinition<S> = {
  id: 'client-test',
  name: 'Client Test',
  description: '',
  category: 'board',
  minPlayers: 1,
  maxPlayers: 1,
  setup: () => ({ n: 0 }),
  reducer: (g) => ({ n: g.n + 1 }),
};

function newClient() {
  const state = createMatch(def, { players: [{ id: 'p0', name: 'Solo' }] });
  return new MatchClient(def, state);
}

describe('MatchClient', () => {
  it('dispatches and notifies subscribers', () => {
    const c = newClient();
    let calls = 0;
    const unsub = c.subscribe(() => calls++);
    c.dispatch({ type: 'TICK' });
    expect(c.getState().game.n).toBe(1);
    expect(calls).toBe(1);
    unsub();
  });

  it('undo / redo walk the history', () => {
    const c = newClient();
    c.dispatch({ type: 'TICK' });
    c.dispatch({ type: 'TICK' });
    expect(c.getState().game.n).toBe(2);
    expect(c.canUndo).toBe(true);

    expect(c.undo()).toBe(true);
    expect(c.getState().game.n).toBe(1);
    expect(c.canRedo).toBe(true);

    expect(c.redo()).toBe(true);
    expect(c.getState().game.n).toBe(2);

    // A new action clears the redo stack.
    c.undo();
    c.dispatch({ type: 'TICK' });
    expect(c.canRedo).toBe(false);
  });

  it('replaceState ignores stale (older-version) snapshots', () => {
    const c = newClient();
    c.dispatch({ type: 'TICK' });
    c.dispatch({ type: 'TICK' });
    const current = c.getState();

    const stale = { ...current, version: 0, game: { n: 99 } };
    expect(c.replaceState(stale)).toBe(false);
    expect(c.getState().game.n).toBe(2);

    const fresh = { ...current, version: current.version + 1, game: { n: 7 } };
    expect(c.replaceState(fresh)).toBe(true);
    expect(c.getState().game.n).toBe(7);
    // Remote snapshots clear local history.
    expect(c.canUndo).toBe(false);
  });
});
