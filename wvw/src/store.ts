/**
 * App state (Zustand): auth session, the member's own doc, display time zone
 * and toasts. The member doc is live (onSnapshot), so verification, relink
 * re-checks and role changes show up without a reload.
 */
import { create } from 'zustand';
import { onAuthStateChanged, signInWithCustomToken, signOut as fbSignOut } from 'firebase/auth';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { auth, call, errorMessage, firestore } from './firebase';
import {
  clearDevice,
  deviceLabel,
  isSignedOut,
  loadDevice,
  markSignedOut,
  rememberPref,
  requestPersistentStorage,
  saveDevice,
  type RememberedDevice,
} from './lib/device';
import type { MemberDoc } from './shared/types';
import { browserTimeZone, setFormatLocale } from './lib/format';
import { initialLang, LANG_KEY, type Lang } from './i18n/lang';
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
  /** UI language (persisted in localStorage `wvw.lang`, default from the browser). */
  lang: Lang;
  toasts: Toast[];
  /** Signing in with the remembered device right now. */
  resuming: boolean;
  /** This browser's remembered-device token (lib/device.ts), mirrored from localStorage. */
  device: RememberedDevice | null;
  /** Revoke this browser's device token (server + local). */
  forgetThisDevice: () => Promise<void>;
  /** Issue a device token now (after re-ticking "Remember me"). */
  rememberThisDevice: () => Promise<void>;
  setDisplayTz: (tz: string) => void;
  setLang: (lang: Lang) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
  /** `forget`: also revoke this browser's remembered-device token. */
  signOut: (opts?: { forget?: boolean }) => Promise<void>;
  /** One-click sign-in with the remembered device → null on success, else a readable error. */
  resume: () => Promise<string | null>;
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
const startLang = initialLang();
setFormatLocale(startLang);

export const useStore = create<State>((set, get) => ({
  uid: null,
  authReady: false,
  member: null,
  memberReady: false,
  displayTz: initialTz(),
  lang: startLang,
  toasts: [],
  resuming: false,
  device: loadDevice(),
  forgetThisDevice: async () => {
    const d = loadDevice();
    storeDevice(null);
    if (d) await call('forgetDevice', { deviceToken: d.token }).catch(() => {});
  },
  rememberThisDevice: async () => {
    const { uid, member } = get();
    if (uid) await ensureDevice(uid, member);
  },
  setDisplayTz: (tz) => {
    if (!isValidTimeZone(tz)) return;
    try {
      localStorage.setItem(TZ_KEY, tz);
    } catch {
      /* ignore */
    }
    set({ displayTz: tz });
  },
  setLang: (lang) => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
    setFormatLocale(lang);
    document.documentElement.lang = lang;
    set({ lang });
  },
  toast: (text, kind = 'info') => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 7000 : 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  signOut: async (opts) => {
    if (opts?.forget) await get().forgetThisDevice();
    // Before signing out, so no tab silently resumes the session again.
    markSignedOut(true);
    await fbSignOut(auth);
  },
  resume: async () => {
    const d = loadDevice();
    if (!d) return 'This device is no longer remembered — sign in with your API key.';
    set({ resuming: true });
    try {
      const r = await call<{ token: string; accountName: string | null }>('resumeDevice', { deviceToken: d.token });
      storeDevice({ ...d, accountName: r.accountName ?? d.accountName });
      markSignedOut(false);
      await signInWithCustomToken(auth, r.token);
      return null;
    } catch (e) {
      // Revoked / expired / banned → forget it here too; network trouble → keep it for next time.
      const code = String((e as { code?: string })?.code ?? '');
      if (/unauthenticated|permission-denied|invalid-argument/.test(code)) storeDevice(null);
      return errorMessage(e);
    } finally {
      set({ resuming: false, authReady: true });
    }
  },
}));

/** Write the device record to localStorage and the store together. */
function storeDevice(d: RememberedDevice | null): void {
  if (d) saveDevice(d);
  else clearDevice();
  useStore.setState({ device: d });
}

/**
 * Signed in with a GW2 account → make sure this browser holds a device token
 * for it (unless the member opted out), and ask for persistent storage.
 */
let ensuring = false;
async function ensureDevice(uid: string, member: MemberDoc | null): Promise<void> {
  if (!member || ensuring || !uid.startsWith('wvw-gw2-')) return;
  void requestPersistentStorage();
  const d = loadDevice();
  if (d && d.uid === uid) {
    if (member.accountName && d.accountName !== member.accountName) storeDevice({ ...d, accountName: member.accountName });
    return;
  }
  ensuring = true;
  try {
    // Another account's token on this browser (someone else signed in) → revoke it.
    if (d) await useStore.getState().forgetThisDevice();
    if (!rememberPref()) return;
    const r = await call<{ deviceToken: string }>('rememberDevice', { label: deviceLabel() });
    storeDevice({ token: r.deviceToken, uid, accountName: member.accountName ?? null, savedAt: Date.now() });
  } catch {
    /* backend unreachable — retried on the next load */
  } finally {
    ensuring = false;
  }
}

/** Only one silent resume attempt per page load. */
let autoResumeTried = false;

let memberUnsub: Unsubscribe | null = null;

onAuthStateChanged(auth, (user) => {
  memberUnsub?.();
  memberUnsub = null;
  if (!user || !user.uid.startsWith('wvw-')) {
    // Session gone but this device is remembered and nobody pressed "Sign out"
    // (cleared storage, revoked refresh token, …) → quietly sign back in.
    if (!autoResumeTried && loadDevice() && !isSignedOut()) {
      autoResumeTried = true;
      useStore.setState({ uid: null, member: null, memberReady: true, authReady: false });
      void useStore.getState().resume();
      return;
    }
    useStore.setState({ uid: null, authReady: true, member: null, memberReady: true });
    return;
  }
  markSignedOut(false);
  useStore.setState({ uid: user.uid, authReady: true, memberReady: false });
  memberUnsub = onSnapshot(
    doc(firestore, 'wvwMembers', user.uid),
    (snap) => {
      const member = snap.exists() ? (snap.data() as MemberDoc) : null;
      useStore.setState({ member, memberReady: true });
      void ensureDevice(user.uid, member);
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
