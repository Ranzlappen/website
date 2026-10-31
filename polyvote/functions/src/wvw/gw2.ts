/**
 * Minimal Guild Wars 2 API v2 client (global `fetch`, no dependencies).
 *
 * Only the server talks to api.guildwars2.com: the browser reads cached
 * snapshots from Firestore, so visitors never hit ArenaNet directly (no IP
 * leak, no rate-limit pressure). Field parsing is defensive because a few
 * account fields changed shape across API schema versions.
 */
import { isTeamId } from './shared/teams';

const BASE = 'https://api.guildwars2.com/v2';
// Pin a modern schema so /v2/account includes the restructuring-era fields.
const SCHEMA = '2024-07-20T01:00:00.000Z';

export class Gw2Error extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'Gw2Error';
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function gw2Get<T>(
  path: string,
  opts: { token?: string; query?: Record<string, string>; timeoutMs?: number } = {},
): Promise<T> {
  const url = new URL(BASE + path);
  url.searchParams.set('v', SCHEMA);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      const text = await res.text();
      if (res.ok) return JSON.parse(text) as T;
      let msg = text;
      try {
        msg = (JSON.parse(text) as { text?: string }).text ?? text;
      } catch {
        /* keep raw */
      }
      // Retry only on throttling / transient server errors.
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Gw2Error(msg || `GW2 API ${res.status}`, res.status);
        await sleep(500 * (attempt + 1) ** 2);
        continue;
      }
      throw new Gw2Error(msg || `GW2 API ${res.status}`, res.status);
    } catch (e) {
      if (e instanceof Gw2Error) throw e;
      lastErr = e;
      await sleep(400 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastErr instanceof Gw2Error) throw lastErr;
  throw new Gw2Error('GW2 API unreachable', 503);
}

// ── Authenticated (API key) ─────────────────────────────────────────────

export interface TokenInfo {
  id: string;
  name: string;
  permissions: string[];
  type?: string;
}

export function tokenInfo(key: string): Promise<TokenInfo> {
  return gw2Get<TokenInfo>('/tokeninfo', { token: key });
}

export interface AccountInfo {
  id: string;
  name: string;
  guilds: string[];
  guildLeader: string[];
  commander: boolean;
  /** Team from /v2/account's `wvw` object when the schema exposes it. */
  teamId: number | null;
}

export async function account(key: string): Promise<AccountInfo> {
  const a = await gw2Get<Record<string, unknown>>('/account', { token: key });
  const wvw = (a.wvw ?? null) as Record<string, unknown> | null;
  const team = Number(wvw?.team_id ?? wvw?.team ?? NaN);
  return {
    id: String(a.id ?? ''),
    name: String(a.name ?? ''),
    guilds: Array.isArray(a.guilds) ? (a.guilds as unknown[]).map(String) : [],
    guildLeader: Array.isArray(a.guild_leader) ? (a.guild_leader as unknown[]).map(String) : [],
    commander: a.commander === true,
    teamId: isTeamId(team) ? team : null,
  };
}

export interface AccountWvw {
  teamId: number | null;
  wvwGuildId: string | null;
}

/** /v2/account/wvw — the member's current team + selected WvW guild. */
export async function accountWvw(key: string): Promise<AccountWvw> {
  const w = await gw2Get<Record<string, unknown>>('/account/wvw', { token: key });
  const team = Number(w.team ?? w.team_id ?? NaN);
  const guild = w.guild ?? w.guild_id ?? null;
  return {
    teamId: isTeamId(team) ? team : null,
    wvwGuildId: typeof guild === 'string' && guild ? guild : null,
  };
}

// ── Public ──────────────────────────────────────────────────────────────

export interface RawObjective {
  id: string;
  type: string;
  owner: string;
  last_flipped?: string;
  claimed_by?: string | null;
  claimed_at?: string | null;
  yaks_delivered?: number;
  guild_upgrades?: number[];
}

export interface RawMap {
  id: number;
  type: string;
  scores: Record<string, number>;
  kills: Record<string, number>;
  deaths: Record<string, number>;
  objectives: RawObjective[];
}

export interface RawMatch {
  id: string;
  start_time: string;
  end_time: string;
  scores: Record<string, number>;
  worlds: Record<string, number>;
  all_worlds: Record<string, number[]>;
  kills: Record<string, number>;
  deaths: Record<string, number>;
  victory_points: Record<string, number>;
  maps: RawMap[];
}

export function allMatches(): Promise<RawMatch[]> {
  return gw2Get<RawMatch[]>('/wvw/matches', { query: { ids: 'all' } });
}

export function timer(kind: 'lockout' | 'teamAssignment'): Promise<Record<string, string>> {
  return gw2Get<Record<string, string>>(`/wvw/timers/${kind}`);
}

export interface GuildPublic {
  id: string;
  name: string;
  tag: string;
}

export async function guildPublic(id: string): Promise<GuildPublic> {
  const g = await gw2Get<Record<string, unknown>>(`/guild/${encodeURIComponent(id)}`);
  return { id: String(g.id ?? id), name: String(g.name ?? ''), tag: String(g.tag ?? '') };
}

/** Every WvW guild in a region → team id (public, no key). */
export async function wvwGuildMap(region: 'na' | 'eu'): Promise<Record<string, number>> {
  const raw = await gw2Get<Record<string, string | number>>(`/wvw/guilds/${region}`, {
    timeoutMs: 20_000,
  });
  const out: Record<string, number> = {};
  for (const [g, t] of Object.entries(raw)) {
    const n = Number(t);
    if (isTeamId(n)) out[g] = n;
  }
  return out;
}

/** GW2 guild ids are GUIDs. */
export function isGuildId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(id);
}

/** GW2 API keys: 72-char key with hyphens, or a JWT subtoken. */
export function looksLikeApiKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  const k = key.trim();
  if (/^[0-9A-F-]{72}$/i.test(k)) return true;
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(k) && k.length < 2000;
}
