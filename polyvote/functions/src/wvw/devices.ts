/**
 * "Remember this device" — sign in again with one click instead of looking up
 * the GW2 API key.
 *
 * The browser never stores the API key (the server already keeps it,
 * encrypted, for relink re-checks). Instead, after a sign-in the SPA asks for a
 * random 256-bit **device token** and keeps it in localStorage. Only the
 * token's SHA-256 is stored here (server-only `wvwDevices/{hash}` → uid, label,
 * created / last used / expires). `resumeDevice` trades a valid token for a
 * fresh Firebase custom token — what `signIn` returns after checking a key —
 * as long as the member still exists, isn't suspended and isn't banned.
 *
 * Tokens roll forward LIMITS.deviceTtlDays after their last use, at most
 * LIMITS.devicesPerMember per member (oldest dropped), are listed / revoked on
 * the Account page, and are deleted by bans and "Delete my data". The admin
 * access-key session is never remembered.
 */
import { createHash, randomBytes } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { COL, db } from './config';
import { LIMITS } from './shared/constants';
import type { DeviceRow, MemberDoc } from './shared/types';
import { ADMIN_UID, audit, callableOpts, isWvwUid, requireWvwUid } from './util';
import { isBanned } from './adminTools';

const DAY_MS = 86_400_000;
/** lastUsedAt / expiresAt are only rewritten when older than this (saves writes on reloads). */
const TOUCH_EVERY_MS = 6 * 3600_000;

export interface DeviceDoc {
  uid: string;
  label: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
}

/** base64url, 32 random bytes → 43 characters. */
export const DEVICE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Public id of a device: a prefix of its hash (enough to tell devices apart, useless to sign in). */
export const deviceRowId = (hash: string) => hash.slice(0, 12);

export function cleanLabel(v: unknown): string {
  const s = typeof v === 'string' ? v.replace(/[^\p{L}\p{N} ·.,()/+_-]/gu, '').trim() : '';
  return s.slice(0, 60) || 'Browser';
}

function tokenFrom(data: unknown): string {
  const t = (data as { deviceToken?: unknown } | null)?.deviceToken;
  if (typeof t !== 'string' || !DEVICE_TOKEN_RE.test(t)) throw new HttpsError('invalid-argument', 'Invalid device token.');
  return t;
}

/** Device docs of a member, newest use first. */
async function devicesOf(uid: string) {
  const snap = await db().collection(COL.devices).where('uid', '==', uid).get();
  return snap.docs.sort((a, b) => (b.get('lastUsedAt') as number) - (a.get('lastUsedAt') as number));
}

export async function deleteDevicesOf(uid: string): Promise<number> {
  const docs = await devicesOf(uid);
  if (docs.length) {
    const batch = db().batch();
    for (const d of docs) batch.delete(d.ref);
    await batch.commit();
  }
  return docs.length;
}

/** Signed in → issue a device token for this browser. */
export const rememberDevice = onCall(callableOpts, async (request) => {
  const uid = requireWvwUid(request);
  if (uid === ADMIN_UID) throw new HttpsError('failed-precondition', 'The admin session is never remembered — sign in with the admin key.');
  const member = (await db().collection(COL.members).doc(uid).get()).data() as MemberDoc | undefined;
  if (!member) throw new HttpsError('failed-precondition', 'Account not found — sign in again.');
  if (member.status === 'suspended') throw new HttpsError('permission-denied', 'This WvW Hub account is suspended.');

  const now = Date.now();
  const token = randomBytes(32).toString('base64url');
  const hash = hashDeviceToken(token);
  const existing = await devicesOf(uid);
  const batch = db().batch();
  // Keep the newest (limit - 1) so the new one fits.
  for (const d of existing.slice(LIMITS.devicesPerMember - 1)) batch.delete(d.ref);
  const doc: DeviceDoc = {
    uid,
    label: cleanLabel((request.data as { label?: unknown } | null)?.label),
    createdAt: now,
    lastUsedAt: now,
    expiresAt: now + LIMITS.deviceTtlDays * DAY_MS,
  };
  batch.set(db().collection(COL.devices).doc(hash), doc);
  await batch.commit();
  return { deviceToken: token, id: deviceRowId(hash), expiresAt: doc.expiresAt };
});

/** Remembered device → fresh sign-in (no session needed). */
export const resumeDevice = onCall(callableOpts, async (request) => {
  const token = tokenFrom(request.data);
  const ref = db().collection(COL.devices).doc(hashDeviceToken(token));
  const snap = await ref.get();
  const forgotten = () => new HttpsError('unauthenticated', 'This device is no longer remembered — sign in with your API key.');
  if (!snap.exists) throw forgotten();
  const d = snap.data() as DeviceDoc;
  const now = Date.now();
  if (d.expiresAt < now || !isWvwUid(d.uid) || d.uid === ADMIN_UID) {
    await ref.delete();
    throw forgotten();
  }
  const member = (await db().collection(COL.members).doc(d.uid).get()).data() as MemberDoc | undefined;
  if (!member) {
    await ref.delete();
    throw forgotten();
  }
  if (member.status === 'suspended') throw new HttpsError('permission-denied', 'This WvW Hub account is suspended.');
  if (await isBanned(d.uid, member.accountName ?? null)) {
    await deleteDevicesOf(d.uid);
    throw new HttpsError('permission-denied', 'This GW2 account is banned from the WvW Hub.');
  }
  if (now - d.lastUsedAt > TOUCH_EVERY_MS) {
    await ref.set({ lastUsedAt: now, expiresAt: now + LIMITS.deviceTtlDays * DAY_MS }, { merge: true });
  }
  await audit(d.uid, 'member.resumeDevice', { device: deviceRowId(snap.id) });
  return { token: await getAuth().createCustomToken(d.uid), accountName: member.accountName ?? null };
});

/** Forget one device by its token ("Sign out & forget this device"). Works signed out too. */
export const forgetDevice = onCall(callableOpts, async (request) => {
  const token = tokenFrom(request.data);
  await db().collection(COL.devices).doc(hashDeviceToken(token)).delete();
  return { ok: true };
});

export function toDeviceRow(hash: string, d: DeviceDoc): DeviceRow {
  return { id: deviceRowId(hash), label: d.label, createdAt: d.createdAt, lastUsedAt: d.lastUsedAt, expiresAt: d.expiresAt };
}

/** The member's remembered devices (Account page). */
export const listMyDevices = onCall(callableOpts, async (request) => {
  const uid = requireWvwUid(request);
  const docs = await devicesOf(uid);
  return { devices: docs.map((s) => toDeviceRow(s.id, s.data() as DeviceDoc)) };
});

/** Forget some (`ids` from listMyDevices) or all of the member's devices. */
export const forgetMyDevices = onCall(callableOpts, async (request) => {
  const uid = requireWvwUid(request);
  const ids = (request.data as { ids?: unknown } | null)?.ids;
  const docs = await devicesOf(uid);
  const pick = Array.isArray(ids) ? docs.filter((s) => ids.includes(deviceRowId(s.id))) : docs;
  if (pick.length) {
    const batch = db().batch();
    for (const s of pick) batch.delete(s.ref);
    await batch.commit();
  }
  return { removed: pick.length };
});
