/**
 * Admin callables: runtime settings + member roles.
 *
 * Admins are bootstrapped from `WVW_SECRETS.adminDiscordIds`; they can promote
 * mods by Discord user id (Discord → Developer Mode → Copy User ID), so no one
 * ever needs to see GW2 account names to moderate.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { COL, DEFAULT_SETTINGS, db, getSettings, invalidateSettings, type Settings } from './config';
import { TEAM_NAMES } from './shared/teams';
import type { MemberDoc, PublicConfig } from './shared/types';
import { audit, callableOpts, cleanText, cleanUrl, requireRole, uidForDiscord } from './util';
import { syncMemberRoles } from './discord/roles';

const SNOWFLAKE = /^\d{15,22}$/;

function snowflakeOrUndefined(v: unknown, field: string): string | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v !== 'string' || !SNOWFLAKE.test(v)) throw new HttpsError('invalid-argument', `${field} must be a Discord id.`);
  return v;
}

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
  const cur = await getSettings(true);
  const next: Settings = { ...DEFAULT_SETTINGS, ...cur };

  if (d.siteUrl !== undefined) {
    const u = cleanUrl(d.siteUrl, 'Site URL');
    if (!u || !u.startsWith('https://')) throw new HttpsError('invalid-argument', 'Site URL must be https.');
    next.siteUrl = u.endsWith('/') ? u : `${u}/`;
  }
  if (d.hubInviteUrl !== undefined) next.hubInviteUrl = cleanUrl(d.hubInviteUrl, 'Hub invite', /(^|\.)discord(app)?\.(gg|com)$/);
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
  if (d.discord !== undefined) {
    const dd = d.discord;
    const channels: Settings['discord']['channels'] = {};
    for (const [k, v] of Object.entries(dd.channels ?? {})) {
      const id = snowflakeOrUndefined(v, `channel ${k}`);
      if (id) (channels as Record<string, string>)[k] = id;
    }
    const roles: Settings['discord']['roles'] = { teams: {} };
    for (const k of ['verified', 'commander', 'guildLeader', 'eu', 'na', 'mod'] as const) {
      const id = snowflakeOrUndefined(dd.roles?.[k], `role ${k}`);
      if (id) roles[k] = id;
    }
    for (const [team, v] of Object.entries(dd.roles?.teams ?? {})) {
      const id = snowflakeOrUndefined(v, `team role ${team}`);
      if (id && /^1[12]\d{3}$/.test(team)) roles.teams![team] = id;
    }
    next.discord = {
      guildId: snowflakeOrUndefined(dd.guildId, 'Hub server id') ?? null,
      autoJoin: dd.autoJoin === true,
      channels,
      roles,
    };
  }
  await db().collection(COL.config).doc('settings').set(next);
  invalidateSettings();
  await publishPublicConfig(next);
  await audit(admin.uid, 'admin.settings', {});
  return { settings: next };
});

export const adminSetRole = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const d = (request.data ?? {}) as { discordId?: string; role?: string };
  if (!d.discordId || !SNOWFLAKE.test(d.discordId)) throw new HttpsError('invalid-argument', 'Enter a Discord user id.');
  if (!['user', 'mod'].includes(String(d.role))) throw new HttpsError('invalid-argument', 'Role must be user or mod.');
  const ref = db().collection(COL.members).doc(uidForDiscord(d.discordId));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That Discord user has never signed in to the WvW Hub.');
  await ref.set({ role: d.role }, { merge: true });
  const s = await getSettings();
  // Mirror the mod role in the hub server when configured.
  if (s.discord.roles.mod) {
    const { bot } = await import('./discord/api');
    const method = d.role === 'mod' ? 'PUT' : 'DELETE';
    await bot(method, `/guilds/${s.discord.guildId}/members/${d.discordId}/roles/${s.discord.roles.mod}`).catch(() => {});
  }
  await syncMemberRoles(d.discordId, snap.data() as MemberDoc).catch(() => {});
  await audit(admin.uid, 'admin.setRole', { discordId: d.discordId, role: d.role });
  return { ok: true };
});

export const adminListMods = onCall(callableOpts, async (request) => {
  await requireRole(request, 'admin');
  const snap = await db().collection(COL.members).where('role', 'in', ['mod', 'admin']).limit(100).get();
  return {
    mods: snap.docs.map((d) => ({
      discordId: d.get('discordId') as string,
      discordName: d.get('discordName') as string,
      role: d.get('role') as string,
    })),
  };
});
