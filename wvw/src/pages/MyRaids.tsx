import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBox, Notice, PageHeader, Skeleton } from '../components/ui';
import { EventCard, RunCard } from '../components/EventCard';
import { useDocumentTitle, useLive } from '../lib/hooks';
import { call, errorMessage } from '../firebase';
import { isVerified, useStore } from '../store';
import type { EventDetails, PublicEvent } from '../shared/types';
import { useT } from '../i18n';

export default function MyRaids() {
  const t = useT();
  useDocumentTitle(t('My raids'));
  const member = useStore((s) => s.member);
  const live = useLive();
  const [events, setEvents] = useState<(PublicEvent & { hidden?: boolean })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    call<{ events: (PublicEvent & { hidden?: boolean })[]; details: EventDetails[] }>('listMyEvents')
      .then((r) => setEvents(r.events))
      .catch((e) => setError(errorMessage(e)));
  }, [member]);

  if (!isVerified(member))
    return (
      <Notice tone="warn">
        {t('Verify first on your Account page.')}{' '}
        <Link to="/account" className="underline">
          {t('Account')} →
        </Link>
      </Notice>
    );

  const myGuildIds = new Set(member!.guilds.map((g) => g.id));
  const myLive = (live.data?.runs ?? []).filter((r) => myGuildIds.has(r.guildId) && r.teamId === member!.teamId);

  return (
    <div>
      <PageHeader
        title={t('My raids')}
        sub={t('Raids you post appear on the calendar and the matchup map; voice, goals and notes only for your team. Go live from a raid page.')}
        actions={
          <Link to="/events/new" className="btn btn-gold">
            {t('+ Post a raid')}
          </Link>
        }
      />
      {myLive.length > 0 && (
        <div className="mb-6 grid gap-3">
          <h2 className="font-bold">{t('Live in your guilds')}</h2>
          {myLive.map((r) => (
            <RunCard key={r.id} r={r} />
          ))}
        </div>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      {events === null && !error ? (
        <Skeleton h={160} />
      ) : events && events.length ? (
        <div className="grid gap-3">
          {events.map((e) => (
            <div key={e.id} className="relative">
              {e.hidden && <span className="chip chip-red absolute right-3 top-3 z-10">{t('hidden by moderators')}</span>}
              <EventCard e={e} />
            </div>
          ))}
        </div>
      ) : (
        <Empty title={t('You haven’t posted any raids yet')}>{t('Post one — weekly raids only need to be set up once.')}</Empty>

      )}
    </div>
  );
}
