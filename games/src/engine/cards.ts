/**
 * Card subsystem — decks, suits/ranks, shuffling, dealing, and immutable
 * zone operations (draw piles, hands, discard piles).
 *
 * Cards are plain serializable objects. Every card carries a stable `id` so the
 * UI can animate moves and the engine can target a specific card without
 * relying on array position.
 */
import type { RandomSource } from './rng';
import type { PlayerId } from './types';

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

/** Numeric value of a rank (Ace high = 14 by default, or low = 1). */
export function rankValue(rank: Rank, aceHigh = true): number {
  if (rank === 'A') return aceHigh ? 14 : 1;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  return Number(rank);
}

export const SUIT_COLOR: Record<Suit, 'red' | 'black'> = {
  hearts: 'red',
  diamonds: 'red',
  spades: 'black',
  clubs: 'black',
};

/** A card. Game-specific data can live alongside the standard fields. */
export interface Card {
  id: string;
  suit?: Suit;
  rank?: Rank;
  /** Template tag for custom (non-standard) cards — see {@link deckFromSpec}. */
  kind?: string;
  /** Sort/compare value; defaults to `rankValue` for standard cards. */
  value?: number;
  /** Whether the face is visible. Engine never reveals on its own. */
  faceUp?: boolean;
  /** Optional owner (e.g. for cards committed to a player). */
  owner?: PlayerId | null;
  [extra: string]: unknown;
}

/**
 * One line of a custom deck's composition: `count` copies of a card template.
 * Extra fields in `data` are copied onto every instance.
 */
export interface DeckSpecEntry {
  kind: string;
  count: number;
  data?: Record<string, unknown>;
}

/**
 * Build a custom deck from a declarative composition — the data-driven way to
 * express "5 Leap, 4 Steal, 3 Ward". Ids are stable (`kind-N`), face-down by
 * default. Shuffle separately so composition stays deterministic and testable.
 */
export function deckFromSpec(spec: readonly DeckSpecEntry[]): Card[] {
  const deck: Card[] = [];
  let n = 0;
  for (const { kind, count, data } of spec) {
    for (let i = 0; i < count; i++) {
      deck.push({ ...data, id: `${kind}-${n++}`, kind, faceUp: false });
    }
  }
  return deck;
}

/** Build a standard 52-card deck (face-down, ace high). */
export function standard52(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}${suit[0].toUpperCase()}`,
        suit,
        rank,
        value: rankValue(rank),
        faceUp: false,
      });
    }
  }
  return deck;
}

/** Return a NEW shuffled copy of the deck. */
export function shuffle(deck: readonly Card[], random: RandomSource): Card[] {
  return random.shuffle(deck);
}

/**
 * Deal `perPlayer` cards to each of `playerIds` from the top of `deck`.
 * Returns the resulting hands plus the remaining draw pile. Pure — `deck` is
 * not mutated.
 */
export function deal(
  deck: readonly Card[],
  playerIds: readonly PlayerId[],
  perPlayer: number,
): { hands: Record<PlayerId, Card[]>; rest: Card[] } {
  const need = playerIds.length * perPlayer;
  if (need > deck.length) {
    throw new Error(`Cannot deal ${need} cards from a deck of ${deck.length}.`);
  }
  const hands: Record<PlayerId, Card[]> = {};
  for (const id of playerIds) hands[id] = [];
  let idx = 0;
  // Deal round-robin (one card to each player per pass), the conventional way.
  for (let r = 0; r < perPlayer; r++) {
    for (const id of playerIds) {
      hands[id].push(deck[idx++]);
    }
  }
  return { hands, rest: deck.slice(idx) };
}

/** Top card of a pile (last element = top), or undefined if empty. */
export function topOf(pile: readonly Card[]): Card | undefined {
  return pile[pile.length - 1];
}

/**
 * Draw `n` cards off the top of a pile. Returns the drawn cards and the
 * remaining pile (both new arrays).
 */
export function drawN(
  pile: readonly Card[],
  n: number,
): { drawn: Card[]; rest: Card[] } {
  const count = Math.min(n, pile.length);
  return {
    drawn: pile.slice(pile.length - count),
    rest: pile.slice(0, pile.length - count),
  };
}

/** Remove a specific card by id from a zone. Returns the card and the new zone. */
export function removeCard(
  zone: readonly Card[],
  cardId: string,
): { card: Card | undefined; rest: Card[] } {
  const i = zone.findIndex((c) => c.id === cardId);
  if (i < 0) return { card: undefined, rest: zone.slice() };
  return { card: zone[i], rest: [...zone.slice(0, i), ...zone.slice(i + 1)] };
}

/** Add a card to the top of a zone (immutably), optionally flipping it. */
export function addCard(
  zone: readonly Card[],
  card: Card,
  faceUp?: boolean,
): Card[] {
  return [...zone, faceUp === undefined ? card : { ...card, faceUp }];
}

/** Flip a card face-up/face-down (immutable). */
export function flip(card: Card, faceUp: boolean): Card {
  return { ...card, faceUp };
}

/** Public-information view of a card: hides the face when it's face-down. */
export function publicView(card: Card): Card {
  return card.faceUp ? card : { id: card.id, faceUp: false };
}
