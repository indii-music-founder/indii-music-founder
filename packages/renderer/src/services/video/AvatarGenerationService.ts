/**
 * AvatarGenerationService.ts
 *
 * Orchestrates Autonomous lip-sync and avatar video generation.
 * Connects to SadTalker, HeyGen, or D-ID APIs.
 * Fulfills PRODUCTION_200 item #106.
 */

import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';
import { featureFlags, FEATURE_FLAG_NAMES } from '@/config/featureFlags';
import { auth, functionsWest1 } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

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
            title: `Avatar Lip-Sync: Queuing...`,
            progress: 0,
            status: 'running',
            type: 'video_render'
        });

        try {
            if (!auth.currentUser) {
                throw new Error('You must be signed in to generate avatar video.');
            }

            const dispatchAvatarJob = httpsCallable<
                { imageUrl: string; audioUrl: string },
                { jobId?: string }
            >(functionsWest1, 'dispatchAvatarJob');

            store.updateJobProgress(jobId, 25);
            const response = await dispatchAvatarJob({ imageUrl, audioUrl });
            const backendJobId = response.data.jobId;
            if (!backendJobId) {
                throw new Error('Avatar backend did not return a job ID.');
            }

            store.updateJobProgress(jobId, 100);
            store.updateJobStatus(jobId, 'success');
            logger.info(`[AvatarGen] Avatar job queued: ${backendJobId}`);
            return backendJobId;

        } catch (error: unknown) {
            logger.error(`[AvatarGen] Lip-sync generation failed:`, error);
            store.updateJobStatus(jobId, 'error', error instanceof Error ? error.message : 'Avatar processing failed');
            throw error;
        }
    }

    /**
     * Checks the status of a long-running avatar job (for pollers).
     */
    async checkJobStatus(jobId: string): Promise<AvatarJob> {
        logger.debug(`[AvatarGen] Checking status for ${jobId}`);

        if (!auth.currentUser) {
            throw new Error('You must be signed in to check avatar job status.');
        }

        const getAvatarJobStatus = httpsCallable<
            { jobId: string },
            AvatarJob
        >(functionsWest1, 'getAvatarJobStatus');

        const response = await getAvatarJobStatus({ jobId });
        return response.data;
    }
}

export const avatarGenerationService = new AvatarGenerationService();
