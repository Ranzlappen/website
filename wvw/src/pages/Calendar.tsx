import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBox, GuildTag, PageHeader, Segmented, Skeleton } from '../components/ui';
import { TzPicker } from '../components/TzPicker';
import { useDocumentTitle, useEventIndex, useMatches, useTeamNames } from '../lib/hooks';
import { fmtTime, localDayIndex, team } from '../lib/format';
import { icalUrl } from '../config';
import { isVerified, useStore } from '../store';
import { EVENT_TYPES, LANGUAGES, labelOf, type EventType, type Language } from '../shared/constants';
import { civilToDays, daysToCivil, localParts, occurrencesBetween, weekdayOfDays, zonedToUtc } from '../shared/time';
import { COLORS, type PublicEvent } from '../shared/types';
import type { Region } from '../shared/teams';

interface Slot {
  e: PublicEvent;
  start: number;
  end: number;
}

function weekBounds(tz: string, offset: number) {
  const now = localParts(Date.now(), tz);
  const today = civilToDays(now.y, now.m, now.d);
  const monday = today - ((weekdayOfDays(today) + 6) % 7) + offset * 7;
  const at = (days: number) => {
    const c = daysToCivil(days);
    return zonedToUtc(c.y, c.m, c.d, 0, 0, tz);
  };
  return { monday, start: at(monday), end: at(monday + 7), today };
}

export default function Calendar() {
  useDocumentTitle('Calendar');
  const member = useStore((s) => s.member);
  const tz = useStore((s) => s.displayTz);
  const names = useTeamNames();
  const verified = isVerified(member);
  const [region, setRegion] = useState<Region>(member?.region ?? 'eu');
  const [teamSel, setTeamSel] = useState<string>(verified ? 'mine' : 'all');
  const [type, setType] = useState<EventType | 'all'>('all');
  const [lang, setLang] = useState<Language | 'all'>('all');
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useEventIndex(region);
  const matches = useMatches();

  const teams = useMemo(() => {
    const ids = new Set<number>();
    for (const m of matches.data?.matches ?? []) if (m.region === region) for (const c of COLORS) if (m.sides[c].teamId) ids.add(m.sides[c].teamId!);
    return [...ids].sort((a, b) => team(a, names).localeCompare(team(b, names)));
  }, [matches.data, region, names]);

  const teamId = teamSel === 'mine' ? (member?.region === region ? member?.teamId ?? null : null) : teamSel === 'all' ? null : Number(teamSel);
  const wb = weekBounds(tz, offset);

  const days = useMemo(() => {
    const buckets: Slot[][] = Array.from({ length: 7 }, () => []);
    for (const e of data?.events ?? []) {
      if (e.status === 'suspended') continue;
      if (teamId && e.teamId !== teamId) continue;
      if (type !== 'all' && e.type !== type) continue;
      if (lang !== 'all' && !e.languages.includes(lang)) continue;
      for (const o of occurrencesBetween(e.schedule, wb.start, wb.end, 14)) {
        const idx = localDayIndex(o.start, tz) - wb.monday;
        if (idx >= 0 && idx < 7) buckets[idx].push({ e, ...o });
      }
    }
    for (const b of buckets) b.sort((a, b2) => a.start - b2.start);
    return buckets;
  }, [data, teamId, type, lang, wb.start, wb.end, wb.monday, tz]);

  const total = days.reduce((s, d) => s + d.length, 0);
  const feed = icalUrl({ region, team: teamId, type: type === 'all' ? null : type });
  const dayLabel = (i: number) => {
    const c = daysToCivil(wb.monday + i);
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(Date.UTC(c.y, c.m - 1, c.d));
  };

  return (
    <div>
      <PageHeader
        title="Raid calendar"
        sub="Scheduled WvW raids across every team. Map, voice and goals are visible to verified members of the same team."
        actions={
          verified && member?.commander ? (
            <Link to="/events/new" className="btn btn-gold">
              + Post a raid
            </Link>
          ) : undefined
        }
      />

      <div className="card card-pad mb-5 flex flex-wrap items-end gap-3">
        <Segmented options={[{ id: 'eu', label: 'EU' }, { id: 'na', label: 'NA' }]} value={region} onChange={(r) => { setRegion(r); if (teamSel !== 'mine') setTeamSel('all'); }} />
        <label className="min-w-[11rem]">
          <span className="label">Team</span>
          <select className="select" value={teamSel} onChange={(e) => setTeamSel(e.target.value)}>
            <option value="all">All teams</option>
            {verified && member?.region === region && <option value="mine">My team ({team(member.teamId, names)})</option>}
            {teams.map((t) => (
              <option key={t} value={t}>
                {team(t, names)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[10rem]">
          <span className="label">Type</span>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as EventType | 'all')}>
            <option value="all">All types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[8rem]">
          <span className="label">Language</span>
          <select className="select" value={lang} onChange={(e) => setLang(e.target.value as Language | 'all')}>
            <option value="all">Any</option>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto">
          <TzPicker compact />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" onClick={() => setOffset(offset - 1)} aria-label="Previous week">
            ←
          </button>
          <button className="btn btn-sm" onClick={() => setOffset(0)} disabled={offset === 0}>
            This week
          </button>
          <button className="btn btn-sm" onClick={() => setOffset(offset + 1)} aria-label="Next week">
            →
          </button>
          <span className="muted ml-2 text-sm">
            {dayLabel(0)} – {dayLabel(6)} · {total} raid{total === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex gap-2">
          <a className="btn btn-sm" href={feed.replace(/^https:/, 'webcal:')} title="Subscribe in Apple/Outlook/Google Calendar">
            📆 Subscribe
          </a>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => navigator.clipboard?.writeText(feed).then(() => useStore.getState().toast('Feed URL copied — paste it into Google Calendar → "From URL".', 'ok'))}
          >
            Copy feed URL
          </button>
        </div>
      </div>

      {error && <ErrorBox>Could not load raids: {error}</ErrorBox>}
      {loading ? (
        <Skeleton h={320} />
      ) : total === 0 ? (
        <Empty title="Nothing scheduled for this week and filter">Try “All teams”, another week — or post the first raid.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((slots, i) => {
            const isToday = wb.monday + i === wb.today;
            return (
              <div key={i} className={`card min-h-[6rem] p-2 ${isToday ? 'border-[var(--gold)]' : ''} ${slots.length === 0 ? 'hidden md:block' : ''}`}>
                <div className={`mb-2 px-1 text-xs font-bold uppercase tracking-wider ${isToday ? 'text-[var(--gold)]' : 'muted'}`}>{dayLabel(i)}</div>
                <div className="flex flex-col gap-1.5">
                  {slots.map(({ e, start }) => (
                    <Link
                      key={`${e.id}-${start}`}
                      to={`/events/${e.id}`}
                      className={`rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-xs transition hover:border-[var(--gold)] ${e.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}
                      title={`${e.title} — ${labelOf(EVENT_TYPES, e.type)} · ${team(e.teamId, names)}`}
                    >
                      <div className="flex items-center gap-1 font-semibold tabular-nums">
                        {e.liveRunId && <span className="live-dot" />}
                        {fmtTime(start, tz)} <GuildTag tag={e.guildTag} />
                      </div>
                      <div className="truncate">{e.title}</div>
                      <div className="faint truncate">
                        {labelOf(EVENT_TYPES, e.type)}
                        {!teamId && ` · ${team(e.teamId, names)}`}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
