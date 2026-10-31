import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBox, GuildTag, LiveBadge, Notice, PageHeader, Skeleton, Stat, TeamChip } from '../components/ui';
import { ReportButton } from '../components/ReportDialog';
import { useDocumentTitle, useNow, useRun } from '../lib/hooks';
import { duration, fmtRange, relative } from '../lib/format';
import { call, errorMessage } from '../firebase';
import { isVerified, useStore } from '../store';
import { EVENT_TYPES, LIMITS, RATING_AXES, labelOf, type RatingAxis } from '../shared/constants';
import { mapLabel } from '../components/MapPicker';
import { useT } from '../i18n';

interface RunState {
  isCommander: boolean;
  checkedIn: boolean;
  rated: Record<RatingAxis, number> | null;
  canCheckIn: boolean;
  canRate: boolean;
  map: string | null;
}

function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`h-8 w-8 rounded-lg border text-sm font-bold ${n <= value ? 'border-[var(--gold)] bg-[rgba(224,179,65,0.18)] text-[var(--gold)]' : 'border-[var(--border-strong)] muted'}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RunDetail() {
  const t = useT();
  const { id } = useParams();
  const { data: r, loading, error } = useRun(id);
  const { uid, member, displayTz: tz, toast } = useStore();
  const [st, setSt] = useState<RunState | null>(null);
  const [scores, setScores] = useState<Record<RatingAxis, number>>({ organisation: 0, communication: 0, newcomers: 0, fun: 0 });
  const [peak, setPeak] = useState('');
  const [logs, setLogs] = useState('');
  const [busy, setBusy] = useState(false);
  const now = useNow(30_000);
  useDocumentTitle(r ? `${r.guildTag ? `[${r.guildTag}] ` : ''}${t('run')}` : t('Run'));

  const refresh = useCallback(() => {
    if (!uid || !id) return;
    call<RunState>('myRunState', { runId: id })
      .then((s) => {
        setSt(s);
        if (s.rated) setScores(s.rated);
      })
      .catch(() => setSt(null));
  }, [uid, id]);
  useEffect(refresh, [refresh, r?.status]);

  if (loading) return <Skeleton h={300} />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!r) return <ErrorBox>{t('Run not found.')}</ErrorBox>;

  const live = r.status === 'live';
  const m = r.metrics;
  const linkList = (s: string) => s.split(/\s+/).filter((x) => /^https:\/\/([a-z]\.)?dps\.report\//.test(x));

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok, 'ok');
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <PageHeader
          title={r.guildId ? r.guildName : t('Independent raid (no guild)')}
          sub={
            <span className="flex flex-wrap items-center gap-2">
              {live ? <LiveBadge /> : <span className="chip">{t('ended')}</span>}
              <GuildTag tag={r.guildTag} id={r.guildId} />
              <TeamChip teamId={r.teamId} region={r.region} />
              <span className="chip">{t(labelOf(EVENT_TYPES, r.type))}</span>
              {r.eventId && (
                <Link to={`/events/${r.eventId}`} className="text-sm text-[var(--gold)] underline">
                  {t('scheduled raid →')}
                </Link>
              )}
            </span>
          }
          actions={<ReportButton targetType="run" targetId={r.id} />}
        />
        <p className="muted mb-4 text-sm">
          {live ? t('Started {when}', { when: relative(r.startedAt) }) : fmtRange(r.startedAt, r.endedAt ?? r.startedAt, tz)}
          {st?.isCommander && st.map && ` · ${mapLabel(st.map, t)}`}
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t('Checked in')} value={r.checkins} />
          <Stat label={t('Claims')} value={live ? '—' : (m?.claims ?? 0)} hint={t('objectives by the guild')} />
          <Stat label={t('Duration')} value={live ? duration(now - r.startedAt) : `${m?.durationMin ?? '?'} min`} />
          <Stat label={t('Squad')} value={m?.peak ?? '—'} hint={m?.peakSource ? t('from {source}', { source: t(m.peakSource) }) : undefined} />
        </div>

        {!live && m && (
          <div className="card card-pad mt-4">
            <h2 className="mb-3 font-bold">{t('Results')}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat
                label={t('Team K/D on map')}
                value={m.team?.kdr ?? '—'}
                hint={m.team ? t('{k} K / {d} D (whole team)', { k: m.team.kills, d: m.team.deaths }) : t('no samples')}
              />
              <Stat label={t('Objectives claimed')} value={m.claims} hint={t('by this guild')} />
              {m.logs && (
                <>
                  <Stat label={t('Logs')} value={m.logs.count} hint={t('{n} min of fights', { n: m.logs.durationMin })} />
                  <Stat label={t('Squad kills')} value={m.logs.kills} />
                  <Stat label={t('Squad deaths')} value={m.logs.deaths} />
                </>
              )}
            </div>
            <p className="faint mt-3 text-xs">
              {t('Team K/D covers everyone on the team on that map during the window — context, not the squad’s own score. Squad numbers come from uploaded arcdps logs (player names are discarded).')}
            </p>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        {!uid ? (
          <Notice>{t('Sign in and verify to check in to raids and rate them afterwards.')}</Notice>
        ) : !isVerified(member) ? (
          <Notice tone="warn">
            <Link to="/account" className="underline">
              {t('Verify your GW2 account')}
            </Link>
                  {t(' to check in.')}
          </Notice>
        ) : st === null ? (
          <Skeleton h={120} />
        ) : (
          <>
            {live && !st.isCommander && (
              <div className="card card-pad">
                <h2 className="mb-2 font-bold">{t('Joining this raid?')}</h2>
                {st.checkedIn ? (
                  <p className="text-sm">✋ {t('You’re checked in. You can rate the raid for {n}h after it ends.', { n: LIMITS.ratingWindowHours })}</p>
                ) : st.canCheckIn ? (
                  <button className="btn btn-gold w-full" disabled={busy} onClick={() => act(() => call('checkIn', { runId: r.id }), t('Checked in ✋'))}>
                    ✋ {t('Check in')}
                  </button>
                ) : (
                  <p className="muted text-sm">{t('Check-in is for verified players on this raid’s team.')}</p>
                )}
              </div>
            )}
            {!live && !st.isCommander && st.checkedIn && (
              <div className="card card-pad grid gap-3">
                <h2 className="font-bold">{t(st.rated ? 'Your rating' : 'Rate this raid')}</h2>
                {RATING_AXES.map((a) => (
                  <Stars key={a.id} label={t(a.label)} value={scores[a.id]} onChange={(v) => setScores({ ...scores, [a.id]: v })} />
                ))}
                {st.canRate ? (
                  <button
                    className="btn btn-gold"
                    disabled={busy || RATING_AXES.some((a) => !scores[a.id])}
                    onClick={() => act(() => call('rateRun', { runId: r.id, scores }), t('Thanks for rating!'))}
                  >
                    {t(st.rated ? 'Update rating' : 'Submit rating')}
                  </button>
                ) : (
                  <p className="faint text-xs">{t('The rating window has closed.')}</p>
                )}
                <p className="faint text-xs">{t('Anonymous. Shown only as guild averages once {n}+ attendees rated.', { n: LIMITS.minRatingsToShow })}</p>
              </div>
            )}
            {st.isCommander && (
              <div className="card card-pad grid gap-3">
                <h2 className="font-bold">{t('Commander')}</h2>
                {live && (
                  <label>
                    <span className="label">{t('Peak squad size you saw')}</span>
                    <input className="input" type="number" min={1} max={100} value={peak} onChange={(e) => setPeak(e.target.value)} />
                  </label>
                )}
                <label>
                  <span className="label">{t('dps.report links (space separated)')}</span>
                  <textarea className="textarea" value={logs} onChange={(e) => setLogs(e.target.value)} placeholder="https://dps.report/…" />
                  <span className="faint mt-1 block text-xs">{t('Upload your arcdps WvW logs to dps.report — we only keep counts, never names.')}</span>
                </label>
                {live ? (
                  <button
                    className="btn btn-gold"
                    disabled={busy}
                    onClick={() =>
                      act(() => call('endRun', { runId: r.id, peak: peak ? Number(peak) : null, logs: linkList(logs) }), t('Run ended — stats computed.'))
                    }
                  >
                    ⏹ {t('End run')}
                  </button>
                ) : (
                  <button className="btn" disabled={busy || !linkList(logs).length} onClick={() => act(() => call('addRunLogs', { runId: r.id, logs: linkList(logs) }), t('Logs added.'))}>
                    {t('Add logs')}

                  </button>
                )}
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
