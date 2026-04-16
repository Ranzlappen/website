import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { BlogDraft, UserRole } from './types';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface Store {
  // Auth
  user: User | null;
  userRole: UserRole;
  authLoading: boolean;
  setUser: (user: User | null) => void;
  setUserRole: (role: UserRole) => void;
  setAuthLoading: (loading: boolean) => void;
  isAuthor: () => boolean;
  isAdmin: () => boolean;

  // Drafts
  drafts: BlogDraft[];
  setDrafts: (drafts: BlogDraft[]) => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useStore = create<Store>((set, get) => ({
  // Auth
  user: null,
  userRole: 'user',
  authLoading: true,
  setUser: (user) => set({ user }),
  setUserRole: (userRole) => set({ userRole }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  isAuthor: () => {
    const role = get().userRole;
    return role === 'author' || role === 'moderator' || role === 'admin';
  },
  isAdmin: () => get().userRole === 'admin',

  // Drafts
  drafts: [],
  setDrafts: (drafts) => set({ drafts }),

  // Toasts
  toasts: [],
  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
