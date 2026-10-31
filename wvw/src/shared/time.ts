/**
 * Time-zone + recurrence engine for WvW Hub schedules.
 *
 * MIRRORED FILE — keep identical to `polyvote/functions/src/wvw/shared/time.ts`.
 *
 * WvW raids are weekly ("Mon/Wed/Fri 20:00 Berlin time"), so a schedule is
 * anchored to the organiser's *local wall-clock* in an IANA zone and expanded
 * into UTC instants on demand. That keeps 20:00 at 20:00 across DST changes
 * (EU and US switch on different dates). No date library: only `Intl`, which
 * both Node 22 and every evergreen browser ship with full tz data.
 */

export type Repeat = 'none' | 'weekly';

export interface Schedule {
  /** IANA zone of the organiser, e.g. "Europe/Berlin". */
  tz: string;
  /** First local date, "YYYY-MM-DD" (the date itself for one-off events). */
  date: string;
  /** Local start time, "HH:MM" (24h). */
  time: string;
  durationMin: number;
  repeat: Repeat;
  /** Weekly only: local weekdays, 0 = Sunday … 6 = Saturday. */
  days?: number[];
  /** Weekly only: last local date (inclusive), "YYYY-MM-DD", or null = open-ended. */
  until?: string | null;
}

export interface Occurrence {
  start: number; // UTC epoch ms
  end: number; // UTC epoch ms
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function parseDate(s: string): { y: number; m: number; d: number } | null {
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Reject impossible dates like 2026-02-31.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCMonth() !== mo - 1) return null;
  return { y, m: mo, d };
}

export function parseTime(s: string): { h: number; mi: number } | null {
  const m = TIME_RE.exec(s);
  return m ? { h: Number(m[1]), mi: Number(m[2]) } : null;
}

/** Days since 1970-01-01 for a civil (calendar) date — tz-free arithmetic. */
export function civilToDays(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function daysToCivil(days: number): { y: number; m: number; d: number } {
  const dt = new Date(days * DAY_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** 0 = Sunday. 1970-01-01 was a Thursday. */
export function weekdayOfDays(days: number): number {
  return (((days + 4) % 7) + 7) % 7;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export interface LocalParts {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  weekday: number;
}

/** Wall-clock parts of a UTC instant in `tz`. */
export function localParts(utcMs: number, tz: string): LocalParts {
  const parts = partsFormatter(tz).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const y = get('year');
  const m = get('month');
  const d = get('day');
  return {
    y,
    m,
    d,
    h: get('hour') % 24,
    mi: get('minute'),
    s: get('second'),
    weekday: weekdayOfDays(civilToDays(y, m, d)),
  };
}

/** Offset of `tz` from UTC at `utcMs`, in minutes (Berlin summer = +120). */
export function tzOffsetMinutes(utcMs: number, tz: string): number {
  const p = localParts(utcMs, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/**
 * UTC instant for a local wall-clock time in `tz`. Times inside a DST gap
 * (e.g. 02:30 on spring-forward night) resolve to the shifted instant, and
 * ambiguous fall-back times resolve to the first (earlier) occurrence.
 */
export function zonedToUtc(
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): number {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const off1 = tzOffsetMinutes(guess, tz);
  let t = guess - off1 * 60_000;
  const off2 = tzOffsetMinutes(t, tz);
  if (off2 !== off1) t = guess - off2 * 60_000;
  // Prefer the earlier instant for ambiguous (fall-back) wall times.
  const earlier = t - 60 * 60_000;
  const pe = localParts(earlier, tz);
  if (pe.y === y && pe.m === m && pe.d === d && pe.h === h && pe.mi === mi) return earlier;
  return t;
}

export function validateSchedule(s: Partial<Schedule>): string | null {
  if (!s || typeof s !== 'object') return 'Schedule is required.';
  if (!isValidTimeZone(s.tz)) return 'Unknown time zone.';
  if (typeof s.date !== 'string' || !parseDate(s.date)) return 'Date must be YYYY-MM-DD.';
  if (typeof s.time !== 'string' || !parseTime(s.time)) return 'Time must be HH:MM (24h).';
  if (
    typeof s.durationMin !== 'number' ||
    !Number.isInteger(s.durationMin) ||
    s.durationMin < 15 ||
    s.durationMin > 720
  ) {
    return 'Duration must be between 15 minutes and 12 hours.';
  }
  if (s.repeat !== 'none' && s.repeat !== 'weekly') return 'Repeat must be none or weekly.';
  if (s.repeat === 'weekly') {
    const days = s.days;
    if (
      !Array.isArray(days) ||
      days.length === 0 ||
      days.length > 7 ||
      days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
      new Set(days).size !== days.length
    ) {
      return 'Pick at least one weekday.';
    }
    if (s.until != null) {
      if (typeof s.until !== 'string' || !parseDate(s.until)) return 'End date must be YYYY-MM-DD.';
      if (s.until < s.date) return 'End date is before the start date.';
    }
  }
  return null;
}

/** Normalise a validated schedule into the canonical stored shape. */
export function normaliseSchedule(s: Schedule): Schedule {
  if (s.repeat === 'weekly') {
    return {
      tz: s.tz,
      date: s.date,
      time: s.time,
      durationMin: s.durationMin,
      repeat: 'weekly',
      days: [...(s.days ?? [])].sort((a, b) => a - b),
      until: s.until ?? null,
    };
  }
  return { tz: s.tz, date: s.date, time: s.time, durationMin: s.durationMin, repeat: 'none' };
}

/**
 * Occurrences whose [start, end) overlaps [fromMs, toMs), oldest first.
 * Bounded by `max` so a malformed schedule can never loop unboundedly.
 */
export function occurrencesBetween(
  s: Schedule,
  fromMs: number,
  toMs: number,
  max = 500,
): Occurrence[] {
  const first = parseDate(s.date);
  const t = parseTime(s.time);
  if (!first || !t || toMs <= fromMs) return [];
  const dur = s.durationMin * 60_000;
  const out: Occurrence[] = [];

  const mk = (days: number): Occurrence => {
    const c = daysToCivil(days);
    const start = zonedToUtc(c.y, c.m, c.d, t.h, t.mi, s.tz);
    return { start, end: start + dur };
  };

  const firstDays = civilToDays(first.y, first.m, first.d);
  if (s.repeat !== 'weekly') {
    const o = mk(firstDays);
    if (o.end > fromMs && o.start < toMs) out.push(o);
    return out;
  }

  const days = new Set(s.days ?? []);
  const until = s.until ? parseDate(s.until) : null;
  const lastDays = until ? civilToDays(until.y, until.m, until.d) : Number.POSITIVE_INFINITY;
  // Start one day before `from` (minus the duration) in the zone's local calendar
  // so an occurrence that started yesterday evening and is still running counts.
  const fromLocal = localParts(fromMs - dur, s.tz);
  let cursor = Math.max(firstDays, civilToDays(fromLocal.y, fromLocal.m, fromLocal.d) - 1);
  const toLocal = localParts(toMs, s.tz);
  const stop = Math.min(lastDays, civilToDays(toLocal.y, toLocal.m, toLocal.d) + 1);

  for (; cursor <= stop && out.length < max; cursor++) {
    if (!days.has(weekdayOfDays(cursor))) continue;
    const o = mk(cursor);
    if (o.end > fromMs && o.start < toMs) out.push(o);
  }
  return out;
}

/** The running-or-next occurrence at `nowMs`, looking up to `horizonDays` ahead. */
export function nextOccurrence(s: Schedule, nowMs: number, horizonDays = 400): Occurrence | null {
  return occurrencesBetween(s, nowMs, nowMs + horizonDays * DAY_MS, 1)[0] ?? null;
}

/** True once a schedule can never produce another occurrence after `nowMs`. */
export function isScheduleFinished(s: Schedule, nowMs: number): boolean {
  return nextOccurrence(s, nowMs) === null;
}

/** ISO-8601 week key in UTC, e.g. "2026-W44". */
export function isoWeekKey(ms: number): string {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = 1 + Math.floor((thursday.getTime() - yearStart) / (7 * DAY_MS));
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** "YYYYMMDD" in UTC. */
export function utcDateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Human summary like "Weekly on Mon, Wed · 20:00 (Europe/Berlin)". */
export function describeSchedule(s: Schedule): string {
  if (s.repeat === 'weekly') {
    const days = (s.days ?? []).map((d) => WEEKDAY_SHORT[d]).join(', ');
    const until = s.until ? ` until ${s.until}` : '';
    return `Weekly on ${days} · ${s.time} (${s.tz})${until}`;
  }
  return `${s.date} · ${s.time} (${s.tz})`;
}
