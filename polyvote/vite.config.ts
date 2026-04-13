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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'chart': ['chart.js', 'react-chartjs-2'],
          'firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'framer': ['framer-motion'],
        },
      },
    },
  },
});
