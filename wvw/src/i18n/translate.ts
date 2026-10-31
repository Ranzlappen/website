/** Pure lookup (no store / React) — used by the hooks in ./index.ts and by tests. */
import { de } from './de';
import type { Lang } from './lang';

const DICTS: Record<Lang, Record<string, string> | null> = { en: null, de };

export type Vars = Record<string, string | number | null | undefined>;

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const s = DICTS[lang]?.[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] == null ? m : String(vars[k]))) : s;
}
