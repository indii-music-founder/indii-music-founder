/**
 * VideoRenderOrchestrator.ts
 *
 * Orchestrates cloud rendering jobs by bridging RenderService and BackgroundJobsSlice.
 * Fulfills PRODUCTION_200 item #104.
 *
 * Private server-render architecture:
 * The authenticated backend owns admission, provider dispatch, output identity,
 * and terminal readback. This orchestrator only reflects signed lifecycle
 * receipts in the renderer store.
 */

import { renderService, RenderConfig } from './RenderService';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

export class VideoRenderOrchestrator {
    /**
     * Queues a private server render and tracks authorized receipt progress.
     */
    async startRender(config: RenderConfig, title: string) {
        const store = useStore.getState();
        const renderId = `render_${Date.now()}`;

        // 1. Initial Job Entry
        store.addJob({
            id: renderId,
            title,
            progress: 0,
            status: 'running',
            type: 'video_render'
        });

        try {
            const completedReceipt = await renderService.renderCompositionCloud(
                config,
                (pct) => store.updateJobProgress(renderId, pct)
            );

            store.updateJobProgress(renderId, 100);
            store.updateJobStatus(renderId, 'success');

            logger.info(`[VideoRenderer] Private server render ${completedReceipt.renderId} complete.`);
            return completedReceipt.renderId;

        } catch (error: unknown) {
            logger.error('[VideoRenderer] Render failed:', error);
            store.updateJobStatus(
                renderId,
                'error',
                error instanceof Error ? error.message : 'Render failed'
            );
            throw error;
        }
    }

    /**
     * Clean up resources (reserved for future cancellation support).
     */
    cleanup() {
        // RenderService owns bounded polling without persistent timers.
    }
}

export const videoRenderOrchestrator = new VideoRenderOrchestrator();
