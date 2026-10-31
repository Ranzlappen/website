/**
 * Maintenance (every 10 minutes).
 *
 *  - Relink detection: `/v2/wvw/timers/teamAssignment` (cached in
 *    wvwPublic/matches) moves forward once a relink happened. 30 minutes
 *    after it, members of that region are re-verified with their stored key
 *    in batches → new team, events retargeted, Discord team roles swapped.
 *  - Weekly refresh of every verification (guild changes, commander tag).
 *  - Debounced guild-directory rebuild + guild stats for dirty guilds.
 *  - Event index rebuild (archives finished schedules) + refresh of the
 *    "Next:" time on weekly Discord announcements.
 *  - Auto-end runs that were left live for > 12h.
 *  - Daily purge of old claim logs / samples / jobs.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { COL, WVW_SECRETS, db } from './config';
import { reverifyStored } from './members';
import { rebuildAllEventIndexes, rebuildGuildIndex, type EventDoc } from './indexes';
import { takeDirty } from './state';
import { aggregateGuildStats } from './metrics';
import { finalizeRun } from './runs';
import { nextOccurrence } from './shared/time';
import type { PublicMatches } from './shared/types';
import type { Region } from './shared/teams';
import { announceEvent } from './discord/announce';
import type { DetailsDoc } from './events';

const SETTLE_MS = 30 * 60_000;
const REVERIFY_BATCH = 40;
const REFRESH_BATCH = 20;
const REFRESH_AFTER_MS = 7 * 86_400_000;

interface RelinkState {
  next: Partial<Record<Region, string>>;
  last: Partial<Record<Region, number>>;
  guildIndexAt: number;
  eventIndexAt: number;
  purgeAt: number;
}

/** Pure: advance relink bookkeeping from the current timer values. */
export function advanceRelink(
  state: Pick<RelinkState, 'next' | 'last'>,
  timers: Partial<Record<Region, string | null>>,
  now: number,
): { next: RelinkState['next']; last: RelinkState['last']; happened: Region[] } {
  const next = { ...state.next };
  const last = { ...state.last };
  const happened: Region[] = [];
  for (const r of ['na', 'eu'] as Region[]) {
    const prev = next[r];
    if (prev && Date.parse(prev) <= now && last[r] !== Date.parse(prev)) {
      last[r] = Date.parse(prev);
      happened.push(r);
    }
    const cur = timers[r];
    if (cur && Date.parse(cur) > now) next[r] = cur;
  }
  return { next, last, happened };
}

async function reverifyBatch(region: Region, since: number): Promise<number> {
  const snap = await db()
    .collection(COL.members)
    .where('region', '==', region)
    .where('verified', '==', true)
    .where('teamCheckedAt', '<', since)
    .limit(REVERIFY_BATCH)
    .get();
  let n = 0;
  for (const d of snap.docs) {
    await reverifyStored(d.id).catch((e) => logger.warn('wvw reverify', { uid: d.id, e: String(e) }));
    n++;
  }
  return n;
}

async function refreshStale(now: number): Promise<number> {
  const snap = await db()
    .collection(COL.members)
    .where('verified', '==', true)
    .where('lastVerifiedAt', '<', now - REFRESH_AFTER_MS)
    .limit(REFRESH_BATCH)
    .get();
  for (const d of snap.docs) await reverifyStored(d.id).catch(() => {});
  return snap.size;
}

async function refreshWeeklyAnnouncements(now: number): Promise<number> {
  const snap = await db()
    .collection(COL.events)
    .where('archived', '==', false)
    .where('status', '==', 'scheduled')
    .get();
  let n = 0;
  for (const d of snap.docs) {
    if (n >= 20) break;
    const e = d.data() as EventDoc;
    if (e.schedule.repeat !== 'weekly' || e.visibility !== 'public') continue;
    const next = nextOccurrence(e.schedule, now)?.start ?? null;
    const detRef = db().collection(COL.eventDetails).doc(e.id);
    const det = (await detRef.get()).data() as (DetailsDoc & { announcedNext?: number | null }) | undefined;
    if (!det?.discord || det.announcedNext === next) continue;
    try {
      const msg = await announceEvent(e, det.discord);
      await detRef.set({ announcedNext: next, ...(msg ? { discord: msg } : {}) }, { merge: true });
      n++;
    } catch (err) {
      logger.warn('wvw announcement refresh', { eventId: e.id, error: String(err) });
    }
  }
  return n;
}

async function endStaleRuns(now: number): Promise<number> {
  const snap = await db().collection(COL.runs).where('status', '==', 'live').get();
  let n = 0;
  for (const d of snap.docs) {
    if ((d.get('startedAt') as number) < now - 12 * 3600_000) {
      await finalizeRun(d.id, { force: true }).catch((e) => logger.warn('wvw auto-end', { e: String(e) }));
      n++;
    }
  }
  return n;
}

async function deleteOlderThan(col: string, field: string, cutoff: number): Promise<number> {
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const snap = await db().collection(col).where(field, '<', cutoff).limit(400).get();
    if (snap.empty) break;
    const batch = db().batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    total += snap.size;
  }
  return total;
}

export async function maintainOnce(): Promise<Record<string, number | string>> {
  const now = Date.now();
  const ref = db().collection(COL.state).doc('relink');
  const state: RelinkState = { next: {}, last: {}, guildIndexAt: 0, eventIndexAt: 0, purgeAt: 0, ...((await ref.get()).data() ?? {}) };
  const pub = (await db().collection(COL.public).doc('matches').get()).data() as PublicMatches | undefined;
  const out: Record<string, number | string> = {};

  const adv = advanceRelink(state, pub?.timers.teamAssignment ?? {}, now);
  state.next = adv.next;
  state.last = adv.last;
  if (adv.happened.length) {
    out.relink = adv.happened.join(',');
    // Force a fresh guild→team map on the next poll.
    await db().collection(COL.state).doc('poller').set({ guildMapAt: 0 }, { merge: true });
    state.guildIndexAt = 0;
  }
  for (const r of ['na', 'eu'] as Region[]) {
    const last = state.last[r];
    if (last && now >= last + SETTLE_MS && now < last + 3 * 86_400_000) {
      out[`reverified_${r}`] = await reverifyBatch(r, last + SETTLE_MS);
    }
  }
  out.refreshed = await refreshStale(now);

  const dirty = await takeDirty();
  if (dirty.guildIndex || now - state.guildIndexAt > 60 * 60_000) {
    const [naMap, euMap] = await Promise.all([
      db().collection(COL.state).doc('guildMap_na').get(),
      db().collection(COL.state).doc('guildMap_eu').get(),
    ]);
    out.guildsEu = await rebuildGuildIndex('eu', (euMap.get('map') as Record<string, number>) ?? null);
    out.guildsNa = await rebuildGuildIndex('na', (naMap.get('map') as Record<string, number>) ?? null);
    state.guildIndexAt = now;
  }
  for (const g of dirty.guildStatsIds.slice(0, 50)) await aggregateGuildStats(g).catch(() => {});

  if (now - state.eventIndexAt > 60 * 60_000) {
    await rebuildAllEventIndexes();
    state.eventIndexAt = now;
  }
  out.announcements = await refreshWeeklyAnnouncements(now);
  out.autoEnded = await endStaleRuns(now);

  if (now - state.purgeAt > 86_400_000) {
    out.purgedClaims = await deleteOlderThan(COL.claimLog, 'claimedAt', now - 120 * 86_400_000);
    out.purgedJobs = await deleteOlderThan('wvwDiscordJobs', 'at', now - 86_400_000);
    out.purgedAudit = await deleteOlderThan(COL.audit, 'at', now - 365 * 86_400_000);
    const days = await db().collection(COL.matchDays).where('day', '<', utcKey(now - 60 * 86_400_000)).limit(400).get();
    const b = db().batch();
    for (const d of days.docs) b.delete(d.ref);
    await b.commit();
    out.purgedSamples = days.size;
    state.purgeAt = now;
  }

  await ref.set(state);
  return out;
}

function utcKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

export const maintain = onSchedule(
  { schedule: 'every 10 minutes', timeoutSeconds: 300, memory: '512MiB', secrets: [WVW_SECRETS], retryCount: 0 },
  async () => {
    const r = await maintainOnce();
    logger.info('wvw maintain', r);
  },
);
