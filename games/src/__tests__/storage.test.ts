import { describe, it, expect, beforeEach } from 'vitest';
import { createMatch, type GameDefinition } from '../engine';
import { MAX_SAVES, deleteSave, listSaves, loadMatch, saveMatch } from '../storage/local';

const def: GameDefinition<{ v: number }> = {
  id: 'save-test',
  name: 'Save Test',
  description: '',
  category: 'board',
  minPlayers: 1,
  maxPlayers: 1,
  setup: () => ({ v: 1 }),
  reducer: (g) => g,
};

const make = (id: string) =>
  createMatch(def, { matchId: id, players: [{ id: 'p0', name: 'Solo' }] });

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('saves, loads, lists and deletes a match', () => {
    const state = make('m1');
    saveMatch(state);
    expect(loadMatch('m1')).toEqual(state);
    expect(listSaves().map((s) => s.matchId)).toContain('m1');

    deleteSave('m1');
    expect(loadMatch('m1')).toBeNull();
    expect(listSaves()).toHaveLength(0);
  });

  it('returns null for a missing save', () => {
    expect(loadMatch('nope')).toBeNull();
  });

  it('caps the number of saves and prunes the oldest', () => {
    for (let i = 0; i < MAX_SAVES + 5; i++) saveMatch(make(`m${i}`));
    const saves = listSaves();
    expect(saves).toHaveLength(MAX_SAVES);
    // The most recent is first; the oldest few were pruned.
    expect(saves[0].matchId).toBe(`m${MAX_SAVES + 4}`);
    expect(loadMatch('m0')).toBeNull();
  });
});
