/**
 * Phase 3 — runs (a raid actually happening), check-ins and ratings.
 *
 * A commander "goes live" (website button or `/raid live`), verified players
 * on the same team check in (website or the Check-in button on the hub post),
 * the commander ends the run (optionally with dps.report links) and metrics
 * are computed. Only checked-in attendees can rate, for 72h, on four axes —
 * no free text, so ratings can't become a harassment channel.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { COL, db } from './config';
import { EVENT_TYPES, LIMITS, MAPS, RATING_AXES, isOneOf, type EventType, type MapId, type RatingAxis } from './shared/constants';
import type { MemberDoc, PublicMatches, PublicRun } from './shared/types';
import { regionOfTeam } from './shared/teams';
import { audit, callableOpts, requireMember, requireVerified } from './util';
import { rebuildEventIndex, rebuildLiveIndex, type EventDoc } from './indexes';
import { aggregateGuildStats, computeRunMetrics, fetchLog, type LogSummary, type RunPrivate } from './metrics';
import { announceRun } from './discord/announce';
import type { DetailsDoc } from './events';

const MAX_RUN_MS = 12 * 3600_000;

export function voiceChannelFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /discord(?:app)?\.com\/channels\/\d+\/(\d+)/.exec(url);
  return m ? m[1] : null;
}

async function currentMatchId(teamId: number): Promise<string | null> {
  const pub = (await db().collection(COL.public).doc('matches').get()).data() as PublicMatches | undefined;
  return (
    pub?.matches.find((m) => m.sides.red.teamId === teamId || m.sides.blue.teamId === teamId || m.sides.green.teamId === teamId)
      ?.id ?? null
  );
}

async function myLiveRun(uid: string): Promise<{ run: PublicRun; priv: RunPrivate } | null> {
  const snap = await db()
    .collection(COL.runPrivate)
    .where('commanderUid', '==', uid)
    .where('status', '==', 'live')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const run = (await db().collection(COL.runs).doc(snap.docs[0].id).get()).data() as PublicRun;
  return { run, priv: snap.docs[0].data() as RunPrivate };
}

async function syncRunPost(run: PublicRun, priv: RunPrivate): Promise<void> {
  try {
    const msg = await announceRun(run, priv.discord ?? null, run.status === 'ended' ? priv.map : null);
    if (msg && msg.messageId !== priv.discord?.messageId) {
      await db().collection(COL.runPrivate).doc(run.id).set({ discord: msg }, { merge: true });
    }
  } catch (e) {
    logger.warn('wvw run announce failed', { runId: run.id, error: String(e) });
  }
}

export interface StartRunInput {
  eventId?: string | null;
  guildId?: string | null;
  type?: string | null;
  map?: string | null;
  voiceUrl?: string | null;
}

export async function startRunCore(member: MemberDoc, input: StartRunInput): Promise<PublicRun> {
  if (!member.commander) throw new HttpsError('permission-denied', 'Only commanders can start a run.');
  if (await myLiveRun(member.uid)) throw new HttpsError('failed-precondition', 'You already have a live run — end it first.');

  let guildId: string;
  let type: EventType;
  let map: MapId = isOneOf(MAPS, input.map) ? input.map : 'any';
  let voiceChannelId = voiceChannelFromUrl(input.voiceUrl);
  let event: EventDoc | null = null;

  if (input.eventId) {
    const es = await db().collection(COL.events).doc(input.eventId).get();
    if (!es.exists) throw new HttpsError('not-found', 'Raid not found.');
    event = es.data() as EventDoc;
    if (event.commanderUid !== member.uid) throw new HttpsError('permission-denied', 'Not your raid.');
    if (event.status !== 'scheduled' || event.visibility !== 'public') {
      throw new HttpsError('failed-precondition', 'This raid is not active.');
    }
    const d = (await db().collection(COL.eventDetails).doc(event.id).get()).data() as DetailsDoc | undefined;
    guildId = event.guildId;
    type = event.type;
    if (!isOneOf(MAPS, input.map) && d?.map) map = d.map;
    voiceChannelId = voiceChannelId ?? voiceChannelFromUrl(d?.voice?.url);
  } else {
    if (typeof input.guildId !== 'string' || !member.guilds.some((g) => g.id === input.guildId)) {
      throw new HttpsError('invalid-argument', 'Pick one of your guilds.');
    }
    if (!isOneOf(EVENT_TYPES, input.type)) throw new HttpsError('invalid-argument', 'Pick a raid type.');
    guildId = input.guildId;
    type = input.type;
  }
  const guild = member.guilds.find((g) => g.id === guildId);
  if (!guild) throw new HttpsError('permission-denied', 'You are not in that guild anymore — re-verify.');

  const ref = db().collection(COL.runs).doc();
  const now = Date.now();
  const run: PublicRun = {
    id: ref.id,
    eventId: event?.id ?? null,
    guildId,
    guildTag: guild.tag,
    guildName: guild.name,
    region: member.region ?? regionOfTeam(member.teamId!)!,
    teamId: member.teamId!,
    matchId: await currentMatchId(member.teamId!),
    type,
    status: 'live',
    startedAt: now,
    endedAt: null,
    checkins: 0,
    voiceNow: null,
    metrics: null,
  };
  const priv: RunPrivate = {
    commanderUid: member.uid,
    map,
    voiceChannelId,
    status: 'live',
    reportedPeak: null,
    logs: [],
    voice: null,
    discord: null,
  };
  const batch = db().batch();
  batch.set(ref, run);
  batch.set(db().collection(COL.runPrivate).doc(ref.id), priv);
  if (event) batch.update(db().collection(COL.events).doc(event.id), { liveRunId: ref.id, updatedAt: now });
  await batch.commit();
  await Promise.all([rebuildLiveIndex(), event ? rebuildEventIndex(event.region) : Promise.resolve([])]);
  await syncRunPost(run, priv);
  return run;
}

export interface EndRunInput {
  runId?: string | null;
  peak?: number | null;
  logs?: string[];
}

async function loadLogs(links: string[], existing: LogSummary[]): Promise<LogSummary[]> {
  const known = new Set(existing.map((l) => l.permalink));
  const fresh = links.filter((l) => !known.has(l)).slice(0, LIMITS.logsPerRun - existing.length);
  const parsed = await Promise.all(fresh.map((l) => fetchLog(l)));
  return [...existing, ...parsed.filter((x): x is LogSummary => !!x)];
}

export async function finalizeRun(runId: string, opts: { force?: boolean } = {}): Promise<PublicRun> {
  const [rs, ps] = await Promise.all([
    db().collection(COL.runs).doc(runId).get(),
    db().collection(COL.runPrivate).doc(runId).get(),
  ]);
  const run = rs.data() as PublicRun;
  const priv = ps.data() as RunPrivate;
  const endedAt = run.endedAt ?? Math.min(Date.now(), run.startedAt + MAX_RUN_MS);
  const ended: PublicRun = { ...run, status: 'ended', endedAt, voiceNow: null };
  ended.metrics = await computeRunMetrics(ended, priv);
  await Promise.all([
    db().collection(COL.runs).doc(runId).set(ended),
    db().collection(COL.runPrivate).doc(runId).set({ status: 'ended' }, { merge: true }),
  ]);
  if (run.eventId) {
    const er = db().collection(COL.events).doc(run.eventId);
    const e = (await er.get()).data() as EventDoc | undefined;
    if (e?.liveRunId === runId) {
      await er.update({ liveRunId: null, updatedAt: Date.now() });
      await rebuildEventIndex(e.region);
    }
  }
  await rebuildLiveIndex();
  await syncRunPost(ended, { ...priv, status: 'ended' });
  await aggregateGuildStats(run.guildId).catch((e) => logger.warn('guild stats', { e: String(e) }));
  if (opts.force) logger.info('wvw run auto-ended', { runId });
  return ended;
}

export async function endRunCore(member: MemberDoc, input: EndRunInput): Promise<PublicRun> {
  let target: { run: PublicRun; priv: RunPrivate } | null;
  if (input.runId) {
    const [rs, ps] = await Promise.all([
      db().collection(COL.runs).doc(input.runId).get(),
      db().collection(COL.runPrivate).doc(input.runId).get(),
    ]);
    target = rs.exists ? { run: rs.data() as PublicRun, priv: ps.data() as RunPrivate } : null;
  } else {
    target = await myLiveRun(member.uid);
  }
  if (!target || target.priv.commanderUid !== member.uid) throw new HttpsError('not-found', 'No live run of yours found.');
  if (target.run.status !== 'live') throw new HttpsError('failed-precondition', 'That run already ended.');
  const peak = input.peak != null && Number.isInteger(input.peak) && input.peak > 0 && input.peak <= 100 ? input.peak : null;
  const logs = await loadLogs(input.logs ?? [], target.priv.logs ?? []);
  await db()
    .collection(COL.runPrivate)
    .doc(target.run.id)
    .set({ reportedPeak: peak, logs }, { merge: true });
  await db().collection(COL.runs).doc(target.run.id).set({ endedAt: Date.now() }, { merge: true });
  return finalizeRun(target.run.id);
}

/** Add dps.report logs after the fact (commander, within the rating window). */
export async function addLogsCore(member: MemberDoc, runId: string, links: string[]): Promise<PublicRun> {
  const ps = await db().collection(COL.runPrivate).doc(runId).get();
  const priv = ps.data() as RunPrivate | undefined;
  if (!priv || priv.commanderUid !== member.uid) throw new HttpsError('permission-denied', 'Not your run.');
  const logs = await loadLogs(links, priv.logs ?? []);
  await ps.ref.set({ logs }, { merge: true });
  const run = (await db().collection(COL.runs).doc(runId).get()).data() as PublicRun;
  if (run.status === 'live') return run;
  const metrics = await computeRunMetrics(run, { ...priv, logs });
  await db().collection(COL.runs).doc(runId).set({ metrics }, { merge: true });
  await aggregateGuildStats(run.guildId).catch(() => {});
  return { ...run, metrics };
}

export async function checkInCore(member: MemberDoc, runId: string): Promise<{ already: boolean; run: PublicRun }> {
  const runRef = db().collection(COL.runs).doc(runId);
  const ciRef = db().collection(COL.runPrivate).doc(runId).collection('checkins').doc(member.uid);
  return db().runTransaction(async (tx) => {
    const [rs, cs] = await Promise.all([tx.get(runRef), tx.get(ciRef)]);
    if (!rs.exists) throw new HttpsError('not-found', 'Run not found.');
    const run = rs.data() as PublicRun;
    if (member.teamId !== run.teamId) throw new HttpsError('permission-denied', 'This run is on a different team.');
    const graceOk = run.status === 'live' || (run.endedAt ?? 0) + LIMITS.checkinGraceMinutes * 60_000 > Date.now();
    if (!graceOk) throw new HttpsError('failed-precondition', 'Check-in for this run has closed.');
    if (cs.exists) return { already: true, run };
    tx.set(ciRef, { uid: member.uid, at: Date.now() });
    tx.update(runRef, { checkins: (run.checkins ?? 0) + 1 });
    return { already: false, run: { ...run, checkins: (run.checkins ?? 0) + 1 } };
  });
}

export async function rateRunCore(member: MemberDoc, runId: string, raw: unknown): Promise<void> {
  const scores = {} as Record<RatingAxis, number>;
  const r = (raw ?? {}) as Record<string, unknown>;
  for (const axis of RATING_AXES) {
    const v = Number(r[axis.id]);
    if (!Number.isInteger(v) || v < 1 || v > 5) throw new HttpsError('invalid-argument', `Rate ${axis.label} from 1 to 5.`);
    scores[axis.id] = v;
  }
  const [rs, ps, cs] = await Promise.all([
    db().collection(COL.runs).doc(runId).get(),
    db().collection(COL.runPrivate).doc(runId).get(),
    db().collection(COL.runPrivate).doc(runId).collection('checkins').doc(member.uid).get(),
  ]);
  if (!rs.exists) throw new HttpsError('not-found', 'Run not found.');
  const run = rs.data() as PublicRun;
  if (run.status !== 'ended' || !run.endedAt) throw new HttpsError('failed-precondition', 'Rate after the run ended.');
  if (Date.now() > run.endedAt + LIMITS.ratingWindowHours * 3600_000) {
    throw new HttpsError('failed-precondition', 'The rating window for this run has closed.');
  }
  if (ps.get('commanderUid') === member.uid) throw new HttpsError('permission-denied', 'You cannot rate your own run.');
  if (!cs.exists) throw new HttpsError('permission-denied', 'Only players who checked in can rate a run.');
  await db()
    .collection(COL.ratings)
    .doc(`${runId}_${member.uid}`)
    .set({ runId, guildId: run.guildId, uid: member.uid, scores, createdAt: Date.now() });
  await aggregateGuildStats(run.guildId);
}

// ── Callables ────────────────────────────────────────────────────────────

export const startRun = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const run = await startRunCore(member, (request.data ?? {}) as StartRunInput);
  await audit(member.uid, 'run.start', { runId: run.id });
  return { run };
});

export const endRun = onCall({ ...callableOpts, timeoutSeconds: 120 }, async (request) => {
  const member = await requireMember(request);
  const d = (request.data ?? {}) as EndRunInput;
  const logs = Array.isArray(d.logs) ? d.logs.filter((x): x is string => typeof x === 'string') : [];
  return { run: await endRunCore(member, { runId: d.runId ?? null, peak: d.peak ?? null, logs }) };
});

export const addRunLogs = onCall({ ...callableOpts, timeoutSeconds: 120 }, async (request) => {
  const member = await requireMember(request);
  const d = (request.data ?? {}) as { runId?: string; logs?: unknown };
  const logs = Array.isArray(d.logs) ? d.logs.filter((x): x is string => typeof x === 'string') : [];
  return { run: await addLogsCore(member, String(d.runId ?? ''), logs) };
});

export const checkIn = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const r = await checkInCore(member, String((request.data as { runId?: string })?.runId ?? ''));
  await rebuildLiveIndex();
  return { already: r.already };
});

export const rateRun = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const d = (request.data ?? {}) as { runId?: string; scores?: unknown };
  await rateRunCore(member, String(d.runId ?? ''), d.scores);
  return { ok: true };
});

/** What can the signed-in member do with this run? */
export const myRunState = onCall(callableOpts, async (request) => {
  const member = await requireMember(request);
  const runId = String((request.data as { runId?: string })?.runId ?? '');
  const [rs, ps, cs, rt] = await Promise.all([
    db().collection(COL.runs).doc(runId).get(),
    db().collection(COL.runPrivate).doc(runId).get(),
    db().collection(COL.runPrivate).doc(runId).collection('checkins').doc(member.uid).get(),
    db().collection(COL.ratings).doc(`${runId}_${member.uid}`).get(),
  ]);
  if (!rs.exists) throw new HttpsError('not-found', 'Run not found.');
  const run = rs.data() as PublicRun;
  const isCommander = ps.get('commanderUid') === member.uid;
  const inWindow = run.status === 'ended' && !!run.endedAt && Date.now() < run.endedAt + LIMITS.ratingWindowHours * 3600_000;
  return {
    isCommander,
    checkedIn: cs.exists,
    rated: rt.exists ? (rt.get('scores') as Record<RatingAxis, number>) : null,
    canCheckIn: !cs.exists && member.verified && member.teamId === run.teamId && run.status === 'live',
    canRate: inWindow && cs.exists && !isCommander,
    map: isCommander ? (ps.get('map') as string) : null,
  };
});
