/**
 * Phase 1 — guild pages, leader claims and commander appointments.
 *
 * "Leads for the guild" can't be read from the API (guild ranks need the
 * leader's own key), so the guild leader — proven via `/v2/account`
 * `guild_leader` — claims the guild page and appoints commanders with
 * invite codes shared in guild chat. Raids by appointed commanders show as
 * "official"; raids by other verified members of the guild as "member raid".
 *
 * The leader sees their appointed commanders' account names (they are
 * already on the in-game roster); nobody else ever does.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { COL, db, requireSecret } from './config';
import { randomCode, unseal, type Sealed } from './crypto';
import { account, guildPublic, isGuildId } from './gw2';
import { LANGUAGES, LIMITS, PLAYSTYLES, type Language, type Playstyle } from './shared/constants';
import { regionOfTeam } from './shared/teams';
import { isValidTimeZone } from './shared/time';
import type { CommanderRow, GuildProfile, MemberDoc } from './shared/types';
import { audit, callableOpts, cleanList, cleanText, cleanUrl, requireVerified } from './util';
import { markDirty } from './state';
import { retargetCommanderEvents } from './events';

const INVITE_TTL_MS = 7 * 86_400_000;

function requireGuildId(v: unknown): string {
  if (!isGuildId(v)) throw new HttpsError('invalid-argument', 'Unknown guild.');
  return v;
}

async function requireLeader(member: MemberDoc, guildId: string) {
  const p = (await db().collection(COL.guildPrivate).doc(guildId).get()).data();
  if (!p || p.leaderUid !== member.uid) {
    throw new HttpsError('permission-denied', 'Only the guild leader who claimed this guild can do that.');
  }
  return p;
}

/** Leader claims the guild page (fresh `/v2/account` check with the stored key). */
export const claimGuild = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const guildId = requireGuildId((request.data as { guildId?: unknown })?.guildId);

  const keySnap = await db().collection(COL.keys).doc(member.uid).get();
  if (!keySnap.exists) throw new HttpsError('failed-precondition', 'Re-verify your API key first.');
  const acct = await account(unseal(keySnap.get('sealed') as Sealed, requireSecret('keyEncryptionKey')));
  if (!acct.guildLeader.includes(guildId)) {
    throw new HttpsError('permission-denied', 'The GW2 API says you are not the leader of this guild.');
  }

  const g = await guildPublic(guildId);
  const privRef = db().collection(COL.guildPrivate).doc(guildId);
  const prev = (await privRef.get()).data();
  const now = Date.now();
  await privRef.set({ leaderUid: member.uid, claimedAt: now, commanders: prev?.commanders ?? {} }, { merge: true });
  await db()
    .collection(COL.guildDir)
    .doc(guildId)
    .set(
      {
        id: guildId,
        name: g.name,
        tag: g.tag,
        claimed: true,
        ...(member.teamId != null ? { region: regionOfTeam(member.teamId), teamId: member.teamId } : {}),
        updatedAt: now,
      },
      { merge: true },
    );
  // Leader counts as appointed for their own guild.
  const guilds = member.guilds.map((x) => (x.id === guildId ? { ...x, leader: true, appointed: true } : x));
  await db().collection(COL.members).doc(member.uid).set({ guilds }, { merge: true });
  if (prev?.leaderUid && prev.leaderUid !== member.uid) {
    await audit(member.uid, 'guild.claim.transfer', { guildId, fromUid: prev.leaderUid });
  } else {
    await audit(member.uid, 'guild.claim', { guildId });
  }
  await retargetCommanderEvents(member.uid);
  await markDirty('guildIndex');
  return { ok: true };
});

export const updateGuildProfile = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const d = (request.data ?? {}) as { guildId?: unknown; profile?: Record<string, unknown> };
  const guildId = requireGuildId(d.guildId);
  await requireLeader(member, guildId);
  const p = d.profile ?? {};
  if (p.timezone != null && !isValidTimeZone(p.timezone)) throw new HttpsError('invalid-argument', 'Unknown time zone.');
  const profile: GuildProfile = {
    description: cleanText(p.description, LIMITS.descriptionMax, 'Description'),
    languages: cleanList<Language>(p.languages, LANGUAGES, 'languages', 6),
    playstyles: cleanList<Playstyle>(p.playstyles, PLAYSTYLES, 'playstyles', 8),
    timezone: (p.timezone as string | null) ?? null,
    recruiting: p.recruiting === true,
    discordInvite: cleanUrl(p.discordInvite, 'Discord invite', /(^|\.)discord(app)?\.(gg|com)$/),
    website: cleanUrl(p.website, 'Website'),
  };
  await db().collection(COL.guildDir).doc(guildId).set({ profile, updatedAt: Date.now() }, { merge: true });
  await markDirty('guildIndex');
  return { profile };
});

export const createCommanderInvite = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const guildId = requireGuildId((request.data as { guildId?: unknown })?.guildId);
  await requireLeader(member, guildId);
  const code = randomCode(8);
  const now = Date.now();
  await db()
    .collection(COL.invites)
    .doc(code)
    .set({ guildId, createdBy: member.uid, createdAt: now, expiresAt: now + INVITE_TTL_MS, uses: 0, maxUses: 10 });
  return { code, expiresAt: now + INVITE_TTL_MS };
});

export const redeemCommanderInvite = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const code = String((request.data as { code?: unknown })?.code ?? '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) throw new HttpsError('invalid-argument', 'That code looks wrong.');
  const inviteRef = db().collection(COL.invites).doc(code);
  const guildId = await db().runTransaction(async (tx) => {
    const inv = await tx.get(inviteRef);
    if (!inv.exists) throw new HttpsError('not-found', 'Invite not found.');
    const i = inv.data()!;
    if (i.expiresAt < Date.now() || i.uses >= i.maxUses) throw new HttpsError('failed-precondition', 'Invite expired.');
    if (!member.guilds.some((g) => g.id === i.guildId)) {
      throw new HttpsError('permission-denied', 'You are not a member of that guild (re-verify if you just joined).');
    }
    if (!member.commander) throw new HttpsError('permission-denied', 'Your account has no commander tag.');
    tx.update(inviteRef, { uses: FieldValue.increment(1) });
    tx.set(
      db().collection(COL.guildPrivate).doc(i.guildId),
      { commanders: { [member.uid]: { addedAt: Date.now(), accountName: member.accountName } } },
      { merge: true },
    );
    tx.set(db().collection(COL.guildDir).doc(i.guildId), { commanderCount: FieldValue.increment(1) }, { merge: true });
    return i.guildId as string;
  });
  const guilds = member.guilds.map((g) => (g.id === guildId ? { ...g, appointed: true } : g));
  await db().collection(COL.members).doc(member.uid).set({ guilds }, { merge: true });
  await retargetCommanderEvents(member.uid);
  await audit(member.uid, 'guild.commander.add', { guildId });
  return { guildId };
});

export const listGuildCommanders = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const guildId = requireGuildId((request.data as { guildId?: unknown })?.guildId);
  const p = await requireLeader(member, guildId);
  const rows: CommanderRow[] = Object.entries((p.commanders ?? {}) as Record<string, { addedAt: number; accountName: string }>)
    .map(([uid, c]) => ({ uid, accountName: c.accountName ?? '—', addedAt: c.addedAt }))
    .sort((a, b) => a.addedAt - b.addedAt);
  return { commanders: rows };
});

export const removeGuildCommander = onCall(callableOpts, async (request) => {
  const member = await requireVerified(request);
  const d = (request.data ?? {}) as { guildId?: unknown; uid?: unknown };
  const guildId = requireGuildId(d.guildId);
  await requireLeader(member, guildId);
  if (typeof d.uid !== 'string') throw new HttpsError('invalid-argument', 'Missing commander.');
  await db()
    .collection(COL.guildPrivate)
    .doc(guildId)
    .set({ commanders: { [d.uid]: FieldValue.delete() } }, { merge: true });
  await db()
    .collection(COL.guildDir)
    .doc(guildId)
    .set({ commanderCount: FieldValue.increment(-1) }, { merge: true });
  const ref = db().collection(COL.members).doc(d.uid);
  const snap = await ref.get();
  if (snap.exists) {
    const guilds = (snap.get('guilds') as MemberDoc['guilds']).map((g) => (g.id === guildId ? { ...g, appointed: false } : g));
    await ref.set({ guilds }, { merge: true });
    await retargetCommanderEvents(d.uid);
  }
  await audit(member.uid, 'guild.commander.remove', { guildId });
  return { ok: true };
});
