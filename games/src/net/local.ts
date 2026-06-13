/**
 * LocalSyncAdapter — zero-config multiplayer across tabs/windows of the same
 * browser, backed by localStorage and a BroadcastChannel. It implements the
 * full {@link SyncAdapter} contract (rooms, presence, ready states, authoritative
 * state push) so the lobby and online play work end-to-end with no backend, and
 * the exact same UI lights up unchanged when a Firebase adapter is configured.
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

const ROOM_KEY = (id: string) => `tabletop:room:${id}`;
const STATE_KEY = (id: string) => `tabletop:state:${id}`;

type Msg = { kind: 'room' | 'state'; roomId: string };

export class LocalSyncAdapter implements SyncAdapter {
  readonly kind = 'local' as const;
  private channel: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('tabletop-sync')
      : null;
  private roomSubs = new Map<string, Set<(r: RoomMeta | null) => void>>();
  private stateSubs = new Map<string, Set<(s: MatchState | null) => void>>();

  constructor() {
    this.channel?.addEventListener('message', (e: MessageEvent<Msg>) => {
      this.fan(e.data);
    });
    // localStorage `storage` events fire in *other* tabs — a robust backup to
    // BroadcastChannel and the path that makes this work across windows.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key?.startsWith('tabletop:room:')) {
          this.fan({ kind: 'room', roomId: e.key.slice('tabletop:room:'.length) });
        } else if (e.key?.startsWith('tabletop:state:')) {
          this.fan({ kind: 'state', roomId: e.key.slice('tabletop:state:'.length) });
        }
      });
    }
  }

  private fan(msg: Msg) {
    if (msg.kind === 'room') {
      const room = this.readRoom(msg.roomId);
      this.roomSubs.get(msg.roomId)?.forEach((cb) => cb(room));
    } else {
      const state = this.readState(msg.roomId);
      this.stateSubs.get(msg.roomId)?.forEach((cb) => cb(state));
    }
  }

  private readRoom(id: string): RoomMeta | null {
    try {
      const raw = localStorage.getItem(ROOM_KEY(id));
      return raw ? (JSON.parse(raw) as RoomMeta) : null;
    } catch {
      return null;
    }
  }

  private writeRoom(room: RoomMeta) {
    localStorage.setItem(ROOM_KEY(room.roomId), JSON.stringify(room));
    this.channel?.postMessage({ kind: 'room', roomId: room.roomId } satisfies Msg);
    // Notify this tab too (storage events only reach other tabs).
    this.roomSubs.get(room.roomId)?.forEach((cb) => cb(room));
  }

  private readState(id: string): MatchState | null {
    try {
      const raw = localStorage.getItem(STATE_KEY(id));
      return raw ? (JSON.parse(raw) as MatchState) : null;
    } catch {
      return null;
    }
  }

  async createRoom(opts: CreateRoomOptions): Promise<RoomMeta> {
    let roomId = makeRoomCode();
    while (this.readRoom(roomId)) roomId = makeRoomCode();
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
    this.writeRoom(room);
    return room;
  }

  async joinRoom(roomId: string, player: JoinInfo): Promise<RoomMeta> {
    const room = this.readRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found.`);
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
      this.writeRoom(room);
    }
    return room;
  }

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    const room = this.readRoom(roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.players.length === 0) {
      localStorage.removeItem(ROOM_KEY(roomId));
      localStorage.removeItem(STATE_KEY(roomId));
      this.channel?.postMessage({ kind: 'room', roomId } satisfies Msg);
      return;
    }
    if (!room.players.some((p) => p.isHost)) room.players[0].isHost = true;
    this.writeRoom(room);
  }

  private patchPlayer(roomId: string, playerId: string, patch: Partial<RoomMeta['players'][number]>) {
    const room = this.readRoom(roomId);
    if (!room) return;
    room.players = room.players.map((p) =>
      p.id === playerId ? { ...p, ...patch } : p,
    );
    this.writeRoom(room);
  }

  async setReady(roomId: string, playerId: string, ready: boolean) {
    this.patchPlayer(roomId, playerId, { ready });
  }

  async setPresence(roomId: string, playerId: string, connected: boolean) {
    this.patchPlayer(roomId, playerId, { connected });
  }

  async setStatus(roomId: string, status: RoomStatus) {
    const room = this.readRoom(roomId);
    if (room) this.writeRoom({ ...room, status });
  }

  async pushState(roomId: string, state: MatchState): Promise<void> {
    const existing = this.readState(roomId);
    if (existing && existing.version > state.version) return; // newer wins
    localStorage.setItem(STATE_KEY(roomId), JSON.stringify(state));
    this.channel?.postMessage({ kind: 'state', roomId } satisfies Msg);
    this.stateSubs.get(roomId)?.forEach((cb) => cb(state));
  }

  subscribeRoom(roomId: string, cb: (room: RoomMeta | null) => void): () => void {
    if (!this.roomSubs.has(roomId)) this.roomSubs.set(roomId, new Set());
    this.roomSubs.get(roomId)!.add(cb);
    cb(this.readRoom(roomId));
    return () => this.roomSubs.get(roomId)?.delete(cb);
  }

  subscribeState(roomId: string, cb: (state: MatchState | null) => void): () => void {
    if (!this.stateSubs.has(roomId)) this.stateSubs.set(roomId, new Set());
    this.stateSubs.get(roomId)!.add(cb);
    cb(this.readState(roomId));
    return () => this.stateSubs.get(roomId)?.delete(cb);
  }
}
