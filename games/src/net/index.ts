/**
 * Network layer entry point. Chooses a {@link SyncAdapter} at runtime:
 * Firebase Realtime Database when it's both configured and explicitly enabled,
 * otherwise the always-available local cross-tab adapter. The choice is
 * memoized; the rest of the app just calls `getSyncAdapter()`.
 */
import { LocalSyncAdapter } from './local';
import { FirebaseSyncAdapter } from './firebase';
import { isFirebaseConfigured } from './firebaseClient';
import type { SyncAdapter } from './adapter';

export * from './adapter';

const MODE_KEY = 'tabletop:net-mode';
export type NetMode = 'local' | 'firebase';

let cached: SyncAdapter | null = null;

/** The user-selected / persisted networking mode. */
export function getNetMode(): NetMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'firebase' ? 'firebase' : 'local';
  } catch {
    return 'local';
  }
}

export function setNetMode(mode: NetMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
  cached = null;
}

/** Whether Firebase multiplayer can actually be used right now. */
export function firebaseAvailable(): boolean {
  return isFirebaseConfigured();
}

/** Resolve the active sync adapter (memoized). */
export function getSyncAdapter(): SyncAdapter {
  if (cached) return cached;
  if (getNetMode() === 'firebase' && firebaseAvailable()) {
    cached = new FirebaseSyncAdapter();
  } else {
    cached = new LocalSyncAdapter();
  }
  return cached;
}
