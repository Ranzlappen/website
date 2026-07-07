/**
 * Lantern Hunt — an original 2–4 player board game (demo: board).
 *
 * Race a pawn across a walled 7×7 grid. Each turn you roll a die, then move up
 * to that many orthogonal steps to a highlighted legal cell, scooping up any
 * lantern token you land on. First to collect three lanterns wins; if the board
 * empties first, the highest score takes it.
 *
 * Demonstrates: a grid board, walls, pawns, dice, BFS legal-move highlighting,
 * tokens, blocking by other pieces, scoring, and a win condition.
 */
import {
  Board,
  Dice,
  Rules,
  registerGame,
  type GameAction,
  type GameDefinition,
  type MatchState,
  type PlayerId,
  type ReducerContext,
} from '../engine';

export interface LanternState {
  grid: Board.Grid;
  /** Pawn position per player (cell id). */
  positions: Record<PlayerId, string>;
  /** Cell ids that currently hold a lantern. */
  lanterns: string[];
  scores: Record<PlayerId, number>;
  /** The rolled die awaiting a move, or null when a roll is required. */
  die: number | null;
}

type RollAction = GameAction<'ROLL'>;
type MoveAction = GameAction<'MOVE', { cell: string }>;
export type LanternAction = RollAction | MoveAction;

const SIZE = 7;
const TARGET_LANTERNS = 3;
const NUM_LANTERNS = 6;
// A fixed, symmetric set of interior walls — readable and fair.
const WALLS = ['2,2', '4,2', '2,4', '4,4', '3,3'];
const CORNERS = ['0,0', '6,6', '6,0', '0,6'];

/** Cells a pawn may legally reach with the current die, blocked by other pawns. */
export function legalTargets(
  game: LanternState,
  playerId: PlayerId,
): string[] {
  if (game.die === null) return [];
  const from = Board.parseCell(game.positions[playerId]);
  const blocked = Object.entries(game.positions)
    .filter(([id]) => id !== playerId)
    .map(([, cell]) => cell);
  return Board.reachable(game.grid, from, game.die, { blocked }).map(Board.cellId);
}

export const lanternHunt: GameDefinition<LanternState, LanternAction> = {
  id: 'lantern-hunt',
  name: 'Lantern Hunt',
  description:
    'Roll, move across the grid, and grab lanterns. First to three wins.',
  category: 'board',
  minPlayers: 2,
  maxPlayers: 4,
  tags: ['board', 'dice', 'race'],
  accent: '#52b6d8',
  emoji: '🏮',

  setup(ctx) {
    const grid = Board.makeGrid(SIZE, SIZE, WALLS);
    const positions: Record<PlayerId, string> = {};
    const scores: Record<PlayerId, number> = {};
    ctx.players.forEach((p, i) => {
      positions[p.id] = CORNERS[i];
      scores[p.id] = 0;
    });

    // Scatter lanterns on random passable cells that are neither a wall nor a
    // pawn start, no two on the same cell.
    const occupied = new Set<string>([...WALLS, ...Object.values(positions)]);
    const candidates: string[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const id = Board.cellId({ x, y });
        if (!occupied.has(id)) candidates.push(id);
      }
    }
    const lanterns = ctx.random.shuffle(candidates).slice(0, NUM_LANTERNS);

    return { grid, positions, lanterns, scores, die: null };
  },

  validate(game, action, ctx) {
    const base = Rules.requireCurrentPlayer(ctx);
    if (base !== true) return base;

    if (action.type === 'ROLL') {
      return Rules.check(game.die === null, 'You have already rolled — now move.');
    }
    if (action.type === 'MOVE') {
      if (game.die === null) return 'Roll the die before moving.';
      const targets = legalTargets(game, ctx.actor);
      const cell = action.payload?.cell;
      if (cell === game.positions[ctx.actor]) {
        // Staying put is only allowed when there is nowhere to go.
        return Rules.check(targets.length === 0, 'You must move when you can.');
      }
      return Rules.check(
        !!cell && targets.includes(cell),
        'That cell is out of reach.',
      );
    }
    return 'Unknown action.';
  },

  reducer(game, action, ctx) {
    const me = ctx.actor;

    if (action.type === 'ROLL') {
      return { ...game, die: Dice.d6(ctx.random) };
    }

    // MOVE
    const cell = action.payload!.cell;
    const positions = { ...game.positions, [me]: cell };
    let lanterns = game.lanterns;
    const scores = { ...game.scores };
    if (game.lanterns.includes(cell)) {
      lanterns = game.lanterns.filter((l) => l !== cell);
      scores[me] = (scores[me] ?? 0) + 1;
    }

    const next: LanternState = { ...game, positions, lanterns, scores, die: null };

    if (scores[me] >= TARGET_LANTERNS) {
      ctx.events.endGame({
        status: 'win',
        winners: [me],
        reason: `Collected ${TARGET_LANTERNS} lanterns!`,
        scores,
      });
    } else if (lanterns.length === 0) {
      finishOnEmptyBoard(next, ctx);
    } else {
      ctx.events.endTurn();
    }
    return next;
  },

  enumerate(game, ctx) {
    if (game.die === null) return [{ type: 'ROLL' }];
    const targets = legalTargets(game, ctx.actor);
    if (targets.length === 0)
      return [{ type: 'MOVE', payload: { cell: game.positions[ctx.actor] } }];
    return targets.map((cell) => ({ type: 'MOVE' as const, payload: { cell } }));
  },

  ai(game, ctx) {
    if (game.die === null) return { type: 'ROLL' };
    const targets = legalTargets(game, ctx.actor);
    if (targets.length === 0)
      return { type: 'MOVE', payload: { cell: game.positions[ctx.actor] } };
    // Prefer a cell that lands on a lantern; otherwise step toward the nearest.
    const onLantern = targets.find((t) => game.lanterns.includes(t));
    if (onLantern) return { type: 'MOVE', payload: { cell: onLantern } };
    const nearestLantern = nearest(game.lanterns, Board.parseCell(targets[0]));
    const best = targets
      .map((t) => ({ t, d: Board.manhattan(Board.parseCell(t), nearestLantern) }))
      .sort((a, b) => a.d - b.d)[0];
    return { type: 'MOVE', payload: { cell: best.t } };
  },

  describeAction(action, state: MatchState<LanternState>) {
    const name =
      state.players.find((p) => p.id === action.playerId)?.name ?? 'Someone';
    if (action.type === 'ROLL') return `${name} rolled the die.`;
    if (action.type === 'MOVE') return `${name} moved their pawn.`;
    return '';
  },
};

function finishOnEmptyBoard(game: LanternState, ctx: ReducerContext) {
  const entries = Object.entries(game.scores);
  const top = Math.max(...entries.map(([, s]) => s));
  const winners = entries.filter(([, s]) => s === top).map(([id]) => id);
  ctx.events.endGame(
    winners.length === 1
      ? { status: 'win', winners, reason: 'Most lanterns collected.', scores: game.scores }
      : { status: 'draw', reason: 'Tied on lanterns.', scores: game.scores },
  );
}

function nearest(cells: string[], from: Board.Coord): Board.Coord {
  let best = from;
  let bestD = Infinity;
  for (const c of cells) {
    const coord = Board.parseCell(c);
    const d = Board.manhattan(coord, from);
    if (d < bestD) {
      bestD = d;
      best = coord;
    }
  }
  return best;
}

registerGame(lanternHunt);
