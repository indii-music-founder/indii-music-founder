import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: [
    'VITE_FIREBASE_',
    'VITE_FOUNDER_MODE',
    'VITE_FOUNDER_PREVIEW_ENABLED',
    'VITE_AUTH_HANDOFF_URL',
    'NEXT_PUBLIC_AUTH_HANDOFF_URL',
    'VITE_STUDIO_URL',
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
});
