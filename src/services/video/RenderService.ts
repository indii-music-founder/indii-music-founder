import { renderMedia, RenderMediaOptions } from '@remotion/renderer';
import { CompositionProps } from 'remotion';

export interface RenderConfig {
    compositionId: string;
    outputLocation: string;
    inputProps: Record<string, unknown>;
    codec?: 'h264' | 'vp8';
}

export class RenderService {
    /**
     * Renders a Remotion composition to a local file.
     * Note: This requires a Node.js environment (Electron Main process or Server).
     * In the browser/renderer process, this will throw an error or need a cloud delegate.
     */
    async renderComposition(config: RenderConfig): Promise<string> {
        try {
            console.log(`[RenderService] Starting render for ${config.compositionId}...`);

            // In a real implementation, we would bundle the composition first
            // or point to a pre-bundled serve URL.
            // For this service stub, we assume the bundle logic is handled externally
            // or we use a placeholder bundle path.

            // Mocking the bundle location for the purpose of the service definition
            const bundleLocation = './dist/remotion-bundle';

            await renderMedia({
                composition: {
                    id: config.compositionId,
                    props: config.inputProps as unknown as CompositionProps<any>,
                    width: 1920,
                    height: 1080,
                    fps: 30,
                    durationInFrames: 300, // Default 10s
                },
                serveUrl: bundleLocation,
                codec: config.codec || 'h264',
                outputLocation: config.outputLocation,
            } as RenderMediaOptions);

            console.log(`[RenderService] Render complete: ${config.outputLocation}`);
            return config.outputLocation;

        } catch (error: any) {
            console.error('[RenderService] Render failed:', error);
            throw new Error(`Failed to render composition: ${error.message}`);
        }
    }
}

export const renderService = new RenderService();
