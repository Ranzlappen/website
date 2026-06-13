/** Crown Rush table view: stock + discard piles, your hidden hand, opponents. */
import { useState } from 'react';
import { Cards } from '../../engine';
import { PlayingCard } from '../../ui/assets';
import { PlayerBadge } from '../../ui/components';
import type { CrownState } from '../crown-rush';
import { registerView } from './registry';
import type { GameViewProps } from './types';

function CrownRushView({ state, dispatch, viewerId, canAct }: GameViewProps<CrownState>) {
  const game = state.game;
  const [selected, setSelected] = useState<string | null>(null);
  const myHand = game.hands[viewerId] ?? [];
  const discardTop = Cards.topOf(game.discard);
  const opponents = state.players.filter((p) => p.id !== viewerId);

  const draw = (from: 'stock' | 'discard') => dispatch({ type: 'DRAW', payload: { from } });
  const discard = (cardId: string) => {
    dispatch({ type: 'DISCARD', payload: { cardId } });
    setSelected(null);
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* Opponents */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {opponents.map((p) => (
          <div key={p.id} style={{ display: 'grid', gap: '0.4rem', justifyItems: 'center' }}>
            <PlayerBadge player={p} active={state.turn.current === p.id} />
            <div style={{ display: 'flex' }}>
              {(game.hands[p.id] ?? []).map((c, i) => (
                <div key={c.id} style={{ marginLeft: i ? -34 : 0 }}>
                  <PlayingCard card={c} width={52} forceBack />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Center: stock + discard */}
      <div
        className="tt-felt"
        style={{ display: 'flex', gap: '2.5rem', justifyContent: 'center', padding: '1.5rem' }}
      >
        <div style={{ textAlign: 'center', display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
          <PlayingCard
            card={{ id: 'stock', faceUp: false }}
            onClick={canAct && !game.hasDrawn ? () => draw('stock') : undefined}
            ariaLabel="Draw from stock"
          />
          <span className="tt-chip">Stock · {game.draw.length}</span>
        </div>
        <div style={{ textAlign: 'center', display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
          {discardTop ? (
            <PlayingCard
              card={discardTop}
              onClick={canAct && !game.hasDrawn ? () => draw('discard') : undefined}
              ariaLabel="Draw from discard"
            />
          ) : (
            <div className="tt-card" style={{ opacity: 0.3 }} aria-label="Empty discard" />
          )}
          <span className="tt-chip">Discard</span>
        </div>
      </div>

      {/* Your hand */}
      <div style={{ display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
        <div style={{ color: 'var(--tt-muted)' }}>
          {game.hasDrawn ? 'Select a card to discard' : 'Draw a card to start your turn'}
        </div>
        <div style={{ display: 'flex' }}>
          {myHand.map((c, i) => (
            <div key={c.id} style={{ marginLeft: i ? -22 : 0 }}>
              <PlayingCard
                card={c}
                selected={selected === c.id}
                onClick={
                  canAct && game.hasDrawn
                    ? () => (selected === c.id ? discard(c.id) : setSelected(c.id))
                    : undefined
                }
              />
            </div>
          ))}
        </div>
        {canAct && game.hasDrawn && selected && (
          <button className="tt-btn tt-btn--primary" onClick={() => discard(selected)}>
            Discard selected
          </button>
        )}
      </div>
    </div>
  );
}

registerView<CrownState>('crown-rush', CrownRushView);
export default CrownRushView;
