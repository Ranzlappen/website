/**
 * Demo game catalogue. Importing this module registers every bundled game with
 * the engine registry (each game file calls `registerGame` on load). The app
 * imports this once at startup; everything else discovers games via
 * `listGames()` / `getGame(id)`.
 *
 * To add a game: create `src/games/<id>.ts`, call `registerGame(def)` at the
 * bottom, and add an import line here. No other wiring is required — it appears
 * in the gallery, lobby and router automatically.
 */
export { crownRush } from './crown-rush';
export { lanternHunt } from './lantern-hunt';
export { relicRun } from './relic-run';
