/**
 * Registers every game's React view. Imported once at app startup (after the
 * game definitions). A new game adds one import line here and one in
 * `src/games/index.ts`.
 */
import './CrownRushView';
import './LanternHuntView';
import './RelicRunView';

export { getView } from './registry';
