import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Empty, ErrorBox, GuildTag, PageHeader, Segmented, Skeleton } from '../components/ui';
import { TzPicker } from '../components/TzPicker';
import { MapPicker, mapLabel } from '../components/MapPicker';
import { MatchupMap } from '../components/MatchupMap';
import { SubscribeDialog } from '../components/SubscribeDialog';
import { useDocumentTitle, useMatches, useMySides, useNow, useRelink, useTeamNames, useVisibleEvents } from '../lib/hooks';
import { friendlyLoadError } from '../firebase';
import { fmtCivil, fmtDateTime, fmtTime, team } from '../lib/format';
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
import { isVerified, useStore } from '../store';
import { EVENT_TYPES, LANGUAGES, labelOf, type EventType, type Language, type MapId } from '../shared/constants';
import { daysToCivil, occurrencesBetween } from '../shared/time';
import { COLORS, type PublicEvent } from '../shared/types';
import type { Region } from '../shared/teams';
import { useT, type TFn } from '../i18n';

type View = 'map' | 'day' | 'week' | 'link' | 'month';
type MapWindow = 'now' | 'today' | 'matchup';

interface Slot {
  e: PublicEvent;
  start: number;
  end: number;
}

const VIEWS: { id: View; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'link', label: 'Link' },
  { id: 'month', label: 'Month' },
];

const NOW_WINDOW_MS = 3 * 3600_000;

function dayName(day: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const c = daysToCivil(day);
  return fmtCivil(c.y, c.m, c.d, opts);
}

function SlotChip({ s, tz, showTeam, compact }: { s: Slot; tz: string; showTeam: boolean; compact?: boolean }) {
  const t = useT();
  const names = useTeamNames();
  return (
    <Link
      to={`/events/${s.e.id}`}
      className={`block rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-xs transition hover:border-[var(--gold)] ${s.e.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}
      title={`${s.e.title} — ${t(labelOf(EVENT_TYPES, s.e.type))} · ${team(s.e.teamId, names)} · ${mapLabel(s.e.map, t)}`}
    >
      <div className="flex items-center gap-1 font-semibold tabular-nums">
        {s.e.liveRunId && <span className="live-dot" />}
        {fmtTime(s.start, tz)} <GuildTag tag={s.e.guildTag} />
        {s.e.official && <span className="text-[var(--gold)]" title={t('Posted by the guild leader')}>✓</span>}
        {s.e.audience === 'team' && <span title={t('Team-only raid — hidden from other teams')}>🔒</span>}
      </div>
      {!compact && <div className="truncate">{s.e.title}</div>}
      <div className="faint truncate">
        {compact ? s.e.title : t(labelOf(EVENT_TYPES, s.e.type))}
        {showTeam && !compact && ` · ${team(s.e.teamId, names)}`}
      </div>
      <div className="mt-0.5 truncate text-[0.65rem] text-[var(--gold)]">📍 {mapLabel(s.e.map, t, undefined, undefined, true)}</div>
    </Link>
  );
}

function colHeader(c: DayColumn, tz: string, t: TFn): ReactNode {
  return (
    <>
      <span>{dayName(c.day)}</span>
      {c.part === 'after-reset' && <span className="chip chip-gold mt-1 !text-[0.6rem]">⚔ {t('from reset {time}', { time: fmtTime(c.start, tz) })}</span>}
      {c.part === 'before-reset' && <span className="chip mt-1 !text-[0.6rem]">{t('until reset {time}', { time: fmtTime(c.end, tz) })}</span>}
    </>
  );
}

/** One reset week as local-day columns (8 when the reset falls mid-day). */
function WeekRow({ start, slots, tz, today, showTeam, compact }: { start: number; slots: Slot[]; tz: string; today: number; showTeam: boolean; compact?: boolean }) {
  const t = useT();
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
            <div className={`mb-1.5 flex flex-col items-start px-1 text-[0.7rem] font-bold uppercase tracking-wider ${isToday ? 'text-[var(--gold)]' : 'muted'}`}>{colHeader(c, tz, t)}</div>
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
  const t = useT();
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
        <p className="faint text-sm">{t('No raids.')}</p>
      )}
    </div>
  );
  if (reset == null) return <div className="grid gap-3">{section(dayName(day, { weekday: 'long', day: 'numeric', month: 'long' }), inDay, 'all')}</div>;
  return (
    <div className="grid gap-3">
      {section(
        <>
          {t('Before reset · old matchup')} <span className="faint font-normal">{t('until {time}', { time: fmtTime(reset, tz) })}</span>
        </>,
        inDay.filter((s) => s.start < reset),
        'before',
      )}
      <div className="flex items-center gap-3 text-sm font-bold text-[var(--gold)]">
        <span className="h-px flex-1 bg-[var(--gold)]/50" />⚔ {t('Weekly reset {time} — new matchup', { time: fmtTime(reset, tz) })}
        <span className="h-px flex-1 bg-[var(--gold)]/50" />
      </div>
      {section(
        <>
          {t('After reset · new matchup')} <span className="faint font-normal">{t('from {time}', { time: fmtTime(reset, tz) })}</span>
        </>,
        inDay.filter((s) => s.start >= reset),
        'after',
      )}
    </div>
  );
}

export default function Calendar() {
  const t = useT();
  useDocumentTitle(t('Calendar'));
  const member = useStore((s) => s.member);
  const tz = useStore((s) => s.displayTz);
  const names = useTeamNames();
  const now = useNow(60_000);
  const verified = isVerified(member);
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.some((v) => v.id === params.get('view')) ? params.get('view') : 'map') as View;
  const setView = (v: View) =>
    setParams(
      (p) => {
        p.set('view', v);
        return p;
      },
      { replace: true },
    );

  const [region, setRegion] = useState<Region>(member?.region ?? 'eu');
  const [teamSel, setTeamSel] = useState<string>(verified ? 'mine' : 'all');
  const [type, setType] = useState<EventType | 'all'>('all');
  const [lang, setLang] = useState<Language | 'all'>('all');
  const [mapFilter, setMapFilter] = useState<MapId | null>(null);
  const [matchSel, setMatchSel] = useState<string | null>(null);
  const [mapWindow, setMapWindow] = useState<MapWindow>('matchup');
  const [subscribe, setSubscribe] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const { events: visibleEvents, loading, error } = useVisibleEvents(region);
  const matches = useMatches();
  const relink = useRelink().data;
  const { sides, myColor } = useMySides();

  const regionMatches = useMemo(() => (matches.data?.matches ?? []).filter((m) => m.region === region), [matches.data, region]);
  const anchor = resetAnchor(region, regionMatches.map((m) => m.start));
  const teams = useMemo(() => {
    const ids = new Set<number>();
    for (const m of regionMatches) for (const c of COLORS) if (m.sides[c].teamId) ids.add(m.sides[c].teamId!);
    return [...ids].sort((a, b) => team(a, names).localeCompare(team(b, names)));
  }, [regionMatches, names]);

  const myMatch = regionMatches.find((m) => COLORS.some((c) => m.sides[c].teamId === member?.teamId));
  const match = regionMatches.find((m) => m.id === matchSel) ?? myMatch ?? regionMatches[0] ?? null;

  const teamId = teamSel === 'mine' ? (member?.region === region ? member?.teamId ?? null : null) : teamSel === 'all' ? null : Number(teamSel);
  const today = localDay(now, tz);

  // Range of the current view.
  const range = useMemo(() => {
    if (view === 'map') {
      const mStart = match ? Date.parse(match.start) : resetWeekStart(anchor, now);
      const mEnd = match ? Date.parse(match.end) : mStart + WEEK_MS;
      const win =
        mapWindow === 'now'
          ? { start: now, end: now + NOW_WINDOW_MS }
          : mapWindow === 'today'
            ? dayBounds(today, tz)
            : { start: now, end: mEnd };
      return { start: Math.max(win.start, mStart), end: Math.min(win.end, mEnd), weeks: [] as number[], day: today, mEnd };
    }
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
  }, [view, match, anchor, now, mapWindow, today, tz, dayOffset, weekOffset, monthOffset, relink, region]);

  const slots = useMemo(() => {
    const out: Slot[] = [];
    for (const e of visibleEvents) {
      if (e.status === 'suspended') continue;
      if (view !== 'map' && teamId && e.teamId !== teamId) continue;
      if (type !== 'all' && e.type !== type) continue;
      if (lang !== 'all' && !e.languages.includes(lang)) continue;
      if (view !== 'map' && mapFilter && (e.map ?? 'jumper') !== mapFilter) continue;
      for (const o of occurrencesBetween(e.schedule, range.start, range.end, 120)) out.push({ e, ...o });
    }
    return out.sort((a, b) => a.start - b.start);
  }, [visibleEvents, view, teamId, type, lang, mapFilter, range.start, range.end]);

  const showTeam = !teamId;
  const feedTeam = view === 'map' ? null : teamId;
  const feedScope = [region.toUpperCase(), feedTeam ? team(feedTeam, names) : null, type !== 'all' ? t(labelOf(EVENT_TYPES, type)) : null].filter(Boolean).join(' · ');
  const raidCount = view === 'map' ? new Set(slots.map((s) => s.e.id)).size : slots.length;

  const nav = (() => {
    if (view === 'map') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            options={[
              { id: 'now', label: t('Now + 3h') },
              { id: 'today', label: t('Today') },
              { id: 'matchup', label: t('Until reset') },
            ]}
            value={mapWindow}
            onChange={(v) => setMapWindow(v as MapWindow)}
          />
          <span className="muted text-sm">
            {t(raidCount === 1 ? '{n} raid' : '{n} raids', { n: raidCount })}
            {match && ` · ${t('reset {time}', { time: fmtDateTime(Date.parse(match.end), tz) })}`}
          </span>
        </div>
      );
    }
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
            ? fmtCivil(range.y!, range.m!, 1, { month: 'long', year: 'numeric' })
            : `${range.known ? t('Link since {time}', { time: fmtDateTime(range.linkStart!, tz) }) : t('Current link')} → ${t('relink {time}', { time: fmtDateTime(range.linkEnd!, tz) })}`;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {view !== 'link' && (
          <>
            <button className="btn btn-sm" onClick={() => step(-1)} aria-label={t('Previous')}>
              ←
            </button>
            <button className="btn btn-sm" onClick={reset} disabled={atNow}>
              {view === 'day' ? t('Today') : view === 'week' ? t('This week') : t('This month')}
            </button>
            <button className="btn btn-sm" onClick={() => step(1)} aria-label={t('Next')}>
              →
            </button>
          </>
        )}
        <span className="muted text-sm">
          {label} · {t(slots.length === 1 ? '{n} raid' : '{n} raids', { n: slots.length })}
        </span>
      </div>
    );
  })();

  const matchLabel = (m: (typeof regionMatches)[number]) => COLORS.map((c) => team(m.sides[c].teamId, names)).join(' · ');

  return (
    <div>
      <PageHeader
        title={t('Raid calendar')}
        sub={t('Every planned raid — on the matchup map or week by week from reset. Voice and goals are visible to verified members of the same team.')}
        actions={
          verified ? (
            <Link to="/events/new" className="btn btn-gold">
              {t('+ Post a raid')}
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented options={VIEWS.map((v) => ({ id: v.id, label: v.id === 'map' ? `🗺️ ${t(v.label)}` : t(v.label) }))} value={view} onChange={setView} />
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
            setMatchSel(null);
            if (teamSel !== 'mine') setTeamSel('all');
          }}
        />
        {view === 'map' ? (
          <label className="min-w-[16rem] flex-1">
            <span className="label">{t('Matchup')}</span>
            <select className="select" value={match?.id ?? ''} onChange={(e) => setMatchSel(e.target.value)}>
              {regionMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  {matchLabel(m)}
                  {m.id === myMatch?.id ? ` (${t('yours')})` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="min-w-[11rem]">
            <span className="label">{t('Team')}</span>
            <select className="select" value={teamSel} onChange={(e) => setTeamSel(e.target.value)}>
              <option value="all">{t('All teams')}</option>
              {verified && member?.region === region && (
                <option value="mine">
                  {t('My team')} ({team(member.teamId, names)})
                </option>
              )}
              {teams.map((x) => (
                <option key={x} value={x}>
                  {team(x, names)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-[10rem]">
          <span className="label">{t('Type')}</span>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as EventType | 'all')}>
            <option value="all">{t('All types')}</option>
            {EVENT_TYPES.map((x) => (
              <option key={x.id} value={x.id}>
                {t(x.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[8rem]">
          <span className="label">{t('Language')}</span>
          <select className="select" value={lang} onChange={(e) => setLang(e.target.value as Language | 'all')}>
            <option value="all">{t('Any')}</option>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {view !== 'map' && (
          <div className="min-w-[13rem]">
            <span className="label">{t('Map')}</span>
            <MapPicker mode="filter" value={mapFilter} onChange={setMapFilter} sides={sides} myColor={myColor} />
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {nav}
        <button className="btn btn-sm" onClick={() => setSubscribe(true)} title={t('Add these raids to Google / Apple / Outlook Calendar')}>
          📆 {t('Subscribe')}
        </button>
      </div>
      <SubscribeDialog
        open={subscribe}
        onClose={() => setSubscribe(false)}
        params={{ region, team: feedTeam, type: type === 'all' ? null : type }}
        scope={feedScope}
      />

      {error && <ErrorBox>{friendlyLoadError(error)}</ErrorBox>}
      {loading ? (
        <Skeleton h={320} />
      ) : view === 'map' ? (
        match ? (
          <MatchupMap match={match} slots={slots} tz={tz} now={now} myTeamId={member?.teamId ?? null} />
        ) : (
          <Empty title={t('No matchup data yet')}>{t('The hub fills matchups from the GW2 API every 5 minutes.')}</Empty>
        )
      ) : view === 'day' ? (
        <DayView day={range.day} slots={slots} tz={tz} anchor={anchor} showTeam={showTeam} />
      ) : view === 'week' ? (
        slots.length ? (
          <WeekRow start={range.weeks[0]} slots={slots} tz={tz} today={today} showTeam={showTeam} />
        ) : (
          <Empty title={t('Nothing planned this week for this filter')}>{t('Try “All teams”, another week — or post the first raid.')}</Empty>
        )
      ) : (
        <div className="grid gap-4">
          {range.weeks.map((w, i) => (
            <section key={w}>
              <h3 className="muted mb-1.5 text-xs font-bold uppercase tracking-wider">
                {view === 'link' ? `${t('Week {n}', { n: i + 1 })} · ` : ''}
                {t('Reset {time}', { time: fmtDateTime(w, tz) })}
                {w <= now && now < w + WEEK_MS && <span className="chip chip-gold ml-2">{t('current matchup')}</span>}
              </h3>
              <WeekRow start={w} slots={slots.filter((s) => s.start >= w && s.start < w + WEEK_MS)} tz={tz} today={today} showTeam={showTeam} compact />
            </section>
          ))}
          {view === 'link' && !range.known && (
            <p className="faint text-xs">{t('The start of this link is shown once the hub has observed a relink; until then the view starts at this week’s reset.')}</p>
          )}
        </div>
      )}
    </div>
  );
}
