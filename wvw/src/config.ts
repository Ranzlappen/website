/** Client configuration. Everything here is public (no secrets). */
export const APP_NAME = 'WvW Hub';

/** API keys must be named so they contain this (server checks via /v2/tokeninfo). */
export const KEY_NAME = 'WvW Hub';

/** Vite base ("/" on wvwhub.de; "/wvw/" when built into the ranzlappen.com site). */
export const BASE = import.meta.env.BASE_URL;

/** Cloud Functions origin (HTTP endpoints: iCal feeds). */
export const FUNCTIONS_ORIGIN = 'https://us-central1-proven-concept-436717-q3.cloudfunctions.net';

export const KOFI_URL = 'https://ko-fi.com/F1F1140LWT';
export const API_KEY_URL = 'https://account.arena.net/applications';

export function siteUrl(path = ''): string {
  return `${window.location.origin}${BASE}${path.replace(/^\//, '')}`;
}

export function icalUrl(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') q.set(k, String(v));
  return `${FUNCTIONS_ORIGIN}/wvw-ical${q.size ? `?${q}` : ''}`;
}
