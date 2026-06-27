/** Home — the game gallery plus a "resume saved game" strip. */
import { Link } from 'react-router-dom';
import { listGames } from '../engine';
import { listSaves, deleteSave } from '../storage/local';
import { getGame } from '../engine';
import { PageShell } from '../ui/components';
import { useState } from 'react';

const CATEGORY_LABEL: Record<string, string> = {
  card: 'Card game',
  board: 'Board game',
  hybrid: 'Hybrid',
};

export default function Home() {
  const games = listGames();
  const [saves, setSaves] = useState(() => listSaves());

  return (
    <PageShell wide>
      <section style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>
          A game engine for the table 🎲
        </h1>
        <p style={{ color: 'var(--tt-muted)', maxWidth: 640, lineHeight: 1.6 }}>
          Tabletop is a reusable browser engine for card and board games. Play
          solo against bots, hot-seat on one device, or open a room and play
          online. Pick a game to begin.
        </p>
      </section>

      {saves.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Continue</h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {saves.map((s) => {
              const def = getGame(s.gameId);
              return (
                <div
                  key={s.matchId}
                  className="tt-panel"
                  style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}
                >
                  <span aria-hidden style={{ fontSize: '1.4rem' }}>
                    {def?.emoji ?? '🎲'}
                  </span>
                  <div>
                    <strong>{def?.name ?? s.gameId}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--tt-muted)' }}>
                      {s.players.join(', ')} · {s.status}
                    </div>
                  </div>
                  <Link to={`/play/${s.matchId}`} className="tt-btn tt-btn--primary">
                    Resume
                  </Link>
                  <button
                    className="tt-btn tt-btn--ghost"
                    aria-label="Delete save"
                    onClick={() => {
                      deleteSave(s.matchId);
                      setSaves(listSaves());
                    }}
                  >
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: '1.1rem' }}>Games</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
            gap: '1rem',
          }}
        >
          {games.map((g) => (
            <Link
              key={g.id}
              to={`/setup/${g.id}`}
              className="tt-panel"
              style={{
                padding: '1.25rem',
                color: 'var(--tt-ink)',
                textDecoration: 'none',
                display: 'grid',
                gap: '0.4rem',
                borderTop: `4px solid ${g.accent ?? 'var(--tt-accent)'}`,
              }}
            >
              <div style={{ fontSize: '2rem' }} aria-hidden>
                {g.emoji ?? '🎲'}
              </div>
              <strong style={{ fontSize: '1.15rem' }}>{g.name}</strong>
              <span className="tt-chip" style={{ justifySelf: 'start' }}>
                {CATEGORY_LABEL[g.category]} · {g.minPlayers}–{g.maxPlayers}P
              </span>
              <p style={{ color: 'var(--tt-muted)', margin: '0.25rem 0 0', lineHeight: 1.5 }}>
                {g.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
