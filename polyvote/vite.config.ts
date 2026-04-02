/*
 * CHANGE: New file – Vite configuration for PolyVote
 * REASON: Standalone Vite + React project config
 * DATE: 2026-04-02
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/polyvote/',
});
