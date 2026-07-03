/** Relic Run table view: loop track, pawns, dice, relic tokens, action cards. */
import { Die, LoopTrack, Pawn, TileCard, SEAT_COLORS } from '../../ui/assets';
import { PlayerBadge } from '../../ui/components';
import { useRollFlash } from '../../ui/hooks';
import {
  CARD_LABEL,
  CARD_TEXT,
  handOf,
  type CardKind,
  type RelicState,
} from '../relic-run';
import { registerView } from './registry';
import type { GameViewProps } from './types';

const CELL_ICON: Record<string, string> = { relic: '🗿', card: '🃏', empty: '·' };

function RelicRunView({ state, dispatch, viewerId, canAct }: GameViewProps<RelicState>) {
  const game = state.game;
  const rolling = useRollFlash(game.die);
  const phase = state.turn.phase;
  const myHand = handOf(game, viewerId);
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

      <LoopTrack
        count={game.track.length}
        ariaLabel="Relic Run track"
        cellAriaLabel={(i) => `Cell ${i + 1}: ${game.track[i]}`}
        renderCell={(i) => (
          <>
            <span aria-hidden style={{ fontSize: '1.1rem', opacity: 0.8 }}>
              {CELL_ICON[game.track[i]]}
            </span>
            <div style={{ position: 'absolute', bottom: -2, display: 'flex' }}>
              {pawnsAt(i).map((p) => (
                <Pawn key={p.id} seat={p.seat} size={20} />
              ))}
            </div>
          </>
        )}
      />

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
            <TileCard
              key={c.id}
              title={CARD_LABEL[c.kind as CardKind]}
              text={CARD_TEXT[c.kind as CardKind]}
              glyph="✦"
              glyphColor={SEAT_COLORS[2]}
              disabled={!(canAct && phase === 'action')}
              onClick={() => dispatch({ type: 'PLAY', payload: { cardId: c.id } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

registerView<RelicState>('relic-run', RelicRunView);
export default RelicRunView;
