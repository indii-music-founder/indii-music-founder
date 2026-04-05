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
                ],
            },
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
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'packages/renderer/index.html'),
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
