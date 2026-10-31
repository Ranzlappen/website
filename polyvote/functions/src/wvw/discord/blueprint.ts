/**
 * Phase 2 — the hub server blueprint.
 *
 * Declarative description of the "professional" community server: roles,
 * channel groups (incl. per-region squad voice channels), permission tiers,
 * the rules text and AutoMod rules. `adminProvisionDiscord` applies it
 * idempotently (creates what's missing by name, never edits or deletes what
 * already exists), so admins can rename / reorder freely afterwards.
 *
 * Permission tiers per channel:
 *   readonly — everyone reads, only the bot posts (announcements, raids, live)
 *   verified — everyone reads, Verified members post / connect
 *   role:<key> — hidden except for that role (Commander, Guild Leader, Mod)
 */

import { COMMUNITY_RULES } from '../shared/constants';

export type Tier = 'readonly' | 'verified' | 'role:commander' | 'role:guildLeader' | 'role:mod';
export type ChannelKind = 'text' | 'voice' | 'forum';

export interface ChannelSpec {
  name: string;
  kind: ChannelKind;
  tier: Tier;
  topic?: string;
  /** Store the created id under settings.discord.channels[key]. */
  key?: 'welcome' | 'rules' | 'announcements' | 'raidsEu' | 'raidsNa' | 'liveEu' | 'liveNa' | 'modLog' | 'reports';
  userLimit?: number;
}

export interface CategorySpec {
  name: string;
  channels: ChannelSpec[];
}

export interface RoleSpec {
  key: 'mod' | 'guildLeader' | 'commander' | 'verified' | 'eu' | 'na';
  name: string;
  color: number;
  hoist: boolean;
}

export const ROLES: RoleSpec[] = [
  { key: 'mod', name: 'Moderator', color: 0xd9534f, hoist: true },
  { key: 'guildLeader', name: 'Guild Leader', color: 0xe0b341, hoist: true },
  { key: 'commander', name: 'Commander', color: 0xf39c12, hoist: true },
  { key: 'verified', name: 'Verified', color: 0x4fbf6a, hoist: false },
  { key: 'eu', name: 'EU', color: 0x4a90d9, hoist: false },
  { key: 'na', name: 'NA', color: 0x9b59b6, hoist: false },
];

const squadVoice = (region: 'EU' | 'NA'): ChannelSpec[] => [
  { name: `${region} Squad 1`, kind: 'voice', tier: 'verified', userLimit: 99 },
  { name: `${region} Squad 2`, kind: 'voice', tier: 'verified', userLimit: 99 },
  { name: `${region} Squad 3`, kind: 'voice', tier: 'verified', userLimit: 99 },
  { name: `${region} Havoc`, kind: 'voice', tier: 'verified', userLimit: 15 },
  { name: `${region} Roaming`, kind: 'voice', tier: 'verified', userLimit: 5 },
  { name: `${region} Lounge`, kind: 'voice', tier: 'verified' },
];

export const CATEGORIES: CategorySpec[] = [
  {
    name: '📌 START HERE',
    channels: [
      { name: 'welcome', kind: 'text', tier: 'readonly', key: 'welcome', topic: 'What this server is and how to get started.' },
      { name: 'rules', kind: 'text', tier: 'readonly', key: 'rules', topic: 'Read before posting. Breaking them gets you removed.' },
      { name: 'announcements', kind: 'text', tier: 'readonly', key: 'announcements', topic: 'Hub news, relinks, maintenance.' },
      { name: 'verify-here', kind: 'text', tier: 'readonly', topic: 'Use /wvw verify — never paste API keys in Discord.' },
    ],
  },
  {
    name: '🌍 EU',
    channels: [
      { name: 'eu-raids', kind: 'text', tier: 'readonly', key: 'raidsEu', topic: 'Scheduled EU raids (posted by the bot from the WvW Hub calendar).' },
      { name: 'eu-live', kind: 'text', tier: 'readonly', key: 'liveEu', topic: 'Commanders live right now. Check in to be counted.' },
      { name: 'eu-lfg', kind: 'text', tier: 'verified', topic: 'Looking for a squad / looking for players.' },
      { name: 'eu-chat', kind: 'text', tier: 'verified' },
      ...squadVoice('EU'),
    ],
  },
  {
    name: '🌎 NA',
    channels: [
      { name: 'na-raids', kind: 'text', tier: 'readonly', key: 'raidsNa', topic: 'Scheduled NA raids (posted by the bot from the WvW Hub calendar).' },
      { name: 'na-live', kind: 'text', tier: 'readonly', key: 'liveNa', topic: 'Commanders live right now. Check in to be counted.' },
      { name: 'na-lfg', kind: 'text', tier: 'verified', topic: 'Looking for a squad / looking for players.' },
      { name: 'na-chat', kind: 'text', tier: 'verified' },
      ...squadVoice('NA'),
    ],
  },
  {
    name: '🛡️ COMMANDERS',
    channels: [
      { name: 'commander-chat', kind: 'text', tier: 'role:commander', topic: 'Verified commanders only. Cross-guild coordination.' },
      { name: 'squad-planning', kind: 'text', tier: 'role:commander' },
      { name: 'Commander Sync', kind: 'voice', tier: 'role:commander' },
    ],
  },
  {
    name: '🏰 GUILDS',
    channels: [
      { name: 'guild-recruitment', kind: 'forum', tier: 'verified', topic: 'One post per guild. Tags for region, language and playstyle.' },
      { name: 'guild-leaders', kind: 'text', tier: 'role:guildLeader', topic: 'Verified guild leaders only.' },
    ],
  },
  {
    name: '💬 COMMUNITY',
    channels: [
      { name: 'general', kind: 'text', tier: 'verified' },
      { name: 'builds-and-comps', kind: 'text', tier: 'verified' },
      { name: 'clips-and-highlights', kind: 'text', tier: 'verified' },
      { name: 'off-topic', kind: 'text', tier: 'verified' },
      { name: 'hub-feedback', kind: 'text', tier: 'verified', topic: 'Ideas and bugs for the WvW Hub website + bot.' },
    ],
  },
  {
    name: '🔧 MODERATION',
    channels: [
      { name: 'reports', kind: 'text', tier: 'role:mod', key: 'reports', topic: 'New reports from the WvW Hub.' },
      { name: 'mod-log', kind: 'text', tier: 'role:mod', key: 'modLog' },
      { name: 'mod-chat', kind: 'text', tier: 'role:mod' },
    ],
  },
];

export const WELCOME_TEXT = (site: string) =>
  [
    '**Welcome to the WvW Hub** — a cross-guild, cross-team community for Guild Wars 2 World vs. World.',
    '',
    `📅 **Calendar** — every scheduled raid on every team, in your own time zone: ${site}calendar`,
    `🏰 **Guilds** — directory with activity, raid stats and (verified-only) ratings: ${site}guilds`,
    '✅ **Verify** — run `/wvw verify` (or sign in on the website) to unlock posting, voice and your team role. Roles update automatically after every relink.',
    '🛡️ **Commanders** — `/raid schedule` to put a raid on the calendar, `/raid live` when you tag up, `/raid end` when you’re done.',
    '',
    'Raid maps, voice links and goals are only shown to verified members of the same team. Please don’t share them across teams.',
  ].join('\n');

/** Rules text lives in shared/constants.ts so the website /rules page shows the same list. */
export const RULES = COMMUNITY_RULES;

/** AutoMod rules (created via REST; existing rules with the same name are skipped). */
export const AUTOMOD = [
  {
    name: 'WvW Hub: block GW2 API keys',
    event_type: 1,
    trigger_type: 1,
    trigger_metadata: {
      regex_patterns: [
        '(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{20}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
      ],
    },
    actions: [{ type: 1, metadata: { custom_message: 'Never post GW2 API keys in Discord. Verify on the WvW Hub website instead.' } }],
    enabled: true,
  },
  {
    name: 'WvW Hub: slurs + sexual content',
    event_type: 1,
    trigger_type: 4,
    trigger_metadata: { presets: [2, 3] },
    actions: [{ type: 1 }],
    enabled: true,
  },
  {
    name: 'WvW Hub: mention spam',
    event_type: 1,
    trigger_type: 5,
    trigger_metadata: { mention_total_limit: 6, mention_raid_protection_enabled: true },
    actions: [{ type: 1 }],
    enabled: true,
  },
  {
    name: 'WvW Hub: spam',
    event_type: 1,
    trigger_type: 3,
    trigger_metadata: {},
    actions: [{ type: 1 }],
    enabled: true,
  },
];

/** Permissions the bot needs (for the invite URL shown in Moderation → Discord). */
export const BOT_PERMISSIONS = (
  (1n << 0n) | // CREATE_INSTANT_INVITE (single-use voice invites)
  (1n << 4n) | // MANAGE_CHANNELS (provisioning)
  (1n << 5n) | // MANAGE_GUILD (AutoMod rules)
  (1n << 10n) | // VIEW_CHANNEL
  (1n << 11n) | // SEND_MESSAGES
  (1n << 13n) | // MANAGE_MESSAGES (pin rules)
  (1n << 14n) | // EMBED_LINKS
  (1n << 16n) | // READ_MESSAGE_HISTORY
  (1n << 20n) | // CONNECT (see voice channels for headcounts)
  (1n << 28n) // MANAGE_ROLES (role sync)
).toString();
