import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../hooks/useStore';

describe('useStore', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store to defaults
    useStore.setState({
      votedMap: {},
      toasts: [],
      theme: 'dark',
      bookmarks: new Set(),
      userRole: 'user',
      user: null,
      userProfile: null,
    });
  });

  describe('voting', () => {
    it('records a vote and persists to localStorage', () => {
      const { recordVote } = useStore.getState();
      recordVote('topic-1', 'metric-a', 'choice-x');

      const { votedMap } = useStore.getState();
      expect(votedMap['topic-1']).toEqual({ 'metric-a': 'choice-x' });
      expect(JSON.parse(localStorage.getItem('polyvote_votes')!)).toEqual({
        'topic-1': { 'metric-a': 'choice-x' },
      });
    });

    it('hasVoted returns true after voting', () => {
      const { recordVote } = useStore.getState();
      recordVote('topic-1', 'metric-a', 'choice-x');

      expect(useStore.getState().hasVoted('topic-1', 'metric-a')).toBe(true);
      expect(useStore.getState().hasVoted('topic-1', 'metric-b')).toBe(false);
    });

    it('allows changing a vote on the same metric', () => {
      const { recordVote } = useStore.getState();
      recordVote('topic-1', 'metric-a', 'choice-x');
      recordVote('topic-1', 'metric-a', 'choice-y');

      const { votedMap } = useStore.getState();
      expect(votedMap['topic-1']['metric-a']).toBe('choice-y');
    });

    it('supports multiple topics independently', () => {
      const { recordVote } = useStore.getState();
      recordVote('topic-1', 'metric-a', 'choice-x');
      recordVote('topic-2', 'metric-a', 'choice-z');

      const { votedMap } = useStore.getState();
      expect(votedMap['topic-1']['metric-a']).toBe('choice-x');
      expect(votedMap['topic-2']['metric-a']).toBe('choice-z');
    });
  });

  describe('theme', () => {
    it('toggles between dark and light', () => {
      expect(useStore.getState().theme).toBe('dark');

      useStore.getState().toggleTheme();
      expect(useStore.getState().theme).toBe('light');
      expect(localStorage.getItem('polyvote_theme')).toBe('light');

      useStore.getState().toggleTheme();
      expect(useStore.getState().theme).toBe('dark');
    });
  });

  describe('bookmarks', () => {
    it('toggles bookmark on and off', () => {
      const { toggleBookmark } = useStore.getState();

      toggleBookmark('topic-1');
      expect(useStore.getState().isBookmarked('topic-1')).toBe(true);

      toggleBookmark('topic-1');
      expect(useStore.getState().isBookmarked('topic-1')).toBe(false);
    });

    it('persists bookmarks to localStorage', () => {
      useStore.getState().toggleBookmark('topic-1');
      useStore.getState().toggleBookmark('topic-2');

      const saved = JSON.parse(localStorage.getItem('polyvote_bookmarks')!);
      expect(saved).toContain('topic-1');
      expect(saved).toContain('topic-2');
    });
  });

  describe('toasts', () => {
    it('adds and removes toasts', () => {
      useStore.getState().addToast('Hello', 'success');
      expect(useStore.getState().toasts).toHaveLength(1);
      expect(useStore.getState().toasts[0].text).toBe('Hello');
      expect(useStore.getState().toasts[0].type).toBe('success');

      const id = useStore.getState().toasts[0].id;
      useStore.getState().removeToast(id);
      expect(useStore.getState().toasts).toHaveLength(0);
    });

    it('defaults toast type to info', () => {
      useStore.getState().addToast('Notice');
      expect(useStore.getState().toasts[0].type).toBe('info');
    });
  });

  describe('roles', () => {
    it('defaults to user role', () => {
      expect(useStore.getState().userRole).toBe('user');
      expect(useStore.getState().isAdmin()).toBe(false);
      expect(useStore.getState().isModerator()).toBe(false);
    });

    it('isAdmin returns true for admin role', () => {
      useStore.getState().setUserRole('admin');
      expect(useStore.getState().isAdmin()).toBe(true);
      expect(useStore.getState().isModerator()).toBe(true);
    });

    it('isModerator returns true for moderator role', () => {
      useStore.getState().setUserRole('moderator');
      expect(useStore.getState().isModerator()).toBe(true);
      expect(useStore.getState().isAdmin()).toBe(false);
    });
  });
});
