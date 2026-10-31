/**
 * Enumerations + limits shared by the WvW Hub client and server.
 *
 * MIRRORED FILE — keep identical to `wvw/src/shared/constants.ts`.
 * The server validates every value against these lists, so adding an option
 * is a two-file change (this file + its mirror) and nothing else.
 */

/** The four WvW maps. `apiType` is the map `type` in /v2/wvw/matches. */
export const WVW_MAPS = [
  { id: 'ebg', label: 'Eternal Battlegrounds', short: 'EBG', apiType: 'Center' },
  { id: 'red', label: 'Red Borderlands', short: 'Red BL', apiType: 'RedHome' },
  { id: 'blue', label: 'Blue Borderlands', short: 'Blue BL', apiType: 'BlueHome' },
  { id: 'green', label: 'Green Borderlands', short: 'Green BL', apiType: 'GreenHome' },
] as const;
export type WvwMapId = (typeof WVW_MAPS)[number]['id'];

/** Every map is split into thirds — one per team colour (nearest team spawn). */
export const THIRDS = ['red', 'blue', 'green'] as const;
export type Third = (typeof THIRDS)[number];

/**
 * Where a raid takes place: one third of one map ("ebg:red" = the red third
 * of Eternal Battlegrounds) or `jumper` (cross-map play, hopping between maps).
 * The visual picker lives in wvw/src/components/MapPicker.tsx.
 */
export const MAPS = [
  ...WVW_MAPS.flatMap((m) =>
    THIRDS.map((t) => ({
      id: `${m.id}:${t}` as `${WvwMapId}:${Third}`,
      label: `${m.short} · ${t} third`,
      short: `${m.short} ${t[0].toUpperCase()}`,
      apiType: m.apiType as string | null,
      map: m.id as WvwMapId | null,
      third: t as Third | null,
    })),
  ),
  { id: 'jumper' as const, label: 'Jumper — cross-map play', short: 'Jumper', apiType: null, map: null, third: null },
];
export type MapId = (typeof MAPS)[number]['id'];

export const EVENT_TYPES = [
  { id: 'zerg', label: 'Zerg / blob' },
  { id: 'guild', label: 'Guild raid' },
  { id: 'havoc', label: 'Havoc' },
  { id: 'roaming', label: 'Roaming' },
  { id: 'ppt', label: 'PPT / objective push' },
  { id: 'defense', label: 'Defense / scouting' },
  { id: 'training', label: 'Training / newcomer squad' },
  { id: 'gvg', label: 'GvG / fight night' },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]['id'];

/**
 * Who can SEE a raid. `everyone`: listed publicly (guild, team, time, type) —
 * map third, voice and goals still stay team-only. `team`: the whole raid is
 * visible only to verified members of the poster's team.
 */
export const AUDIENCES = [
  { id: 'everyone', label: 'Everyone', hint: 'Listed publicly — map third, voice & goals stay team-only' },
  { id: 'team', label: 'Only my team', hint: 'Hidden from other teams entirely' },
] as const;
export type Audience = (typeof AUDIENCES)[number]['id'];

/** Who can join: open tag (pugs welcome), guild-only, or invite/application. */
export const OPENNESS = [
  { id: 'open', label: 'Open tag — everyone welcome' },
  { id: 'guild', label: 'Guild members only' },
  { id: 'invite', label: 'Invite / sign-up required' },
] as const;
export type Openness = (typeof OPENNESS)[number]['id'];

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
  { id: 'fr', label: 'Français' },
  { id: 'es', label: 'Español' },
  { id: 'pl', label: 'Polski' },
  { id: 'it', label: 'Italiano' },
  { id: 'pt', label: 'Português' },
  { id: 'ru', label: 'Русский' },
] as const;
export type Language = (typeof LANGUAGES)[number]['id'];

export const PLAYSTYLES = [
  { id: 'zerg', label: 'Zerg' },
  { id: 'fight', label: 'Fight guild' },
  { id: 'havoc', label: 'Havoc' },
  { id: 'roaming', label: 'Roaming' },
  { id: 'ppt', label: 'PPT' },
  { id: 'gvg', label: 'GvG' },
  { id: 'casual', label: 'Casual' },
  { id: 'newcomer', label: 'Newcomer-friendly' },
] as const;
export type Playstyle = (typeof PLAYSTYLES)[number]['id'];

export const VOICE_KINDS = [
  { id: 'discord', label: 'Discord' },
  { id: 'teamspeak', label: 'TeamSpeak' },
  { id: 'mumble', label: 'Mumble' },
  { id: 'other', label: 'Other' },
] as const;
export type VoiceKind = (typeof VOICE_KINDS)[number]['id'];

/** Multi-axis ratings (no single thumbs score — see wvw/README.md "Ratings"). */
export const RATING_AXES = [
  { id: 'organisation', label: 'Organisation' },
  { id: 'communication', label: 'Communication' },
  { id: 'newcomers', label: 'Newcomer-friendly' },
  { id: 'fun', label: 'Fun' },
] as const;
export type RatingAxis = (typeof RATING_AXES)[number]['id'];

export const REPORT_REASONS = [
  { id: 'fake', label: 'Fake / impersonation' },
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment / toxicity' },
  { id: 'cheating', label: 'Cheating / ToS violation' },
  { id: 'spying', label: 'Spying / leaking comms' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Other' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

/** Time zones offered in pickers (any valid IANA zone is accepted server-side). */
export const COMMON_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Warsaw',
  'Europe/Helsinki',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Asia/Singapore',
] as const;

export const LIMITS = {
  titleMax: 80,
  goalsMax: 500,
  notesMax: 1000,
  descriptionMax: 1500,
  urlMax: 300,
  durationMinMin: 15,
  durationMinMax: 12 * 60,
  expectedSizeMax: 100,
  /** Active (non-cancelled, not-ended) events a single commander may own. */
  activeEventsPerCommander: 15,
  /** How far ahead a one-off event may be scheduled. */
  scheduleAheadDays: 120,
  /** Ratings stay hidden until this many distinct verified attendees rated. */
  minRatingsToShow: 5,
  /** Rating window after a run ends. */
  ratingWindowHours: 72,
  /** Reports a member may file per 24h. */
  reportsPerDay: 10,
  /** dps.report logs per run. */
  logsPerRun: 10,
  /** Check-ins are accepted this long after a run ended (late joiners). */
  checkinGraceMinutes: 30,
} as const;

/**
 * Community rules — posted to the hub #rules channel by provisioning AND shown
 * on the website /rules page. Markdown-lite: **bold** only.
 */
export const COMMUNITY_RULES: string[] = [
  '**1. Be respectful.** No harassment, hate speech, slurs, threats or personal attacks — across *all* teams. Banter is fine; targeting people is not.',
  '**2. No spying or comms leaking.** Don’t share another team’s raid details, voice channels or plans, and don’t join enemy comms. Team-only details stay with that team.',
  '**3. Follow ArenaNet’s rules.** No cheats, exploits, botting, account sharing/selling, or third-party tools ArenaNet prohibits. arcdps-style tools within ArenaNet’s policy are fine.',
  '**4. No call-out or drama threads.** Problems with a guild or commander go to the report button on the WvW Hub or to a moderator — not into public channels.',
  '**5. No doxxing, no account names.** Don’t post other people’s account names, real names, IPs or private info. The Hub only ever shows guild tags — keep it that way.',
  '**6. Never post API keys.** Not yours, not anyone’s — a key is a login. Paste it only into the WvW Hub sign-in form.',
  '**7. No spam or advertising.** Recruit through your guild page, not raid posts. No unrelated links, selling, or RMT.',
  '**8. Honest raid posts.** Only schedule raids you actually intend to lead, for a guild you actually lead for. Fake or impersonating posts get the guild page suspended.',
  '**9. Tag your raid’s language honestly** so players know what to expect on comms.',
  '**10. Moderators have the final word.** Disagree? DM a moderator calmly. Ban evasion = permanent ban.',
];

export function isOneOf<T extends { id: string }>(
  list: readonly T[],
  value: unknown,
): value is T['id'] {
  return typeof value === 'string' && list.some((x) => x.id === value);
}

export function labelOf<T extends { id: string; label: string }>(
  list: readonly T[],
  id: string | null | undefined,
): string {
  return list.find((x) => x.id === id)?.label ?? id ?? '';
}
