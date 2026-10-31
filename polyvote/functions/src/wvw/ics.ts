/**
 * iCalendar (RFC 5545) generation for subscribable raid feeds.
 *
 * Occurrences are expanded server-side into individual UTC VEVENTs (next
 * 8 weeks) instead of RRULE + TZID: no VTIMEZONE blocks to maintain, and
 * Google / Apple / Outlook all render them identically. Public tier only —
 * never the map or voice link.
 */
import { EVENT_TYPES, OPENNESS, labelOf } from './shared/constants';
import { teamName } from './shared/teams';
import { occurrencesBetween } from './shared/time';
import type { PublicEvent } from './shared/types';

export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold to 75 octets per line (continuation lines start with a space). */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8');
    const limit = out.length === 0 ? 75 : 74;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildIcs(
  events: PublicEvent[],
  opts: { name: string; siteUrl: string; now?: number; weeks?: number; teamNames?: Record<string, string> },
): string {
  const now = opts.now ?? Date.now();
  const until = now + (opts.weeks ?? 8) * 7 * 86_400_000;
  const base = opts.siteUrl.endsWith('/') ? opts.siteUrl : `${opts.siteUrl}/`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ranzlappen.com//WvW Hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(opts.name)}`,
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];
  for (const e of events) {
    if (e.status !== 'scheduled') continue;
    for (const o of occurrencesBetween(e.schedule, now - 6 * 3600_000, until, 60)) {
      const url = `${base}events/${e.id}`;
      const desc = [
        `${e.guildName}${e.official ? ' (official guild raid)' : ''}`,
        `Team: ${teamName(e.teamId, opts.teamNames)} (${e.region.toUpperCase()})`,
        `Type: ${labelOf(EVENT_TYPES, e.type)} · ${labelOf(OPENNESS, e.openness)}`,
        `Languages: ${e.languages.join(', ')}`,
        `Map, voice and goals for verified team members: ${url}`,
      ].join('\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${e.id}-${icsDate(o.start)}@wvw.ranzlappen.com`,
        `DTSTAMP:${icsDate(e.updatedAt || now)}`,
        `DTSTART:${icsDate(o.start)}`,
        `DTEND:${icsDate(o.end)}`,
        `SUMMARY:${icsEscape(`[${e.guildTag}] ${e.title}`)}`,
        `DESCRIPTION:${icsEscape(desc)}`,
        `LOCATION:${icsEscape(`GW2 WvW — ${teamName(e.teamId, opts.teamNames)}`)}`,
        `URL:${url}`,
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
