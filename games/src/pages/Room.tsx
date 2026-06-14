/**
 * Online room — lobby (presence, ready, start) then synchronized play.
 *
 * Two backends, one UI:
 *  - **Local** (cross-tab): host-authoritative on the client. The host consumes
 *    the action queue, applies moves, and publishes per-viewer redacted state.
 *  - **Firebase**: server-authoritative. A Cloud Function validates + applies
 *    moves (actor = authenticated uid) and writes each player's redacted slot;
 *    clients only `submitAction` and read their own slot. Even the host can't
 *    cheat, and a peer can't read another player's hidden state.
 *
 * The difference is isolated to `adapter.serverAuthoritative`: the client
 * host-relay effect and direct state seeding run only for the local backend.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  applyAction,
  createMatch,
  getGame,
  redactFor,
  type GameAction,
  type MatchState,
} from '../engine';
import { getSyncAdapter, type RoomMeta } from '../net';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  PageShell,
  PlayerBadge,
} from '../ui/components';
import { GameSurface } from '../ui/GameSurface';
import { useUiStore } from '../ui/store';

export default function Room() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const playerName = useUiStore((s) => s.playerName);
  const adapter = useMemo(() => getSyncAdapter(), []);

  const [clientId, setClientId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomMeta | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const def = room ? getGame(room.gameId) : undefined;
  const isHost = room?.players.find((p) => p.id === clientId)?.isHost ?? false;

  // Local host-relay only: authoritative state + processed-action de-dupe.
  const hostStateRef = useRef<MatchState | null>(null);
  const processedRef = useRef<Set<string>>(new Set());

  // Resolve this client's backend identity (local id, or anonymous uid).
  useEffect(() => {
    let active = true;
    adapter
      .ensureIdentity()
      .then((id) => active && setClientId(id))
      .catch(() => active && setError('Could not sign in to play online.'));
    return () => {
      active = false;
    };
  }, [adapter]);

  // Join + subscribe (render view + presence).
  useEffect(() => {
    if (!clientId) return;
    let active = true;
    let unsubRoom = () => {};
    let unsubState = () => {};
    (async () => {
      try {
        await adapter.joinRoom(roomId, { id: clientId, name: playerName });
        await adapter.setPresence(roomId, clientId, true);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not join room.');
        return;
      }
      if (!active) return;
      setJoined(true);
      unsubRoom = adapter.subscribeRoom(roomId, setRoom);
      unsubState = adapter.subscribeState(roomId, setMatchState, clientId);
    })();
    return () => {
      active = false;
      unsubRoom();
      unsubState();
      adapter.setPresence(roomId, clientId, false);
    };
  }, [roomId, adapter, clientId, playerName]);

  // Local backend only: the host consumes the action queue and publishes state.
  useEffect(() => {
    if (adapter.serverAuthoritative || !isHost || !def) return;
    const publish = async (state: MatchState) => {
      hostStateRef.current = state;
      await adapter.pushState(roomId, state);
      if (def.redact) {
        for (const p of state.players) {
          await adapter.pushState(roomId, redactFor(def, state, p.id), p.id);
        }
      }
      if (state.status === 'finished') await adapter.setStatus(roomId, 'finished');
    };
    const offState = adapter.subscribeState(roomId, (s) => {
      if (s && !hostStateRef.current) hostStateRef.current = s;
    });
    const offActions = adapter.subscribeActions(roomId, async (pending) => {
      for (const env of pending) {
        if (processedRef.current.has(env.id)) continue;
        processedRef.current.add(env.id);
        const base = hostStateRef.current;
        await adapter.ackAction(roomId, env.id);
        if (!base) continue;
        const result = applyAction(def, base, { ...env.action, playerId: env.playerId });
        if (result.ok) await publish(result.state);
      }
    });
    return () => {
      offState();
      offActions();
    };
  }, [isHost, def, roomId, adapter]);

  const startMatch = async () => {
    if (!room || !def || !clientId) return;
    try {
      if (adapter.serverAuthoritative) {
        await adapter.startMatch(roomId);
        return;
      }
      // Local host relay: seed + publish directly.
      const players = [...room.players]
        .sort((a, b) => a.seat - b.seat)
        .map((p) => ({ id: p.id, name: p.name }));
      const state = createMatch(def, { matchId: roomId, seed: `${roomId}-${Date.now()}`, players });
      processedRef.current = new Set();
      hostStateRef.current = state;
      await adapter.setStatus(roomId, 'playing');
      await adapter.pushState(roomId, state);
      if (def.redact) {
        for (const p of state.players) {
          await adapter.pushState(roomId, redactFor(def, state, p.id), p.id);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start.');
    }
  };

  // Dispatch = submit an action. Local queues it for the host; Firebase calls
  // the arbiter, which rejects illegal moves (surfaced here).
  const dispatch = (action: GameAction) => {
    if (!clientId) return;
    adapter
      .submitAction(roomId, clientId, action)
      .catch((e) => setError(e instanceof Error ? e.message : 'Move failed.'));
  };

  const leave = async () => {
    if (clientId) await adapter.leaveRoom(roomId, clientId);
    navigate('/online');
  };

  if (error && !room) {
    return (
      <PageShell>
        <EmptyState icon="🚪" title="Can’t open room">
          {error}{' '}
          <Link to="/online" className="tt-link">
            Back
          </Link>
        </EmptyState>
      </PageShell>
    );
  }

  if (!joined || !room || !clientId) {
    return (
      <PageShell>
        <Loading label="Joining room…" />
      </PageShell>
    );
  }

  const me = room.players.find((p) => p.id === clientId);
  const everyoneReady =
    room.players.length >= (def?.minPlayers ?? 2) && room.players.every((p) => p.ready);

  return (
    <PageShell wide>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>
          {def?.emoji} {def?.name ?? room.gameId}
        </h1>
        <span className="tt-chip" style={{ background: 'var(--tt-accent)', color: '#1a1408', fontSize: '1rem' }}>
          Room {room.roomId}
        </span>
        <button className="tt-btn" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
          🔗 Copy invite link
        </button>
        <button className="tt-btn tt-btn--ghost" style={{ marginLeft: 'auto' }} onClick={leave}>
          Leave
        </button>
      </div>

      {error && (
        <div style={{ marginTop: '1rem' }}>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {room.status === 'lobby' && (
        <div className="tt-panel" style={{ padding: '1.25rem', marginTop: '1rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
              Players ({room.players.length}/{def?.maxPlayers})
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {room.players.map((p) => (
                <PlayerBadge
                  key={p.id}
                  player={{ id: p.id, name: `${p.name}${p.ready ? ' ✓' : ''}`, seat: p.seat }}
                  you={p.id === clientId}
                  connected={p.connected}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="tt-btn" onClick={() => adapter.setReady(roomId, clientId, !me?.ready)}>
              {me?.ready ? "I'm not ready" : "I'm ready"}
            </button>
            {isHost && (
              <button
                className="tt-btn tt-btn--primary"
                disabled={!everyoneReady}
                onClick={startMatch}
                title={everyoneReady ? '' : 'Need enough players, all ready'}
              >
                Start game
              </button>
            )}
            {!isHost && (
              <span style={{ alignSelf: 'center', color: 'var(--tt-muted)' }}>
                Waiting for the host to start…
              </span>
            )}
          </div>
          <p style={{ color: 'var(--tt-muted)', fontSize: '0.85rem', margin: 0 }}>
            Share the room code or invite link. Open a second browser tab and join
            with the same code to test multiplayer locally.
          </p>
        </div>
      )}

      {room.status !== 'lobby' && (
        <div style={{ marginTop: '1rem' }}>
          {matchState ? (
            <>
              <GameSurface
                state={matchState}
                dispatch={dispatch}
                controlSeat={clientId}
                error={error}
                onClearError={() => setError(null)}
              />
              {isHost && matchState.status === 'finished' && (
                <button className="tt-btn tt-btn--primary" style={{ marginTop: '1rem' }} onClick={startMatch}>
                  Play again
                </button>
              )}
            </>
          ) : (
            <Loading label="Syncing game…" />
          )}
        </div>
      )}
    </PageShell>
  );
}
