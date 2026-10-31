/**
 * Tiny i18n layer (no dependency): English source strings ARE the keys.
 *
 *   const t = useT();
 *   t('Raid calendar')                → "Raid-Kalender" (de)
 *   t(n === 1 ? '{n} raid' : '{n} raids', { n })  → "3 Raids"
 *
 * A missing translation falls back to the English key, so new UI text works
 * immediately and can be translated later (add it to `de.ts`). Labels of the
 * shared option lists (event types, languages, …) are translated the same way:
 * `t(labelOf(EVENT_TYPES, id))`. Dates/numbers follow the language via
 * `lib/format.ts` (setFormatLocale).
 */
import { useCallback } from 'react';
import { useStore } from '../store';
import { translate, type Vars } from './translate';

export { UI_LANGS, type Lang } from './lang';
export { translate, type Vars } from './translate';
export type TFn = (key: string, vars?: Vars) => string;

export function useT(): TFn {
  const lang = useStore((s) => s.lang);
  return useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang]);
}
