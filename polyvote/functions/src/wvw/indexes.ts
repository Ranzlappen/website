/**
 * Public index documents.
 *
 * The browser never queries the big collections: each page reads one small,
 * precomputed doc under `wvwPublic/` (events per region, live runs, the guild
 * directory per region). That keeps per-visitor Firestore cost at a handful of
 * reads and lets the canonical collections stay server-only, which is what
 * makes the visibility tiers enforceable (a client can't query a field it
 * can't read).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { COL, db } from './config';
import type { GuildDirDoc, GuildIndexRow, PublicEvent, PublicRun, TeamIndex } from './shared/types';
import type { Region } from './shared/teams';
import { isScheduleFinished, isoWeekKey, nextOccurrence } from './shared/time';

export interface EventDoc extends PublicEvent {
  commanderUid: string;
  archived: boolean;
  visibility: 'public' | 'hidden';
  hiddenReason?: string | null;
  /** CSV import identity (import.ts) — re-imports update instead of duplicating. */
  importKey?: string;
}

export const PUBLIC_EVENT_FIELDS: (keyof PublicEvent)[] = [
  'id',
  'guildId',
  'guildTag',
  'guildName',
  'official',
  'region',
  'teamId',
  'title',
  'type',
  'map',
  'audience',
  'openness',
  'languages',
  'schedule',
  'status',
  'liveRunId',
  'seeded',
  'createdAt',
  'updatedAt',
];

export function toPublicEvent(e: EventDoc): PublicEvent {
  const out = {} as Record<string, unknown>;
  for (const k of PUBLIC_EVENT_FIELDS) out[k] = e[k] ?? null;
  out.audience = e.audience ?? 'everyone';
  out.map = e.map ?? 'jumper';
  out.seeded = e.seeded === true;
  return out as unknown as PublicEvent;
}

export async function rebuildEventIndex(region: Region): Promise<PublicEvent[]> {
  const now = Date.now();
  const snap = await db()
    .collection(COL.events)
    .where('region', '==', region)
    .where('archived', '==', false)
    .get();
  const events: PublicEvent[] = [];
  const toArchive: string[] = [];
  for (const d of snap.docs) {
    const e = d.data() as EventDoc;
    if (e.visibility !== 'public') continue;
    if (isScheduleFinished(e.schedule, now)) {
      toArchive.push(d.id);
      continue;
    }
    events.push(toPublicEvent(e));
  }
  events.sort(
    (a, b) =>
      (nextOccurrence(a.schedule, now)?.start ?? Infinity) - (nextOccurrence(b.schedule, now)?.start ?? Infinity),
  );
  // Team-only raids never enter the public index (they live in wvwTeamIndex).
  const publicEvents = events.filter((e) => e.audience !== 'team');
  const batch = db().batch();
  batch.set(db().collection(COL.public).doc(`events_${region}`), { updatedAt: now, events: publicEvents });
  for (const id of toArchive.slice(0, 400)) {
    batch.update(db().collection(COL.events).doc(id), { archived: true, updatedAt: now });
  }
  await batch.commit();
  await rebuildTeamIndexes(region, events, now);
  return publicEvents;
}

/**
 * wvwTeamIndex/{teamId}: the private tier (map third, goals, voice, size …) of
 * every listed raid on that team. Firestore rules let only verified, non-stale
 * members of that team read it — the calendar's map filter uses it.
 */
async function rebuildTeamIndexes(region: Region, events: PublicEvent[], now: number): Promise<void> {
  const refs = events.map((e) => db().collection(COL.eventDetails).doc(e.id));
  const detailSnaps = refs.length ? await db().getAll(...refs) : [];
  const byTeam = new Map<number, Omit<TeamIndex, 'updatedAt'>>();
  events.forEach((e, i) => {
    const t = byTeam.get(e.teamId) ?? { events: [], details: {} };
    byTeam.set(e.teamId, t);
    if (e.audience === 'team') t.events.push(e);
    const d = detailSnaps[i]?.data();
    if (!d) return;
    t.details[e.id] = {
      goals: d.goals ?? '',
      expectedSize: d.expectedSize ?? null,
      voice: d.voice ?? null,
      buildsUrl: d.buildsUrl ?? null,
      notes: d.notes ?? '',
    };
  });
  const existing = await db().collection(COL.teamIndex).where('region', '==', region).get();
  const batch = db().batch();
  for (const doc of existing.docs) {
    if (!byTeam.has(Number(doc.id))) batch.set(doc.ref, { region, updatedAt: now, events: [], details: {} });
  }
  for (const [teamId, t] of byTeam) {
    batch.set(db().collection(COL.teamIndex).doc(String(teamId)), { region, updatedAt: now, ...t });
  }
  await batch.commit();
}

export async function rebuildAllEventIndexes(): Promise<void> {
  await Promise.all([rebuildEventIndex('eu'), rebuildEventIndex('na')]);
}

export async function rebuildLiveIndex(): Promise<void> {
  const now = Date.now();
  // Runs of team-only raids stay out of the public live list.
  const [live, recent] = await Promise.all([
    db().collection(COL.runs).where('status', '==', 'live').get(),
    db()
      .collection(COL.runs)
      .where('status', '==', 'ended')
      .where('endedAt', '>=', now - 24 * 3600_000)
      .orderBy('endedAt', 'desc')
      .limit(30)
      .get(),
  ]);
  await db()
    .collection(COL.public)
    .doc('live')
    .set({
      updatedAt: now,
      runs: live.docs
        .map((d) => d.data() as PublicRun)
        .filter((r) => r.audience !== 'team')
        .sort((a, b) => b.startedAt - a.startedAt),
      recent: recent.docs.map((d) => d.data() as PublicRun).filter((r) => r.audience !== 'team'),
    });
}

/** Last `n` ISO week keys, newest first. */
export function recentWeeks(now: number, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(isoWeekKey(now - i * 7 * 86_400_000));
  return out;
}

export function claimsInWeeks(g: Pick<GuildDirDoc, 'activity'>, weeks: string[]): number {
  return weeks.reduce((sum, w) => sum + (g.activity?.[w]?.claims ?? 0), 0);
}

/**
 * Rebuild `wvwPublic/guildIndex_{region}`. Also prunes activity older than 8
 * weeks and syncs `teamId` from the public guild→team map when it changed
 * (relinks reshuffle teams; the map is refreshed by the poller).
 */
export async function rebuildGuildIndex(
  region: Region,
  guildTeamMap: Record<string, number> | null,
): Promise<number> {
  const now = Date.now();
  const keep8 = new Set(recentWeeks(now, 8));
  const weeks4 = recentWeeks(now, 4);

  const [snap, evIdx] = await Promise.all([
    db().collection(COL.guildDir).where('region', '==', region).get(),
    db().collection(COL.public).doc(`events_${region}`).get(),
  ]);
  const upcoming = new Map<string, number>();
  for (const e of ((evIdx.data()?.events ?? []) as PublicEvent[])) {
    if (e.status === 'scheduled' && e.guildId) upcoming.set(e.guildId, (upcoming.get(e.guildId) ?? 0) + 1);
  }

  const rows: GuildIndexRow[] = [];
  let batch = db().batch();
  let ops = 0;
  const flush = async () => {
    if (ops) await batch.commit();
    batch = db().batch();
    ops = 0;
  };

  for (const d of snap.docs) {
    const g = d.data() as GuildDirDoc;
    const patch: Record<string, unknown> = {};
    for (const w of Object.keys(g.activity ?? {})) {
      if (!keep8.has(w)) patch[`activity.${w}`] = FieldValue.delete();
    }
    const mappedTeam = guildTeamMap?.[g.id];
    if (mappedTeam && mappedTeam !== g.teamId) patch.teamId = mappedTeam;
    if (Object.keys(patch).length) {
      batch.update(d.ref, { ...patch, updatedAt: now });
      if (++ops >= 400) await flush();
    }
    if (g.suspended || !g.name) continue;
    const claims8 = claimsInWeeks(g, [...keep8]);
    const up = upcoming.get(g.id) ?? 0;
    if (!g.claimed && claims8 === 0 && up === 0 && (g.heldNow ?? 0) === 0) continue;
    rows.push({
      id: g.id,
      tag: g.tag,
      name: g.name,
      teamId: (patch.teamId as number | undefined) ?? g.teamId ?? null,
      claims4w: claimsInWeeks(g, weeks4),
      heldNow: g.heldNow ?? 0,
      claimed: !!g.claimed,
      recruiting: !!g.profile?.recruiting,
      playstyles: g.profile?.playstyles ?? [],
      languages: g.profile?.languages ?? [],
      lastSeenAt: g.lastSeenAt ?? null,
      upcoming: up,
    });
  }
  await flush();
  rows.sort((a, b) => b.claims4w - a.claims4w || b.heldNow - a.heldNow || a.tag.localeCompare(b.tag));
  // Stay well under the 1 MiB doc limit even in a busy region.
  await db()
    .collection(COL.public)
    .doc(`guildIndex_${region}`)
    .set({ updatedAt: now, guilds: rows.slice(0, 2500) });
  return rows.length;
}
