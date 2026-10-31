/**
 * Phase 1 — GW2 account verification.
 *
 * Flow: the member creates an API key whose NAME contains their personal
 * challenge code (shown on the Account page). `/v2/tokeninfo` proves the key
 * was made for us, so a key scraped from somewhere else can't be replayed.
 * We then read `/v2/account` (guilds, guild_leader, commander) and
 * `/v2/account/wvw` (team + WvW guild), encrypt the key at rest so the relink
 * sweep can re-check the team automatically, and sync Discord roles.
 *
 * The GW2 account name is stored on the member's own doc (owner-read only) and
 * on server-only docs — it is never written anywhere public.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { COL, db, requireSecret } from './config';
import { randomCode, seal, unseal, type Sealed } from './crypto';
import { Gw2Error, account, accountWvw, guildPublic, looksLikeApiKey, tokenInfo, type AccountInfo } from './gw2';
import { regionOfTeam } from './shared/teams';
import { isValidTimeZone } from './shared/time';
import type { MemberDoc, MemberGuild } from './shared/types';
import { audit, callableOpts, discordIdFromUid, requireMember, requireWvwUid } from './util';
import { syncMemberRoles } from './discord/roles';
import { retargetCommanderEvents } from './events';

const REQUIRED_PERMISSIONS = ['account', 'guilds'];

export function newChallenge(): string {
  return `WVW-${randomCode(6)}`;
}

interface Resolved {
  acct: AccountInfo;
  teamId: number | null;
  wvwGuildId: string | null;
  guilds: MemberGuild[];
}

async function resolveAccount(uid: string, key: string): Promise<Resolved> {
  const acct = await account(key);
  let teamId = acct.teamId;
  let wvwGuildId: string | null = null;
  try {
    const w = await accountWvw(key);
    teamId = w.teamId ?? teamId;
    wvwGuildId = w.wvwGuildId;
  } catch (e) {
    if (e instanceof Gw2Error && (e.status === 401 || e.status === 403) && teamId == null) {
      throw new HttpsError(
        'failed-precondition',
        'Your API key needs the "wvw" permission so we can read your current WvW team.',
      );
    }
    logger.warn('wvw account/wvw failed', { error: String(e) });
  }

  const priv = await Promise.all(
    acct.guilds.slice(0, 5).map((g) => db().collection(COL.guildPrivate).doc(g).get()),
  );
  const guilds: MemberGuild[] = [];
  for (let i = 0; i < Math.min(acct.guilds.length, 5); i++) {
    const id = acct.guilds[i];
    let name = '';
    let tag = '';
    try {
      const g = await guildPublic(id);
      name = g.name;
      tag = g.tag;
    } catch {
      /* keep blank; directory fills it later */
    }
    const p = priv[i].data() ?? {};
    guilds.push({
      id,
      name,
      tag,
      leader: acct.guildLeader.includes(id),
      appointed: !!(p.commanders && p.commanders[uid]) || p.leaderUid === uid,
    });
  }
  return { acct, teamId, wvwGuildId, guilds };
}

/** Make sure every guild the member is in has a directory doc with a name. */
async function upsertGuildDir(guilds: MemberGuild[], teamId: number | null): Promise<void> {
  const batch = db().batch();
  const now = Date.now();
  for (const g of guilds) {
    if (!g.name) continue;
    batch.set(
      db().collection(COL.guildDir).doc(g.id),
      {
        id: g.id,
        name: g.name,
        tag: g.tag,
        ...(teamId != null ? { region: regionOfTeam(teamId) } : {}),
        updatedAt: now,
      },
      { merge: true },
    );
  }
  await batch.commit();
}

async function applyVerification(
  uid: string,
  r: Resolved,
  sealedKey: Sealed | null,
  allowTransfer: boolean,
): Promise<MemberDoc> {
  const memberRef = db().collection(COL.members).doc(uid);
  const accRef = db().collection(COL.accounts).doc(r.acct.id);
  const now = Date.now();
  let transferredFrom: string | null = null;

  await db().runTransaction(async (tx) => {
    const [accSnap, memberSnap] = await Promise.all([tx.get(accRef), tx.get(memberRef)]);
    if (!memberSnap.exists) throw new HttpsError('failed-precondition', 'Sign in again.');
    const owner = accSnap.get('uid') as string | undefined;
    if (owner && owner !== uid) {
      if (!allowTransfer) throw new HttpsError('already-exists', 'Account linked elsewhere.');
      // A challenge-named key proves control of the GW2 account → move the link.
      transferredFrom = owner;
      tx.set(
        db().collection(COL.members).doc(owner),
        {
          verified: false,
          accountName: null,
          commander: false,
          guilds: [],
          teamId: null,
          region: null,
          wvwGuildId: null,
          stale: false,
        },
        { merge: true },
      );
      tx.delete(db().collection(COL.keys).doc(owner));
    }
    // If this member previously verified a different GW2 account, free it.
    const prevAccountId = memberSnap.get('accountId') as string | undefined;
    if (prevAccountId && prevAccountId !== r.acct.id) {
      tx.delete(db().collection(COL.accounts).doc(prevAccountId));
    }
    tx.set(accRef, { uid, at: now });
    if (sealedKey) tx.set(db().collection(COL.keys).doc(uid), { sealed: sealedKey, at: now, status: 'ok' });
    tx.set(
      memberRef,
      {
        verified: true,
        accountId: r.acct.id,
        accountName: r.acct.name,
        commander: r.acct.commander,
        region: r.teamId != null ? regionOfTeam(r.teamId) : null,
        teamId: r.teamId,
        wvwGuildId: r.wvwGuildId,
        guilds: r.guilds,
        stale: false,
        verifiedAt: memberSnap.get('verifiedAt') ?? now,
        teamCheckedAt: now,
        lastVerifiedAt: now,
      },
      { merge: true },
    );
  });

  if (transferredFrom) {
    await audit(uid, 'account.transfer', { fromUid: transferredFrom, accountId: r.acct.id });
    const fromDiscord = discordIdFromUid(transferredFrom);
    const fromSnap = await db().collection(COL.members).doc(transferredFrom).get();
    if (fromDiscord) await syncMemberRoles(fromDiscord, fromSnap.data() as MemberDoc).catch(() => {});
    await retargetCommanderEvents(transferredFrom).catch(() => {});
  }

  await upsertGuildDir(r.guilds, r.teamId);
  const snap = await memberRef.get();
  const m = snap.data() as MemberDoc;
  const discordId = discordIdFromUid(uid);
  if (discordId) await syncMemberRoles(discordId, m).catch((e) => logger.warn('role sync', { e: String(e) }));
  await retargetCommanderEvents(uid).catch((e) => logger.warn('retarget events', { e: String(e) }));
  return m;
}

/** Interactive verification from the Account page. */
export const verifyApiKey = onCall(callableOpts, async (request) => {
  const member = await requireMember(request);
  const key = String((request.data as { apiKey?: unknown })?.apiKey ?? '').trim();
  if (!looksLikeApiKey(key)) throw new HttpsError('invalid-argument', 'That does not look like a GW2 API key.');

  let info;
  try {
    info = await tokenInfo(key);
  } catch (e) {
    if (e instanceof Gw2Error && e.status < 500) throw new HttpsError('invalid-argument', 'ArenaNet rejected this API key.');
    throw new HttpsError('unavailable', 'The GW2 API is not responding — try again in a minute.');
  }
  if (!info.name.toUpperCase().includes(member.challenge.toUpperCase())) {
    throw new HttpsError(
      'failed-precondition',
      `Name the key so it contains your code ${member.challenge} (e.g. "WvW Hub ${member.challenge}").`,
    );
  }
  const missing = REQUIRED_PERMISSIONS.filter((p) => !info.permissions.includes(p));
  if (missing.length) {
    throw new HttpsError('failed-precondition', `The key is missing permissions: ${missing.join(', ')}.`);
  }

  let resolved: Resolved;
  try {
    resolved = await resolveAccount(member.uid, key);
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('unavailable', 'Could not read your account from the GW2 API — try again shortly.');
  }
  const m = await applyVerification(member.uid, resolved, seal(key, requireSecret('keyEncryptionKey')), true);
  await audit(member.uid, 'member.verify', { teamId: m.teamId, commander: m.commander });
  return { member: m };
});

/**
 * Non-interactive re-check with the stored key (relink sweep + periodic
 * refresh). Invalid/deleted keys mark the member `stale` so they re-verify.
 */
export async function reverifyStored(uid: string): Promise<'ok' | 'stale' | 'skipped'> {
  const keySnap = await db().collection(COL.keys).doc(uid).get();
  const memberRef = db().collection(COL.members).doc(uid);
  const now = Date.now();
  if (!keySnap.exists) {
    await memberRef.set({ stale: true, teamCheckedAt: now }, { merge: true });
    await afterStale(uid);
    return 'stale';
  }
  let key: string;
  try {
    key = unseal(keySnap.get('sealed') as Sealed, requireSecret('keyEncryptionKey'));
  } catch {
    await memberRef.set({ stale: true, teamCheckedAt: now }, { merge: true });
    await afterStale(uid);
    return 'stale';
  }
  try {
    const r = await resolveAccount(uid, key);
    await applyVerification(uid, r, null, false);
    return 'ok';
  } catch (e) {
    const auth = (e instanceof Gw2Error && (e.status === 401 || e.status === 403)) || e instanceof HttpsError;
    if (auth) {
      await keySnap.ref.set({ status: 'invalid' }, { merge: true });
      await memberRef.set({ stale: true, teamCheckedAt: now }, { merge: true });
      await afterStale(uid);
      return 'stale';
    }
    // Transient: try again on the next sweep.
    await memberRef.set({ teamCheckedAt: now - 23 * 3600_000 }, { merge: true });
    return 'skipped';
  }
}

async function afterStale(uid: string): Promise<void> {
  const snap = await db().collection(COL.members).doc(uid).get();
  const discordId = discordIdFromUid(uid);
  if (discordId) await syncMemberRoles(discordId, snap.data() as MemberDoc).catch(() => {});
  await retargetCommanderEvents(uid).catch(() => {});
}

export const rotateChallenge = onCall(callableOpts, async (request) => {
  const uid = requireWvwUid(request);
  const challenge = newChallenge();
  await db().collection(COL.members).doc(uid).set({ challenge }, { merge: true });
  return { challenge };
});

export const updatePrefs = onCall(callableOpts, async (request) => {
  const m = await requireMember(request);
  const d = (request.data ?? {}) as { timezone?: unknown; hubAutoJoin?: unknown };
  const prefs = { ...m.prefs };
  if (d.timezone !== undefined) {
    if (d.timezone !== null && !isValidTimeZone(d.timezone)) {
      throw new HttpsError('invalid-argument', 'Unknown time zone.');
    }
    prefs.timezone = (d.timezone as string | null) ?? null;
  }
  if (d.hubAutoJoin !== undefined) prefs.hubAutoJoin = d.hubAutoJoin === true;
  await db().collection(COL.members).doc(m.uid).set({ prefs }, { merge: true });
  return { prefs };
});

/** Forget the stored API key but stay verified until the next relink. */
export const forgetApiKey = onCall(callableOpts, async (request) => {
  const uid = requireWvwUid(request);
  await db().collection(COL.keys).doc(uid).delete();
  return { ok: true };
});

/**
 * GDPR "delete my data": removes the member, their key, account link,
 * commander appointments and raw ratings; cancels their events; removes hub
 * roles; deletes the Firebase Auth user. Aggregated guild stats stay.
 */
export const deleteMyData = onCall(callableOpts, async (request) => {
  const uid = requireWvwUid(request);
  const memberRef = db().collection(COL.members).doc(uid);
  const snap = await memberRef.get();
  const m = snap.data() as (MemberDoc & { accountId?: string }) | undefined;

  const events = await db().collection(COL.events).where('commanderUid', '==', uid).get();
  const ratings = await db().collection(COL.ratings).where('uid', '==', uid).get();
  const checkins = await db().collectionGroup('checkins').where('uid', '==', uid).limit(400).get();
  const batch = db().batch();
  for (const c of checkins.docs) batch.delete(c.ref);
  for (const e of events.docs) batch.update(e.ref, { status: 'cancelled', archived: true, updatedAt: Date.now() });
  for (const r of ratings.docs) batch.delete(r.ref);
  for (const g of m?.guilds ?? []) {
    batch.set(
      db().collection(COL.guildPrivate).doc(g.id),
      { commanders: { [uid]: FieldValue.delete() } },
      { merge: true },
    );
  }
  if (m?.accountId) batch.delete(db().collection(COL.accounts).doc(m.accountId));
  batch.delete(db().collection(COL.keys).doc(uid));
  batch.delete(memberRef);
  await batch.commit();

  const discordId = discordIdFromUid(uid);
  if (discordId) await syncMemberRoles(discordId, null).catch(() => {});
  const { rebuildAllEventIndexes } = await import('./indexes');
  await rebuildAllEventIndexes().catch(() => {});
  await audit(null, 'member.delete', { events: events.size });
  await getAuth().deleteUser(uid).catch(() => {});
  return { ok: true };
});
