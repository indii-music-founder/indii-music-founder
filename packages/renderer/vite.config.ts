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

export default defineConfig({
    root: __dirname,
    plugins: [
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@agents': resolve(repoRoot, 'agents'),
            '@shared': resolve(repoRoot, 'packages/shared/src'),
        },
    },
    server: {
        port: 4243,
        host: '127.0.0.1',
        strictPort: true,
        // SPA fallback: any non-asset URL falls back to index.html. Vite already
        // does this for the root, but explicit is safer if router routes change.
        fs: {
            // Permit reading files outside the renderer package — the alias
            // targets above point into the monorepo root.
            allow: [repoRoot],
        },
    },
    build: {
        outDir: resolve(repoRoot, 'dist/renderer'),
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'index.html'),
            },
        },
    },
});
