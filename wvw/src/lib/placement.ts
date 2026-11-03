/**
 * Matchup-map placement (pure, unit-tested): each raid of the three teams of
 * one matchup goes to its map (or Jumper) and into the third of the colour of
 * the team that ORGANISES it — e.g. a red-team raid on EBG → EBG's red third,
 * a green-team raid on the Red Borderlands → that map's green third.
 */
import type { Color, MatchSummary, PublicEvent } from '../shared/types';
import { COLORS } from '../shared/types';
import type { MapId } from '../shared/constants';

const MAP_IDS: MapId[] = ['ebg', 'red', 'blue', 'green', 'jumper'];

export interface MapSlot {
  e: PublicEvent;
  start: number;
  end: number;
}

export interface Placed {
  e: PublicEvent;
  start: number;
  end: number;
  color: Color;
  live: boolean;
  /** Further occurrences of the same raid in the window. */
  more: number;
}

/** Pure: slots → one entry per raid of the three teams, keyed by map then colour. */
export function placeRaids(match: Pick<MatchSummary, 'sides'>, slots: MapSlot[], now: number): Record<MapId, Record<Color, Placed[]>> {
  const colorOf = new Map<number, Color>();
  for (const c of COLORS) if (match.sides[c].teamId) colorOf.set(match.sides[c].teamId!, c);
  const byEvent = new Map<string, Placed>();
  for (const s of [...slots].sort((a, b) => a.start - b.start)) {
    const color = colorOf.get(s.e.teamId);
    if (!color) continue;
    const prev = byEvent.get(s.e.id);
    if (prev) {
      prev.more++;
      continue;
    }
    byEvent.set(s.e.id, { e: s.e, start: s.start, end: s.end, color, live: !!s.e.liveRunId || (s.start <= now && now < s.end), more: 0 });
  }
  const out = {} as Record<MapId, Record<Color, Placed[]>>;
  for (const m of MAP_IDS) out[m] = { red: [], blue: [], green: [] };
  for (const p of byEvent.values()) (out[p.e.map ?? 'jumper'] ?? out.jumper)[p.color].push(p);
  for (const m of Object.values(out)) for (const c of COLORS) m[c].sort((a, b) => Number(b.live) - Number(a.live) || a.start - b.start);
  return out;
}

