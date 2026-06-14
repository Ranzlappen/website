/** Local & hot-seat play: AI bots auto-move, autosave, undo/redo, hand-off. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { pickBotAction, type GameAction, type MatchClient } from '../engine';
import { saveMatch } from '../storage/local';
import { EmptyState, PageShell } from '../ui/components';
import { GameSurface } from '../ui/GameSurface';
import { useMatchError, useMatchState, useResolveLocalClient } from '../ui/hooks';

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

  // Hot-seat privacy: the player currently allowed to look at the table.
  const [armedFor, setArmedFor] = useState(state.turn.current);

  const dispatch = (action: GameAction) => {
    const result = client.dispatch(action);
    if (result.ok) saveMatch(result.state);
  };

  // Drive AI bots with a guaranteed-legal action so a buggy policy can't stall.
  useEffect(() => {
    const current = state.players.find((p) => p.id === state.turn.current);
    if (state.status !== 'active' || !current?.isBot) return;
    const t = setTimeout(() => {
      const action = pickBotAction(def, client.getState());
      if (action) {
        const res = client.dispatch(action);
        if (res.ok) saveMatch(res.state);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [state, client, def]);

  // Undo skips back over bot turns to the last human decision, otherwise the
  // AI effect would immediately re-play the bot's move.
  const smartUndo = () => {
    if (!client.undo()) return;
    let guard = 0;
    while (client.canUndo && guard++ < 64) {
      const cur = client.getState().turn.current;
      const p = client.getState().players.find((pp) => pp.id === cur);
      if (p?.isBot) client.undo();
      else break;
    }
    setArmedFor(client.getState().turn.current);
    saveMatch(client.getState());
  };

  const humans = state.players.filter((p) => !p.isBot).length;
  const currentPlayer = state.players.find((p) => p.id === state.turn.current);
  const needCurtain =
    state.status === 'active' &&
    humans >= 2 &&
    !!currentPlayer &&
    !currentPlayer.isBot &&
    armedFor !== state.turn.current;

  const logLines = client
    .getLog()
    .map((e) => def.describeAction?.(e.action, state) ?? '')
    .filter(Boolean);

  const toolbar = (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button className="tt-btn" onClick={smartUndo} disabled={!client.canUndo}>
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
      {needCurtain ? (
        <div
          className="tt-panel"
          role="dialog"
          aria-label="Pass the device"
          style={{ padding: '3rem 1.5rem', textAlign: 'center', display: 'grid', gap: '1rem', justifyItems: 'center' }}
        >
          <div style={{ fontSize: '2.5rem' }} aria-hidden>
            🤝
          </div>
          <h2 style={{ margin: 0 }}>Pass the device to {currentPlayer?.name}</h2>
          <p style={{ color: 'var(--tt-muted)', margin: 0 }}>
            Keep the previous player’s hand private — only tap continue when{' '}
            {currentPlayer?.name} is holding the device.
          </p>
          <button
            className="tt-btn tt-btn--primary"
            onClick={() => setArmedFor(state.turn.current)}
            autoFocus
          >
            I’m {currentPlayer?.name} — continue
          </button>
        </div>
      ) : (
        <GameSurface
          state={state}
          dispatch={dispatch}
          controlSeat={null}
          error={error}
          onClearError={() => client.clearError()}
          toolbar={toolbar}
          logLines={logLines}
        />
      )}
    </PageShell>
  );
}
