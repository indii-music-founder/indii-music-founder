import { AI_CONFIG } from '@/core/config/ai-models';

export interface RenderConfig {
    compositionId: string;
    outputLocation?: string;
    inputProps: Record<string, unknown>;
    codec?: 'h264' | 'vp8' | 'prores';
}

export class RenderService {
    /**
     * Renders a Remotion composition to a local file via Electron IPC.
     */
    async renderComposition(config: RenderConfig): Promise<string> {
        try {
            console.info(`[RenderService] Requesting render for ${config.compositionId}...`);

            // @ts-expect-error - electronAPI is exposed via preload
            if (!window.electronAPI?.video?.render) {
                throw new Error('Electron Render API not available');
            }

            // @ts-expect-error - electronAPI type aggregation
            const resultPath = await window.electronAPI.video.render({
                ...config,
                // Apply default timeout or other configs if needed
            });

            console.info(`[RenderService] Render complete: ${resultPath}`);
            return resultPath;

        } catch (error: any) {
            console.error('[RenderService] Render failed:', error);
            throw new Error(`Failed to render composition: ${error.message}`);
        }
    }
}

export const renderService = new RenderService();
