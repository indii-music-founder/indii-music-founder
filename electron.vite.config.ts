/**
 * electron.vite.config.ts — Build orchestrator for the indiiOS monorepo.
 *
 * Three build targets:
 *   - Main:     packages/main/src/main.ts     → Node.js, CJS output
 *   - Preload:  packages/main/src/preload.ts  → Sandboxed, CJS output
 *   - Renderer: packages/renderer/            → DOM, ESM output (React + Tailwind)
 */
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
        plugins: [
            react(),
            tailwindcss(),
        ],
        build: {
            outDir: resolve(__dirname, 'dist/renderer'),
            // WO-14: Warn when any chunk exceeds 1 MB (unminified).
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'packages/renderer/index.html'),
                },
                output: {
                    // WO-14: Split heavy libraries into named chunks so each
                    // lazy-loaded module only pulls what it needs, and browsers
                    // can cache these independently across deploys.
                    manualChunks(id: string) {
                        // Three.js — 3D module only
                        if (id.includes('node_modules/three') || id.includes('@react-three')) {
                            return 'vendor-three';
                        }
                        // Remotion — video rendering, only loaded by video module
                        if (id.includes('node_modules/remotion') || id.includes('@remotion')) {
                            return 'vendor-remotion';
                        }
                        // Fabric.js — canvas, only creative module
                        if (id.includes('node_modules/fabric')) {
                            return 'vendor-fabric';
                        }
                        // Audio analysis — only audio/tools module
                        if (id.includes('node_modules/wavesurfer') || id.includes('node_modules/essentia')) {
                            return 'vendor-audio';
                        }
                        // Recharts — data visualisation, only finance/analytics
                        if (id.includes('node_modules/recharts')) {
                            return 'vendor-recharts';
                        }
                        // Framer Motion — animations, separate for cache stability
                        if (id.includes('node_modules/framer-motion')) {
                            return 'vendor-motion';
                        }
                        // Firebase SDK — large auth/firestore/storage bundle
                        if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
                            return 'vendor-firebase';
                        }
                        // React ecosystem: core vendor chunk that changes rarely
                        if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
                            return 'vendor-react';
                        }
                    },
                },
            },
        },
        resolve: {
            alias: {
                '@': resolve(__dirname, 'packages/renderer/src'),
                '@agents': resolve(__dirname, 'agents'),
                '@shared': resolve(__dirname, 'packages/shared/src'),
            },
        },
        server: {
            port: 4242,
        },
    },
});
