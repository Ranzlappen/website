/**
 * Document + API shapes for WvW Hub.
 *
 * MIRRORED FILE — keep identical to `polyvote/functions/src/wvw/shared/types.ts`.
 *
 * Privacy contract: nothing in a client-readable shape below carries a GW2
 * account name, a Discord identity or a Firebase uid of *another* user. Public
 * surfaces identify raids only by guild (tag + name). Identities live in
 * server-only collections and are used for verification + moderation only.
 */
import type { Region } from './teams';
import type {
  Audience,
  EventType,
  Language,
  MapId,
  Openness,
  Playstyle,
  RatingAxis,
  ReportReason,
  VoiceKind,
} from './constants';
import type { Schedule } from './time';

// ── Public match snapshot (wvwPublic/matches) ─────────────────────────────

export type Color = 'red' | 'blue' | 'green';
export const COLORS: Color[] = ['red', 'blue', 'green'];

export interface TeamSide {
  teamId: number | null;
  score: number;
  victoryPoints: number;
  kills: number;
  deaths: number;
  /** Objectives currently owned, all maps. */
  owned: { camps: number; towers: number; keeps: number; castles: number };
  /** Distinct guilds currently holding a claim for this side. */
  claimingGuilds: number;
}

export interface MapSummary {
  type: string; // Center | RedHome | BlueHome | GreenHome
  kills: Record<Color, number>;
  deaths: Record<Color, number>;
  scores: Record<Color, number>;
}

export interface MatchSummary {
  id: string;
  region: Region;
  start: string;
  end: string;
  sides: Record<Color, TeamSide>;
  maps: MapSummary[];
}

export interface PublicMatches {
  updatedAt: number;
  matches: MatchSummary[];
  timers: { lockout: Record<Region, string | null>; teamAssignment: Record<Region, string | null> };
  /** Guilds that selected each team as their WvW guild's team (from /v2/wvw/guilds/:region). */
  teamGuildCounts: Record<string, number>;
}

// ── Public config (wvwPublic/config) ──────────────────────────────────────

export interface PublicConfig {
  teamNames?: Record<string, string>;
  hubInviteUrl?: string | null;
  announcement?: string | null;
  updatedAt?: number;
}

// ── Guild directory ───────────────────────────────────────────────────────

export interface GuildProfile {
  description: string;
  languages: Language[];
  playstyles: Playstyle[];
  timezone: string | null;
  recruiting: boolean;
  /** The guild's own (public) Discord invite / website — set by the leader. */
  discordInvite: string | null;
  website: string | null;
}

export interface GuildWeekActivity {
  claims: number;
  camps: number;
  towers: number;
  keeps: number;
  castles: number;
}

export interface GuildStats {
  runs30d: number;
  avgDurationMin: number | null;
  avgPeak: number | null;
  avgKdr: number | null;
  /** Shown only once `n` distinct verified attendees rated (LIMITS.minRatingsToShow). */
  ratings: ({ n: number } & Record<RatingAxis, number>) | null;
  updatedAt: number;
}

export interface GuildDirDoc {
  id: string;
  name: string;
  tag: string;
  region: Region | null;
  teamId: number | null;
  /** The guild's leader signed in and verified (GW2 API `guild_leader`). */
  claimed: boolean;
  suspended: boolean;
  profile: GuildProfile | null;
  /** ISO week key → activity (last ~8 weeks kept). */
  activity: Record<string, GuildWeekActivity>;
  heldNow: number;
  lastSeenAt: number | null;
  commanderCount: number;
  stats: GuildStats | null;
  updatedAt: number;
}

/** Compact row in wvwPublic/guildIndex_{region} (one read for the directory). */
export interface GuildIndexRow {
  id: string;
  tag: string;
  name: string;
  teamId: number | null;
  claims4w: number;
  heldNow: number;
  claimed: boolean;
  recruiting: boolean;
  playstyles: Playstyle[];
  languages: Language[];
  lastSeenAt: number | null;
  upcoming: number;
}

// ── Events (public tier) ──────────────────────────────────────────────────

export interface PublicEvent {
  id: string;
  guildId: string;
  guildTag: string;
  guildName: string;
  /** Posted by the guild's leader (✓ official); any other guild member's raid shows without the badge. */
  official: boolean;
  region: Region;
  teamId: number;
  title: string;
  type: EventType;
  /** Map (or `jumper`) — public, so every team sees where raids are on the matchup map. */
  map: MapId;
  /** `team` raids never appear in public indexes — only in wvwTeamIndex/{teamId}. */
  audience: Audience;
  openness: Openness;
  languages: Language[];
  schedule: Schedule;
  status: 'scheduled' | 'cancelled' | 'suspended';
  liveRunId: string | null;
  /** Listed by a moderator from a public schedule (CSV import), not posted by a verified member. */
  seeded?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** wvwPublic/events_{region} */
export interface PublicEventIndex {
  updatedAt: number;
  events: PublicEvent[];
}

/** Private tier — returned only to verified members of the same team. */
export interface EventDetails {
  eventId: string;
  goals: string;
  expectedSize: number | null;
  voice: { kind: VoiceKind; url: string } | null;
  buildsUrl: string | null;
  notes: string;
  /** True when the caller is the event's commander (can edit). */
  canEdit: boolean;
}

// ── Runs (a raid actually happening) ──────────────────────────────────────

export interface RunMetrics {
  durationMin: number | null;
  /** Best available squad-size figure and where it came from. */
  peak: number | null;
  peakSource: 'logs' | 'voice' | 'checkins' | 'reported' | null;
  checkins: number;
  voice: { peak: number; avg: number; samples: number } | null;
  /** Team-level kills/deaths on the run's map(s) during the run window. */
  team: { kills: number; deaths: number; kdr: number | null } | null;
  /** Objectives the guild claimed during the window (public API claims). */
  claims: number;
  logs: { count: number; maxSquad: number; kills: number; deaths: number; durationMin: number } | null;
}

export interface PublicRun {
  id: string;
  eventId: string | null;
  guildId: string;
  guildTag: string;
  guildName: string;
  region: Region;
  teamId: number;
  matchId: string | null;
  type: EventType;
  /** Runs of team-only raids stay out of the public live list. */
  audience?: Audience;
  status: 'live' | 'ended';
  startedAt: number;
  endedAt: number | null;
  /** Verified attendees who checked in (live counter). */
  checkins: number;
  /** Voice-channel headcount — reserved for the deferred Discord integration (always null for now). */
  voiceNow: number | null;
  metrics: RunMetrics | null;
}

/** wvwPublic/live */
export interface PublicLive {
  updatedAt: number;
  runs: PublicRun[];
}

// ── Member (own doc only: wvwMembers/{uid}) ───────────────────────────────

export type MemberRole = 'user' | 'mod' | 'admin';

export interface MemberGuild {
  id: string;
  tag: string;
  name: string;
  /** GW2 API `guild_leader` — the member leads this guild in-game. */
  leader: boolean;
}

export interface MemberDoc {
  /** "wvw-gw2-<GW2 account id>" — signing in IS verifying (API key). */
  uid: string;
  /** Reserved for the deferred Discord integration (account linking). */
  discordId: string | null;
  role: MemberRole;
  status: 'active' | 'suspended';
  verified: boolean;
  /** Visible to the member themself only (never public). */
  accountName: string | null;
  commander: boolean;
  region: Region | null;
  teamId: number | null;
  wvwGuildId: string | null;
  guilds: MemberGuild[];
  /** The member must re-verify (relink happened and no stored key worked). */
  stale: boolean;
  prefs: { timezone: string | null };
  verifiedAt: number | null;
  createdAt: number;
}

// ── Callable payloads ─────────────────────────────────────────────────────

export interface EventInput {
  guildId: string;
  title: string;
  type: EventType;
  audience: Audience;
  openness: Openness;
  languages: Language[];
  schedule: Schedule;
  map: MapId;
  goals: string;
  expectedSize: number | null;
  voice: { kind: VoiceKind; url: string } | null;
  buildsUrl: string | null;
  notes: string;
}

export interface ReportInput {
  targetType: 'event' | 'guild' | 'run';
  targetId: string;
  reason: ReportReason;
  details: string;
}

export interface ReportRow {
  id: string;
  targetType: 'event' | 'guild' | 'run';
  targetId: string;
  targetLabel: string;
  reason: ReportReason;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: number;
  resolution: string | null;
}

/**
 * wvwTeamIndex/{teamId} — the private tier of every raid on one team, readable
 * only by verified members of that team (Firestore rules). Lets the calendar
 * show + filter by map third without one callable per event.
 */
export interface TeamIndex {
  updatedAt: number;
  /** Team-only raids (audience "team") — absent from the public index. */
  events: PublicEvent[];
  details: Record<string, Omit<EventDetails, 'eventId' | 'canEdit'>>;
}

/** One CSV row of the admin raid import (`adminImportEvents`), as previewed / applied. */
export interface ImportRowResult {
  /** 1-based line in the CSV (header = line 1). */
  line: number;
  status: 'create' | 'update' | 'error';
  error: string | null;
  guildTag: string | null;
  guildName: string | null;
  teamId: number | null;
  title: string;
  type: EventType | null;
  map: MapId | null;
  /** Human summary of the schedule ("Weekly on Fri · 20:30 (Europe/Berlin)"). */
  when: string;
  audience: Audience | null;
}

/** wvwPublic/relink — when the current link started (observed) and ends. */
export interface PublicRelink {
  updatedAt: number;
  /** Epoch ms of the last observed relink per region (null until one was observed). */
  last: Record<Region, number | null>;
  /** Next team assignment per region (ISO, from /v2/wvw/timers/teamAssignment). */
  next: Record<Region, string | null>;
}
