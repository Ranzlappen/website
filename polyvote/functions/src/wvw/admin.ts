/**
 * Admin callables: runtime settings + moderator roles.
 *
 * Admins are bootstrapped from `WVW_SECRETS.adminAccounts` (GW2 account
 * names); they promote moderators by GW2 account name. Account names stay
 * inside the admin UI — never public.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { COL, db, getSettings, invalidateSettings, type Settings } from './config';
import { TEAM_NAMES } from './shared/teams';
import type { PublicConfig } from './shared/types';
import { audit, callableOpts, cleanText, cleanUrl, requireRole } from './util';

const ACCOUNT_NAME = /^[^.\s][^\n]{1,40}\.\d{4}$/;

export async function publishPublicConfig(s: Settings): Promise<void> {
  const pub: PublicConfig = {
    teamNames: s.teamNames,
    hubInviteUrl: s.hubInviteUrl,
    announcement: s.announcement,
    updatedAt: Date.now(),
  };
  await db().collection(COL.public).doc('config').set(pub);
}

export const adminGetSettings = onCall(callableOpts, async (request) => {
  await requireRole(request, 'admin');
  return { settings: await getSettings(true), defaultTeamNames: TEAM_NAMES };
});

export const adminUpdateSettings = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const d = (request.data ?? {}) as Partial<Settings>;
  const next: Settings = { ...(await getSettings(true)) };
  if (d.siteUrl !== undefined) {
    const u = cleanUrl(d.siteUrl, 'Site URL');
    if (!u || !u.startsWith('https://')) throw new HttpsError('invalid-argument', 'Site URL must be https.');
    next.siteUrl = u.endsWith('/') ? u : `${u}/`;
  }
  if (d.hubInviteUrl !== undefined) next.hubInviteUrl = cleanUrl(d.hubInviteUrl, 'Discord invite', /(^|\.)discord(app)?\.(gg|com)$/);
  if (d.announcement !== undefined) next.announcement = cleanText(d.announcement, 300, 'Announcement') || null;
  if (d.teamNames !== undefined) {
    const names: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.teamNames ?? {})) {
      if (!/^1[12]\d{3}$/.test(k)) continue;
      const name = cleanText(v, 40, `Team ${k}`);
      if (name) names[k] = name;
    }
    next.teamNames = names;
  }
  await db().collection(COL.config).doc('settings').set(next);
  invalidateSettings();
  await publishPublicConfig(next);
  await audit(admin.uid, 'admin.settings', {});
  return { settings: next };
});

export const adminSetRole = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const d = (request.data ?? {}) as { accountName?: string; role?: string };
  const name = String(d.accountName ?? '').trim();
  if (!ACCOUNT_NAME.test(name)) throw new HttpsError('invalid-argument', 'Enter a GW2 account name like Name.1234.');
  if (!['user', 'mod'].includes(String(d.role))) throw new HttpsError('invalid-argument', 'Role must be user or mod.');
  const snap = await db().collection(COL.members).where('accountName', '==', name).limit(1).get();
  if (snap.empty) throw new HttpsError('not-found', 'That account has never signed in to the WvW Hub.');
  await snap.docs[0].ref.set({ role: d.role }, { merge: true });
  await audit(admin.uid, 'admin.setRole', { uid: snap.docs[0].id, role: d.role });
  return { ok: true };
});

export const adminListMods = onCall(callableOpts, async (request) => {
  await requireRole(request, 'admin');
  const snap = await db().collection(COL.members).where('role', 'in', ['mod', 'admin']).limit(100).get();
  return {
    mods: snap.docs.map((d) => ({ accountName: d.get('accountName') as string, role: d.get('role') as string })),
  };
});
