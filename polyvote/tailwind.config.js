/*
 * CHANGE: Updated Tailwind config to use CSS variables for theme switching
 * REASON: Dark/light mode toggle via CSS variables, no per-component dark: variants needed
 * DATE: 2026-04-13
 */
import theme from '../theme.json' with { type: 'json' };

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: theme.brand,
        surface: {
          DEFAULT: 'var(--color-surface)',
          50: 'var(--color-surface-50)',
          100: 'var(--color-surface-100)',
          200: 'var(--color-surface-200)',
          300: 'var(--color-surface-300)',
        },
      },
    },
  },
  plugins: [],
};
