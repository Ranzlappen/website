/**
 * Crown Rush — an original 2–4 player card game (demo: cards).
 *
 * Each player holds a hidden hand of three cards. On your turn you draw one
 * card (from the face-down stock or the face-up discard), then discard one,
 * keeping your hand at three. Collect three cards of the same rank — a
 * "Crown" — and you win.
 *
 * Written on the declarative ruleset layer: zones give it draw/discard/hand
 * management, auto-reshuffle and network redaction for free; `defineGame`
 * turns the two move declarations below into a full GameDefinition.
 */
import {
  Cards,
  Rules,
  Zones,
  defineGame,
  registerGame,
  type PlayerId,
  type ReducerContext,
} from '../engine';

export interface CrownState {
  zones: Zones.ZoneMap;
  /** Whether the current player has already drawn this turn. */
  hasDrawn: boolean;
}

export type DrawFrom = 'stock' | 'discard';

const HAND_SIZE = 3;

/** Zone id of a player's hand. */
export function handZone(playerId: PlayerId): string {
  return Zones.zoneId('hand', playerId);
}

/** A player's current hand. */
export function handOf(game: CrownState, playerId: PlayerId): Cards.Card[] {
  return Zones.cardsIn(game.zones, handZone(playerId));
}

function handIsCrown(hand: Cards.Card[]): boolean {
  return hand.length === HAND_SIZE && hand.every((c) => c.rank === hand[0].rank);
}

function drawApply(game: CrownState, from: DrawFrom, ctx: ReducerContext): CrownState {
  const me = handZone(ctx.actor);
  const zones =
    from === 'discard'
      ? Zones.moveCard(game.zones, 'discard', me, Zones.topCard(game.zones, 'discard')!.id)
      : Zones.draw(game.zones, 'stock', me, 1, {
          faceUp: true,
          // An empty stock recycles the discard, keeping its top card in play.
          reshuffleFrom: 'discard',
          keepTop: true,
          random: ctx.random,
        });
  return { ...game, zones, hasDrawn: true };
}

export const crownRush = defineGame<CrownState>({
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
    const deck = ctx.random.shuffle(Cards.standard52());
    const { hands, rest } = Cards.deal(deck, playerIds, HAND_SIZE);
    const { drawn, rest: stock } = Cards.drawN(rest, 1);
    const zones = Zones.makeZones(
      Zones.makeZone('stock', 'hidden', stock),
      Zones.makeZone('discard', 'public', drawn.map((c) => ({ ...c, faceUp: true }))),
      ...playerIds.map((id) =>
        Zones.makeZone(handZone(id), 'owner', hands[id].map((c) => ({ ...c, faceUp: true })), id),
      ),
    );
    return { zones, hasDrawn: false };
  },

  moves: {
    DRAW: {
      validate(game, payload: { from: DrawFrom }) {
        if (game.hasDrawn) return 'You have already drawn this turn — now discard.';
        if (payload?.from === 'discard') {
          return Rules.check(
            Zones.countIn(game.zones, 'discard') > 0,
            'The discard pile is empty.',
          );
        }
        return Rules.check(
          Zones.countIn(game.zones, 'stock') > 0 ||
            Zones.countIn(game.zones, 'discard') > 1,
          'There are no cards left to draw.',
        );
      },
      apply: (game, payload: { from: DrawFrom }, ctx) => drawApply(game, payload.from, ctx),
      enumerate: () => [{ from: 'stock' as DrawFrom }, { from: 'discard' as DrawFrom }],
      describe: (payload: { from: DrawFrom }, name) =>
        `${name} drew from the ${payload.from}.`,
    },

    DISCARD: {
      validate(game, payload: { cardId: string }, ctx) {
        if (!game.hasDrawn) return 'Draw a card before discarding.';
        return Rules.check(
          handOf(game, ctx.actor).some((c) => c.id === payload?.cardId),
          'That card is not in your hand.',
        );
      },
      apply(game, payload: { cardId: string }, ctx) {
        const zones = Zones.moveCard(game.zones, handZone(ctx.actor), 'discard', payload.cardId, {
          faceUp: true,
        });
        return { ...game, zones };
      },
      enumerate: (game, ctx) =>
        handOf(game, ctx.actor).map((c) => ({ cardId: c.id })),
      endsTurn: true,
      describe: (_payload, name) => `${name} discarded a card.`,
    },
  },

  // Per-turn flags reset in one place instead of at the end of every move.
  onTurnBegin: (game) => ({ ...game, hasDrawn: false }),

  endIf(game, ctx) {
    for (const p of ctx.players) {
      const hand = handOf(game, p.id);
      if (handIsCrown(hand)) {
        return {
          status: 'win',
          winners: [p.id],
          reason: `Collected three ${hand[0].rank}s — a Crown!`,
        };
      }
    }
    return null;
  },

  ai(game, ctx) {
    const hand = handOf(game, ctx.actor);
    if (!game.hasDrawn) {
      // Take the discard if it matches a rank we already hold.
      const top = Zones.topCard(game.zones, 'discard');
      const matches = top && hand.some((c) => c.rank === top.rank);
      return { type: 'DRAW', payload: { from: matches ? 'discard' : 'stock' } };
    }
    // Discard the card whose rank is least represented in hand.
    const counts = new Map<string, number>();
    for (const c of hand) counts.set(c.rank!, (counts.get(c.rank!) ?? 0) + 1);
    const worst = [...hand].sort(
      (a, b) => counts.get(a.rank!)! - counts.get(b.rank!)!,
    )[0];
    return { type: 'DISCARD', payload: { cardId: worst.id } };
  },
  // No `redact` needed: all hidden information lives in zones, so per-viewer
  // redaction is derived automatically from the zone visibilities.
});

registerGame(crownRush);
