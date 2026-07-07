/**
 * Zone subsystem — named, typed containers for cards (draw piles, hands,
 * discard piles, rows, vaults…) with a declared visibility policy per zone.
 *
 * Zones buy card games three things over ad-hoc arrays:
 *   1. **One vocabulary of operations** — move/draw/shuffle between named zones
 *      instead of bespoke splice logic per game.
 *   2. **Automatic redaction** — {@link redactZones} derives what each viewer
 *      may see from the zones' visibility policies, so networked games with
 *      hidden information no longer hand-write a `redact` hook.
 *   3. **Auto-reshuffle** — {@link draw} can refill an empty pile from a linked
 *      discard in one call.
 *
 * Everything is plain JSON and every operation is immutable: helpers return a
 * new {@link ZoneMap}, never mutating the input, matching the engine's pure
 * `applyAction` model.
 */
import type { Card } from './cards';
import { publicView } from './cards';
import type { RandomSource } from './rng';
import type { PlayerId } from './types';

/**
 * Who may see the cards inside a zone:
 *   - `'public'`  — everyone sees every card (face-down cards still hide their
 *                   face via {@link publicView}). E.g. a discard pile or a
 *                   shared tableau.
 *   - `'owner'`   — only the zone's `owner` sees the cards; other viewers see
 *                   anonymous stubs (counts preserved). E.g. a hand.
 *   - `'hidden'`  — nobody sees the cards or their order, only the count.
 *                   E.g. a face-down draw pile.
 */
export type ZoneVisibility = 'public' | 'owner' | 'hidden';

/** A named card container with a visibility policy. */
export interface Zone {
  id: string;
  cards: Card[];
  visibility: ZoneVisibility;
  /** Required when visibility is `'owner'`. */
  owner?: PlayerId | null;
}

/** All of a game's zones, keyed by zone id. */
export type ZoneMap = Record<string, Zone>;

/** Conventional id for a per-player zone, e.g. `zoneId('hand', 'p0')` → `hand:p0`. */
export function zoneId(prefix: string, playerId: PlayerId): string {
  return `${prefix}:${playerId}`;
}

/** Create a zone. */
export function makeZone(
  id: string,
  visibility: ZoneVisibility,
  cards: Card[] = [],
  owner?: PlayerId | null,
): Zone {
  return { id, cards, visibility, owner: owner ?? null };
}

/** Build a ZoneMap from a list of zones. Throws on duplicate ids. */
export function makeZones(...zones: Zone[]): ZoneMap {
  const map: ZoneMap = {};
  for (const z of zones) {
    if (map[z.id]) throw new Error(`Duplicate zone id "${z.id}".`);
    map[z.id] = z;
  }
  return map;
}

/** Look up a zone; throws with a clear message when the id is unknown. */
export function getZone(zones: ZoneMap, id: string): Zone {
  const z = zones[id];
  if (!z) throw new Error(`Unknown zone "${id}".`);
  return z;
}

/** The cards in a zone (read-only convenience). */
export function cardsIn(zones: ZoneMap, id: string): Card[] {
  return getZone(zones, id).cards;
}

/** Number of cards in a zone. */
export function countIn(zones: ZoneMap, id: string): number {
  return getZone(zones, id).cards.length;
}

/** Top card of a zone (last element = top), or undefined when empty. */
export function topCard(zones: ZoneMap, id: string): Card | undefined {
  const { cards } = getZone(zones, id);
  return cards[cards.length - 1];
}

/** Find a card anywhere; returns its zone and index, or null. */
export function findCard(
  zones: ZoneMap,
  cardId: string,
): { zone: Zone; index: number } | null {
  for (const zone of Object.values(zones)) {
    const index = zone.cards.findIndex((c) => c.id === cardId);
    if (index >= 0) return { zone, index };
  }
  return null;
}

/** Replace a zone's cards (immutable building block for the ops below). */
export function setCards(zones: ZoneMap, id: string, cards: Card[]): ZoneMap {
  const zone = getZone(zones, id);
  return { ...zones, [id]: { ...zone, cards } };
}

function withFace(card: Card, faceUp?: boolean): Card {
  return faceUp === undefined ? card : { ...card, faceUp };
}

/** Add cards to the top of a zone, optionally flipping them. */
export function addCards(
  zones: ZoneMap,
  id: string,
  cards: Card[],
  opts: { faceUp?: boolean } = {},
): ZoneMap {
  const zone = getZone(zones, id);
  const added = cards.map((c) => withFace(c, opts.faceUp));
  return setCards(zones, id, [...zone.cards, ...added]);
}

/**
 * Move one specific card between zones. Throws when the card is not in `from`
 * — a reducer bug the engine surfaces as a rejected action, never corruption.
 */
export function moveCard(
  zones: ZoneMap,
  from: string,
  to: string,
  cardId: string,
  opts: { faceUp?: boolean } = {},
): ZoneMap {
  const source = getZone(zones, from);
  const i = source.cards.findIndex((c) => c.id === cardId);
  if (i < 0) throw new Error(`Card "${cardId}" is not in zone "${from}".`);
  const card = source.cards[i];
  const next = setCards(zones, from, [
    ...source.cards.slice(0, i),
    ...source.cards.slice(i + 1),
  ]);
  return addCards(next, to, [card], opts);
}

/** Move the top `count` cards from one zone to another. */
export function moveTop(
  zones: ZoneMap,
  from: string,
  to: string,
  count = 1,
  opts: { faceUp?: boolean } = {},
): ZoneMap {
  const source = getZone(zones, from);
  const n = Math.min(count, source.cards.length);
  const moved = source.cards.slice(source.cards.length - n);
  const next = setCards(zones, from, source.cards.slice(0, source.cards.length - n));
  return addCards(next, to, moved, opts);
}

/** Return a new ZoneMap with the given zone shuffled. */
export function shuffleZone(
  zones: ZoneMap,
  id: string,
  random: RandomSource,
): ZoneMap {
  return setCards(zones, id, random.shuffle(getZone(zones, id).cards));
}

export interface DrawOptions {
  /** Flip drawn cards on arrival (e.g. `true` when drawing into a hand). */
  faceUp?: boolean;
  /**
   * When `from` runs out, reshuffle this zone (typically the discard pile)
   * back into `from` and keep drawing. Requires `random`.
   */
  reshuffleFrom?: string;
  /** Keep the top card of `reshuffleFrom` in place (conventional for discards). */
  keepTop?: boolean;
  random?: RandomSource;
}

/**
 * Draw `count` cards from the top of `from` into `to`, auto-reshuffling a
 * linked discard back into the pile when it runs dry. Draws as many as exist
 * when fewer than `count` remain.
 */
export function draw(
  zones: ZoneMap,
  from: string,
  to: string,
  count = 1,
  opts: DrawOptions = {},
): ZoneMap {
  let next = zones;
  for (let i = 0; i < count; i++) {
    if (countIn(next, from) === 0 && opts.reshuffleFrom) {
      if (!opts.random) {
        throw new Error('draw(): reshuffleFrom requires a RandomSource.');
      }
      const recycle = getZone(next, opts.reshuffleFrom);
      const keep = opts.keepTop ? 1 : 0;
      if (recycle.cards.length > keep) {
        const kept = keep ? recycle.cards.slice(-keep) : [];
        const back = recycle.cards
          .slice(0, recycle.cards.length - keep)
          .map((c) => ({ ...c, faceUp: false }));
        next = setCards(next, opts.reshuffleFrom, kept);
        next = setCards(next, from, opts.random.shuffle(back));
      }
    }
    if (countIn(next, from) === 0) break;
    next = moveTop(next, from, to, 1, { faceUp: opts.faceUp });
  }
  return next;
}

/** Anonymous stand-in for a card a viewer may not see. Counts and stable ids
 * are preserved so UIs can still render backs and key list items. */
function stub(zoneId: string, index: number): Card {
  return { id: `hidden:${zoneId}:${index}`, faceUp: false };
}

/**
 * Derive the view of `zones` that `viewerId` is allowed to see:
 *   - `public` zones keep their cards, but face-down cards hide their face;
 *   - `owner` zones are intact for their owner and stubbed for everyone else;
 *   - `hidden` zones are stubbed for everyone (only counts survive).
 *
 * Games that keep all hidden information inside zones get network-safe
 * redaction for free — {@link import('./flow').defineGame} wires this up
 * automatically when the game state has a `zones` property.
 */
export function redactZones(zones: ZoneMap, viewerId: PlayerId): ZoneMap {
  const out: ZoneMap = {};
  for (const zone of Object.values(zones)) {
    let cards: Card[];
    switch (zone.visibility) {
      case 'public':
        cards = zone.cards.map(publicView);
        break;
      case 'owner':
        cards =
          zone.owner === viewerId
            ? zone.cards
            : zone.cards.map((_, i) => stub(zone.id, i));
        break;
      case 'hidden':
        cards = zone.cards.map((_, i) => stub(zone.id, i));
        break;
    }
    out[zone.id] = { ...zone, cards };
  }
  return out;
}
