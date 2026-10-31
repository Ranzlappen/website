import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Empty, ErrorBox, GuildTag, PageHeader, Segmented, Skeleton } from '../components/ui';
import { TzPicker } from '../components/TzPicker';
import { MapPicker, zoneLabel, zoneMatches, zoneParts } from '../components/MapPicker';
import { useDocumentTitle, useMatches, useMyTeamIndex, useMySides, useNow, useRelink, useTeamNames, useVisibleEvents } from '../lib/hooks';
import { friendlyLoadError } from '../firebase';
import { fmtDateTime, fmtTime, team } from '../lib/format';
import {
  WEEK_MS,
  dayBounds,
  dayColumns,
  linkWeeks,
  localDay,
  localYearMonth,
  monthWeeks,
  resetAnchor,
  resetWeekStart,
  resetsBetween,
  shiftMonth,
  type DayColumn,
} from '../lib/calendar';
import { icalUrl } from '../config';
import { isVerified, useStore } from '../store';
import { EVENT_TYPES, LANGUAGES, MAPS, labelOf, type EventType, type Language } from '../shared/constants';
import { daysToCivil, occurrencesBetween } from '../shared/time';
import { COLORS, type PublicEvent, type TeamIndex } from '../shared/types';
import type { Region } from '../shared/teams';

type View = 'day' | 'week' | 'link' | 'month';

interface Slot {
  e: PublicEvent;
  start: number;
  end: number;
  zone: string | null;
}

const VIEWS: { id: View; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'link', label: 'Link' },
  { id: 'month', label: 'Month' },
];

function dayName(day: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const c = daysToCivil(day);
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'UTC' }).format(Date.UTC(c.y, c.m - 1, c.d));
}

function SlotChip({ s, tz, showTeam, compact }: { s: Slot; tz: string; showTeam: boolean; compact?: boolean }) {
  const names = useTeamNames();
  const short = s.zone ? MAPS.find((m) => m.id === s.zone)?.short : null;
  return (
    <Link
      to={`/events/${s.e.id}`}
      className={`block rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-xs transition hover:border-[var(--gold)] ${s.e.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}
      title={`${s.e.title} — ${labelOf(EVENT_TYPES, s.e.type)} · ${team(s.e.teamId, names)}${s.zone ? ` · ${zoneLabel(s.zone)}` : ''}`}
    >
      <div className="flex items-center gap-1 font-semibold tabular-nums">
        {s.e.liveRunId && <span className="live-dot" />}
        {fmtTime(s.start, tz)} <GuildTag tag={s.e.guildTag} />
        {s.e.official && <span className="text-[var(--gold)]" title="Posted by the guild leader">✓</span>}
        {s.e.audience === 'team' && <span title="Team-only raid — hidden from other teams">🔒</span>}
      </div>
      {!compact && <div className="truncate">{s.e.title}</div>}
      <div className="faint truncate">
        {compact ? s.e.title : labelOf(EVENT_TYPES, s.e.type)}
        {showTeam && !compact && ` · ${team(s.e.teamId, names)}`}
      </div>
      {short && <div className="mt-0.5 truncate text-[0.65rem] text-[var(--gold)]">📍 {short}</div>}
    </Link>
  );
}

function colHeader(c: DayColumn, tz: string): ReactNode {
  return (
    <>
      <span>{dayName(c.day)}</span>
      {c.part === 'after-reset' && <span className="chip chip-gold mt-1 !text-[0.6rem]">⚔ from reset {fmtTime(c.start, tz)}</span>}
      {c.part === 'before-reset' && <span className="chip mt-1 !text-[0.6rem]">until reset {fmtTime(c.end, tz)}</span>}
    </>
  );
}

/** One reset week as local-day columns (8 when the reset falls mid-day). */
function WeekRow({ start, slots, tz, today, showTeam, compact }: { start: number; slots: Slot[]; tz: string; today: number; showTeam: boolean; compact?: boolean }) {
  const cols = dayColumns(start, start + WEEK_MS, tz);
  return (
    <div className="grid gap-2 md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ ['--cols' as string]: cols.length }}>
      {cols.map((c) => {
        const inCol = slots.filter((s) => s.start >= c.start && s.start < c.end);
        const isToday = c.day === today;
        return (
          <div
            key={`${c.day}-${c.part}`}
            className={`card p-2 ${compact ? 'min-h-[4.5rem]' : 'min-h-[8rem]'} ${isToday ? 'border-[var(--gold)]' : ''} ${c.part ? 'bg-[rgba(224,179,65,0.03)]' : ''} ${inCol.length === 0 ? 'hidden md:block' : ''}`}
          >
            <div className={`mb-1.5 flex flex-col items-start px-1 text-[0.7rem] font-bold uppercase tracking-wider ${isToday ? 'text-[var(--gold)]' : 'muted'}`}>{colHeader(c, tz)}</div>
            <div className="flex flex-col gap-1">
              {inCol.map((s) => (
                <SlotChip key={`${s.e.id}-${s.start}`} s={s} tz={tz} showTeam={showTeam} compact={compact} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ day, slots, tz, anchor, showTeam }: { day: number; slots: Slot[]; tz: string; anchor: number; showTeam: boolean }) {
  const b = dayBounds(day, tz);
  const reset = resetsBetween(anchor, b.start, b.end)[0] ?? null;
  const inDay = slots.filter((s) => s.start >= b.start && s.start < b.end);
  const section = (title: ReactNode, list: Slot[], key: string) => (
    <div key={key} className="card card-pad">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {list.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <SlotChip key={`${s.e.id}-${s.start}`} s={s} tz={tz} showTeam={showTeam} />
          ))}
        </div>
      ) : (
        <p className="faint text-sm">No raids.</p>
      )}
    </div>
  );
  if (reset == null) return <div className="grid gap-3">{section(dayName(day, { weekday: 'long', day: 'numeric', month: 'long' }), inDay, 'all')}</div>;
  return (
    <div className="grid gap-3">
      {section(<>Before reset · old matchup <span className="faint font-normal">until {fmtTime(reset, tz)}</span></>, inDay.filter((s) => s.start < reset), 'before')}
      <div className="flex items-center gap-3 text-sm font-bold text-[var(--gold)]">
        <span className="h-px flex-1 bg-[var(--gold)]/50" />⚔ Weekly reset {fmtTime(reset, tz)} — new matchup
        <span className="h-px flex-1 bg-[var(--gold)]/50" />
      </div>
      {section(<>After reset · new matchup <span className="faint font-normal">from {fmtTime(reset, tz)}</span></>, inDay.filter((s) => s.start >= reset), 'after')}
    </div>
  );
}

export default function Calendar() {
  useDocumentTitle('Calendar');
  const member = useStore((s) => s.member);
  const tz = useStore((s) => s.displayTz);
  const names = useTeamNames();
  const now = useNow(60_000);
  const verified = isVerified(member);
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.some((v) => v.id === params.get('view')) ? params.get('view') : 'week') as View;
  const setView = (v: View) => setParams((p) => { p.set('view', v); return p; }, { replace: true });

  const [region, setRegion] = useState<Region>(member?.region ?? 'eu');
  const [teamSel, setTeamSel] = useState<string>(verified ? 'mine' : 'all');
  const [type, setType] = useState<EventType | 'all'>('all');
  const [lang, setLang] = useState<Language | 'all'>('all');
  const [mapFilter, setMapFilter] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const { events: visibleEvents, loading, error } = useVisibleEvents(region);
  const matches = useMatches();
  const relink = useRelink().data;
  const teamIndex: TeamIndex | null = useMyTeamIndex();
  const { sides, myColor } = useMySides();

  const regionMatches = (matches.data?.matches ?? []).filter((m) => m.region === region);
  const anchor = resetAnchor(region, regionMatches.map((m) => m.start));
  const teams = useMemo(() => {
    const ids = new Set<number>();
    for (const m of regionMatches) for (const c of COLORS) if (m.sides[c].teamId) ids.add(m.sides[c].teamId!);
    return [...ids].sort((a, b) => team(a, names).localeCompare(team(b, names)));
  }, [regionMatches, names]);

  const teamId = teamSel === 'mine' ? (member?.region === region ? member?.teamId ?? null : null) : teamSel === 'all' ? null : Number(teamSel);
  const today = localDay(now, tz);

  // Range of the current view.
  const range = useMemo(() => {
    if (view === 'day') {
      const d = today + dayOffset;
      return { ...dayBounds(d, tz), weeks: [] as number[], day: d };
    }
    if (view === 'week') {
      const w = resetWeekStart(anchor, now) + weekOffset * WEEK_MS;
      return { start: w, end: w + WEEK_MS, weeks: [w], day: today };
    }
    if (view === 'month') {
      const ym = localYearMonth(now, tz);
      const { y, m } = shiftMonth(ym.y, ym.m, monthOffset);
      const weeks = monthWeeks(y, m, tz, anchor);
      return { start: weeks[0], end: weeks[weeks.length - 1] + WEEK_MS, weeks, day: today, y, m };
    }
    const next = relink?.next[region] ? Date.parse(relink.next[region]!) : resetWeekStart(anchor, now) + 4 * WEEK_MS;
    const last = relink?.last[region] ?? resetWeekStart(anchor, now);
    const weeks = linkWeeks(last, next, anchor);
    return { start: weeks[0], end: weeks[weeks.length - 1] + WEEK_MS, weeks, day: today, linkStart: last, linkEnd: next, known: relink?.last[region] != null };
  }, [view, today, dayOffset, tz, anchor, now, weekOffset, monthOffset, relink, region]);

  const slots = useMemo(() => {
    const out: Slot[] = [];
    for (const e of visibleEvents) {
      if (e.status === 'suspended') continue;
      if (teamId && e.teamId !== teamId) continue;
      if (type !== 'all' && e.type !== type) continue;
      if (lang !== 'all' && !e.languages.includes(lang)) continue;
      const zone = teamIndex?.details[e.id]?.map ?? null;
      if (mapFilter && !zoneMatches(mapFilter, zone)) continue;
      for (const o of occurrencesBetween(e.schedule, range.start, range.end, 120)) out.push({ e, ...o, zone });
    }
    return out.sort((a, b) => a.start - b.start);
  }, [visibleEvents, teamId, type, lang, mapFilter, teamIndex, range.start, range.end]);

  const feed = icalUrl({ region, team: teamId, type: type === 'all' ? null : type });
  const showTeam = !teamId;

  const nav = (() => {
    const step = (d: number) => {
      if (view === 'day') setDayOffset(dayOffset + d);
      if (view === 'week') setWeekOffset(weekOffset + d);
      if (view === 'month') setMonthOffset(monthOffset + d);
    };
    const reset = () => {
      setDayOffset(0);
      setWeekOffset(0);
      setMonthOffset(0);
    };
    const atNow = view === 'day' ? dayOffset === 0 : view === 'week' ? weekOffset === 0 : monthOffset === 0;
    const label =
      view === 'day'
        ? dayName(range.day, { weekday: 'long', day: 'numeric', month: 'long' })
        : view === 'week'
          ? `${fmtDateTime(range.start, tz)} → ${fmtDateTime(range.end, tz)}`
          : view === 'month'
            ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(range.y!, range.m! - 1, 1))
            : `Link ${range.known ? `since ${fmtDateTime(range.linkStart!, tz)}` : '(current)'} → relink ${fmtDateTime(range.linkEnd!, tz)}`;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {view !== 'link' && (
          <>
            <button className="btn btn-sm" onClick={() => step(-1)} aria-label="Previous">
              ←
            </button>
            <button className="btn btn-sm" onClick={reset} disabled={atNow}>
              {view === 'day' ? 'Today' : view === 'week' ? 'This week' : 'This month'}
            </button>
            <button className="btn btn-sm" onClick={() => step(1)} aria-label="Next">
              →
            </button>
          </>
        )}
        <span className="muted text-sm">
          {label} · {slots.length} raid{slots.length === 1 ? '' : 's'}
        </span>
      </div>
    );
  })();

  return (
    <div>
      <PageHeader
        title="Raid calendar"
        sub="Every planned raid, week by week from Friday reset. Map thirds, voice and goals are visible to verified members of the same team."
        actions={
          verified ? (
            <Link to="/events/new" className="btn btn-gold">
              + Post a raid
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented options={VIEWS} value={view} onChange={setView} />
        <TzPicker compact />
      </div>

      <div className="card card-pad mb-4 flex flex-wrap items-end gap-3">
        <Segmented
          options={[
            { id: 'eu', label: 'EU' },
            { id: 'na', label: 'NA' },
          ]}
          value={region}
          onChange={(r) => {
            setRegion(r);
            if (teamSel !== 'mine') setTeamSel('all');
          }}
        />
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
        {teamIndex && (
          <button className={`btn btn-sm ${mapFilter ? 'btn-gold' : ''}`} onClick={() => setShowMap(!showMap)} aria-expanded={showMap}>
            📍 {mapFilter ? zoneLabel(mapFilter, sides, names) : 'Filter by map'}
          </button>
        )}
      </div>

      {teamIndex && showMap && (
        <div className="card card-pad mb-4 grid gap-2 md:grid-cols-[minmax(0,420px)_1fr] md:items-start">
          <MapPicker mode="filter" value={mapFilter} onChange={setMapFilter} sides={sides} myColor={myColor} />
          <div className="muted text-sm">
            <p>
              Showing <b className="text-white">{mapFilter ? zoneLabel(mapFilter, sides, names) : 'all maps'}</b>.
            </p>
            <p className="mt-2">The map filter only applies to your own team’s raids — other teams’ locations are private to them.</p>
            {mapFilter && (
              <button className="btn btn-sm mt-3" onClick={() => setMapFilter(null)}>
                Clear map filter
              </button>
            )}
            {zoneParts(mapFilter).jumper && <p className="mt-2">Jumper = squads hopping between maps.</p>}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {nav}
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

      {error && <ErrorBox>{friendlyLoadError(error)}</ErrorBox>}
      {loading ? (
        <Skeleton h={320} />
      ) : view === 'day' ? (
        <DayView day={range.day} slots={slots} tz={tz} anchor={anchor} showTeam={showTeam} />
      ) : view === 'week' ? (
        slots.length ? (
          <WeekRow start={range.weeks[0]} slots={slots} tz={tz} today={today} showTeam={showTeam} />
        ) : (
          <Empty title="Nothing planned this week for this filter">Try “All teams”, another week — or post the first raid.</Empty>
        )
      ) : (
        <div className="grid gap-4">
          {range.weeks.map((w, i) => (
            <section key={w}>
              <h3 className="muted mb-1.5 text-xs font-bold uppercase tracking-wider">
                {view === 'link' ? `Week ${i + 1} · ` : ''}Reset {fmtDateTime(w, tz)}
                {w <= now && now < w + WEEK_MS && <span className="chip chip-gold ml-2">current matchup</span>}
              </h3>
              <WeekRow start={w} slots={slots.filter((s) => s.start >= w && s.start < w + WEEK_MS)} tz={tz} today={today} showTeam={showTeam} compact />
            </section>
          ))}
          {view === 'link' && !range.known && (
            <p className="faint text-xs">The start of this link is shown once the hub has observed a relink; until then the view starts at this week’s reset.</p>
          )}
        </div>
      )}
    </div>
  );
}
