/**
 * Local save/load of game sessions via `localStorage`. Stored under one key per
 * match plus an index for listing. All values go through the engine's stable
 * serializer so saves survive schema bumps.
 */
import {
  deserializeMatch,
  serializeMatch,
  type MatchState,
} from '../engine';

const PREFIX = 'tabletop:save:';
const INDEX_KEY = 'tabletop:saves';

export interface SaveMeta {
  matchId: string;
  gameId: string;
  savedAt: number;
  players: string[];
  status: string;
}

function readIndex(): SaveMeta[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeIndex(list: SaveMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

/** Persist a match. Overwrites any existing save with the same id. */
export function saveMatch(state: MatchState): void {
  localStorage.setItem(PREFIX + state.matchId, serializeMatch(state));
  const meta: SaveMeta = {
    matchId: state.matchId,
    gameId: state.gameId,
    savedAt: Date.now(),
    players: state.players.map((p) => p.name),
    status: state.status,
  };
  const list = readIndex().filter((m) => m.matchId !== state.matchId);
  list.unshift(meta);
  writeIndex(list);
}

/** Load a match by id, or null if missing/corrupt. */
export function loadMatch<G = unknown>(matchId: string): MatchState<G> | null {
  const raw = localStorage.getItem(PREFIX + matchId);
  if (!raw) return null;
  try {
    return deserializeMatch<G>(raw).state;
  } catch {
    return null;
  }
}

export function listSaves(): SaveMeta[] {
  return readIndex();
}

export function deleteSave(matchId: string): void {
  localStorage.removeItem(PREFIX + matchId);
  writeIndex(readIndex().filter((m) => m.matchId !== matchId));
}
