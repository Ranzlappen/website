/**
 * Asset library — original, dependency-free SVG/CSS art used by every game.
 *
 * Nothing here is copyrighted third-party artwork: playing cards, card backs,
 * dice and pawns are all drawn procedurally so they recolour with the active
 * theme and scale crisply to any size. Sizes are driven by the `--w` custom
 * property on `.tt-card` and explicit props elsewhere.
 */
import type { CSSProperties } from 'react';
import { SUIT_COLOR, type Card, type Suit } from '../engine/cards';

const SUIT_GLYPH: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

/** Per-seat palette for pawns, tokens and player badges. */
export const SEAT_COLORS = ['#e0b341', '#52b6d8', '#e2607a', '#7bd87b'];

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

const DIE_PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

/** A six-sided die face. */
export function Die({
  value,
  size = 56,
  rolling,
}: {
  value: number;
  size?: number;
  rolling?: boolean;
}) {
  const pips = DIE_PIPS[value] ?? [];
  const pos = [0.27, 0.5, 0.73];
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={rolling ? 'tt-rolling' : undefined}
      role="img"
      aria-label={`Die showing ${value}`}
    >
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="18"
        fill="var(--tt-card-face)"
        stroke="var(--tt-border)"
        strokeWidth="2"
      />
      {pips.map(([cx, cy], i) => (
        <circle
          key={i}
          cx={pos[cx] * 100}
          cy={pos[cy] * 100}
          r="8"
          fill="var(--tt-card-ink)"
        />
      ))}
    </svg>
  );
}

/** A board pawn coloured by seat. */
export function Pawn({ seat, size = 30 }: { seat: number; size?: number }) {
  const fill = SEAT_COLORS[seat % SEAT_COLORS.length];
  return (
    <svg viewBox="0 0 40 48" width={size} height={size * 1.2} role="img" aria-label={`Pawn ${seat + 1}`}>
      <ellipse cx="20" cy="43" rx="13" ry="4" fill="rgba(0,0,0,0.35)" />
      <path
        d="M20 4 a8 8 0 0 1 6 13 c5 3 7 9 7 16 H7 c0-7 2-13 7-16 a8 8 0 0 1 6-13 Z"
        fill={fill}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1.5"
      />
      <circle cx="20" cy="11" r="4.5" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}

/** A small round token (lantern, relic, chip). */
export function Token({
  glyph,
  color = 'var(--tt-accent)',
  size = 26,
}: {
  glyph: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="tt-pop"
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        color: '#1a1408',
        fontSize: size * 0.55,
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}
