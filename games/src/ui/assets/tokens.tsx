/**
 * Token art — pawns, round tokens and the per-seat palette. All original,
 * procedural SVG/CSS: recolours with the active theme and scales crisply.
 */

/** Per-seat palette for pawns, tokens and player badges. */
export const SEAT_COLORS = ['#e0b341', '#52b6d8', '#e2607a', '#7bd87b'];

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
