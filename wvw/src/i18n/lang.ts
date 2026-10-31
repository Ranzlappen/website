/** UI languages. Adding one = a dictionary file in this folder + an entry here. */
export const UI_LANGS = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'de', label: 'Deutsch', short: 'DE' },
  { id: 'fr', label: 'Français', short: 'FR' },
  { id: 'es', label: 'Español', short: 'ES' },
  { id: 'it', label: 'Italiano', short: 'IT' },
] as const;
export type Lang = (typeof UI_LANGS)[number]['id'];

export const LANG_KEY = 'wvw.lang';

export const isLang = (v: unknown): v is Lang => UI_LANGS.some((l) => l.id === v);

/** Saved choice › browser language › English. */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  try {
    for (const l of navigator.languages ?? [navigator.language]) {
      const base = l?.slice(0, 2).toLowerCase();
      if (isLang(base)) return base;
    }
  } catch {
    /* no navigator */
  }
  return 'en';
}
