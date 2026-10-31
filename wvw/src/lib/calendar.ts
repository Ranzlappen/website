/**
 * Calendar math for the reset-aligned views (pure, unit-tested).
 *
 * WvW weeks run from weekly reset to weekly reset (EU Fri 18:00 UTC, NA Sat
 * 02:00 UTC — fixed in UTC, so DST never moves them). Week / Month / Link views
 * are built from reset weeks; inside a week the columns are the viewer's local
 * calendar days, so the reset day appears twice — split at the reset time:
 * "after reset" opens the week, "before reset" closes it. The Day view splits
 * the reset day the same way.
 */
import type { Region } from '../shared/teams';
import { civilToDays, daysToCivil, localParts, zonedToUtc } from '../shared/time';

export const WEEK_MS = 7 * 86_400_000;

/** Known UTC reset instants used when no live match data is loaded. */
const FALLBACK_ANCHOR: Record<Region, number> = {
  eu: Date.parse('2026-10-30T18:00:00Z'), // a Friday
  na: Date.parse('2026-10-31T02:00:00Z'), // a Saturday 02:00 UTC = Friday evening in the US
};

/** Any past or future reset instant of the region (live match start preferred). */
export function resetAnchor(region: Region, matchStarts: string[] = []): number {
  const live = matchStarts.map((s) => Date.parse(s)).filter(Number.isFinite);
  return live.length ? Math.max(...live) : FALLBACK_ANCHOR[region];
}

/** Start of the reset week containing `t`. */
export function resetWeekStart(anchor: number, t: number): number {
  return anchor + Math.floor((t - anchor) / WEEK_MS) * WEEK_MS;
}

/** Reset instants in [from, to). */
export function resetsBetween(anchor: number, from: number, to: number): number[] {
  const out: number[] = [];
  for (let r = resetWeekStart(anchor, from); r < to; r += WEEK_MS) if (r >= from) out.push(r);
  return out;
}

/** Local calendar day (days since epoch) of an instant in `tz`. */
export function localDay(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  return civilToDays(p.y, p.m, p.d);
}

/** [start, end) of a local calendar day in `tz` (23/25 h on DST days). */
export function dayBounds(day: number, tz: string): { start: number; end: number } {
  const a = daysToCivil(day);
  const b = daysToCivil(day + 1);
  return { start: zonedToUtc(a.y, a.m, a.d, 0, 0, tz), end: zonedToUtc(b.y, b.m, b.d, 0, 0, tz) };
}

export interface DayColumn {
  day: number;
  start: number;
  end: number;
  /** The reset day is split: the week opens "after" and closes "before" the reset. */
  part: 'after-reset' | 'before-reset' | null;
}

/** Split [start, end) into local-day columns (the first/last are partial when the range starts/ends mid-day). */
export function dayColumns(start: number, end: number, tz: string): DayColumn[] {
  const cols: DayColumn[] = [];
  const first = localDay(start, tz);
  const last = localDay(end - 1, tz);
  for (let d = first; d <= last; d++) {
    const b = dayBounds(d, tz);
    const s = Math.max(b.start, start);
    const e = Math.min(b.end, end);
    if (e <= s) continue;
    const part = s > b.start ? 'after-reset' : e < b.end ? 'before-reset' : null;
    cols.push({ day: d, start: s, end: e, part });
  }
  return cols;
}

/** Reset weeks whose start falls in local month `month` (1–12) of `year`. */
export function monthWeeks(year: number, month: number, tz: string, anchor: number): number[] {
  const first = civilToDays(year, month, 1);
  const next = month === 12 ? civilToDays(year + 1, 1, 1) : civilToDays(year, month + 1, 1);
  const from = dayBounds(first, tz).start;
  const to = dayBounds(next, tz).start;
  const weeks: number[] = [];
  for (let w = resetWeekStart(anchor, from); w < to; w += WEEK_MS) if (w >= from) weeks.push(w);
  // A month always shows at least the week it opens in.
  if (!weeks.length) weeks.push(resetWeekStart(anchor, from));
  return weeks;
}

/** Reset weeks covering a link: from the week containing `start` to the week containing `end - 1`. */
export function linkWeeks(start: number, end: number, anchor: number): number[] {
  const weeks: number[] = [];
  for (let w = resetWeekStart(anchor, start); w < end && weeks.length < 26; w += WEEK_MS) weeks.push(w);
  return weeks;
}

/** Local year/month of an instant. */
export function localYearMonth(ms: number, tz: string): { y: number; m: number } {
  const p = localParts(ms, tz);
  return { y: p.y, m: p.m };
}

export function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const i = y * 12 + (m - 1) + delta;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}
