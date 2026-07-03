/**
 * Card art + card-table primitives. The face/back art is original procedural
 * SVG/CSS (themes recolour it); `CardFan`, `Pile` and `TileCard` are the
 * reusable layout pieces game views compose their tables from.
 */
import type { CSSProperties, ReactNode } from 'react';
import { SUIT_COLOR, type Card, type Suit } from '../../engine/cards';

const SUIT_GLYPH: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export function SuitGlyph({ suit, size = 18 }: { suit: Suit; size?: number }) {
  const color = SUIT_COLOR[suit] === 'red' ? 'var(--tt-card-red)' : 'var(--tt-card-black)';
  return (
    <span style={{ color, fontSize: size, lineHeight: 1 }} aria-hidden>
      {SUIT_GLYPH[suit]}
    </span>
  );
}

export interface PlayingCardProps {
  card: Card;
  width?: number;
  selected?: boolean;
  onClick?: () => void;
  /** Render the back regardless of the card's faceUp flag. */
  forceBack?: boolean;
  ariaLabel?: string;
}

/** A single playing card. Renders the face when face-up, else a themed back. */
export function PlayingCard({
  card,
  width = 76,
  selected,
  onClick,
  forceBack,
  ariaLabel,
}: PlayingCardProps) {
  const style = { '--w': `${width}px` } as CSSProperties;
  const showBack = forceBack || !card.faceUp || !card.rank || !card.suit;
  const interactive = !!onClick;
  const label =
    ariaLabel ??
    (showBack ? 'Face-down card' : `${card.rank} of ${card.suit}`);

  if (showBack) {
    return (
      <div
        className={`tt-card ${interactive ? 'tt-card--button' : ''}`}
        style={style}
        onClick={onClick}
        role={interactive ? 'button' : 'img'}
        tabIndex={interactive ? 0 : undefined}
        aria-label={label}
        onKeyDown={(e) => {
          if (interactive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        <CardBackArt />
      </div>
    );
  }

  const color =
    SUIT_COLOR[card.suit!] === 'red' ? 'var(--tt-card-red)' : 'var(--tt-card-black)';
  return (
    <div
      className={`tt-card ${interactive ? 'tt-card--button' : ''} ${selected ? 'tt-card--selected' : ''}`}
      style={style}
      onClick={onClick}
      role={interactive ? 'button' : 'img'}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? !!selected : undefined}
      aria-label={label}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 7,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: width * 0.2 }}>{card.rank}</span>
        <SuitGlyph suit={card.suit!} size={width * 0.18} />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SuitGlyph suit={card.suit!} size={width * 0.5} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          right: 7,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color,
          fontWeight: 700,
          lineHeight: 1,
          transform: 'rotate(180deg)',
        }}
      >
        <span style={{ fontSize: width * 0.2 }}>{card.rank}</span>
        <SuitGlyph suit={card.suit!} size={width * 0.18} />
      </div>
    </div>
  );
}

/** The lattice pattern used on card backs (recolours with the theme accent). */
export function CardBackArt() {
  return (
    <svg viewBox="0 0 60 84" width="100%" height="100%" aria-hidden>
      <defs>
        <pattern id="tt-back" width="10" height="10" patternUnits="userSpaceOnUse">
          <path
            d="M0 5 L5 0 L10 5 L5 10 Z"
            fill="none"
            stroke="var(--tt-accent)"
            strokeWidth="1"
            opacity="0.7"
          />
        </pattern>
      </defs>
      <rect x="3" y="3" width="54" height="78" rx="7" fill="var(--tt-surface-2)" />
      <rect x="6" y="6" width="48" height="72" rx="5" fill="url(#tt-back)" />
      <rect
        x="6"
        y="6"
        width="48"
        height="72"
        rx="5"
        fill="none"
        stroke="var(--tt-accent)"
        strokeWidth="1.5"
        opacity="0.5"
      />
    </svg>
  );
}

/** An overlapping row of cards — a hand, a meld, an opponent's card backs. */
export function CardFan({
  cards,
  width = 76,
  overlap = 22,
  forceBack,
  selectedId,
  onCardClick,
}: {
  cards: Card[];
  width?: number;
  /** Horizontal overlap between neighbouring cards, in px. */
  overlap?: number;
  forceBack?: boolean;
  selectedId?: string | null;
  onCardClick?: (card: Card) => void;
}) {
  return (
    <div className="tt-hand">
      {cards.map((c, i) => (
        <div key={c.id} style={{ marginLeft: i ? -overlap : 0 }}>
          <PlayingCard
            card={c}
            width={width}
            forceBack={forceBack}
            selected={selectedId === c.id}
            onClick={onCardClick ? () => onCardClick(c) : undefined}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * A card pile (stock, discard, …): the top card (or an empty slot) plus a
 * labelled count chip. Clickable when `onClick` is given.
 */
export function Pile({
  cards,
  label,
  width = 76,
  onClick,
  ariaLabel,
  showCount = true,
  forceBack,
}: {
  cards: Card[];
  label: string;
  width?: number;
  onClick?: () => void;
  ariaLabel?: string;
  /** Append `· N` to the label chip (on for face-down piles by convention). */
  showCount?: boolean;
  forceBack?: boolean;
}) {
  const top = cards[cards.length - 1];
  return (
    <div style={{ textAlign: 'center', display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
      {top ? (
        <PlayingCard
          card={top}
          width={width}
          forceBack={forceBack}
          onClick={onClick}
          ariaLabel={ariaLabel}
        />
      ) : (
        <div
          className="tt-card"
          style={{ '--w': `${width}px`, opacity: 0.3 } as CSSProperties}
          role="img"
          aria-label={ariaLabel ?? `Empty ${label.toLowerCase()} pile`}
        />
      )}
      <span className="tt-chip">
        {label}
        {showCount && ` · ${cards.length}`}
      </span>
    </div>
  );
}

/**
 * A generic non-standard card (action card, event, upgrade…): glyph + title +
 * rules text on a card-shaped tile. Games with custom decks render these
 * instead of drawing bespoke buttons.
 */
export function TileCard({
  title,
  text,
  glyph,
  glyphColor = 'var(--tt-accent)',
  onClick,
  disabled,
  width = 130,
  footer,
}: {
  title: string;
  text?: string;
  glyph?: string;
  glyphColor?: string;
  onClick?: () => void;
  disabled?: boolean;
  width?: number;
  footer?: ReactNode;
}) {
  const interactive = !!onClick && !disabled;
  return (
    <button
      className="tt-panel"
      disabled={!interactive}
      onClick={onClick}
      style={{
        width,
        padding: '0.6rem',
        textAlign: 'left',
        cursor: interactive ? 'pointer' : 'default',
        opacity: interactive ? 1 : 0.6,
      }}
    >
      {glyph && (
        <span
          aria-hidden
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: glyphColor,
            color: '#1a1408',
            fontSize: 11,
          }}
        >
          {glyph}
        </span>
      )}
      <strong style={{ display: 'block', marginTop: glyph ? '0.3rem' : 0 }}>{title}</strong>
      {text && (
        <span style={{ fontSize: '0.78rem', color: 'var(--tt-muted)' }}>{text}</span>
      )}
      {footer}
    </button>
  );
}
