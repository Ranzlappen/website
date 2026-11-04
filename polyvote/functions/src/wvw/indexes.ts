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
import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { COL, db } from './config';
import { stableJson } from './util';
import type { GuildDirDoc, GuildIndexRow, PublicEvent, PublicHeld, PublicRun, TeamIndex } from './shared/types';
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
  'tag',
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
  const indexRef = db().collection(COL.public).doc(`events_${region}`);
  // One read to skip an identical write — every write would also cost one
  // read per browser that has the calendar open.
  const prev = await indexRef.get();
  const batch = db().batch();
  let ops = 0;
  if (!prev.exists || stableJson(prev.get('events') ?? []) !== stableJson(publicEvents)) {
    batch.set(indexRef, { updatedAt: now, events: publicEvents });
    ops++;
  }
  for (const id of toArchive.slice(0, 400)) {
    batch.update(db().collection(COL.events).doc(id), { archived: true, updatedAt: now });
    ops++;
  }
  if (ops) await batch.commit();
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
      squadJoin: d.squadJoin ?? null,
    };
  });
  const existing = await db().collection(COL.teamIndex).where('region', '==', region).get();
  const stored = new Map(existing.docs.map((d) => [d.id, stableJson({ events: d.get('events') ?? [], details: d.get('details') ?? {} })]));
  const batch = db().batch();
  let ops = 0;
  const put = (teamId: string, t: Omit<TeamIndex, 'updatedAt'>) => {
    if (stored.get(teamId) === stableJson(t)) return; // unchanged → no write
    batch.set(db().collection(COL.teamIndex).doc(teamId), { region, updatedAt: now, ...t });
    ops++;
  };
  for (const doc of existing.docs) {
    if (!byTeam.has(Number(doc.id))) put(doc.id, { events: [], details: {} });
  }
  for (const [teamId, t] of byTeam) put(String(teamId), t);
  if (ops) await batch.commit();
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

/** A directory row for one guild doc, or null when it shouldn't be listed. */
export function guildRow(
  g: GuildDirDoc,
  ctx: { keep8: Set<string>; weeks4: string[]; held: number; upcoming: number; teamId?: number | null },
): GuildIndexRow | null {
  if (g.suspended || !g.name) return null;
  const claims8 = claimsInWeeks(g, [...ctx.keep8]);
  if (!g.claimed && claims8 === 0 && ctx.upcoming === 0 && ctx.held === 0) return null;
  return {
    id: g.id,
    tag: g.tag,
    name: g.name,
    teamId: ctx.teamId ?? g.teamId ?? null,
    claims4w: claimsInWeeks(g, ctx.weeks4),
    heldNow: ctx.held,
    claimed: !!g.claimed,
    recruiting: !!g.profile?.recruiting,
    playstyles: g.profile?.playstyles ?? [],
    languages: g.profile?.languages ?? [],
    lastSeenAt: g.lastSeenAt ?? null,
    upcoming: ctx.upcoming,
  };
}

/** Clock-skew margin for the incremental "changed since" query. */
const SINCE_OVERLAP_MS = 2 * 60_000;

/**
 * Rebuild `wvwPublic/guildIndex_{region}`.
 *
 * `since` = time of the previous build → **incremental**: only guild docs
 * changed since then are read (claims, profile edits, sign-ins bump
 * `updatedAt`) and merged into the stored rows; held counts + upcoming raids
 * are refreshed for every row from their own docs. `since` = null → **full**:
 * reads every guild doc of the region, prunes activity older than 8 weeks and
 * syncs `teamId` from the public guild→team map (relinks reshuffle teams).
 * Maintenance runs a full build daily and after relinks, incremental otherwise.
 */
export async function rebuildGuildIndex(
  region: Region,
  guildTeamMap: Record<string, number> | null,
  since: number | null = null,
): Promise<{ rows: number; read: number; full: boolean }> {
  const now = Date.now();
  const keep8 = new Set(recentWeeks(now, 8));
  const weeks4 = recentWeeks(now, 4);
  const indexRef = db().collection(COL.public).doc(`guildIndex_${region}`);

  const [prevSnap, evIdx, heldSnap] = await Promise.all([
    indexRef.get(),
    db().collection(COL.public).doc(`events_${region}`).get(),
    db().collection(COL.public).doc('held').get(),
  ]);
  const held = ((heldSnap.data() as PublicHeld | undefined)?.[region] ?? {}) as Record<string, number>;
  const upcoming = new Map<string, number>();
  for (const e of ((evIdx.data()?.events ?? []) as PublicEvent[])) {
    if (e.status === 'scheduled' && e.guildId) upcoming.set(e.guildId, (upcoming.get(e.guildId) ?? 0) + 1);
  }
  const prevRows = (prevSnap.get('guilds') ?? []) as GuildIndexRow[];

  let full = since == null || !prevSnap.exists;
  const dir = db().collection(COL.guildDir);
  let docs: DocumentSnapshot[];
  if (full) {
    docs = (await dir.where('region', '==', region).get()).docs;
  } else {
    try {
      docs = (await dir.where('region', '==', region).where('updatedAt', '>', since! - SINCE_OVERLAP_MS).get()).docs;
    } catch (e) {
      // e.g. the composite index is still building right after a deploy.
      logger.warn('wvw guild index: incremental query failed, doing a full rebuild', { region, e: String(e) });
      full = true;
      docs = (await dir.where('region', '==', region).get()).docs;
    }
  }

  const rows = new Map<string, GuildIndexRow>(full ? [] : prevRows.map((r) => [r.id, r]));
  let batch = db().batch();
  let ops = 0;
  const flush = async () => {
    if (ops) await batch.commit();
    batch = db().batch();
    ops = 0;
  };
  const seen = new Set<string>();
  const consider = async (d: DocumentSnapshot) => {
    if (!d.exists) return;
    const g = d.data() as GuildDirDoc;
    seen.add(g.id);
    const patch: Record<string, unknown> = {};
    if (full) {
      for (const w of Object.keys(g.activity ?? {})) {
        if (!keep8.has(w)) patch[`activity.${w}`] = FieldValue.delete();
      }
    }
    const mappedTeam = guildTeamMap?.[g.id];
    if (mappedTeam && mappedTeam !== g.teamId) patch.teamId = mappedTeam;
    if (Object.keys(patch).length) {
      batch.update(d.ref, { ...patch, updatedAt: now });
      if (++ops >= 400) await flush();
    }
    const row = guildRow(g, {
      keep8,
      weeks4,
      held: held[g.id] ?? 0,
      upcoming: upcoming.get(g.id) ?? 0,
      teamId: (patch.teamId as number | undefined) ?? null,
    });
    if (row) rows.set(g.id, row);
    else rows.delete(g.id);
  };
  for (const d of docs) await consider(d);
  let read = docs.length;

  if (!full) {
    // Guilds that started holding objectives / got a raid without a doc change.
    const missing = [...new Set([...Object.keys(held), ...upcoming.keys()])].filter((id) => !rows.has(id) && !seen.has(id));
    for (let i = 0; i < missing.length; i += 100) {
      const snaps = await db().getAll(...missing.slice(i, i + 100).map((id) => dir.doc(id)));
      read += snaps.length;
      for (const s of snaps) if (s.exists && s.get('region') === region) await consider(s);
    }
    // Fresh counts for every listed guild (cheap: two docs already read).
    for (const r of rows.values()) {
      r.heldNow = held[r.id] ?? 0;
      r.upcoming = upcoming.get(r.id) ?? 0;
    }
  }
  await flush();

  const list = [...rows.values()].sort(
    (a, b) => b.claims4w - a.claims4w || b.heldNow - a.heldNow || a.tag.localeCompare(b.tag),
  );
  // Stay well under the 1 MiB doc limit even in a busy region.
  const guilds = list.slice(0, 2500);
  if (!prevSnap.exists || stableJson(prevRows) !== stableJson(guilds)) {
    await indexRef.set({ updatedAt: now, guilds });
  }
  return { rows: list.length, read, full };
}
