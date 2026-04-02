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

/** A user-submitted request to edit, add, or delete a topic/metric */
export interface ChangeRequest {
  id: string;
  topicId: string;
  topicTitle: string;
  type: 'edit' | 'add' | 'delete';
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  authorId: string;
}

/** Tracks which metrics a user has already voted on (keyed by metricId) */
export interface UserVotes {
  [metricId: string]: string; // choiceId
}
