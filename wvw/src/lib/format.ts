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

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = tz + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, { timeZone: tz, ...opts });
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

export function fmtDateTime(ms: number, tz: string): string {
  return fmt(tz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ms);
}

export function fmtRange(start: number, end: number, tz: string): string {
  return `${fmtDateTime(start, tz)} – ${fmtTime(end, tz)}`;
}

/** "in 3h 12m", "12m ago", "now" */
export function relative(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  if (abs < 60_000) return 'now';
  const m = Math.round(abs / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  const parts = d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`;
  return diff > 0 ? `in ${parts}` : `${parts} ago`;
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
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
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
