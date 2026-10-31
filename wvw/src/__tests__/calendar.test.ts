import { describe, expect, it } from 'vitest';
import {
  WEEK_MS,
  dayBounds,
  dayColumns,
  linkWeeks,
  localDay,
  monthWeeks,
  resetAnchor,
  resetWeekStart,
  resetsBetween,
  shiftMonth,
} from '../lib/calendar';

const iso = (ms: number) => new Date(ms).toISOString();
const EU = Date.parse('2026-10-30T18:00:00Z');

describe('reset weeks', () => {
  it('prefers live match starts and falls back per region', () => {
    expect(resetAnchor('eu', ['2026-10-23T18:00:00Z', '2026-10-30T18:00:00Z'])).toBe(EU);
    expect(new Date(resetAnchor('na')).getUTCDay()).toBe(6); // Sat 02:00 UTC
  });

  it('finds the week containing any instant', () => {
    expect(iso(resetWeekStart(EU, Date.parse('2026-11-04T12:00:00Z')))).toBe('2026-10-30T18:00:00.000Z');
    expect(iso(resetWeekStart(EU, Date.parse('2026-11-06T18:00:00Z')))).toBe('2026-11-06T18:00:00.000Z');
    expect(iso(resetWeekStart(EU, Date.parse('2026-10-30T17:59:00Z')))).toBe('2026-10-23T18:00:00.000Z');
  });

  it('lists resets inside a range', () => {
    expect(resetsBetween(EU, Date.parse('2026-11-01T00:00:00Z'), Date.parse('2026-11-20T00:00:00Z')).map(iso)).toEqual([
      '2026-11-06T18:00:00.000Z',
      '2026-11-13T18:00:00.000Z',
    ]);
  });
});

describe('day columns', () => {
  it('splits a reset week into 8 local-day columns with the reset day split', () => {
    const cols = dayColumns(EU, EU + WEEK_MS, 'Europe/Berlin');
    expect(cols).toHaveLength(8);
    expect(cols[0].part).toBe('after-reset'); // Fri from 19:00 CET
    expect(cols[7].part).toBe('before-reset'); // next Fri until 19:00 CET
    expect(cols.slice(1, 7).every((c) => c.part === null)).toBe(true);
    expect(iso(cols[0].start)).toBe('2026-10-30T18:00:00.000Z');
    expect(iso(cols[7].end)).toBe('2026-11-06T18:00:00.000Z');
    // Columns tile the week exactly.
    for (let i = 1; i < cols.length; i++) expect(cols[i].start).toBe(cols[i - 1].end);
  });

  it('handles NA reset seen from the US (Friday evening)', () => {
    const na = Date.parse('2026-11-07T02:00:00Z');
    const cols = dayColumns(na, na + WEEK_MS, 'America/New_York');
    expect(cols[0].part).toBe('after-reset');
    expect(new Date(cols[0].start).toISOString()).toBe('2026-11-07T02:00:00.000Z');
    expect(localDay(cols[0].start, 'America/New_York')).toBe(localDay(Date.parse('2026-11-06T21:00:00-05:00'), 'America/New_York'));
  });

  it('gives 23/25-hour days across DST', () => {
    const d = localDay(Date.parse('2026-10-25T12:00:00Z'), 'Europe/Berlin');
    const b = dayBounds(d, 'Europe/Berlin');
    expect((b.end - b.start) / 3600_000).toBe(25);
  });
});

describe('month + link ranges', () => {
  it('lists the reset weeks that start in a month', () => {
    const weeks = monthWeeks(2026, 11, 'Europe/Berlin', EU);
    expect(weeks.map(iso)).toEqual([
      '2026-11-06T18:00:00.000Z',
      '2026-11-13T18:00:00.000Z',
      '2026-11-20T18:00:00.000Z',
      '2026-11-27T18:00:00.000Z',
    ]);
  });

  it('covers a link from start to the next relink', () => {
    const weeks = linkWeeks(Date.parse('2026-10-09T18:00:00Z'), Date.parse('2026-11-06T18:00:00Z'), EU);
    expect(weeks).toHaveLength(4);
    expect(iso(weeks[3])).toBe('2026-10-30T18:00:00.000Z');
  });

  it('shifts months across years', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ y: 2025, m: 12 });
  });
});
