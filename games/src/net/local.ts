/**
 * LocalSyncAdapter — zero-config multiplayer across tabs/windows of the same
 * browser, backed by localStorage and a BroadcastChannel. It implements the
 * full {@link SyncAdapter} contract (rooms, presence, ready states, action
 * relay, authoritative + per-viewer state) so the lobby and online play work
 * end-to-end with no backend, and the exact same UI lights up unchanged when a
 * Firebase adapter is configured.
 */
import type { GameAction, MatchState } from '../engine';
import {
  actionId,
  makeRoomCode,
  withPresence,
  type ActionEnvelope,
  type CreateRoomOptions,
  type JoinInfo,
  type RoomMeta,
  type RoomStatus,
  type SyncAdapter,
} from './adapter';
import { getClientId } from './identity';

const ROOM_PREFIX = 'tabletop:room:';
const STATE_PREFIX = 'tabletop:state:';
const ACTIONS_PREFIX = 'tabletop:actions:';
const ROOM_KEY = (id: string) => ROOM_PREFIX + id;
const STATE_KEY = (id: string, viewer?: string) =>
  STATE_PREFIX + id + (viewer ? ':' + viewer : '');
const ACTIONS_KEY = (id: string) => ACTIONS_PREFIX + id;

/** Stale local rooms are swept after this long (no server to expire them). */
const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Msg = { kind: 'room' | 'state' | 'actions'; roomId: string };
type StateSub = { viewer?: string; cb: (s: MatchState | null) => void };

export class LocalSyncAdapter implements SyncAdapter {
  readonly kind = 'local' as const;
  // The local backend uses a client host relay, not a server arbiter.
  readonly serverAuthoritative = false;
  private channel: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('tabletop-sync')
      : null;
  private roomSubs = new Map<string, Set<(r: RoomMeta | null) => void>>();
  private stateSubs = new Map<string, Set<StateSub>>();
  private actionSubs = new Map<string, Set<(a: ActionEnvelope[]) => void>>();

  constructor() {
    this.channel?.addEventListener('message', (e: MessageEvent<Msg>) => this.fan(e.data));
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key?.startsWith(ROOM_PREFIX)) {
          this.fan({ kind: 'room', roomId: e.key.slice(ROOM_PREFIX.length) });
        } else if (e.key?.startsWith(STATE_PREFIX)) {
          // key may be "state:ROOM" or "state:ROOM:viewer" — take the room id.
          this.fan({ kind: 'state', roomId: e.key.slice(STATE_PREFIX.length).split(':')[0] });
        } else if (e.key?.startsWith(ACTIONS_PREFIX)) {
          this.fan({ kind: 'actions', roomId: e.key.slice(ACTIONS_PREFIX.length) });
        }
      });
    }
    this.pruneStaleRooms();
  }

  // ── low-level storage ────────────────────────────────────────────────────
  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private readRoom(id: string): RoomMeta | null {
    const room = this.read<RoomMeta>(ROOM_KEY(id));
    return room ? withPresence(room) : null;
  }

  private readState(id: string, viewer?: string): MatchState | null {
    if (viewer) {
      const per = this.read<MatchState>(STATE_KEY(id, viewer));
      if (per) return per;
    }
    return this.read<MatchState>(STATE_KEY(id));
  }

  private readActions(id: string): ActionEnvelope[] {
    return this.read<ActionEnvelope[]>(ACTIONS_KEY(id)) ?? [];
  }

  private broadcast(msg: Msg) {
    this.channel?.postMessage(msg);
  }

  private fan(msg: Msg) {
    if (msg.kind === 'room') {
      const room = this.readRoom(msg.roomId);
      this.roomSubs.get(msg.roomId)?.forEach((cb) => cb(room));
    } else if (msg.kind === 'state') {
      this.stateSubs.get(msg.roomId)?.forEach((s) => s.cb(this.readState(msg.roomId, s.viewer)));
    } else {
      const pending = this.readActions(msg.roomId);
      this.actionSubs.get(msg.roomId)?.forEach((cb) => cb(pending));
    }
  }

  private writeRoom(room: RoomMeta) {
    localStorage.setItem(ROOM_KEY(room.roomId), JSON.stringify(room));
    this.broadcast({ kind: 'room', roomId: room.roomId });
    this.fan({ kind: 'room', roomId: room.roomId }); // notify this tab too
  }

  private pruneStaleRooms() {
    try {
      const now = Date.now();
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key?.startsWith(ROOM_PREFIX)) continue;
        const room = this.read<RoomMeta>(key);
        if (room && now - room.createdAt > ROOM_MAX_AGE_MS) {
          const id = room.roomId;
          localStorage.removeItem(ROOM_KEY(id));
          localStorage.removeItem(ACTIONS_KEY(id));
          // remove any state slots for this room
          for (let j = localStorage.length - 1; j >= 0; j--) {
            const k = localStorage.key(j);
            if (k?.startsWith(STATE_PREFIX + id)) localStorage.removeItem(k);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // ── identity / lifecycle ──────────────────────────────────────────────────
  async ensureIdentity(): Promise<string> {
    return getClientId();
  }

  async startMatch(): Promise<void> {
    // Local play is host-relayed on the client; Room.tsx seeds the match
    // directly rather than going through the adapter.
    throw new Error('startMatch is server-authoritative only.');
  }

  // ── rooms ────────────────────────────────────────────────────────────────
  async createRoom(opts: CreateRoomOptions): Promise<RoomMeta> {
    let roomId = makeRoomCode();
    while (this.read<RoomMeta>(ROOM_KEY(roomId))) roomId = makeRoomCode();
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
    this.writeRoom(room);
    return withPresence(room);
  }

  async joinRoom(roomId: string, player: JoinInfo): Promise<RoomMeta> {
    const room = this.read<RoomMeta>(ROOM_KEY(roomId));
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
      room.presence = { ...room.presence, [player.id]: true };
      this.writeRoom(room);
    }
    return withPresence(room);
  }

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    const room = this.read<RoomMeta>(ROOM_KEY(roomId));
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.presence) delete room.presence[playerId];
    if (room.players.length === 0) {
      localStorage.removeItem(ROOM_KEY(roomId));
      localStorage.removeItem(ACTIONS_KEY(roomId));
      this.broadcast({ kind: 'room', roomId });
      this.fan({ kind: 'room', roomId });
      return;
    }
    if (!room.players.some((p) => p.isHost)) room.players[0].isHost = true;
    this.writeRoom(room);
  }

  private patchPlayer(roomId: string, playerId: string, patch: Partial<RoomMeta['players'][number]>) {
    const room = this.read<RoomMeta>(ROOM_KEY(roomId));
    if (!room) return;
    room.players = room.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p));
    this.writeRoom(room);
  }

  async setReady(roomId: string, playerId: string, ready: boolean) {
    this.patchPlayer(roomId, playerId, { ready });
  }

  async setPresence(roomId: string, playerId: string, connected: boolean) {
    const room = this.read<RoomMeta>(ROOM_KEY(roomId));
    if (!room) return;
    room.presence = { ...room.presence, [playerId]: connected };
    this.writeRoom(room);
  }

  async setStatus(roomId: string, status: RoomStatus) {
    const room = this.read<RoomMeta>(ROOM_KEY(roomId));
    if (room) this.writeRoom({ ...room, status });
  }

  // ── state ──────────────────────────────────────────────────────────────
  async pushState(roomId: string, state: MatchState, viewer?: string): Promise<void> {
    const key = STATE_KEY(roomId, viewer);
    const existing = this.read<MatchState>(key);
    if (existing && existing.version > state.version) return; // newer wins
    localStorage.setItem(key, JSON.stringify(state));
    this.broadcast({ kind: 'state', roomId });
    this.fan({ kind: 'state', roomId });
  }

  // ── action relay ─────────────────────────────────────────────────────────
  async submitAction(roomId: string, playerId: string, action: GameAction): Promise<void> {
    const queue = this.readActions(roomId);
    queue.push({ id: actionId(), playerId, action, at: Date.now() });
    localStorage.setItem(ACTIONS_KEY(roomId), JSON.stringify(queue));
    this.broadcast({ kind: 'actions', roomId });
    this.fan({ kind: 'actions', roomId });
  }

  async ackAction(roomId: string, id: string): Promise<void> {
    const queue = this.readActions(roomId).filter((e) => e.id !== id);
    localStorage.setItem(ACTIONS_KEY(roomId), JSON.stringify(queue));
    this.broadcast({ kind: 'actions', roomId });
    this.fan({ kind: 'actions', roomId });
  }

  // ── subscriptions ────────────────────────────────────────────────────────
  subscribeRoom(roomId: string, cb: (room: RoomMeta | null) => void): () => void {
    if (!this.roomSubs.has(roomId)) this.roomSubs.set(roomId, new Set());
    this.roomSubs.get(roomId)!.add(cb);
    cb(this.readRoom(roomId));
    return () => this.roomSubs.get(roomId)?.delete(cb);
  }

  subscribeState(
    roomId: string,
    cb: (state: MatchState | null) => void,
    viewer?: string,
  ): () => void {
    if (!this.stateSubs.has(roomId)) this.stateSubs.set(roomId, new Set());
    const sub: StateSub = { viewer, cb };
    this.stateSubs.get(roomId)!.add(sub);
    cb(this.readState(roomId, viewer));
    return () => this.stateSubs.get(roomId)?.delete(sub);
  }

  subscribeActions(roomId: string, cb: (pending: ActionEnvelope[]) => void): () => void {
    if (!this.actionSubs.has(roomId)) this.actionSubs.set(roomId, new Set());
    this.actionSubs.get(roomId)!.add(cb);
    cb(this.readActions(roomId));
    return () => this.actionSubs.get(roomId)?.delete(cb);
  }
}
