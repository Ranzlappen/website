/** Local & hot-seat play: AI bots auto-move, autosave, undo/redo. */
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { botAction, type GameAction } from '../engine';
import { saveMatch } from '../storage/local';
import { EmptyState, PageShell } from '../ui/components';
import { GameSurface } from '../ui/GameSurface';
import { useMatchError, useMatchState, useResolveLocalClient } from '../ui/hooks';
import type { MatchClient } from '../engine';

export default function Play() {
  const { matchId = '' } = useParams();
  const client = useResolveLocalClient(matchId);
  if (!client) {
    return (
      <PageShell>
        <EmptyState icon="🗂️" title="Match not found">
          That game isn’t saved on this device.{' '}
          <Link to="/" className="tt-link">
            Back to games
          </Link>
        </EmptyState>
      </PageShell>
    );
  }
  return <MatchScreen client={client} />;
}

function MatchScreen({ client }: { client: MatchClient }) {
  const state = useMatchState(client);
  const error = useMatchError(client);
  const def = client.def;

  const dispatch = (action: GameAction) => {
    const result = client.dispatch(action);
    if (result.ok) saveMatch(result.state);
  };

  // Drive AI bots: when it's a bot's turn, play after a short, visible beat.
  useEffect(() => {
    const current = state.players.find((p) => p.id === state.turn.current);
    if (state.status !== 'active' || !current?.isBot) return;
    const t = setTimeout(() => {
      const action = botAction(def, client.getState());
      if (action) {
        const res = client.dispatch(action);
        if (res.ok) saveMatch(res.state);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [state, client, def]);

  const logLines = client
    .getLog()
    .map((e) => def.describeAction?.(e.action, state) ?? '')
    .filter(Boolean);

  const toolbar = (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button className="tt-btn" onClick={() => client.undo()} disabled={!client.canUndo}>
        ↩ Undo
      </button>
      <button className="tt-btn" onClick={() => client.redo()} disabled={!client.canRedo}>
        ↪ Redo
      </button>
      <Link to={`/setup/${state.gameId}`} className="tt-btn">
        New game
      </Link>
    </div>
  );

  return (
    <PageShell wide>
      <Link to="/" className="tt-link">
        ← Games
      </Link>
      <h1 style={{ margin: '0.4rem 0 1rem' }}>
        {def.emoji} {def.name}
      </h1>
      <GameSurface
        state={state}
        dispatch={dispatch}
        controlSeat={null}
        error={error}
        onClearError={() => client.clearError()}
        toolbar={toolbar}
        logLines={logLines}
      />
    </PageShell>
  );
}
