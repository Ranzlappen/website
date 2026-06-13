/**
 * View registry — maps a game id to its React view. Decoupled from the engine
 * registry so the engine core stays framework-agnostic (no React imports).
 */
import type { GameViewComponent } from './types';

const views = new Map<string, GameViewComponent<any>>();

export function registerView<G>(id: string, comp: GameViewComponent<G>): void {
  views.set(id, comp as GameViewComponent<any>);
}

export function getView(id: string): GameViewComponent<any> | undefined {
  return views.get(id);
}
