/** Online room — lobby (presence, ready, start) then synchronized play. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  applyAction,
  createMatch,
  getGame,
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
import { getClientId } from '../ui/identity';

export default function Room() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const playerName = useUiStore((s) => s.playerName);
  const clientId = useMemo(() => getClientId(), []);
  const adapter = useMemo(() => getSyncAdapter(), []);

  const [room, setRoom] = useState<RoomMeta | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
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
      unsubState = adapter.subscribeState(roomId, setMatchState);
    })();
    return () => {
      active = false;
      unsubRoom();
      unsubState();
      adapter.setPresence(roomId, clientId, false);
    };
  }, [roomId, adapter, clientId, playerName]);

  const def = room ? getGame(room.gameId) : undefined;
  const isHost = room?.players.find((p) => p.id === clientId)?.isHost ?? false;

  const startMatch = async () => {
    if (!room || !def) return;
    const players = [...room.players]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({ id: p.id, name: p.name }));
    try {
      const state = createMatch(def, { matchId: roomId, seed: `${roomId}-${Date.now()}`, players });
      await adapter.pushState(roomId, state);
      await adapter.setStatus(roomId, 'playing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start.');
    }
  };

  const dispatch = (action: GameAction) => {
    if (!def || !matchState) return;
    const result = applyAction(def, matchState, { ...action, playerId: clientId });
    if (result.ok) {
      setMatchState(result.state);
      adapter.pushState(roomId, result.state);
      if (result.state.status === 'finished') adapter.setStatus(roomId, 'finished');
    } else {
      setError(result.error);
    }
  };

  const leave = async () => {
    await adapter.leaveRoom(roomId, clientId);
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

  if (!joined || !room) {
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
        <button
          className="tt-btn"
          onClick={() => navigator.clipboard?.writeText(window.location.href)}
        >
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
            <button
              className="tt-btn"
              onClick={() => adapter.setReady(roomId, clientId, !me?.ready)}
            >
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
            Share the room code or invite link. Open a second browser tab and
            join with the same code to test multiplayer locally.
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
