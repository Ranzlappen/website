/**
 * Document + API shapes for WvW Hub.
 *
 * MIRRORED FILE — keep identical to `wvw/src/shared/types.ts`.
 *
 * Privacy contract: nothing in a client-readable shape below carries a GW2
 * account name, a Discord identity or a Firebase uid of *another* user. Public
 * surfaces identify raids only by guild (tag + name). Identities live in
 * server-only collections and are used for verification + moderation only.
 */
import type { Region } from './teams';
import type {
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
  /** A verified guild leader claimed the guild page. */
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
  /** Posted by a commander the guild leader appointed (vs. a guild member). */
  official: boolean;
  region: Region;
  teamId: number;
  title: string;
  type: EventType;
  openness: Openness;
  languages: Language[];
  schedule: Schedule;
  status: 'scheduled' | 'cancelled' | 'suspended';
  liveRunId: string | null;
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
  map: MapId;
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
  status: 'live' | 'ended';
  startedAt: number;
  endedAt: number | null;
  /** Verified attendees who checked in (live counter). */
  checkins: number;
  /** Latest headcount in the run's hub voice channel (voice worker), if linked. */
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
  leader: boolean;
  /** Leader-appointed commander for this guild. */
  appointed: boolean;
}

export interface MemberDoc {
  uid: string;
  discordId: string;
  discordName: string;
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
  challenge: string;
  prefs: { timezone: string | null; hubAutoJoin: boolean };
  verifiedAt: number | null;
  createdAt: number;
}

// ── Callable payloads ─────────────────────────────────────────────────────

export interface EventInput {
  guildId: string;
  title: string;
  type: EventType;
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

export interface CommanderRow {
  uid: string;
  accountName: string;
  addedAt: number;
}
