/**
 * Phase 1 — raid events (calendar entries).
 *
 * Two tiers per event:
 *   - `wvwEvents/{id}` (server-only canonical, projected into the public
 *     `wvwPublic/events_{region}` index): guild tag/name, team, time, type,
 *     map, languages. Never the voice link or who the commander is.
 *   - `wvwEventDetails/{id}` (server-only): goals, expected size, voice,
 *     builds, notes — served by `getEventDetails` ONLY to verified members of
 *     the same team (plus the commander and mods).
 *
 * Who may post: ANY verified member of the guild (GW2 API guild list) — no
 * invite codes. Raids posted by the guild's leader (`guild_leader`) carry the
 * ✓ official badge; everyone else's show without it.
 *
 * The private tier (and every `audience: "team"` raid) is also projected per
 * team into `wvwTeamIndex/{teamId}` (readable only by verified members of
 * that team) — see indexes.ts. Raids seeded by the CSV import (import.ts) may
 * be edited by any verified member of their guild, who then adopts them.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { COL, db } from './config';
import {
  AUDIENCES,
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

export interface DetailsDoc {
  eventId: string;
  commanderUid: string;
  goals: string;
  expectedSize: number | null;
  voice: EventInput['voice'];
  buildsUrl: string | null;
  notes: string;
}

const DAY_MS = 86_400_000;

export function validateEventInput(raw: unknown, now = Date.now()): EventInput {
  const d = (raw ?? {}) as Record<string, unknown>;
  // null / "" = independent raid (no guild attached).
  const guildId = d.guildId == null || d.guildId === '' ? null : d.guildId;
  if (guildId !== null && typeof guildId !== 'string') throw new HttpsError('invalid-argument', 'Pick a guild (or none).');
  const title = cleanText(d.title, LIMITS.titleMax, 'Title', true);
  if (!isOneOf(EVENT_TYPES, d.type)) throw new HttpsError('invalid-argument', 'Pick a raid type.');
  if (!isOneOf(OPENNESS, d.openness)) throw new HttpsError('invalid-argument', 'Pick who can join.');
  const audience = d.audience == null ? 'everyone' : d.audience;
  if (!isOneOf(AUDIENCES, audience)) throw new HttpsError('invalid-argument', 'Pick who can see the raid.');
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
    guildId,
    title,
    type: d.type,
    audience,
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

/** ✓ official = posted by the guild's in-game leader (GW2 API `guild_leader`). */
export function isOfficial(member: Pick<MemberDoc, 'guilds'>, guildId: string | null): boolean {
  return !!guildId && member.guilds.some((g) => g.id === guildId && g.leader);
}

function assertCanPostFor(member: MemberDoc, guildId: string) {
  if (!member.guilds.some((g) => g.id === guildId)) {
    throw new HttpsError('permission-denied', 'You can only post raids for a guild you are in (re-verify if you just joined).');
  }
}

async function guildSuspended(guildId: string): Promise<boolean> {
  return (await db().collection(COL.guildDir).doc(guildId).get()).get('suspended') === true;
}

export async function createEventCore(member: MemberDoc, input: EventInput): Promise<PublicEvent> {
  if (input.guildId) {
    assertCanPostFor(member, input.guildId);
    if (await guildSuspended(input.guildId)) throw new HttpsError('permission-denied', 'This guild is suspended.');
  }
  const active = await db()
    .collection(COL.events)
    .where('commanderUid', '==', member.uid)
    .where('archived', '==', false)
    .get();
  if (active.docs.filter((d) => d.get('status') !== 'cancelled').length >= LIMITS.activeEventsPerCommander) {
    throw new HttpsError('resource-exhausted', `You already have ${LIMITS.activeEventsPerCommander} active raids.`);
  }
  const guild = input.guildId ? member.guilds.find((g) => g.id === input.guildId)! : null;
  const ref = db().collection(COL.events).doc();
  const now = Date.now();
  const e: EventDoc = {
    id: ref.id,
    guildId: input.guildId,
    guildTag: guild?.tag ?? '',
    guildName: guild?.name ?? '',
    official: isOfficial(member, input.guildId),
    region: member.region ?? regionOfTeam(member.teamId!)!,
    teamId: member.teamId!,
    title: input.title,
    type: input.type,
    map: input.map,
    audience: input.audience,
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
    goals: input.goals,
    expectedSize: input.expectedSize,
    voice: input.voice,
    buildsUrl: input.buildsUrl,
    notes: input.notes,
  };
  const batch = db().batch();
  batch.set(ref, e);
  batch.set(db().collection(COL.eventDetails).doc(ref.id), details);
  await batch.commit();
  await rebuildEventIndex(e.region);
  return toPublicEvent(e);
}

/** A seeded (imported) raid can be taken over by any verified member of its guild. */
function canAdopt(member: MemberDoc, e: Pick<EventDoc, 'seeded' | 'guildId'>): boolean {
  return e.seeded === true && !!e.guildId && member.verified && !member.stale && member.guilds.some((g) => g.id === e.guildId);
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
  if (e.commanderUid !== member.uid && !isMod && !canAdopt(member, e)) throw new HttpsError('permission-denied', 'Not your raid.');
  return { e, details: (ds.data() ?? { eventId, commanderUid: e.commanderUid }) as DetailsDoc };
}

export async function updateEventCore(member: MemberDoc, eventId: string, input: EventInput): Promise<PublicEvent> {
  const { e, details } = await loadOwned(member, eventId);
  if (e.archived) throw new HttpsError('failed-precondition', 'This raid has ended.');
  if ((input.guildId ?? null) !== (e.guildId ?? null)) throw new HttpsError('invalid-argument', 'The guild of a raid cannot change.');
  const now = Date.now();
  const next: EventDoc = {
    ...e,
    title: input.title,
    type: input.type,
    map: input.map,
    audience: input.audience,
    openness: input.openness,
    languages: input.languages,
    schedule: input.schedule,
    status: e.status === 'cancelled' ? 'scheduled' : e.status,
    updatedAt: now,
  };
  const adopt = canAdopt(member, e) && e.commanderUid !== member.uid && member.teamId != null;
  if (adopt) {
    // The guild member who edits a seeded raid becomes its commander.
    Object.assign(next, {
      commanderUid: member.uid,
      seeded: false,
      importKey: null,
      official: isOfficial(member, e.guildId),
      teamId: member.teamId!,
      region: regionOfTeam(member.teamId!)!,
      status: e.status === 'suspended' ? 'scheduled' : next.status,
    });
  }
  const nextDetails: DetailsDoc = {
    ...details,
    ...(adopt ? { commanderUid: member.uid } : {}),
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
  if (next.region !== e.region) await rebuildEventIndex(e.region);
  return toPublicEvent(next);
}

export async function cancelEventCore(member: MemberDoc, eventId: string): Promise<void> {
  const { e } = await loadOwned(member, eventId);
  const next: EventDoc = { ...e, status: 'cancelled', updatedAt: Date.now() };
  await db().collection(COL.events).doc(e.id).set(next);
  await rebuildEventIndex(e.region);
}

/** Hide an event (moderation) — removes it from every public surface. */
export async function hideEvent(eventId: string, reason: string): Promise<void> {
  const ref = db().collection(COL.events).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const e = snap.data() as EventDoc;
  await ref.set({ visibility: 'hidden', hiddenReason: reason, updatedAt: Date.now() }, { merge: true });
  await rebuildEventIndex(e.region);
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
  const ok = !!m && m.verified && !m.stale && m.status === 'active' && m.teamId != null;
  const regions = new Set<string>();
  const batch = db().batch();
  const now = Date.now();
  for (const d of events.docs) {
    const e = d.data() as EventDoc;
    regions.add(e.region);
    // Independent raids only need a verified commander; guild raids also the membership.
    const stillMember = ok && (!e.guildId || m!.guilds.some((g) => g.id === e.guildId));

    const patch: Partial<EventDoc> = { updatedAt: now };
    if (stillMember) {
      patch.teamId = m!.teamId!;
      patch.region = regionOfTeam(m!.teamId!)!;
      regions.add(patch.region);
      if (e.status === 'suspended') patch.status = 'scheduled';
      patch.official = isOfficial(m!, e.guildId);
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
    const mine = e.commanderUid === member.uid || canAdopt(member, e);
    const sameTeam = member.verified && !member.stale && member.teamId === e.teamId;
    if (!mine && !sameTeam && !isMod) continue;
    out.push({
      eventId: id,
      goals: d.goals,
      expectedSize: d.expectedSize,
      voice: d.voice,
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
