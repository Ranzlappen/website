/**
 * GET wvw-ical?region=eu&team=12008&guild=<id>&type=zerg → text/calendar
 *
 * A subscribable feed per region / team / guild for Google Calendar, Apple
 * Calendar, Outlook… Reads the same public index docs as the website, so it
 * can only ever expose the public tier.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { COL, db, getSettings, siteLink } from './config';
import { buildIcs } from './ics';
import { EVENT_TYPES, isOneOf } from './shared/constants';
import { teamName, type Region } from './shared/teams';
import type { PublicEvent } from './shared/types';
import { isGuildId } from './gw2';

export const ical = onRequest({ cors: true, memory: '256MiB', timeoutSeconds: 30 }, async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const regions: Region[] = q.region === 'na' ? ['na'] : q.region === 'eu' ? ['eu'] : ['eu', 'na'];
  const team = q.team ? Number(q.team) : null;
  const guild = q.guild && isGuildId(q.guild) ? q.guild : null;
  const type = isOneOf(EVENT_TYPES, q.type) ? q.type : null;

  const [settings, ...docs] = await Promise.all([
    getSettings(),
    ...regions.map((r) => db().collection(COL.public).doc(`events_${r}`).get()),
  ]);
  let events = docs.flatMap((d) => (d.data()?.events ?? []) as PublicEvent[]);
  if (team) events = events.filter((e) => e.teamId === team);
  if (guild) events = events.filter((e) => e.guildId === guild);
  if (type) events = events.filter((e) => e.type === type);

  const scope = guild
    ? `[${events[0]?.guildTag ?? 'guild'}]`
    : team
      ? teamName(team, settings.teamNames)
      : regions.map((r) => r.toUpperCase()).join('+');
  const body = buildIcs(events, {
    name: `WvW Hub — ${scope}`,
    siteUrl: siteLink(settings),
    teamNames: settings.teamNames,
  });
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=900');
  res.set('Content-Disposition', 'inline; filename="wvw-hub.ics"');
  res.status(200).send(body);
});
