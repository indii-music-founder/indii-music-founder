
/**
 * electron.vite.config.ts — Build orchestrator for the indii monorepo.
 *
 * Three build targets:
 *   - Main:     packages/main/src/main.ts     → Node.js, CJS output
 *   - Preload:  packages/main/src/preload.ts  → Sandboxed, CJS output
 *   - Renderer: packages/renderer/            → DOM, ESM output (React + Tailwind)
 */
import { defineConfig, externalizeDepsPlugin, type Plugin } from 'electron-vite';
import type { ResolvedConfig, Connect } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const envSanitizerPlugin = (): Plugin => ({
    name: 'env-sanitizer',
    configResolved(config: ResolvedConfig) {
        const isProd = config.command === 'build' || config.mode === 'production';
        const secrets = [
            'VITE_PINATA_SECRET',
            'VITE_PINATA_JWT',
            'VITE_DOCUSIGN_ACCESS_TOKEN',
            'VITE_NGROK_AUTHTOKEN',
            'VITE_PRINTFUL_API_KEY',
            'VITE_MEM0_API_KEY',
            ...(isProd ? ['VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN'] : []),
        ];
        for (const key of secrets) {
            if (key in config.env) {
                delete config.env[key];
            }
        }
        // ISSUE-765(d): any new Google API key (identifier, not a secret —
        // see CLAUDE.md §3.1) must be added here explicitly, or the AIza
        // sweep below silently strips it from every build.
        const whitelist = new Set([
            'VITE_FIREBASE_API_KEY',
            'VITE_GOOGLE_MAPS_API_KEY',
            'VITE_GOOGLE_MAPS_KEY',
            'VITE_GOOGLE_OAUTH_CLIENT_ID',
            'VITE_YOUTUBE_API_KEY',
        ]);
        for (const key of Object.keys(config.env)) {
            const val = config.env[key];
            if (typeof val === 'string' && val.includes('AIza') && !whitelist.has(key)) {
                delete config.env[key];
            }
        }
    }
});

const apiFallbackPlugin = (): Plugin => ({
    name: 'api-fallback',
    configureServer(server: { middlewares: Connect.Server }) {
        server.middlewares.use((req: Connect.IncomingMessage, res: import('node:http').ServerResponse, next: Connect.NextFunction) => {
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
    configurePreviewServer(server: { middlewares: Connect.Server }) {
        server.middlewares.use((req: Connect.IncomingMessage, res: import('node:http').ServerResponse, next: Connect.NextFunction) => {
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
    // ── Main Process (Node.js) ──────────────────────────────────────────────
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'dist/main',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'packages/main/src/main.ts'),
                },
                external: [
                    // Native .node addons cannot be bundled by Rollup
                    /\.node$/,
                    'cpu-features',
                    'ssh2',
                    'keytar',
                    'canvas',
                    'bufferutil',
                    'utf-8-validate',
                    // Binary packages that use CJS __dirname / require() internally.
                    // externalizeDepsPlugin may miss these in workspace hoisting.
                    'ffmpeg-static',
                    'ffprobe-static',
                    'fluent-ffmpeg',
                    // Native addon (uses require() for .node bindings)
                    '@ngrok/ngrok',
                    // CJS packages that break in ESM bundles
                    'express',
                    'chokidar',
                    'ws',
                    'ssh2-sftp-client',
                    'electron-store',
                    'electron-log',
                    'electron-squirrel-startup',
                    '@modelcontextprotocol/sdk',
                ],
            },
        },
        // Polyfill __dirname / __filename for ESM output.
        // When "type":"module" in package.json, Node treats .js as ESM
        // but some deps still reference these CJS globals.
        define: {
            __dirname: 'import.meta.dirname',
            __filename: 'import.meta.filename',
        },
        resolve: {
            alias: {
                '@shared': resolve(__dirname, 'packages/shared/src'),
                './libsodium.mjs': resolve(__dirname, 'node_modules/libsodium/dist/modules-esm/libsodium.mjs'),
            },
        },
    },

    // ── Preload Script (Sandboxed) ──────────────────────────────────────────
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'dist/preload',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'packages/main/src/preload.ts'),
                },
                output: {
                    format: 'cjs',
                    entryFileNames: '[name].cjs',
                },
            },
        },
        resolve: {
            alias: {
                '@shared': resolve(__dirname, 'packages/shared/src'),
            },
        },
    },

    // ── Renderer Process (DOM / React) ──────────────────────────────────────
    renderer: {
        root: resolve(__dirname, 'packages/renderer'),
        define: {
            'import.meta.env.VITE_BUILD_SHA': JSON.stringify(
                process.env.GITHUB_SHA || process.env.VITE_BUILD_SHA || 'development',
            ),
        },
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
            'VITE_GOOGLE_',
            'VITE_META_',
            'VITE_SPOTIFY_',
            'VITE_TIKTOK_',
            'VITE_YOUTUBE_',
            'VITE_SENTRY_',
            'VITE_DEBUG_SENTRY',
        ],
        plugins: [
            react(),
            tailwindcss(),
            envSanitizerPlugin(),
            apiFallbackPlugin()
        ],
        build: {
            modulePreload: {
                resolveDependencies(filename, deps) {
                    return deps.filter(dep => {
                        const isHeavy = dep.includes('vendor-three') ||
                                        dep.includes('vendor-fabric') ||
                                        dep.includes('vendor-audio') ||
                                        dep.includes('vendor-recharts') ||
                                        dep.includes('vendor-video') ||
                                        dep.includes('vendor-pdfjs') ||
                                        dep.includes('vendor-tesseract') ||
                                        dep.includes('vendor-reactflow') ||
                                        dep.includes('vendor-yjs') ||
                                        dep.includes('vendor-remotion');
                        return !isHeavy;
                    });
                }
            },
            outDir: resolve(__dirname, 'dist/renderer'),
            sourcemap: true,
            // ISSUE-1202: lowered from 2500 — 1000KB is the realistic threshold
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                external: [
                    'fs',
                    'path',
                    'child_process',
                    'util'
                ],
                input: {
                    index: resolve(__dirname, 'packages/renderer/index.html'),
                },
                output: {
                    // WO-14 + Incident 2026-04-16: Split heavy libraries into named
                    // chunks so each lazy-loaded module only pulls what it needs.
                    //
                    // CRITICAL: Use strict package-name matching, NOT substring.
                    // A previous version used `id.includes('node_modules/react')`
                    // which matched `node_modules/reactflow`, sweeping reactflow
                    // (and its d3-* transitive deps) into vendor-react. Recharts
                    // also uses d3-interpolate, creating a 3-way circular chunk
                    // import:
                    //   vendor-react → vendor-recharts (d3) → vendor-react (React)
                    //   vendor-react → vendor-three (zustand/use-sync) → vendor-react
                    // ESM cycles leave imported bindings `undefined` at top-level
                    // evaluation time, producing
                    //   `Cannot read properties of undefined (reading 'forwardRef')`
                    // inside vendor-recharts and silently killing React before mount.
                    //
                    // Rule: every named vendor chunk must contain ONLY true leaf
                    // packages that don't import anything belonging to another
                    // named vendor chunk.
                    manualChunks(id: string) {
                        // Extract the package name from the id. Handles:
                        //   /node_modules/foo/...            → foo
                        //   /node_modules/@scope/foo/...     → @scope/foo
                        //   /node_modules/.pnpm/foo@x/...    → foo
                        const m = id.match(/[\\/]node_modules[\\/](?:\.pnpm[\\/](?:@[^\\/]+\+)?[^\\/]+[\\/]node_modules[\\/])?(@[^\\/]+[\\/][^\\/]+|[^\\/]+)/);
                        if (!m) return undefined;
                        const pkg = m[1];

                        // Three.js and react-three packages
                        if (pkg === 'three' || pkg.startsWith('@react-three/')) {
                            return 'vendor-three';
                        }
                        // Fabric.js
                        if (pkg === 'fabric') {
                            return 'vendor-fabric';
                        }
                        // Audio analysis
                        if (pkg === 'wavesurfer.js' || pkg === 'wavesurfer' || pkg === 'essentia.js' || pkg.startsWith('essentia')) {
                            return 'vendor-audio';
                        }
                        // Recharts & D3 dependencies
                        if (pkg === 'recharts' || pkg.startsWith('d3-')) {
                            return 'vendor-recharts';
                        }
                        // Framer Motion
                        if (pkg === 'framer-motion' || pkg === 'motion') {
                            return 'vendor-motion';
                        }
                        // Firebase SDK
                        if (pkg === 'firebase' || pkg.startsWith('@firebase/')) {
                            return 'vendor-firebase';
                        }
                        // Lucide icons
                        if (pkg === 'lucide-react') {
                            return 'vendor-lucide';
                        }
                        // PDFJS Dist
                        if (pkg === 'pdfjs-dist') {
                            return 'vendor-pdfjs';
                        }
                        // Tesseract OCR
                        if (pkg === 'tesseract.js' || pkg.startsWith('tesseract.js-')) {
                            return 'vendor-tesseract';
                        }
                        // React Flow
                        if (pkg === 'reactflow' || pkg.startsWith('@reactflow/')) {
                            return 'vendor-reactflow';
                        }
                        // Collaborative editing (Yjs)
                        if (pkg === 'yjs' || pkg === 'y-websocket' || pkg === 'y-protocols') {
                            return 'vendor-yjs';
                        }
                        // Remotion
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
                        // React ecosystem: core React runtime strictly isolated to prevent circular ESM imports
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
                    },
                },
            },
        },
        resolve: {
            alias: {
                '@': resolve(__dirname, 'packages/renderer/src'),
                '@agents': resolve(__dirname, 'agents'),
                '@shared': resolve(__dirname, 'packages/shared/src'),
                '@remotion/renderer': resolve(__dirname, 'packages/renderer/src/services/video/remotion-mock.ts'),
            },
        },
        server: {
            port: 4243,
            host: '127.0.0.1',
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
    },
});
