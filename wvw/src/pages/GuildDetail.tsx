import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChipToggle, Empty, ErrorBox, PageHeader, Section, Skeleton, Stat, TeamChip } from '../components/ui';
import { EventCard, RunCard } from '../components/EventCard';
import { ReportButton } from '../components/ReportDialog';
import { useDocumentTitle, useEventIndex, useGuild, useGuildRuns, useNow } from '../lib/hooks';
import { relative } from '../lib/format';
import { call, errorMessage } from '../firebase';
import { icalUrl } from '../config';
import { isVerified, useStore } from '../store';
import { COMMON_TIMEZONES, LANGUAGES, LIMITS, PLAYSTYLES, RATING_AXES, labelOf, type Language, type Playstyle } from '../shared/constants';
import { isoWeekKey } from '../shared/time';
import type { GuildProfile } from '../shared/types';

function ActivityBars({ activity }: { activity: Record<string, { claims: number }> }) {
  const now = useNow(3600_000);
  const weeks = Array.from({ length: 8 }, (_, i) => isoWeekKey(now - (7 - i) * 7 * 86_400_000));
  const max = Math.max(1, ...weeks.map((w) => activity?.[w]?.claims ?? 0));
  return (
    <div className="flex h-24 items-end gap-1.5" aria-label="Objectives claimed per week (last 8 weeks)">
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
  const toast = useStore((s) => s.toast);
  const [p, setP] = useState<GuildProfile>(
    profile ?? { description: '', languages: ['en'], playstyles: [], timezone: null, recruiting: false, discordInvite: null, website: null },
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await call('updateGuildProfile', { guildId, profile: p });
      toast('Guild page saved.', 'ok');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad grid gap-4">
      <h2 className="font-bold">👑 Guild page (you lead this guild)</h2>
      <label>
        <span className="label">About the guild</span>
        <textarea className="textarea" maxLength={LIMITS.descriptionMax} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
      </label>
      <div>
        <span className="label">Playstyles</span>
        <ChipToggle options={PLAYSTYLES} value={p.playstyles} onChange={(v) => setP({ ...p, playstyles: v as Playstyle[] })} />
      </div>
      <div>
        <span className="label">Languages</span>
        <ChipToggle options={LANGUAGES} value={p.languages} onChange={(v) => setP({ ...p, languages: v as Language[] })} max={6} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Main time zone</span>
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
          <input type="checkbox" checked={p.recruiting} onChange={(e) => setP({ ...p, recruiting: e.target.checked })} /> We’re recruiting
        </label>
        <label>
          <span className="label">Public Discord invite</span>
          <input className="input" value={p.discordInvite ?? ''} onChange={(e) => setP({ ...p, discordInvite: e.target.value || null })} placeholder="https://discord.gg/…" />
        </label>
        <label>
          <span className="label">Website</span>
          <input className="input" value={p.website ?? ''} onChange={(e) => setP({ ...p, website: e.target.value || null })} placeholder="https://…" />
        </label>
      </div>
      <div className="flex justify-end">
        <button className="btn btn-gold" onClick={save} disabled={busy}>
          Save guild page
        </button>
      </div>
      <p className="faint text-xs">Every member of the guild can post raids for it; raids you post as leader show ✓ official.</p>
    </div>
  );
}

export default function GuildDetail() {
  const { id } = useParams();
  const { data: g, loading, error } = useGuild(id);
  const member = useStore((s) => s.member);
  const runs = useGuildRuns(id);
  const region = g?.region ?? 'eu';
  const events = useEventIndex(region);
  const now = useNow(3600_000);
  useDocumentTitle(g ? `[${g.tag}] ${g.name}` : 'Guild');

  const upcoming = useMemo(() => (events.data?.events ?? []).filter((e) => e.guildId === id && e.status === 'scheduled'), [events.data, id]);
  const myGuild = member?.guilds.find((x) => x.id === id);
  const isLeader = !!myGuild?.leader && isVerified(member);

  if (loading) return <Skeleton h={400} />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!g || !g.name) return <Empty title="Guild not found">It appears here once it claims an objective or a member verifies.</Empty>;

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
            {g.claimed ? <span className="chip chip-gold">✓ leader verified</span> : <span className="chip">leader not signed in</span>}
            {g.profile?.recruiting && <span className="chip chip-green">recruiting</span>}
            {g.suspended && <span className="chip chip-red">suspended</span>}
            {g.lastSeenAt && <span className="faint text-xs">last claim {relative(g.lastSeenAt)}</span>}
          </span>
        }
        actions={
          <>
            <a className="btn btn-sm" href={icalUrl({ guild: g.id }).replace(/^https:/, 'webcal:')}>
              📆 Subscribe
            </a>
            <ReportButton targetType="guild" targetId={g.id} />
          </>
        }
      />


      <div className="mt-4 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          {g.profile?.description && (
            <Section title="About">
              <div className="card card-pad whitespace-pre-wrap text-sm leading-relaxed">{g.profile.description}</div>
            </Section>
          )}
          <Section title="Upcoming raids">
            {upcoming.length ? <div className="grid gap-3">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div> : <Empty title="No raids scheduled" />}
          </Section>
          <Section title="Recent runs">
            {runs === null ? <Skeleton h={80} /> : runs.length ? <div className="grid gap-2">{runs.map((r) => <RunCard key={r.id} r={r} />)}</div> : <Empty title="No runs recorded yet" />}
          </Section>
        </div>
        <div className="flex flex-col gap-4">
          <div className="card card-pad">
            <h2 className="mb-3 font-bold">Activity</h2>
            <ActivityBars activity={g.activity ?? {}} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="Claims (4 weeks)" value={claims4} />
              <Stat label="Holding now" value={g.heldNow ?? 0} />
            </div>
            <p className="faint mt-2 text-xs">From public objective claims (GW2 API). Fight-focused guilds that rarely claim show low here.</p>
          </div>
          <div className="card card-pad">
            <h2 className="mb-3 font-bold">Raid stats (30 days)</h2>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Runs" value={st?.runs30d ?? 0} />
              <Stat label="Avg duration" value={st?.avgDurationMin ? `${Math.round(st.avgDurationMin)} min` : '—'} />
              <Stat label="Avg squad" value={st?.avgPeak ?? '—'} />
              <Stat label="Avg team K/D" value={st?.avgKdr ?? '—'} hint="on the raid's map(s)" />
            </div>
          </div>
          <div className="card card-pad">
            <h2 className="mb-3 font-bold">Ratings (90 days)</h2>
            {st?.ratings ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {RATING_AXES.map((a) => (
                    <Stat key={a.id} label={a.label} value={`${st.ratings![a.id].toFixed(1)} / 5`} />
                  ))}
                </div>
                <p className="faint mt-2 text-xs">From {st.ratings.n} verified attendees who checked in. Each rater counts once.</p>
              </>
            ) : (
              <p className="muted text-sm">Ratings appear once {LIMITS.minRatingsToShow} different verified attendees have rated this guild’s raids.</p>
            )}
          </div>
          {(g.profile?.discordInvite || g.profile?.website || g.profile?.languages?.length) && (
            <div className="card card-pad text-sm">
              {g.profile?.languages?.length ? <p className="mb-2">🗣️ {g.profile.languages.map((l) => labelOf(LANGUAGES, l)).join(', ')}</p> : null}
              {g.profile?.playstyles?.length ? <p className="mb-2">⚔️ {g.profile.playstyles.map((p) => labelOf(PLAYSTYLES, p)).join(', ')}</p> : null}
              {g.profile?.timezone && <p className="mb-2">🕑 {g.profile.timezone}</p>}
              {g.profile?.discordInvite && (
                <a className="btn btn-discord btn-sm mr-2" href={g.profile.discordInvite} target="_blank" rel="noopener noreferrer">
                  Guild Discord
                </a>
              )}
              {g.profile?.website && (
                <a className="btn btn-sm" href={g.profile.website} target="_blank" rel="noopener noreferrer">
                  Website
                </a>
              )}
            </div>
          )}
          {isLeader && <LeaderTools guildId={g.id} profile={g.profile ?? null} />}
          {!isLeader && myGuild && <p className="faint text-xs">You’re a member — you can post raids for this guild.</p>}
        </div>
      </div>
    </div>
  );
}
