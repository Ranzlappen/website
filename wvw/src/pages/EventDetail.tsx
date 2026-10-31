import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorBox, GuildTag, LiveBadge, Notice, PageHeader, Skeleton, TeamChip } from '../components/ui';
import { ReportButton } from '../components/ReportDialog';
import { TzPicker } from '../components/TzPicker';
import { useDocumentTitle, useEventIndex, useMatches, useMyTeamIndex, useNow, useTeamNames } from '../lib/hooks';
import { fmtRange, relative } from '../lib/format';
import { call, errorMessage } from '../firebase';
import { isVerified, useStore } from '../store';
import { EVENT_TYPES, LANGUAGES, OPENNESS, VOICE_KINDS, labelOf } from '../shared/constants';
import { MapThumb, mapLabel } from '../components/MapPicker';
import { SubscribeDialog } from '../components/SubscribeDialog';
import { describeSchedule, occurrencesBetween } from '../shared/time';
import { COLORS, type EventDetails, type PublicEvent, type PublicRun } from '../shared/types';
import { useT } from '../i18n';

function downloadIcs(e: PublicEvent, start: number, end: number) {
  const d = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const text = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ranzlappen.com//WvW Hub//EN',
    'BEGIN:VEVENT',
    `UID:${e.id}-${d(start)}@wvw.ranzlappen.com`,
    `DTSTAMP:${d(Date.now())}`,
    `DTSTART:${d(start)}`,
    `DTEND:${d(end)}`,
    `SUMMARY:[${e.guildTag}] ${e.title.replace(/[,;]/g, ' ')}`,
    `URL:${window.location.href}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  a.download = `${e.guildTag}-${e.id}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function EventDetail() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const eu = useEventIndex('eu');
  const na = useEventIndex('na');
  const teamIdx = useMyTeamIndex();
  const { uid, member, displayTz: tz, toast } = useStore();
  const [details, setDetails] = useState<EventDetails | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const now = useNow(60_000);
  const names = useTeamNames();
  const matches = useMatches().data;
  const [subscribe, setSubscribe] = useState(false);

  const e = useMemo(
    () => [...(eu.data?.events ?? []), ...(na.data?.events ?? []), ...(teamIdx?.events ?? [])].find((x) => x.id === id) ?? null,
    [eu.data, na.data, teamIdx, id],
  );
  useDocumentTitle(e ? `[${e.guildTag}] ${e.title}` : t('Raid'));
  // The organising team's colour in its current matchup → the third it shows in on the matchup map.
  const match = e ? matches?.matches.find((m) => COLORS.some((c) => m.sides[c].teamId === e.teamId)) : undefined;
  const color = e && match ? COLORS.find((c) => match.sides[c].teamId === e.teamId) ?? null : null;
  const sides = match ? { red: match.sides.red.teamId, blue: match.sides.blue.teamId, green: match.sides.green.teamId } : undefined;

  useEffect(() => {
    if (!uid || !id) return;
    let alive = true;
    call<{ details: EventDetails[] }>('getEventDetails', { eventIds: [id] })
      .then((r) => alive && setDetails(r.details[0] ?? null))
      .catch(() => alive && setDetails(null));
    return () => {
      alive = false;
    };
  }, [uid, id, member?.teamId]);

  if (eu.loading || na.loading) return <Skeleton h={300} />;
  if (!e) {
    return (
      <ErrorBox>
        {t('This raid doesn’t exist anymore, or it’s a team-only raid of another team.')}{' '}
        <Link to="/calendar" className="underline">
          {t('Back to the calendar')}
        </Link>
      </ErrorBox>
    );
  }

  const occ = occurrencesBetween(e.schedule, now, now + 60 * 86_400_000, 6);
  const canEdit = details?.canEdit ?? false;

  const goLive = async () => {
    setBusy(true);
    try {
      const r = await call<{ run: PublicRun }>('startRun', { eventId: e.id });
      toast(t('You are live! Players on your team can now check in.'), 'ok');
      navigate(`/runs/${r.run.id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm(t('Cancel this raid?'))) return;
    setBusy(true);
    try {
      await call('cancelEvent', { eventId: e.id });
      toast(t('Raid cancelled.'), 'ok');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <PageHeader
          title={e.title}
          sub={
            <span className="flex flex-wrap items-center gap-2">
              <GuildTag tag={e.guildTag} id={e.guildId} /> {e.guildName}
              {e.official ? (
                <span className="chip chip-gold">✓ {t('official guild raid')}</span>
              ) : e.seeded ? (
                <span className="chip" title={t('Listed by the hub moderators from the guild’s public schedule. Any member of the guild can edit it and take it over.')}>
                  📋 {t('listed by moderators')}
                </span>
              ) : (
                <span className="chip">{t('member raid')}</span>
              )}
              {e.audience === 'team' && <span className="chip chip-blue">🔒 {t('team only')}</span>}
              {e.liveRunId && <LiveBadge />}
              {e.status !== 'scheduled' && <span className="chip chip-red">{t(e.status === 'suspended' ? 'on hold' : e.status)}</span>}
            </span>
          }
        />

        {e.liveRunId && (
          <Notice tone="gold">
            🟢 {t('This raid is live right now —')}{' '}
            <Link to={`/runs/${e.liveRunId}`} className="font-semibold underline">
              {t('open the run to check in')}
            </Link>
            .
          </Notice>
        )}

        <div className="card card-pad mt-4">
          <div className="flex flex-wrap gap-1.5">
            <TeamChip teamId={e.teamId} region={e.region} />
            <span className="chip">{t(labelOf(EVENT_TYPES, e.type))}</span>
            <span className="chip">{t(labelOf(OPENNESS, e.openness))}</span>
            {e.languages.map((l) => (
              <span key={l} className="chip">
                {labelOf(LANGUAGES, l)}
              </span>
            ))}
          </div>
          <p className="muted mt-3 text-sm">
            {describeSchedule(e.schedule)} · {e.schedule.durationMin} min
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <MapThumb map={e.map} third={e.map === 'jumper' ? null : color} size={150} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="label">{t('Where')}</div>
              <div className="font-semibold">{mapLabel(e.map, t, sides, names)}</div>
              <p className="faint mt-1 text-xs">
                {color
                  ? e.map === 'jumper'
                    ? t('Shows in the Jumper section of the matchup map, in the {color} column.', { color: t(color) })
                    : t('Shows in the {color} third on the matchup map — the side of the organising team this week.', { color: t(color) })
                  : t('Not in a current matchup.')}
              </p>
              <Link to="/calendar?view=map" className="mt-2 inline-block text-xs text-[var(--gold)] underline">
                {t('Open the matchup map →')}
              </Link>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <h2 className="font-bold">{t('Next dates')}</h2>
            <TzPicker compact />
          </div>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {occ.map((o) => (
              <li key={o.start} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="font-semibold">{fmtRange(o.start, o.end, tz)}</span>
                <span className="flex items-center gap-2">
                  <span className="faint">{relative(o.start)}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => downloadIcs(e, o.start, o.end)} title={t('Add this date to your calendar')}>
                    + .ics
                  </button>
                </span>
              </li>
            ))}
            {!occ.length && <li className="faint py-2 text-sm">{t('No upcoming dates.')}</li>}
          </ul>
          <button className="btn btn-sm mt-3" onClick={() => setSubscribe(true)}>
            📆 {t('Subscribe to all [{tag}] raids', { tag: e.guildTag })}
          </button>
          <p className="faint mt-1 text-xs">{t('Adds every public raid of this guild to your own calendar app, which then reminds you.')}</p>
          <SubscribeDialog open={subscribe} onClose={() => setSubscribe(false)} params={{ guild: e.guildId }} scope={`[${e.guildTag}]`} />
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="card card-pad">
          <h2 className="mb-2 font-bold">🔒 {t('Team-only details')}</h2>
          {!uid ? (
            <>
              <p className="muted text-sm">{t('Voice channel, goals, expected squad size and notes are shown only to verified members of this raid’s team.')}</p>
              <Link to="/account" className="btn btn-gold btn-sm mt-3">
                {t('Sign in with your GW2 API key')}
              </Link>
            </>
          ) : details === undefined ? (
            <Skeleton h={90} />
          ) : details === null ? (
            <p className="muted text-sm">
              {isVerified(member) ? (
                <>{t('You’re verified on another team — these details stay with the raid’s own team.')}</>
              ) : (
                <>
                  <Link to="/account" className="text-[var(--gold)] underline">
                    {t('Verify your GW2 account')}
                  </Link>
                  {t(' to see details for raids on your team.')}
                </>
              )}
            </p>
          ) : (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="label">{t('Expected squad')}</dt>
                <dd>{details.expectedSize ?? '—'}</dd>
              </div>
              <div>
                <dt className="label">{t('Voice')}</dt>
                <dd>
                  {details.voice ? (
                    <a href={details.voice.url} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--gold)] underline">
                      {t(labelOf(VOICE_KINDS, details.voice.kind))} — {t('join')}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              {details.goals && (
                <div>
                  <dt className="label">{t('Goals')}</dt>
                  <dd className="whitespace-pre-wrap">{details.goals}</dd>
                </div>
              )}
              {details.buildsUrl && (
                <div>
                  <dt className="label">{t('Builds / comp')}</dt>
                  <dd>
                    <a href={details.buildsUrl} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--gold)] underline">
                      {details.buildsUrl}
                    </a>
                  </dd>
                </div>
              )}
              {details.notes && (
                <div>
                  <dt className="label">{t('Notes')}</dt>
                  <dd className="whitespace-pre-wrap">{details.notes}</dd>
                </div>
              )}
              <p className="faint text-xs">{t('Please don’t share these outside the team.')}</p>
            </dl>
          )}
        </div>

        {canEdit && (
          <div className="card card-pad">
            <h2 className="mb-3 font-bold">{t('Commander tools')}</h2>
            {e.seeded && <p className="muted mb-3 text-xs">{t('This raid was listed by the moderators. Editing it makes you its commander.')}</p>}
            <div className="flex flex-wrap gap-2">
              {e.status === 'scheduled' && !e.liveRunId && (
                <button className="btn btn-gold" onClick={goLive} disabled={busy}>
                  🟢 {t('Go live')}
                </button>
              )}
              <Link to={`/events/${e.id}/edit`} className="btn">
                ✏️ {t('Edit')}
              </Link>
              {e.status === 'scheduled' && (
                <button className="btn btn-danger" onClick={cancel} disabled={busy}>
                  {t('Cancel raid')}

                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <ReportButton targetType="event" targetId={e.id} />
        </div>
      </aside>
    </div>
  );
}
