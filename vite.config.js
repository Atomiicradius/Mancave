import { defineConfig } from 'vite';

// Relative base: the built site works from any host or sub-path (Vercel, Netlify, GitHub Pages project sites, a plain folder).
// Asset URLs in src/assets.js are built from import.meta.env.BASE_URL, so they follow this.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 }, // three.js alone is ~700 kB minified; it is loaded once and cached
});
