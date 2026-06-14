/**
 * Game definition registry — the single place the rest of the app looks up
 * playable games by id. New games register here and instantly appear in the
 * gallery, lobby and router with zero engine changes.
 */
import type { GameDefinition } from './types';

const registry = new Map<string, GameDefinition<any>>();

/** Register a game. Throws on duplicate ids to catch copy-paste mistakes. */
export function registerGame<G>(def: GameDefinition<G>): GameDefinition<G> {
  if (registry.has(def.id)) {
    throw new Error(`A game with id "${def.id}" is already registered.`);
  }
  registry.set(def.id, def as GameDefinition<any>);
  return def;
}

export function getGame(id: string): GameDefinition<any> | undefined {
  return registry.get(id);
}

export function listGames(): GameDefinition<any>[] {
  return [...registry.values()];
}

export function hasGame(id: string): boolean {
  return registry.has(id);
}
