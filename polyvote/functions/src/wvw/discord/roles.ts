/**
 * Hub-server role sync: Verified / Commander / Guild Leader / region / team.
 *
 * The bot owns these roles (ids in `wvwConfig/settings.discord.roles`, created
 * by the provisioning callable). Sync runs after verification, after every
 * relink re-check, and on unlink — always best-effort: a member who isn't in
 * the hub (404) or a role the bot can't manage (403) is skipped, never fatal.
 */
import { logger } from 'firebase-functions/v2';
import { getSettings, type Settings } from '../config';
import type { MemberDoc } from '../shared/types';
import { bot, botConfigured, isIgnorable } from './api';

export function desiredRoles(m: MemberDoc | null, s: Settings): { want: Set<string>; managed: Set<string> } {
  const r = s.discord.roles;
  const managed = new Set<string>(
    [r.verified, r.commander, r.guildLeader, r.eu, r.na, ...Object.values(r.teams ?? {})].filter(
      (x): x is string => !!x,
    ),
  );
  const want = new Set<string>();
  if (m && m.status === 'active' && m.verified && !m.stale) {
    if (r.verified) want.add(r.verified);
    if (m.commander && r.commander) want.add(r.commander);
    if (m.guilds.some((g) => g.leader) && r.guildLeader) want.add(r.guildLeader);
    if (m.region === 'eu' && r.eu) want.add(r.eu);
    if (m.region === 'na' && r.na) want.add(r.na);
    const teamRole = m.teamId != null ? r.teams?.[String(m.teamId)] : undefined;
    if (teamRole) want.add(teamRole);
  }
  return { want, managed };
}

export async function syncMemberRoles(discordId: string, m: MemberDoc | null): Promise<void> {
  if (!botConfigured()) return;
  const s = await getSettings();
  const guildId = s.discord.guildId;
  if (!guildId) return;
  const { want, managed } = desiredRoles(m, s);
  if (!managed.size) return;
  let current: string[];
  try {
    const gm = await bot<{ roles: string[] }>('GET', `/guilds/${guildId}/members/${discordId}`);
    current = gm.roles ?? [];
  } catch (e) {
    if (isIgnorable(e)) return;
    throw e;
  }
  const have = new Set(current);
  const tasks: Promise<unknown>[] = [];
  for (const role of want) {
    if (!have.has(role)) {
      tasks.push(bot('PUT', `/guilds/${guildId}/members/${discordId}/roles/${role}`, undefined, 'WvW Hub verification'));
    }
  }
  for (const role of current) {
    if (managed.has(role) && !want.has(role)) {
      tasks.push(bot('DELETE', `/guilds/${guildId}/members/${discordId}/roles/${role}`, undefined, 'WvW Hub verification'));
    }
  }
  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === 'rejected' && !isIgnorable(r.reason)) {
      logger.warn('wvw role sync failed', { discordId, error: String(r.reason) });
    }
  }
}

/** Add the user to the hub server with their OAuth token (`guilds.join`). */
export async function joinHub(discordId: string, accessToken: string): Promise<boolean> {
  if (!botConfigured()) return false;
  const s = await getSettings();
  if (!s.discord.guildId || !s.discord.autoJoin) return false;
  try {
    await bot('PUT', `/guilds/${s.discord.guildId}/members/${discordId}`, { access_token: accessToken });
    return true;
  } catch (e) {
    logger.warn('wvw hub auto-join failed', { discordId, error: String(e) });
    return false;
  }
}
