/**
 * Relic Run — an original 2–4 player hybrid game (demo: cards + board + tokens).
 *
 * Roll and move around a 12-cell loop. Landing on a relic cell banks a relic
 * token; landing on a card cell draws a hidden action card. Each turn ends with
 * an optional action card: Leap (jump ahead), Ward (a free relic), or Steal
 * (take a relic from the leader). First to four relics wins.
 *
 * Demonstrates: a looping track, dice, a hidden hand of action cards, public
 * relic tokens, a two-phase turn (roll → action), private/shared state, and a
 * win condition — i.e. cards + board + tokens working together.
 */
import {
  Dice,
  Rules,
  registerGame,
  type GameAction,
  type GameDefinition,
  type MatchState,
  type PlayerId,
  type RandomSource,
} from '../engine';

export type CellKind = 'relic' | 'card' | 'empty';
export type CardKind = 'leap' | 'ward' | 'steal';

export interface ActionCard {
  id: string;
  kind: CardKind;
}

export interface RelicState {
  /** Type of each cell on the loop track. */
  track: CellKind[];
  positions: Record<PlayerId, number>;
  relics: Record<PlayerId, number>;
  hands: Record<PlayerId, ActionCard[]>;
  deck: ActionCard[];
  discard: ActionCard[];
  /** Most recent die roll (for display). */
  die: number | null;
}

type RollAction = GameAction<'ROLL'>;
type PlayAction = GameAction<'PLAY', { cardId: string }>;
type PassAction = GameAction<'PASS'>;
export type RelicAction = RollAction | PlayAction | PassAction;

const TRACK: CellKind[] = [
  'relic', 'card', 'empty', 'card',
  'relic', 'empty', 'card', 'relic',
  'empty', 'card', 'empty', 'relic',
];
const TARGET_RELICS = 4;

export const CARD_LABEL: Record<CardKind, string> = {
  leap: 'Leap',
  ward: 'Ward',
  steal: 'Steal',
};
export const CARD_TEXT: Record<CardKind, string> = {
  leap: 'Jump 2 cells ahead and resolve where you land.',
  ward: 'Claim one relic from the vault.',
  steal: 'Take one relic from the current leader.',
};

function buildDeck(random: RandomSource): ActionCard[] {
  const spec: [CardKind, number][] = [
    ['leap', 5],
    ['steal', 4],
    ['ward', 3],
  ];
  const cards: ActionCard[] = [];
  let n = 0;
  for (const [kind, count] of spec) {
    for (let i = 0; i < count; i++) cards.push({ id: `${kind}-${n++}`, kind });
  }
  return random.shuffle(cards);
}

function drawActionCard(
  deck: ActionCard[],
  discard: ActionCard[],
  random: RandomSource,
): { card: ActionCard | null; deck: ActionCard[]; discard: ActionCard[] } {
  let d = deck;
  let disc = discard;
  if (d.length === 0) {
    if (disc.length === 0) return { card: null, deck: d, discard: disc };
    d = random.shuffle(disc);
    disc = [];
  }
  return { card: d[d.length - 1], deck: d.slice(0, -1), discard: disc };
}

/** Resolve landing on a cell: bank a relic, draw a card, or nothing. */
function resolveLanding(
  game: RelicState,
  me: PlayerId,
  index: number,
  random: RandomSource,
): RelicState {
  const kind = game.track[index];
  if (kind === 'relic') {
    return { ...game, relics: { ...game.relics, [me]: game.relics[me] + 1 } };
  }
  if (kind === 'card') {
    const { card, deck, discard } = drawActionCard(game.deck, game.discard, random);
    if (!card) return game;
    return {
      ...game,
      deck,
      discard,
      hands: { ...game.hands, [me]: [...game.hands[me], card] },
    };
  }
  return game;
}

function leader(relics: Record<PlayerId, number>, exclude: PlayerId): PlayerId | null {
  let best: PlayerId | null = null;
  let bestN = 0;
  for (const [id, n] of Object.entries(relics)) {
    if (id === exclude) continue;
    if (n > bestN) {
      bestN = n;
      best = id;
    }
  }
  return bestN > 0 ? best : null;
}

export const relicRun: GameDefinition<RelicState, RelicAction> = {
  id: 'relic-run',
  name: 'Relic Run',
  description:
    'Roll around the loop, grab relics and play action cards. First to four wins.',
  category: 'hybrid',
  minPlayers: 2,
  maxPlayers: 4,
  tags: ['hybrid', 'cards', 'board', 'dice'],
  accent: '#b07cf0',
  emoji: '🗿',
  startingPhase: 'roll',

  setup(ctx) {
    const positions: Record<PlayerId, number> = {};
    const relics: Record<PlayerId, number> = {};
    const hands: Record<PlayerId, ActionCard[]> = {};
    for (const p of ctx.players) {
      positions[p.id] = 0;
      relics[p.id] = 0;
      hands[p.id] = [];
    }
    return {
      track: TRACK,
      positions,
      relics,
      hands,
      deck: buildDeck(ctx.random),
      discard: [],
      die: null,
    };
  },

  validate(game, action, ctx) {
    const base = Rules.requireCurrentPlayer(ctx);
    if (base !== true) return base;

    if (action.type === 'ROLL') return Rules.requirePhase(ctx, 'roll');
    if (action.type === 'PASS') return Rules.requirePhase(ctx, 'action');
    if (action.type === 'PLAY') {
      const phase = Rules.requirePhase(ctx, 'action');
      if (phase !== true) return phase;
      return Rules.check(
        game.hands[ctx.actor].some((c) => c.id === action.payload?.cardId),
        'That card is not in your hand.',
      );
    }
    return 'Unknown action.';
  },

  reducer(game, action, ctx) {
    const me = ctx.actor;
    const track = game.track;

    if (action.type === 'ROLL') {
      const die = Dice.d6(ctx.random);
      const dest = (game.positions[me] + die) % track.length;
      let next: RelicState = { ...game, positions: { ...game.positions, [me]: dest }, die };
      next = resolveLanding(next, me, dest, ctx.random);
      ctx.events.setPhase('action');
      return next;
    }

    if (action.type === 'PASS') {
      ctx.events.setPhase('roll');
      ctx.events.endTurn();
      return game;
    }

    // PLAY
    const cardId = action.payload!.cardId;
    const card = game.hands[me].find((c) => c.id === cardId)!;
    const hands = { ...game.hands, [me]: game.hands[me].filter((c) => c.id !== cardId) };
    let next: RelicState = { ...game, hands, discard: [...game.discard, card] };

    if (card.kind === 'ward') {
      next = { ...next, relics: { ...next.relics, [me]: next.relics[me] + 1 } };
    } else if (card.kind === 'steal') {
      const target = leader(next.relics, me);
      if (target) {
        next = {
          ...next,
          relics: {
            ...next.relics,
            [target]: next.relics[target] - 1,
            [me]: next.relics[me] + 1,
          },
        };
      }
    } else if (card.kind === 'leap') {
      const dest = (next.positions[me] + 2) % track.length;
      next = { ...next, positions: { ...next.positions, [me]: dest } };
      next = resolveLanding(next, me, dest, ctx.random);
    }

    ctx.events.setPhase('roll');
    ctx.events.endTurn();
    return next;
  },

  endIf(game) {
    for (const [id, n] of Object.entries(game.relics)) {
      if (n >= TARGET_RELICS) {
        return {
          status: 'win',
          winners: [id],
          reason: `Gathered ${TARGET_RELICS} relics!`,
          scores: game.relics,
        };
      }
    }
    return null;
  },

  enumerate(game, ctx) {
    if (ctx.turn.phase === 'roll') return [{ type: 'ROLL' }];
    const out: RelicAction[] = [{ type: 'PASS' }];
    for (const c of game.hands[ctx.actor]) {
      out.push({ type: 'PLAY', payload: { cardId: c.id } });
    }
    return out;
  },

  ai(game, ctx) {
    if (ctx.turn.phase === 'roll') return { type: 'ROLL' };
    const hand = game.hands[ctx.actor];
    const ward = hand.find((c) => c.kind === 'ward');
    if (ward) return { type: 'PLAY', payload: { cardId: ward.id } };
    const steal = hand.find((c) => c.kind === 'steal');
    if (steal && leader(game.relics, ctx.actor))
      return { type: 'PLAY', payload: { cardId: steal.id } };
    const leap = hand.find((c) => c.kind === 'leap');
    if (leap) return { type: 'PLAY', payload: { cardId: leap.id } };
    return { type: 'PASS' };
  },

  redact(game, viewerId) {
    // Hide opponents' action-card hands and the draw deck's order; keep counts.
    const hide = (cards: ActionCard[], tag: string): ActionCard[] =>
      cards.map((_, i) => ({ id: `hidden-${tag}-${i}`, kind: 'leap' }));
    const hands: Record<PlayerId, ActionCard[]> = {};
    for (const [id, hand] of Object.entries(game.hands)) {
      hands[id] = id === viewerId ? hand : hide(hand, id);
    }
    return { ...game, hands, deck: hide(game.deck, 'deck') };
  },

  describeAction(action, state: MatchState<RelicState>) {
    const name =
      state.players.find((p) => p.id === action.playerId)?.name ?? 'Someone';
    if (action.type === 'ROLL') return `${name} rolled and moved.`;
    if (action.type === 'PASS') return `${name} ended their turn.`;
    if (action.type === 'PLAY') return `${name} played an action card.`;
    return '';
  },
};

registerGame(relicRun);
