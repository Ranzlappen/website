/**
 * Multiplayer sync abstraction.
 *
 * Game logic never imports a backend. It talks to a {@link SyncAdapter}, of
 * which there are two implementations: a zero-config {@link LocalSyncAdapter}
 * (cross-tab via BroadcastChannel + localStorage) and an optional Firebase
 * Realtime Database adapter. The app picks one at runtime via
 * `getSyncAdapter()`, so swapping or adding backends never touches the engine
 * or the games.
 *
 * The model is **host-authoritative**: non-host clients submit *actions*
 * (not full states) via {@link SyncAdapter.submitAction}; the host validates
 * and applies them, then publishes the resulting state — optionally a
 * per-viewer redacted copy so hidden information never reaches a peer.
 */
import type { GameAction, MatchState } from '../engine';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomPlayer {
  id: string;
  name: string;
  seat: number;
  ready: boolean;
  /** Derived from the room's presence map; do not write directly. */
  connected: boolean;
  isHost: boolean;
}

export interface RoomMeta {
  roomId: string;
  gameId: string;
  hostId: string;
  status: RoomStatus;
  players: RoomPlayer[];
  /** Liveness keyed by player id; merged into `players[].connected`. */
  presence?: Record<string, boolean>;
  createdAt: number;
}

/** A submitted action awaiting the host's application. */
export interface ActionEnvelope {
  id: string;
  playerId: string;
  action: GameAction;
  at: number;
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

  /**
   * Publish an authoritative match state. Newer versions win. Pass `viewerId`
   * to write a per-player slot (the redacted view for that player); omit it to
   * write the single shared slot. Only the host should call this.
   */
  pushState(roomId: string, state: MatchState, viewerId?: string): Promise<void>;

  /** Non-host clients submit an action for the host to apply. */
  submitAction(roomId: string, playerId: string, action: GameAction): Promise<void>;
  /** Acknowledge (remove) a processed action by id. The host calls this. */
  ackAction(roomId: string, actionId: string): Promise<void>;

  /** Subscribe to room metadata changes. Returns an unsubscribe function. */
  subscribeRoom(roomId: string, cb: (room: RoomMeta | null) => void): () => void;
  /**
   * Subscribe to match-state changes. With `viewerId`, reads that player's slot
   * (falling back to the shared slot); without it, reads the shared slot.
   */
  subscribeState(
    roomId: string,
    cb: (state: MatchState | null) => void,
    viewerId?: string,
  ): () => void;
  /** Subscribe to the pending action queue (host consumes it). */
  subscribeActions(
    roomId: string,
    cb: (pending: ActionEnvelope[]) => void,
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

/** Merge a room's presence map into its players' `connected` flags. */
export function withPresence(room: RoomMeta): RoomMeta {
  const presence = room.presence ?? {};
  return {
    ...room,
    players: (room.players ?? []).map((p) => ({
      ...p,
      connected: presence[p.id] ?? false,
    })),
  };
}

/** A short unique id for action envelopes. */
export function actionId(): string {
  return (
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14)) + Date.now().toString(36)
  );
}
