/**
 * Client configuration. Everything here is public (no secrets).
 *
 * DISCORD_CLIENT_ID: the OAuth2 client id of the WvW Hub Discord application
 * (Discord Developer Portal → OAuth2). Until it's set, "Sign in with Discord"
 * shows a setup notice instead of redirecting. See wvw/README.md → Setup.
 */
export const APP_NAME = 'WvW Hub';

export const DISCORD_CLIENT_ID = '';

/** Vite base ("/wvw/" today; "/" once it moves to its own domain). */
export const BASE = import.meta.env.BASE_URL;

/** Cloud Functions origin (HTTP endpoints: iCal feeds). */
export const FUNCTIONS_ORIGIN = 'https://us-central1-proven-concept-436717-q3.cloudfunctions.net';

export const KOFI_URL = 'https://ko-fi.com/F1F1140LWT';
export const MAIN_SITE = 'https://ranzlappen.com/';
export const LEGAL_URL = 'https://ranzlappen.com/disclaimer/';
export const API_KEY_URL = 'https://account.arena.net/applications';

export function siteUrl(path = ''): string {
  return `${window.location.origin}${BASE}${path.replace(/^\//, '')}`;
}

export function icalUrl(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') q.set(k, String(v));
  return `${FUNCTIONS_ORIGIN}/wvw-ical${q.size ? `?${q}` : ''}`;
}
