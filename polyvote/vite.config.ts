/*
 * CHANGE: New file – Vite configuration for PolyVote
 * REASON: Standalone Vite + React project config
 * DATE: 2026-04-02
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firestore-api', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firebase-auth', expiration: { maxEntries: 10, maxAgeSeconds: 300 } },
          },
        ],
      },
      manifest: {
        name: 'PolyVote – Multi-Metric Community Voting',
        short_name: 'PolyVote',
        description: 'Vote on topics across multiple dimensions and visualize community consensus.',
        theme_color: '#0b1210',
        background_color: '#0b1210',
        display: 'standalone',
        scope: '/polyvote/',
        start_url: '/polyvote/',
        icons: [
          { src: '/polyvote/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/polyvote/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/polyvote/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  base: '/polyvote/',
  build: {
    rollupOptions: {
      output: {
        // Rolldown (vite 8) requires manualChunks as a function
        manualChunks(id) {
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
            return 'chart';
          }
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            return 'firebase';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'framer';
          }
        },
      },
    },
  },
});
