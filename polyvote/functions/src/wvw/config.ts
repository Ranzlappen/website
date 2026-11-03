/**
 * WvW Hub server configuration.
 *
 * Secrets: ONE Firebase Functions secret, `WVW_SECRETS`, holding a JSON object
 * (see wvw/README.md "Setup"). One secret keeps setup to a single
 * `firebase functions:secrets:set WVW_SECRETS` — and, importantly, the
 * firebase CLI validates every `defineSecret` up front on ANY functions deploy
 * (see CLAUDE.md "Required secrets"), so it MUST exist (a `{}` placeholder is
 * enough) before this code reaches `main`. Missing fields disable the feature
 * that needs them with a clear error instead of crashing the deploy.
 *
 * Runtime settings (team-name overrides, hub invite link, banner) live in
 * Firestore `wvwConfig/settings`, edited from the site's Moderation → Settings
 * page, so they change without a deploy.
 */
import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const WVW_SECRETS = defineSecret('WVW_SECRETS');

export interface WvwSecrets {
  /** Encrypts stored GW2 API keys (AES-256-GCM): a base64 32-byte key or any passphrase ≥ 16 characters. */
  keyEncryptionKey?: string;
  /** GW2 account names (e.g. "Name.1234") that are WvW Hub admins; admins can add mods. */
  adminAccounts?: string[];
  /**
   * Admin access key: typed into the sign-in field instead of a GW2 API key,
   * it opens an admin session (uid "wvw-admin") that sees every team's raids
   * and the moderation tools. Lives ONLY here — never in the repo. Use a long
   * random value; failed attempts are rate-limited (adminLogin.ts).
   */
  adminKey?: string;
  // Reserved for the deferred Discord integration (bot, hub server, OAuth):
  // discordApplicationId, discordClientId, discordClientSecret, discordBotToken, discordPublicKey.
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
  members: 'wvwMembers', // owner-read only
  keys: 'wvwKeys', // server-only: encrypted API keys
  events: 'wvwEvents', // server-only canonical public-tier event
  eventDetails: 'wvwEventDetails', // server-only private tier
  teamIndex: 'wvwTeamIndex', // per-team private tier index (verified same-team read)
  runs: 'wvwRuns', // public-read run docs (no identities, no map)
  runPrivate: 'wvwRunPrivate', // server-only: commander, map, voice, check-ins
  ratings: 'wvwRatings', // server-only
  reports: 'wvwReports', // server-only
  claimLog: 'wvwClaimLog', // server-only: objective claims by guild
  matchDays: 'wvwMatchDays', // server-only: per-map kill/death samples
  state: 'wvwState', // server-only: poller/maintenance cursors
  audit: 'wvwAudit', // server-only: moderation + transfer log
  bans: 'wvwBans', // server-only: banned GW2 accounts (by account id and by name)
} as const;

export const db = () => getFirestore();

// ── Runtime settings (wvwConfig/settings) ────────────────────────────────

export interface Settings {
  teamNames: Record<string, string>;
  /** Optional public link to a community Discord (plain link, no bot yet). */
  hubInviteUrl: string | null;
  announcement: string | null;
  /** Public site origin + base, used in iCal links ("https://ranzlappen.com/wvw/"). */
  siteUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
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
    teamNames: { ...(data.teamNames ?? {}) },
    hubInviteUrl: data.hubInviteUrl ?? null,
    announcement: data.announcement ?? null,
    siteUrl: data.siteUrl ?? DEFAULT_SETTINGS.siteUrl,
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
