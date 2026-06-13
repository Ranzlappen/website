/**
 * Multiplayer sync abstraction.
 *
 * Game logic never imports a backend. It talks to a {@link SyncAdapter}, of
 * which there are two implementations: a zero-config {@link LocalSyncAdapter}
 * (cross-tab via BroadcastChannel + localStorage) and an optional Firebase
 * Realtime Database adapter. The app picks one at runtime via
 * `getSyncAdapter()`, so swapping or adding backends never touches the engine
 * or the games.
 */
import type { MatchState } from '../engine';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomPlayer {
  id: string;
  name: string;
  seat: number;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface RoomMeta {
  roomId: string;
  gameId: string;
  hostId: string;
  status: RoomStatus;
  players: RoomPlayer[];
  createdAt: number;
}

export interface CreateRoomOptions {
  gameId: string;
  host: { id: string; name: string };
}

export interface JoinInfo {
  id: string;
  name: string;
}

/** Backend-agnostic contract for lobby + state synchronization. */
export interface SyncAdapter {
  /** A short, human-shareable label for the backend (shown in the UI). */
  readonly kind: 'local' | 'firebase';

  createRoom(opts: CreateRoomOptions): Promise<RoomMeta>;
  joinRoom(roomId: string, player: JoinInfo): Promise<RoomMeta>;
  leaveRoom(roomId: string, playerId: string): Promise<void>;

  setReady(roomId: string, playerId: string, ready: boolean): Promise<void>;
  setPresence(roomId: string, playerId: string, connected: boolean): Promise<void>;
  setStatus(roomId: string, status: RoomStatus): Promise<void>;

  /** Publish an authoritative match state. Newer versions win. */
  pushState(roomId: string, state: MatchState): Promise<void>;

  /** Subscribe to room metadata changes. Returns an unsubscribe function. */
  subscribeRoom(roomId: string, cb: (room: RoomMeta | null) => void): () => void;
  /** Subscribe to match-state changes. Returns an unsubscribe function. */
  subscribeState(
    roomId: string,
    cb: (state: MatchState | null) => void,
  ): () => void;
}

/** Generate a short, friendly room code (e.g. "K7QM"). */
export function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
