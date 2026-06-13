import { describe, it, expect } from 'vitest';
import {
  SAVE_SCHEMA_VERSION,
  createMatch,
  deserializeMatch,
  serializeMatch,
  type GameDefinition,
} from '../engine';

const trivial: GameDefinition<{ v: number }> = {
  id: 'trivial',
  name: 'Trivial',
  description: '',
  category: 'board',
  minPlayers: 1,
  maxPlayers: 1,
  setup: () => ({ v: 42 }),
  reducer: (g) => g,
};

describe('serialize', () => {
  it('round-trips a match state', () => {
    const m = createMatch(trivial, { players: [{ id: 'p0', name: 'Solo' }] });
    const json = serializeMatch(m);
    const back = deserializeMatch<{ v: number }>(json);
    expect(back.schema).toBe(SAVE_SCHEMA_VERSION);
    expect(back.state).toEqual(m);
    expect(back.state.game.v).toBe(42);
  });

  it('throws on corrupt JSON', () => {
    expect(() => deserializeMatch('{not json')).toThrow();
  });

  it('throws on a missing schema/state', () => {
    expect(() => deserializeMatch('{"foo":1}')).toThrow();
  });

  it('throws on a newer-than-supported schema', () => {
    const future = JSON.stringify({ schema: SAVE_SCHEMA_VERSION + 1, savedAt: 0, state: {} });
    expect(() => deserializeMatch(future)).toThrow();
  });
});
