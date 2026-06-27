/** Setup — configure seats (humans / bots) for a local match and start it. */
import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { createMatch, getGame, MatchClient } from '../engine';
import { saveMatch } from '../storage/local';
import { EmptyState, PageShell } from '../ui/components';
import { useUiStore } from '../ui/store';

interface Seat {
  name: string;
  isBot: boolean;
}

export default function Setup() {
  const { gameId = '' } = useParams();
  const def = getGame(gameId);
  const navigate = useNavigate();
  const playerName = useUiStore((s) => s.playerName);
  const setPlayerName = useUiStore((s) => s.setPlayerName);
  const registerClient = useUiStore((s) => s.registerClient);

  const initialSeats = useMemo<Seat[]>(() => {
    if (!def) return [];
    const seats: Seat[] = [{ name: playerName, isBot: false }];
    for (let i = 1; i < def.minPlayers; i++) {
      seats.push({ name: `Bot ${i}`, isBot: true });
    }
    return seats;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  const [seats, setSeats] = useState<Seat[]>(initialSeats);

  if (!def) {
    return (
      <PageShell>
        <EmptyState icon="🔍" title="Game not found">
          <Link to="/" className="tt-link">
            Back to the gallery
          </Link>
        </EmptyState>
      </PageShell>
    );
  }

  const setSeat = (i: number, patch: Partial<Seat>) =>
    setSeats((s) => s.map((seat, j) => (j === i ? { ...seat, ...patch } : seat)));

  const addSeat = () =>
    setSeats((s) => [...s, { name: `Bot ${s.length}`, isBot: true }]);
  const removeSeat = () => setSeats((s) => s.slice(0, -1));

  const preset = (humans: number, bots: number) => {
    const next: Seat[] = [];
    for (let i = 0; i < humans; i++)
      next.push({ name: i === 0 ? playerName : `Player ${i + 1}`, isBot: false });
    for (let i = 0; i < bots; i++) next.push({ name: `Bot ${i + 1}`, isBot: true });
    setSeats(next.slice(0, def.maxPlayers));
  };

  const start = () => {
    // Keep the player's name for next time (seat 0 if human).
    const human = seats.find((s) => !s.isBot);
    if (human) setPlayerName(human.name);
    const players = seats.map((s, i) => ({
      id: `p${i}`,
      name: s.name.trim() || (s.isBot ? `Bot ${i}` : `Player ${i + 1}`),
      isBot: s.isBot,
    }));
    const state = createMatch(def, { players });
    saveMatch(state);
    registerClient(state.matchId, new MatchClient(def, state));
    navigate(`/play/${state.matchId}`);
  };

  const canAdd = seats.length < def.maxPlayers;
  const canRemove = seats.length > def.minPlayers;

  return (
    <PageShell>
      <Link to="/" className="tt-link">
        ← Games
      </Link>
      <h1 style={{ margin: '0.5rem 0 0.25rem' }}>
        {def.emoji} {def.name}
      </h1>
      <p style={{ color: 'var(--tt-muted)' }}>{def.description}</p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0' }}>
        <button className="tt-btn" onClick={() => preset(1, 1)}>
          Solo vs 1 bot
        </button>
        {def.maxPlayers >= 3 && (
          <button className="tt-btn" onClick={() => preset(1, 2)}>
            Solo vs 2 bots
          </button>
        )}
        <button className="tt-btn" onClick={() => preset(2, 0)}>
          Hot-seat 2P
        </button>
      </div>

      <div className="tt-panel" style={{ padding: '1rem', display: 'grid', gap: '0.6rem' }}>
        {seats.map((seat, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', minWidth: 0 }}>
            <span className="tt-chip" style={{ minWidth: 64, justifyContent: 'center' }}>
              Seat {i + 1}
            </span>
            <input
              className="tt-btn"
              style={{ flex: 1, fontWeight: 400 }}
              value={seat.name}
              onChange={(e) => setSeat(i, { name: e.target.value })}
              aria-label={`Seat ${i + 1} name`}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="checkbox"
                checked={seat.isBot}
                onChange={(e) => setSeat(i, { isBot: e.target.checked })}
              />
              Bot
            </label>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="tt-btn" disabled={!canAdd} onClick={addSeat}>
            + Add seat
          </button>
          <button className="tt-btn" disabled={!canRemove} onClick={removeSeat}>
            − Remove seat
          </button>
          <span style={{ alignSelf: 'center', color: 'var(--tt-muted)', fontSize: '0.85rem' }}>
            {def.minPlayers}–{def.maxPlayers} players
          </span>
        </div>
      </div>

      <button
        className="tt-btn tt-btn--primary"
        style={{ marginTop: '1.25rem', fontSize: '1.05rem', padding: '0.7rem 1.5rem' }}
        onClick={start}
      >
        Start game
      </button>
    </PageShell>
  );
}
