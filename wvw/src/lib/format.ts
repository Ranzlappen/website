/** Display helpers. All times render in the viewer's chosen time zone. */
import { teamName } from '../shared/teams';
import { localParts } from '../shared/time';
import { translate } from '../i18n/translate';
import { isLang, type Lang } from '../i18n/lang';

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
let LANG: Lang = 'en';
export function setFormatLocale(lang: string): void {
  LANG = isLang(lang) ? lang : 'en';
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

const units = new Map<string, Intl.NumberFormat>();
/** "3h" / "3 Std." / "12min" — narrow unit in the UI locale. */
function unit(u: 'day' | 'hour' | 'minute', n: number): string {
  const key = `${LOCALE ?? 'en'}|${u}`;
  let f = units.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE ?? 'en', { style: 'unit', unit: u, unitDisplay: 'narrow' });
    units.set(key, f);
  }
  return f.format(n);
}

/** Compact span like "2d 3h" / "1h 30m" / "12m" in the UI locale. */
function span(absMs: number): string {
  const m = Math.round(absMs / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  return d ? `${unit('day', d)} ${unit('hour', h)}` : h ? `${unit('hour', h)} ${unit('minute', mm)}` : unit('minute', mm);
}

/** "in 3h 12m", "12m ago", "now" — in the UI language (keys in the i18n dictionaries). */
export function relative(ms: number, now = Date.now()): string {
  const diff = ms - now;
  if (Math.abs(diff) < 60_000) return translate(LANG, 'now');
  return translate(LANG, diff > 0 ? 'in {d}' : '{d} ago', { d: span(Math.abs(diff)) });
}

/** Duration only ("3h 12m") — e.g. "live for …". */
export function duration(ms: number): string {
  return span(Math.abs(ms));
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
