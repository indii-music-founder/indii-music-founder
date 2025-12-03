/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    watch: {
      ignored: ['**/temp_comparison_repo_backup/**']
    }
  },
  optimizeDeps: {
    exclude: ['temp_comparison_repo_backup']
  },
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'framer-motion', 'reactflow', 'zustand'],
          'vendor-google': ['@google/genai', '@googlemaps/react-wrapper'],
          'vendor-essentia': ['essentia.js'],
          'vendor-wavesurfer': ['wavesurfer.js'],
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
          'vendor-fabric': ['fabric'],
          'vendor-tone': ['tone'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions', 'firebase/analytics'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/temp_comparison_repo_backup/**', '**/e2e/**', '**/functions/lib/**'], // Exclude e2e and compiled functions from unit tests
  },
});
