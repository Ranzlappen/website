/**
 * Shared chrome components used across pages and game views: app header, theme
 * picker, player badges, turn banner, scoreboard, event log, and the empty /
 * error / loading states. Kept presentational and theme-driven.
 */
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { GameResult, MatchState, PlayerId, PlayerInfo } from '../engine';
import { useUiStore } from './store';
import { THEMES } from './theme';
import { SEAT_COLORS } from './assets';

export function Header() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <header className="tt-header">
      <Link
        to="/"
        className="tt-link"
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', color: 'var(--tt-ink)' }}
      >
        <span aria-hidden style={{ fontSize: '1.4rem' }}>
          🎲
        </span>
        <strong>Tabletop</strong>
      </Link>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/" className="tt-link">
          Games
        </Link>
        <Link to="/online" className="tt-link">
          Online
        </Link>
      </nav>
      <div style={{ marginLeft: 'auto' }}>
        <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="tt-header__theme-text" style={{ color: 'var(--tt-muted)' }}>
            Theme
          </span>
          <select
            className="tt-btn"
            style={{ padding: '0.35rem 0.5rem', maxWidth: '9rem' }}
            value={theme}
            onChange={(e) => setTheme(e.target.value as never)}
            aria-label="Choose a visual theme"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}

export function PageShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="tt-app">
      <Header />
      <main className={`tt-main${wide ? ' tt-main--wide' : ''}`}>{children}</main>
    </div>
  );
}

export function PlayerBadge({
  player,
  active,
  you,
  score,
  connected = true,
}: {
  player: PlayerInfo;
  active?: boolean;
  you?: boolean;
  score?: number;
  connected?: boolean;
}) {
  const color = SEAT_COLORS[player.seat % SEAT_COLORS.length];
  return (
    <div
      className="tt-chip"
      style={{
        borderColor: active ? color : 'var(--tt-border)',
        boxShadow: active ? `0 0 0 2px ${color}` : 'none',
        opacity: connected ? 1 : 0.5,
      }}
    >
      <span
        aria-hidden
        style={{ width: 10, height: 10, borderRadius: '50%', background: color }}
      />
      <span>{player.name}</span>
      {player.isBot && <span style={{ color: 'var(--tt-muted)' }}>🤖</span>}
      {you && <span style={{ color: 'var(--tt-muted)' }}>(you)</span>}
      {!connected && <span title="Disconnected">⏳</span>}
      {typeof score === 'number' && (
        <strong style={{ color }}>{score}</strong>
      )}
    </div>
  );
}

export function TurnBanner({
  state,
  viewerId,
}: {
  state: MatchState;
  viewerId: PlayerId | null;
}) {
  const current = state.players.find((p) => p.id === state.turn.current);
  const yourTurn = viewerId !== null && state.turn.current === viewerId;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        fontWeight: 600,
      }}
    >
      <span className="tt-chip" style={{ background: 'var(--tt-accent)', color: '#1a1408' }}>
        Turn {state.turn.turnNumber}
      </span>
      <span>
        {yourTurn ? 'Your move' : `${current?.name ?? '—'}'s move`}
        <span style={{ color: 'var(--tt-muted)', fontWeight: 400 }}>
          {' '}
          · {state.turn.phase}
        </span>
      </span>
    </div>
  );
}

export function Scoreboard({
  state,
  viewerId,
  scoreOf,
}: {
  state: MatchState;
  viewerId: PlayerId | null;
  scoreOf?: (id: PlayerId) => number;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {state.players.map((p) => (
        <PlayerBadge
          key={p.id}
          player={p}
          active={state.turn.current === p.id && state.status === 'active'}
          you={p.id === viewerId}
          score={scoreOf?.(p.id)}
        />
      ))}
    </div>
  );
}

export function ResultBanner({ result, players }: { result: GameResult; players: PlayerInfo[] }) {
  const names = (result.winners ?? [])
    .map((id) => players.find((p) => p.id === id)?.name ?? id)
    .join(', ');
  return (
    <div
      className="tt-panel tt-pop"
      role="status"
      style={{
        padding: '1rem 1.25rem',
        textAlign: 'center',
        borderColor: 'var(--tt-accent)',
      }}
    >
      <div style={{ fontSize: '1.5rem' }} aria-hidden>
        {result.status === 'draw' ? '🤝' : '🏆'}
      </div>
      <strong style={{ fontSize: '1.15rem' }}>
        {result.status === 'draw' ? "It's a draw" : `${names} wins!`}
      </strong>
      {result.reason && (
        <div style={{ color: 'var(--tt-muted)', marginTop: '0.25rem' }}>{result.reason}</div>
      )}
    </div>
  );
}

export function EventLog({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <details className="tt-panel" style={{ padding: '0.5rem 0.9rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        Event log ({lines.length})
      </summary>
      <ol
        style={{
          margin: '0.5rem 0 0',
          paddingLeft: '1.25rem',
          maxHeight: 160,
          overflow: 'auto',
          color: 'var(--tt-muted)',
          fontSize: '0.9rem',
        }}
      >
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </details>
  );
}

export function EmptyState({
  icon = '🃏',
  title,
  children,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="tt-panel" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem' }} aria-hidden>
        {icon}
      </div>
      <h2 style={{ margin: '0.5rem 0' }}>{title}</h2>
      <div style={{ color: 'var(--tt-muted)' }}>{children}</div>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="tt-pop"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.6rem 1rem',
        borderRadius: '0.7rem',
        background: 'color-mix(in srgb, #e2607a 22%, var(--tt-surface))',
        border: '1px solid #e2607a',
      }}
    >
      <span aria-hidden>⚠️</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button className="tt-btn tt-btn--ghost" onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      style={{ display: 'grid', placeItems: 'center', minHeight: '40vh', color: 'var(--tt-muted)' }}
    >
      <div className="tt-rolling" style={{ fontSize: '2rem' }} aria-hidden>
        🎲
      </div>
      <div>{label}</div>
    </div>
  );
}
