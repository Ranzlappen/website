import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { firestore } from '../firebase';
import type {
  Color,
  GuildDirDoc,
  GuildIndexRow,
  PublicConfig,
  PublicEvent,
  PublicEventIndex,
  PublicLive,
  PublicMatches,
  PublicRelink,
  PublicRun,
  TeamIndex,
} from '../shared/types';
import { COLORS } from '../shared/types';
import { isAdmin, isVerified, useStore } from '../store';
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
export const useRelink = () => useDocLive<PublicRelink>('wvwPublic/relink');
export const useGuild = (id: string | undefined) => useDocLive<GuildDirDoc>(id ? `wvwGuildDir/${id}` : null);
export const useRun = (id: string | undefined) => useDocLive<PublicRun>(id ? `wvwRuns/${id}` : null);

/**
 * The private tier of the viewer's own team (map third, goals, voice …).
 * Firestore rules only allow verified members of that team — others get null.
 */
const multiSnaps = new Map<string, unknown[]>();

/** Live data of several docs at once (shared listeners, stable array identity). */
export function useDocsLive<T>(paths: string[]): (T | null)[] {
  const key = paths.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => paths, [key]);
  const sub = useCallback(
    (cb: () => void) => {
      const unsubs = list.map((p) => subscribe<T>(p, cb));
      return () => unsubs.forEach((u) => u());
    },
    [list],
  );
  const snap = useCallback(() => {
    const datas = list.map((p) => entryFor<T>(p).data);
    const prev = multiSnaps.get(key) as (T | null)[] | undefined;
    if (prev && prev.length === datas.length && prev.every((d, i) => d === datas[i])) return prev;
    multiSnaps.set(key, datas);
    return datas;
  }, [list, key]);
  return useSyncExternalStore(sub, snap);
}

/**
 * The private tier the viewer may see, merged into one TeamIndex:
 * a verified member → their own team; the admin session → every team in the
 * current matchups (Firestore rules enforce the same). Includes team-only
 * raids (`events`) and the map third / voice / goals of every raid (`details`).
 */
export function useMyTeamIndex(): TeamIndex | null {
  const member = useStore((s) => s.member);
  const { data } = useMatches();
  const admin = isAdmin(member);
  const teamIds = useMemo(() => {
    if (admin) {
      const ids = new Set<number>();
      for (const m of data?.matches ?? []) for (const c of COLORS) if (m.sides[c].teamId) ids.add(m.sides[c].teamId!);
      return [...ids].sort();
    }
    return isVerified(member) && member!.teamId ? [member!.teamId] : [];
  }, [admin, data, member]);
  const docs = useDocsLive<TeamIndex>(teamIds.map((t) => `wvwTeamIndex/${t}`));
  return useMemo(() => {
    const present = docs.filter((d): d is TeamIndex => !!d);
    if (!teamIds.length) return null;
    return {
      updatedAt: Math.max(0, ...present.map((d) => d.updatedAt ?? 0)),
      events: present.flatMap((d) => d.events ?? []),
      details: Object.assign({}, ...present.map((d) => d.details ?? {})),
    };
  }, [docs, teamIds]);
}

/** Public raids of a region + the team-only raids the viewer may see. */
export function useVisibleEvents(region: Region): { events: PublicEvent[]; loading: boolean; error: string | null } {
  const pub = useEventIndex(region);
  const team = useMyTeamIndex();
  const events = useMemo(() => {
    const seen = new Set<string>();
    const out: PublicEvent[] = [];
    for (const e of [...(pub.data?.events ?? []), ...(team?.events ?? []).filter((x) => x.region === region)]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    return out;
  }, [pub.data, team, region]);
  return { events, loading: pub.loading, error: pub.error };
}

/** Team id per colour in the viewer's current matchup + the viewer's own colour. */
export function useMySides(): { sides: Partial<Record<Color, number | null>> | undefined; myColor: Color | null } {
  const member = useStore((s) => s.member);
  const { data } = useMatches();
  const match = member?.teamId ? data?.matches.find((m) => COLORS.some((c) => m.sides[c].teamId === member.teamId)) : undefined;
  if (!match) return { sides: undefined, myColor: null };
  const sides = { red: match.sides.red.teamId, blue: match.sides.blue.teamId, green: match.sides.green.teamId };
  return { sides, myColor: COLORS.find((c) => sides[c] === member!.teamId) ?? null };
}

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
