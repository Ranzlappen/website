/**
 * React bindings for the engine. `useMatchState` subscribes a component to a
 * MatchClient via `useSyncExternalStore`; `useResolveLocalClient` rehydrates a
 * client for a saved match id (creating one from storage on a fresh load).
 */
import { useEffect, useRef, useState } from 'react';
import { useSyncExternalStore } from 'react';
import { MatchClient, getGame, type MatchState } from '../engine';
import { loadMatch } from '../storage/local';
import { useUiStore } from './store';

export function useMatchState<G>(client: MatchClient<G>): MatchState<G> {
  return useSyncExternalStore(client.subscribe, client.getState);
}

/**
 * Returns `true` briefly each time `value` changes to a non-null value — used to
 * trigger the dice roll animation only on an actual roll rather than every
 * render.
 */
export function useRollFlash(value: unknown, ms = 500): boolean {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value && value != null) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), ms);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value, ms]);
  return flash;
}

export function useMatchError(client: MatchClient): string | null {
  return useSyncExternalStore(client.subscribe, client.getError);
}

/**
 * Resolve the live MatchClient for a local match id: reuse the in-memory client
 * if present (navigation), otherwise reconstruct it from the persisted save.
 * Returns null when no such save exists (the caller renders not-found).
 */
export function useResolveLocalClient(matchId: string): MatchClient | null {
  const registerClient = useUiStore((s) => s.registerClient);
  const getClient = useUiStore((s) => s.getClient);
  const [client] = useState<MatchClient | null>(() => {
    const existing = getClient(matchId);
    if (existing) return existing;
    const state = loadMatch(matchId);
    if (!state) return null;
    const def = getGame(state.gameId);
    if (!def) return null;
    const c = new MatchClient(def, state);
    registerClient(matchId, c);
    return c;
  });
  return client;
}
