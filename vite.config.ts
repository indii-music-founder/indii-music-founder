/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // Custom Startup Log for Developer Clarity
    {
      name: 'startup-log',
      configureServer(server) {
        server.httpServer?.on('listening', () => {
          console.log('\n\x1b[36m%s\x1b[0m', '  🚀 INDII OS - STUDIO (ELECTRON)');
          console.log('\x1b[36m%s\x1b[0m', '  Running at http://localhost:4242');
          console.log('\x1b[90m%s\x1b[0m', '  (Landing Page runs on :3000)\n');
        });
      }
    },
    // Source Code Obfuscation (HEY Audit Appendix D)
    // process.env.NODE_ENV === 'production' && WebpackObfuscator({
    //   rotateStringArray: true,
    //   stringArray: true,
    //   target: 'browser',
    //   debugProtection: true,
    //   controlFlowFlattening: true
    // }, ['node_modules/**']),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Indii OS',
        short_name: 'Indii',
        description: 'AI-Native Creative Studio for Music Business',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB for Essentia WASM
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@agents': path.resolve(__dirname, './agents'),
    },
  },
  server: {
    port: 4242,
    watch: {
      ignored: ['**/temp_comparison_repo_backup/**']
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    }
  },
  optimizeDeps: {
    exclude: ['temp_comparison_repo_backup']
  },
  build: {
    chunkSizeWarningLimit: 3000,
    // Use terser for more aggressive console stripping
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: true, // Remove debugger statements
      },
    },
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
    exclude: ['**/node_modules/**', '**/dist/**', '**/temp_comparison_repo_backup/**', '**/e2e/**', '**/functions/lib/**', '**/.git/**', '**/landing-page/**'], // Exclude e2e, compiled functions, and Next.js landing page from unit tests
  },
});
