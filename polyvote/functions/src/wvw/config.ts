/**
 * WvW Hub server configuration.
 *
 * Secrets: ONE Firebase Functions secret, `WVW_SECRETS`, holding a JSON object
 * (see wvw/README.md "Setup"). One secret instead of six keeps setup to a
 * single `firebase functions:secrets:set WVW_SECRETS` — and, importantly, the
 * firebase CLI validates every `defineSecret` up front on ANY functions deploy
 * (see CLAUDE.md "Required secrets"), so it MUST exist (a `{}` placeholder is
 * enough) before this code reaches `main`. Missing fields disable the feature
 * that needs them with a clear error instead of crashing the deploy.
 *
 * Runtime settings (Discord channel/role ids, team-name overrides …) live in
 * Firestore `wvwConfig/settings`, edited from the site's Moderation → Settings
 * page, so they change without a deploy.
 */
import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const WVW_SECRETS = defineSecret('WVW_SECRETS');

export interface WvwSecrets {
  discordApplicationId?: string;
  discordClientId?: string;
  discordClientSecret?: string;
  discordBotToken?: string;
  /** Hex Ed25519 public key from the Discord developer portal. */
  discordPublicKey?: string;
  /** base64 32-byte key used to AES-256-GCM-encrypt stored GW2 API keys. */
  keyEncryptionKey?: string;
  /** Shared HMAC secret between the voice gateway worker and wvw-voiceSamples. */
  voiceWorkerSecret?: string;
  /** Discord user ids that are WvW Hub admins (bootstrap; admins can add mods). */
  adminDiscordIds?: string[];
  /** Exact OAuth redirect URIs the Discord login may use. */
  allowedRedirectUris?: string[];
}

let cached: { raw: string; parsed: WvwSecrets } | null = null;

export function secrets(): WvwSecrets {
  let raw = '';
  try {
    raw = WVW_SECRETS.value() || '';
  } catch {
    raw = process.env.WVW_SECRETS || '';
  }
  if (cached && cached.raw === raw) return cached.parsed;
  let parsed: WvwSecrets = {};
  try {
    parsed = raw ? (JSON.parse(raw) as WvwSecrets) : {};
  } catch {
    parsed = {};
  }
  cached = { raw, parsed };
  return parsed;
}

export function requireSecret<K extends keyof WvwSecrets>(key: K): NonNullable<WvwSecrets[K]> {
  const v = secrets()[key];
  if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
    throw new HttpsError(
      'failed-precondition',
      `WvW Hub is not fully configured yet (missing WVW_SECRETS.${String(key)}).`,
    );
  }
  return v as NonNullable<WvwSecrets[K]>;
}

// ── Firestore collections ────────────────────────────────────────────────

export const COL = {
  public: 'wvwPublic', // public-read index docs
  config: 'wvwConfig', // server-only settings
  guildDir: 'wvwGuildDir', // public-read guild pages
  guildPrivate: 'wvwGuildPrivate', // server-only: leader, commanders
  invites: 'wvwInvites', // server-only: commander invite codes
  members: 'wvwMembers', // owner-read only
  accounts: 'wvwAccounts', // server-only: gw2 account id -> uid (uniqueness)
  keys: 'wvwKeys', // server-only: encrypted API keys
  events: 'wvwEvents', // server-only canonical public-tier event
  eventDetails: 'wvwEventDetails', // server-only private tier
  runs: 'wvwRuns', // public-read run docs (no identities, no map)
  runPrivate: 'wvwRunPrivate', // server-only: commander, map, voice, check-ins
  ratings: 'wvwRatings', // server-only
  reports: 'wvwReports', // server-only
  claimLog: 'wvwClaimLog', // server-only: objective claims by guild
  matchDays: 'wvwMatchDays', // server-only: per-map kill/death samples
  state: 'wvwState', // server-only: poller/maintenance cursors
  audit: 'wvwAudit', // server-only: moderation + transfer log
} as const;

export const db = () => getFirestore();

// ── Runtime settings (wvwConfig/settings) ────────────────────────────────

export interface DiscordSettings {
  guildId: string | null;
  autoJoin: boolean;
  channels: Partial<
    Record<
      | 'welcome'
      | 'rules'
      | 'announcements'
      | 'raidsEu'
      | 'raidsNa'
      | 'liveEu'
      | 'liveNa'
      | 'modLog'
      | 'reports',
      string
    >
  >;
  roles: {
    verified?: string;
    commander?: string;
    guildLeader?: string;
    eu?: string;
    na?: string;
    mod?: string;
    teams?: Record<string, string>;
  };
}

export interface Settings {
  discord: DiscordSettings;
  teamNames: Record<string, string>;
  hubInviteUrl: string | null;
  announcement: string | null;
  /** Public site origin + base, used in Discord links + iCal ("https://ranzlappen.com/wvw/"). */
  siteUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  discord: { guildId: null, autoJoin: false, channels: {}, roles: {} },
  teamNames: {},
  hubInviteUrl: null,
  announcement: null,
  siteUrl: 'https://ranzlappen.com/wvw/',
};

let settingsCache: { at: number; value: Settings } | null = null;

export async function getSettings(fresh = false): Promise<Settings> {
  if (!fresh && settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache.value;
  const snap = await db().collection(COL.config).doc('settings').get();
  const data = (snap.data() ?? {}) as Partial<Settings>;
  const value: Settings = {
    ...DEFAULT_SETTINGS,
    ...data,
    discord: {
      ...DEFAULT_SETTINGS.discord,
      ...(data.discord ?? {}),
      channels: { ...(data.discord?.channels ?? {}) },
      roles: { ...(data.discord?.roles ?? {}) },
    },
    teamNames: { ...(data.teamNames ?? {}) },
  };
  settingsCache = { at: Date.now(), value };
  return value;
}

export function invalidateSettings(): void {
  settingsCache = null;
}

export function siteLink(settings: Settings, path = ''): string {
  const base = settings.siteUrl.endsWith('/') ? settings.siteUrl : `${settings.siteUrl}/`;
  return base + path.replace(/^\//, '');
}
