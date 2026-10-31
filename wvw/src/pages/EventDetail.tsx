import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorBox, GuildTag, LiveBadge, Notice, PageHeader, Skeleton, TeamChip } from '../components/ui';
import { ReportButton } from '../components/ReportDialog';
import { TzPicker } from '../components/TzPicker';
import { useDocumentTitle, useEventIndex, useMySides, useNow, useTeamNames } from '../lib/hooks';
import { fmtRange, relative } from '../lib/format';
import { call, errorMessage } from '../firebase';
import { icalUrl } from '../config';
import { isVerified, useStore } from '../store';
import { EVENT_TYPES, LANGUAGES, OPENNESS, VOICE_KINDS, labelOf } from '../shared/constants';
import { MapThumb, zoneLabel } from '../components/MapPicker';
import { describeSchedule, occurrencesBetween } from '../shared/time';
import type { EventDetails, PublicEvent, PublicRun } from '../shared/types';

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
  const { id } = useParams();
  const navigate = useNavigate();
  const eu = useEventIndex('eu');
  const na = useEventIndex('na');
  const { uid, member, displayTz: tz, toast } = useStore();
  const [details, setDetails] = useState<EventDetails | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const now = useNow(60_000);
  const { sides } = useMySides();
  const names = useTeamNames();

  const e = useMemo(
    () => [...(eu.data?.events ?? []), ...(na.data?.events ?? [])].find((x) => x.id === id) ?? null,
    [eu.data, na.data, id],
  );
  useDocumentTitle(e ? `[${e.guildTag}] ${e.title}` : 'Raid');

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
        This raid doesn’t exist anymore (it may have ended or been removed). <Link to="/calendar" className="underline">Back to the calendar</Link>
      </ErrorBox>
    );
  }

  const occ = occurrencesBetween(e.schedule, now, now + 60 * 86_400_000, 6);
  const canEdit = details?.canEdit ?? false;

  const goLive = async () => {
    setBusy(true);
    try {
      const r = await call<{ run: PublicRun }>('startRun', { eventId: e.id });
      toast('You are live! Players on your team can now check in.', 'ok');
      navigate(`/runs/${r.run.id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm('Cancel this raid?')) return;
    setBusy(true);
    try {
      await call('cancelEvent', { eventId: e.id });
      toast('Raid cancelled.', 'ok');
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
              {e.official ? <span className="chip chip-gold">✓ official guild raid</span> : <span className="chip">member raid</span>}
              {e.liveRunId && <LiveBadge />}
              {e.status !== 'scheduled' && <span className="chip chip-red">{e.status}</span>}
            </span>
          }
        />

        {e.liveRunId && (
          <Notice tone="gold">
            🟢 This raid is live right now — <Link to={`/runs/${e.liveRunId}`} className="font-semibold underline">open the run to check in</Link>.
          </Notice>
        )}

        <div className="card card-pad mt-4">
          <div className="flex flex-wrap gap-1.5">
            <TeamChip teamId={e.teamId} region={e.region} />
            <span className="chip">{labelOf(EVENT_TYPES, e.type)}</span>
            <span className="chip">{labelOf(OPENNESS, e.openness)}</span>
            {e.languages.map((l) => (
              <span key={l} className="chip">
                {labelOf(LANGUAGES, l)}
              </span>
            ))}
          </div>
          <p className="muted mt-3 text-sm">{describeSchedule(e.schedule)} · {e.schedule.durationMin} min</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <h2 className="font-bold">Next dates</h2>
            <TzPicker compact />
          </div>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {occ.map((o) => (
              <li key={o.start} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="font-semibold">{fmtRange(o.start, o.end, tz)}</span>
                <span className="flex items-center gap-2">
                  <span className="faint">{relative(o.start)}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => downloadIcs(e, o.start, o.end)} title="Add this date to your calendar">
                    + .ics
                  </button>
                </span>
              </li>
            ))}
            {!occ.length && <li className="faint py-2 text-sm">No upcoming dates.</li>}
          </ul>
          <a className="btn btn-sm mt-3" href={icalUrl({ guild: e.guildId }).replace(/^https:/, 'webcal:')}>
            📆 Subscribe to all [{e.guildTag}] raids
          </a>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="card card-pad">
          <h2 className="mb-2 font-bold">🔒 Team-only details</h2>
          {!uid ? (
            <>
              <p className="muted text-sm">Map third, voice channel, goals and expected squad size are shown only to verified members of this raid’s team.</p>
              <Link to="/account" className="btn btn-gold btn-sm mt-3">
                Sign in with your GW2 API key
              </Link>
            </>
          ) : details === undefined ? (
            <Skeleton h={90} />
          ) : details === null ? (
            <p className="muted text-sm">
              {isVerified(member) ? (
                <>You’re verified on another team — these details stay with the raid’s own team.</>
              ) : (
                <>
                  <Link to="/account" className="text-[var(--gold)] underline">Verify your GW2 account</Link> to see details for raids on your team.
                </>
              )}
            </p>
          ) : (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="label">Where</dt>
                <dd>
                  <span className="mb-1.5 block">{zoneLabel(details.map, sides, names)}</span>
                  <MapThumb zone={details.map} size={180} />
                </dd>
              </div>
              <div>
                <dt className="label">Expected squad</dt>
                <dd>{details.expectedSize ?? '—'}</dd>
              </div>
              <div>
                <dt className="label">Voice</dt>
                <dd>
                  {details.voice ? (
                    <a href={details.voice.url} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--gold)] underline">
                      {labelOf(VOICE_KINDS, details.voice.kind)} — join
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              {details.goals && (
                <div>
                  <dt className="label">Goals</dt>
                  <dd className="whitespace-pre-wrap">{details.goals}</dd>
                </div>
              )}
              {details.buildsUrl && (
                <div>
                  <dt className="label">Builds / comp</dt>
                  <dd>
                    <a href={details.buildsUrl} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--gold)] underline">
                      {details.buildsUrl}
                    </a>
                  </dd>
                </div>
              )}
              {details.notes && (
                <div>
                  <dt className="label">Notes</dt>
                  <dd className="whitespace-pre-wrap">{details.notes}</dd>
                </div>
              )}
              <p className="faint text-xs">Please don’t share these outside the team.</p>
            </dl>
          )}
        </div>

        {canEdit && (
          <div className="card card-pad">
            <h2 className="mb-3 font-bold">Commander tools</h2>
            <div className="flex flex-wrap gap-2">
              {e.status === 'scheduled' && !e.liveRunId && (
                <button className="btn btn-gold" onClick={goLive} disabled={busy}>
                  🟢 Go live
                </button>
              )}
              <Link to={`/events/${e.id}/edit`} className="btn">
                ✏️ Edit
              </Link>
              {e.status === 'scheduled' && (
                <button className="btn btn-danger" onClick={cancel} disabled={busy}>
                  Cancel raid
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
