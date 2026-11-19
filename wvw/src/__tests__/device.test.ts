/** lib/device.ts — the browser half of "remember this device" (node env + a tiny localStorage shim). */
import { beforeEach, describe, expect, it } from 'vitest';

const mem = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
  },
});
const dev = await import('../lib/device');

const TOKEN = 'A'.repeat(43);

describe('remembered device storage', () => {
  beforeEach(() => mem.clear());

  it('round-trips a device record and never accepts a malformed token', () => {
    expect(dev.loadDevice()).toBeNull();
    dev.saveDevice({ token: TOKEN, uid: 'wvw-gw2-x', accountName: 'Name.1234', savedAt: 1 });
    expect(dev.loadDevice()).toEqual({ token: TOKEN, uid: 'wvw-gw2-x', accountName: 'Name.1234', savedAt: 1 });
    mem.set('wvwhub.device', JSON.stringify({ token: 'short', uid: 'x' }));
    expect(dev.loadDevice()).toBeNull();
    mem.set('wvwhub.device', '{not json');
    expect(dev.loadDevice()).toBeNull();
    dev.clearDevice();
    expect(mem.has('wvwhub.device')).toBe(false);
  });

  it('stores no API key — only the token, uid, name and a timestamp', () => {
    dev.saveDevice({ token: TOKEN, uid: 'wvw-gw2-x', accountName: null, savedAt: 1 });
    expect(Object.keys(JSON.parse(mem.get('wvwhub.device')!)).sort()).toEqual(['accountName', 'savedAt', 'token', 'uid']);
  });

  it('tracks a deliberate sign-out and the remember preference (default on)', () => {
    expect(dev.isSignedOut()).toBe(false);
    dev.markSignedOut(true);
    expect(dev.isSignedOut()).toBe(true);
    dev.markSignedOut(false);
    expect(dev.isSignedOut()).toBe(false);
    expect(dev.rememberPref()).toBe(true);
    dev.setRememberPref(false);
    expect(dev.rememberPref()).toBe(false);
    dev.setRememberPref(true);
    expect(dev.rememberPref()).toBe(true);
  });

  it('computes the same short id as the server (SHA-256 prefix)', async () => {
    // sha256('A' × 43) — the server's deviceRowId(hashDeviceToken(token)) gives the same.
    expect(await dev.deviceRowId(TOKEN)).toBe('0f007385b6f9');
  });
});
