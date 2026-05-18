import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { FolderDoc, ItemDoc, UserRole } from './types';

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
  isAdmin: () => boolean;

  // Folders (cached)
  folders: FolderDoc[];
  setFolders: (folders: FolderDoc[]) => void;
  upsertFolder: (folder: FolderDoc) => void;
  removeFolders: (folderIds: string[]) => void;

  // Items (cached, scoped to currently-open folder)
  items: ItemDoc[];
  setItems: (items: ItemDoc[]) => void;
  upsertItem: (item: ItemDoc) => void;
  removeItem: (itemId: string) => void;

  // Selection (for bulk actions)
  selectedItemIds: Set<string>;
  toggleSelected: (id: string) => void;
  setSelected: (ids: Set<string>) => void;
  clearSelected: () => void;

  // Toasts
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useStore = create<Store>((set, get) => ({
  user: null,
  userRole: 'user',
  authLoading: true,
  setUser: (user) => set({ user }),
  setUserRole: (userRole) => set({ userRole }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  isAdmin: () => get().userRole === 'admin',

  folders: [],
  setFolders: (folders) => set({ folders }),
  upsertFolder: (folder) =>
    set((s) => {
      const i = s.folders.findIndex((f) => f.id === folder.id);
      if (i === -1) return { folders: [...s.folders, folder] };
      const next = s.folders.slice();
      next[i] = folder;
      return { folders: next };
    }),
  removeFolders: (folderIds) =>
    set((s) => ({ folders: s.folders.filter((f) => !folderIds.includes(f.id)) })),

  items: [],
  setItems: (items) => set({ items }),
  upsertItem: (item) =>
    set((s) => {
      const i = s.items.findIndex((it) => it.id === item.id);
      if (i === -1) return { items: [item, ...s.items] };
      const next = s.items.slice();
      next[i] = item;
      return { items: next };
    }),
  removeItem: (itemId) =>
    set((s) => ({ items: s.items.filter((it) => it.id !== itemId) })),

  selectedItemIds: new Set(),
  toggleSelected: (id) =>
    set((s) => {
      const next = new Set(s.selectedItemIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedItemIds: next };
    }),
  setSelected: (ids) => set({ selectedItemIds: ids }),
  clearSelected: () => set({ selectedItemIds: new Set() }),

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
