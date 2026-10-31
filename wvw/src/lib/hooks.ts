import { useEffect, useState, useSyncExternalStore } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { firestore } from '../firebase';
import type {
  GuildDirDoc,
  GuildIndexRow,
  PublicConfig,
  PublicEventIndex,
  PublicLive,
  PublicMatches,
  PublicRun,
} from '../shared/types';
import type { Region } from '../shared/teams';

interface Entry<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  listeners: Set<() => void>;
  unsub: (() => void) | null;
  refs: number;
}

/**
 * Shared live subscription per Firestore doc path: many components reading
 * the same public index doc cost one listener (and one read per change).
 */
const entries = new Map<string, Entry<unknown>>();

function entryFor<T>(path: string): Entry<T> {
  let e = entries.get(path) as Entry<T> | undefined;
  if (!e) {
    e = { data: null, loading: true, error: null, listeners: new Set(), unsub: null, refs: 0 };
    entries.set(path, e as Entry<unknown>);
  }
  return e;
}

function subscribe<T>(path: string, cb: () => void): () => void {
  const e = entryFor<T>(path);
  e.listeners.add(cb);
  e.refs++;
  if (!e.unsub) {
    const [col, id] = path.split('/');
    e.unsub = onSnapshot(
      doc(firestore, col, id),
      (snap) => {
        e.data = snap.exists() ? (snap.data() as T) : null;
        e.loading = false;
        e.error = null;
        e.listeners.forEach((l) => l());
      },
      (err) => {
        e.loading = false;
        e.error = err.message;
        e.listeners.forEach((l) => l());
      },
    );
  }
  return () => {
    e.listeners.delete(cb);
    e.refs--;
    if (e.refs <= 0) {
      // Keep the cache warm briefly so route changes don't refetch.
      setTimeout(() => {
        if (e.refs <= 0 && e.unsub) {
          e.unsub();
          e.unsub = null;
          e.loading = true;
        }
      }, 30_000);
    }
  };
}

const snapshots = new Map<string, { data: unknown; loading: boolean; error: string | null }>();

export function useDocLive<T>(path: string | null): { data: T | null; loading: boolean; error: string | null } {
  const value = useSyncExternalStore(
    (cb) => (path ? subscribe<T>(path, cb) : () => {}),
    () => {
      if (!path) return EMPTY;
      const e = entryFor<T>(path);
      const prev = snapshots.get(path);
      if (prev && prev.data === e.data && prev.loading === e.loading && prev.error === e.error) return prev;
      const next = { data: e.data, loading: e.loading, error: e.error };
      snapshots.set(path, next);
      return next;
    },
  );
  return value as { data: T | null; loading: boolean; error: string | null };
}
const EMPTY = { data: null, loading: false, error: null };

export const useMatches = () => useDocLive<PublicMatches>('wvwPublic/matches');
export const useLive = () => useDocLive<PublicLive & { recent?: PublicRun[] }>('wvwPublic/live');
export const useEventIndex = (region: Region) => useDocLive<PublicEventIndex>(`wvwPublic/events_${region}`);
export const useGuildIndex = (region: Region) =>
  useDocLive<{ updatedAt: number; guilds: GuildIndexRow[] }>(`wvwPublic/guildIndex_${region}`);
export const usePublicConfig = () => useDocLive<PublicConfig>('wvwPublic/config');
export const useGuild = (id: string | undefined) => useDocLive<GuildDirDoc>(id ? `wvwGuildDir/${id}` : null);
export const useRun = (id: string | undefined) => useDocLive<PublicRun>(id ? `wvwRuns/${id}` : null);

/** Team-name overrides from wvwPublic/config. */
export function useTeamNames(): Record<string, string> {
  return usePublicConfig().data?.teamNames ?? {};
}

export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Recent runs of a guild (public collection query). */
export function useGuildRuns(guildId: string | undefined, max = 10): PublicRun[] | null {
  const [runs, setRuns] = useState<PublicRun[] | null>(null);
  useEffect(() => {
    if (!guildId) return;
    const q = query(
      collection(firestore, 'wvwRuns'),
      where('guildId', '==', guildId),
      orderBy('startedAt', 'desc'),
      limit(max),
    );
    return onSnapshot(
      q,
      (snap) => setRuns(snap.docs.map((d) => d.data() as PublicRun)),
      () => setRuns([]),
    );
  }, [guildId, max]);
  return runs;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · WvW Hub` : 'WvW Hub — Guild Wars 2 WvW raid calendar';
  }, [title]);
}
