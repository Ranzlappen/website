import { describe, it, expect, beforeEach } from 'vitest';
import { LocalSyncAdapter } from '../net/local';
import type { ActionEnvelope, RoomMeta } from '../net/adapter';
import type { MatchState } from '../engine';

function fakeState(version: number, tag = 'full'): MatchState {
  return {
    matchId: 'r',
    gameId: 'g',
    players: [],
    status: 'active',
    turn: { current: 'p0', phase: 'play', turnNumber: 1, order: ['p0'] },
    rngState: 1,
    game: { tag },
    result: null,
    version,
    updatedAt: 0,
  };
}

describe('LocalSyncAdapter', () => {
  let net: LocalSyncAdapter;
  beforeEach(() => {
    localStorage.clear();
    net = new LocalSyncAdapter();
  });

  it('creates a room with the host present and connected', async () => {
    const room = await net.createRoom({ gameId: 'crown-rush', host: { id: 'h', name: 'Host' } });
    expect(room.players).toHaveLength(1);
    expect(room.players[0].isHost).toBe(true);
    expect(room.players[0].connected).toBe(true);
    expect(room.roomId).toMatch(/^[A-Z0-9]{4}$/);
  });

  it('lets a second player join and notifies subscribers', async () => {
    const room = await net.createRoom({ gameId: 'crown-rush', host: { id: 'h', name: 'Host' } });
    let latest: RoomMeta | null = null;
    net.subscribeRoom(room.roomId, (r) => (latest = r));
    await net.joinRoom(room.roomId, { id: 'g', name: 'Guest' });
    expect(latest!.players).toHaveLength(2);
    expect(latest!.players[1].seat).toBe(1);
    expect(latest!.players[1].connected).toBe(true);
  });

  it('tracks ready and presence by id', async () => {
    const room = await net.createRoom({ gameId: 'crown-rush', host: { id: 'h', name: 'Host' } });
    await net.joinRoom(room.roomId, { id: 'g', name: 'Guest' });
    await net.setReady(room.roomId, 'g', true);
    await net.setPresence(room.roomId, 'g', false);
    let latest: RoomMeta | null = null;
    net.subscribeRoom(room.roomId, (r) => (latest = r));
    const guest = latest!.players.find((p) => p.id === 'g')!;
    expect(guest.ready).toBe(true);
    expect(guest.connected).toBe(false);
  });

  it('pushes shared and per-viewer state and prefers the per-viewer slot', async () => {
    const room = await net.createRoom({ gameId: 'crown-rush', host: { id: 'h', name: 'Host' } });
    const id = room.roomId;
    await net.pushState(id, fakeState(1, 'shared'));
    await net.pushState(id, fakeState(1, 'p0-view'), 'p0');

    let shared: MatchState | null = null;
    let p0: MatchState | null = null;
    let p1: MatchState | null = null;
    net.subscribeState(id, (s) => (shared = s));
    net.subscribeState(id, (s) => (p0 = s), 'p0');
    net.subscribeState(id, (s) => (p1 = s), 'p1'); // no p1 slot → falls back to shared
    expect((shared!.game as { tag: string }).tag).toBe('shared');
    expect((p0!.game as { tag: string }).tag).toBe('p0-view');
    expect((p1!.game as { tag: string }).tag).toBe('shared');
  });

  it('rejects an older-version state push', async () => {
    const room = await net.createRoom({ gameId: 'crown-rush', host: { id: 'h', name: 'Host' } });
    await net.pushState(room.roomId, fakeState(5));
    await net.pushState(room.roomId, fakeState(2)); // stale, ignored
    let got: MatchState | null = null;
    net.subscribeState(room.roomId, (s) => (got = s));
    expect(got!.version).toBe(5);
  });

  it('relays and acknowledges actions', async () => {
    const room = await net.createRoom({ gameId: 'crown-rush', host: { id: 'h', name: 'Host' } });
    const id = room.roomId;
    let pending: ActionEnvelope[] = [];
    net.subscribeActions(id, (p) => (pending = p));
    await net.submitAction(id, 'g', { type: 'DRAW', payload: { from: 'stock' } });
    expect(pending).toHaveLength(1);
    expect(pending[0].playerId).toBe('g');
    await net.ackAction(id, pending[0].id);
    expect(pending).toHaveLength(0);
  });

  it('removes the room when the last player leaves', async () => {
    const room = await net.createRoom({ gameId: 'crown-rush', host: { id: 'h', name: 'Host' } });
    let latest: RoomMeta | null = { ...room };
    net.subscribeRoom(room.roomId, (r) => (latest = r));
    await net.leaveRoom(room.roomId, 'h');
    expect(latest).toBeNull();
  });
});
