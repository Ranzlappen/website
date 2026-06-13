/**
 * Core engine type model.
 *
 * The engine deliberately keeps two things apart:
 *   - **engine-managed state** (players, turn, phase, rng, status, result) — the
 *     same for every game, owned by the engine; and
 *   - **game-specific state** `G` — owned entirely by a {@link GameDefinition}.
 *
 * A game's `reducer` only ever touches `G`. Turn/phase/end-of-game transitions
 * are *requested* through {@link FlowEvents} and applied by the engine after the
 * reducer returns, so generic flow logic never leaks into game code and vice
 * versa. Everything here is plain JSON so a {@link MatchState} serializes
 * cleanly for save/load and network sync.
 */
import type { RngState } from './rng';

export type PlayerId = string;

/** A seat at the table. */
export interface PlayerInfo {
  id: PlayerId;
  name: string;
  /** 0-based seat index, stable for the life of the match. */
  seat: number;
  isBot?: boolean;
}

export type GameStatus = 'active' | 'finished';

/** Outcome of a finished match. */
export interface GameResult {
  status: 'win' | 'draw';
  /** Winning player ids (omitted/empty for a draw). */
  winners?: PlayerId[];
  /** Human-readable explanation, e.g. "collected three Kings". */
  reason?: string;
  /** Optional final scores. */
  scores?: Record<PlayerId, number>;
}

/** Engine-owned turn/phase bookkeeping. */
export interface TurnState {
  /** Whose turn it currently is. */
  current: PlayerId;
  /** Current phase id (games define their own phase names). */
  phase: string;
  /** Increments by one every time the active player changes. */
  turnNumber: number;
  /** The turn order (a permutation of the player ids). */
  order: PlayerId[];
}

/** The complete, serializable state of a match. */
export interface MatchState<G = unknown> {
  matchId: string;
  gameId: string;
  players: PlayerInfo[];
  status: GameStatus;
  turn: TurnState;
  /** Serializable PRNG state — see {@link RngState}. */
  rngState: RngState;
  /** Game-specific state owned by the {@link GameDefinition}. */
  game: G;
  result: GameResult | null;
  /** Monotonic counter, +1 per applied action. Used to reject stale syncs. */
  version: number;
  /** Epoch ms of the last applied action. */
  updatedAt: number;
}

/** An action a player takes. `type` is game-defined. */
export interface GameAction<T extends string = string, P = unknown> {
  type: T;
  payload?: P;
  /** The actor. If omitted, the engine fills in the current player. */
  playerId?: PlayerId;
}

/** Flow transitions a reducer may request; applied by the engine afterwards. */
export interface FlowEvents {
  /** End the current turn and advance to the next player (or `next`). */
  endTurn(opts?: { next?: PlayerId }): void;
  /** Change the current phase. */
  setPhase(phase: string): void;
  /** Immediately finish the match with the given result. */
  endGame(result: GameResult): void;
}

/** Read-only context handed to a reducer/validator. */
export interface ReducerContext {
  random: import('./rng').RandomSource;
  /** The player performing this action. */
  actor: PlayerId;
  turn: Readonly<TurnState>;
  players: readonly PlayerInfo[];
  events: FlowEvents;
}

/** Context handed to `setup` when a match is created. */
export interface SetupContext {
  random: import('./rng').RandomSource;
  players: readonly PlayerInfo[];
  turn: Readonly<TurnState>;
}

/**
 * The full description of a game. Register one of these to make a game
 * playable; the engine needs nothing else.
 */
export interface GameDefinition<
  G = unknown,
  A extends GameAction = GameAction,
> {
  id: string;
  name: string;
  description: string;
  category: 'card' | 'board' | 'hybrid';
  minPlayers: number;
  maxPlayers: number;
  tags?: string[];
  /** Optional accent colour / emoji used by the gallery card. */
  accent?: string;
  emoji?: string;

  /** Phase the match starts in (default `'play'`). */
  startingPhase?: string;

  /** Build the initial game-specific state. */
  setup(ctx: SetupContext): G;

  /** Pure transition: return the next game state. May call `ctx.events.*`. */
  reducer(game: G, action: A, ctx: ReducerContext): G;

  /** Optional guard: `true` if legal, or a string reason if not. */
  validate?(game: G, action: A, ctx: ReducerContext): boolean | string;

  /** Optional enumerator of legal actions — powers hints, highlights and AI. */
  enumerate?(game: G, ctx: ReducerContext): A[];

  /** Optional end-of-game check, run after every action. */
  endIf?(game: G, ctx: ReducerContext): GameResult | null | undefined;

  /** Optional bot policy for solo play (returns an action or null to pass). */
  ai?(game: G, ctx: ReducerContext): A | null;

  /** Optional human-readable description of an action for the event log. */
  describeAction?(action: A, state: MatchState<G>): string;
}

/** Result of applying an action. On failure the original state is returned. */
export type ApplyResult<G> =
  | { ok: true; state: MatchState<G>; action: GameAction }
  | { ok: false; error: string; state: MatchState<G> };
