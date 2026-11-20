/** "Remember this device": token format, hashing, labels (devices.ts). */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEVICE_TOKEN_RE, cleanLabel, deviceRowId, hashDeviceToken, toDeviceRow } from '../devices';

describe('device tokens', () => {
  it('issued tokens match the accepted format', () => {
    for (let i = 0; i < 20; i++) expect(DEVICE_TOKEN_RE.test(randomBytes(32).toString('base64url'))).toBe(true);
    expect(DEVICE_TOKEN_RE.test('short')).toBe(false);
    expect(DEVICE_TOKEN_RE.test('a'.repeat(42) + '=')).toBe(false);
  });

  it('stores only a SHA-256 hash; the public id is a short prefix of it', () => {
    const t = 'x'.repeat(43);
    const h = hashDeviceToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(t);
    expect(deviceRowId(h)).toBe(h.slice(0, 12));
    expect(hashDeviceToken(t)).toBe(h);
  });

  it('never returns the hash in a device row', () => {
    const h = hashDeviceToken('y'.repeat(43));
    const row = toDeviceRow(h, { uid: 'wvw-gw2-x', label: 'Chrome · Windows', createdAt: 1, lastUsedAt: 2, expiresAt: 3 });
    expect(row).toEqual({ id: h.slice(0, 12), label: 'Chrome · Windows', createdAt: 1, lastUsedAt: 2, expiresAt: 3 });
    expect(JSON.stringify(row)).not.toContain(h);
    expect(JSON.stringify(row)).not.toContain('wvw-gw2-x');
  });

  it('cleans device labels', () => {
    expect(cleanLabel('Firefox · Android')).toBe('Firefox · Android');
    expect(cleanLabel('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(cleanLabel('')).toBe('Browser');
    expect(cleanLabel(42)).toBe('Browser');
    expect(cleanLabel('x'.repeat(100))).toHaveLength(60);
  });
});
