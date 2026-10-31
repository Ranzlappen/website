import { defineConfig } from 'vitest/config';

// Shared logic (time/recurrence, teams, formatting) is pure TS — node env.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
