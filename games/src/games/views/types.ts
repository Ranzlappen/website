import type { ReactElement } from 'react';
import type { GameAction, MatchState, PlayerId } from '../../engine';

/**
 * Props every game view receives. Views render only the game-specific "table"
 * (cards, board, tokens, per-game scores). Generic chrome — turn banner, result
 * banner, undo/redo, event log — is supplied by GameSurface around them.
 */
export interface GameViewProps<G = unknown> {
  state: MatchState<G>;
  dispatch: (action: GameAction) => void;
  /** Whose private information to reveal (current player in hot-seat, you online). */
  viewerId: PlayerId;
  /** Whether this device may act for the current player right now. */
  canAct: boolean;
}

export type GameViewComponent<G = unknown> = (
  props: GameViewProps<G>,
) => ReactElement;
