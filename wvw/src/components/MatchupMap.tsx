/**
 * The matchup map — the calendar's default view.
 *
 * One matchup (3 teams) on all four maps + a Jumper section. Every raid sits
 * in the third of the COLOUR OF THE TEAM THAT ORGANISES IT: a red-team raid on
 * EBG appears in EBG's red third, a green-team raid on the Red Borderlands in
 * that map's green third. So the map reads "who is coming from where".
 *
 * Visibility is the calendar's: every public raid of the three teams, plus
 * team-only raids of the viewer's own team (admins: all). Enemy team-only
 * raids never reach the browser (wvwTeamIndex rules).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Color, MatchSummary } from '../shared/types';
import { COLORS } from '../shared/types';
import { EVENT_TYPES, OPENNESS, labelOf, type Third, type WvwMapId } from '../shared/constants';
import { OPENNESS_ICON, TYPE_ICON, shortLabel } from '../lib/icons';
import { placeRaids, type MapSlot, type Placed } from '../lib/placement';
import { fmtDay, fmtTime, fmtWeekday, team } from '../lib/format';
import { useTeamNames } from '../lib/hooks';
import { useT, type TFn } from '../i18n';
import { MAP_ATTRIBUTION, MAP_DATA, MAP_ORDER, THIRD_RGB, mapImage, mapLabel } from './MapPicker';

const MAX_ON_MAP = 3;


/** Multi-line hover text: everything a pin abbreviates. */
function useRaidTooltip() {
  const t = useT();
  const names = useTeamNames();
  return (p: Placed) =>
    [
      p.e.guildTag ? `[${p.e.guildTag}] ${p.e.title}` : p.e.title,
      `${TYPE_ICON[p.e.type]} ${t('Type')}: ${t(labelOf(EVENT_TYPES, p.e.type))}`,
      `${OPENNESS_ICON[p.e.openness]} ${t('Who can join')}: ${t(labelOf(OPENNESS, p.e.openness))}`,
      `${t('Team')}: ${team(p.e.teamId, names)} · ${p.e.languages.map((l) => l.toUpperCase()).join(', ')}`,
      ...(p.e.official ? [`✓ ${t('Posted by the guild leader')}`] : []),
      ...(p.e.audience === 'team' ? [`🔒 ${t('Team-only raid — hidden from other teams')}`] : []),
      ...(p.more > 0 ? [t('+{n} more dates in this window', { n: p.more })] : []),
    ].join('\n');
}

function when(p: Placed, tz: string, now: number, t: TFn): string {
  if (p.live) return t('LIVE');
  const sameDay = fmtDay(p.start, tz) === fmtDay(now, tz);
  return `${sameDay ? '' : `${fmtWeekday(p.start, tz)} `}${fmtTime(p.start, tz)}`;
}

/** Compact pin on the map: time · [TAG] · type + join icons. */
function Pin({ p, tz, now }: { p: Placed; tz: string; now: number }) {
  const t = useT();
  const tip = useRaidTooltip();
  return (
    <Link
      to={`/events/${p.e.id}`}
      className={`flex max-w-full items-center gap-1 whitespace-nowrap rounded-md border border-black/30 px-1.5 py-0.5 text-[0.65rem] font-semibold leading-tight text-white shadow transition hover:brightness-125 ${p.e.status === 'cancelled' ? 'line-through opacity-60' : ''}`}
      style={{ background: `rgba(${THIRD_RGB[p.color]},${p.live ? 0.95 : 0.8})` }}
      title={tip(p)}
    >
      {p.live && <span className="live-dot !h-1.5 !w-1.5" />}
      <span className="tabular-nums">{when(p, tz, now, t)}</span>
      <span className="font-mono">[{p.e.guildTag || '—'}]</span>
      <span aria-hidden>
        {TYPE_ICON[p.e.type]}
        {OPENNESS_ICON[p.e.openness]}
      </span>
      {p.e.official && <span>✓</span>}
      {p.e.audience === 'team' && <span>🔒</span>}
      {p.more > 0 && <span className="opacity-80">+{p.more}×</span>}
    </Link>
  );
}

/** Full-width row (lists under the maps + Jumper): everything readable without hovering. */
function Row({ p, tz, now }: { p: Placed; tz: string; now: number }) {
  const t = useT();
  const tip = useRaidTooltip();
  return (
    <Link
      to={`/events/${p.e.id}`}
      title={tip(p)}
      className={`grid gap-1 rounded-lg border bg-[var(--bg-2)] px-2.5 py-2 text-xs transition hover:border-[var(--gold)] ${p.e.status === 'cancelled' ? 'opacity-60' : ''}`}
      style={{ borderColor: `rgba(${THIRD_RGB[p.color]},0.55)`, borderLeftWidth: 4 }}
    >
      <div className="flex min-w-0 items-center gap-1.5 font-semibold">
        {p.live && <span className="live-dot" />}
        <span className="shrink-0 whitespace-nowrap tabular-nums" style={{ color: `rgb(${THIRD_RGB[p.color]})` }}>
          {when(p, tz, now, t)}
        </span>
        <span className="shrink-0 font-mono">[{p.e.guildTag || '—'}]</span>
        <span className={`min-w-0 truncate ${p.e.status === 'cancelled' ? 'line-through' : ''}`}>{p.e.title}</span>
        {p.e.official && <span className="text-[var(--gold)]">✓</span>}
        {p.e.audience === 'team' && <span>🔒</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="chip !py-0 !text-[0.65rem]">
          {TYPE_ICON[p.e.type]} {t(labelOf(EVENT_TYPES, p.e.type))}
        </span>
        <span className="chip !py-0 !text-[0.65rem]">
          {OPENNESS_ICON[p.e.openness]} {shortLabel(t(labelOf(OPENNESS, p.e.openness)))}
        </span>
        <span className="faint">{p.e.languages.map((l) => l.toUpperCase()).join(' · ')}</span>
        {p.more > 0 && <span className="faint">· {t('+{n} more dates in this window', { n: p.more })}</span>}
      </div>
    </Link>
  );
}

/** Icon legend under the team chips; every entry also explains itself on hover. */
export function MapLegend() {
  const t = useT();
  const item = (icon: string, label: string, hint?: string) => (
    <span key={label} className="inline-flex items-center gap-1 whitespace-nowrap" title={hint ?? label}>
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
  return (
    <details className="card px-3 py-2 text-xs" open>
      <summary className="cursor-pointer font-semibold">{t('Legend')}</summary>
      <div className="mt-2 grid gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="faint font-semibold uppercase tracking-wider">{t('Type')}</span>
          {EVENT_TYPES.map((x) => item(TYPE_ICON[x.id], t(x.label)))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="faint font-semibold uppercase tracking-wider">{t('Who can join')}</span>
          {OPENNESS.map((x) => item(OPENNESS_ICON[x.id], shortLabel(t(x.label)), t(x.label)))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="faint font-semibold uppercase tracking-wider">{t('Marks')}</span>
          {item('✓', t('official'), t('Posted by the guild leader'))}
          {item('🔒', t('team only'), t('Team-only raid — hidden from other teams'))}
          {item('●', t('LIVE'), t('The raid lead went live — check in on the run page.'))}
          {item('+2×', t('more dates'), t('The same weekly raid repeats in this window.'))}
          <span className="faint">{t('Hover or tap a raid for details.')}</span>
        </div>
      </div>
    </details>
  );
}

function MapCard({ map, placed, match, tz, now, myColor }: { map: WvwMapId; placed: Record<Color, Placed[]>; match: MatchSummary; tz: string; now: number; myColor: Color | null }) {
  const t = useT();
  const names = useTeamNames();
  const [list, setList] = useState(false);
  const info = MAP_DATA[map];
  const total = COLORS.reduce((n, c) => n + placed[c].length, 0);
  const sides = { red: match.sides.red.teamId, blue: match.sides.blue.teamId, green: match.sides.green.teamId };
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{mapLabel(map, t)}</h3>
          <p className="faint truncate text-[0.7rem]">
            {map === 'ebg'
              ? t('Shared centre map')
              : `${t('{team}’s home', { team: team(sides[map as Color], names) })}${myColor === map ? ` · ${t('you')}` : ''}`}
          </p>
        </div>
        <button className="btn btn-sm btn-ghost shrink-0" onClick={() => setList(!list)} aria-expanded={list} disabled={!total}>
          {t(total === 1 ? '{n} raid' : '{n} raids', { n: total })} {total ? (list ? '▴' : '▾') : ''}
        </button>
      </header>
      <div className="relative w-full" style={{ aspectRatio: `${info.width} / ${info.height}` }}>
        <img src={mapImage(map)} alt={info.name} className="absolute inset-0 h-full w-full select-none" draggable={false} loading="lazy" />
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {(Object.keys(info.thirds) as Third[]).map((c) => (
            <polygon
              key={c}
              points={info.thirds[c].polygon.map((p) => p.join(',')).join(' ')}
              fill={`rgba(${THIRD_RGB[c]},${placed[c].length ? 0.22 : 0.08})`}
              stroke={`rgba(${THIRD_RGB[c]},0.85)`}
              strokeWidth={0.004}
            />
          ))}
        </svg>
        {(Object.keys(info.thirds) as Third[]).map((c) => {
          const [x, y] = info.thirds[c].centroid;
          const items = placed[c];
          return (
            <div
              key={c}
              className="absolute flex max-w-[60%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            >
              {items.length === 0 ? (
                <span className="rounded bg-black/50 px-1 text-[0.6rem] text-white/60">{team(sides[c], names)}</span>
              ) : (
                <>
                  {items.slice(0, MAX_ON_MAP).map((p) => (
                    <Pin key={p.e.id} p={p} tz={tz} now={now} />
                  ))}
                  {items.length > MAX_ON_MAP && (
                    <button type="button" className="rounded bg-black/70 px-1.5 text-[0.65rem] font-semibold text-white" onClick={() => setList(true)}>
                      {t('+{n} more', { n: items.length - MAX_ON_MAP })}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {list && total > 0 && (
        <div className="grid gap-3 border-t border-[var(--border)] p-2">
          {COLORS.filter((c) => placed[c].length).map((c) => (
            <div key={c}>
              <div className="mb-1 flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wider" style={{ color: `rgb(${THIRD_RGB[c]})` }}>
                <span>{team(sides[c], names)}</span>
                <span className="faint font-normal normal-case">{t(placed[c].length === 1 ? '{n} raid' : '{n} raids', { n: placed[c].length })}</span>
              </div>
              <div className="grid gap-1.5">
                {placed[c].map((p) => (
                  <Row key={p.e.id} p={p} tz={tz} now={now} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function MatchupMap({
  match,
  slots,
  tz,
  now,
  myTeamId,
}: {
  match: MatchSummary;
  slots: MapSlot[];
  tz: string;
  now: number;
  myTeamId: number | null;
}) {
  const t = useT();
  const names = useTeamNames();
  const placed = useMemo(() => placeRaids(match, slots, now), [match, slots, now]);
  const myColor = COLORS.find((c) => match.sides[c].teamId === myTeamId) ?? null;
  const jumperTotal = COLORS.reduce((n, c) => n + placed.jumper[c].length, 0);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {COLORS.map((c) => (
          <span key={c} className={`chip chip-${c}`}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: `rgb(${THIRD_RGB[c]})` }} />
            {team(match.sides[c].teamId, names)}
            {myColor === c && <b>· {t('you')}</b>}
          </span>
        ))}
        <span className="faint">{t('A raid sits in the third of the team that organises it. 🔒 = only that team can see it.')}</span>
      </div>
      <MapLegend />

      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        {MAP_ORDER.map((m) => (
          <MapCard key={m} map={m} placed={placed[m]} match={match} tz={tz} now={now} myColor={myColor} />
        ))}
      </div>

      <section className="card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">
            🔀 {mapLabel('jumper', t)} <span className="faint font-normal">· {t(jumperTotal === 1 ? '{n} raid' : '{n} raids', { n: jumperTotal })}</span>
          </h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {COLORS.map((c) => (
            <div key={c} className="rounded-lg border p-2" style={{ borderColor: `rgba(${THIRD_RGB[c]},0.5)`, background: `rgba(${THIRD_RGB[c]},0.06)` }}>
              <div className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wider" style={{ color: `rgb(${THIRD_RGB[c]})` }}>
                {team(match.sides[c].teamId, names)}
                {myColor === c ? ` · ${t('you')}` : ''}
              </div>
              <div className="flex flex-col gap-1">
                {placed.jumper[c].map((p) => (
                  <Row key={p.e.id} p={p} tz={tz} now={now} />
                ))}
                {!placed.jumper[c].length && <span className="faint text-xs">{t('No jumper raids.')}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
      <p className="faint text-center text-[0.65rem]">{MAP_ATTRIBUTION}</p>
    </div>
  );
}
