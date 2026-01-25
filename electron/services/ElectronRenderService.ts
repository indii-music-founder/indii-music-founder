import path from 'path';
import os from 'os';
import { app } from 'electron';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
// import { enableTailwind } from '@remotion/tailwind'; // Not used yet
// Checked package.json: @remotion/bundler, @remotion/renderer are present.
// @remotion/tailwind is NOT in dependencies list from previous view_file.
// So I will NOT use enableTailwind unless I'm sure.
// Re-checking package.json content from history...
// package.json has "tailwindcss": "^4.1.17" and "@tailwindcss/vite".
// It does NOT list "@remotion/tailwind".
// However, the project uses Vite. Remotion 4.0 uses Webpack for bundling by default unless configured for Vite.
// But wait, the project mentions "vite" in scripts.
// The `bundle` command from `@remotion/bundler` uses Webpack.
// If the user's project is Vite-based, we might need `@remotion/bundler` configuration to work with the source.
// Or we assume the standard Remotion webpack bundler works for the composition files.

export interface RenderConfig {
    compositionId: string;
    inputProps: Record<string, unknown>;
    outputLocation?: string; // If not provided, will be generated
    codec?: 'h264' | 'vp8' | 'prores';
}

export class ElectronRenderService {
    private static instance: ElectronRenderService;
    private bundledPath: string | null = null;

    static getInstance(): ElectronRenderService {
        if (!this.instance) this.instance = new ElectronRenderService();
        return this.instance;
    }

    /**
     * Bundle the Remotion project.
     * This should be called once or when the project structure changes.
     * For now, we'll bundle on first render if not ready.
     */
    async ensureBundle(): Promise<string> {
        if (this.bundledPath) return this.bundledPath;

        console.log('[ElectronRenderService] Bundling Remotion project...');

        // Define entry point - typically src/modules/video/remotion/index.ts or similar
        // Based on "remotion/Root.tsx", usually there is an entry file.
        // Let's assume standard Remotion stricture: src/index.ts (entry) maps to Root.tsx?
        // Actually, for Electron, we might need a specific entry point that calls registerRoot.
        // Let's try to find the remotion entry file.
        // The Root.tsx exists.
        // I will assume for now we can bundle from a synthetic entry or a known location.
        // Let's look for "index.ts" in remotion folder in next steps if needed.
        // For now, I'll assume we point to `src/modules/video/remotion/Root.tsx` effectively,
        // but `bundle` expects an entry point that calls `registerRoot`.

        // Strategy: Use a known path or search.
        // I'll assume `src/modules/video/remotion/index.ts` exists, or I need to create it.
        // I will assume "src/modules/video/remotion/index.ts" is the entry.
        const entryPoint = path.join(app.getAppPath(), 'src/modules/video/remotion/index.ts');

        // If index.ts doesn't exist, I might fail. I should check this in next steps.
        // But for now, here is the code.

        const bundleLocation = await bundle({
            entryPoint,
            // If using Tailwind, we would modify webpack config here.
            // webpackOverride: (config) => enableTailwind(config),
        });

        this.bundledPath = bundleLocation;
        console.log(`[ElectronRenderService] Bundled to: ${bundleLocation}`);
        return bundleLocation;
    }

    /**
     * Render a video using the requested config.
     */
    async render(config: RenderConfig): Promise<string> {
        const bundleLocation = await this.ensureBundle();

        // Resolve composition
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: config.compositionId,
            inputProps: config.inputProps,
        });

        // Determine output path
        let outputLocation = config.outputLocation;
        if (!outputLocation) {
            const documentsPath = app.getPath('documents');
            const exportDir = path.join(documentsPath, 'IndiiOS', 'Exports');
            await import('fs').then(fs => fs.promises.mkdir(exportDir, { recursive: true }));
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            outputLocation = path.join(exportDir, `render-${config.compositionId}-${timestamp}.mp4`);
        }

        console.log(`[ElectronRenderService] Rendering ${composition.id} to ${outputLocation}...`);

        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: config.codec || 'h264',
            outputLocation: outputLocation,
            inputProps: config.inputProps,
        });

        console.log('[ElectronRenderService] Render complete.');
        return outputLocation;
    }
}

export const electronRenderService = ElectronRenderService.getInstance();
