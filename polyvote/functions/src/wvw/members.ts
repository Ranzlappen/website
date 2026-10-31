/**
 * Phase 1 — sign-in = verification with a GW2 API key.
 *
 * The member creates a key on account.arena.net whose NAME contains
 * "WvW Hub" (checked via `/v2/tokeninfo`, so a key made for another tool can't
 * be replayed here), with the account + guilds + wvw permissions. We read
 * `/v2/account` (guilds, guild_leader, commander) and `/v2/account/wvw` (team +
 * WvW guild), encrypt the key at rest so the relink sweep can re-check the team
 * automatically, and mint a Firebase custom token for "wvw-gw2-<account id>".
 *
 * The GW2 account name is stored on the member's own doc (owner-read only) and
 * on server-only docs — it is never written anywhere public.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getAuth } from 'firebase-admin/auth';
import { COL, db, requireSecret } from './config';
import { seal, unseal, type Sealed } from './crypto';
import { Gw2Error, account, accountWvw, guildPublic, looksLikeApiKey, tokenInfo, type AccountInfo } from './gw2';
import { regionOfTeam } from './shared/teams';
import { isValidTimeZone } from './shared/time';
import type { MemberDoc, MemberGuild } from './shared/types';
import { audit, callableOpts, effectiveRole, requireMember, requireWvwUid, uidForAccount } from './util';
import { retargetCommanderEvents } from './events';
import { markDirty } from './state';

const REQUIRED_PERMISSIONS = ['account', 'guilds'];
export const KEY_NAME_MARKER = 'WvW Hub';

/** The key's name must contain "WvW Hub" (case/spacing-insensitive: "wvwhub", "WVW-Hub" …). */
export function keyNameOk(name: string | undefined): boolean {
  return (name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').includes('wvwhub');
}

interface Resolved {
  acct: AccountInfo;
  teamId: number | null;
  wvwGuildId: string | null;
  guilds: MemberGuild[];
}

async function checkKey(key: string): Promise<void> {
  if (!looksLikeApiKey(key)) throw new HttpsError('invalid-argument', 'That does not look like a GW2 API key.');
  let info;
  try {
    info = await tokenInfo(key);
  } catch (e) {
    if (e instanceof Gw2Error && e.status < 500) throw new HttpsError('invalid-argument', 'ArenaNet rejected this API key.');
    throw new HttpsError('unavailable', 'The GW2 API is not responding — try again in a minute.');
  }
  if (!keyNameOk(info.name)) {
    throw new HttpsError('failed-precondition', `Name the key so it contains "${KEY_NAME_MARKER}" (e.g. "${KEY_NAME_MARKER}"). Keys made for other tools are not accepted.`);
  }
  const missing = REQUIRED_PERMISSIONS.filter((p) => !info.permissions.includes(p));
  if (missing.length) throw new HttpsError('failed-precondition', `The key is missing permissions: ${missing.join(', ')}.`);
}

async function resolveAccount(key: string): Promise<Resolved> {
  const acct = await account(key);
  if (!acct.id) throw new HttpsError('internal', 'The GW2 API returned no account id.');
  let teamId = acct.teamId;
  let wvwGuildId: string | null = null;
  try {
    const w = await accountWvw(key);
    teamId = w.teamId ?? teamId;
    wvwGuildId = w.wvwGuildId;
  } catch (e) {
    if (e instanceof Gw2Error && (e.status === 401 || e.status === 403) && teamId == null) {
      throw new HttpsError('failed-precondition', 'Your API key needs the "wvw" permission so we can read your current WvW team.');
    }
    logger.warn('wvw account/wvw failed', { error: String(e) });
  }
  const guilds: MemberGuild[] = [];
  for (const id of acct.guilds.slice(0, 5)) {
    let name = '';
    let tag = '';
    try {
      const g = await guildPublic(id);
      name = g.name;
      tag = g.tag;
    } catch {
      /* keep blank; directory fills it later */
    }
    guilds.push({ id, name, tag, leader: acct.guildLeader.includes(id) });
  }
  return { acct, teamId, wvwGuildId, guilds };
}

/** Directory docs for the member's guilds; guilds they lead become "leader verified". */
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
        ...(g.leader ? { claimed: true, ...(teamId != null ? { teamId } : {}) } : {}),
        ...(teamId != null ? { region: regionOfTeam(teamId) } : {}),
        updatedAt: now,
      },
      { merge: true },
    );
  }
  await batch.commit();
  if (guilds.some((g) => g.leader)) await markDirty('guildIndex');
}

/** Create or refresh the member doc from a resolved account. */
async function applyVerification(uid: string, r: Resolved, sealedKey: Sealed | null): Promise<MemberDoc> {
  const ref = db().collection(COL.members).doc(uid);
  const now = Date.now();
  const snap = await ref.get();
  const prev = snap.data() as MemberDoc | undefined;
  const base: MemberDoc = prev ?? {
    uid,
    discordId: null,
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
    prefs: { timezone: null },
    verifiedAt: null,
    createdAt: now,
  };
  const next: MemberDoc = {
    ...base,
    verified: true,
    accountName: r.acct.name,
    commander: r.acct.commander,
    region: r.teamId != null ? regionOfTeam(r.teamId) : null,
    teamId: r.teamId,
    wvwGuildId: r.wvwGuildId,
    guilds: r.guilds,
    stale: false,
    verifiedAt: base.verifiedAt ?? now,
  };
  next.role = effectiveRole(next);
  await ref.set({ ...next, accountId: r.acct.id, teamCheckedAt: now, lastVerifiedAt: now }, { merge: true });
  if (sealedKey) await db().collection(COL.keys).doc(uid).set({ sealed: sealedKey, at: now, status: 'ok' });
  await upsertGuildDir(r.guilds, r.teamId);
  await retargetCommanderEvents(uid).catch((e) => logger.warn('retarget events', { e: String(e) }));
  return next;
}

/**
 * Sign in (or sign up) with a GW2 API key → Firebase custom token.
 * Works without a prior session; the GW2 account id is the identity.
 *
 * One-time setup: the Functions runtime service account needs the
 * "Service Account Token Creator" role on itself (wvw/README.md → Setup).
 */
export const signIn = onCall(callableOpts, async (request) => {
  const key = String((request.data as { apiKey?: unknown })?.apiKey ?? '').trim();
  await checkKey(key);
  let r: Resolved;
  try {
    r = await resolveAccount(key);
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('unavailable', 'Could not read your account from the GW2 API — try again shortly.');
  }
  const uid = uidForAccount(r.acct.id);
  const existing = (await db().collection(COL.members).doc(uid).get()).data() as MemberDoc | undefined;
  if (existing?.status === 'suspended') throw new HttpsError('permission-denied', 'This WvW Hub account is suspended.');
  const m = await applyVerification(uid, r, seal(key, requireSecret('keyEncryptionKey')));
  await audit(uid, 'member.signIn', { teamId: m.teamId, isNew: !existing });
  const token = await getAuth().createCustomToken(uid);
  return { token };
});

/** Re-verify while signed in (new key, e.g. after deleting the old one). Must be the same GW2 account. */
export const verifyApiKey = onCall(callableOpts, async (request) => {
  const member = await requireMember(request);
  const key = String((request.data as { apiKey?: unknown })?.apiKey ?? '').trim();
  await checkKey(key);
  const r = await resolveAccount(key);
  if (uidForAccount(r.acct.id) !== member.uid) {
    throw new HttpsError('permission-denied', 'That key belongs to a different GW2 account — sign out and sign in with it instead.');
  }
  const m = await applyVerification(member.uid, r, seal(key, requireSecret('keyEncryptionKey')));
  await audit(member.uid, 'member.verify', { teamId: m.teamId });
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
  const markStale = async () => {
    await memberRef.set({ stale: true, teamCheckedAt: now }, { merge: true });
    await retargetCommanderEvents(uid).catch(() => {});
    return 'stale' as const;
  };
  if (!keySnap.exists) return markStale();
  let key: string;
  try {
    key = unseal(keySnap.get('sealed') as Sealed, requireSecret('keyEncryptionKey'));
  } catch {
    return markStale();
  }
  try {
    const r = await resolveAccount(key);
    if (uidForAccount(r.acct.id) !== uid) return markStale();
    await applyVerification(uid, r, null);
    return 'ok';
  } catch (e) {
    const auth = (e instanceof Gw2Error && (e.status === 400 || e.status === 401 || e.status === 403)) || e instanceof HttpsError;
    if (auth) {
      await keySnap.ref.set({ status: 'invalid' }, { merge: true });
      return markStale();
    }
    // Transient: try again on a later sweep.
    await memberRef.set({ teamCheckedAt: now - 23 * 3600_000 }, { merge: true });
    return 'skipped';
  }
}

export const updatePrefs = onCall(callableOpts, async (request) => {
  const m = await requireMember(request);
  const d = (request.data ?? {}) as { timezone?: unknown };
  const prefs = { ...m.prefs };
  if (d.timezone !== undefined) {
    if (d.timezone !== null && !isValidTimeZone(d.timezone)) throw new HttpsError('invalid-argument', 'Unknown time zone.');
    prefs.timezone = (d.timezone as string | null) ?? null;
  }
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
 * GDPR "delete my data": removes the member, their key, check-ins and raw
 * ratings; cancels their events; deletes the Firebase Auth user. Aggregated
 * guild stats stay.
 */
export const deleteMyData = onCall(callableOpts, async (request) => {
  const uid = requireWvwUid(request);
  const events = await db().collection(COL.events).where('commanderUid', '==', uid).get();
  const ratings = await db().collection(COL.ratings).where('uid', '==', uid).get();
  const checkins = await db().collectionGroup('checkins').where('uid', '==', uid).limit(400).get();
  const batch = db().batch();
  for (const e of events.docs) batch.update(e.ref, { status: 'cancelled', archived: true, updatedAt: Date.now() });
  for (const r of ratings.docs) batch.delete(r.ref);
  for (const c of checkins.docs) batch.delete(c.ref);
  batch.delete(db().collection(COL.keys).doc(uid));
  batch.delete(db().collection(COL.members).doc(uid));
  await batch.commit();
  const { rebuildAllEventIndexes } = await import('./indexes');
  await rebuildAllEventIndexes().catch(() => {});
  await audit(null, 'member.delete', { events: events.size });
  await getAuth().deleteUser(uid).catch(() => {});
  return { ok: true };
});
