/*
 * CHANGE: New file – Zustand global store
 * REASON: Lightweight global state for auth user, toasts, and voted metrics
 * DATE: 2026-04-02
 */
import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { UserVotes } from '../types';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

interface AppState {
  /** Current Firebase Auth user (anonymous or signed-in) */
  user: User | null;
  setUser: (user: User | null) => void;

  /** Toast notifications stack */
  toasts: ToastMessage[];
  addToast: (text: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;

  /**
   * Per-topic map of user votes.
   * Keyed by topicId, value is { [metricId]: choiceId }.
   * Persisted to localStorage so anonymous users keep their votes across refreshes.
   */
  votedMap: Record<string, UserVotes>;
  recordVote: (topicId: string, metricId: string, choiceId: string) => void;
  hasVoted: (topicId: string, metricId: string) => boolean;
}

// Restore persisted votes from localStorage
const loadVotedMap = (): Record<string, UserVotes> => {
  try {
    const raw = localStorage.getItem('polyvote_votes');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const useStore = create<AppState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),

  toasts: [],
  addToast: (text, type = 'info') => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    // Auto-dismiss after 4 seconds
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  votedMap: loadVotedMap(),
  recordVote: (topicId, metricId, choiceId) =>
    set((s) => {
      const updated = {
        ...s.votedMap,
        [topicId]: { ...s.votedMap[topicId], [metricId]: choiceId },
      };
      localStorage.setItem('polyvote_votes', JSON.stringify(updated));
      return { votedMap: updated };
    }),
  hasVoted: (topicId, metricId) =>
    !!get().votedMap[topicId]?.[metricId],
}));
