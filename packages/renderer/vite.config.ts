import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Standalone Vite config for the renderer (web-only mode)
export default defineConfig({
    root: resolve(__dirname),
    plugins: [
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@agents': resolve(__dirname, '../../agents'),
            '@shared': resolve(__dirname, '../shared/src'),
        },
    },
    server: {
        port: 4243,
        host: '127.0.0.1',
    },
    build: {
        outDir: resolve(__dirname, '../../dist/renderer'),
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'index.html'),
            },
        },
    },
});
