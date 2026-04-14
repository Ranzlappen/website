/*
 * CHANGE: New file – TypeScript type definitions for PolyVote
 * REASON: Centralized types for topics, metrics, choices, requests, and votes
 * DATE: 2026-04-02
 */

/** Supported topic categories */
export type Category =
  | 'Politics'
  | 'Technology'
  | 'Science'
  | 'Culture'
  | 'Environment'
  | 'Health'
  | 'Sports'
  | 'Other';

/** A single votable choice within a metric */
export interface Choice {
  id: string;
  label: string;
  /** Hex color used for the voting card and chart segment */
  color: string;
  votes: number;
}

/** A metric (dimension) that belongs to a topic */
export interface Metric {
  id: string;
  label: string;
  choices: Choice[];
}

/** A voting topic – the core document in the `topics` collection */
export interface Topic {
  id: string;
  title: string;
  description: string;
  category: Category;
  createdAt: number; // epoch ms
  /** Total number of individual votes cast across all metrics */
  totalVotes: number;
  metrics: Metric[];
}

/** A single proposed change within a change request */
export interface ProposedChange {
  /** Unique ID for this individual change */
  changeId: string;
  /** Type of change */
  action: 'edit-metric' | 'delete-metric' | 'edit-choice' | 'delete-choice' | 'add-metric' | 'add-choice';
  /** Target metric ID */
  metricId: string;
  /** Target choice ID (for choice-level changes) */
  choiceId?: string;
  /** Original value (for display in diff) */
  oldValue?: { label?: string; color?: string };
  /** Proposed new value */
  newValue?: { label?: string; color?: string; choices?: Choice[] };
  /** Per-change approval status */
  status: 'pending' | 'approved' | 'rejected';
}

/** A user-submitted request to edit, add, or delete a topic/metric */
export interface ChangeRequest {
  id: string;
  topicId: string;
  topicTitle: string;
  /** Overall description of why the changes are needed */
  description: string;
  /** Structured list of proposed changes */
  changes: ProposedChange[];
  status: 'pending' | 'approved' | 'rejected' | 'partial';
  createdAt: number;
  authorId: string;
}

/** A structured proposal for an entirely new topic */
export interface TopicRequest {
  id: string;
  title: string;
  description: string;
  category: Category;
  metrics: Metric[];
  status: 'pending' | 'promoted' | 'archived';
  createdAt: number;   // epoch ms
  expiresAt: number;   // createdAt + REQUEST_TIMEOUT_MS
  authorId: string;
  endorsers: string[]; // UIDs who endorsed (includes author)
  endorsementCount: number;
}

/** Number of unique endorsements needed to promote a topic request */
export const REQUEST_ENDORSEMENTS_NEEDED = 2;

/** Time window for a topic request to gather endorsements (10 minutes) */
export const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

/** Tracks which metrics a user has already voted on (keyed by metricId) */
export interface UserVotes {
  [metricId: string]: string; // choiceId
}

/** A comment on a topic */
export interface Comment {
  id: string;
  text: string;
  authorId: string;
  /** Auto-generated display name from UID hash */
  displayName: string;
  createdAt: number;
  /** Optional parent comment ID for threading */
  parentId?: string;
}

// ── Backend types ──

/** User roles for access control */
export type UserRole = 'user' | 'moderator' | 'admin';

/** User account status */
export type UserStatus = 'active' | 'suspended' | 'banned';

/** User profile stored in the `users` collection */
export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string | null;
  role: UserRole;
  status: UserStatus;
  isAnonymous: boolean;
  createdAt: number;
  lastActive: number;
  votesCount: number;
  commentsCount: number;
  bannedAt?: number | null;
  banReason?: string | null;
}

/** Server-side vote record for deduplication */
export interface VoteRecord {
  id: string;
  userId: string;
  topicId: string;
  metricId: string;
  choiceId: string;
  previousChoiceId?: string | null;
  timestamp: number;
}

/** Content report submitted by users */
export type ReportReason = 'spam' | 'harassment' | 'misinformation' | 'inappropriate' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'action-taken' | 'dismissed';

export interface ContentReport {
  id: string;
  type: 'comment' | 'topic' | 'topicRequest';
  targetId: string;
  parentId?: string | null;
  reporterId: string;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus;
  createdAt: number;
  reviewedBy?: string | null;
  reviewedAt?: number | null;
}

/** Audit log entry */
export interface AuditEvent {
  id: string;
  action: string;
  actorId: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

/** Daily analytics snapshot */
export interface DailyAnalytics {
  date: string;
  timestamp: number;
  totalVotes: number;
  newTopics: number;
  newUsers: number;
  activeUsers: number;
  topTopics: { id: string; title: string; votes: number }[];
  categoryBreakdown: Record<string, number>;
}
