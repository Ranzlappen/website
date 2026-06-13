/**
 * GameSurface — the shared frame around any game view. It computes the viewer
 * perspective (whose hidden info to show + whether this device may act),
 * renders the turn banner / result banner / error banner / event log and a
 * pluggable toolbar, and mounts the registered view for the game id.
 *
 * Used by both local/hot-seat play and online play; the only difference is the
 * `controlSeat` they pass in.
 */
import { createElement, type ReactNode } from 'react';
import { getGame, type GameAction, type MatchState, type PlayerId } from '../engine';
import { getView } from '../games/views';
import {
  EventLog,
  ResultBanner,
  Scoreboard,
  TurnBanner,
  ErrorBanner,
  EmptyState,
} from './components';

export interface GameSurfaceProps {
  state: MatchState;
  dispatch: (action: GameAction) => void;
  /** Seat this device controls; null = hot-seat (control the active player). */
  controlSeat: PlayerId | null;
  error?: string | null;
  onClearError?: () => void;
  toolbar?: ReactNode;
  /** Lines for the event log (most-recent last). */
  logLines?: string[];
}

export function GameSurface({
  state,
  dispatch,
  controlSeat,
  error,
  onClearError,
  toolbar,
  logLines = [],
}: GameSurfaceProps) {
  const def = getGame(state.gameId);
  const view = getView(state.gameId);
  if (!def || !view) {
    return (
      <EmptyState icon="🛑" title="Unknown game">
        No view is registered for “{state.gameId}”.
      </EmptyState>
    );
  }

  const viewerId = controlSeat ?? state.turn.current;
  const canAct =
    state.status === 'active' &&
    (controlSeat === null || controlSeat === state.turn.current);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <TurnBanner state={state} viewerId={viewerId} />
        {toolbar}
      </div>

      <Scoreboard state={state} viewerId={viewerId} />

      {error && <ErrorBanner message={error} onDismiss={onClearError} />}

      {state.status === 'finished' && state.result && (
        <ResultBanner result={state.result} players={state.players} />
      )}

      {controlSeat !== null && !canAct && state.status === 'active' && (
        <div className="tt-chip" role="status" aria-live="polite">
          Waiting for {state.players.find((p) => p.id === state.turn.current)?.name}…
        </div>
      )}

      {createElement(view, { state, dispatch, viewerId, canAct })}

      <EventLog lines={logLines} />
    </div>
  );
}
