/**
 * Declarative ruleset layer — `defineGame` compiles a spec of **moves** and
 * **phases** into a plain {@link GameDefinition}, so authoring a new game means
 * describing its rules, not wiring reducer plumbing.
 *
 * Instead of one monolithic `validate` + `reducer` switch, a game declares a
 * map of named moves. Each move states *where* it is legal (`phase`), *when*
 * (`validate`), *what it does* (`apply`), *what follows* (`nextPhase`,
 * `endsTurn`) and *which options exist* (`enumerate`). From that, the compiler
 * synthesizes:
 *
 *   - `validate`   — actor + phase gates, then the move's own guard;
 *   - `reducer`    — dispatch to the move's `apply`, then request the declared
 *                    flow transitions;
 *   - `enumerate`  — every declared candidate of every phase-legal move,
 *                    filtered through validation, so hints/AI are always
 *                    consistent with the rules;
 *   - `describeAction` — per-move log lines with player names resolved;
 *   - `redact`     — automatic zone-based redaction when the game state carries
 *                    a `zones` property (see {@link redactZones}).
 *
 * The output is an ordinary GameDefinition: `applyAction`, networking, storage
 * and the server arbiter need no knowledge of this layer. Games with rules the
 * spec can't express can still hand-write a GameDefinition directly.
 */
import type {
  GameAction,
  GameDefinition,
  GameResult,
  MatchState,
  PlayerId,
  ReducerContext,
  SetupContext,
} from './types';
import type { Verdict } from './rules';
import { requireCurrentPlayer } from './rules';
import { redactZones, type ZoneMap } from './zones';

/** A single named move — the unit of rules in a declarative game. */
export interface MoveDef<G, P = unknown> {
  /** Phase(s) in which the move is legal. Omit to allow it in every phase. */
  phase?: string | readonly string[];
  /** Allow players other than the current one to act (default: current only). */
  anyPlayer?: boolean;
  /** Extra legality guard, checked after the actor and phase gates. */
  validate?(game: G, payload: P, ctx: ReducerContext): Verdict;
  /** Pure state transition. May still call `ctx.events.*` for dynamic flow. */
  apply(game: G, payload: P, ctx: ReducerContext): G;
  /**
   * Candidate payloads for hints / highlighting / bots. Moves without payload
   * need no enumerate — they contribute a single bare action automatically.
   * Every candidate is re-checked against validation before being offered.
   */
  enumerate?(game: G, ctx: ReducerContext): P[];
  /** Phase to enter after the move resolves (static or computed). */
  nextPhase?: string | ((game: G, payload: P, ctx: ReducerContext) => string);
  /** Whether the move ends the turn (static or computed; default false). */
  endsTurn?: boolean | ((game: G, payload: P, ctx: ReducerContext) => boolean);
  /** Log line for the event log; `name` is the acting player's display name. */
  describe?(payload: P, name: string): string;
}

/**
 * The declarative description `defineGame` compiles. Each move annotates its
 * own payload parameter; `any` in the default lets those signatures vary per
 * move while the map stays uniformly typed (same pattern as the registry).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GameSpec<G, M = Record<string, MoveDef<G, any>>> {
  id: string;
  name: string;
  description: string;
  category: 'card' | 'board' | 'hybrid';
  minPlayers: number;
  maxPlayers: number;
  tags?: string[];
  accent?: string;
  emoji?: string;

  /** Phase the match starts in (default `'play'`). */
  startingPhase?: string;

  /** Build the initial game-specific state. */
  setup(ctx: SetupContext): G;

  /** The ruleset: every legal move, by action type. */
  moves: M;

  /** End-of-game check, run after every move. */
  endIf?(game: G, ctx: ReducerContext): GameResult | null | undefined;

  /** Bot policy. Omit it and bots fall back to the first enumerated action. */
  ai?(game: G, ctx: ReducerContext): GameAction | null;

  /** Upkeep applied when a new player's turn begins (reset flags, draw, …). */
  onTurnBegin?(game: G, ctx: ReducerContext): G;

  /**
   * Per-viewer redaction override. When omitted and the game state has a
   * `zones` property, zone visibilities drive redaction automatically.
   */
  redact?(game: G, viewerId: PlayerId): G;
}

function phaseAllows(phase: MoveDef<never>['phase'], current: string): boolean {
  if (phase === undefined) return true;
  return typeof phase === 'string' ? phase === current : phase.includes(current);
}

function phaseLabel(phase: string | readonly string[]): string {
  return typeof phase === 'string' ? phase : phase.join('" or "');
}

/** Zone-based auto-redaction for game states shaped `{ zones: ZoneMap, ... }`. */
function autoRedact<G>(game: G, viewerId: PlayerId): G {
  const zones = (game as { zones?: unknown }).zones;
  if (!zones || typeof zones !== 'object') return game;
  return { ...game, zones: redactZones(zones as ZoneMap, viewerId) };
}

/** Compile a declarative {@link GameSpec} into a plain {@link GameDefinition}. */
export function defineGame<G>(spec: GameSpec<G>): GameDefinition<G> {
  // Erase the per-move payload types for the uniform dispatch below.
  const moves = spec.moves as Record<string, MoveDef<G, unknown>>;

  const validate = (game: G, action: GameAction, ctx: ReducerContext): Verdict => {
    const move = moves[action.type];
    if (!move) return `Unknown action "${action.type}".`;
    if (!move.anyPlayer) {
      const turn = requireCurrentPlayer(ctx);
      if (turn !== true) return turn;
    }
    if (!phaseAllows(move.phase, ctx.turn.phase)) {
      return `This action is only allowed during the "${phaseLabel(move.phase!)}" phase.`;
    }
    return move.validate ? move.validate(game, action.payload, ctx) : true;
  };

  const reducer = (game: G, action: GameAction, ctx: ReducerContext): G => {
    const move = moves[action.type];
    if (!move) throw new Error(`Unknown action "${action.type}".`);
    const next = move.apply(game, action.payload, ctx);
    if (move.nextPhase !== undefined) {
      ctx.events.setPhase(
        typeof move.nextPhase === 'function'
          ? move.nextPhase(next, action.payload, ctx)
          : move.nextPhase,
      );
    }
    const ends =
      typeof move.endsTurn === 'function'
        ? move.endsTurn(next, action.payload, ctx)
        : (move.endsTurn ?? false);
    if (ends) ctx.events.endTurn();
    return next;
  };

  const enumerate = (game: G, ctx: ReducerContext): GameAction[] => {
    const out: GameAction[] = [];
    for (const [type, move] of Object.entries(moves)) {
      if (!phaseAllows(move.phase, ctx.turn.phase)) continue;
      const candidates: GameAction[] = move.enumerate
        ? move.enumerate(game, ctx).map((payload) => ({ type, payload }))
        : [{ type }];
      for (const action of candidates) {
        if (validate(game, { ...action, playerId: ctx.actor }, ctx) === true) {
          out.push(action);
        }
      }
    }
    return out;
  };

  const describeAction = (action: GameAction, state: MatchState<G>): string => {
    const move = moves[action.type];
    if (!move?.describe) return '';
    const name =
      state.players.find((p) => p.id === action.playerId)?.name ?? 'Someone';
    return move.describe(action.payload, name);
  };

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    minPlayers: spec.minPlayers,
    maxPlayers: spec.maxPlayers,
    tags: spec.tags,
    accent: spec.accent,
    emoji: spec.emoji,
    startingPhase: spec.startingPhase,
    setup: spec.setup,
    validate,
    reducer,
    enumerate,
    describeAction,
    endIf: spec.endIf,
    ai: spec.ai,
    onTurnBegin: spec.onTurnBegin,
    redact: spec.redact ?? autoRedact,
  };
}
