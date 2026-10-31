/** Pure lookup (no store / React) — used by the hooks in ./index.ts and by tests. */
import { de } from './de';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import type { Lang } from './lang';

/** English is the source language (keys); the others map key → translation. */
export const DICTS: Record<Exclude<Lang, 'en'>, Record<string, string>> = { de, fr, es, it };

export type Vars = Record<string, string | number | null | undefined>;

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const s = (lang === 'en' ? undefined : DICTS[lang]?.[key]) ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] == null ? m : String(vars[k]))) : s;
}
