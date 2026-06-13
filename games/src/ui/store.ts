/**
 * UI store (Zustand). Holds lightweight, app-wide UI state: the active theme,
 * the player's display name, and an in-memory registry of live MatchClients so
 * navigating between routes keeps a local game alive. Match *state* itself is
 * persisted by the storage layer, not here.
 */
import { create } from 'zustand';
import type { MatchClient } from '../engine';
import { applyTheme, loadTheme, type ThemeId } from './theme';

const NAME_KEY = 'tabletop:player-name';

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || 'Player';
  } catch {
    return 'Player';
  }
}

interface UiState {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  playerName: string;
  setPlayerName: (n: string) => void;
  /** In-memory live clients keyed by match id (not serialized). */
  clients: Record<string, MatchClient>;
  registerClient: (id: string, client: MatchClient) => void;
  getClient: (id: string) => MatchClient | undefined;
  dropClient: (id: string) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: loadTheme(),
  setTheme: (t) => {
    applyTheme(t);
    set({ theme: t });
  },
  playerName: loadName(),
  setPlayerName: (n) => {
    const name = n.trim() || 'Player';
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* ignore */
    }
    set({ playerName: name });
  },
  clients: {},
  registerClient: (id, client) =>
    set((s) => ({ clients: { ...s.clients, [id]: client } })),
  getClient: (id) => get().clients[id],
  dropClient: (id) =>
    set((s) => {
      const next = { ...s.clients };
      delete next[id];
      return { clients: next };
    }),
}));
