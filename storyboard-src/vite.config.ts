import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// No API key is defined at build time on purpose: this app is deployed on
// public static hosting, so users supply their own Gemini key at runtime
// (see services/apiKey.ts).
export default defineConfig({
  base: './',
  build: {
    outDir: '../storyboard',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
