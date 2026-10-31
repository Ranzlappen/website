import { describe, expect, it } from 'vitest';
import {
  describeSchedule,
  isoWeekKey,
  nextOccurrence,
  occurrencesBetween,
  tzOffsetMinutes,
  validateSchedule,
  zonedToUtc,
  type Schedule,
} from '../shared/time';

const iso = (ms: number) => new Date(ms).toISOString();

describe('zonedToUtc', () => {
  it('converts Berlin summer and winter time', () => {
    // 2026-07-01 20:00 CEST (+02:00) = 18:00Z
    expect(iso(zonedToUtc(2026, 7, 1, 20, 0, 'Europe/Berlin'))).toBe('2026-07-01T18:00:00.000Z');
    // 2026-12-01 20:00 CET (+01:00) = 19:00Z
    expect(iso(zonedToUtc(2026, 12, 1, 20, 0, 'Europe/Berlin'))).toBe('2026-12-01T19:00:00.000Z');
  });

  it('handles US zones across their (different) DST change', () => {
    // US DST ends 2026-11-01. 2026-10-31 20:00 EDT = 2026-11-01T00:00Z
    expect(iso(zonedToUtc(2026, 10, 31, 20, 0, 'America/New_York'))).toBe('2026-11-01T00:00:00.000Z');
    // 2026-11-02 20:00 EST = 2026-11-03T01:00Z
    expect(iso(zonedToUtc(2026, 11, 2, 20, 0, 'America/New_York'))).toBe('2026-11-03T01:00:00.000Z');
  });

  it('shifts wall times inside a spring-forward gap', () => {
    // 2026-03-29 02:30 does not exist in Berlin → 03:30 CEST = 01:30Z
    expect(iso(zonedToUtc(2026, 3, 29, 2, 30, 'Europe/Berlin'))).toBe('2026-03-29T01:30:00.000Z');
  });

  it('picks the earlier instant for ambiguous fall-back wall times', () => {
    // 2026-10-25 02:30 happens twice in Berlin; first is CEST = 00:30Z
    expect(iso(zonedToUtc(2026, 10, 25, 2, 30, 'Europe/Berlin'))).toBe('2026-10-25T00:30:00.000Z');
  });

  it('reports offsets', () => {
    expect(tzOffsetMinutes(Date.parse('2026-07-01T12:00:00Z'), 'Europe/Berlin')).toBe(120);
    expect(tzOffsetMinutes(Date.parse('2026-12-01T12:00:00Z'), 'America/Los_Angeles')).toBe(-480);
    expect(tzOffsetMinutes(Date.parse('2026-12-01T12:00:00Z'), 'UTC')).toBe(0);
  });
});

describe('occurrencesBetween', () => {
  const weekly: Schedule = {
    tz: 'Europe/Berlin',
    date: '2026-10-19',
    time: '20:00',
    durationMin: 120,
    repeat: 'weekly',
    days: [1, 3, 5], // Mon, Wed, Fri
    until: null,
  };

  it('keeps local time stable across DST', () => {
    const occ = occurrencesBetween(weekly, Date.parse('2026-10-19T00:00Z'), Date.parse('2026-10-31T00:00Z'));
    expect(occ.map((o) => iso(o.start))).toEqual([
      '2026-10-19T18:00:00.000Z', // Mon CEST
      '2026-10-21T18:00:00.000Z', // Wed
      '2026-10-23T18:00:00.000Z', // Fri
      '2026-10-26T19:00:00.000Z', // Mon CET (after 25 Oct)
      '2026-10-28T19:00:00.000Z',
      '2026-10-30T19:00:00.000Z',
    ]);
    expect(occ[0].end - occ[0].start).toBe(120 * 60_000);
  });

  it('includes an occurrence that is still running at `from`', () => {
    const occ = occurrencesBetween(weekly, Date.parse('2026-10-19T19:30Z'), Date.parse('2026-10-19T23:00Z'));
    expect(occ).toHaveLength(1);
    expect(iso(occ[0].start)).toBe('2026-10-19T18:00:00.000Z');
  });

  it('never starts before the first date and stops at until', () => {
    const s: Schedule = { ...weekly, until: '2026-10-23' };
    const occ = occurrencesBetween(s, Date.parse('2026-10-01T00:00Z'), Date.parse('2026-12-01T00:00Z'));
    expect(occ.map((o) => iso(o.start))).toEqual([
      '2026-10-19T18:00:00.000Z',
      '2026-10-21T18:00:00.000Z',
      '2026-10-23T18:00:00.000Z',
    ]);
  });

  it('handles one-off events', () => {
    const s: Schedule = { tz: 'UTC', date: '2026-11-02', time: '19:00', durationMin: 90, repeat: 'none' };
    expect(occurrencesBetween(s, Date.parse('2026-11-01T00:00Z'), Date.parse('2026-11-03T00:00Z'))).toHaveLength(1);
    expect(occurrencesBetween(s, Date.parse('2026-11-03T00:00Z'), Date.parse('2026-11-04T00:00Z'))).toHaveLength(0);
    expect(nextOccurrence(s, Date.parse('2026-11-05T00:00Z'))).toBeNull();
  });

  it('respects the max bound', () => {
    const everyDay: Schedule = { ...weekly, days: [0, 1, 2, 3, 4, 5, 6] };
    const occ = occurrencesBetween(everyDay, Date.parse('2026-10-19T00:00Z'), Date.parse('2027-10-19T00:00Z'), 10);
    expect(occ).toHaveLength(10);
  });
});

describe('validateSchedule', () => {
  it('accepts a valid weekly schedule and rejects bad input', () => {
    expect(
      validateSchedule({ tz: 'Europe/Berlin', date: '2026-11-02', time: '20:00', durationMin: 120, repeat: 'weekly', days: [1] }),
    ).toBeNull();
    expect(validateSchedule({ tz: 'Mars/Olympus', date: '2026-11-02', time: '20:00', durationMin: 60, repeat: 'none' })).toMatch(/zone/);
    expect(validateSchedule({ tz: 'UTC', date: '2026-02-31', time: '20:00', durationMin: 60, repeat: 'none' })).toMatch(/Date/);
    expect(validateSchedule({ tz: 'UTC', date: '2026-02-01', time: '25:00', durationMin: 60, repeat: 'none' })).toMatch(/Time/);
    expect(validateSchedule({ tz: 'UTC', date: '2026-02-01', time: '20:00', durationMin: 5, repeat: 'none' })).toMatch(/Duration/);
    expect(validateSchedule({ tz: 'UTC', date: '2026-02-01', time: '20:00', durationMin: 60, repeat: 'weekly', days: [] })).toMatch(/weekday/);
    expect(
      validateSchedule({ tz: 'UTC', date: '2026-02-10', time: '20:00', durationMin: 60, repeat: 'weekly', days: [1], until: '2026-02-01' }),
    ).toMatch(/before/);
  });
});

describe('misc', () => {
  it('computes ISO week keys', () => {
    expect(isoWeekKey(Date.parse('2026-10-31T12:00Z'))).toBe('2026-W44');
    expect(isoWeekKey(Date.parse('2027-01-01T12:00Z'))).toBe('2026-W53');
    expect(isoWeekKey(Date.parse('2026-01-01T12:00Z'))).toBe('2026-W01');
  });

  it('describes schedules', () => {
    expect(
      describeSchedule({ tz: 'Europe/Berlin', date: '2026-11-02', time: '20:00', durationMin: 120, repeat: 'weekly', days: [1, 3] }),
    ).toBe('Weekly on Mon, Wed · 20:00 (Europe/Berlin)');
  });
});
