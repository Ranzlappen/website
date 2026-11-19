/**
 * "Remember this device" on the browser side (server: polyvote/functions/src/wvw/devices.ts).
 *
 * localStorage holds a random device token — NEVER the GW2 API key — plus the
 * account name to greet you with. Two layers keep people signed in:
 *
 *  1. The Firebase session itself (refresh token in IndexedDB → localStorage,
 *     see firebase.ts) — it doesn't expire on its own.
 *  2. If that session is gone without an explicit sign-out (storage partly
 *     cleared, token revoked, …) the store silently trades the device token for
 *     a new session (`wvw-resumeDevice`). After a normal "Sign out" the Account
 *     page offers a one-click "Continue as …" instead of asking for the key.
 *
 * "Sign out & forget this device", unticking "Remember me" or Account →
 * Remembered devices revoke it.
 */
const DEVICE_KEY = 'wvwhub.device';
const SIGNED_OUT_KEY = 'wvwhub.signedOut';
const REMEMBER_KEY = 'wvwhub.remember';
const PERSIST_KEY = 'wvwhub.persistAsked';

export interface RememberedDevice {
  token: string;
  /** Whose device token this is (a different sign-in on this browser replaces it). */
  uid: string;
  /** Shown as "Continue as …" — your own account name, only on your own device. */
  accountName: string | null;
  savedAt: number;
}

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function put(key: string, value: string | null): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked (private mode etc.) — remembering just won't work */
  }
}

export function loadDevice(): RememberedDevice | null {
  try {
    const d = JSON.parse(get(DEVICE_KEY) ?? 'null') as RememberedDevice | null;
    return d && typeof d.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(d.token) ? d : null;
  } catch {
    return null;
  }
}
export const saveDevice = (d: RememberedDevice) => put(DEVICE_KEY, JSON.stringify(d));
export const clearDevice = () => put(DEVICE_KEY, null);

/** Set by a deliberate "Sign out" so the silent resume doesn't undo it. */
export const isSignedOut = () => get(SIGNED_OUT_KEY) === '1';
export const markSignedOut = (v: boolean) => put(SIGNED_OUT_KEY, v ? '1' : null);

/** "Remember me on this device" preference (default on). */
export const rememberPref = () => get(REMEMBER_KEY) !== '0';
export const setRememberPref = (v: boolean) => put(REMEMBER_KEY, v ? null : '0');

/** Same id the server shows in Remembered devices (first 12 hex chars of SHA-256). */
export async function deviceRowId(token: string): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 12);
  } catch {
    return null;
  }
}

/** "Firefox · Android" — so you can tell your devices apart. */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  const app = window.matchMedia?.('(display-mode: standalone)').matches ? ' (app)' : '';
  return `${browser}${os ? ` · ${os}` : ''}${app}`;
}

/**
 * Ask the browser not to evict this site's storage (session + device token)
 * under storage pressure. Chrome/Edge decide silently; Firefox may ask once.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (get(PERSIST_KEY) || !navigator.storage?.persist) return;
    put(PERSIST_KEY, '1');
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}
