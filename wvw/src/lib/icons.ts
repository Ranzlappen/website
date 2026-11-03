/**
 * Display icons for raid types and "who can join" (client-only; labels come
 * from shared/constants and are translated with t()). Used by the matchup map
 * pins + legend, the calendar chips and the event cards.
 */
import type { EventType, Openness } from '../shared/constants';

export const TYPE_ICON: Record<EventType, string> = {
  zerg: '👥',
  guild: '🏰',
  havoc: '🔥',
  roaming: '🏃',
  ppt: '🚩',
  defense: '🛡️',
  training: '🎓',
  gvg: '⚔️',
};

export const OPENNESS_ICON: Record<Openness, string> = {
  open: '✅',
  guild: '👪',
  invite: '✉️',
};

/** "Open tag — everyone welcome" → "Open tag" (works for the translated labels too). */
export const shortLabel = (label: string) => label.split(' — ')[0];
