/**
 * "Subscribe" = add an iCal feed (wvw-ical) to the visitor's own calendar app.
 *
 * The website itself sends no notifications. The feed puts every matching
 * raid into Google / Apple / Outlook Calendar and keeps it updated; the
 * calendar app does the reminding. `?alarm=N` embeds a reminder N minutes
 * before (Apple Calendar, Thunderbird, Outlook desktop honour it; Google
 * Calendar ignores feed reminders — there you set a default notification on
 * the subscribed calendar once).
 */
import { useState } from 'react';
import { Modal } from './ui';
import { icalUrl } from '../config';
import { useStore } from '../store';
import { useT } from '../i18n';

export function SubscribeDialog({
  open,
  onClose,
  params,
  scope,
}: {
  open: boolean;
  onClose: () => void;
  /** wvw-ical query: region / team / guild / type. */
  params: Record<string, string | number | null | undefined>;
  /** What the feed contains, e.g. "[AoD] raids" or "EU · Frost Citadel". */
  scope: string;
}) {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [alarm, setAlarm] = useState<number>(30);
  const https = icalUrl({ ...params, alarm: alarm || null });
  const webcal = https.replace(/^https:/, 'webcal:');
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
  const outlook = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent(`WvW Hub — ${scope}`)}`;
  const copy = () =>
    navigator.clipboard?.writeText(https).then(
      () => toast(t('Feed URL copied.'), 'ok'),
      () => toast(t('Copy failed — select the URL and copy it manually.'), 'error'),
    );

  return (
    <Modal open={open} onClose={onClose} title={t('Subscribe: {scope}', { scope })}>
      <div className="grid gap-4 text-sm">
        <p className="muted">
          {t(
            'This adds a live calendar feed to your own calendar app. New, changed and cancelled raids show up there automatically — and your calendar app sends the reminders. The website itself doesn’t send notifications.',
          )}
        </p>
        <label>
          <span className="label">{t('Reminder')}</span>
          <select className="select" value={alarm} onChange={(e) => setAlarm(Number(e.target.value))}>
            <option value={0}>{t('No reminder')}</option>
            <option value={15}>{t('{n} minutes before', { n: 15 })}</option>
            <option value={30}>{t('{n} minutes before', { n: 30 })}</option>
            <option value={60}>{t('1 hour before')}</option>
            <option value={120}>{t('2 hours before')}</option>
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <a className="btn" href={google} target="_blank" rel="noopener noreferrer">
            Google Calendar
          </a>
          <a className="btn" href={webcal}>
            Apple / Outlook
          </a>
          <a className="btn" href={outlook} target="_blank" rel="noopener noreferrer">
            Outlook.com
          </a>
        </div>
        <div>
          <span className="label">{t('Or copy the feed URL (any calendar app: “add calendar from URL”)')}</span>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={https} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-sm shrink-0" onClick={copy}>
              {t('Copy')}
            </button>
          </div>
        </div>
        <ul className="faint list-disc space-y-1 pl-5 text-xs">
          <li>{t('Google Calendar ignores reminders inside feeds: open the calendar’s settings → “Event notifications” to add one. It refreshes subscribed calendars every few hours.')}</li>
          <li>{t('Apple Calendar: keep “Remove alerts” unticked when subscribing, or the reminder is dropped.')}</li>
          <li>{t('The feed only contains public raids (guild, time, map, type) — never voice links or team-only raids.')}</li>
        </ul>
      </div>
    </Modal>
  );
}
