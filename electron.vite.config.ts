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

                        // Three.js — 3D module only
                        if (pkg === 'three' || pkg.startsWith('@react-three/')) {
                            return 'vendor-three';
                        }
                        // Remotion — video rendering, only loaded by video module
                        if (pkg === 'remotion' || pkg.startsWith('@remotion/')) {
                            return 'vendor-remotion';
                        }
                        // Fabric.js — canvas, only creative module
                        if (pkg === 'fabric') {
                            return 'vendor-fabric';
                        }
                        // Audio analysis — only audio/tools module
                        if (pkg === 'wavesurfer.js' || pkg === 'wavesurfer' || pkg === 'essentia.js' || pkg.startsWith('essentia')) {
                            return 'vendor-audio';
                        }
                        // Recharts — data visualisation, only finance/analytics
                        if (pkg === 'recharts') {
                            return 'vendor-recharts';
                        }
                        // Framer Motion — animations, separate for cache stability
                        if (pkg === 'framer-motion' || pkg === 'motion') {
                            return 'vendor-motion';
                        }
                        // Firebase SDK — large auth/firestore/storage bundle
                        if (pkg === 'firebase' || pkg.startsWith('@firebase/')) {
                            return 'vendor-firebase';
                        }
                        // React ecosystem: ONLY the core React runtime + router.
                        // Do NOT include anything that depends on d3, zustand, or
                        // use-sync-external-store — those must live in the default
                        // chunks to prevent cyclic chunk imports.
                        if (
                            pkg === 'react' ||
                            pkg === 'react-dom' ||
                            pkg === 'react-router' ||
                            pkg === 'react-router-dom' ||
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
            },
        },
        server: {
            port: 4242,
        },
    },
});
