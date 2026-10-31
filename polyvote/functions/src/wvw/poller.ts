/**
 * Phase 0 — public match poller (every 5 minutes).
 *
 * 1. `/v2/wvw/matches?ids=all` + timers → `wvwPublic/matches` (one doc the
 *    whole site reads for scores, relink + reset countdowns).
 * 2. New objective claims → `wvwClaimLog` (deduped by objective + claimedAt)
 *    and weekly per-guild activity counters on `wvwGuildDir/{guildId}`.
 * 3. Per-map cumulative kills/deaths → `wvwMatchDays/{match}_{YYYYMMDD}`
 *    (Phase 3 uses these to score a raid's window).
 * 4. Every 30 min: `/v2/wvw/guilds/{na,eu}` → team guild counts + the
 *    guild→team map (`wvwState/guildMap_{region}`).
 *
 * The previous claim set lives in `wvwState/poller` so only *changes* are
 * written (no write per objective per poll).
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import { COL, db } from './config';
import { allMatches, guildPublic, timer, wvwGuildMap, type RawMatch } from './gw2';
import {
  bucketOf,
  claimState,
  diffClaims,
  extractClaims,
  heldByGuild,
  sampleOf,
  summarizeMatches,
  type Claim,
} from './matchData';
import { regionOfTeam, type Region } from './shared/teams';
import { isoWeekKey, utcDateKey } from './shared/time';
import type { PublicMatches } from './shared/types';

interface PollerState {
  claims: Record<string, number>;
  /** guildId → objectives held at the last poll. */
  held: Record<string, number>;
  named: string[];
  guildMapAt: number;
  teamGuildCounts: Record<string, number>;
}

const GUILD_MAP_EVERY_MS = 30 * 60_000;
const NAME_LOOKUPS_PER_RUN = 40;

export async function refreshGuildMaps(state: PollerState): Promise<void> {
  const counts: Record<string, number> = {};
  for (const region of ['na', 'eu'] as Region[]) {
    try {
      const map = await wvwGuildMap(region);
      for (const t of Object.values(map)) counts[String(t)] = (counts[String(t)] ?? 0) + 1;
      await db()
        .collection(COL.state)
        .doc(`guildMap_${region}`)
        .set({ at: Date.now(), map });
    } catch (e) {
      logger.warn('wvw guild map refresh failed', { region, error: String(e) });
    }
  }
  if (Object.keys(counts).length) state.teamGuildCounts = counts;
  state.guildMapAt = Date.now();
}

async function writeClaims(newClaims: Claim[]): Promise<void> {
  const now = Date.now();
  // Aggregate per guild for one merge-write each.
  const perGuild = new Map<string, { claims: number; buckets: Record<string, number>; last: Claim }>();
  for (const c of newClaims) {
    const g = perGuild.get(c.guildId) ?? { claims: 0, buckets: {}, last: c };
    g.claims++;
    const b = bucketOf(c.objectiveType);
    if (b) g.buckets[b] = (g.buckets[b] ?? 0) + 1;
    if (c.claimedAt >= g.last.claimedAt) g.last = c;
    perGuild.set(c.guildId, g);
  }

  const writes: Array<(b: FirebaseFirestore.WriteBatch) => void> = [];
  for (const c of newClaims) {
    writes.push((b) =>
      b.set(db().collection(COL.claimLog).doc(`${c.key}_${c.claimedAt}`), {
        guildId: c.guildId,
        matchId: c.matchId,
        objectiveId: c.objectiveId,
        objectiveType: c.objectiveType,
        mapType: c.mapType,
        color: c.color,
        teamId: c.teamId,
        claimedAt: c.claimedAt,
      }),
    );
  }
  for (const [guildId, g] of perGuild) {
    const week = isoWeekKey(g.last.claimedAt);
    const weekPatch: Record<string, unknown> = { claims: FieldValue.increment(g.claims) };
    for (const [b, n] of Object.entries(g.buckets)) weekPatch[b] = FieldValue.increment(n);
    const region = g.last.teamId ? regionOfTeam(g.last.teamId) : null;
    writes.push((b) =>
      b.set(
        db().collection(COL.guildDir).doc(guildId),
        {
          id: guildId,
          activity: { [week]: weekPatch },
          lastSeenAt: Math.max(g.last.claimedAt, 0),
          ...(g.last.teamId ? { teamId: g.last.teamId } : {}),
          ...(region ? { region } : {}),
          updatedAt: now,
        },
        { merge: true },
      ),
    );
  }
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db().batch();
    for (const w of writes.slice(i, i + 400)) w(batch);
    await batch.commit();
  }
}

/** Write `heldNow` only for guilds whose count changed since the last poll. */
export function heldChanges(held: Map<string, { count: number }>, prev: Record<string, number>): Array<[string, number]> {
  const ops: Array<[string, number]> = [];
  for (const [g, h] of held) if (prev[g] !== h.count) ops.push([g, h.count]);
  for (const g of Object.keys(prev)) if (!held.has(g) && prev[g] !== 0) ops.push([g, 0]);
  return ops;
}

async function writeHeld(ops: Array<[string, number]>): Promise<void> {
  const now = Date.now();
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db().batch();
    for (const [g, n] of ops.slice(i, i + 400)) {
      batch.set(db().collection(COL.guildDir).doc(g), { id: g, heldNow: n, updatedAt: now }, { merge: true });
    }
    await batch.commit();
  }
}

/**
 * Fill name/tag for directory docs first seen via claims. Known-named ids are
 * tracked in the poller state, so this costs nothing once a guild is named.
 */
export async function fillMissingGuildNames(
  candidates: string[],
  named: Set<string>,
  limit = NAME_LOOKUPS_PER_RUN,
): Promise<number> {
  let filled = 0;
  for (const id of candidates.filter((g) => !named.has(g)).slice(0, limit)) {
    try {
      const g = await guildPublic(id);
      await db()
        .collection(COL.guildDir)
        .doc(id)
        .set({ id, name: g.name, tag: g.tag, updatedAt: Date.now() }, { merge: true });
      named.add(id);
      filled++;
    } catch (e) {
      logger.warn('wvw guild name lookup failed', { guildId: id, error: String(e) });
    }
  }
  return filled;
}

async function writeSamples(raw: RawMatch[], now: number): Promise<void> {
  const batch = db().batch();
  const day = utcDateKey(now);
  for (const m of raw) {
    batch.set(
      db().collection(COL.matchDays).doc(`${m.id}_${day}`),
      { matchId: m.id, day, start: m.start_time, samples: FieldValue.arrayUnion(sampleOf(m, now)) },
      { merge: true },
    );
  }
  await batch.commit();
}

export async function pollOnce(): Promise<{ matches: number; newClaims: number }> {
  const now = Date.now();
  const stateRef = db().collection(COL.state).doc('poller');
  const stateSnap = await stateRef.get();
  const state: PollerState = {
    claims: {},
    held: {},
    named: [],
    guildMapAt: 0,
    teamGuildCounts: {},
    ...((stateSnap.data() ?? {}) as Partial<PollerState>),
  };

  const raw = await allMatches();
  const [lockout, teamAssignment] = await Promise.all([
    timer('lockout').catch(() => ({}) as Record<string, string>),
    timer('teamAssignment').catch(() => ({}) as Record<string, string>),
  ]);

  if (now - state.guildMapAt > GUILD_MAP_EVERY_MS) await refreshGuildMaps(state);

  const pub: PublicMatches = {
    updatedAt: now,
    matches: summarizeMatches(raw),
    timers: {
      lockout: { na: lockout.na ?? null, eu: lockout.eu ?? null },
      teamAssignment: { na: teamAssignment.na ?? null, eu: teamAssignment.eu ?? null },
    },
    teamGuildCounts: state.teamGuildCounts,
  };
  await db().collection(COL.public).doc('matches').set(pub);

  const claims = extractClaims(raw);
  const fresh = diffClaims(state.claims, claims);
  if (fresh.length) await writeClaims(fresh);
  const held = heldByGuild(claims);
  // Older state stored `held` as an id array — treat that as "unknown counts".
  const prevHeld = Array.isArray(state.held) ? {} : state.held;
  await writeHeld(heldChanges(held, prevHeld));
  await writeSamples(raw, now);

  const named = new Set(state.named);
  await fillMissingGuildNames([...held.keys(), ...fresh.map((c) => c.guildId)], named);

  await stateRef.set({
    claims: claimState(claims),
    held: Object.fromEntries([...held].map(([g, h]) => [g, h.count])),
    named: [...named].slice(-20_000),
    guildMapAt: state.guildMapAt,
    teamGuildCounts: state.teamGuildCounts,
  });

  return { matches: raw.length, newClaims: fresh.length };
}

export const poll = onSchedule(
  { schedule: 'every 5 minutes', timeoutSeconds: 240, memory: '512MiB', retryCount: 0 },
  async () => {
    const r = await pollOnce();
    logger.info('wvw poll', r);
  },
);
