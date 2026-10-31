/**
 * Phase 1 — "Login with Discord" → Firebase custom token.
 *
 * Firebase Auth has no Discord provider, so the SPA runs the OAuth2
 * authorization-code flow and hands the code to this callable, which exchanges
 * it server-side (client secret never leaves Functions), reads the Discord
 * user, upserts `wvwMembers/{uid}` and mints a custom token for
 * `wvw-discord-<discordId>`. That prefix is what keeps WvW users out of the
 * PolyVote `users` collection (see auth/onCreate.ts) and what every WvW
 * callable checks.
 *
 * One-time setup: the Functions runtime service account needs the
 * "Service Account Token Creator" role on itself so createCustomToken can sign
 * (wvw/README.md → Setup).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getAuth } from 'firebase-admin/auth';
import { COL, db, requireSecret } from './config';
import { asUser, exchangeCode, type DiscordUser } from './discord/api';
import { joinHub, syncMemberRoles } from './discord/roles';
import { newChallenge } from './members';
import type { MemberDoc } from './shared/types';
import { callableOpts, effectiveRole, uidForDiscord } from './util';

export const discordLogin = onCall(callableOpts, async (request) => {
  const { code, redirectUri } = (request.data ?? {}) as { code?: unknown; redirectUri?: unknown };
  if (typeof code !== 'string' || code.length < 10 || code.length > 200) {
    throw new HttpsError('invalid-argument', 'Missing login code.');
  }
  const allowed = requireSecret('allowedRedirectUris');
  if (typeof redirectUri !== 'string' || !allowed.includes(redirectUri)) {
    throw new HttpsError('invalid-argument', 'Unexpected redirect URI.');
  }

  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (e) {
    logger.warn('wvw discord exchange failed', { error: String(e) });
    throw new HttpsError('permission-denied', 'Discord login failed — please try again.');
  }
  const user = await asUser<DiscordUser>(tokens.access_token, 'GET', '/users/@me');
  if (!user?.id) throw new HttpsError('internal', 'Discord did not return a user.');

  const uid = uidForDiscord(user.id);
  const ref = db().collection(COL.members).doc(uid);
  const now = Date.now();
  const snap = await ref.get();
  const discordName = user.global_name || user.username;

  let member: MemberDoc;
  if (!snap.exists) {
    member = {
      uid,
      discordId: user.id,
      discordName,
      role: 'user',
      status: 'active',
      verified: false,
      accountName: null,
      commander: false,
      region: null,
      teamId: null,
      wvwGuildId: null,
      guilds: [],
      stale: false,
      challenge: newChallenge(),
      prefs: { timezone: null, hubAutoJoin: true },
      verifiedAt: null,
      createdAt: now,
    };
    member.role = effectiveRole(member);
    await ref.set({ ...member, lastLoginAt: now });
  } else {
    member = snap.data() as MemberDoc;
    member.discordName = discordName;
    member.role = effectiveRole(member);
    await ref.set({ discordName, role: member.role, lastLoginAt: now }, { merge: true });
  }

  // Best-effort hub join + role sync; never block the login on Discord.
  if (member.prefs?.hubAutoJoin !== false && tokens.scope?.split(' ').includes('guilds.join')) {
    await joinHub(user.id, tokens.access_token).catch(() => false);
  }
  await syncMemberRoles(user.id, member).catch(() => {});

  const token = await getAuth().createCustomToken(uid);
  return { token };
});
