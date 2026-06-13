/** Online hub — create a room for a game, or join one by code. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listGames } from '../engine';
import {
  getSyncAdapter,
  getNetMode,
  setNetMode,
  firebaseAvailable,
} from '../net';
import { PageShell, ErrorBanner } from '../ui/components';
import { useUiStore } from '../ui/store';
import { getClientId } from '../ui/identity';

export default function Online() {
  const navigate = useNavigate();
  const games = listGames();
  const playerName = useUiStore((s) => s.playerName);
  const setPlayerName = useUiStore((s) => s.setPlayerName);
  const [gameId, setGameId] = useState(games[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(getNetMode());

  const create = async () => {
    setError(null);
    try {
      const adapter = getSyncAdapter();
      const room = await adapter.createRoom({
        gameId,
        host: { id: getClientId(), name: playerName },
      });
      navigate(`/room/${room.roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create room.');
    }
  };

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 3) {
      setError('Enter a valid room code.');
      return;
    }
    navigate(`/room/${c}`);
  };

  return (
    <PageShell>
      <h1 style={{ margin: '0 0 0.25rem' }}>Play online 🌐</h1>
      <p style={{ color: 'var(--tt-muted)' }}>
        Rooms sync turn-by-turn. The local backend connects players across tabs
        and windows on this device; enable Firebase to play across the internet.
      </p>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="tt-panel" style={{ padding: '1rem', display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ color: 'var(--tt-muted)', fontSize: '0.85rem' }}>Your name</span>
          <input
            className="tt-btn"
            style={{ fontWeight: 400 }}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ color: 'var(--tt-muted)', fontSize: '0.85rem' }}>Game</span>
          <select className="tt-btn" value={gameId} onChange={(e) => setGameId(e.target.value)}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.emoji} {g.name}
              </option>
            ))}
          </select>
        </label>

        <button className="tt-btn tt-btn--primary" onClick={create}>
          Create room
        </button>
      </div>

      <div className="tt-panel" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <input
          className="tt-btn"
          style={{ flex: 1, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.1em' }}
          placeholder="Room code"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && join()}
        />
        <button className="tt-btn" onClick={join}>
          Join
        </button>
      </div>

      <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--tt-muted)' }}>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span>Backend:</span>
          <select
            className="tt-btn"
            style={{ padding: '0.25rem 0.5rem' }}
            value={mode}
            onChange={(e) => {
              const m = e.target.value as 'local' | 'firebase';
              setNetMode(m);
              setMode(m);
            }}
          >
            <option value="local">Local (cross-tab)</option>
            <option value="firebase" disabled={!firebaseAvailable()}>
              Firebase {firebaseAvailable() ? '' : '(not configured)'}
            </option>
          </select>
        </label>
      </div>
    </PageShell>
  );
}
