/** The write/read-saving helpers (README "Usage & cost"). */
import { describe, expect, it } from 'vitest';
import { claimsToLog, heldDoc, mapSignature } from '../poller';
import { guildRow, recentWeeks } from '../indexes';
import { guildDirPatch } from '../members';
import { stableJson } from '../util';
import type { Claim } from '../matchData';
import type { GuildDirDoc } from '../shared/types';

const G1 = '48D16D19-D4C3-408E-AF62-53A58F83FE1F';
const G2 = '9811A077-D73E-4B97-B1B3-F6944ED87E46';

describe('stableJson', () => {
  it('ignores key order at every level and drops undefined', () => {
    expect(stableJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(
      stableJson({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1, z: undefined }),
    );
  });
  it('keeps array order meaningful', () => {
    expect(stableJson([1, 2])).not.toBe(stableJson([2, 1]));
  });
});

describe('poller write budget', () => {
  it('fingerprints guild maps independent of key order', () => {
    expect(mapSignature({ [G1]: 1001, [G2]: 2002 })).toBe(mapSignature({ [G2]: 2002, [G1]: 1001 }));
    expect(mapSignature({ [G1]: 1001 })).not.toBe(mapSignature({ [G1]: 1002 }));
  });

  it('logs individual claims only for guilds with a live run', () => {
    const c = (guildId: string) => ({ guildId, key: `o-${guildId}`, claimedAt: 1 }) as Claim;
    expect(claimsToLog([c(G1), c(G2), c(G1)], new Set([G1])).map((x) => x.guildId)).toEqual([G1, G1]);
    expect(claimsToLog([c(G1)], new Set())).toEqual([]);
  });

  it('splits held counts per region into one doc', () => {
    const held = new Map([
      [G1, { count: 3, teamId: 12008 }],
      [G2, { count: 1, teamId: 11003 }],
      ['X', { count: 2, teamId: null }],
    ]);
    expect(heldDoc(held, 5)).toEqual({ updatedAt: 5, eu: { [G1]: 3 }, na: { [G2]: 1 } });
  });
});

describe('guild directory rows', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const weeks = recentWeeks(now, 8);
  const ctx = { keep8: new Set(weeks), weeks4: weeks.slice(0, 4), held: 0, upcoming: 0 };
  const g = (p: Partial<GuildDirDoc> = {}): GuildDirDoc =>
    ({ id: G1, name: 'Keks', tag: 'KEKS', region: 'eu', teamId: 12008, claimed: false, suspended: false, profile: null, activity: {}, lastSeenAt: null, commanderCount: 0, stats: null, updatedAt: 0, ...p }) as GuildDirDoc;

  it('lists active, held, upcoming or leader-verified guilds only', () => {
    expect(guildRow(g(), ctx)).toBeNull();
    expect(guildRow(g({ claimed: true }), ctx)?.tag).toBe('KEKS');
    expect(guildRow(g(), { ...ctx, held: 2 })?.heldNow).toBe(2);
    expect(guildRow(g(), { ...ctx, upcoming: 1 })?.upcoming).toBe(1);
    expect(guildRow(g({ activity: { [weeks[6]]: { claims: 4 } } as GuildDirDoc['activity'] }), ctx)?.claims4w).toBe(0);
    expect(guildRow(g({ activity: { [weeks[1]]: { claims: 4 } } as GuildDirDoc['activity'] }), ctx)?.claims4w).toBe(4);
  });

  it('hides suspended and unnamed guilds', () => {
    expect(guildRow(g({ claimed: true, suspended: true }), ctx)).toBeNull();
    expect(guildRow(g({ claimed: true, name: '' }), ctx)).toBeNull();
  });

  it('prefers the remapped team after a relink', () => {
    expect(guildRow(g({ claimed: true }), { ...ctx, teamId: 12011 })?.teamId).toBe(12011);
  });
});

describe('sign-in directory patch', () => {
  it('marks only led guilds as claimed and adds the region', () => {
    expect(guildDirPatch({ id: G1, name: 'Keks', tag: 'KEKS', leader: true }, 12008)).toEqual({
      id: G1,
      name: 'Keks',
      tag: 'KEKS',
      claimed: true,
      teamId: 12008,
      region: 'eu',
    });
    expect(guildDirPatch({ id: G1, name: 'Keks', tag: 'KEKS', leader: false }, null)).toEqual({ id: G1, name: 'Keks', tag: 'KEKS' });
  });
});
