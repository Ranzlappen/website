/**
 * Phase 2 — hub announcements.
 *
 * Every event created on the website OR via `/raid schedule` is posted to the
 * region's raids channel and kept in sync (edit on update, strike on cancel,
 * delete on moderation). Live runs post to the region's live channel with a
 * Check-in button. Public tier only: the "Details" button answers privately
 * (ephemeral) and only for verified members of the same team.
 */
import { getSettings, siteLink, type Settings } from '../config';
import { LANGUAGES, OPENNESS, EVENT_TYPES, labelOf, MAPS } from '../shared/constants';
import { teamName, type Region } from '../shared/teams';
import { describeSchedule, nextOccurrence } from '../shared/time';
import type { PublicEvent, PublicRun } from '../shared/types';
import { COLORS, bot, botConfigured, isIgnorable, row, ts, type Embed } from './api';

export interface MessageRef {
  channelId: string;
  messageId: string;
}

function raidsChannel(s: Settings, region: Region): string | undefined {
  return region === 'eu' ? s.discord.channels.raidsEu : s.discord.channels.raidsNa;
}

function liveChannel(s: Settings, region: Region): string | undefined {
  return (region === 'eu' ? s.discord.channels.liveEu : s.discord.channels.liveNa) ?? raidsChannel(s, region);
}

export function eventEmbed(e: PublicEvent, s: Settings): Embed {
  const next = nextOccurrence(e.schedule, Date.now());
  const cancelled = e.status !== 'scheduled';
  const title = `[${e.guildTag}] ${e.title}`;
  return {
    title: cancelled ? `~~${title}~~ — ${e.status === 'cancelled' ? 'cancelled' : 'on hold'}` : title,
    url: siteLink(s, `events/${e.id}`),
    color: cancelled ? COLORS.grey : COLORS.gold,
    description: `${e.guildName}${e.official ? ' · ✅ official guild raid' : ' · member raid'}`,
    fields: [
      { name: 'Team', value: `${teamName(e.teamId, s.teamNames)} (${e.region.toUpperCase()})`, inline: true },
      { name: 'Type', value: labelOf(EVENT_TYPES, e.type), inline: true },
      { name: 'Who', value: labelOf(OPENNESS, e.openness), inline: true },
      {
        name: e.schedule.repeat === 'weekly' ? 'Next' : 'When',
        value: next ? `${ts(next.start)} (${ts(next.start, 'R')})` : '—',
        inline: false,
      },
      ...(e.schedule.repeat === 'weekly'
        ? [{ name: 'Repeats', value: describeSchedule(e.schedule), inline: false }]
        : []),
      { name: 'Languages', value: e.languages.map((l) => labelOf(LANGUAGES, l)).join(', ') || '—', inline: true },
    ],
    footer: { text: 'Map, voice & goals: verified members of this team only → Details' },
  };
}

function eventComponents(e: PublicEvent, s: Settings) {
  return [
    row(
      { type: 2, style: 2, label: 'Details', custom_id: `details:${e.id}`, emoji: { name: '🔒' } },
      { type: 2, style: 5, label: 'Open in WvW Hub', url: siteLink(s, `events/${e.id}`) },
    ),
  ];
}

async function upsertMessage(
  channelId: string,
  existing: MessageRef | null,
  payload: Record<string, unknown>,
): Promise<MessageRef | null> {
  if (existing && existing.channelId === channelId) {
    try {
      await bot('PATCH', `/channels/${existing.channelId}/messages/${existing.messageId}`, payload);
      return existing;
    } catch (e) {
      if (!isIgnorable(e)) throw e;
      // message deleted by a mod → post a fresh one
    }
  } else if (existing) {
    await removeAnnouncement(existing).catch(() => {});
  }
  const msg = await bot<{ id: string }>('POST', `/channels/${channelId}/messages`, {
    ...payload,
    allowed_mentions: { parse: [] },
  });
  return { channelId, messageId: msg.id };
}

export async function announceEvent(e: PublicEvent, existing: MessageRef | null): Promise<MessageRef | null> {
  if (!botConfigured()) return existing;
  const s = await getSettings();
  const channel = raidsChannel(s, e.region);
  if (!channel) return existing;
  return upsertMessage(channel, existing, {
    embeds: [eventEmbed(e, s)],
    components: e.status === 'scheduled' ? eventComponents(e, s) : [],
  });
}

export async function removeAnnouncement(ref: MessageRef): Promise<void> {
  if (!botConfigured()) return;
  try {
    await bot('DELETE', `/channels/${ref.channelId}/messages/${ref.messageId}`);
  } catch (e) {
    if (!isIgnorable(e)) throw e;
  }
}

export function runEmbed(r: PublicRun, s: Settings, mapId: string | null): Embed {
  const live = r.status === 'live';
  const m = r.metrics;
  const fields: Embed['fields'] = [
    { name: 'Team', value: `${teamName(r.teamId, s.teamNames)} (${r.region.toUpperCase()})`, inline: true },
    { name: 'Type', value: labelOf(EVENT_TYPES, r.type), inline: true },
    { name: live ? 'Since' : 'Ran', value: live ? ts(r.startedAt, 'R') : `${m?.durationMin ?? '?'} min`, inline: true },
  ];
  if (!live && m) {
    if (m.peak != null) fields.push({ name: 'Squad', value: `${m.peak} (${m.peakSource})`, inline: true });
    if (m.team?.kdr != null) fields.push({ name: 'Team K/D on map', value: m.team.kdr.toFixed(2), inline: true });
    if (m.claims) fields.push({ name: 'Objectives claimed', value: String(m.claims), inline: true });
  }
  if (!live && mapId) fields.push({ name: 'Map', value: labelOf(MAPS, mapId), inline: true });
  return {
    title: `${live ? '🟢 LIVE' : '⚪ Ended'} — [${r.guildTag}] ${r.guildName}`,
    url: siteLink(s, `runs/${r.id}`),
    color: live ? COLORS.live : COLORS.grey,
    fields,
    footer: { text: live ? 'On this team? Check in so the raid counts you (and you can rate it later).' : 'Attendees can rate this raid for 72h on the WvW Hub.' },
  };
}

export async function announceRun(
  r: PublicRun,
  existing: MessageRef | null,
  mapIdWhenEnded: string | null,
): Promise<MessageRef | null> {
  if (!botConfigured()) return existing;
  const s = await getSettings();
  const channel = liveChannel(s, r.region);
  if (!channel) return existing;
  const live = r.status === 'live';
  return upsertMessage(channel, existing, {
    embeds: [runEmbed(r, s, live ? null : mapIdWhenEnded)],
    components: live
      ? [
          row(
            { type: 2, style: 3, label: 'Check in', custom_id: `checkin:${r.id}`, emoji: { name: '✋' } },
            ...(r.eventId
              ? [{ type: 2 as const, style: 2 as const, label: 'Details', custom_id: `details:${r.eventId}`, emoji: { name: '🔒' } }]
              : []),
          ),
        ]
      : [row({ type: 2, style: 5, label: 'Rate this raid', url: siteLink(s, `runs/${r.id}`) })],
  });
}

/** Post a plain notice (e.g. a new report) to a configured channel. */
export async function postNotice(channelKey: keyof Settings['discord']['channels'], embed: Embed): Promise<void> {
  if (!botConfigured()) return;
  const s = await getSettings();
  const channel = s.discord.channels[channelKey];
  if (!channel) return;
  await bot('POST', `/channels/${channel}/messages`, { embeds: [embed], allowed_mentions: { parse: [] } });
}
