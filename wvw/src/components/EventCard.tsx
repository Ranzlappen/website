import { Link } from 'react-router-dom';
import { EVENT_TYPES, LANGUAGES, OPENNESS, labelOf } from '../shared/constants';
import { describeSchedule, nextOccurrence } from '../shared/time';
import type { PublicEvent, PublicRun } from '../shared/types';
import { duration, fmtRange, relative } from '../lib/format';
import { useStore } from '../store';
import { useNow } from '../lib/hooks';
import { GuildTag, LiveBadge, TeamChip } from './ui';
import { mapLabel } from './MapPicker';
import { useT } from '../i18n';

export function EventCard({ e, start, end, compact = false }: { e: PublicEvent; start?: number; end?: number; compact?: boolean }) {
  const t = useT();
  const tz = useStore((s) => s.displayTz);
  const now = useNow(60_000);
  const next = start != null && end != null ? { start, end } : nextOccurrence(e.schedule, now);
  const cancelled = e.status !== 'scheduled';
  return (
    <Link
      to={`/events/${e.id}`}
      className={`card card-pad block transition hover:border-[var(--border-strong)] ${cancelled ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <GuildTag tag={e.guildTag} />
        <span className={`font-semibold ${cancelled ? 'line-through' : ''}`}>{e.title}</span>
        {e.liveRunId && <LiveBadge />}
        {e.official ? (
          <span className="chip chip-gold">✓ {t('official')}</span>
        ) : e.seeded ? (
          <span className="chip">📋 {t('listed by moderators')}</span>
        ) : (
          <span className="chip">{t('member raid')}</span>
        )}
        {e.audience === 'team' && (
          <span className="chip chip-blue" title={t('Only visible to verified members of this team')}>
            🔒 {t('team only')}
          </span>
        )}
        {e.status === 'cancelled' && <span className="chip chip-red">{t('cancelled')}</span>}
        {e.status === 'suspended' && <span className="chip">{t('on hold')}</span>}
      </div>
      {next && (
        <div className="mt-1.5 text-sm">
          <span className="font-semibold">{fmtRange(next.start, next.end, tz)}</span>{' '}
          <span className="faint">· {relative(next.start, now)}</span>
        </div>
      )}
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <TeamChip teamId={e.teamId} region={e.region} />
          <span className="chip">📍 {mapLabel(e.map, t, undefined, undefined, true)}</span>
          <span className="chip">{t(labelOf(EVENT_TYPES, e.type))}</span>
          <span className="chip">{t(labelOf(OPENNESS, e.openness)).split(' — ')[0]}</span>
          {e.languages.map((l) => (
            <span key={l} className="chip" title={labelOf(LANGUAGES, l)}>
              {l.toUpperCase()}
            </span>
          ))}
          {e.schedule.repeat === 'weekly' && <span className="faint text-xs">{describeSchedule(e.schedule)}</span>}
        </div>
      )}
    </Link>
  );
}

export function RunCard({ r }: { r: PublicRun }) {
  const t = useT();
  const tz = useStore((s) => s.displayTz);
  const now = useNow(60_000);
  const live = r.status === 'live';
  return (
    <Link to={`/runs/${r.id}`} className="card card-pad block transition hover:border-[var(--border-strong)]">
      <div className="flex flex-wrap items-center gap-2">
        {live ? <LiveBadge /> : <span className="chip">{t('ended')}</span>}
        <GuildTag tag={r.guildTag} />
        <span className="font-semibold">{r.guildName}</span>
        <span className="chip">{t(labelOf(EVENT_TYPES, r.type))}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
        <TeamChip teamId={r.teamId} region={r.region} />
        {live ? (
          <span className="muted">
            {t('live for {d}', { d: duration(now - r.startedAt) })} · ✋ {t('{n} checked in', { n: r.checkins })}
          </span>
        ) : (
          <span className="muted">
            {fmtRange(r.startedAt, r.endedAt ?? r.startedAt, tz)}
            {r.metrics?.peak ? ` · ${t('{n} players', { n: r.metrics.peak })}` : ''}

          </span>
        )}
      </div>
    </Link>
  );
}
