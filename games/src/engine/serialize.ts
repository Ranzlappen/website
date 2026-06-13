/**
 * Stable serialization for save/load and network transport.
 *
 * A {@link MatchState} is plain JSON by construction (no Map/Set/Date/class
 * instances in game state — keep it that way), so serialization is mostly
 * `JSON.stringify` wrapped with a schema version for forward-compatible
 * migrations.
 */
import type { MatchState } from './types';

export const SAVE_SCHEMA_VERSION = 1;

export interface SavedMatch<G = unknown> {
  schema: number;
  savedAt: number;
  state: MatchState<G>;
}

export function serializeMatch<G>(state: MatchState<G>): string {
  const payload: SavedMatch<G> = {
    schema: SAVE_SCHEMA_VERSION,
    savedAt: Date.now(),
    state,
  };
  return JSON.stringify(payload);
}

/**
 * Parse a previously serialized match. Throws on malformed input or an
 * unsupported (newer) schema. Older schemas can be migrated here as the model
 * evolves.
 */
export function deserializeMatch<G>(json: string): SavedMatch<G> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Corrupt save: not valid JSON.');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as SavedMatch).schema !== 'number' ||
    typeof (parsed as SavedMatch).state !== 'object'
  ) {
    throw new Error('Corrupt save: missing schema/state.');
  }
  const save = parsed as SavedMatch<G>;
  if (save.schema > SAVE_SCHEMA_VERSION) {
    throw new Error(
      `Save was written by a newer version (schema ${save.schema}).`,
    );
  }
  return save;
}
