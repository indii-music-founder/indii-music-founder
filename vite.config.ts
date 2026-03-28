/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

// Enforce minimum Node.js version at build time
const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  throw new Error(`Node.js >= 22.0.0 required (found ${process.versions.node}). See package.json engines field.`);
}

// Sentry source maps upload - only in production builds with auth token
async function loadSentryPlugin() {
  if (process.env.SENTRY_AUTH_TOKEN && process.env.NODE_ENV === 'production') {
    try {
      const { sentryVitePlugin } = await import('@sentry/vite-plugin');
      return sentryVitePlugin({
        org: process.env.SENTRY_ORG || 'indiios',
        project: process.env.SENTRY_PROJECT || 'indii-os',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: `indii-os@${process.env.npm_package_version || '0.0.0'}` },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      });
    } catch {
      console.log('[Build] @sentry/vite-plugin not installed - skipping source map upload');
    }
  }
  return null;
}

const sentryPlugin = await loadSentryPlugin();

export default defineConfig({
  base: './',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'process.env': {},
    'global': 'globalThis',
  },
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
    // ================================================================
    // REMOTE RELAY: HTTP endpoints for phone ↔ desktop communication
    // Phone POSTs messages → server queues them → desktop polls & processes
    // Desktop POSTs responses → server queues them → phone polls & displays
    // No auth needed — local network only (same Vite dev server)
    // ================================================================
    {
      name: 'remote-relay',
      configureServer(server) {
        // In-memory message queues (cleared on server restart)
        const commandQueue: Array<{ id: string; text: string; timestamp: number }> = [];
        const responseQueue: Array<{ id: string; commandId: string; text: string; role: string; timestamp: number; isStreaming?: boolean }> = [];
        // Desktop state that the phone can read
        let desktopState: Record<string, unknown> = {};

        // Helper to parse JSON body from IncomingMessage
        function parseBody(req: import('http').IncomingMessage): Promise<Record<string, unknown>> {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', () => {
              try { resolve(body ? JSON.parse(body) : {}); }
              catch { reject(new Error('Invalid JSON')); }
            });
            req.on('error', reject);
          });
        }

        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';

          // --- Phone → Server: Send a command ---
          if (url === '/api/remote/send' && req.method === 'POST') {
            try {
              const body = await parseBody(req);
              const msg = {
                id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                text: String(body.text || ''),
                timestamp: Date.now(),
              };
              commandQueue.push(msg);
              // Cap queue size
              if (commandQueue.length > 100) commandQueue.splice(0, commandQueue.length - 100);
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ ok: true, id: msg.id }));
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid request' }));
            }
            return;
          }

          // --- Desktop → Server: Poll for new commands ---
          if (url.startsWith('/api/remote/poll') && req.method === 'GET') {
            const sinceParam = new URL(url, 'http://localhost').searchParams.get('since');
            const since = sinceParam ? parseInt(sinceParam, 10) : 0;
            const newCommands = commandQueue.filter(c => c.timestamp > since);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ commands: newCommands }));
            return;
          }

          // --- Desktop → Server: Post a response ---
          if (url === '/api/remote/respond' && req.method === 'POST') {
            try {
              const body = await parseBody(req);
              const resp = {
                id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                commandId: String(body.commandId || ''),
                text: String(body.text || ''),
                role: String(body.role || 'model'),
                timestamp: Date.now(),
                isStreaming: Boolean(body.isStreaming),
              };
              // Replace existing response for same commandId if streaming
              const existingIdx = responseQueue.findIndex(r => r.commandId === resp.commandId);
              if (existingIdx >= 0) {
                responseQueue[existingIdx] = resp;
              } else {
                responseQueue.push(resp);
              }
              if (responseQueue.length > 100) responseQueue.splice(0, responseQueue.length - 100);
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid request' }));
            }
            return;
          }

          // --- Phone → Server: Poll for responses ---
          if (url.startsWith('/api/remote/responses') && req.method === 'GET') {
            const sinceParam = new URL(url, 'http://localhost').searchParams.get('since');
            const since = sinceParam ? parseInt(sinceParam, 10) : 0;
            const newResponses = responseQueue.filter(r => r.timestamp > since);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ responses: newResponses }));
            return;
          }

          // --- Desktop → Server: Push current state ---
          if (url === '/api/remote/state' && req.method === 'POST') {
            try {
              desktopState = await parseBody(req);
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid request' }));
            }
            return;
          }

          // --- Phone → Server: Read desktop state ---
          if (url === '/api/remote/state' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify(desktopState));
            return;
          }

          // --- CORS preflight ---
          if (url.startsWith('/api/remote/') && req.method === 'OPTIONS') {
            res.writeHead(204, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            });
            res.end();
            return;
          }

          next();
        });

        console.log('\x1b[35m%s\x1b[0m', '  📱 Remote Relay active: /api/remote/*');
      }
    },

    // Sentry source map upload (production only, when SENTRY_AUTH_TOKEN is set)
    ...(sentryPlugin ? [sentryPlugin] : []),
    // Item 261: Bundle size analysis (production builds only)
    process.env.ANALYZE === 'true' && visualizer({
      filename: 'reports/bundle-stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: path.resolve(__dirname, 'src'),
      filename: 'service-worker.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Indii OS - Creative Studio',
        short_name: 'Indii',
        description: 'AI-Native music business studio',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'any',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['productivity', 'music', 'creative'],
        shortcuts: [
          {
            name: 'Quick Image',
            short_name: 'Image',
            description: 'Generate AI images instantly',
            url: '/?module=creative',
            icons: [{ src: 'favicon.svg', sizes: 'any' }]
          }
        ],
        share_target: {
          action: '/_share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'files',
                accept: ['image/*', 'audio/*', 'video/*', 'text/plain', 'application/pdf']
              }
            ]
          }
        }
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB for Essentia WASM
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
    chunkSizeWarningLimit: 3000, // Reverted to 3000 as vendor-essentia (WASM) is inherently 2.6MB
    sourcemap: !!process.env.SENTRY_AUTH_TOKEN, // Generate source maps when Sentry upload is configured
    // Use terser for more aggressive console stripping
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs for cleaner production
        drop_debugger: true, // Remove debugger statements
      },
    },
    rollupOptions: {
      // Suppress warnings for Node.js builtins used in Electron-only code paths
      external: ['child_process', 'fs', 'path', 'util', 'crypto', '@remotion/cli', '@remotion/renderer'],
      onwarn(warning, warn) {
        // Suppress CIRCULAR_DEPENDENCY and MODULE_LEVEL_DIRECTIVE warnings from third-party libs
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        // Suppress externalized module warnings from essentia.js (third-party, can't fix)
        if (warning.message?.includes('essentia')) return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const match = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
            if (match) {
              const packageName = match[1];

              // Core React layer (must be grouped to prevent circular errors with scheduler)
              if (['react', 'react-dom', 'react-is', 'scheduler', 'react-router-dom'].includes(packageName)) {
                return 'vendor-react';
              }
              // Isolate massive third-party packages cleanly
              if (packageName === 'three' || packageName.includes('@react-three')) {
                return 'vendor-three';
              }
              if (packageName === 'fabric') return 'vendor-fabric';
              if (packageName.includes('remotion')) return 'vendor-remotion';
              if (packageName.includes('firebase')) return 'vendor-firebase';
              if (packageName === 'essentia.js') return 'vendor-essentia';
              if (packageName === 'wavesurfer.js') return 'vendor-wavesurfer';
              if (packageName === 'pdfjs-dist') return 'vendor-pdf';

              // Map UI ecosystem into a generic UI chunk
              if (packageName.includes('@radix-ui') || packageName === 'lucide-react' || packageName === 'framer-motion') {
                return 'vendor-ui';
              }
            }
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}', 'electron/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/temp_comparison_repo_backup/**', '**/e2e/**', '**/functions/lib/**', '**/.git/**', '**/landing-page/**'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'text-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/services/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        '**/types/**',
        '**/index.ts',
      ],
      thresholds: {
        // Sprint 6B: Enforce minimum 60% coverage on services
        // These are per-category minimums for src/services/ files
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
});
