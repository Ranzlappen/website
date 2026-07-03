/**
 * Board primitives — a grid renderer and a loop track. Game views supply only
 * their per-cell content; walls, legal-move highlighting, click/keyboard
 * activation and ARIA wiring are handled here once for every board game.
 */
import type { ReactNode } from 'react';
import { Board } from '../../engine';

/** Shared interactive-cell wrapper (click + Enter/Space + gridcell ARIA). */
function Cell({
  className,
  style,
  ariaLabel,
  onActivate,
  children,
}: {
  className: string;
  style?: React.CSSProperties;
  ariaLabel: string;
  onActivate?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      role="gridcell"
      aria-label={ariaLabel}
      className={className}
      style={style}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (onActivate && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onActivate();
        }
      }}
      tabIndex={onActivate ? 0 : undefined}
    >
      {children}
    </div>
  );
}

/**
 * A square grid board. Walls come from the grid itself; pass the currently
 * reachable cell ids as `legalCells` to highlight them and make them
 * activatable. `renderCell` supplies each cell's content (tokens, pawns…).
 */
export function GridBoard({
  grid,
  legalCells,
  onCellActivate,
  renderCell,
  ariaLabel,
  maxWidth = 460,
}: {
  grid: Board.Grid;
  /** Cell ids that may be activated (highlighted + clickable). */
  legalCells?: ReadonlySet<string>;
  onCellActivate?: (cellId: string) => void;
  renderCell?: (cellId: string, coord: Board.Coord) => ReactNode;
  ariaLabel: string;
  maxWidth?: number;
}) {
  const { width, height } = grid;
  return (
    <div
      className="tt-felt"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${width}, 1fr)`,
        gap: 6,
        padding: '1rem',
        width: `min(100%, ${maxWidth}px)`,
        aspectRatio: `${width} / ${height}`,
      }}
      role="grid"
      aria-label={ariaLabel}
    >
      {Array.from({ length: width * height }, (_, i) => {
        const coord = { x: i % width, y: Math.floor(i / width) };
        const id = Board.cellId(coord);
        const wall = Board.isWall(grid, coord);
        const legal = !!legalCells?.has(id);
        return (
          <Cell
            key={id}
            className={`tt-cell ${wall ? 'tt-cell--wall' : ''} ${legal ? 'tt-cell--legal' : ''}`}
            style={{ position: 'relative' }}
            ariaLabel={`Cell ${coord.x},${coord.y}${wall ? ' wall' : ''}${legal ? ' reachable' : ''}`}
            onActivate={legal && onCellActivate ? () => onCellActivate(id) : undefined}
          >
            {renderCell?.(id, coord)}
          </Cell>
        );
      })}
    </div>
  );
}

/**
 * A linear/looping track of `count` cells rendered as a wrapping strip —
 * race-style boards. `renderCell` supplies each cell's content; overlays
 * (pawns) can be absolutely positioned inside it.
 */
export function LoopTrack({
  count,
  renderCell,
  cellAriaLabel,
  ariaLabel,
  cellSize = 58,
  maxWidth = 560,
}: {
  count: number;
  renderCell: (index: number) => ReactNode;
  cellAriaLabel?: (index: number) => string;
  ariaLabel: string;
  cellSize?: number;
  maxWidth?: number;
}) {
  return (
    <div
      className="tt-felt"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '1rem',
        justifyContent: 'center',
        maxWidth,
      }}
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="tt-cell"
          style={{
            width: cellSize,
            height: cellSize,
            position: 'relative',
            flexDirection: 'column',
          }}
          aria-label={cellAriaLabel?.(i) ?? `Cell ${i + 1}`}
        >
          {renderCell(i)}
        </div>
      ))}
    </div>
  );
}
