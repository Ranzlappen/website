import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tabletop game engine SPA. Deployed as a subfolder of the Jekyll site at
// /games/ (mirrors polyvote / blog-admin / inventory-manager).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/games/',
});
