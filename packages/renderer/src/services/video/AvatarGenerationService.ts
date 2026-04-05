/**
 * AvatarGenerationService.ts
 *
 * Orchestrates AI lip-sync and avatar video generation.
 * Connects to SadTalker, HeyGen, or D-ID APIs.
 * Fulfills PRODUCTION_200 item #106.
 *
 * @mock This service is ENTIRELY MOCKED. `handleProcessingMock()` simulates progress
 *       without calling any real API. Gated behind `enable_avatar_generation` feature flag.
 */

import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';
import { featureFlags, FEATURE_FLAG_NAMES } from '@/config/featureFlags';

export interface AvatarJob {
    id: string;
    sourceImageUrl: string;
    audioUrl: string;
    voiceId?: string; // If using TTS directly
    status: 'pending' | 'processing' | 'completed' | 'failed';
    resultVideoUrl?: string;
    errorMessage?: string;
}

export class AvatarGenerationService {
    /**
     * Triggers a new lip-sync generation joining a static image with an audio track.
     */
    async generateLipSync(imageUrl: string, audioUrl: string): Promise<string> {
        if (!featureFlags.isEnabled(FEATURE_FLAG_NAMES.AVATAR_GENERATION)) {
            throw new Error('Avatar generation is not enabled. Enable the `enable_avatar_generation` feature flag.');
        }

        const store = useStore.getState();
        const jobId = `avr_${Date.now()}`;

        logger.info(`[AvatarGen] Dispatching lip-sync for ${imageUrl} with ${audioUrl}...`);

        // 1. Log job for UI feedback
        store.addJob({
            id: jobId,
            title: `Avatar Lip-Sync: Processing...`,
            progress: 0,
            status: 'running',
            type: 'video_render'
        });

        try {
            // 2. Mock external API call (e.g. POST /v1/heygen/create)
            // In production: const response = await httpsCallable(functions, 'dispatchAvatarJob')({ imageUrl, audioUrl });

            this.handleProcessingMock(jobId);

            return jobId;

        } catch (error: unknown) {
            logger.error(`[AvatarGen] Lip-sync generation failed:`, error);
            store.updateJobStatus(jobId, 'error', error instanceof Error ? error.message : 'Avatar processing failed');
            throw error;
        }
    }

    private handleProcessingMock(jobId: string) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            const store = useStore.getState();
            store.updateJobProgress(jobId, progress);

            if (progress >= 100) {
                clearInterval(interval);
                store.updateJobStatus(jobId, 'success');
                logger.info(`[AvatarGen] Successfully generated avatar video.`);
            }
        }, 3000); // 30-second mock processing window (realistic for avatar gen)
    }

    /**
     * Checks the status of a long-running avatar job (for pollers).
     */
    async checkJobStatus(jobId: string): Promise<AvatarJob> {
        logger.debug(`[AvatarGen] Checking status for ${jobId}`);

        return {
            id: jobId,
            sourceImageUrl: '',
            audioUrl: '',
            status: 'processing'
        };
    }
}

export const avatarGenerationService = new AvatarGenerationService();
