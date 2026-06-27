import { visualizer } from 'rollup-plugin-visualizer';
/**
 * packages/renderer/vite.config.ts
 *
 * Renderer-only Vite config for browser dev mode (`npm run dev:web` on :4243).
 * The Electron desktop build still uses electron.vite.config.ts at the repo
 * root — keep these two files in sync for `resolve.alias` and any plugin
 * additions, otherwise web-only and desktop will drift.
 *
 * History: this file was missing on 2026-05-05 — `npm run dev:web` invoked
 * plain `vite --config electron.vite.config.ts`, which silently fell back to
 * repo root and served index.html for every request including /src/main.tsx.
 * That returned HTML where the browser expected a script module, producing a
 * spinner that never resolves because the entry never executed.
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const repoRoot = resolve(__dirname, '..', '..');

const envSanitizerPlugin = () => ({
    name: 'env-sanitizer',
    configResolved(config) {
        const secrets = [
            'VITE_PINATA_SECRET',
            'VITE_PINATA_JWT',
            'VITE_DOCUSIGN_ACCESS_TOKEN',
            'VITE_NGROK_AUTHTOKEN',
            'VITE_PRINTFUL_API_KEY',
            'VITE_MEM0_API_KEY',
            'VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN',
            'VITE_GOOGLE_MAPS_API_KEY',
            'VITE_GOOGLE_MAPS_KEY',
        ];
        for (const key of secrets) {
            if (key in config.env) {
                delete config.env[key];
            }
        }
        const whitelist = new Set([
            'VITE_FIREBASE_API_KEY',
        ]);
        for (const key of Object.keys(config.env)) {
            const val = config.env[key];
            if (typeof val === 'string' && val.includes('AIza') && !whitelist.has(key)) {
                delete config.env[key];
            }
        }
    }
});

const apiFallbackPlugin = () => ({
    name: 'api-fallback',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            const url = req.url;
            if (url && (url === '/api' || url.startsWith('/api/') || url.startsWith('/api?'))) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `API endpoint ${url} not found on local dev server. Use Firebase emulator or local main process instead.`
                    }
                }));
                return;
            }
            next();
        });
    },
    configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
            const url = req.url;
            if (url && (url === '/api' || url.startsWith('/api/') || url.startsWith('/api?'))) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `API endpoint ${url} not found on built preview server. Use Firebase hosting API routing in production.`
                    }
                }));
                return;
            }
            next();
        });
    }
});

export default defineConfig({
    root: __dirname,
    envDir: repoRoot,
    envPrefix: [
        'VITE_E2E',
        'VITE_FIREBASE_',
        'VITE_VERTEX_',
        'VITE_FUNCTIONS_',
        'VITE_USE_',
        'VITE_INGESTION_',
        'VITE_ENABLE_',
        'VITE_SHOW_',
        'VITE_SKIP_',
        'VITE_A0_',
        'VITE_APP_TARGET',
        'VITE_APP_VERSION',
        'VITE_RAG_',
        'VITE_ADMIN_PIN',
        'VITE_WALLETCONNECT_PROJECT_ID',
        'VITE_EXPOSE_',
    ],
    plugins: [
        react(),
        tailwindcss(),
        visualizer({
            filename: resolve(repoRoot, 'dist/renderer/stats.html'),
            title: 'Indii Music Production Bundle Audit',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
        }),
        envSanitizerPlugin(),
        apiFallbackPlugin()
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@agents': resolve(repoRoot, 'agents'),
            '@shared': resolve(repoRoot, 'packages/shared/src'),
            'react': resolve(repoRoot, 'node_modules/react'),
            'react-dom': resolve(repoRoot, 'node_modules/react-dom'),
            '@remotion/renderer': resolve(__dirname, 'src/services/video/remotion-mock.ts'),
            '@remotion/cloudrun/client': resolve(__dirname, 'src/services/video/remotion-mock.ts'),
        },
    },
    server: {
        port: 4243,
        host: 'localhost',
        strictPort: true,
        fs: {
            allow: [repoRoot],
        },
        watch: {
            ignored: [
                '**/node_modules/**',
                '**/.git/**',
                '**/.agent/**',
                '**/dist/**',
                '**/artifacts/**',
            ],
        },
    },
    build: {
        outDir: resolve(repoRoot, 'dist/renderer'),
        sourcemap: true,
        chunkSizeWarningLimit: 2500,
        rollupOptions: {
            external: [
                '@remotion/renderer',
                '@remotion/cloudrun',
                '@remotion/cloudrun/client',
                'fs',
                'path',
                'child_process',
                'util'
            ],
            input: {
                index: resolve(__dirname, 'index.html'),
            },
            output: {
                manualChunks(id) {
                    const m = id.match(/[\\/]node_modules[\\/](?:\.pnpm[\\/](?:@[^\\/]+\+)?[^\\/]+[\\/]node_modules[\\/])?(@[^\\/]+[\\/][^\\/]+|[^\\/]+)/);
                    if (!m) return undefined;
                    const pkg = m[1];

                    if (pkg === 'three' || pkg.startsWith('@react-three/')) {
                        return 'vendor-three';
                    }
                    if (pkg === 'fabric') {
                        return 'vendor-fabric';
                    }
                    if (pkg === 'wavesurfer.js' || pkg === 'wavesurfer' || pkg === 'essentia.js' || pkg.startsWith('essentia')) {
                        return 'vendor-audio';
                    }
                    if (pkg === 'recharts' || pkg.startsWith('d3-')) {
                        return 'vendor-recharts';
                    }
                    if (pkg === 'framer-motion' || pkg === 'motion') {
                        return 'vendor-motion';
                    }
                    if (pkg === 'firebase' || pkg.startsWith('@firebase/')) {
                        return 'vendor-firebase';
                    }
                    if (pkg === 'video.js' || pkg.startsWith('@videojs/') || pkg.startsWith('videojs-')) {
                        return 'vendor-video';
                    }
                    if (pkg === 'lucide-react') {
                        return 'vendor-lucide';
                    }
                    if (pkg === 'pdfjs-dist') {
                        return 'vendor-pdfjs';
                    }
                    if (pkg === 'tesseract.js' || pkg.startsWith('tesseract.js-')) {
                        return 'vendor-tesseract';
                    }
                    if (pkg === 'reactflow' || pkg.startsWith('@reactflow/')) {
                        return 'vendor-reactflow';
                    }
                    if (pkg === 'yjs' || pkg === 'y-websocket' || pkg === 'y-protocols') {
                        return 'vendor-yjs';
                    }
                    if (pkg === 'remotion' || pkg.startsWith('@remotion/')) {
                        return 'vendor-remotion';
                    }
                    // Internationalization (i18n)
                    if (pkg === 'i18next' || pkg === 'react-i18next' || pkg.startsWith('i18next-')) {
                        return 'vendor-i18n';
                    }
                    // UI Utilities & Primitives
                    if (
                        pkg === 'react-virtuoso' ||
                        pkg === 'tailwind-merge' ||
                        pkg === 'driver.js' ||
                        pkg === 'clsx' ||
                        pkg === 'classnames' ||
                        pkg.startsWith('@radix-ui/') ||
                        pkg === 'zod' ||
                        pkg === 'zod-to-json-schema' ||
                        pkg === 'zustand'
                    ) {
                        return 'vendor-ui';
                    }
                    if (
                        pkg === 'react' ||
                        pkg === 'react-dom' ||
                        pkg === 'react-router' ||
                        pkg === 'react-router-dom' ||
                        pkg === '@remix-run/router' ||
                        pkg === 'scheduler' ||
                        pkg === 'react-is'
                    ) {
                        return 'vendor-react';
                    }
                    return undefined;
                }
            }
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: [resolve(__dirname, 'src/test/setup.ts')],
        globals: true,
        clearMocks: true,
        restoreMocks: true,
        environmentOptions: {
            url: 'http://localhost/'
        }
    }
});
