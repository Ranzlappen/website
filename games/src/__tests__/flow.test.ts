import { describe, it, expect } from 'vitest';
import {
  applyAction,
  createMatch,
  defineGame,
  legalActions,
  redactFor,
  Zones,
  type MatchState,
} from '../engine';

/** A tiny two-phase game exercising every knob of the declarative layer. */
interface DemoState {
  n: number;
  /** Turn-begin upkeep counter. */
  upkeeps: number;
  zones: Zones.ZoneMap;
}

const demo = defineGame<DemoState>({
  id: 'flow-demo',
  name: 'Flow Demo',
  description: 'test game',
  category: 'board',
  minPlayers: 2,
  maxPlayers: 2,
  startingPhase: 'play',

  setup: (ctx) => ({
    n: 0,
    upkeeps: 0,
    zones: Zones.makeZones(
      Zones.makeZone('secret', 'hidden', [{ id: 'c1', rank: 'A', suit: 'spades' }]),
      ...ctx.players.map((p) =>
        Zones.makeZone(Zones.zoneId('hand', p.id), 'owner', [{ id: `h-${p.id}`, rank: 'K', suit: 'hearts' }], p.id),
      ),
    ),
  }),

  moves: {
    ADD: {
      phase: 'play',
      validate: (_g, payload: { amount: number }) =>
        payload?.amount > 0 || 'Amount must be positive.',
      apply: (g, payload: { amount: number }) => ({ ...g, n: g.n + payload.amount }),
      enumerate: () => [{ amount: 1 }, { amount: 2 }, { amount: -1 }],
      endsTurn: (_g, payload: { amount: number }) => payload.amount === 2,
      describe: (payload: { amount: number }, name) => `${name} added ${payload.amount}.`,
    },
    LOCK: {
      phase: 'play',
      apply: (g) => g,
      nextPhase: 'locked',
      endsTurn: true,
    },
    UNLOCK: {
      phase: 'locked',
      anyPlayer: true,
      apply: (g) => g,
      nextPhase: 'play',
    },
  },

  onTurnBegin: (g) => ({ ...g, upkeeps: g.upkeeps + 1 }),

  endIf: (g) =>
    g.n >= 5 ? { status: 'win', winners: [], reason: 'Reached 5.' } : null,
});

const players = [
  { id: 'p0', name: 'Ann' },
  { id: 'p1', name: 'Bo' },
];

const fresh = () => createMatch(demo, { seed: 's', players });

describe('defineGame: validation gates', () => {
  it('rejects unknown actions', () => {
    const r = applyAction(demo, fresh(), { type: 'NOPE' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unknown action/);
  });

  it('rejects moves outside their phase, naming the phase', () => {
    const r = applyAction(demo, fresh(), { type: 'UNLOCK' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/"locked" phase/);
  });

  it('rejects non-current players unless the move opts in via anyPlayer', () => {
    const offTurn = applyAction(demo, fresh(), {
      type: 'ADD',
      payload: { amount: 1 },
      playerId: 'p1',
    });
    expect(offTurn.ok).toBe(false);

    const locked = applyAction(demo, fresh(), { type: 'LOCK' });
    if (!locked.ok) throw new Error(locked.error);
    // LOCK ended the turn, so p1 is current — but UNLOCK allows anyone.
    const r = applyAction(demo, locked.state, { type: 'UNLOCK', playerId: 'p0' });
    expect(r.ok).toBe(true);
  });

  it('runs the move-level validate after the gates', () => {
    const r = applyAction(demo, fresh(), { type: 'ADD', payload: { amount: -1 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('Amount must be positive.');
  });
});

describe('defineGame: declared flow transitions', () => {
  it('applies nextPhase after the move', () => {
    const r = applyAction(demo, fresh(), { type: 'LOCK' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.turn.phase).toBe('locked');
  });

  it('honours computed endsTurn', () => {
    const stay = applyAction(demo, fresh(), { type: 'ADD', payload: { amount: 1 } });
    if (!stay.ok) throw new Error(stay.error);
    expect(stay.state.turn.current).toBe('p0');

    const pass = applyAction(demo, stay.state, { type: 'ADD', payload: { amount: 2 } });
    if (!pass.ok) throw new Error(pass.error);
    expect(pass.state.turn.current).toBe('p1');
  });

  it('runs onTurnBegin upkeep exactly when the turn changes', () => {
    const stay = applyAction(demo, fresh(), { type: 'ADD', payload: { amount: 1 } });
    if (!stay.ok) throw new Error(stay.error);
    expect(stay.state.game.upkeeps).toBe(0);

    const pass = applyAction(demo, stay.state, { type: 'ADD', payload: { amount: 2 } });
    if (!pass.ok) throw new Error(pass.error);
    expect(pass.state.game.upkeeps).toBe(1);
  });

  it('still ends the game via endIf', () => {
    const a = applyAction(demo, fresh(), { type: 'ADD', payload: { amount: 1 } });
    if (!a.ok) throw new Error(a.error);
    const b = applyAction(demo, a.state, { type: 'ADD', payload: { amount: 1 } });
    if (!b.ok) throw new Error(b.error);
    const c = applyAction(demo, b.state, { type: 'ADD', payload: { amount: 1 } });
    if (!c.ok) throw new Error(c.error);
    const d = applyAction(demo, c.state, { type: 'ADD', payload: { amount: 1 } });
    if (!d.ok) throw new Error(d.error);
    const e = applyAction(demo, d.state, { type: 'ADD', payload: { amount: 1 } });
    if (!e.ok) throw new Error(e.error);
    expect(e.state.status).toBe('finished');
    expect(e.state.result?.reason).toBe('Reached 5.');
  });
});

describe('defineGame: synthesized enumerate + describe', () => {
  it('enumerates only phase-legal, validated candidates', () => {
    const actions = legalActions(demo, fresh());
    // ADD(-1) filtered by validate; UNLOCK filtered by phase; LOCK is bare.
    expect(actions).toEqual([
      { type: 'ADD', payload: { amount: 1 } },
      { type: 'ADD', payload: { amount: 2 } },
      { type: 'LOCK' },
    ]);
  });

  it('describes actions with the player name resolved', () => {
    const m = fresh();
    const line = demo.describeAction!(
      { type: 'ADD', payload: { amount: 2 }, playerId: 'p0' },
      m as MatchState<DemoState>,
    );
    expect(line).toBe('Ann added 2.');
    // Moves without describe fall back to an empty line.
    expect(demo.describeAction!({ type: 'LOCK', playerId: 'p0' }, m)).toBe('');
  });
});

describe('defineGame: automatic zone redaction', () => {
  it('redacts zones by visibility when no redact hook is given', () => {
    const m = fresh();
    const view = redactFor(demo, m, 'p0');
    const zones = (view.game as DemoState).zones;
    expect(Zones.cardsIn(zones, 'hand:p0')[0].rank).toBe('K'); // own hand intact
    expect(Zones.cardsIn(zones, 'hand:p1')[0].rank).toBeUndefined(); // stubbed
    expect(Zones.cardsIn(zones, 'secret')[0].rank).toBeUndefined(); // hidden
    // Non-zone fields untouched.
    expect((view.game as DemoState).n).toBe(0);
  });
});
