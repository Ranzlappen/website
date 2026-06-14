/** Relic Run table view: loop track, pawns, dice, relic tokens, action cards. */
import { Die, Pawn, Token, SEAT_COLORS } from '../../ui/assets';
import { PlayerBadge } from '../../ui/components';
import { useRollFlash } from '../../ui/hooks';
import { CARD_LABEL, CARD_TEXT, type RelicState } from '../relic-run';
import { registerView } from './registry';
import type { GameViewProps } from './types';

const CELL_ICON: Record<string, string> = { relic: '🗿', card: '🃏', empty: '·' };

function RelicRunView({ state, dispatch, viewerId, canAct }: GameViewProps<RelicState>) {
  const game = state.game;
  const rolling = useRollFlash(game.die);
  const phase = state.turn.phase;
  const myHand = game.hands[viewerId] ?? [];
  const pawnsAt = (index: number) =>
    state.players.filter((p) => game.positions[p.id] === index);

  return (
    <div style={{ display: 'grid', gap: '1.25rem', justifyItems: 'center' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {state.players.map((p) => (
          <PlayerBadge
            key={p.id}
            player={p}
            active={state.turn.current === p.id}
            you={p.id === viewerId}
            score={game.relics[p.id]}
          />
        ))}
      </div>

      {/* Loop track */}
      <div
        className="tt-felt"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          padding: '1rem',
          justifyContent: 'center',
          maxWidth: 560,
        }}
        aria-label="Relic Run track"
      >
        {game.track.map((kind, i) => (
          <div
            key={i}
            className="tt-cell"
            style={{ width: 58, height: 58, position: 'relative', flexDirection: 'column' }}
            aria-label={`Cell ${i + 1}: ${kind}`}
          >
            <span aria-hidden style={{ fontSize: '1.1rem', opacity: 0.8 }}>
              {CELL_ICON[kind]}
            </span>
            <div style={{ position: 'absolute', bottom: -2, display: 'flex' }}>
              {pawnsAt(i).map((p) => (
                <Pawn key={p.id} seat={p.seat} size={20} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Dice / actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {game.die !== null && <Die value={game.die} size={48} rolling={rolling} />}
        {phase === 'roll' && (
          <button
            className="tt-btn tt-btn--primary"
            disabled={!canAct}
            onClick={() => dispatch({ type: 'ROLL' })}
          >
            🎲 Roll & move
          </button>
        )}
        {phase === 'action' && canAct && (
          <button className="tt-btn" onClick={() => dispatch({ type: 'PASS' })}>
            End turn
          </button>
        )}
      </div>

      {/* Your action cards */}
      <div style={{ display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
        <div style={{ color: 'var(--tt-muted)' }}>
          Your action cards {myHand.length === 0 && '— none yet'}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {myHand.map((c) => (
            <button
              key={c.id}
              className="tt-panel"
              disabled={!(canAct && phase === 'action')}
              onClick={() => dispatch({ type: 'PLAY', payload: { cardId: c.id } })}
              style={{
                width: 130,
                padding: '0.6rem',
                textAlign: 'left',
                cursor: canAct && phase === 'action' ? 'pointer' : 'default',
                opacity: canAct && phase === 'action' ? 1 : 0.6,
              }}
            >
              <Token glyph="✦" color={SEAT_COLORS[2]} size={20} />
              <strong style={{ display: 'block', marginTop: '0.3rem' }}>
                {CARD_LABEL[c.kind]}
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--tt-muted)' }}>
                {CARD_TEXT[c.kind]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

registerView<RelicState>('relic-run', RelicRunView);
export default RelicRunView;
