/** Crown Rush table view: stock + discard piles, your hidden hand, opponents. */
import { useState } from 'react';
import { Zones } from '../../engine';
import { CardFan, Pile } from '../../ui/assets';
import { PlayerBadge } from '../../ui/components';
import { handOf, handZone, type CrownState, type DrawFrom } from '../crown-rush';
import { registerView } from './registry';
import type { GameViewProps } from './types';

function CrownRushView({ state, dispatch, viewerId, canAct }: GameViewProps<CrownState>) {
  const game = state.game;
  const [selected, setSelected] = useState<string | null>(null);
  const myHand = handOf(game, viewerId);
  const stock = Zones.cardsIn(game.zones, 'stock');
  const discard = Zones.cardsIn(game.zones, 'discard');
  const opponents = state.players.filter((p) => p.id !== viewerId);

  const draw = (from: DrawFrom) => dispatch({ type: 'DRAW', payload: { from } });
  const discardCard = (cardId: string) => {
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
            <CardFan
              cards={Zones.cardsIn(game.zones, handZone(p.id))}
              width={52}
              overlap={34}
              forceBack
            />
          </div>
        ))}
      </div>

      {/* Center: stock + discard */}
      <div
        className="tt-felt"
        style={{ display: 'flex', gap: '2.5rem', justifyContent: 'center', padding: '1.5rem' }}
      >
        <Pile
          cards={stock}
          label="Stock"
          forceBack
          onClick={canAct && !game.hasDrawn ? () => draw('stock') : undefined}
          ariaLabel="Draw from stock"
        />
        <Pile
          cards={discard}
          label="Discard"
          showCount={false}
          onClick={canAct && !game.hasDrawn && discard.length > 0 ? () => draw('discard') : undefined}
          ariaLabel="Draw from discard"
        />
      </div>

      {/* Your hand */}
      <div style={{ display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
        <div style={{ color: 'var(--tt-muted)' }}>
          {game.hasDrawn ? 'Select a card to discard' : 'Draw a card to start your turn'}
        </div>
        <CardFan
          cards={myHand}
          selectedId={selected}
          onCardClick={
            canAct && game.hasDrawn
              ? (c) => (selected === c.id ? discardCard(c.id) : setSelected(c.id))
              : undefined
          }
        />
        {canAct && game.hasDrawn && selected && (
          <button className="tt-btn tt-btn--primary" onClick={() => discardCard(selected)}>
            Discard selected
          </button>
        )}
      </div>
    </div>
  );
}

registerView<CrownState>('crown-rush', CrownRushView);
export default CrownRushView;
