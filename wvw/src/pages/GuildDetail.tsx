import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChipToggle, Empty, ErrorBox, PageHeader, Section, Skeleton, Stat, TeamChip } from '../components/ui';
import { EventCard, RunCard } from '../components/EventCard';
import { ReportButton } from '../components/ReportDialog';
import { useDocumentTitle, useGuild, useGuildRuns, useNow, useVisibleEvents } from '../lib/hooks';
import { relative } from '../lib/format';
import { call, errorMessage } from '../firebase';
import { SubscribeDialog } from '../components/SubscribeDialog';
import { isVerified, useStore } from '../store';
import { useT } from '../i18n';
import { COMMON_TIMEZONES, LANGUAGES, LIMITS, PLAYSTYLES, RATING_AXES, labelOf, type Language, type Playstyle } from '../shared/constants';
import { isoWeekKey } from '../shared/time';
import type { GuildProfile } from '../shared/types';

function ActivityBars({ activity }: { activity: Record<string, { claims: number }> }) {
  const t = useT();
  const now = useNow(3600_000);
  const weeks = Array.from({ length: 8 }, (_, i) => isoWeekKey(now - (7 - i) * 7 * 86_400_000));
  const max = Math.max(1, ...weeks.map((w) => activity?.[w]?.claims ?? 0));
  return (
    <div className="flex h-24 items-end gap-1.5" aria-label={t('Objectives claimed per week (last 8 weeks)')}>
      {weeks.map((w) => {
        const v = activity?.[w]?.claims ?? 0;
        return (
          <div key={w} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-t-md bg-[var(--gold)]/80" style={{ height: `${(v / max) * 72 + 2}px`, opacity: v ? 1 : 0.25 }} title={`${w}: ${v} claims`} />
            <span className="faint text-[0.6rem]">{w.slice(6)}</span>
          </div>
        );
      })}
    </div>
  );
}

function LeaderTools({ guildId, profile }: { guildId: string; profile: GuildProfile | null }) {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [p, setP] = useState<GuildProfile>(
    profile ?? { description: '', languages: ['en'], playstyles: [], timezone: null, recruiting: false, discordInvite: null, website: null },
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await call('updateGuildProfile', { guildId, profile: p });
      toast(t('Guild page saved.'), 'ok');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad grid gap-4">
      <h2 className="font-bold">👑 {t('Guild page (you lead this guild)')}</h2>
      <label>
        <span className="label">{t('About the guild')}</span>
        <textarea className="textarea" maxLength={LIMITS.descriptionMax} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
      </label>
      <div>
        <span className="label">{t('Playstyles')}</span>
        <ChipToggle options={PLAYSTYLES.map((x) => ({ id: x.id, label: t(x.label) }))} value={p.playstyles} onChange={(v) => setP({ ...p, playstyles: v as Playstyle[] })} />
      </div>
      <div>
        <span className="label">{t('Languages')}</span>
        <ChipToggle options={LANGUAGES} value={p.languages} onChange={(v) => setP({ ...p, languages: v as Language[] })} max={6} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">{t('Main time zone')}</span>
          <select className="select" value={p.timezone ?? ''} onChange={(e) => setP({ ...p, timezone: e.target.value || null })}>
            <option value="">—</option>
            {COMMON_TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" checked={p.recruiting} onChange={(e) => setP({ ...p, recruiting: e.target.checked })} /> {t('We’re recruiting')}
        </label>
        <label>
          <span className="label">{t('Public Discord invite')}</span>
          <input className="input" value={p.discordInvite ?? ''} onChange={(e) => setP({ ...p, discordInvite: e.target.value || null })} placeholder="https://discord.gg/…" />
        </label>
        <label>
          <span className="label">{t('Website')}</span>
          <input className="input" value={p.website ?? ''} onChange={(e) => setP({ ...p, website: e.target.value || null })} placeholder="https://…" />
        </label>
      </div>
      <div className="flex justify-end">
        <button className="btn btn-gold" onClick={save} disabled={busy}>
          {t('Save guild page')}
        </button>
      </div>
      <p className="faint text-xs">{t('Every member of the guild can post raids for it; raids you post as leader show ✓ official.')}</p>
    </div>
  );
}

export default function GuildDetail() {
  const t = useT();
  const { id } = useParams();
  const [subscribe, setSubscribe] = useState(false);
  const { data: g, loading, error } = useGuild(id);
  const member = useStore((s) => s.member);
  const runs = useGuildRuns(id);
  const region = g?.region ?? 'eu';
  const events = useVisibleEvents(region);
  const now = useNow(3600_000);
  useDocumentTitle(g ? `[${g.tag}] ${g.name}` : t('Guild'));

  const upcoming = useMemo(() => events.events.filter((e) => e.guildId === id && e.status === 'scheduled'), [events.events, id]);
  const myGuild = member?.guilds.find((x) => x.id === id);
  const isLeader = !!myGuild?.leader && isVerified(member);

  if (loading) return <Skeleton h={400} />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!g || !g.name) return <Empty title={t('Guild not found')}>{t('It appears here once it claims an objective or a member verifies.')}</Empty>;

  const st = g.stats;
  const weeks4 = Array.from({ length: 4 }, (_, i) => isoWeekKey(now - i * 7 * 86_400_000));
  const claims4 = weeks4.reduce((s, w) => s + (g.activity?.[w]?.claims ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={`[${g.tag}] ${g.name}`}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <TeamChip teamId={g.teamId} region={g.region} />
            {g.claimed ? <span className="chip chip-gold">✓ {t('leader verified')}</span> : <span className="chip">{t('leader not signed in')}</span>}
            {g.profile?.recruiting && <span className="chip chip-green">{t('recruiting')}</span>}
            {g.suspended && <span className="chip chip-red">{t('suspended')}</span>}
            {g.lastSeenAt && <span className="faint text-xs">{t('last claim {when}', { when: relative(g.lastSeenAt) })}</span>}
          </span>
        }
        actions={
          <>
            <button className="btn btn-sm" onClick={() => setSubscribe(true)}>
              📆 {t('Subscribe')}
            </button>
            <ReportButton targetType="guild" targetId={g.id} />
          </>
        }
      />
      <SubscribeDialog open={subscribe} onClose={() => setSubscribe(false)} params={{ guild: g.id }} scope={`[${g.tag}]`} />


      <div className="mt-4 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          {g.profile?.description && (
            <Section title={t('About')}>
              <div className="card card-pad whitespace-pre-wrap text-sm leading-relaxed">{g.profile.description}</div>
            </Section>
          )}
          <Section title={t('Upcoming raids')}>
            {upcoming.length ? <div className="grid gap-3">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div> : <Empty title={t('No raids scheduled')} />}
          </Section>
          <Section title={t('Recent runs')}>
            {runs === null ? <Skeleton h={80} /> : runs.length ? <div className="grid gap-2">{runs.map((r) => <RunCard key={r.id} r={r} />)}</div> : <Empty title={t('No runs recorded yet')} />}
          </Section>
        </div>
        <div className="flex flex-col gap-4">
          <div className="card card-pad">
            <h2 className="mb-3 font-bold">{t('Activity')}</h2>
            <ActivityBars activity={g.activity ?? {}} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label={t('Claims (4 weeks)')} value={claims4} />
              <Stat label={t('Holding now')} value={g.heldNow ?? 0} />
            </div>
            <p className="faint mt-2 text-xs">{t('From public objective claims (GW2 API). Fight-focused guilds that rarely claim show low here.')}</p>
          </div>
          <div className="card card-pad">
            <h2 className="mb-3 font-bold">{t('Raid stats (30 days)')}</h2>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t('Runs')} value={st?.runs30d ?? 0} />
              <Stat label={t('Avg duration')} value={st?.avgDurationMin ? `${Math.round(st.avgDurationMin)} min` : '—'} />
              <Stat label={t('Avg squad')} value={st?.avgPeak ?? '—'} />
              <Stat label={t('Avg team K/D')} value={st?.avgKdr ?? '—'} hint={t('on the raid’s map(s)')} />
            </div>
          </div>
          <div className="card card-pad">
            <h2 className="mb-3 font-bold">{t('Ratings (90 days)')}</h2>
            {st?.ratings ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {RATING_AXES.map((a) => (
                    <Stat key={a.id} label={t(a.label)} value={`${st.ratings![a.id].toFixed(1)} / 5`} />
                  ))}
                </div>
                <p className="faint mt-2 text-xs">{t('From {n} verified attendees who checked in. Each rater counts once.', { n: st.ratings.n })}</p>
              </>
            ) : (
              <p className="muted text-sm">{t('Ratings appear once {n} different verified attendees have rated this guild’s raids.', { n: LIMITS.minRatingsToShow })}</p>
            )}
          </div>
          {(g.profile?.discordInvite || g.profile?.website || g.profile?.languages?.length) && (
            <div className="card card-pad text-sm">
              {g.profile?.languages?.length ? <p className="mb-2">🗣️ {g.profile.languages.map((l) => labelOf(LANGUAGES, l)).join(', ')}</p> : null}
              {g.profile?.playstyles?.length ? <p className="mb-2">⚔️ {g.profile.playstyles.map((p) => t(labelOf(PLAYSTYLES, p))).join(', ')}</p> : null}
              {g.profile?.timezone && <p className="mb-2">🕑 {g.profile.timezone}</p>}
              {g.profile?.discordInvite && (
                <a className="btn btn-discord btn-sm mr-2" href={g.profile.discordInvite} target="_blank" rel="noopener noreferrer">
                  {t('Guild Discord')}
                </a>
              )}
              {g.profile?.website && (
                <a className="btn btn-sm" href={g.profile.website} target="_blank" rel="noopener noreferrer">
                  {t('Website')}
                </a>
              )}
            </div>
          )}
          {isLeader && <LeaderTools guildId={g.id} profile={g.profile ?? null} />}
          {!isLeader && myGuild && <p className="faint text-xs">{t('You’re a member — you can post raids for this guild.')}</p>}

        </div>
      </div>
    </div>
  );
}
