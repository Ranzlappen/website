/**
 * Pure transforms over raw `/v2/wvw/matches` data (unit-tested, no I/O).
 *
 * Phase 0 runs entirely on public data: match scores, plus the objective
 * `claimed_by` / `claimed_at` fields, which reveal which guilds are active on
 * which team right now — useful before a single commander signs up.
 */
import type { RawMatch } from './gw2';
import { regionOfMatch, teamFromAllWorlds } from './shared/teams';
import type { Color, MapSummary, MatchSummary, TeamSide } from './shared/types';
import { COLORS } from './shared/types';

export interface Claim {
  /** Stable per objective: "{matchId}_{objectiveId}". */
  key: string;
  matchId: string;
  objectiveId: string;
  objectiveType: string;
  mapType: string;
  color: Color;
  teamId: number | null;
  guildId: string;
  claimedAt: number;
}

const lc = (s: string) => s.toLowerCase() as Color;

function num(o: Record<string, number> | undefined, c: Color): number {
  return Number(o?.[c] ?? o?.[c[0].toUpperCase() + c.slice(1)] ?? 0) || 0;
}

export function extractClaims(matches: RawMatch[]): Claim[] {
  const out: Claim[] = [];
  for (const m of matches) {
    for (const map of m.maps ?? []) {
      for (const o of map.objectives ?? []) {
        if (!o.claimed_by || !o.claimed_at) continue;
        const color = lc(o.owner ?? '');
        if (!COLORS.includes(color)) continue;
        const claimedAt = Date.parse(o.claimed_at);
        if (!Number.isFinite(claimedAt)) continue;
        out.push({
          key: `${m.id}_${o.id}`,
          matchId: m.id,
          objectiveId: o.id,
          objectiveType: o.type,
          mapType: map.type,
          color,
          teamId: teamFromAllWorlds(m.all_worlds?.[color]),
          guildId: o.claimed_by,
          claimedAt,
        });
      }
    }
  }
  return out;
}

/** Claims that are new since the previous poll (`prev`: key → claimedAt). */
export function diffClaims(prev: Record<string, number>, claims: Claim[]): Claim[] {
  return claims.filter((c) => prev[c.key] !== c.claimedAt);
}

export function claimState(claims: Claim[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of claims) out[c.key] = c.claimedAt;
  return out;
}

export interface HeldInfo {
  count: number;
  teamId: number | null;
  matchId: string;
}

export function heldByGuild(claims: Claim[]): Map<string, HeldInfo> {
  const out = new Map<string, HeldInfo>();
  for (const c of claims) {
    const cur = out.get(c.guildId);
    if (cur) cur.count++;
    else out.set(c.guildId, { count: 1, teamId: c.teamId, matchId: c.matchId });
  }
  return out;
}

export type ObjectiveBucket = 'camps' | 'towers' | 'keeps' | 'castles' | null;

export function bucketOf(type: string): ObjectiveBucket {
  switch (type) {
    case 'Camp':
      return 'camps';
    case 'Tower':
      return 'towers';
    case 'Keep':
      return 'keeps';
    case 'Castle':
      return 'castles';
    default:
      return null;
  }
}

export function summarizeMatches(matches: RawMatch[]): MatchSummary[] {
  const claims = extractClaims(matches);
  const out: MatchSummary[] = [];
  for (const m of matches) {
    const region = regionOfMatch(m.id);
    if (!region) continue;
    const sides = {} as Record<Color, TeamSide>;
    for (const c of COLORS) {
      const owned = { camps: 0, towers: 0, keeps: 0, castles: 0 };
      for (const map of m.maps ?? []) {
        for (const o of map.objectives ?? []) {
          if (lc(o.owner ?? '') !== c) continue;
          const b = bucketOf(o.type);
          if (b) owned[b]++;
        }
      }
      const guilds = new Set(claims.filter((x) => x.matchId === m.id && x.color === c).map((x) => x.guildId));
      sides[c] = {
        teamId: teamFromAllWorlds(m.all_worlds?.[c]),
        score: num(m.scores, c),
        victoryPoints: num(m.victory_points, c),
        kills: num(m.kills, c),
        deaths: num(m.deaths, c),
        owned,
        claimingGuilds: guilds.size,
      };
    }
    const maps: MapSummary[] = (m.maps ?? []).map((map) => ({
      type: map.type,
      kills: { red: num(map.kills, 'red'), blue: num(map.kills, 'blue'), green: num(map.kills, 'green') },
      deaths: { red: num(map.deaths, 'red'), blue: num(map.deaths, 'blue'), green: num(map.deaths, 'green') },
      scores: { red: num(map.scores, 'red'), blue: num(map.scores, 'blue'), green: num(map.scores, 'green') },
    }));
    out.push({ id: m.id, region, start: m.start_time, end: m.end_time, sides, maps });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

/** Compact cumulative kill/death sample for later run-window deltas. */
export interface MatchSample {
  t: number;
  /** mapType → [redK, blueK, greenK, redD, blueD, greenD] */
  m: Record<string, number[]>;
}

export function sampleOf(match: RawMatch, t: number): MatchSample {
  const m: Record<string, number[]> = {};
  for (const map of match.maps ?? []) {
    m[map.type] = [
      num(map.kills, 'red'),
      num(map.kills, 'blue'),
      num(map.kills, 'green'),
      num(map.deaths, 'red'),
      num(map.deaths, 'blue'),
      num(map.deaths, 'green'),
    ];
  }
  return { t, m };
}

/** Which colour a team plays in a match (null if not in it). */
export function colorOfTeam(match: Pick<MatchSummary, 'sides'>, teamId: number): Color | null {
  for (const c of COLORS) if (match.sides[c].teamId === teamId) return c;
  return null;
}

/**
 * Team kills/deaths between two samples on the given map types (all maps when
 * `mapTypes` is empty). Samples are cumulative, so the delta is the window.
 */
export function windowDelta(
  startSample: MatchSample,
  endSample: MatchSample,
  color: Color,
  mapTypes: string[],
): { kills: number; deaths: number } {
  const idx = COLORS.indexOf(color);
  const types = mapTypes.length ? mapTypes : Object.keys(endSample.m);
  let kills = 0;
  let deaths = 0;
  for (const t of types) {
    const a = startSample.m[t];
    const b = endSample.m[t];
    if (!a || !b) continue;
    kills += Math.max(0, b[idx] - a[idx]);
    deaths += Math.max(0, b[idx + 3] - a[idx + 3]);
  }
  return { kills, deaths };
}

/** Nearest sample at-or-before `t` (or the first after, if none before). */
export function sampleAt(samples: MatchSample[], t: number): MatchSample | null {
  if (!samples.length) return null;
  let best: MatchSample | null = null;
  for (const s of samples) {
    if (s.t <= t && (!best || s.t > best.t)) best = s;
  }
  if (best) return best;
  return samples.reduce((a, b) => (b.t < a.t ? b : a));
}
