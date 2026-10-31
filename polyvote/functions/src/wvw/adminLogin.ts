/**
 * Admin access key → admin session.
 *
 * The sign-in field accepts either a GW2 API key or the admin access key from
 * `WVW_SECRETS.adminKey`. The admin session (uid "wvw-admin") has no GW2
 * account: it can't post raids, but it sees every team's raids incl. private
 * details (Firestore rules + getEventDetails) and has the moderation tools.
 *
 * Brute-force guard: max ADMIN_MAX_FAILS wrong admin attempts per hour across
 * the whole site, after which admin sign-in is locked for the rest of the hour.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import { createHash, timingSafeEqual } from 'node:crypto';
import { COL, db, secrets } from './config';
import type { MemberDoc } from './shared/types';
import { ADMIN_UID, audit } from './util';

export const ADMIN_MAX_FAILS = 10;
const WINDOW_MS = 3600_000;

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/** Constant-time comparison of the typed value with the configured admin key. */
export function adminKeyMatches(input: string, configured: string | undefined): boolean {
  if (!configured || !input) return false;
  return timingSafeEqual(sha(input), sha(configured));
}

/** True when the input can't be a GW2 API key (so it's an admin attempt). */
export function looksLikeAdminAttempt(input: string): boolean {
  return input.length > 0 && input.length < 60 && !input.includes('.');
}

async function checkLock(): Promise<FirebaseFirestore.DocumentReference> {
  const ref = db().collection(COL.state).doc('adminLogin');
  const fails = ((await ref.get()).get('fails') ?? []) as number[];
  const recent = fails.filter((t) => Date.now() - t < WINDOW_MS);
  if (recent.length >= ADMIN_MAX_FAILS) {
    throw new HttpsError('resource-exhausted', 'Too many wrong admin keys — admin sign-in is locked for up to an hour.');
  }
  return ref;
}

/** Returns the admin uid on success; throws on a wrong key (and records the failure). */
export async function adminSignIn(input: string): Promise<string> {
  const ref = await checkLock();
  if (!adminKeyMatches(input, secrets().adminKey)) {
    await db().runTransaction(async (tx) => {
      const fails = (((await tx.get(ref)).get('fails') ?? []) as number[]).filter((t) => Date.now() - t < WINDOW_MS);
      tx.set(ref, { fails: [...fails, Date.now()].slice(-50) });
    });
    throw new HttpsError('invalid-argument', 'That is neither a GW2 API key nor a valid admin key.');
  }
  const memberRef = db().collection(COL.members).doc(ADMIN_UID);
  const now = Date.now();
  if (!(await memberRef.get()).exists) {
    const admin: MemberDoc = {
      uid: ADMIN_UID,
      discordId: null,
      role: 'admin',
      status: 'active',
      verified: false,
      accountName: null,
      commander: false,
      region: null,
      teamId: null,
      wvwGuildId: null,
      guilds: [],
      stale: false,
      prefs: { timezone: null },
      verifiedAt: null,
      createdAt: now,
    };
    await memberRef.set(admin);
  } else {
    await memberRef.set({ role: 'admin', status: 'active' }, { merge: true });
  }
  await audit(ADMIN_UID, 'admin.signIn', {});
  return ADMIN_UID;
}
