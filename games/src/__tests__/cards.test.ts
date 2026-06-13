import { describe, it, expect } from 'vitest';
import { createRandom, seedRng } from '../engine/rng';
import {
  addCard,
  deal,
  drawN,
  removeCard,
  shuffle,
  standard52,
  topOf,
} from '../engine/cards';

describe('cards', () => {
  it('builds a 52-card deck of unique ids', () => {
    const deck = standard52();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it('shuffle keeps the same multiset and is deterministic', () => {
    const deck = standard52();
    const a = shuffle(deck, createRandom(seedRng('x')));
    const b = shuffle(deck, createRandom(seedRng('x')));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(new Set(a.map((c) => c.id)).size).toBe(52);
  });

  it('deals round-robin and leaves the rest', () => {
    const deck = standard52();
    const { hands, rest } = deal(deck, ['a', 'b'], 5);
    expect(hands.a).toHaveLength(5);
    expect(hands.b).toHaveLength(5);
    expect(rest).toHaveLength(42);
    // First card to a, second to b (round-robin).
    expect(hands.a[0].id).toBe(deck[0].id);
    expect(hands.b[0].id).toBe(deck[1].id);
  });

  it('throws when dealing more than the deck holds', () => {
    expect(() => deal(standard52(), ['a', 'b'], 30)).toThrow();
  });

  it('drawN / removeCard / addCard are immutable', () => {
    const pile = standard52().slice(0, 5);
    const { drawn, rest } = drawN(pile, 2);
    expect(drawn).toHaveLength(2);
    expect(rest).toHaveLength(3);
    expect(pile).toHaveLength(5);

    const { card, rest: after } = removeCard(pile, pile[2].id);
    expect(card?.id).toBe(pile[2].id);
    expect(after).toHaveLength(4);

    const grown = addCard(pile, { id: 'JOKER', faceUp: true });
    expect(grown).toHaveLength(6);
    expect(topOf(grown)?.id).toBe('JOKER');
    expect(pile).toHaveLength(5);
  });
});
