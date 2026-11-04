/**
 * Phase 0 — public match poller (every 5 minutes).
 *
 * Built to keep Firestore writes and GW2 API calls low (see README "Usage &
 * cost"):
 *
 * 1. `/v2/wvw/matches?ids=all` → `wvwPublic/matches` (one doc the whole site
 *    reads for scores, relink + reset countdowns). The two timer endpoints only
 *    change weekly, so they're fetched every 30 minutes and cached.
 * 2. New objective claims → weekly per-guild activity counters on
 *    `wvwGuildDir/{guildId}` (one merge-write per claiming guild). Individual
 *    claims go to `wvwClaimLog` only for guilds with a **live run** — that log
 *    exists to count a run's claims.
 * 3. Objectives held per guild → ONE doc `wvwPublic/held`, written only when a
 *    count changed (was one write per guild).
 * 4. Per-map cumulative kills/deaths → `wvwMatchDays/{match}_{YYYYMMDD}`, only
 *    for matches with a live run (Phase 3 scores a run's window from these).
 * 5. Every 30 min: `/v2/wvw/guilds/{na,eu}` → team guild counts + the
 *    guild→team map (`wvwState/guildMap_{region}`, written only when changed).
 *
 * The previous claim set lives in `wvwState/poller` so only *changes* are
 * written (no write per objective per poll).
 */
import { createHash } from 'node:crypto';
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
import type { PublicHeld, PublicMatches } from './shared/types';

interface PollerState {
  claims: Record<string, number>;
  /** guildId → objectives held at the last poll. */
  held: Record<string, number>;
  /** `wvwPublic/held` has been written in the current format. */
  heldDocAt?: number;
  named: string[];
  guildMapAt: number;
  /** Hash of each region's last written guild→team map (skip identical writes). */
  guildMapSig?: Partial<Record<Region, string>>;
  teamGuildCounts: Record<string, number>;
  timers?: PublicMatches['timers'];
  timersAt?: number;
}

const GUILD_MAP_EVERY_MS = 30 * 60_000;
const TIMERS_EVERY_MS = 30 * 60_000;
const NAME_LOOKUPS_PER_RUN = 40;
/** Guild ids remembered as "already named" (keeps the state doc far below 1 MiB). */
const NAMED_KEEP = 10_000;

/** Stable fingerprint of a guild→team map (key order independent). */
export function mapSignature(map: Record<string, number>): string {
  const keys = Object.keys(map).sort();
  return createHash('sha1')
    .update(keys.map((k) => `${k}=${map[k]}`).join(','))
    .digest('base64');
}

export async function refreshGuildMaps(state: PollerState): Promise<void> {
  const counts: Record<string, number> = {};
  const sigs = { ...(state.guildMapSig ?? {}) };
  for (const region of ['na', 'eu'] as Region[]) {
    try {
      const map = await wvwGuildMap(region);
      for (const t of Object.values(map)) counts[String(t)] = (counts[String(t)] ?? 0) + 1;
      const sig = mapSignature(map);
      if (sig !== sigs[region]) {
        await db()
          .collection(COL.state)
          .doc(`guildMap_${region}`)
          .set({ at: Date.now(), map });
        sigs[region] = sig;
      }
    } catch (e) {
      logger.warn('wvw guild map refresh failed', { region, error: String(e) });
    }
  }
  if (Object.keys(counts).length) state.teamGuildCounts = counts;
  state.guildMapSig = sigs;
  state.guildMapAt = Date.now();
}

async function refreshTimers(state: PollerState, now: number): Promise<PublicMatches['timers']> {
  if (state.timers && now - (state.timersAt ?? 0) < TIMERS_EVERY_MS && state.guildMapAt !== 0) return state.timers;
  const [lockout, teamAssignment] = await Promise.all([
    timer('lockout').catch(() => null),
    timer('teamAssignment').catch(() => null),
  ]);
  const prev = state.timers;
  const timers: PublicMatches['timers'] = {
    lockout: lockout ? { na: lockout.na ?? null, eu: lockout.eu ?? null } : (prev?.lockout ?? { na: null, eu: null }),
    teamAssignment: teamAssignment
      ? { na: teamAssignment.na ?? null, eu: teamAssignment.eu ?? null }
      : (prev?.teamAssignment ?? { na: null, eu: null }),
  };
  state.timers = timers;
  // A failed fetch retries on the next poll instead of in 30 minutes.
  if (lockout && teamAssignment) state.timersAt = now;
  return timers;
}

/** Guild + match ids of runs that are live right now (≥ 1 read even when empty). */
async function liveRunScope(): Promise<{ guilds: Set<string>; matches: Set<string> }> {
  const snap = await db().collection(COL.runs).where('status', '==', 'live').select('guildId', 'matchId').get();
  const guilds = new Set<string>();
  const matches = new Set<string>();
  for (const d of snap.docs) {
    const g = d.get('guildId') as string | null | undefined;
    const m = d.get('matchId') as string | null | undefined;
    if (g) guilds.add(g);
    if (m) matches.add(m);
  }
  return { guilds, matches };
}

/** Claims worth logging individually: only those of guilds currently running a raid. */
export function claimsToLog(claims: Claim[], liveGuilds: Set<string>): Claim[] {
  return claims.filter((c) => liveGuilds.has(c.guildId));
}

async function writeClaims(newClaims: Claim[], liveGuilds: Set<string>): Promise<void> {
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
  for (const c of claimsToLog(newClaims, liveGuilds)) {
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

/** `wvwPublic/held`: objectives held right now, per region and guild (one doc). */
export function heldDoc(held: Map<string, { count: number; teamId: number | null }>, now: number): PublicHeld {
  const out: PublicHeld = { updatedAt: now, eu: {}, na: {} };
  for (const [g, h] of held) {
    const region = h.teamId ? regionOfTeam(h.teamId) : null;
    if (region) out[region][g] = h.count;
  }
  return out;
}

/**
 * Fill name/tag for directory docs first seen via claims. Known-named ids are
 * tracked in the poller state, so this costs nothing once a guild is named.
 */
export async function fillMissingGuildNames(
  candidates: string[],
  named: Set<string>,
  teamOf: Map<string, number | null> = new Map(),
  limit = NAME_LOOKUPS_PER_RUN,
): Promise<number> {
  let filled = 0;
  for (const id of [...new Set(candidates)].filter((g) => !named.has(g)).slice(0, limit)) {
    try {
      const g = await guildPublic(id);
      const teamId = teamOf.get(id) ?? null;
      const region = teamId ? regionOfTeam(teamId) : null;
      await db()
        .collection(COL.guildDir)
        .doc(id)
        .set(
          { id, name: g.name, tag: g.tag, ...(teamId ? { teamId } : {}), ...(region ? { region } : {}), updatedAt: Date.now() },
          { merge: true },
        );
      named.add(id);
      filled++;
    } catch (e) {
      logger.warn('wvw guild name lookup failed', { guildId: id, error: String(e) });
    }
  }
  return filled;
}

async function writeSamples(raw: RawMatch[], now: number): Promise<void> {
  if (!raw.length) return;
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

export async function pollOnce(): Promise<Record<string, number>> {
  const now = Date.now();
  const stateRef = db().collection(COL.state).doc('poller');
  const [stateSnap, live] = await Promise.all([stateRef.get(), liveRunScope()]);
  const state: PollerState = {
    claims: {},
    held: {},
    named: [],
    guildMapAt: 0,
    teamGuildCounts: {},
    ...((stateSnap.data() ?? {}) as Partial<PollerState>),
  };

  const raw = await allMatches();
  const timers = await refreshTimers(state, now);
  if (now - state.guildMapAt > GUILD_MAP_EVERY_MS) await refreshGuildMaps(state);

  const pub: PublicMatches = {
    updatedAt: now,
    matches: summarizeMatches(raw),
    timers,
    teamGuildCounts: state.teamGuildCounts,
  };
  await db().collection(COL.public).doc('matches').set(pub);

  const claims = extractClaims(raw);
  const fresh = diffClaims(state.claims, claims);
  if (fresh.length) await writeClaims(fresh, live.guilds);
  const held = heldByGuild(claims);
  // Older state stored `held` as an id array — treat that as "unknown counts".
  const prevHeld = Array.isArray(state.held) ? {} : state.held;
  const heldChanged = heldChanges(held, prevHeld).length > 0 || !state.heldDocAt;
  if (heldChanged) await db().collection(COL.public).doc('held').set(heldDoc(held, now));
  await writeSamples(
    raw.filter((m) => live.matches.has(m.id)),
    now,
  );

  const named = new Set(state.named);
  const teamOf = new Map<string, number | null>([...held].map(([g, h]) => [g, h.teamId]));
  for (const c of fresh) teamOf.set(c.guildId, c.teamId);
  await fillMissingGuildNames([...held.keys(), ...fresh.map((c) => c.guildId)], named, teamOf);

  await stateRef.set({
    claims: claimState(claims),
    held: Object.fromEntries([...held].map(([g, h]) => [g, h.count])),
    heldDocAt: heldChanged ? now : (state.heldDocAt ?? now),
    named: [...named].slice(-NAMED_KEEP),
    guildMapAt: state.guildMapAt,
    guildMapSig: state.guildMapSig ?? {},
    teamGuildCounts: state.teamGuildCounts,
    timers,
    timersAt: state.timersAt ?? 0,
  });

  return {
    matches: raw.length,
    newClaims: fresh.length,
    logged: claimsToLog(fresh, live.guilds).length,
    sampled: live.matches.size,
    heldWritten: heldChanged ? 1 : 0,
  };
}

export const poll = onSchedule(
  { schedule: 'every 5 minutes', timeoutSeconds: 240, memory: '512MiB', retryCount: 0 },
  async () => {
    const r = await pollOnce();
    logger.info('wvw poll', r);
  },
);
