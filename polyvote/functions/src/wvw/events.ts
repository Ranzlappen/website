/**
 * Phase 1 — raid events (calendar entries).
 *
 * Two tiers per event:
 *   - `wvwEvents/{id}` (server-only canonical, projected into the public
 *     `wvwPublic/events_{region}` index): guild tag/name, team, time, type,
 *     languages. Never the map, the voice link or who the commander is.
 *   - `wvwEventDetails/{id}` (server-only): map, goals, expected size, voice,
 *     builds, notes — served by `getEventDetails` ONLY to verified members of
 *     the same team (plus the commander and mods).
 *
 * `createEventCore` / `updateEventCore` / `cancelEventCore` are shared by the
 * website callables and the Discord `/raid` commands, so both entry points
 * enforce identical rules and both announce to the hub.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { COL, db, getSettings } from './config';
import {
  EVENT_TYPES,
  LANGUAGES,
  LIMITS,
  MAPS,
  OPENNESS,
  VOICE_KINDS,
  isOneOf,
  type Language,
} from './shared/constants';
import { regionOfTeam } from './shared/teams';
import {
  nextOccurrence,
  normaliseSchedule,
  parseDate,
  validateSchedule,
  type Schedule,
} from './shared/time';
import type { EventDetails, EventInput, MemberDoc, PublicEvent } from './shared/types';
import { rebuildEventIndex, toPublicEvent, type EventDoc } from './indexes';
import { asInt, audit, callableOpts, cleanList, cleanText, cleanUrl, effectiveRole, requireMember, requireVerified } from './util';
import { announceEvent, removeAnnouncement } from './discord/announce';
import { bot, botConfigured } from './discord/api';

export interface DetailsDoc {
  eventId: string;
  commanderUid: string;
  map: EventInput['map'];
  goals: string;
  expectedSize: number | null;
  voice: EventInput['voice'];
  buildsUrl: string | null;
  notes: string;
  discord?: { channelId: string; messageId: string } | null;
}

const DAY_MS = 86_400_000;

export function validateEventInput(raw: unknown, now = Date.now()): EventInput {
  const d = (raw ?? {}) as Record<string, unknown>;
  if (typeof d.guildId !== 'string') throw new HttpsError('invalid-argument', 'Pick a guild.');
  const title = cleanText(d.title, LIMITS.titleMax, 'Title', true);
  if (!isOneOf(EVENT_TYPES, d.type)) throw new HttpsError('invalid-argument', 'Pick a raid type.');
  if (!isOneOf(OPENNESS, d.openness)) throw new HttpsError('invalid-argument', 'Pick who can join.');
  const languages = cleanList<Language>(d.languages, LANGUAGES, 'languages', 4);
  if (!languages.length) throw new HttpsError('invalid-argument', 'Pick at least one language.');
  if (!isOneOf(MAPS, d.map)) throw new HttpsError('invalid-argument', 'Pick a map.');

  const err = validateSchedule(d.schedule as Partial<Schedule>);
  if (err) throw new HttpsError('invalid-argument', err);
  const schedule = normaliseSchedule(d.schedule as Schedule);
  const first = parseDate(schedule.date)!;
  const firstMs = Date.UTC(first.y, first.m - 1, first.d);
  if (firstMs > now + LIMITS.scheduleAheadDays * DAY_MS) {
    throw new HttpsError('invalid-argument', `Schedule at most ${LIMITS.scheduleAheadDays} days ahead.`);
  }
  if (schedule.repeat === 'weekly' && schedule.until) {
    const u = parseDate(schedule.until)!;
    if (Date.UTC(u.y, u.m - 1, u.d) > now + 366 * DAY_MS) {
      throw new HttpsError('invalid-argument', 'A series can run for at most a year — renew it later.');
    }
  }
  if (!nextOccurrence(schedule, now)) {
    throw new HttpsError('invalid-argument', 'That time is already in the past.');
  }

  let voice: EventInput['voice'] = null;
  const v = d.voice as { kind?: unknown; url?: unknown } | null | undefined;
  if (v && v.url) {
    if (!isOneOf(VOICE_KINDS, v.kind)) throw new HttpsError('invalid-argument', 'Pick a voice platform.');
    const url = cleanUrl(v.url, 'Voice link', v.kind === 'discord' ? /(^|\.)discord(app)?\.(gg|com)$/ : undefined);
    voice = url ? { kind: v.kind, url } : null;
  }

  return {
    guildId: d.guildId,
    title,
    type: d.type,
    openness: d.openness,
    languages,
    schedule,
    map: d.map,
    goals: cleanText(d.goals, LIMITS.goalsMax, 'Goals'),
    expectedSize: asInt(d.expectedSize, 'Expected size', 1, LIMITS.expectedSizeMax),
    voice,
    buildsUrl: cleanUrl(d.buildsUrl, 'Builds link'),
    notes: cleanText(d.notes, LIMITS.notesMax, 'Notes'),
  };
}

async function isOfficial(guildId: string, uid: string): Promise<boolean> {
  const p = (await db().collection(COL.guildPrivate).doc(guildId).get()).data() ?? {};
  return p.leaderUid === uid || !!p.commanders?.[uid];
}

function assertCanPostFor(member: MemberDoc, guildId: string) {
  if (!member.commander) {
    throw new HttpsError('permission-denied', 'Only accounts with a commander tag can post raids.');
  }
  if (!member.guilds.some((g) => g.id === guildId)) {
    throw new HttpsError('permission-denied', 'You can only post raids for a guild you are in.');
  }
}

async function guildSuspended(guildId: string): Promise<boolean> {
  return (await db().collection(COL.guildDir).doc(guildId).get()).get('suspended') === true;
}

async function syncAnnouncement(e: EventDoc, details: DetailsDoc): Promise<void> {
  try {
    const msg = await announceEvent(e, details.discord ?? null);
    if (msg && (msg.messageId !== details.discord?.messageId || msg.channelId !== details.discord?.channelId)) {
      await db().collection(COL.eventDetails).doc(e.id).set({ discord: msg }, { merge: true });
    }
  } catch (err) {
    logger.warn('wvw announce failed', { eventId: e.id, error: String(err) });
  }
}

export async function createEventCore(member: MemberDoc, input: EventInput): Promise<PublicEvent> {
  assertCanPostFor(member, input.guildId);
  if (await guildSuspended(input.guildId)) throw new HttpsError('permission-denied', 'This guild is suspended.');
  const active = await db()
    .collection(COL.events)
    .where('commanderUid', '==', member.uid)
    .where('archived', '==', false)
    .get();
  if (active.docs.filter((d) => d.get('status') !== 'cancelled').length >= LIMITS.activeEventsPerCommander) {
    throw new HttpsError('resource-exhausted', `You already have ${LIMITS.activeEventsPerCommander} active raids.`);
  }
  const guild = member.guilds.find((g) => g.id === input.guildId)!;
  const ref = db().collection(COL.events).doc();
  const now = Date.now();
  const e: EventDoc = {
    id: ref.id,
    guildId: input.guildId,
    guildTag: guild.tag,
    guildName: guild.name,
    official: await isOfficial(input.guildId, member.uid),
    region: member.region ?? regionOfTeam(member.teamId!)!,
    teamId: member.teamId!,
    title: input.title,
    type: input.type,
    openness: input.openness,
    languages: input.languages,
    schedule: input.schedule,
    status: 'scheduled',
    liveRunId: null,
    createdAt: now,
    updatedAt: now,
    commanderUid: member.uid,
    archived: false,
    visibility: 'public',
  };
  const details: DetailsDoc = {
    eventId: ref.id,
    commanderUid: member.uid,
    map: input.map,
    goals: input.goals,
    expectedSize: input.expectedSize,
    voice: input.voice,
    buildsUrl: input.buildsUrl,
    notes: input.notes,
    discord: null,
  };
  const batch = db().batch();
  batch.set(ref, e);
  batch.set(db().collection(COL.eventDetails).doc(ref.id), details);
  await batch.commit();
  await rebuildEventIndex(e.region);
  await syncAnnouncement(e, details);
  return toPublicEvent(e);
}

async function loadOwned(member: MemberDoc, eventId: string): Promise<{ e: EventDoc; details: DetailsDoc }> {
  if (typeof eventId !== 'string' || !eventId) throw new HttpsError('invalid-argument', 'Missing event.');
  const [es, ds] = await Promise.all([
    db().collection(COL.events).doc(eventId).get(),
    db().collection(COL.eventDetails).doc(eventId).get(),
  ]);
  if (!es.exists) throw new HttpsError('not-found', 'Raid not found.');
  const e = es.data() as EventDoc;
  const isMod = effectiveRole(member) !== 'user';
  if (e.commanderUid !== member.uid && !isMod) throw new HttpsError('permission-denied', 'Not your raid.');
  return { e, details: (ds.data() ?? { eventId, commanderUid: e.commanderUid }) as DetailsDoc };
}

export async function updateEventCore(member: MemberDoc, eventId: string, input: EventInput): Promise<PublicEvent> {
  const { e, details } = await loadOwned(member, eventId);
  if (e.archived) throw new HttpsError('failed-precondition', 'This raid has ended.');
  if (input.guildId !== e.guildId) throw new HttpsError('invalid-argument', 'The guild of a raid cannot change.');
  const now = Date.now();
  const next: EventDoc = {
    ...e,
    title: input.title,
    type: input.type,
    openness: input.openness,
    languages: input.languages,
    schedule: input.schedule,
    status: e.status === 'cancelled' ? 'scheduled' : e.status,
    updatedAt: now,
  };
  const nextDetails: DetailsDoc = {
    ...details,
    map: input.map,
    goals: input.goals,
    expectedSize: input.expectedSize,
    voice: input.voice,
    buildsUrl: input.buildsUrl,
    notes: input.notes,
  };
  const batch = db().batch();
  batch.set(db().collection(COL.events).doc(e.id), next);
  batch.set(db().collection(COL.eventDetails).doc(e.id), nextDetails);
  await batch.commit();
  await rebuildEventIndex(next.region);
  await syncAnnouncement(next, nextDetails);
  return toPublicEvent(next);
}

export async function cancelEventCore(member: MemberDoc, eventId: string): Promise<void> {
  const { e, details } = await loadOwned(member, eventId);
  const next: EventDoc = { ...e, status: 'cancelled', updatedAt: Date.now() };
  await db().collection(COL.events).doc(e.id).set(next);
  await rebuildEventIndex(e.region);
  await syncAnnouncement(next, details);
}

/** Hide an event (moderation) — removes it from every public surface. */
export async function hideEvent(eventId: string, reason: string): Promise<void> {
  const ref = db().collection(COL.events).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const e = snap.data() as EventDoc;
  await ref.set({ visibility: 'hidden', hiddenReason: reason, updatedAt: Date.now() }, { merge: true });
  await rebuildEventIndex(e.region);
  const d = (await db().collection(COL.eventDetails).doc(eventId).get()).data() as DetailsDoc | undefined;
  if (d?.discord) await removeAnnouncement(d.discord).catch(() => {});
}

export async function unhideEvent(eventId: string): Promise<void> {
  const ref = db().collection(COL.events).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.set({ visibility: 'public', hiddenReason: null, updatedAt: Date.now() }, { merge: true });
  await rebuildEventIndex((snap.data() as EventDoc).region);
}

/**
 * After (re)verification, a relink, a suspension or an account transfer:
 * move the commander's events to their current team, and suspend them while
 * the commander can't be verified on a team.
 */
export async function retargetCommanderEvents(uid: string): Promise<void> {
  const [mSnap, events] = await Promise.all([
    db().collection(COL.members).doc(uid).get(),
    db().collection(COL.events).where('commanderUid', '==', uid).where('archived', '==', false).get(),
  ]);
  if (events.empty) return;
  const m = mSnap.data() as MemberDoc | undefined;
  const ok = !!m && m.verified && !m.stale && m.status === 'active' && m.teamId != null && m.commander;
  const regions = new Set<string>();
  const batch = db().batch();
  const now = Date.now();
  for (const d of events.docs) {
    const e = d.data() as EventDoc;
    regions.add(e.region);
    const stillMember = ok && m!.guilds.some((g) => g.id === e.guildId);
    const patch: Partial<EventDoc> = { updatedAt: now };
    if (stillMember) {
      patch.teamId = m!.teamId!;
      patch.region = regionOfTeam(m!.teamId!)!;
      regions.add(patch.region);
      if (e.status === 'suspended') patch.status = 'scheduled';
      const appointed = m!.guilds.find((g) => g.id === e.guildId)?.appointed ?? false;
      patch.official = appointed;
    } else if (e.status === 'scheduled') {
      patch.status = 'suspended';
    }
    batch.update(d.ref, patch);
  }
  await batch.commit();
  for (const r of regions) await rebuildEventIndex(r as 'eu' | 'na');
}

// ── Callables ────────────────────────────────────────────────────────────

export const createEvent = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const input = validateEventInput(request.data);
  const event = await createEventCore(member, input);
  await audit(member.uid, 'event.create', { eventId: event.id, guildId: event.guildId });
  return { event };
});

export const updateEvent = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const { eventId, ...rest } = (request.data ?? {}) as { eventId?: string } & Record<string, unknown>;
  const input = validateEventInput(rest);
  const event = await updateEventCore(member, String(eventId ?? ''), input);
  return { event };
});

export const cancelEvent = onCall(callableOpts, async (request) => {
  const member = await requireMember(request);
  await cancelEventCore(member, String((request.data as { eventId?: string })?.eventId ?? ''));
  return { ok: true };
});

/**
 * Turn a Discord channel link in the hub into a single-use, 1-hour invite so
 * a scraped link is worthless. Other links are returned unchanged.
 */
async function personalVoiceLink(voice: DetailsDoc['voice']): Promise<DetailsDoc['voice']> {
  if (!voice || voice.kind !== 'discord' || !botConfigured()) return voice;
  const m = /discord(?:app)?\.com\/channels\/(\d+)\/(\d+)/.exec(voice.url);
  if (!m) return voice;
  const s = await getSettings();
  if (m[1] !== s.discord.guildId) return voice;
  try {
    const inv = await bot<{ code: string }>('POST', `/channels/${m[2]}/invites`, {
      max_age: 3600,
      max_uses: 1,
      unique: true,
    });
    return { kind: 'discord', url: `https://discord.gg/${inv.code}` };
  } catch {
    return voice;
  }
}

export async function detailsFor(member: MemberDoc, eventIds: string[]): Promise<EventDetails[]> {
  const isMod = effectiveRole(member) !== 'user';
  const out: EventDetails[] = [];
  for (const id of eventIds.slice(0, 20)) {
    if (typeof id !== 'string' || !id) continue;
    const [es, ds] = await Promise.all([
      db().collection(COL.events).doc(id).get(),
      db().collection(COL.eventDetails).doc(id).get(),
    ]);
    if (!es.exists || !ds.exists) continue;
    const e = es.data() as EventDoc;
    const d = ds.data() as DetailsDoc;
    const mine = e.commanderUid === member.uid;
    const sameTeam = member.verified && !member.stale && member.teamId === e.teamId;
    if (!mine && !sameTeam && !isMod) continue;
    out.push({
      eventId: id,
      map: d.map,
      goals: d.goals,
      expectedSize: d.expectedSize,
      voice: mine ? d.voice : await personalVoiceLink(d.voice),
      buildsUrl: d.buildsUrl,
      notes: d.notes,
      canEdit: mine || isMod,
    });
  }
  return out;
}

export const getEventDetails = onCall(callableOpts, async (request) => {
  const member = await requireMember(request);
  const ids = (request.data as { eventIds?: unknown })?.eventIds;
  if (!Array.isArray(ids)) throw new HttpsError('invalid-argument', 'eventIds must be a list.');
  return { details: await detailsFor(member, ids as string[]) };
});

export const listMyEvents = onCall(callableOpts, async (request) => {
  const member = await requireMember(request);
  const snap = await db()
    .collection(COL.events)
    .where('commanderUid', '==', member.uid)
    .where('archived', '==', false)
    .get();
  const events = snap.docs.map((d) => d.data() as EventDoc);
  const details = await detailsFor(
    member,
    events.map((e) => e.id),
  );
  return {
    events: events.map((e) => ({ ...toPublicEvent(e), hidden: e.visibility !== 'public' })),
    details,
  };
});
