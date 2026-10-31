/** Display helpers. All times render in the viewer's chosen time zone. */
import { teamName } from '../shared/teams';
import { localParts } from '../shared/time';

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Locale for every Intl formatter — follows the UI language (store.setLang).
 * Picks the visitor's own regional variant when it matches ("de-AT", "en-US"),
 * else the bare language ("de"), so dates read naturally in the chosen language.
 */
let LOCALE: string | undefined;
export function setFormatLocale(lang: string): void {
  let tag: string = lang;
  try {
    tag = (navigator.languages ?? [navigator.language]).find((l) => l?.toLowerCase().startsWith(lang)) ?? lang;
  } catch {
    /* no navigator (tests) */
  }
  LOCALE = tag;
}
export const currentLocale = () => LOCALE;

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${LOCALE}|${tz}${JSON.stringify(opts)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone: tz, ...opts });
    cache.set(key, f);
  }
  return f;
}

export function fmtTime(ms: number, tz: string): string {
  return fmt(tz, { hour: '2-digit', minute: '2-digit' }).format(ms);
}

export function fmtDay(ms: number, tz: string): string {
  return fmt(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(ms);
}

/** "Sun" / "So." — short weekday in the UI language. */
export function fmtWeekday(ms: number, tz: string): string {
  return fmt(tz, { weekday: 'short' }).format(ms);
}

export function fmtDateTime(ms: number, tz: string): string {
  return fmt(tz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ms);
}

export function fmtRange(start: number, end: number, tz: string): string {
  return `${fmtDateTime(start, tz)} – ${fmtTime(end, tz)}`;
}

/** Day/month/year label in the UI locale (UTC date parts, e.g. a calendar column). */
export function fmtCivil(y: number, m: number, d: number, opts: Intl.DateTimeFormatOptions): string {
  return fmt('UTC', opts).format(Date.UTC(y, m - 1, d));
}

/** "in 3h 12m", "12m ago", "now" (German: "in 3 Std. 12 Min.", "vor 12 Min.", "jetzt"). */
export function relative(ms: number, now = Date.now()): string {
  const de = LOCALE?.startsWith('de');
  const diff = ms - now;
  const abs = Math.abs(diff);
  if (abs < 60_000) return de ? 'jetzt' : 'now';
  const m = Math.round(abs / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  const parts = de
    ? d ? `${d} T. ${h} Std.` : h ? `${h} Std. ${mm} Min.` : `${mm} Min.`
    : d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`;
  if (de) return diff > 0 ? `in ${parts}` : `vor ${parts}`;
  return diff > 0 ? `in ${parts}` : `${parts} ago`;
}

/** Duration only ("3h 12m" / "3 Std. 12 Min.") — e.g. "live since …". */
export function duration(ms: number): string {
  return relative(Date.now() + Math.abs(ms)).replace(/^in /, '');
}

export function countdownParts(ms: number, now = Date.now()) {
  const s = Math.max(0, Math.floor((ms - now) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function kd(kills: number, deaths: number): string {
  if (!deaths) return kills ? '∞' : '—';
  return (kills / deaths).toFixed(2);
}

export function compact(n: number): string {
  return Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function team(teamId: number | null | undefined, overrides?: Record<string, string> | null): string {
  return teamName(teamId ?? null, overrides ?? undefined);
}

/** Days since epoch of the local calendar date of `ms` in `tz`. */
export function localDayIndex(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
