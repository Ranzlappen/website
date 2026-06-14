/**
 * FirebaseSyncAdapter — Realtime Database implementation of {@link SyncAdapter}.
 *
 * Implements the identical contract as the local adapter, so the lobby and
 * online-play UI are backend-agnostic. The `firebase/database` SDK is imported
 * dynamically so it stays out of the main bundle until Firebase multiplayer is
 * actually used.
 *
 * Concurrency: every room mutation runs inside a `runTransaction` so two
 * simultaneous joins / ready toggles / presence updates can't clobber each
 * other. Presence is keyed by player **id** (not seat index) and wired through
 * `onDisconnect`, so a closed tab marks the right player offline automatically
 * even if the roster reindexes — enabling reconnect/resume.
 */
import type { GameAction, MatchState } from '../engine';
import {
  makeRoomCode,
  withPresence,
  type CreateRoomOptions,
  type JoinInfo,
  type RoomMeta,
  type RoomStatus,
  type SyncAdapter,
} from './adapter';
import { callGames, ensureAnonUid, getFirebaseApp } from './firebaseClient';

const ROOMS = 'games-rooms';
const STATES = 'games-states';

type Db = import('firebase/database').Database;

export class FirebaseSyncAdapter implements SyncAdapter {
  readonly kind = 'firebase' as const;
  // Moves are validated + applied by a Cloud Function; clients never write state.
  readonly serverAuthoritative = true;
  private dbPromise: Promise<Db> | null = null;

  private async db(): Promise<Db> {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        await ensureAnonUid(); // RTDB rules require auth
        const { getDatabase } = await import('firebase/database');
        return getDatabase(getFirebaseApp());
      })();
    }
    return this.dbPromise;
  }

  private async mod() {
    return import('firebase/database');
  }

  async ensureIdentity(): Promise<string> {
    return ensureAnonUid();
  }

  async startMatch(roomId: string): Promise<void> {
    const res = await callGames<{ roomId: string }, { ok: boolean }>(
      'gamesCreateMatch',
      { roomId },
    );
    if (!res.ok) throw new Error('The server could not start the match.');
  }

  async createRoom(opts: CreateRoomOptions): Promise<RoomMeta> {
    const { ref, get, set } = await this.mod();
    const db = await this.db();
    let roomId = makeRoomCode();
    while ((await get(ref(db, `${ROOMS}/${roomId}`))).exists()) roomId = makeRoomCode();
    const room: RoomMeta = {
      roomId,
      gameId: opts.gameId,
      hostId: opts.host.id,
      status: 'lobby',
      createdAt: Date.now(),
      presence: { [opts.host.id]: true },
      players: [
        { id: opts.host.id, name: opts.host.name, seat: 0, ready: false, connected: true, isHost: true },
      ],
    };
    await set(ref(db, `${ROOMS}/${roomId}`), room);
    return withPresence(room);
  }

  /** Atomically mutate a room; `mutate` returns the new room or undefined to abort. */
  private async transactRoom(
    roomId: string,
    mutate: (room: RoomMeta) => RoomMeta | undefined,
  ): Promise<RoomMeta | null> {
    const { ref, runTransaction } = await this.mod();
    const db = await this.db();
    const res = await runTransaction(ref(db, `${ROOMS}/${roomId}`), (current) => {
      if (!current) return current; // room gone → abort, leave as-is
      const next = mutate(current as RoomMeta);
      return next ?? current;
    });
    const val = res.snapshot.val() as RoomMeta | null;
    return val ? withPresence(val) : null;
  }

  async joinRoom(roomId: string, player: JoinInfo): Promise<RoomMeta> {
    const { ref, get } = await this.mod();
    const db = await this.db();
    const snap = await get(ref(db, `${ROOMS}/${roomId}`));
    if (!snap.exists()) throw new Error(`Room ${roomId} not found.`);
    const existing = snap.val() as RoomMeta;
    if (existing.status !== 'lobby' && !(existing.players ?? []).some((p) => p.id === player.id)) {
      throw new Error('That game has already started.');
    }
    const room = await this.transactRoom(roomId, (r) => {
      r.players = r.players ?? [];
      if (!r.players.some((p) => p.id === player.id)) {
        r.players.push({
          id: player.id,
          name: player.name,
          seat: r.players.length,
          ready: false,
          connected: true,
          isHost: false,
        });
        r.presence = { ...r.presence, [player.id]: true };
      }
      return r;
    });
    return room ?? withPresence(existing);
  }

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    const { ref, remove } = await this.mod();
    const db = await this.db();
    const room = await this.transactRoom(roomId, (r) => {
      r.players = (r.players ?? []).filter((p) => p.id !== playerId);
      if (r.presence) delete r.presence[playerId];
      if (r.players.length === 0) return r; // emptied; we remove below
      if (!r.players.some((p) => p.isHost)) r.players[0].isHost = true;
      return r;
    });
    if (room && room.players.length === 0) {
      await remove(ref(db, `${ROOMS}/${roomId}`));
      await remove(ref(db, `${STATES}/${roomId}`));
    }
  }

  async setReady(roomId: string, playerId: string, ready: boolean) {
    await this.transactRoom(roomId, (r) => {
      r.players = (r.players ?? []).map((p) => (p.id === playerId ? { ...p, ready } : p));
      return r;
    });
  }

  async setPresence(roomId: string, playerId: string, connected: boolean) {
    const { ref, onDisconnect } = await this.mod();
    const db = await this.db();
    await this.transactRoom(roomId, (r) => {
      r.presence = { ...r.presence, [playerId]: connected };
      return r;
    });
    if (connected) {
      // Keyed by id, so it stays correct even if the roster reindexes.
      onDisconnect(ref(db, `${ROOMS}/${roomId}/presence/${playerId}`)).set(false);
    }
  }

  async setStatus(roomId: string, status: RoomStatus) {
    await this.transactRoom(roomId, (r) => ({ ...r, status }));
  }

  // State is owned by the server arbiter; clients never write it directly.
  async pushState(): Promise<void> {
    /* no-op: gamesSubmitAction / gamesCreateMatch write state server-side */
  }

  async submitAction(roomId: string, _playerId: string, action: GameAction): Promise<void> {
    // The server derives the actor from the authenticated uid; playerId is
    // ignored. Reject on an illegal move so the UI can surface the reason.
    const res = await callGames<
      { roomId: string; action: GameAction },
      { ok: boolean; error?: string }
    >('gamesSubmitAction', { roomId, action });
    if (!res.ok) throw new Error(res.error ?? 'Move rejected.');
  }

  async ackAction(): Promise<void> {
    /* no-op: there is no client action queue in server-authoritative mode */
  }

  subscribeRoom(roomId: string, cb: (room: RoomMeta | null) => void): () => void {
    let off = () => {};
    this.mod().then(async ({ ref, onValue }) => {
      const db = await this.db();
      off = onValue(ref(db, `${ROOMS}/${roomId}`), (snap) => {
        cb(snap.exists() ? withPresence(snap.val() as RoomMeta) : null);
      });
    });
    return () => off();
  }

  subscribeState(
    roomId: string,
    cb: (state: MatchState | null) => void,
    viewer?: string,
  ): () => void {
    // Clients may read only their own slot (enforced by RTDB rules).
    const slot = viewer ?? '_full';
    let off = () => {};
    this.mod().then(async ({ ref, onValue }) => {
      const db = await this.db();
      off = onValue(ref(db, `${STATES}/${roomId}/${slot}`), (snap) => {
        cb((snap.val() as MatchState | null) ?? null);
      });
    });
    return () => off();
  }

  subscribeActions(): () => void {
    // No client action queue: the server arbiter applies moves directly.
    return () => {};
  }
}
