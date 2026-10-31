import { describe, expect, it } from 'vitest';
import type { RawMatch } from '../gw2';
import {
  claimState,
  colorOfTeam,
  diffClaims,
  extractClaims,
  heldByGuild,
  sampleAt,
  sampleOf,
  summarizeMatches,
  windowDelta,
} from '../matchData';
import { buildIcs, foldLine, icsEscape } from '../ics';
import { aggregateRatings, parseEiJson, pickPeak, summarizeLogs } from '../metrics';
import { flattenOptions, parseDays, parseLanguages, parseLogLinks } from '../discord/commands';
import { advanceRelink } from '../maintenance';
import { heldChanges } from '../poller';
import { validateEventInput } from '../events';
import { desiredRoles } from '../discord/roles';
import { DEFAULT_SETTINGS } from '../config';
import type { MemberDoc, PublicEvent } from '../shared/types';

const G1 = '48D16D19-D4C3-408E-AF62-53A58F83FE1F';
const G2 = '9811A077-D73E-4B97-B1B3-F6944ED87E46';

function match(overrides: Partial<RawMatch> = {}): RawMatch {
  return {
    id: '2-1',
    start_time: '2026-10-30T18:00:00Z',
    end_time: '2026-11-06T17:58:00Z',
    scores: { red: 100, blue: 200, green: 300 },
    worlds: { red: 2013, blue: 2011, green: 2001 },
    all_worlds: { red: [12013, 2013], blue: [12011, 2207, 2011], green: [2102, 12001, 2001] },
    kills: { red: 10, blue: 20, green: 30 },
    deaths: { red: 5, blue: 6, green: 7 },
    victory_points: { red: 50, blue: 60, green: 70 },
    maps: [
      {
        id: 38,
        type: 'Center',
        scores: { red: 1, blue: 2, green: 3 },
        kills: { red: 4, blue: 5, green: 6 },
        deaths: { red: 1, blue: 1, green: 1 },
        objectives: [
          { id: '38-20', type: 'Tower', owner: 'Red', claimed_by: G1, claimed_at: '2026-10-31T07:34:06Z' },
          { id: '38-9', type: 'Castle', owner: 'Green', claimed_by: G2, claimed_at: '2026-10-31T08:00:00Z' },
          { id: '38-131', type: 'Spawn', owner: 'Green' },
          { id: '38-1', type: 'Keep', owner: 'Red', claimed_by: G1, claimed_at: '2026-10-31T09:00:00Z' },
        ],
      },
      {
        id: 1099,
        type: 'RedHome',
        scores: { red: 1, blue: 0, green: 0 },
        kills: { red: 1, blue: 0, green: 2 },
        deaths: { red: 0, blue: 2, green: 0 },
        objectives: [{ id: '1099-99', type: 'Camp', owner: 'Blue' }],
      },
    ],
    ...overrides,
  };
}

describe('match transforms', () => {
  it('extracts claims with team ids from all_worlds', () => {
    const claims = extractClaims([match()]);
    expect(claims).toHaveLength(3);
    expect(claims[0]).toMatchObject({ guildId: G1, color: 'red', teamId: 12013, objectiveType: 'Tower' });
    expect(claims[1]).toMatchObject({ guildId: G2, color: 'green', teamId: 12001 });
  });

  it('diffs claims so only changes are written', () => {
    const claims = extractClaims([match()]);
    const state = claimState(claims);
    expect(diffClaims(state, claims)).toHaveLength(0);
    const reclaimed = extractClaims([
      match({
        maps: [{ ...match().maps[0], objectives: [{ id: '38-20', type: 'Tower', owner: 'Blue', claimed_by: G2, claimed_at: '2026-10-31T10:00:00Z' }] }],
      }),
    ]);
    expect(diffClaims(state, reclaimed)).toHaveLength(1);
  });

  it('counts held objectives per guild', () => {
    const held = heldByGuild(extractClaims([match()]));
    expect(held.get(G1)?.count).toBe(2);
    expect(held.get(G2)?.count).toBe(1);
  });

  it('summarises sides, ownership and claiming guilds', () => {
    const [s] = summarizeMatches([match(), match({ id: '1-1', all_worlds: { red: [11001], blue: [11002], green: [11003] } })].reverse());
    expect(s.id).toBe('1-1');
    const eu = summarizeMatches([match()])[0];
    expect(eu.region).toBe('eu');
    expect(eu.sides.green).toMatchObject({ teamId: 12001, victoryPoints: 70, claimingGuilds: 1 });
    expect(eu.sides.red.owned).toEqual({ camps: 0, towers: 1, keeps: 1, castles: 0 });
    expect(eu.sides.blue.owned.camps).toBe(1);
    expect(colorOfTeam(eu, 12011)).toBe('blue');
    expect(colorOfTeam(eu, 99999)).toBeNull();
  });

  it('computes window deltas from cumulative samples', () => {
    const a = sampleOf(match(), 1000);
    const later = match();
    later.maps[0] = { ...later.maps[0], kills: { red: 14, blue: 5, green: 6 }, deaths: { red: 3, blue: 1, green: 1 } };
    const b = sampleOf(later, 2000);
    expect(windowDelta(a, b, 'red', ['Center'])).toEqual({ kills: 10, deaths: 2 });
    expect(windowDelta(a, b, 'red', [])).toEqual({ kills: 10, deaths: 2 });
    expect(sampleAt([a, b], 1500)).toBe(a);
    expect(sampleAt([a, b], 500)).toBe(a);
    expect(sampleAt([a, b], 2500)).toBe(b);
  });
});

const ev = (o: Partial<PublicEvent> = {}): PublicEvent => ({
  id: 'e1',
  guildId: G1,
  guildTag: 'AoD',
  guildName: 'Age Of Destiny',
  official: true,
  region: 'eu',
  teamId: 12008,
  title: 'Monday, zerg; night',
  type: 'zerg',
  openness: 'open',
  languages: ['en', 'de'],
  schedule: { tz: 'Europe/Berlin', date: '2026-11-02', time: '20:00', durationMin: 120, repeat: 'weekly', days: [1], until: null },
  status: 'scheduled',
  liveRunId: null,
  createdAt: 0,
  updatedAt: Date.parse('2026-10-31T00:00:00Z'),
  ...o,
});

describe('ics', () => {
  it('escapes and folds per RFC 5545', () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const long = 'DESCRIPTION:' + 'x'.repeat(200);
    const folded = foldLine(long);
    expect(folded.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });

  it('expands weekly events into UTC occurrences and skips cancelled ones', () => {
    const ics = buildIcs([ev(), ev({ id: 'e2', status: 'cancelled' })], {
      name: 'Test',
      siteUrl: 'https://ranzlappen.com/wvw/',
      now: Date.parse('2026-10-31T12:00:00Z'),
      weeks: 2,
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261102T190000Z'); // 20:00 CET
    expect(ics).toContain('DTSTART:20261109T190000Z');
    expect(ics).not.toContain('e2-');
    expect(ics).toContain('SUMMARY:[AoD] Monday\\, zerg\\; night');
    expect(ics).toContain('Frost Citadel');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

describe('metrics', () => {
  it('parses Elite Insights JSON into counts only', () => {
    const r = parseEiJson({
      durationMS: 30 * 60_000,
      players: [
        { account: 'Secret.1234', notInSquad: false, statsAll: [{ killed: 5 }], defenses: [{ deadCount: 1 }] },
        { account: 'Other.5678', statsAll: [{ killed: 3 }], defenses: [{ deadCount: 0 }] },
        { account: 'Pug.0001', notInSquad: true, statsAll: [{ killed: 99 }] },
      ],
    });
    expect(r).toEqual({ squad: 2, kills: 8, deaths: 1, durationMin: 30 });
    expect(JSON.stringify(r)).not.toContain('Secret');
    expect(parseEiJson({})).toBeNull();
  });

  it('prefers the most trustworthy squad-size source', () => {
    const logs = summarizeLogs([
      { permalink: 'a', squad: 30, kills: 10, deaths: 2, durationMin: 20 },
      { permalink: 'b', squad: 42, kills: 5, deaths: 1, durationMin: 25 },
    ]);
    expect(logs).toMatchObject({ count: 2, maxSquad: 42, kills: 15, durationMin: 45 });
    expect(pickPeak({ logs, voice: { peak: 50, avg: 40, samples: 3 }, checkins: 10, reported: 60 })).toEqual({ peak: 42, peakSource: 'logs' });
    expect(pickPeak({ logs: null, voice: { peak: 50, avg: 40, samples: 3 }, checkins: 10, reported: 60 })).toEqual({ peak: 50, peakSource: 'voice' });
    expect(pickPeak({ logs: null, voice: null, checkins: 0, reported: 25 })).toEqual({ peak: 25, peakSource: 'reported' });
    expect(pickPeak({ logs: null, voice: null, checkins: 0, reported: null })).toEqual({ peak: null, peakSource: null });
  });

  it('hides ratings below the threshold and weights raters equally', () => {
    const s = (v: number) => ({ organisation: v, communication: v, newcomers: v, fun: v });
    expect(aggregateRatings([{ uid: 'a', scores: s(5) }])).toBeNull();
    const rows = [
      ...Array.from({ length: 10 }, () => ({ uid: 'spammer', scores: s(1) })),
      ...['b', 'c', 'd', 'e'].map((uid) => ({ uid, scores: s(5) })),
    ];
    const agg = aggregateRatings(rows)!;
    expect(agg.n).toBe(5);
    expect(agg.organisation).toBe(4.2); // (1 + 5*4) / 5, not dragged down by 10 spam ratings
  });
});

describe('discord command parsing', () => {
  it('flattens subcommand options and focus', () => {
    const r = flattenOptions([
      { type: 1, name: 'schedule', options: [{ type: 3, name: 'guild', value: 'x', focused: true }, { type: 4, name: 'duration', value: 90 }] },
    ]);
    expect(r).toEqual({ sub: 'schedule', opts: { guild: 'x', duration: 90 }, focused: 'guild' });
  });

  it('parses days, languages and log links', () => {
    expect(parseDays('Mon, wed fri')).toEqual([1, 3, 5]);
    expect(parseDays('mo,di,so')).toEqual([0, 1, 2]);
    expect(parseLanguages(undefined)).toEqual(['en']);
    expect(parseLanguages('EN, de,de')).toEqual(['en', 'de']);
    expect(parseLogLinks('see https://dps.report/abc-123 and https://b.dps.report/XyZ_9 and https://evil.com/x')).toEqual([
      'https://dps.report/abc-123',
      'https://b.dps.report/XyZ_9',
    ]);
  });
});

describe('held-objective diffing', () => {
  it('only writes guilds whose held count changed', () => {
    const held = new Map([
      ['a', { count: 2 }],
      ['b', { count: 1 }],
    ]);
    expect(heldChanges(held, { a: 2, b: 3, c: 1, d: 0 })).toEqual([
      ['b', 1],
      ['c', 0],
    ]);
    expect(heldChanges(held, { a: 2, b: 1 })).toEqual([]);
  });
});

describe('relink bookkeeping', () => {
  it('records a relink once the previously announced assignment time passes', () => {
    const t1 = '2026-11-06T18:00:00Z';
    const t2 = '2026-12-04T18:00:00Z';
    let st = advanceRelink({ next: {}, last: {} }, { eu: t1 }, Date.parse('2026-11-01T00:00:00Z'));
    expect(st.happened).toEqual([]);
    expect(st.next.eu).toBe(t1);
    st = advanceRelink(st, { eu: t1 }, Date.parse('2026-11-06T18:05:00Z'));
    expect(st.happened).toEqual(['eu']);
    expect(st.last.eu).toBe(Date.parse(t1));
    st = advanceRelink(st, { eu: t2 }, Date.parse('2026-11-06T18:15:00Z'));
    expect(st.happened).toEqual([]);
    expect(st.next.eu).toBe(t2);
  });
});

describe('event validation', () => {
  const base = {
    guildId: G1,
    title: '  Monday zerg  ',
    type: 'zerg',
    openness: 'open',
    languages: ['en', 'xx'],
    schedule: { tz: 'Europe/Berlin', date: '2026-11-02', time: '20:00', durationMin: 120, repeat: 'weekly', days: [3, 1] },
    map: 'ebg',
    goals: '',
    expectedSize: 30,
    voice: { kind: 'discord', url: 'https://discord.com/channels/1/2' },
    buildsUrl: null,
    notes: '',
  };
  const now = Date.parse('2026-10-31T12:00:00Z');

  it('normalises valid input', () => {
    const r = validateEventInput(base, now);
    expect(r.title).toBe('Monday zerg');
    expect(r.languages).toEqual(['en']);
    expect(r.schedule.days).toEqual([1, 3]);
    expect(r.schedule.until).toBeNull();
  });

  it('rejects bad input', () => {
    expect(() => validateEventInput({ ...base, type: 'nope' }, now)).toThrow(/raid type/);
    expect(() => validateEventInput({ ...base, languages: [] }, now)).toThrow(/language/);
    expect(() => validateEventInput({ ...base, voice: { kind: 'discord', url: 'https://evil.example/x' } }, now)).toThrow(/Voice link/);
    expect(() => validateEventInput({ ...base, voice: { kind: 'other', url: 'javascript:alert(1)' } }, now)).toThrow();
    expect(() =>
      validateEventInput({ ...base, schedule: { ...base.schedule, repeat: 'none', date: '2026-10-01' } }, now),
    ).toThrow(/past/);
    expect(() =>
      validateEventInput({ ...base, schedule: { ...base.schedule, date: '2027-06-01' } }, now),
    ).toThrow(/days ahead/);
    expect(() => validateEventInput({ ...base, expectedSize: 500 }, now)).toThrow(/Expected size/);
  });
});

describe('role sync plan', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    discord: {
      ...DEFAULT_SETTINGS.discord,
      roles: { verified: 'v', commander: 'c', guildLeader: 'gl', eu: 'eu', na: 'na', teams: { '12008': 't8', '12001': 't1' } },
    },
  };
  const member = {
    status: 'active',
    verified: true,
    stale: false,
    commander: true,
    region: 'eu',
    teamId: 12008,
    guilds: [{ id: G1, tag: 'AoD', name: 'x', leader: false, appointed: true }],
  } as unknown as MemberDoc;

  it('wants exactly the matching roles', () => {
    const { want, managed } = desiredRoles(member, settings);
    expect([...want].sort()).toEqual(['c', 'eu', 't8', 'v']);
    expect(managed.has('t1')).toBe(true);
  });

  it('wants nothing for stale, suspended or deleted members', () => {
    expect(desiredRoles({ ...member, stale: true }, settings).want.size).toBe(0);
    expect(desiredRoles({ ...member, status: 'suspended' }, settings).want.size).toBe(0);
    expect(desiredRoles(null, settings).want.size).toBe(0);
  });
});
