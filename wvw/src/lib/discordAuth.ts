/**
 * Discord OAuth2 (authorization-code flow). The code is exchanged by the
 * `wvw-discordLogin` callable — the client secret never reaches the browser.
 * `state` guards against login CSRF; `guilds.join` lets the bot add the
 * member to the hub server (opt-out on the Account page).
 */
import { BASE, DISCORD_CLIENT_ID } from '../config';

const STATE_KEY = 'wvw.oauthState';
const RETURN_KEY = 'wvw.oauthReturn';

export function redirectUri(): string {
  return `${window.location.origin}${BASE}auth/discord`;
}

export function discordConfigured(): boolean {
  return DISCORD_CLIENT_ID.length > 0;
}

export function startDiscordLogin(returnTo = window.location.pathname): void {
  const state = crypto.getRandomValues(new Uint32Array(4)).join('-');
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_KEY, returnTo);
  } catch {
    /* ignore */
  }
  const q = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: 'identify guilds.join',
    state,
    prompt: 'none',
  });
  window.location.assign(`https://discord.com/oauth2/authorize?${q}`);
}

export function consumeOAuthState(state: string | null): { ok: boolean; returnTo: string } {
  let expected: string | null = null;
  let returnTo = `${BASE}account`;
  try {
    expected = sessionStorage.getItem(STATE_KEY);
    returnTo = sessionStorage.getItem(RETURN_KEY) || returnTo;
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignore */
  }
  return { ok: !!state && state === expected, returnTo };
}
