/**
 * Tiny Discord REST client (global fetch, no discord.js).
 *
 * Everything the Hub does in Discord — slash-command replies, announcements,
 * role sync, single-use voice invites, server provisioning — is plain REST,
 * so it runs inside Cloud Functions. Only the optional voice sampler needs a
 * gateway connection (see wvw/voice-worker/).
 */
import { requireSecret, secrets } from '../config';

export const DISCORD_API = 'https://discord.com/api/v10';

export class DiscordError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null,
  ) {
    super(message);
    this.name = 'DiscordError';
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function call<T>(
  method: string,
  path: string,
  auth: string,
  body?: unknown,
  opts: { reason?: string; form?: boolean } = {},
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const headers: Record<string, string> = {
      Authorization: auth,
      'User-Agent': 'DiscordBot (https://ranzlappen.com/wvw/, 1.0)',
    };
    let payload: string | undefined;
    if (body !== undefined) {
      if (opts.form) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        payload = new URLSearchParams(body as Record<string, string>).toString();
      } else {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
    }
    if (opts.reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(opts.reason).slice(0, 512);
    const res = await fetch(DISCORD_API + path, { method, headers, body: payload });
    if (res.status === 204) return null as T;
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (res.status === 429) {
      const retry = Number((json as { retry_after?: number } | null)?.retry_after ?? 1);
      if (retry > 8) throw new DiscordError('Discord rate limit', 429, null);
      await sleep(retry * 1000 + 100);
      continue;
    }
    if (!res.ok) {
      const j = (json ?? {}) as { message?: string; code?: number };
      throw new DiscordError(j.message ?? `Discord ${res.status}`, res.status, j.code ?? null);
    }
    return json as T;
  }
  throw new DiscordError('Discord rate limit', 429, null);
}

export function botConfigured(): boolean {
  return !!secrets().discordBotToken;
}

export function bot<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  reason?: string,
): Promise<T> {
  return call<T>(method, path, `Bot ${requireSecret('discordBotToken')}`, body, { reason });
}

export function asUser<T = unknown>(accessToken: string, method: string, path: string, body?: unknown) {
  return call<T>(method, path, `Bearer ${accessToken}`, body);
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireSecret('discordClientId'),
      client_secret: requireSecret('discordClientSecret'),
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as OAuthTokens & { error_description?: string };
  if (!res.ok) {
    throw new DiscordError(json.error_description ?? 'Discord login failed', res.status, null);
  }
  return json;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

/** Ignore "member not in guild" / "unknown role" style errors in best-effort syncs. */
export function isIgnorable(e: unknown): boolean {
  return e instanceof DiscordError && (e.status === 404 || e.status === 403);
}

// ── Message helpers ─────────────────────────────────────────────────────

export interface Embed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

export interface Button {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5;
  label: string;
  custom_id?: string;
  url?: string;
  emoji?: { name: string };
  disabled?: boolean;
}

export function row(...buttons: Button[]) {
  return { type: 1, components: buttons };
}

/** Discord's `<t:unix:F>` renders in every viewer's own time zone. */
export function ts(ms: number, style: 'F' | 'f' | 'R' | 't' | 'D' = 'F'): string {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

export const COLORS = {
  gold: 0xe0b341,
  red: 0xd9534f,
  blue: 0x4a90d9,
  green: 0x4fbf6a,
  grey: 0x7a8794,
  live: 0x2ecc71,
} as const;
