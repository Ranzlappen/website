/**
 * Match lifecycle: creation and the single, deterministic `applyAction`
 * transition that every move — local, hot-seat, AI, or networked — flows
 * through.
 */
import { createRandom, seedRng, type RandomSource } from './rng';
import type {
  ApplyResult,
  FlowEvents,
  GameAction,
  GameDefinition,
  GameResult,
  GameStatus,
  MatchState,
  PlayerId,
  PlayerInfo,
  ReducerContext,
  TurnState,
} from './types';

export interface CreateMatchOptions {
  /** Stable match id; auto-generated if omitted. */
  matchId?: string;
  /** Seed for the deterministic RNG; defaults to the match id. */
  seed?: string | number;
  /** Players, in seating order. */
  players: { id: PlayerId; name: string; isBot?: boolean }[];
  /** Override who acts first (defaults to the first seat). */
  startingPlayer?: PlayerId;
}

function uid(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

function now(): number {
  return Date.now();
}

/** Create a fresh match for the given definition. */
export function createMatch<G>(
  def: GameDefinition<G>,
  opts: CreateMatchOptions,
): MatchState<G> {
  if (opts.players.length < def.minPlayers || opts.players.length > def.maxPlayers) {
    throw new Error(
      `${def.name} supports ${def.minPlayers}–${def.maxPlayers} players, got ${opts.players.length}`,
    );
  }

  const matchId = opts.matchId ?? uid('m');
  const players: PlayerInfo[] = opts.players.map((p, seat) => ({
    id: p.id,
    name: p.name,
    seat,
    isBot: p.isBot,
  }));

  const order = players.map((p) => p.id);
  const first = opts.startingPlayer ?? order[0];
  if (!order.includes(first)) {
    throw new Error(`startingPlayer "${first}" is not a seated player`);
  }

  const turn: TurnState = {
    current: first,
    phase: def.startingPhase ?? 'play',
    turnNumber: 1,
    order,
  };

  const random = createRandom(seedRng(opts.seed ?? matchId));
  const setupCtx = { random, players, turn };
  const game = def.setup(setupCtx);

  return {
    matchId,
    gameId: def.id,
    players,
    status: 'active',
    turn,
    rngState: random.getState(),
    game,
    result: null,
    version: 0,
    updatedAt: now(),
  };
}

/** Build the flow-event recorder + the next-turn resolver. */
function makeFlow() {
  const requests: {
    endTurn?: { next?: PlayerId };
    setPhase?: string;
    endGame?: GameResult;
  } = {};
  const events: FlowEvents = {
    endTurn: (o) => {
      requests.endTurn = o ?? {};
    },
    setPhase: (phase) => {
      requests.setPhase = phase;
    },
    endGame: (result) => {
      requests.endGame = result;
    },
  };
  return { events, requests };
}

/** Compute the seat after `current` in `order`, wrapping around. */
export function nextPlayer(order: PlayerId[], current: PlayerId): PlayerId {
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}

const NOOP_EVENTS: FlowEvents = {
  endTurn: () => {},
  setPhase: () => {},
  endGame: () => {},
};

/** Build a read-only context for inspecting (not mutating) a match state. */
function inspectionContext<G>(state: MatchState<G>): ReducerContext {
  return {
    random: createRandom(state.rngState),
    actor: state.turn.current,
    turn: state.turn,
    players: state.players,
    events: NOOP_EVENTS,
  };
}

/**
 * Ask a game's bot policy for the current player's move, or null if the game
 * defines no AI / chooses to pass. The returned action is applied through the
 * normal `applyAction` path, so match determinism is unaffected.
 */
export function botAction<G>(
  def: GameDefinition<G>,
  state: MatchState<G>,
): GameAction | null {
  if (!def.ai || state.status !== 'active') return null;
  return def.ai(state.game, inspectionContext(state));
}

/** Enumerate the current player's legal actions (for hints / highlighting). */
export function legalActions<G>(
  def: GameDefinition<G>,
  state: MatchState<G>,
): GameAction[] {
  if (!def.enumerate || state.status !== 'active') return [];
  return def.enumerate(state.game, inspectionContext(state));
}

/**
 * Apply an action to a match, returning a brand-new state (the input is never
 * mutated). Illegal actions return `{ ok: false }` with the unchanged state so
 * callers can surface the reason without corrupting the game.
 */
export function applyAction<G>(
  def: GameDefinition<G>,
  state: MatchState<G>,
  rawAction: GameAction,
): ApplyResult<G> {
  if (state.status === 'finished') {
    return { ok: false, error: 'The match is already over.', state };
  }

  const actor = rawAction.playerId ?? state.turn.current;
  const action: GameAction = { ...rawAction, playerId: actor };

  // A fresh RandomSource resumes exactly where the last action left off.
  const random: RandomSource = createRandom(state.rngState);
  const { events, requests } = makeFlow();
  const ctx: ReducerContext = {
    random,
    actor,
    turn: state.turn,
    players: state.players,
    events,
  };

  // Validation is fully delegated to the game.
  if (def.validate) {
    const verdict = def.validate(state.game, action, ctx);
    if (verdict !== true) {
      return {
        ok: false,
        error: typeof verdict === 'string' ? verdict : 'Illegal move.',
        state,
      };
    }
  }

  let nextGame: G;
  try {
    nextGame = def.reducer(state.game, action, ctx);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Reducer threw.',
      state,
    };
  }

  // Resolve flow transitions requested by the reducer.
  let turn: TurnState = { ...state.turn };
  if (requests.setPhase) turn.phase = requests.setPhase;
  if (requests.endTurn) {
    const next = requests.endTurn.next ?? nextPlayer(turn.order, turn.current);
    turn = { ...turn, current: next, turnNumber: turn.turnNumber + 1 };
  }

  let result: GameResult | null = state.result;
  let status: GameStatus = state.status;
  if (requests.endGame) {
    result = requests.endGame;
    status = 'finished';
  } else if (def.endIf) {
    const r = def.endIf(nextGame, { ...ctx, turn });
    if (r) {
      result = r;
      status = 'finished';
    }
  }

  return {
    ok: true,
    action,
    state: {
      ...state,
      game: nextGame,
      turn,
      status,
      result,
      rngState: random.getState(),
      version: state.version + 1,
      updatedAt: now(),
    },
  };
}
