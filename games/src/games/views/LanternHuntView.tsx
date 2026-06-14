/** Lantern Hunt table view: grid board, pawns, lanterns, dice, legal moves. */
import { Board } from '../../engine';
import { Die, Pawn, Token, SEAT_COLORS } from '../../ui/assets';
import { PlayerBadge } from '../../ui/components';
import { useRollFlash } from '../../ui/hooks';
import { legalTargets, type LanternState } from '../lantern-hunt';
import { registerView } from './registry';
import type { GameViewProps } from './types';

function LanternHuntView({ state, dispatch, viewerId, canAct }: GameViewProps<LanternState>) {
  const game = state.game;
  const rolling = useRollFlash(game.die);
  const { width, height } = game.grid;
  const current = state.turn.current;
  const targets = new Set(canAct ? legalTargets(game, current) : []);
  const pawnAt = new Map<string, number>(); // cell -> seat
  for (const p of state.players) {
    pawnAt.set(game.positions[p.id], p.seat);
  }

  const move = (cell: string) => dispatch({ type: 'MOVE', payload: { cell } });

  return (
    <div style={{ display: 'grid', gap: '1.25rem', justifyItems: 'center' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {state.players.map((p) => (
          <PlayerBadge
            key={p.id}
            player={p}
            active={current === p.id}
            you={p.id === viewerId}
            score={game.scores[p.id]}
          />
        ))}
      </div>

      <div
        className="tt-felt"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${width}, 1fr)`,
          gap: 6,
          padding: '1rem',
          width: 'min(92vw, 460px)',
          aspectRatio: '1 / 1',
        }}
        role="grid"
        aria-label="Lantern Hunt board"
      >
        {Array.from({ length: width * height }, (_, i) => {
          const x = i % width;
          const y = Math.floor(i / width);
          const id = Board.cellId({ x, y });
          const wall = Board.isWall(game.grid, { x, y });
          const legal = targets.has(id);
          const seat = pawnAt.get(id);
          const hasLantern = game.lanterns.includes(id);
          return (
            <div
              key={id}
              role="gridcell"
              aria-label={`Cell ${x},${y}${wall ? ' wall' : ''}${legal ? ' reachable' : ''}`}
              className={`tt-cell ${wall ? 'tt-cell--wall' : ''} ${legal ? 'tt-cell--legal' : ''}`}
              style={{ position: 'relative' }}
              onClick={legal ? () => move(id) : undefined}
              onKeyDown={(e) => {
                if (legal && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  move(id);
                }
              }}
              tabIndex={legal ? 0 : undefined}
            >
              {hasLantern && <Token glyph="🏮" color={SEAT_COLORS[1]} size={22} />}
              {seat !== undefined && (
                <span style={{ position: 'absolute', bottom: 0 }}>
                  <Pawn seat={seat} size={26} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {game.die !== null ? (
          <Die value={game.die} rolling={rolling} />
        ) : (
          <button
            className="tt-btn tt-btn--primary"
            disabled={!canAct}
            onClick={() => dispatch({ type: 'ROLL' })}
          >
            🎲 Roll
          </button>
        )}
        {game.die !== null && canAct && (
          <span style={{ color: 'var(--tt-muted)' }}>
            {targets.size > 0
              ? 'Tap a highlighted cell to move'
              : 'No legal move — pass'}
          </span>
        )}
        {game.die !== null && canAct && targets.size === 0 && (
          <button className="tt-btn" onClick={() => move(game.positions[current])}>
            Pass
          </button>
        )}
      </div>
    </div>
  );
}

registerView<LanternState>('lantern-hunt', LanternHuntView);
export default LanternHuntView;
