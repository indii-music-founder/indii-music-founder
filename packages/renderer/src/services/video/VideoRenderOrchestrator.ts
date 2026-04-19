/**
 * VideoRenderOrchestrator.ts
 *
 * Orchestrates cloud rendering jobs by bridging RenderService and BackgroundJobsSlice.
 * Fulfills PRODUCTION_200 item #104.
 *
 * Cloud Run Architecture:
 * Unlike Lambda (which required a separate polling loop via getRenderProgress),
 * Cloud Run's renderMediaOnCloudrun blocks until completion and reports progress
 * through its built-in updateRenderProgress callback. The orchestrator now wraps
 * this single async call with store updates.
 */

import { renderService, RenderConfig } from './RenderService';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

export class VideoRenderOrchestrator {
    /**
     * Dispatches a video render to Cloud Run and tracks it in the global store.
     *
     * The Cloud Run render is a single blocking call that resolves when the
     * render is complete (progress is reported via the updateRenderProgress
     * callback configured in RenderService). No separate polling loop needed.
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
            // 2. Dispatch to Cloud Run (blocks until completion or crash)
            //    Progress is relayed to the store via the onProgress callback
            //    so the UI bar updates in real-time instead of freezing at 0%.
            const cloudResponse = await renderService.renderCompositionCloud(
                config,
                (pct) => store.updateJobProgress(renderId, pct)
            );

            // 3. Mark complete — Cloud Run resolves only on success (crash throws)
            store.updateJobProgress(renderId, 100);
            store.updateJobStatus(renderId, 'success');

            logger.info(`[VideoRenderer] Cloud Run render ${cloudResponse.renderId} complete.`);

            if (cloudResponse.publicUrl) {
                logger.info(`[VideoRenderer] Output URL: ${cloudResponse.publicUrl}`);
            }

            return cloudResponse.renderId;

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
     * Clean up resources (reserved for future use, e.g. cancellation tokens)
     */
    cleanup() {
        // No polling intervals to clean up with Cloud Run architecture.
        // The render call is a single awaited promise.
    }
}

export const videoRenderOrchestrator = new VideoRenderOrchestrator();
