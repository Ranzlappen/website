/**
 * Phase 3 — run metrics + guild aggregates.
 *
 * Sources, in order of trust for squad size:
 *   1. arcdps logs uploaded to dps.report (Elite Insights JSON) — exact squad
 *   2. voice-channel headcount (reserved for the deferred Discord integration)
 *   3. verified check-ins
 *   4. the commander's reported peak
 * Team K/D comes from our own 5-minute per-map samples (team-level, so it's
 * context — several squads can share a map), objective claims from the public
 * claim log. Player identities from logs are discarded immediately.
 */
import { logger } from 'firebase-functions/v2';
import { COL, db } from './config';
import { colorOfTeam, sampleAt, windowDelta, type MatchSample } from './matchData';
import { LIMITS, MAPS, RATING_AXES, type RatingAxis } from './shared/constants';
import { utcDateKey } from './shared/time';
import type { GuildStats, MatchSummary, PublicMatches, PublicRun, RunMetrics } from './shared/types';

export interface LogSummary {
  permalink: string;
  squad: number;
  kills: number;
  deaths: number;
  durationMin: number;
}

/** Pure: Elite Insights JSON → counts. Never keeps names/accounts. */
export function parseEiJson(json: unknown): Omit<LogSummary, 'permalink'> | null {
  const j = json as {
    durationMS?: number;
    duration?: string;
    players?: Array<{
      notInSquad?: boolean;
      statsAll?: Array<{ killed?: number }>;
      defenses?: Array<{ deadCount?: number }>;
    }>;
  };
  if (!j || !Array.isArray(j.players)) return null;
  const squad = j.players.filter((p) => !p.notInSquad);
  if (!squad.length) return null;
  const kills = squad.reduce((s, p) => s + (Number(p.statsAll?.[0]?.killed) || 0), 0);
  const deaths = squad.reduce((s, p) => s + (Number(p.defenses?.[0]?.deadCount) || 0), 0);
  const durationMin = Math.round((Number(j.durationMS) || 0) / 60_000);
  return { squad: squad.length, kills, deaths, durationMin };
}

export async function fetchLog(permalink: string): Promise<LogSummary | null> {
  if (!/^https:\/\/(?:[a-z]\.)?dps\.report\/[A-Za-z0-9_-]+$/.test(permalink)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`https://dps.report/getJson?permalink=${encodeURIComponent(permalink)}`, {
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const parsed = parseEiJson(await res.json());
    return parsed ? { permalink, ...parsed } : null;
  } catch (e) {
    logger.warn('wvw dps.report fetch failed', { permalink, error: String(e) });
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function summarizeLogs(logs: LogSummary[]): RunMetrics['logs'] {
  if (!logs.length) return null;
  return {
    count: logs.length,
    maxSquad: Math.max(...logs.map((l) => l.squad)),
    kills: logs.reduce((s, l) => s + l.kills, 0),
    deaths: logs.reduce((s, l) => s + l.deaths, 0),
    durationMin: logs.reduce((s, l) => s + l.durationMin, 0),
  };
}

export function pickPeak(input: {
  logs: RunMetrics['logs'];
  voice: RunMetrics['voice'];
  checkins: number;
  reported: number | null;
}): Pick<RunMetrics, 'peak' | 'peakSource'> {
  if (input.logs?.maxSquad) return { peak: input.logs.maxSquad, peakSource: 'logs' };
  if (input.voice?.peak) return { peak: input.voice.peak, peakSource: 'voice' };
  if (input.checkins > 0) return { peak: input.checkins, peakSource: 'checkins' };
  if (input.reported) return { peak: input.reported, peakSource: 'reported' };
  return { peak: null, peakSource: null };
}

async function samplesFor(matchId: string, from: number, to: number): Promise<MatchSample[]> {
  const days = new Set([utcDateKey(from), utcDateKey(to)]);
  const docs = await Promise.all([...days].map((d) => db().collection(COL.matchDays).doc(`${matchId}_${d}`).get()));
  return docs.flatMap((d) => (d.get('samples') ?? []) as MatchSample[]).sort((a, b) => a.t - b.t);
}

export interface RunPrivate {
  commanderUid: string;
  map: string;
  voiceChannelId: string | null;
  status: 'live' | 'ended';
  reportedPeak: number | null;
  logs: LogSummary[];
  voice: { samples: number; sum: number; peak: number } | null;
}

export async function computeRunMetrics(run: PublicRun, priv: RunPrivate): Promise<RunMetrics> {
  const end = run.endedAt ?? Date.now();
  const durationMin = Math.max(0, Math.round((end - run.startedAt) / 60_000));

  let team: RunMetrics['team'] = null;
  if (run.matchId) {
    const matches = (await db().collection(COL.public).doc('matches').get()).data() as PublicMatches | undefined;
    const match = matches?.matches.find((m: MatchSummary) => m.id === run.matchId);
    const color = match ? colorOfTeam(match, run.teamId) : null;
    if (color) {
      const samples = await samplesFor(run.matchId, run.startedAt, end);
      const a = sampleAt(samples, run.startedAt);
      const b = sampleAt(samples, end);
      if (a && b && b.t > a.t) {
        const apiType = MAPS.find((m) => m.id === priv.map)?.apiType ?? null;
        const d = windowDelta(a, b, color, apiType ? [apiType] : []);
        team = { ...d, kdr: d.deaths > 0 ? Math.round((d.kills / d.deaths) * 100) / 100 : null };
      }
    }
  }

  // Objective claims are per guild — independent raids have none to count.
  const claims = run.guildId
    ? (
        await db()
          .collection(COL.claimLog)
          .where('guildId', '==', run.guildId)
          .where('claimedAt', '>=', run.startedAt)
          .where('claimedAt', '<=', end)
          .count()
          .get()
      ).data().count
    : 0;


  const voice = priv.voice?.samples
    ? { peak: priv.voice.peak, avg: Math.round((priv.voice.sum / priv.voice.samples) * 10) / 10, samples: priv.voice.samples }
    : null;
  const logs = summarizeLogs(priv.logs ?? []);
  const checkins = run.checkins ?? 0;
  return {
    durationMin,
    ...pickPeak({ logs, voice, checkins, reported: priv.reportedPeak }),
    checkins,
    voice,
    team,
    claims,
    logs,
  };
}

// ── Guild aggregates ────────────────────────────────────────────────────

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

export interface RatingRow {
  uid: string;
  scores: Record<RatingAxis, number>;
}

/**
 * Pure: per-rater mean first, then the mean of rater means — so one person
 * rating ten raids doesn't outweigh ten people rating once. Hidden below
 * LIMITS.minRatingsToShow distinct raters.
 */
export function aggregateRatings(rows: RatingRow[]): GuildStats['ratings'] {
  const byRater = new Map<string, RatingRow[]>();
  for (const r of rows) byRater.set(r.uid, [...(byRater.get(r.uid) ?? []), r]);
  const n = byRater.size;
  if (n < LIMITS.minRatingsToShow) return null;
  const out = { n } as { n: number } & Record<RatingAxis, number>;
  for (const axis of RATING_AXES) {
    const raterMeans = [...byRater.values()].map((rs) => rs.reduce((s, r) => s + r.scores[axis.id], 0) / rs.length);
    out[axis.id] = mean(raterMeans) ?? 0;
  }
  return out;
}

export async function aggregateGuildStats(guildId: string): Promise<GuildStats> {
  const now = Date.now();
  const [runs, ratings] = await Promise.all([
    db()
      .collection(COL.runs)
      .where('guildId', '==', guildId)
      .where('endedAt', '>=', now - 30 * 86_400_000)
      .get(),
    db()
      .collection(COL.ratings)
      .where('guildId', '==', guildId)
      .where('createdAt', '>=', now - 90 * 86_400_000)
      .get(),
  ]);
  const ended = runs.docs.map((d) => d.data() as PublicRun).filter((r) => r.status === 'ended' && r.metrics);
  const stats: GuildStats = {
    runs30d: ended.length,
    avgDurationMin: mean(ended.map((r) => r.metrics!.durationMin ?? 0).filter((x) => x > 0)),
    avgPeak: mean(ended.map((r) => r.metrics!.peak).filter((x): x is number => x != null)),
    avgKdr: mean(ended.map((r) => r.metrics!.team?.kdr).filter((x): x is number => x != null)),
    ratings: aggregateRatings(ratings.docs.map((d) => d.data() as RatingRow)),
    updatedAt: now,
  };
  await db().collection(COL.guildDir).doc(guildId).set({ stats }, { merge: true });
  return stats;
}
