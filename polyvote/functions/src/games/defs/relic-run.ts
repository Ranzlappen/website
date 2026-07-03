/**
 * Relic Run — an original 2–4 player hybrid game (demo: cards + board + tokens).
 *
 * Roll and move around a 12-cell loop. Landing on a relic cell banks a relic
 * token; landing on a card cell draws a hidden action card. Each turn ends with
 * an optional action card: Leap (jump ahead), Ward (a free relic), or Steal
 * (take a relic from the leader). First to four relics wins.
 *
 * Written on the declarative ruleset layer, and demonstrates the data-driven
 * card pattern: the deck is a composition spec (`deckFromSpec`), each card
 * kind maps to a small effect function in {@link CARD_EFFECTS}, and the hidden
 * hands/deck live in zones so redaction is automatic. Adding a new action card
 * is one spec line + one effect entry.
 */
import {
  Cards,
  Dice,
  Rules,
  Zones,
  defineGame,
  registerGame,
  type PlayerId,
  type ReducerContext,
} from '../engine';

export type CellKind = 'relic' | 'card' | 'empty';
export type CardKind = 'leap' | 'ward' | 'steal';

export interface RelicState {
  /** Type of each cell on the loop track. */
  track: CellKind[];
  positions: Record<PlayerId, number>;
  relics: Record<PlayerId, number>;
  /** Action-card zones: hidden `deck`, public `discard`, per-player hands. */
  zones: Zones.ZoneMap;
  /** Most recent die roll (for display). */
  die: number | null;
}

const TRACK: CellKind[] = [
  'relic', 'card', 'empty', 'card',
  'relic', 'empty', 'card', 'relic',
  'empty', 'card', 'empty', 'relic',
];
const TARGET_RELICS = 4;

/** Deck composition — tweak counts or add kinds here. */
const DECK_SPEC: Cards.DeckSpecEntry[] = [
  { kind: 'leap', count: 5 },
  { kind: 'steal', count: 4 },
  { kind: 'ward', count: 3 },
];

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

/** Zone id of a player's action-card hand. */
export function handZone(playerId: PlayerId): string {
  return Zones.zoneId('hand', playerId);
}

/** A player's current action cards. */
export function handOf(game: RelicState, playerId: PlayerId): Cards.Card[] {
  return Zones.cardsIn(game.zones, handZone(playerId));
}

/** Resolve landing on a cell: bank a relic, draw a card, or nothing. */
function resolveLanding(
  game: RelicState,
  me: PlayerId,
  index: number,
  ctx: ReducerContext,
): RelicState {
  const kind = game.track[index];
  if (kind === 'relic') {
    return { ...game, relics: { ...game.relics, [me]: game.relics[me] + 1 } };
  }
  if (kind === 'card') {
    const zones = Zones.draw(game.zones, 'deck', handZone(me), 1, {
      faceUp: true,
      reshuffleFrom: 'discard',
      random: ctx.random,
    });
    return { ...game, zones };
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

/**
 * Effect registry: what each card kind does when played. New rulesets extend
 * this table (and {@link DECK_SPEC}) without touching the move machinery.
 */
const CARD_EFFECTS: Record<
  CardKind,
  (game: RelicState, me: PlayerId, ctx: ReducerContext) => RelicState
> = {
  ward: (game, me) => ({
    ...game,
    relics: { ...game.relics, [me]: game.relics[me] + 1 },
  }),
  steal: (game, me) => {
    const target = leader(game.relics, me);
    if (!target) return game;
    return {
      ...game,
      relics: {
        ...game.relics,
        [target]: game.relics[target] - 1,
        [me]: game.relics[me] + 1,
      },
    };
  },
  leap: (game, me, ctx) => {
    const dest = (game.positions[me] + 2) % game.track.length;
    const moved = { ...game, positions: { ...game.positions, [me]: dest } };
    return resolveLanding(moved, me, dest, ctx);
  },
};

export const relicRun = defineGame<RelicState>({
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
    for (const p of ctx.players) {
      positions[p.id] = 0;
      relics[p.id] = 0;
    }
    const zones = Zones.makeZones(
      Zones.makeZone('deck', 'hidden', ctx.random.shuffle(Cards.deckFromSpec(DECK_SPEC))),
      Zones.makeZone('discard', 'public'),
      ...ctx.players.map((p) => Zones.makeZone(handZone(p.id), 'owner', [], p.id)),
    );
    return { track: TRACK, positions, relics, zones, die: null };
  },

  moves: {
    ROLL: {
      phase: 'roll',
      apply(game, _payload, ctx) {
        const me = ctx.actor;
        const die = Dice.d6(ctx.random);
        const dest = (game.positions[me] + die) % game.track.length;
        const moved = { ...game, positions: { ...game.positions, [me]: dest }, die };
        return resolveLanding(moved, me, dest, ctx);
      },
      nextPhase: 'action',
      describe: (_payload, name) => `${name} rolled and moved.`,
    },

    PLAY: {
      phase: 'action',
      validate: (game, payload: { cardId: string }, ctx) =>
        Rules.check(
          handOf(game, ctx.actor).some((c) => c.id === payload?.cardId),
          'That card is not in your hand.',
        ),
      apply(game, payload: { cardId: string }, ctx) {
        const me = ctx.actor;
        const card = handOf(game, me).find((c) => c.id === payload.cardId)!;
        const zones = Zones.moveCard(game.zones, handZone(me), 'discard', card.id, {
          faceUp: true,
        });
        return CARD_EFFECTS[card.kind as CardKind]({ ...game, zones }, me, ctx);
      },
      enumerate: (game, ctx) =>
        handOf(game, ctx.actor).map((c) => ({ cardId: c.id })),
      nextPhase: 'roll',
      endsTurn: true,
      describe: (_payload, name) => `${name} played an action card.`,
    },

    PASS: {
      phase: 'action',
      apply: (game) => game,
      nextPhase: 'roll',
      endsTurn: true,
      describe: (_payload, name) => `${name} ended their turn.`,
    },
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

  ai(game, ctx) {
    if (ctx.turn.phase === 'roll') return { type: 'ROLL' };
    const hand = handOf(game, ctx.actor);
    const ward = hand.find((c) => c.kind === 'ward');
    if (ward) return { type: 'PLAY', payload: { cardId: ward.id } };
    const steal = hand.find((c) => c.kind === 'steal');
    if (steal && leader(game.relics, ctx.actor))
      return { type: 'PLAY', payload: { cardId: steal.id } };
    const leap = hand.find((c) => c.kind === 'leap');
    if (leap) return { type: 'PLAY', payload: { cardId: leap.id } };
    return { type: 'PASS' };
  },
  // Hidden information (hands + deck order) lives in zones → auto-redaction.
});

registerGame(relicRun);
