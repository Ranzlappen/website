import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The engine core is framework-agnostic and tested in a plain node-style
// environment; the React layer + a few demos use jsdom. jsdom is the
// default so every test file works without per-file environment pragmas.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
