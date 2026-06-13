/**
 * Crown Rush — an original 2–4 player card game (demo: cards).
 *
 * Each player holds a hidden hand of three cards. On your turn you draw one
 * card (from the face-down stock or the face-up discard), then discard one,
 * keeping your hand at three. Collect three cards of the same rank — a
 * "Crown" — and you win.
 *
 * Demonstrates: draw pile, discard pile, hidden hands, public top-of-discard,
 * card selection, a two-step turn (draw → discard), reshuffling, a simple bot,
 * and a win condition.
 */
import {
  Cards,
  Rules,
  registerGame,
  type GameAction,
  type GameDefinition,
  type MatchState,
  type PlayerId,
  type ReducerContext,
} from '../engine';

export interface CrownState {
  draw: Cards.Card[];
  discard: Cards.Card[];
  hands: Record<PlayerId, Cards.Card[]>;
  /** Whether the current player has already drawn this turn. */
  hasDrawn: boolean;
}

type DrawAction = GameAction<'DRAW', { from: 'stock' | 'discard' }>;
type DiscardAction = GameAction<'DISCARD', { cardId: string }>;
export type CrownAction = DrawAction | DiscardAction;

const HAND_SIZE = 3;

function handIsCrown(hand: Cards.Card[]): boolean {
  return (
    hand.length === HAND_SIZE &&
    hand.every((c) => c.rank === hand[0].rank)
  );
}

/** Reshuffle the discard (keeping its top card) back into an empty stock. */
function refillStock(
  state: CrownState,
  ctx: ReducerContext,
): Pick<CrownState, 'draw' | 'discard'> {
  if (state.draw.length > 0 || state.discard.length <= 1) {
    return { draw: state.draw, discard: state.discard };
  }
  const top = Cards.topOf(state.discard)!;
  const recycle = state.discard.slice(0, -1).map((c) => ({ ...c, faceUp: false }));
  return { draw: ctx.random.shuffle(recycle), discard: [top] };
}

export const crownRush: GameDefinition<CrownState, CrownAction> = {
  id: 'crown-rush',
  name: 'Crown Rush',
  description:
    'Draw and discard to collect three of a kind. First to a Crown wins.',
  category: 'card',
  minPlayers: 2,
  maxPlayers: 4,
  tags: ['cards', 'sets', 'quick'],
  accent: '#e0b341',
  emoji: '👑',

  setup(ctx) {
    const playerIds = ctx.players.map((p) => p.id);
    const deck = Cards.shuffle(Cards.standard52(), ctx.random);
    const { hands, rest } = Cards.deal(deck, playerIds, HAND_SIZE);
    for (const id of playerIds) {
      hands[id] = hands[id].map((c) => ({ ...c, faceUp: true, owner: id }));
    }
    const { drawn, rest: draw } = Cards.drawN(rest, 1);
    const discard = drawn.map((c) => ({ ...c, faceUp: true }));
    return { draw, discard, hands, hasDrawn: false };
  },

  validate(game, action, ctx) {
    const base = Rules.all(
      Rules.requireCurrentPlayer(ctx),
      Rules.requirePhase(ctx, 'play'),
    );
    if (base !== true) return base;

    if (action.type === 'DRAW') {
      if (game.hasDrawn) return 'You have already drawn this turn — now discard.';
      if (action.payload?.from === 'discard' && game.discard.length === 0)
        return 'The discard pile is empty.';
      if (
        action.payload?.from === 'stock' &&
        game.draw.length === 0 &&
        game.discard.length <= 1
      )
        return 'There are no cards left to draw.';
      return true;
    }
    if (action.type === 'DISCARD') {
      if (!game.hasDrawn) return 'Draw a card before discarding.';
      const hand = game.hands[ctx.actor] ?? [];
      return Rules.require(
        hand.some((c) => c.id === action.payload?.cardId),
        'That card is not in your hand.',
      );
    }
    return 'Unknown action.';
  },

  reducer(game, action, ctx) {
    const me = ctx.actor;

    if (action.type === 'DRAW') {
      const from = action.payload!.from;
      if (from === 'discard') {
        const { card, rest } = Cards.removeCard(game.discard, Cards.topOf(game.discard)!.id);
        return {
          ...game,
          discard: rest,
          hands: { ...game.hands, [me]: [...game.hands[me], { ...card!, owner: me }] },
          hasDrawn: true,
        };
      }
      // from stock — refill if needed first.
      const refilled = refillStock(game, ctx);
      const { drawn, rest } = Cards.drawN(refilled.draw, 1);
      const card = { ...drawn[0], faceUp: true, owner: me };
      return {
        ...game,
        draw: rest,
        discard: refilled.discard,
        hands: { ...game.hands, [me]: [...game.hands[me], card] },
        hasDrawn: true,
      };
    }

    // DISCARD
    const { card, rest } = Cards.removeCard(game.hands[me], action.payload!.cardId);
    const next: CrownState = {
      ...game,
      hands: { ...game.hands, [me]: rest },
      discard: Cards.addCard(game.discard, { ...card!, faceUp: true, owner: null }),
      hasDrawn: false,
    };

    if (handIsCrown(next.hands[me])) {
      ctx.events.endGame({
        status: 'win',
        winners: [me],
        reason: `Collected three ${next.hands[me][0].rank}s — a Crown!`,
      });
    } else {
      ctx.events.endTurn();
    }
    return next;
  },

  enumerate(game, ctx) {
    const me = ctx.actor;
    if (!game.hasDrawn) {
      const out: CrownAction[] = [];
      if (game.draw.length > 0 || game.discard.length > 1)
        out.push({ type: 'DRAW', payload: { from: 'stock' } });
      if (game.discard.length > 0)
        out.push({ type: 'DRAW', payload: { from: 'discard' } });
      return out;
    }
    return game.hands[me].map((c) => ({
      type: 'DISCARD' as const,
      payload: { cardId: c.id },
    }));
  },

  ai(game, ctx) {
    const me = ctx.actor;
    const hand = game.hands[me];
    if (!game.hasDrawn) {
      // Take the discard if it matches a rank we already hold.
      const top = Cards.topOf(game.discard);
      const matches = top && hand.some((c) => c.rank === top.rank);
      return {
        type: 'DRAW',
        payload: { from: matches ? 'discard' : 'stock' },
      };
    }
    // Discard the card whose rank is least represented in hand.
    const counts = new Map<string, number>();
    for (const c of hand) counts.set(c.rank!, (counts.get(c.rank!) ?? 0) + 1);
    const worst = [...hand].sort(
      (a, b) => counts.get(a.rank!)! - counts.get(b.rank!)!,
    )[0];
    return { type: 'DISCARD', payload: { cardId: worst.id } };
  },

  describeAction(action, state: MatchState<CrownState>) {
    const name = (id?: PlayerId) =>
      state.players.find((p) => p.id === id)?.name ?? 'Someone';
    if (action.type === 'DRAW')
      return `${name(action.playerId)} drew from the ${(action as DrawAction).payload?.from}.`;
    if (action.type === 'DISCARD')
      return `${name(action.playerId)} discarded a card.`;
    return '';
  },
};

registerGame(crownRush);
