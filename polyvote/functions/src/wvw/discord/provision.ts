/**
 * Admin callables that apply the hub blueprint and register slash commands.
 *
 * Idempotent: everything is matched by name and only created when missing;
 * created ids are merged into `wvwConfig/settings.discord` so announcements
 * and role sync start working immediately.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { COL, db, getSettings, invalidateSettings, requireSecret, siteLink, type Settings } from '../config';
import { teamName } from '../shared/teams';
import { COLORS as SIDES, type PublicMatches } from '../shared/types';
import { audit, callableOpts, requireRole } from '../util';
import { bot, COLORS } from './api';
import { AUTOMOD, BOT_PERMISSIONS, CATEGORIES, ROLES, RULES, WELCOME_TEXT, type ChannelSpec, type Tier } from './blueprint';
import { COMMANDS } from './commands';
import { publishPublicConfig } from '../admin';

const P = {
  VIEW: 1n << 10n,
  SEND: 1n << 11n,
  EMBED: 1n << 14n,
  HISTORY: 1n << 16n,
  REACT: 1n << 6n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  THREADS: (1n << 35n) | (1n << 36n) | (1n << 38n),
  MANAGE_MSG: 1n << 13n,
  INVITE: 1n << 0n,
};
const s = (n: bigint) => n.toString();

interface Overwrite {
  id: string;
  type: 0 | 1;
  allow: string;
  deny: string;
}

function overwritesFor(
  tier: Tier,
  kind: ChannelSpec['kind'],
  ids: { everyone: string; bot: string; roles: Record<string, string> },
): Overwrite[] {
  const botOw: Overwrite = {
    id: ids.bot,
    type: 1,
    allow: s(P.VIEW | P.SEND | P.EMBED | P.HISTORY | P.MANAGE_MSG | P.INVITE | P.CONNECT),
    deny: '0',
  };
  const voice = kind === 'voice';
  if (tier === 'readonly') {
    return [{ id: ids.everyone, type: 0, allow: s(P.VIEW | P.HISTORY), deny: s(P.SEND | P.THREADS | P.REACT) }, botOw];
  }
  if (tier === 'verified') {
    const verified = ids.roles.verified;
    const out: Overwrite[] = [
      { id: ids.everyone, type: 0, allow: s(P.VIEW | P.HISTORY), deny: s(voice ? P.CONNECT : P.SEND | P.THREADS) },
      botOw,
    ];
    if (verified) {
      out.push({ id: verified, type: 0, allow: s(voice ? P.CONNECT | P.SPEAK : P.SEND | P.THREADS | P.EMBED | P.REACT), deny: '0' });
    }
    return out;
  }
  const roleKey = tier.slice('role:'.length);
  const roleId = ids.roles[roleKey];
  const out: Overwrite[] = [{ id: ids.everyone, type: 0, allow: '0', deny: s(P.VIEW) }, botOw];
  if (roleId) {
    out.push({
      id: roleId,
      type: 0,
      allow: s(P.VIEW | P.HISTORY | (voice ? P.CONNECT | P.SPEAK : P.SEND | P.EMBED | P.THREADS | P.REACT)),
      deny: '0',
    });
  }
  if (ids.roles.mod && roleKey !== 'mod') {
    out.push({ id: ids.roles.mod, type: 0, allow: s(P.VIEW | P.HISTORY | P.SEND), deny: '0' });
  }
  return out;
}

const KIND_TYPE = { text: 0, voice: 2, forum: 15 } as const;

export const adminProvisionDiscord = onCall({ ...callableOpts, timeoutSeconds: 300 }, async (request) => {
  const admin = await requireRole(request, 'admin');
  const settings = await getSettings(true);
  const guildId = settings.discord.guildId;
  if (!guildId) throw new HttpsError('failed-precondition', 'Set the hub server id in Settings first, and invite the bot.');

  const me = await bot<{ id: string }>('GET', '/users/@me');
  const [roles, channels, automod] = await Promise.all([
    bot<Array<{ id: string; name: string }>>('GET', `/guilds/${guildId}/roles`),
    bot<Array<{ id: string; name: string; type: number; parent_id: string | null }>>('GET', `/guilds/${guildId}/channels`),
    bot<Array<{ name: string }>>('GET', `/guilds/${guildId}/auto-moderation/rules`).catch(() => []),
  ]);
  const log: string[] = [];
  const next: Settings['discord'] = {
    ...settings.discord,
    channels: { ...settings.discord.channels },
    roles: { ...settings.discord.roles, teams: { ...(settings.discord.roles.teams ?? {}) } },
  };

  // Roles
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));
  for (const spec of ROLES) {
    let id = next.roles[spec.key] && roles.some((r) => r.id === next.roles[spec.key]) ? next.roles[spec.key] : roleByName.get(spec.name);
    if (!id) {
      const created = await bot<{ id: string }>('POST', `/guilds/${guildId}/roles`, {
        name: spec.name,
        color: spec.color,
        hoist: spec.hoist,
        mentionable: false,
        permissions: '0',
      }, 'WvW Hub provisioning');
      id = created.id;
      log.push(`role ${spec.name}`);
    }
    next.roles[spec.key] = id;
  }
  // Team roles for every team in the current matchups.
  const pub = (await db().collection(COL.public).doc('matches').get()).data() as PublicMatches | undefined;
  const teamIds = new Set<number>();
  for (const m of pub?.matches ?? []) for (const c of SIDES) if (m.sides[c].teamId) teamIds.add(m.sides[c].teamId!);
  for (const t of [...teamIds].sort()) {
    const name = `Team · ${teamName(t, settings.teamNames)}`;
    let id: string | undefined = next.roles.teams![String(t)];
    if (!id || !roles.some((r) => r.id === id)) id = roleByName.get(name);
    if (!id) {
      id = (await bot<{ id: string }>('POST', `/guilds/${guildId}/roles`, { name, permissions: '0', mentionable: false }, 'WvW Hub provisioning')).id;
      log.push(`role ${name}`);
    }
    next.roles.teams![String(t)] = id!;
  }

  // Channels
  const ids = { everyone: guildId, bot: me.id, roles: next.roles as Record<string, string> };
  const created: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    let catId = channels.find((c) => c.type === 4 && c.name === cat.name)?.id;
    if (!catId) {
      catId = (await bot<{ id: string }>('POST', `/guilds/${guildId}/channels`, { name: cat.name, type: 4 }, 'WvW Hub provisioning')).id;
      log.push(`category ${cat.name}`);
    }
    for (const ch of cat.channels) {
      const existing = channels.find((c) => c.name === ch.name && c.parent_id === catId);
      let id = existing?.id;
      if (!id) {
        const body = {
          name: ch.name,
          type: KIND_TYPE[ch.kind],
          parent_id: catId,
          topic: ch.kind !== 'voice' ? ch.topic : undefined,
          user_limit: ch.kind === 'voice' ? ch.userLimit : undefined,
          permission_overwrites: overwritesFor(ch.tier, ch.kind, ids),
        };
        try {
          id = (await bot<{ id: string }>('POST', `/guilds/${guildId}/channels`, body, 'WvW Hub provisioning')).id;
        } catch (e) {
          // Forums need Community enabled — fall back to a text channel.
          if (ch.kind !== 'forum') throw e;
          id = (await bot<{ id: string }>('POST', `/guilds/${guildId}/channels`, { ...body, type: 0 }, 'WvW Hub provisioning')).id;
        }
        created[ch.name] = id;
        log.push(`channel ${ch.name}`);
      }
      if (ch.key) next.channels[ch.key] = id;
    }
  }

  // Rules + welcome messages in freshly created channels.
  const site = siteLink(settings);
  if (created.rules) {
    const msg = await bot<{ id: string }>('POST', `/channels/${created.rules}/messages`, {
      embeds: [{ title: 'Server rules', color: COLORS.gold, description: RULES.join('\n\n'), footer: { text: 'By staying on this server you agree to these rules.' } }],
    });
    await bot('PUT', `/channels/${created.rules}/pins/${msg.id}`).catch(() => {});
  }
  if (created.welcome) {
    await bot('POST', `/channels/${created.welcome}/messages`, {
      embeds: [{ title: 'WvW Hub', url: site, color: COLORS.gold, description: WELCOME_TEXT(site) }],
    });
  }
  if (created['verify-here']) {
    await bot('POST', `/channels/${created['verify-here']}/messages`, {
      content: `Run \`/wvw verify\` or go to ${site}account — sign in with Discord, create an API key with your personal code in its name, paste it on the website. **Never paste API keys in Discord.**`,
    });
  }

  // AutoMod
  const haveRules = new Set(automod.map((r) => r.name));
  for (const rule of AUTOMOD) {
    if (haveRules.has(rule.name)) continue;
    try {
      await bot('POST', `/guilds/${guildId}/auto-moderation/rules`, rule, 'WvW Hub provisioning');
      log.push(`automod ${rule.name}`);
    } catch (e) {
      log.push(`automod ${rule.name} skipped (${String((e as Error).message)})`);
    }
  }

  await db().collection(COL.config).doc('settings').set({ discord: next }, { merge: true });
  invalidateSettings();
  await publishPublicConfig(await getSettings(true));
  await audit(admin.uid, 'admin.provisionDiscord', { created: log.length });
  return { created: log, discord: next };
});

export const adminRegisterCommands = onCall(callableOpts, async (request) => {
  const admin = await requireRole(request, 'admin');
  const appId = requireSecret('discordApplicationId');
  const res = await bot<Array<{ name: string }>>('PUT', `/applications/${appId}/commands`, COMMANDS);
  await audit(admin.uid, 'admin.registerCommands', { count: res.length });
  return { registered: res.map((c) => c.name) };
});

export const adminDiscordInfo = onCall(callableOpts, async (request) => {
  await requireRole(request, 'admin');
  const appId = requireSecret('discordApplicationId');
  const settings = await getSettings(true);
  let botUser: { id: string; username: string } | null = null;
  let guild: { id: string; name: string } | null = null;
  try {
    botUser = await bot<{ id: string; username: string }>('GET', '/users/@me');
    if (settings.discord.guildId) guild = await bot<{ id: string; name: string }>('GET', `/guilds/${settings.discord.guildId}`);
  } catch {
    /* not configured / not invited yet */
  }
  return {
    inviteUrl: `https://discord.com/oauth2/authorize?client_id=${appId}&scope=bot%20applications.commands&permissions=${BOT_PERMISSIONS}`,
    bot: botUser,
    guild,
  };
});
