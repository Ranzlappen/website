/**
 * Moderation tools beyond reports: raid management (list incl. hidden, hide /
 * unhide, hard delete), member management (search, ban / unban) and guild-page
 * suspension.
 *
 * Bans are kept in server-only `wvwBans`, keyed by GW2 account id
 * (`id:<account id>`) — stable across name changes and across "Delete my data"
 * + re-sign-up — and by lower-cased account name (`name:<name>`) so an account
 * that never signed in can be banned up front. `signIn` refuses both
 * (isBanned). A ban also suspends the member doc (every callable refuses),
 * revokes their Firebase sessions and hides (or deletes) their raids.
 *
 * Roles: mods may list, hide and unhide raids; deleting, banning and
 * suspending guilds is admin-only. Account names appear only in admin views.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions/v2';
import { COL, db } from './config';
import type { AdminEventRow, AdminMemberRow, MemberDoc } from './shared/types';
import type { Region } from './shared/teams';
import { hideEvent, retargetCommanderEvents, unhideEvent } from './events';
import { rebuildEventIndex, toPublicEvent, type EventDoc } from './indexes';
import { setGuildSuspended } from './reports';
import { isGuildId } from './gw2';
import { ADMIN_UID, UID_PREFIX, audit, callableOpts, cleanText, effectiveRole, requireRole } from './util';

const ACCOUNT_NAME = /^[^.\s][^\n]{1,40}\.\d{4}$/;
const BAN_HIDDEN_REASON = 'commander banned';

export const banIdKey = (uid: string) => `id:${uid.slice(UID_PREFIX.length)}`;
export const banNameKey = (accountName: string) => `name:${accountName.trim().toLowerCase()}`;

/** Is this GW2 account banned (by id or by name)? Used by signIn. */
export async function isBanned(uid: string, accountName: string | null): Promise<boolean> {
  const refs = [db().collection(COL.bans).doc(banIdKey(uid))];
  if (accountName) refs.push(db().collection(COL.bans).doc(banNameKey(accountName)));
  const snaps = await db().getAll(...refs);
  return snaps.some((s) => s.exists);
}

async function findMember(d: { uid?: unknown; accountName?: unknown }): Promise<{ uid: string; member: MemberDoc } | null> {
  if (typeof d.uid === 'string' && d.uid.startsWith(UID_PREFIX)) {
    const s = await db().collection(COL.members).doc(d.uid).get();
    return s.exists ? { uid: s.id, member: s.data() as MemberDoc } : null;
  }
  const name = String(d.accountName ?? '').trim();
  if (!name) return null;
  const q = await db().collection(COL.members).where('accountName', '==', name).limit(1).get();
  return q.empty ? null : { uid: q.docs[0].id, member: q.docs[0].data() as MemberDoc };
}

async function eventsOf(uid: string) {
  return db().collection(COL.events).where('commanderUid', '==', uid).where('archived', '==', false).get();
}

/** Hard delete: event + private details; the public / team indexes are rebuilt. */
export async function deleteEvents(ids: string[]): Promise<number> {
  const unique = [...new Set(ids.filter((x) => typeof x === 'string' && x))].slice(0, 200);
  if (!unique.length) return 0;
  const snaps = await db().getAll(...unique.map((id) => db().collection(COL.events).doc(id)));
  const regions = new Set<Region>();
  const batch = db().batch();
  let n = 0;
  for (const s of snaps) {
    if (!s.exists) continue;
    regions.add((s.data() as EventDoc).region);
    batch.delete(s.ref);
    batch.delete(db().collection(COL.eventDetails).doc(s.id));
    n++;
  }
  await batch.commit();
  for (const r of regions) await rebuildEventIndex(r);
  return n;
}

// ── Raids ────────────────────────────────────────────────────────────────

export const modListEvents = onCall(callableOpts, async (request) => {
  const me = await requireRole(request, 'mod');
  const d = (request.data ?? {}) as { region?: unknown };
  let q = db().collection(COL.events).where('archived', '==', false);
  if (d.region === 'eu' || d.region === 'na') q = q.where('region', '==', d.region);
  const snap = await q.limit(500).get();
  const events = snap.docs.map((s) => s.data() as EventDoc);
  // Account names only for admins; one batched read for all commanders.
  const names = new Map<string, string | null>();
  if (me.role === 'admin') {
    const uids = [...new Set(events.map((e) => e.commanderUid).filter((u) => u && u !== ADMIN_UID))];
    for (let i = 0; i < uids.length; i += 100) {
      const ms = await db().getAll(...uids.slice(i, i + 100).map((u) => db().collection(COL.members).doc(u)));
      for (const m of ms) names.set(m.id, (m.get('accountName') as string | undefined) ?? null);
    }
  }
  const rows: AdminEventRow[] = events
    .map((e) => ({
      ...toPublicEvent(e),
      visibility: e.visibility,
      hiddenReason: e.hiddenReason ?? null,
      commander: names.get(e.commanderUid) ?? null,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
  return { events: rows };
});

export const modSetEventHidden = onCall(callableOpts, async (request) => {
  const me = await requireRole(request, 'mod');
  const d = (request.data ?? {}) as { eventId?: unknown; hidden?: unknown; reason?: unknown };
  if (typeof d.eventId !== 'string' || !d.eventId) throw new HttpsError('invalid-argument', 'Missing raid.');
  if (d.hidden === true) await hideEvent(d.eventId, cleanText(d.reason, 200, 'Reason') || 'hidden by moderators');
  else await unhideEvent(d.eventId);
  await audit(me.uid, d.hidden === true ? 'mod.hideEvent' : 'mod.unhideEvent', { eventId: d.eventId });
  return { ok: true };
});

export const adminDeleteEvents = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const ids = (request.data as { eventIds?: unknown })?.eventIds;
  if (!Array.isArray(ids) || !ids.length) throw new HttpsError('invalid-argument', 'Pick at least one raid.');
  const deleted = await deleteEvents(ids as string[]);
  await audit(admin.uid, 'admin.deleteEvents', { count: deleted, ids: (ids as string[]).slice(0, 50) });
  return { deleted };
});

export const adminSetGuildSuspended = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const d = (request.data ?? {}) as { guildId?: unknown; suspended?: unknown };
  if (!isGuildId(d.guildId)) throw new HttpsError('invalid-argument', 'Unknown guild.');
  await setGuildSuspended(d.guildId, d.suspended === true);
  await audit(admin.uid, d.suspended === true ? 'admin.suspendGuild' : 'admin.unsuspendGuild', { guildId: d.guildId });
  return { ok: true };
});

// ── Members ──────────────────────────────────────────────────────────────

function toMemberRow(uid: string, m: MemberDoc, ban: { reason?: string } | null): AdminMemberRow {
  return {
    uid,
    accountName: m.accountName ?? null,
    role: m.role ?? 'user',
    status: m.status ?? 'active',
    banned: !!ban,
    banReason: ban?.reason ?? null,
    verified: !!m.verified,
    stale: !!m.stale,
    region: m.region ?? null,
    teamId: m.teamId ?? null,
    commander: !!m.commander,
    guilds: (m.guilds ?? []).map((g) => g.tag),
    createdAt: m.createdAt ?? 0,
    verifiedAt: m.verifiedAt ?? null,
  };
}

export const adminListMembers = onCall(callableOpts, async (request) => {
  await requireRole(request, 'admin');
  const d = (request.data ?? {}) as { q?: unknown; filter?: unknown };
  const q = String(d.q ?? '').trim();
  const col = db().collection(COL.members);
  let snap;
  if (d.filter === 'banned') snap = await col.where('status', '==', 'suspended').limit(100).get();
  else if (d.filter === 'mods') snap = await col.where('role', 'in', ['mod', 'admin']).limit(100).get();
  else if (q) snap = await col.orderBy('accountName').startAt(q).endAt(`${q}`).limit(50).get();
  else snap = await col.orderBy('createdAt', 'desc').limit(50).get();
  const docs = snap.docs.filter((s) => s.id !== ADMIN_UID);
  const bans = docs.length ? await db().getAll(...docs.map((s) => db().collection(COL.bans).doc(banIdKey(s.id)))) : [];
  const banned = new Map(bans.filter((b) => b.exists).map((b) => [b.id, b.data() as { reason?: string }]));
  // Name-only bans (accounts that never signed in) for the "banned" filter.
  const extra: { accountName: string; reason: string | null }[] = [];
  if (d.filter === 'banned') {
    const nameBans = await db().collection(COL.bans).where('kind', '==', 'name').limit(100).get();
    const known = new Set(docs.map((s) => String(s.get('accountName') ?? '').toLowerCase()));
    for (const b of nameBans.docs) if (!known.has(String(b.get('accountName')).toLowerCase())) extra.push({ accountName: b.get('accountName'), reason: b.get('reason') ?? null });
  }
  return {
    members: docs.map((s) => toMemberRow(s.id, s.data() as MemberDoc, banned.get(banIdKey(s.id)) ?? null)),
    nameBans: extra,
  };
});

export const adminBanMember = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const d = (request.data ?? {}) as { uid?: unknown; accountName?: unknown; reason?: unknown; raids?: unknown };
  const reason = cleanText(d.reason, 300, 'Reason') || 'banned';
  const found = await findMember(d);
  const accountName = found?.member.accountName ?? String(d.accountName ?? '').trim();
  if (!found && !ACCOUNT_NAME.test(accountName)) throw new HttpsError('invalid-argument', 'Enter a GW2 account name like Name.1234.');
  if (found && found.uid === ADMIN_UID) throw new HttpsError('invalid-argument', 'The admin session can’t be banned.');
  if (found && (found.uid === admin.uid || effectiveRole({ ...found.member, uid: found.uid }) === 'admin')) {
    throw new HttpsError('failed-precondition', 'Admins can’t be banned — remove the account from WVW_SECRETS.adminAccounts first.');
  }
  const now = Date.now();
  const batch = db().batch();
  const base = { reason, by: admin.uid, at: now, accountName: accountName || null };
  if (accountName) batch.set(db().collection(COL.bans).doc(banNameKey(accountName)), { ...base, kind: 'name' });
  if (found) {
    batch.set(db().collection(COL.bans).doc(banIdKey(found.uid)), { ...base, kind: 'id', uid: found.uid });
    batch.set(db().collection(COL.members).doc(found.uid), { status: 'suspended', role: 'user' }, { merge: true });
    batch.delete(db().collection(COL.keys).doc(found.uid));
  }
  await batch.commit();

  let raids = 0;
  if (found) {
    await getAuth()
      .revokeRefreshTokens(found.uid)
      .catch((e) => logger.warn('revoke tokens', { e: String(e) }));
    const events = await eventsOf(found.uid);
    if (d.raids === 'delete') raids = await deleteEvents(events.docs.map((s) => s.id));
    else {
      for (const s of events.docs) {
        if (s.get('visibility') === 'public') {
          await hideEvent(s.id, BAN_HIDDEN_REASON);
          raids++;
        }
      }
      await retargetCommanderEvents(found.uid);
    }
  }
  await audit(admin.uid, 'admin.ban', { uid: found?.uid ?? null, raids, mode: d.raids === 'delete' ? 'delete' : 'hide' });
  return { ok: true, signedIn: !!found, raids };
});

export const adminUnbanMember = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const d = (request.data ?? {}) as { uid?: unknown; accountName?: unknown };
  const found = await findMember(d);
  const accountName = found?.member.accountName ?? String(d.accountName ?? '').trim();
  const batch = db().batch();
  if (accountName) batch.delete(db().collection(COL.bans).doc(banNameKey(accountName)));
  if (found) {
    batch.delete(db().collection(COL.bans).doc(banIdKey(found.uid)));
    batch.set(db().collection(COL.members).doc(found.uid), { status: 'active' }, { merge: true });
  }
  await batch.commit();
  if (found) {
    const events = await eventsOf(found.uid);
    for (const s of events.docs) if (s.get('hiddenReason') === BAN_HIDDEN_REASON) await unhideEvent(s.id);
    await retargetCommanderEvents(found.uid);
  }
  await audit(admin.uid, 'admin.unban', { uid: found?.uid ?? null });
  return { ok: true };
});
