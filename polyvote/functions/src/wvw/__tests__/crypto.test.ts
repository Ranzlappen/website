import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { hmacHex, randomCode, safeEqualHex, seal, unseal, verifyDiscordSignature } from '../crypto';
import { isTeamId, regionOfMatch, regionOfTeam, teamFromAllWorlds, teamName } from '../shared/teams';
import { isGuildId, looksLikeApiKey } from '../gw2';

describe('seal/unseal', () => {
  const key = randomBytes(32).toString('base64');

  it('round-trips and uses a fresh IV each time', () => {
    const a = seal('secret-api-key', key);
    const b = seal('secret-api-key', key);
    expect(a.iv).not.toBe(b.iv);
    expect(unseal(a, key)).toBe('secret-api-key');
  });

  it('rejects tampering and wrong keys', () => {
    const s = seal('x', key);
    expect(() => unseal({ ...s, data: Buffer.from('y').toString('base64') }, key)).toThrow();
    expect(() => unseal(s, randomBytes(32).toString('base64'))).toThrow();
    expect(() => seal('x', randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
  });
});

describe('verifyDiscordSignature', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawPub = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');

  it('accepts a valid signature and rejects others', () => {
    const ts = '1700000000';
    const body = JSON.stringify({ type: 1 });
    const sig = sign(null, Buffer.from(ts + body), privateKey).toString('hex');
    expect(verifyDiscordSignature(Buffer.from(body), sig, ts, rawPub)).toBe(true);
    expect(verifyDiscordSignature(Buffer.from(body + ' '), sig, ts, rawPub)).toBe(false);
    expect(verifyDiscordSignature(Buffer.from(body), sig, '1700000001', rawPub)).toBe(false);
    expect(verifyDiscordSignature(Buffer.from(body), undefined, ts, rawPub)).toBe(false);
    expect(verifyDiscordSignature(Buffer.from(body), sig, ts, 'zz')).toBe(false);
  });
});

describe('hmac + codes', () => {
  it('compares HMACs in constant time', () => {
    const h = hmacHex('body', 's3cret');
    expect(safeEqualHex(h, hmacHex('body', 's3cret'))).toBe(true);
    expect(safeEqualHex(h, hmacHex('body2', 's3cret'))).toBe(false);
    expect(safeEqualHex(h, 'abc')).toBe(false);
  });

  it('generates unambiguous codes', () => {
    const c = randomCode(8);
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});

describe('teams + ids', () => {
  it('classifies teams, matches and names', () => {
    expect(isTeamId(12008)).toBe(true);
    expect(isTeamId(2008)).toBe(false);
    expect(regionOfTeam(11004)).toBe('na');
    expect(regionOfTeam(12013)).toBe('eu');
    expect(regionOfMatch('2-3')).toBe('eu');
    expect(teamName(12008)).toBe('Frost Citadel');
    expect(teamName(12008, { '12008': 'Renamed' })).toBe('Renamed');
    expect(teamName(19999)).toBe('Team 19999');
    expect(teamFromAllWorlds([2102, 12001, 2001])).toBe(12001);
    expect(teamFromAllWorlds([2013])).toBeNull();
  });

  it('validates guild ids and api keys', () => {
    expect(isGuildId('48D16D19-D4C3-408E-AF62-53A58F83FE1F')).toBe(true);
    expect(isGuildId('nope')).toBe(false);
    const key = `${'A'.repeat(8)}-${'B'.repeat(4)}-${'C'.repeat(4)}-${'D'.repeat(4)}-${'E'.repeat(20)}-${'F'.repeat(4)}-${'0'.repeat(4)}-${'1'.repeat(4)}-${'2'.repeat(12)}`;
    expect(key).toHaveLength(72);
    expect(looksLikeApiKey(key)).toBe(true);
    expect(looksLikeApiKey('hello')).toBe(false);
  });
});
