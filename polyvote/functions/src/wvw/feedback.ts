/**
 * Feedback tab — verified members send a bug report, feature request, like,
 * general feedback or dislike; admins answer in a thread, set a status or
 * delete. Server-only collection `wvwFeedback` (no client rule): everything
 * goes through these callables, so a member only ever sees their own threads
 * and the author's account name only reaches the admin view.
 *
 * Reads avoid composite indexes: a member's threads are queried by `uid`
 * alone and sorted in memory; the admin list is ordered by `createdAt`.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { DocumentReference } from 'firebase-admin/firestore';
import { COL, db } from './config';
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, LIMITS, isOneOf, type FeedbackKind, type FeedbackStatus } from './shared/constants';
import type { AdminFeedbackRow, FeedbackMessage, FeedbackRow } from './shared/types';
import { audit, callableOpts, cleanText, rateLimit, requireMember, requireRole, requireVerified } from './util';

const DAY_MS = 86_400_000;
const MAX_THREAD = 50;

export interface FeedbackDoc {
  id: string;
  uid: string;
  accountName: string | null;
  teamId: number | null;
  kind: FeedbackKind;
  status: FeedbackStatus;
  text: string;
  thread: FeedbackMessage[];
  createdAt: number;
  updatedAt: number;
  unreadForUser: boolean;
  unreadForAdmin: boolean;
}

/** Pure: author view of a thread. */
export function toMemberRow(d: FeedbackDoc): FeedbackRow {
  return {
    id: d.id,
    kind: d.kind,
    status: d.status,
    text: d.text,
    thread: d.thread ?? [],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    unread: d.unreadForUser === true,
  };
}

function toAdminRow(d: FeedbackDoc): AdminFeedbackRow {
  return { ...toMemberRow(d), accountName: d.accountName ?? null, teamId: d.teamId ?? null, unreadForAdmin: d.unreadForAdmin === true };
}

function cleanMessage(v: unknown): string {
  return cleanText(v, LIMITS.feedbackMax, 'Message', true);
}

async function load(id: unknown): Promise<{ ref: DocumentReference; doc: FeedbackDoc }> {
  if (typeof id !== 'string' || !id) throw new HttpsError('invalid-argument', 'Missing feedback.');
  const ref = db().collection(COL.feedback).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Feedback not found.');
  return { ref, doc: snap.data() as FeedbackDoc };
}

// ── Members ──────────────────────────────────────────────────────────────

export const submitFeedback = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const d = (request.data ?? {}) as { kind?: unknown; text?: unknown };
  if (!isOneOf(FEEDBACK_KINDS, d.kind)) throw new HttpsError('invalid-argument', 'Pick what kind of feedback this is.');
  const text = cleanMessage(d.text);
  await rateLimit(member.uid, 'feedback', LIMITS.feedbackPerDay, DAY_MS);
  const ref = db().collection(COL.feedback).doc();
  const now = Date.now();
  const doc: FeedbackDoc = {
    id: ref.id,
    uid: member.uid,
    accountName: member.accountName ?? null,
    teamId: member.teamId ?? null,
    kind: d.kind,
    status: 'open',
    text,
    thread: [],
    createdAt: now,
    updatedAt: now,
    unreadForUser: false,
    unreadForAdmin: true,
  };
  await ref.set(doc);
  return { feedback: toMemberRow(doc) };
});

/** The caller's own threads, newest first; opening the list marks admin replies as read. */
export const listMyFeedback = onCall(callableOpts, async (request) => {
  const member = await requireMember(request);
  const snap = await db().collection(COL.feedback).where('uid', '==', member.uid).limit(200).get();
  const docs = snap.docs.map((s) => s.data() as FeedbackDoc).sort((a, b) => b.updatedAt - a.updatedAt);
  const rows = docs.map(toMemberRow);
  const unread = snap.docs.filter((s) => s.get('unreadForUser') === true);
  if (unread.length) {
    const batch = db().batch();
    for (const s of unread) batch.update(s.ref, { unreadForUser: false });
    await batch.commit();
  }
  return { feedback: rows };
});

/** Follow-up from the author on their own thread (re-opens a closed one). */
export const replyMyFeedback = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const d = (request.data ?? {}) as { id?: unknown; text?: unknown };
  const { ref, doc } = await load(d.id);
  if (doc.uid !== member.uid) throw new HttpsError('permission-denied', 'Not your feedback.');
  if ((doc.thread ?? []).length >= MAX_THREAD) throw new HttpsError('resource-exhausted', 'This thread is full — start a new one.');
  const text = cleanMessage(d.text);
  await rateLimit(member.uid, 'feedbackReply', LIMITS.feedbackPerDay * 3, DAY_MS);
  const now = Date.now();
  const next: FeedbackDoc = {
    ...doc,
    thread: [...(doc.thread ?? []), { by: 'member', text, at: now }],
    status: doc.status === 'done' || doc.status === 'declined' ? 'open' : doc.status,
    updatedAt: now,
    unreadForAdmin: true,
  };
  await ref.set(next);
  return { feedback: toMemberRow(next) };
});

export const deleteMyFeedback = onCall(callableOpts, async (request) => {
  const member = await requireMember(request);
  const { ref, doc } = await load((request.data as { id?: unknown })?.id);
  if (doc.uid !== member.uid) throw new HttpsError('permission-denied', 'Not your feedback.');
  await ref.delete();
  return { ok: true };
});

// ── Admins ───────────────────────────────────────────────────────────────

/** Every thread (newest 300), optionally by status; kind/search filters run in the browser. */
export const modListFeedback = onCall(callableOpts, async (request) => {
  await requireRole(request, 'admin');
  const status = (request.data as { status?: unknown })?.status;
  const col = db().collection(COL.feedback);
  const snap = isOneOf(FEEDBACK_STATUSES, status)
    ? await col.where('status', '==', status).limit(300).get()
    : await col.orderBy('createdAt', 'desc').limit(300).get();
  const rows = snap.docs.map((s) => toAdminRow(s.data() as FeedbackDoc)).sort((a, b) => b.updatedAt - a.updatedAt);
  return { feedback: rows };
});

/** Reply as the hub team and/or change the status; marks the thread read for admins. */
export const modReplyFeedback = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const d = (request.data ?? {}) as { id?: unknown; text?: unknown; status?: unknown };
  const { ref, doc } = await load(d.id);
  const text = d.text == null || d.text === '' ? '' : cleanMessage(d.text);
  if (d.status != null && !isOneOf(FEEDBACK_STATUSES, d.status)) throw new HttpsError('invalid-argument', 'Unknown status.');
  if (!text && d.status == null) throw new HttpsError('invalid-argument', 'Write a reply or pick a status.');
  if (text && (doc.thread ?? []).length >= MAX_THREAD) throw new HttpsError('resource-exhausted', 'This thread is full.');
  const now = Date.now();
  const next: FeedbackDoc = {
    ...doc,
    thread: text ? [...(doc.thread ?? []), { by: 'admin', text, at: now }] : doc.thread ?? [],
    status: (d.status as FeedbackStatus | undefined) ?? (text && doc.status === 'open' ? 'acknowledged' : doc.status),
    updatedAt: now,
    unreadForUser: text ? true : doc.unreadForUser,
    unreadForAdmin: false,
  };
  await ref.set(next);
  await audit(admin.uid, 'admin.feedbackReply', { id: doc.id, status: next.status, replied: !!text });
  return { feedback: toAdminRow(next) };
});

/** Remove one admin reply (index into the thread) — e.g. to fix a typo, then reply again. */
export const modDeleteFeedbackReply = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const d = (request.data ?? {}) as { id?: unknown; index?: unknown };
  const { ref, doc } = await load(d.id);
  const i = Number(d.index);
  if (!Number.isInteger(i) || i < 0 || i >= (doc.thread ?? []).length) throw new HttpsError('invalid-argument', 'Unknown reply.');
  const next: FeedbackDoc = { ...doc, thread: doc.thread.filter((_, j) => j !== i), updatedAt: Date.now() };
  await ref.set(next);
  await audit(admin.uid, 'admin.feedbackDeleteReply', { id: doc.id, index: i });
  return { feedback: toAdminRow(next) };
});

export const modMarkFeedbackRead = onCall(callableOpts, async (request) => {
  await requireRole(request, 'admin');
  const { ref } = await load((request.data as { id?: unknown })?.id);
  await ref.update({ unreadForAdmin: false });
  return { ok: true };
});

export const modDeleteFeedback = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const ids = (request.data as { ids?: unknown })?.ids;
  if (!Array.isArray(ids) || !ids.length) throw new HttpsError('invalid-argument', 'Pick at least one thread.');
  const batch = db().batch();
  for (const id of ids.slice(0, 200)) if (typeof id === 'string' && id) batch.delete(db().collection(COL.feedback).doc(id));
  await batch.commit();
  await audit(admin.uid, 'admin.feedbackDelete', { count: ids.length });
  return { ok: true };
});
