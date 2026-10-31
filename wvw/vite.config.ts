import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// WvW Hub SPA. Deployed as a subfolder of the Jekyll site at /wvw/ (like
// polyvote / blog-admin / inventory / games). `WVW_BASE` lets the same build
// move to a custom domain root later (`WVW_BASE=/ npm run build`) — the router
// basename and every asset/link derive from import.meta.env.BASE_URL.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.WVW_BASE ?? '/wvw/',
  // The Firebase SDK (auth + firestore + functions) is one ~190 kB gzip chunk.
  build: { chunkSizeWarningLimit: 800 },
});
