import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Countdown, Empty, GuildTag, Section, Segmented, Skeleton, TeamChip, TeamName } from '../components/ui';
import { EventCard, RunCard } from '../components/EventCard';
import { TzPicker } from '../components/TzPicker';
import { useDocumentTitle, useLive, useMatches, useNow, usePublicConfig, useVisibleEvents } from '../lib/hooks';
import { kd } from '../lib/format';
import { isVerified, useStore } from '../store';
import { occurrencesBetween } from '../shared/time';
import { COLORS, type PublicEvent } from '../shared/types';
import type { Region } from '../shared/teams';
import { useT } from '../i18n';

export default function Home() {
  const t = useT();
  useDocumentTitle('');
  const member = useStore((s) => s.member);
  const uid = useStore((s) => s.uid);
  const [region, setRegion] = useState<Region>(member?.region ?? 'eu');
  const [myTeam, setMyTeam] = useState(true);
  const now = useNow(60_000);
  const matches = useMatches();
  const live = useLive();
  const events = useVisibleEvents(region);
  const config = usePublicConfig().data;
  const verified = isVerified(member);
  const teamFilter = verified && myTeam && member!.region === region ? member!.teamId : null;

  const upcoming = useMemo(() => {
    const out: { e: PublicEvent; start: number; end: number }[] = [];
    const list = events.events.filter((e) => e.status === 'scheduled' && (!teamFilter || e.teamId === teamFilter));
    for (const e of list) for (const o of occurrencesBetween(e.schedule, now, now + 36 * 3600_000, 3)) out.push({ e, ...o });
    return out.sort((a, b) => a.start - b.start).slice(0, 12);
  }, [events.events, teamFilter, now]);

  const liveRuns = (live.data?.runs ?? []).filter((r) => r.region === region && (!teamFilter || r.teamId === teamFilter));
  const regionMatches = (matches.data?.matches ?? []).filter((m) => m.region === region);
  const resetAt = regionMatches[0]?.end ?? null;

  return (
    <div>
      <section className="card relative mb-8 overflow-hidden px-5 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: 'conic-gradient(from 210deg at 85% 30%, rgba(229,83,75,.35), rgba(74,144,217,.35), rgba(79,191,106,.35), rgba(229,83,75,.35))', filter: 'blur(60px)' }} />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="chip chip-gold mb-3">Guild Wars 2 · World vs. World</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              {t('Who’s tagging tonight?')
                .split(/(tagging|taggt)/)
                .map((part, i) => (i === 1 ? <span key={i} className="text-[var(--gold)]">{part}</span> : part))}
            </h1>
            <p className="muted mt-3 max-w-xl text-base sm:text-lg">
              {t('Every planned WvW raid on every team — posted by API-verified players, shown in your time zone, on the matchup map or week by week from Friday reset.')}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/calendar" className="btn btn-gold">
                📅 {t('Open the calendar')}
              </Link>
              {!uid || !verified ? (
                <Link to="/account" className="btn">
                  🔑 {t('Sign in with your GW2 API key')}
                </Link>
              ) : (
                <Link to="/events/new" className="btn">
                  🛡️ {t('Post a raid')}
                </Link>
              )}
              {config?.hubInviteUrl && (
                <a href={config.hubInviteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  {t('Community Discord')} →
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl bg-[rgba(0,0,0,0.25)] p-4">
            <Segmented options={[{ id: 'eu', label: 'EU' }, { id: 'na', label: 'NA' }]} value={region} onChange={setRegion} />
            {matches.loading ? (
              <Skeleton h={120} />
            ) : (
              <>
                <Countdown to={matches.data?.timers.teamAssignment[region]} label={t('Next relink ({region})', { region: region.toUpperCase() })} />
                <Countdown to={resetAt} label={t('Weekly reset')} />
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TzPicker />
        {verified && member!.region === region && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={myTeam} onChange={(e) => setMyTeam(e.target.checked)} />
            {t('Only my team')} (<TeamChip teamId={member!.teamId} />)
          </label>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <Section title={`🟢 ${t('Live now')}`}>
            {live.loading ? (
              <Skeleton h={70} />
            ) : liveRuns.length ? (
              <div className="grid gap-3">{liveRuns.map((r) => <RunCard key={r.id} r={r} />)}</div>
            ) : (
              <Empty title={t('Nobody is live right now')}>{t('Raid leads go live with the button on their raid page.')}</Empty>
            )}
          </Section>
          <Section
            title={t('Coming up (next 36h)')}
            right={
              <Link to="/calendar" className="text-sm text-[var(--gold)]">
                {t('Full calendar →')}
              </Link>
            }
          >
            {events.loading ? (
              <div className="grid gap-3">
                <Skeleton h={80} />
                <Skeleton h={80} />
              </div>
            ) : upcoming.length ? (
              <div className="grid gap-3">
                {upcoming.map(({ e, start, end }) => (
                  <EventCard key={`${e.id}-${start}`} e={e} start={start} end={end} />
                ))}
              </div>
            ) : (
              <Empty title={t('No raids scheduled yet')}>
                {t('Be the first: any verified guild member can post a raid.')}{' '}
                <Link to="/events/new" className="text-[var(--gold)] underline">
                  {t('Post a raid')} →
                </Link>
              </Empty>
            )}
          </Section>
        </div>

        <div>
          <Section
            title={t('Matchups')}
            right={
              <Link to="/matchups" className="text-sm text-[var(--gold)]">
                {t('Details →')}
              </Link>
            }
          >
            {matches.loading ? (
              <Skeleton h={220} />
            ) : (
              <div className="grid gap-3">
                {regionMatches.map((m) => (
                  <div key={m.id} className="card card-pad">
                    <div className="faint mb-2 flex items-center justify-between text-xs font-semibold">
                      <span>{t('Tier {n}', { n: m.id.split('-')[1] })}</span>
                      <Link to="/calendar?view=map" className="text-[var(--gold)] hover:underline">
                        🗺️ {t('Map')}
                      </Link>
                    </div>
                    {[...COLORS]
                      .sort((a, b) => m.sides[b].victoryPoints - m.sides[a].victoryPoints)
                      .map((c) => (
                        <div key={c} className="flex items-center justify-between gap-2 py-0.5 text-sm">
                          <span className={`side-${c} font-semibold`}>
                            ● <TeamName id={m.sides[c].teamId} />
                            {m.sides[c].teamId === member?.teamId && <span className="chip chip-gold ml-1.5">{t('you')}</span>}
                          </span>
                          <span className="tabular-nums">
                            <span className="font-bold">{m.sides[c].victoryPoints}</span>
                            <span className="faint"> VP · K/D {kd(m.sides[c].kills, m.sides[c].deaths)}</span>
                          </span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Section title={t('Recently finished')}>
            <div className="grid gap-2">
              {(live.data?.recent ?? [])
                .filter((r) => r.region === region)
                .slice(0, 5)
                .map((r) => (
                  <Link key={r.id} to={`/runs/${r.id}`} className="card flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:border-[var(--border-strong)]">
                    <span>
                      <GuildTag tag={r.guildTag} /> {r.guildId ? r.guildName : t('Independent raid (no guild)')}
                    </span>
                    <span className="faint">
                      {r.metrics?.durationMin ?? '?'} min{r.metrics?.peak ? ` · ${r.metrics.peak} 👥` : ''}
                    </span>
                  </Link>
                ))}
              {!(live.data?.recent ?? []).some((r) => r.region === region) && <p className="faint text-sm">{t('No finished raids in the last 24h.')}</p>}

            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
