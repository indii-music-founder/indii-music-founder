import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Load the monorepo-root .env so VITE_FIREBASE_* identifiers resolve here too;
  // without this, src/firebase.ts throws on missing config and the app mounts blank.
  envDir: '../../',
  server: {
    open: true,
    // Route API calls to the Express backend (server.ts) running on :3333,
    // so the dashboard fetches real data from the same origin in dev.
    proxy: {
      '/api': {
        target: process.env.ADMIN_API_TARGET || 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
})
