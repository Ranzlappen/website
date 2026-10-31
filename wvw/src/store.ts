/**
 * App state (Zustand): auth session, the member's own doc, display time zone
 * and toasts. The member doc is live (onSnapshot), so verification, relink
 * re-checks and role changes show up without a reload.
 */
import { create } from 'zustand';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { auth, firestore } from './firebase';
import type { MemberDoc } from './shared/types';
import { browserTimeZone } from './lib/format';
import { isValidTimeZone } from './shared/time';

export interface Toast {
  id: number;
  kind: 'ok' | 'error' | 'info';
  text: string;
}

interface State {
  uid: string | null;
  authReady: boolean;
  member: MemberDoc | null;
  memberReady: boolean;
  displayTz: string;
  toasts: Toast[];
  setDisplayTz: (tz: string) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
  signOut: () => Promise<void>;
}

const TZ_KEY = 'wvw.displayTz';

function initialTz(): string {
  try {
    const saved = localStorage.getItem(TZ_KEY);
    if (saved && isValidTimeZone(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  return browserTimeZone();
}

let toastId = 0;

export const useStore = create<State>((set, get) => ({
  uid: null,
  authReady: false,
  member: null,
  memberReady: false,
  displayTz: initialTz(),
  toasts: [],
  setDisplayTz: (tz) => {
    if (!isValidTimeZone(tz)) return;
    try {
      localStorage.setItem(TZ_KEY, tz);
    } catch {
      /* ignore */
    }
    set({ displayTz: tz });
  },
  toast: (text, kind = 'info') => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 7000 : 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  signOut: async () => {
    await fbSignOut(auth);
  },
}));

let memberUnsub: Unsubscribe | null = null;

onAuthStateChanged(auth, (user) => {
  memberUnsub?.();
  memberUnsub = null;
  if (!user || !user.uid.startsWith('wvw-discord-')) {
    useStore.setState({ uid: null, authReady: true, member: null, memberReady: true });
    return;
  }
  useStore.setState({ uid: user.uid, authReady: true, memberReady: false });
  memberUnsub = onSnapshot(
    doc(firestore, 'wvwMembers', user.uid),
    (snap) => {
      const member = snap.exists() ? (snap.data() as MemberDoc) : null;
      useStore.setState({ member, memberReady: true });
      // Adopt the member's saved time zone once, unless the visitor picked one.
      const tz = member?.prefs?.timezone;
      if (tz && isValidTimeZone(tz)) {
        try {
          if (!localStorage.getItem(TZ_KEY)) useStore.setState({ displayTz: tz });
        } catch {
          /* ignore */
        }
      }
    },
    () => useStore.setState({ member: null, memberReady: true }),
  );
});

/** Convenience selectors. */
export const isVerified = (m: MemberDoc | null) => !!m && m.verified && !m.stale && m.teamId != null;
export const isMod = (m: MemberDoc | null) => !!m && (m.role === 'mod' || m.role === 'admin');
export const isAdmin = (m: MemberDoc | null) => !!m && m.role === 'admin';
