import { describe, it, expect } from 'vitest';
import { createRandom, seedRng } from '../engine/rng';
import type { Card } from '../engine/cards';
import {
  addCards,
  cardsIn,
  countIn,
  draw,
  findCard,
  getZone,
  makeZone,
  makeZones,
  moveCard,
  moveTop,
  redactZones,
  setCards,
  shuffleZone,
  topCard,
  zoneId,
} from '../engine/zones';

const c = (id: string, faceUp = false): Card => ({
  id,
  rank: 'A',
  suit: 'spades',
  faceUp,
});

const base = () =>
  makeZones(
    makeZone('stock', 'hidden', [c('s1'), c('s2'), c('s3')]),
    makeZone('discard', 'public', [c('d1', true), c('d2', false)]),
    makeZone(zoneId('hand', 'p0'), 'owner', [c('h0', true)], 'p0'),
    makeZone(zoneId('hand', 'p1'), 'owner', [c('h1', true)], 'p1'),
  );

describe('zones: construction and lookup', () => {
  it('makeZones throws on duplicate ids', () => {
    expect(() => makeZones(makeZone('a', 'public'), makeZone('a', 'public'))).toThrow(
      /Duplicate/,
    );
  });

  it('getZone throws a clear error on unknown ids', () => {
    expect(() => getZone(base(), 'nope')).toThrow(/Unknown zone "nope"/);
  });

  it('counts, tops and finds cards', () => {
    const z = base();
    expect(countIn(z, 'stock')).toBe(3);
    expect(topCard(z, 'stock')?.id).toBe('s3');
    expect(topCard(z, 'discard')?.id).toBe('d2');
    expect(findCard(z, 'h1')?.zone.id).toBe('hand:p1');
    expect(findCard(z, 'zz')).toBeNull();
  });
});

describe('zones: immutable operations', () => {
  it('moveCard moves a specific card and never mutates the input', () => {
    const z = base();
    const next = moveCard(z, 'discard', zoneId('hand', 'p0'), 'd1');
    expect(countIn(z, 'discard')).toBe(2); // input untouched
    expect(countIn(next, 'discard')).toBe(1);
    expect(cardsIn(next, 'hand:p0').map((x) => x.id)).toEqual(['h0', 'd1']);
  });

  it('moveCard throws when the card is not in the source zone', () => {
    expect(() => moveCard(base(), 'stock', 'discard', 'h0')).toThrow(/not in zone/);
  });

  it('moveTop takes from the top and can flip', () => {
    const next = moveTop(base(), 'stock', 'discard', 2, { faceUp: true });
    expect(cardsIn(next, 'stock').map((x) => x.id)).toEqual(['s1']);
    const discard = cardsIn(next, 'discard');
    expect(discard.map((x) => x.id)).toEqual(['d1', 'd2', 's2', 's3']);
    expect(discard[2].faceUp).toBe(true);
  });

  it('addCards and setCards replace immutably', () => {
    const z = base();
    const added = addCards(z, 'discard', [c('x1')], { faceUp: true });
    expect(topCard(added, 'discard')?.id).toBe('x1');
    expect(topCard(added, 'discard')?.faceUp).toBe(true);
    const replaced = setCards(z, 'discard', []);
    expect(countIn(replaced, 'discard')).toBe(0);
    expect(countIn(z, 'discard')).toBe(2);
  });

  it('shuffleZone shuffles deterministically for a given rng state', () => {
    const a = shuffleZone(base(), 'stock', createRandom(seedRng('x')));
    const b = shuffleZone(base(), 'stock', createRandom(seedRng('x')));
    expect(cardsIn(a, 'stock')).toEqual(cardsIn(b, 'stock'));
  });
});

describe('zones: draw with auto-reshuffle', () => {
  it('draws from the top into another zone', () => {
    const next = draw(base(), 'stock', zoneId('hand', 'p0'), 2, { faceUp: true });
    expect(countIn(next, 'stock')).toBe(1);
    expect(cardsIn(next, 'hand:p0').map((x) => x.id)).toEqual(['h0', 's3', 's2']);
    expect(cardsIn(next, 'hand:p0')[1].faceUp).toBe(true);
  });

  it('reshuffles the linked discard when the pile runs dry', () => {
    const z = makeZones(
      makeZone('stock', 'hidden', [c('s1')]),
      makeZone('discard', 'public', [c('d1', true), c('d2', true), c('d3', true)]),
      makeZone('hand', 'owner', [], 'p0'),
    );
    const next = draw(z, 'stock', 'hand', 3, {
      reshuffleFrom: 'discard',
      keepTop: true,
      random: createRandom(seedRng('r')),
    });
    expect(countIn(next, 'hand')).toBe(3);
    // The discard's top card stays put; the rest were recycled face-down.
    expect(cardsIn(next, 'discard').map((x) => x.id)).toEqual(['d3']);
    expect(countIn(next, 'stock') + countIn(next, 'hand') + countIn(next, 'discard')).toBe(4);
  });

  it('stops gracefully when there is nothing left to draw', () => {
    const z = makeZones(
      makeZone('stock', 'hidden', []),
      makeZone('discard', 'public', []),
      makeZone('hand', 'owner', [], 'p0'),
    );
    const next = draw(z, 'stock', 'hand', 2, {
      reshuffleFrom: 'discard',
      random: createRandom(seedRng('r')),
    });
    expect(countIn(next, 'hand')).toBe(0);
  });

  it('requires a RandomSource when reshuffling', () => {
    const z = makeZones(
      makeZone('stock', 'hidden', []),
      makeZone('discard', 'public', [c('d1'), c('d2')]),
      makeZone('hand', 'owner', [], 'p0'),
    );
    expect(() => draw(z, 'stock', 'hand', 1, { reshuffleFrom: 'discard' })).toThrow(
      /RandomSource/,
    );
  });
});

describe('zones: redaction', () => {
  it('derives per-viewer visibility from the zone policies', () => {
    const view = redactZones(base(), 'p0');

    // Own hand intact; opponent's hand stubbed with count + stable ids.
    expect(cardsIn(view, 'hand:p0')[0].rank).toBe('A');
    expect(cardsIn(view, 'hand:p1')).toHaveLength(1);
    expect(cardsIn(view, 'hand:p1')[0].rank).toBeUndefined();
    expect(cardsIn(view, 'hand:p1')[0].id).toBe('hidden:hand:p1:0');

    // Hidden stock: only the count survives.
    expect(cardsIn(view, 'stock').every((x) => x.rank === undefined && !x.faceUp)).toBe(true);
    expect(countIn(view, 'stock')).toBe(3);

    // Public discard: face-up cards visible, face-down faces masked.
    expect(cardsIn(view, 'discard')[0].rank).toBe('A');
    expect(cardsIn(view, 'discard')[1].rank).toBeUndefined();
    expect(cardsIn(view, 'discard')[1].id).toBe('d2'); // identity kept, face hidden
  });
});
