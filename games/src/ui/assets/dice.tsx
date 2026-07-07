/**
 * Dice art — procedural SVG d6 faces, themed via CSS custom properties.
 */

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

/** A row of dice (multi-die rolls), with a summed accessible label. */
export function DiceTray({
  values,
  size = 48,
  rolling,
}: {
  values: number[];
  size?: number;
  rolling?: boolean;
}) {
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <span
      role="img"
      aria-label={`Dice showing ${values.join(', ')} (total ${total})`}
      style={{ display: 'inline-flex', gap: '0.4rem' }}
    >
      {values.map((v, i) => (
        <span key={i} aria-hidden>
          <Die value={v} size={size} rolling={rolling} />
        </span>
      ))}
    </span>
  );
}
