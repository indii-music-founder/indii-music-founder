/**
 * AvatarGenerationService.ts
 *
 * Avatar lip-sync is not wired to a deployed backend worker in this build.
 * The service remains as a boundary so callers can surface an honest
 * unavailable state without referencing undeployed callable names.
 */

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
        void imageUrl;
        void audioUrl;
        throw new Error('Avatar generation is unavailable until the backend worker is deployed.');
    }

    /**
     * Checks the status of a long-running avatar job (for pollers).
     */
    async checkJobStatus(jobId: string): Promise<AvatarJob> {
        void jobId;
        throw new Error('Avatar job status is unavailable until the backend worker is deployed.');
    }
}

export const avatarGenerationService = new AvatarGenerationService();
