/** Visual skins. Each maps to a `[data-theme]` block in index.css. */
export type ThemeId = 'classic' | 'neon' | 'parchment';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  swatch: string;
  blurb: string;
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'classic',
    name: 'Classic Felt',
    swatch: '#1d6a4f',
    blurb: 'Casino-green table, ivory cards, gold accents.',
  },
  {
    id: 'neon',
    name: 'Neon Arcade',
    swatch: '#21e6c1',
    blurb: 'Dark glass with cyan/magenta glow.',
  },
  {
    id: 'parchment',
    name: 'Parchment',
    swatch: '#a8521f',
    blurb: 'Warm paper and ink — fantasy tabletop.',
  },
];

const KEY = 'tabletop:theme';

export function loadTheme(): ThemeId {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'classic' || t === 'neon' || t === 'parchment') return t;
  } catch {
    /* ignore */
  }
  return 'classic';
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}
