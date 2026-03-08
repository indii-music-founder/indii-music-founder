/**
 * VideoRenderOrchestrator.ts
 * 
 * Orchestrates cloud rendering jobs by bridging RenderService and BackgroundJobsSlice.
 * Fulfills PRODUCTION_200 item #104.
 */

import { renderService, RenderConfig } from './RenderService';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

export class VideoRenderOrchestrator {
    private activeIntervals: Map<string, NodeJS.Timeout> = new Map();

    /**
     * Dispatches a video render to the cloud and tracks it in the global store.
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
            // 2. Dispatch to Cloud
            const cloudResponse = await renderService.renderCompositionCloud(config);

            // 3. Update job with actual cloud render ID from Lambda
            store.updateJobStatus(renderId, 'running');

            // 4. Start Polling for Progress
            this.pollProgress(renderId, cloudResponse.renderId, cloudResponse.bucketName);

            return cloudResponse.renderId;

        } catch (error: any) {
            logger.error('[VideoRenderer] Render failed to start:', error);
            store.updateJobStatus(renderId, 'error', error.message || 'Render failed to start');
            throw error;
        }
    }

    /**
     * Polls the Remotion Lambda service for progress and updates the store.
     */
    private pollProgress(localJobId: string, cloudRenderId: string, bucketName: string) {
        if (this.activeIntervals.has(localJobId)) return;

        const interval = setInterval(async () => {
            try {
                const store = useStore.getState();
                const progress = await renderService.getCloudRenderProgress(cloudRenderId, bucketName);

                if (progress.fatalErrorEncountered) {
                    this.stopPolling(localJobId);
                    store.updateJobStatus(localJobId, 'error', 'Fatal error during rendering');
                    return;
                }

                if (progress.done) {
                    this.stopPolling(localJobId);
                    store.updateJobProgress(localJobId, 100);
                    store.updateJobStatus(localJobId, 'success');
                    logger.info(`[VideoRenderer] Render ${cloudRenderId} complete.`);
                    return;
                }

                // Update Progress (usually progress.overallProgress is 0-1)
                const percent = Math.round((progress.overallProgress || 0) * 100);
                store.updateJobProgress(localJobId, percent);

            } catch (error: any) {
                logger.warn(`[VideoRenderer] Polling error for ${localJobId}:`, error);
                // We don't stop immediately on one polling error to handle transient network issues
            }
        }, 5000); // Poll every 5 seconds

        this.activeIntervals.set(localJobId, interval);
    }

    private stopPolling(jobId: string) {
        const interval = this.activeIntervals.get(jobId);
        if (interval) {
            clearInterval(interval);
            this.activeIntervals.delete(jobId);
        }
    }

    /**
     * Clean up all polling (e.g., on app close or user logout)
     */
    cleanup() {
        for (const [id, interval] of this.activeIntervals.entries()) {
            clearInterval(interval);
        }
        this.activeIntervals.clear();
    }
}

export const videoRenderOrchestrator = new VideoRenderOrchestrator();
