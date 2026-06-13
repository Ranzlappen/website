/**
 * FirebaseSyncAdapter — Realtime Database implementation of {@link SyncAdapter}.
 *
 * Implements the identical contract as the local adapter, so the lobby and
 * online-play UI are backend-agnostic. The `firebase/database` SDK is imported
 * dynamically so it stays out of the main bundle until Firebase multiplayer is
 * actually used. Presence is wired through `onDisconnect` so a closed tab marks
 * the player disconnected automatically (enabling reconnect/resume).
 */
import type { MatchState } from '../engine';
import {
  makeRoomCode,
  type CreateRoomOptions,
  type JoinInfo,
  type RoomMeta,
  type RoomStatus,
  type SyncAdapter,
} from './adapter';
import { getFirebaseApp } from './firebaseClient';

const ROOMS = 'games-rooms';
const STATES = 'games-states';

type Db = import('firebase/database').Database;

export class FirebaseSyncAdapter implements SyncAdapter {
  readonly kind = 'firebase' as const;
  private dbPromise: Promise<Db> | null = null;

  private async db(): Promise<Db> {
    if (!this.dbPromise) {
      this.dbPromise = import('firebase/database').then(({ getDatabase }) =>
        getDatabase(getFirebaseApp()),
      );
    }
    return this.dbPromise;
  }

  private async mod() {
    return import('firebase/database');
  }

  async createRoom(opts: CreateRoomOptions): Promise<RoomMeta> {
    const { ref, get, set } = await this.mod();
    const db = await this.db();
    let roomId = makeRoomCode();
    while ((await get(ref(db, `${ROOMS}/${roomId}`))).exists()) {
      roomId = makeRoomCode();
    }
    const room: RoomMeta = {
      roomId,
      gameId: opts.gameId,
      hostId: opts.host.id,
      status: 'lobby',
      createdAt: Date.now(),
      players: [
        {
          id: opts.host.id,
          name: opts.host.name,
          seat: 0,
          ready: false,
          connected: true,
          isHost: true,
        },
      ],
    };
    await set(ref(db, `${ROOMS}/${roomId}`), room);
    return room;
  }

  async joinRoom(roomId: string, player: JoinInfo): Promise<RoomMeta> {
    const { ref, get, set } = await this.mod();
    const db = await this.db();
    const snap = await get(ref(db, `${ROOMS}/${roomId}`));
    if (!snap.exists()) throw new Error(`Room ${roomId} not found.`);
    const room = snap.val() as RoomMeta;
    room.players = room.players ?? [];
    if (room.status !== 'lobby' && !room.players.some((p) => p.id === player.id)) {
      throw new Error('That game has already started.');
    }
    if (!room.players.some((p) => p.id === player.id)) {
      room.players.push({
        id: player.id,
        name: player.name,
        seat: room.players.length,
        ready: false,
        connected: true,
        isHost: false,
      });
      await set(ref(db, `${ROOMS}/${roomId}`), room);
    }
    return room;
  }

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    const { ref, get, set, remove } = await this.mod();
    const db = await this.db();
    const snap = await get(ref(db, `${ROOMS}/${roomId}`));
    if (!snap.exists()) return;
    const room = snap.val() as RoomMeta;
    room.players = (room.players ?? []).filter((p) => p.id !== playerId);
    if (room.players.length === 0) {
      await remove(ref(db, `${ROOMS}/${roomId}`));
      await remove(ref(db, `${STATES}/${roomId}`));
      return;
    }
    if (!room.players.some((p) => p.isHost)) room.players[0].isHost = true;
    await set(ref(db, `${ROOMS}/${roomId}`), room);
  }

  private async patchPlayer(
    roomId: string,
    playerId: string,
    patch: Partial<RoomMeta['players'][number]>,
  ) {
    const { ref, get, set } = await this.mod();
    const db = await this.db();
    const snap = await get(ref(db, `${ROOMS}/${roomId}`));
    if (!snap.exists()) return;
    const room = snap.val() as RoomMeta;
    room.players = (room.players ?? []).map((p) =>
      p.id === playerId ? { ...p, ...patch } : p,
    );
    await set(ref(db, `${ROOMS}/${roomId}`), room);
  }

  async setReady(roomId: string, playerId: string, ready: boolean) {
    await this.patchPlayer(roomId, playerId, { ready });
  }

  async setPresence(roomId: string, playerId: string, connected: boolean) {
    const { ref, onDisconnect } = await this.mod();
    const db = await this.db();
    await this.patchPlayer(roomId, playerId, { connected });
    if (connected) {
      // Best-effort: when this client drops, flip its flag automatically so
      // peers see the disconnect and can offer reconnect/resume.
      const seat = await this.seatOf(roomId, playerId);
      if (seat >= 0) {
        onDisconnect(
          ref(db, `${ROOMS}/${roomId}/players/${seat}/connected`),
        ).set(false);
      }
    }
  }

  private async seatOf(roomId: string, playerId: string): Promise<number> {
    const { ref, get } = await this.mod();
    const db = await this.db();
    const snap = await get(ref(db, `${ROOMS}/${roomId}`));
    if (!snap.exists()) return -1;
    const room = snap.val() as RoomMeta;
    return (room.players ?? []).findIndex((p) => p.id === playerId);
  }

  async setStatus(roomId: string, status: RoomStatus) {
    const { ref, update } = await this.mod();
    const db = await this.db();
    await update(ref(db, `${ROOMS}/${roomId}`), { status });
  }

  async pushState(roomId: string, state: MatchState): Promise<void> {
    const { ref, get, set } = await this.mod();
    const db = await this.db();
    const snap = await get(ref(db, `${STATES}/${roomId}`));
    if (snap.exists() && (snap.val() as MatchState).version > state.version) return;
    await set(ref(db, `${STATES}/${roomId}`), state);
  }

  subscribeRoom(roomId: string, cb: (room: RoomMeta | null) => void): () => void {
    let off = () => {};
    this.mod().then(async ({ ref, onValue }) => {
      const db = await this.db();
      off = onValue(ref(db, `${ROOMS}/${roomId}`), (snap) => {
        cb(snap.exists() ? (snap.val() as RoomMeta) : null);
      });
    });
    return () => off();
  }

  subscribeState(
    roomId: string,
    cb: (state: MatchState | null) => void,
  ): () => void {
    let off = () => {};
    this.mod().then(async ({ ref, onValue }) => {
      const db = await this.db();
      off = onValue(ref(db, `${STATES}/${roomId}`), (snap) => {
        cb(snap.exists() ? (snap.val() as MatchState) : null);
      });
    });
    return () => off();
  }
}
