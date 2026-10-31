/**
 * Phase 1 — reports + moderation.
 *
 * Verified members report an event, guild or run; mods act on the report
 * without ever seeing who the commander is: actions resolve the target's owner
 * server-side (hide event, suspend commander, suspend guild) and every action
 * is reversible from the same report ("revert").
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { COL, db } from './config';
import { LIMITS, REPORT_REASONS, isOneOf } from './shared/constants';
import type { ReportInput, ReportRow } from './shared/types';
import { audit, callableOpts, cleanText, rateLimit, requireRole, requireVerified } from './util';
import { hideEvent, retargetCommanderEvents, unhideEvent } from './events';
import type { EventDoc } from './indexes';
import { rebuildAllEventIndexes } from './indexes';
import { markDirty } from './state';

type Action = 'dismiss' | 'hideEvent' | 'suspendCommander' | 'suspendGuild' | 'revert';

interface ReportDoc extends ReportRow {
  reporterUid: string;
  /** Server-side resolution context (never sent to clients). */
  ownerUid: string | null;
  guildId: string | null;
  applied: Action | null;
}

async function resolveTarget(t: ReportInput['targetType'], id: string) {
  if (t === 'event') {
    const e = (await db().collection(COL.events).doc(id).get()).data() as EventDoc | undefined;
    if (!e) return null;
    return { label: `[${e.guildTag}] ${e.title}`, ownerUid: e.commanderUid, guildId: e.guildId, eventId: id };
  }
  if (t === 'run') {
    const [r, p] = await Promise.all([
      db().collection(COL.runs).doc(id).get(),
      db().collection(COL.runPrivate).doc(id).get(),
    ]);
    if (!r.exists) return null;
    return {
      label: `Run by [${r.get('guildTag')}]`,
      ownerUid: (p.get('commanderUid') as string) ?? null,
      guildId: r.get('guildId') as string,
      eventId: (r.get('eventId') as string | null) ?? null,
    };
  }
  const g = await db().collection(COL.guildDir).doc(id).get();
  if (!g.exists) return null;
  return { label: `[${g.get('tag')}] ${g.get('name')}`, ownerUid: null, guildId: id, eventId: null };
}

export const report = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const d = (request.data ?? {}) as Partial<ReportInput>;
  if (!['event', 'guild', 'run'].includes(String(d.targetType))) throw new HttpsError('invalid-argument', 'Bad target.');
  if (typeof d.targetId !== 'string' || !d.targetId) throw new HttpsError('invalid-argument', 'Missing target.');
  if (!isOneOf(REPORT_REASONS, d.reason)) throw new HttpsError('invalid-argument', 'Pick a reason.');
  const details = cleanText(d.details, 1000, 'Details');
  await rateLimit(member.uid, 'reports', LIMITS.reportsPerDay, 86_400_000);
  const target = await resolveTarget(d.targetType as ReportInput['targetType'], d.targetId);
  if (!target) throw new HttpsError('not-found', 'That no longer exists.');
  const ref = db().collection(COL.reports).doc();
  const doc: ReportDoc = {
    id: ref.id,
    targetType: d.targetType as ReportInput['targetType'],
    targetId: d.targetId,
    targetLabel: target.label,
    reason: d.reason,
    details,
    status: 'open',
    createdAt: Date.now(),
    resolution: null,
    reporterUid: member.uid,
    ownerUid: target.ownerUid,
    guildId: target.guildId,
    applied: null,
  };
  await ref.set(doc);
  return { id: ref.id };
});

function toRow(r: ReportDoc): ReportRow & { applied: Action | null } {
  return {
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    targetLabel: r.targetLabel,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.createdAt,
    resolution: r.resolution,
    applied: r.applied,
  };
}

export const modListReports = onCall(callableOpts, async (request) => {
  await requireRole(request, 'mod');
  const status = (request.data as { status?: string })?.status ?? 'open';
  if (!['open', 'resolved', 'dismissed'].includes(status)) throw new HttpsError('invalid-argument', 'Bad status.');
  const snap = await db()
    .collection(COL.reports)
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  return { reports: snap.docs.map((d) => toRow(d.data() as ReportDoc)) };
});

async function setMemberStatus(uid: string, status: 'active' | 'suspended') {
  await db().collection(COL.members).doc(uid).set({ status }, { merge: true });
  await retargetCommanderEvents(uid);
}

async function setGuildSuspended(guildId: string, suspended: boolean) {
  await db().collection(COL.guildDir).doc(guildId).set({ suspended }, { merge: true });
  const events = await db().collection(COL.events).where('guildId', '==', guildId).where('archived', '==', false).get();
  const batch = db().batch();
  for (const e of events.docs) {
    if (suspended && e.get('visibility') === 'public') {
      batch.update(e.ref, { visibility: 'hidden', hiddenReason: 'guild suspended' });
    } else if (!suspended && e.get('hiddenReason') === 'guild suspended') {
      batch.update(e.ref, { visibility: 'public', hiddenReason: null });
    }
  }
  await batch.commit();
  await rebuildAllEventIndexes();
  await markDirty('guildIndex');
}

export const modResolveReport = onCall(callableOpts, async (request) => {
  const mod = await requireRole(request, 'mod');
  const d = (request.data ?? {}) as { reportId?: string; action?: Action; note?: string };
  const ref = db().collection(COL.reports).doc(String(d.reportId ?? ''));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Report not found.');
  const r = snap.data() as ReportDoc;
  const note = cleanText(d.note, 500, 'Note');
  const eventId = r.targetType === 'event' ? r.targetId : r.targetType === 'run' ? ((await db().collection(COL.runs).doc(r.targetId).get()).get('eventId') as string | null) : null;

  switch (d.action) {
    case 'dismiss':
      await ref.update({ status: 'dismissed', resolution: note || 'dismissed' });
      break;
    case 'hideEvent':
      if (!eventId) throw new HttpsError('failed-precondition', 'No event to hide.');
      await hideEvent(eventId, note || r.reason);
      await ref.update({ status: 'resolved', resolution: note || 'event hidden', applied: 'hideEvent' });
      break;
    case 'suspendCommander':
      if (!r.ownerUid) throw new HttpsError('failed-precondition', 'No commander attached to this target.');
      await setMemberStatus(r.ownerUid, 'suspended');
      await ref.update({ status: 'resolved', resolution: note || 'commander suspended', applied: 'suspendCommander' });
      break;
    case 'suspendGuild':
      if (!r.guildId) throw new HttpsError('failed-precondition', 'No guild attached.');
      await setGuildSuspended(r.guildId, true);
      await ref.update({ status: 'resolved', resolution: note || 'guild suspended', applied: 'suspendGuild' });
      break;
    case 'revert':
      if (r.applied === 'hideEvent' && eventId) await unhideEvent(eventId);
      if (r.applied === 'suspendCommander' && r.ownerUid) await setMemberStatus(r.ownerUid, 'active');
      if (r.applied === 'suspendGuild' && r.guildId) await setGuildSuspended(r.guildId, false);
      await ref.update({ status: 'open', resolution: null, applied: null });
      break;
    default:
      throw new HttpsError('invalid-argument', 'Unknown action.');
  }
  await audit(mod.uid, `report.${d.action}`, { reportId: r.id });
  return { ok: true };
});
