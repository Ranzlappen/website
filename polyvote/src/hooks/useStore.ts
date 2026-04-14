/*
 * CHANGE: Updated – Zustand global store with admin auth support
 * REASON: Added user profiles, role-based access, sign-in/sign-out for admin accounts
 * DATE: 2026-04-14
 */
import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { UserVotes, UserProfile, UserRole } from '../types';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

export type Theme = 'dark' | 'light';

interface AppState {
  /** Current Firebase Auth user (anonymous or signed-in) */
  user: User | null;
  setUser: (user: User | null) => void;

  /** User profile from Firestore (includes role, status, etc.) */
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;

  /** User's custom claims (includes role) */
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;

  /** Convenience role checks */
  isAdmin: () => boolean;
  isModerator: () => boolean;

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

  /** Theme preference */
  theme: Theme;
  toggleTheme: () => void;

  /** Bookmarked topic IDs */
  bookmarks: Set<string>;
  toggleBookmark: (topicId: string) => void;
  isBookmarked: (topicId: string) => boolean;
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

// Restore theme preference
const loadTheme = (): Theme => {
  try {
    const saved = localStorage.getItem('polyvote_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    // Default to system preference
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  } catch { /* ignore */ }
  return 'dark';
};

// Restore bookmarks
const loadBookmarks = (): Set<string> => {
  try {
    const raw = localStorage.getItem('polyvote_bookmarks');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

// Apply theme class to document root
const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle('light', theme === 'light');
};

export const useStore = create<AppState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),

  userProfile: null,
  setUserProfile: (profile) => set({ userProfile: profile }),

  userRole: 'user',
  setUserRole: (role) => set({ userRole: role }),

  isAdmin: () => get().userRole === 'admin',
  isModerator: () => get().userRole === 'moderator' || get().userRole === 'admin',

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

  theme: loadTheme(),
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('polyvote_theme', next);
      applyTheme(next);
      return { theme: next };
    }),

  bookmarks: loadBookmarks(),
  toggleBookmark: (topicId) =>
    set((s) => {
      const next = new Set(s.bookmarks);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      localStorage.setItem('polyvote_bookmarks', JSON.stringify([...next]));
      return { bookmarks: next };
    }),
  isBookmarked: (topicId) => get().bookmarks.has(topicId),
}));

// Apply theme on initial load
applyTheme(loadTheme());
