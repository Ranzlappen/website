import { describe, expect, it } from 'vitest';
import { occurrencesBetween, zonedToUtc, type Schedule } from '../shared/time';
import { teamName, regionOfTeam } from '../shared/teams';
import { COMMUNITY_RULES, isOneOf, EVENT_TYPES } from '../shared/constants';
import { countdownParts, kd, localDayIndex, relative } from '../lib/format';

// The shared/ files are mirrored from polyvote/functions (scripts/check-mirror.mjs
// enforces byte-equality); these tests pin the client-side behaviour the
// calendar grid relies on.

describe('calendar time math (client)', () => {
  it('buckets an occurrence into the viewer’s local day', () => {
    const s: Schedule = { tz: 'America/Los_Angeles', date: '2026-11-02', time: '20:00', durationMin: 120, repeat: 'none' };
    const [o] = occurrencesBetween(s, Date.parse('2026-11-01T00:00Z'), Date.parse('2026-11-05T00:00Z'));
    // 20:00 PST Monday = 04:00Z Tuesday → Tuesday in Berlin, Monday in LA
    expect(new Date(o.start).toISOString()).toBe('2026-11-03T04:00:00.000Z');
    expect(localDayIndex(o.start, 'Europe/Berlin') - localDayIndex(o.start, 'America/Los_Angeles')).toBe(1);
  });

  it('computes Monday 00:00 in a zone', () => {
    expect(new Date(zonedToUtc(2026, 11, 2, 0, 0, 'Europe/Berlin')).toISOString()).toBe('2026-11-01T23:00:00.000Z');
  });
});

describe('format helpers', () => {
  it('formats K/D, relative times and countdowns', () => {
    expect(kd(10, 4)).toBe('2.50');
    expect(kd(3, 0)).toBe('∞');
    expect(kd(0, 0)).toBe('—');
    const now = Date.parse('2026-10-31T12:00:00Z');
    expect(relative(now + 90 * 60_000, now)).toBe('in 1h 30m');
    expect(relative(now - 5 * 60_000, now)).toBe('5m ago');
    expect(relative(now + 2 * 86_400_000 + 3 * 3600_000, now)).toBe('in 2d 3h');
    expect(countdownParts(now + 90_061_000, now)).toEqual({ d: 1, h: 1, m: 1, s: 1 });
    expect(countdownParts(now - 1000, now)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
  });

  it('resolves teams and validates enums', () => {
    expect(teamName(11001)).toBe('Moogooloo');
    expect(regionOfTeam(12001)).toBe('eu');
    expect(isOneOf(EVENT_TYPES, 'havoc')).toBe(true);
    expect(isOneOf(EVENT_TYPES, 'raid')).toBe(false);
    expect(COMMUNITY_RULES.length).toBeGreaterThanOrEqual(8);
  });
});
