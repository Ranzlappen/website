/**
 * Shared callable plumbing for WvW Hub: identity, roles, validation, audit.
 *
 * WvW Hub keeps its roles in `wvwMembers/{uid}.role` instead of Firebase
 * custom claims on purpose: the existing `setUserRole` callable (PolyVote /
 * Blog Admin) REPLACES a user's whole claims object, so WvW claims would be
 * clobbered — and WvW mods must never inherit blog `admin` rights anyway.
 */
import { HttpsError, type CallableRequest, type CallableOptions } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { COL, WVW_SECRETS, db, secrets } from './config';
import type { MemberDoc, MemberRole } from './shared/types';

/** Every WvW Hub uid is minted by wvw-discordLogin with this prefix. */
export const UID_PREFIX = 'wvw-discord-';

export const callableOpts: CallableOptions = {
  secrets: [WVW_SECRETS],
  timeoutSeconds: 60,
  memory: '256MiB',
};

export function uidForDiscord(discordId: string): string {
  return UID_PREFIX + discordId;
}

export function discordIdFromUid(uid: string): string | null {
  return uid.startsWith(UID_PREFIX) ? uid.slice(UID_PREFIX.length) : null;
}

export function requireWvwUid(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid || !uid.startsWith(UID_PREFIX)) {
    throw new HttpsError('unauthenticated', 'Sign in with Discord first.');
  }
  return uid;
}

export async function getMember(uid: string): Promise<MemberDoc | null> {
  const snap = await db().collection(COL.members).doc(uid).get();
  return snap.exists ? (snap.data() as MemberDoc) : null;
}

export function effectiveRole(m: Pick<MemberDoc, 'discordId' | 'role'>): MemberRole {
  if ((secrets().adminDiscordIds ?? []).includes(m.discordId)) return 'admin';
  return m.role ?? 'user';
}

export async function requireMember(request: CallableRequest): Promise<MemberDoc> {
  const uid = requireWvwUid(request);
  const m = await getMember(uid);
  if (!m) throw new HttpsError('failed-precondition', 'Account not found — sign in again.');
  if (m.status === 'suspended') {
    throw new HttpsError('permission-denied', 'Your WvW Hub account is suspended.');
  }
  return { ...m, role: effectiveRole(m) };
}

export async function requireVerified(request: CallableRequest): Promise<MemberDoc> {
  const m = await requireMember(request);
  if (!m.verified || m.teamId == null) {
    throw new HttpsError('failed-precondition', 'Verify your Guild Wars 2 account first.');
  }
  if (m.stale) {
    throw new HttpsError(
      'failed-precondition',
      'A relink happened — re-verify your API key so we know your new team.',
    );
  }
  return m;
}

export async function requireRole(request: CallableRequest, min: 'mod' | 'admin'): Promise<MemberDoc> {
  const m = await requireMember(request);
  const level = { user: 0, mod: 1, admin: 2 }[m.role];
  if (level < (min === 'admin' ? 2 : 1)) {
    throw new HttpsError('permission-denied', `Requires ${min} role.`);
  }
  return m;
}

// ── Validation ───────────────────────────────────────────────────────────

/** Trim, collapse control chars, enforce max length. */
export function cleanText(v: unknown, max: number, field: string, required = false): string {
  if (v == null || v === '') {
    if (required) throw new HttpsError('invalid-argument', `${field} is required.`);
    return '';
  }
  if (typeof v !== 'string') throw new HttpsError('invalid-argument', `${field} must be text.`);
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (required && !s) throw new HttpsError('invalid-argument', `${field} is required.`);
  if (s.length > max) throw new HttpsError('invalid-argument', `${field} is too long (max ${max}).`);
  return s;
}

/** Accept only http(s) URLs (optionally restricted to hosts). */
export function cleanUrl(v: unknown, field: string, hosts?: RegExp): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || v.length > 300) {
    throw new HttpsError('invalid-argument', `${field} must be a URL.`);
  }
  let u: URL;
  try {
    u = new URL(v.trim());
  } catch {
    throw new HttpsError('invalid-argument', `${field} must be a valid URL.`);
  }
  // TeamSpeak / Mumble links use their own schemes.
  const okScheme = ['https:', 'http:', 'ts3server:', 'mumble:'].includes(u.protocol);
  if (!okScheme) throw new HttpsError('invalid-argument', `${field} must be an http(s) link.`);
  if (hosts && !hosts.test(u.hostname)) {
    throw new HttpsError('invalid-argument', `${field} must be a link to ${hosts.source}.`);
  }
  return u.toString();
}

export function cleanList<T extends string>(
  v: unknown,
  allowed: readonly { id: string }[],
  field: string,
  max = 8,
): T[] {
  if (v == null) return [];
  if (!Array.isArray(v)) throw new HttpsError('invalid-argument', `${field} must be a list.`);
  const ids = new Set(allowed.map((a) => a.id));
  const out = [...new Set(v.filter((x): x is string => typeof x === 'string' && ids.has(x)))];
  if (out.length > max) throw new HttpsError('invalid-argument', `Too many ${field}.`);
  return out as T[];
}

// ── Audit + rate limits ─────────────────────────────────────────────────

export async function audit(
  actorUid: string | null,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  await db()
    .collection(COL.audit)
    .add({ actorUid, action, details, at: Date.now() });
}

/**
 * Fixed-window counter stored on the member doc (`rate.{bucket}`).
 * Throws resource-exhausted once `limit` is reached inside `windowMs`.
 */
export async function rateLimit(uid: string, bucket: string, limit: number, windowMs: number) {
  const ref = db().collection(COL.members).doc(uid);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const rate = (snap.get('rate') ?? {}) as Record<string, { start: number; count: number }>;
    const now = Date.now();
    const cur = rate[bucket];
    if (!cur || now - cur.start > windowMs) {
      tx.set(ref, { rate: { [bucket]: { start: now, count: 1 } } }, { merge: true });
      return;
    }
    if (cur.count >= limit) {
      throw new HttpsError('resource-exhausted', 'Slow down — try again later.');
    }
    tx.set(ref, { rate: { [bucket]: { start: cur.start, count: FieldValue.increment(1) } } }, { merge: true });
  });
}

export function asInt(v: unknown, field: string, min: number, max: number, nullable = true): number | null {
  if (v == null || v === '') {
    if (nullable) return null;
    throw new HttpsError('invalid-argument', `${field} is required.`);
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpsError('invalid-argument', `${field} must be a whole number between ${min} and ${max}.`);
  }
  return n;
}
