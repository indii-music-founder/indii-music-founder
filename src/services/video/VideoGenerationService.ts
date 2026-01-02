import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { useStore, ShotItem } from '@/core/store';
import { v4 as uuidv4 } from 'uuid';
import { extractVideoFrame } from '@/utils/video';
import { functions, db, auth } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { MembershipService } from '@/services/MembershipService';
import { QuotaExceededError } from '@/shared/types/errors';

export interface VideoJob {
    id: string;
    prompt: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    videoUrl?: string;
    error?: string;
    createdAt: number;
    updatedAt?: number;
}

export interface VideoGenerationOptions {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    seed?: number;
    negativePrompt?: string;
    model?: string;
    firstFrame?: string;
    lastFrame?: string;
    timeOffset?: number;
    ingredients?: string[];
    duration?: number;
    fps?: number;
    cameraMovement?: string;
    motionStrength?: number;
    shotList?: ShotItem[];
    orgId?: string;
}

export class VideoGenerationServiceImpl {

    private async analyzeTemporalContext(image: string, offset: number, basePrompt: string): Promise<string> {
        try {
            const direction = offset > 0 ? 'future' : 'past';
            const duration = Math.abs(offset);

            const analysisPrompt = `You are a master cinematographer and physics engine.
            Analyze this image frame which represents the ${offset > 0 ? 'START' : 'END'} of a video sequence.
            Context: "${basePrompt}"

            Task: Predict exactly what happens ${duration} seconds into the ${direction}.
            Describe the motion, physics, lighting changes, and character actions that bridge this gap.
            Focus on continuity and logical progression.

            Return a concise but descriptive paragraph (max 50 words) describing the video sequence.`;

            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: image.split(';')[0].split(':')[1], data: image.split(',')[1] } },
                        { text: analysisPrompt }
                    ]
                },
                config: {
                    ...AI_CONFIG.THINKING.HIGH
                }
            });

            return response.text() || "";
        } catch (e) {
            console.warn("Temporal Analysis Failed:", e);
            return "";
        }
    }

    private async checkVideoQuota(count: number = 1): Promise<{ canGenerate: boolean, reason?: string }> {
        try {
            const quota = await MembershipService.checkQuota('video', count);
            return {
                canGenerate: quota.allowed,
                reason: quota.allowed ? undefined : MembershipService.getUpgradeMessage(await MembershipService.getCurrentTier(), 'video')
            };
        } catch (e) {
            console.error("Quota check failed", e);
            return { canGenerate: true }; // Fallback to avoid blocking
        }
    }

    private enrichPrompt(basePrompt: string, settings: { camera?: string, motion?: number, fps?: number }): string {
        let prompt = basePrompt;
        if (settings.camera && settings.camera !== 'Static') {
            prompt += `, cinematic ${settings.camera.toLowerCase()} camera movement`;
        }
        if (settings.motion && settings.motion > 0.8) {
            prompt += `, high dynamic motion`;
        }
        return prompt;
    }

    async generateVideo(options: VideoGenerationOptions): Promise<{ id: string, url: string, prompt: string }[]> {
        // Enforce Authentication
        if (!auth.currentUser) {
            throw new Error("You must be signed in to generate video. Please log in.");
        }

        // Enforce quota check
        const quota = await this.checkVideoQuota(1);
        if (!quota.canGenerate) {
            throw new Error(`Quota exceeded: ${quota.reason}`);
        }

        // Temporal context analysis
        let temporalContext = "";
        if (options.firstFrame || options.lastFrame) {
            const reference = options.firstFrame || options.lastFrame;
            if (reference) {
                temporalContext = await this.analyzeTemporalContext(reference, options.timeOffset || 4, options.prompt);
            }
        }

        // Map internal parameters to AI service expectations
        const enrichedPrompt = this.enrichPrompt(options.prompt, {
            camera: options.cameraMovement,
            motion: options.motionStrength,
            fps: options.fps
        });

        const orgId = useStore.getState().currentOrganizationId;

        const { jobId } = await this.triggerVideoGeneration({
            ...options,
            prompt: enrichedPrompt,
            orgId
        });

        // Return a mock entry that the UI can subscribe to via Firebase
        return [{
            id: jobId,
            url: '',
            prompt: enrichedPrompt
        }];
    }

    async generateLongFormVideo(options: {
        prompt: string;
        totalDuration: number; // in seconds
        aspectRatio?: string;
        resolution?: string;
        seed?: number;
        negativePrompt?: string;
        firstFrame?: string;
        // Options like onProgress are not serializable and handled via subscription now
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        // Enforce Authentication
        if (!auth.currentUser) {
            throw new Error("You must be signed in to generate video. Please log in.");
        }

        const orgId = useStore.getState().currentOrganizationId;
        const jobId = uuidv4();
        const BLOCK_DURATION = 5; // Veo default blocks
        const numBlocks = Math.ceil(options.totalDuration / BLOCK_DURATION);

        // Pre-flight duration quota check
        const durationCheck = await MembershipService.checkVideoDurationQuota(options.totalDuration);
        if (!durationCheck.allowed) {
            const tier = await MembershipService.getCurrentTier();
            throw new QuotaExceededError(
                'video_duration',
                tier,
                `Video duration ${options.totalDuration}s exceeds ${durationCheck.tierName} tier limit of ${durationCheck.maxDuration}s`,
                options.totalDuration,
                durationCheck.maxDuration
            );
        }

        try {
            const triggerLongFormVideoJob = httpsCallable(functions, 'triggerLongFormVideoJob');

            // Generate prompts array for blocks
            const prompts = Array.from({ length: numBlocks }, (_, i) => `${options.prompt} (Segment ${i + 1}/${numBlocks})`);

            await triggerLongFormVideoJob({
                jobId,
                prompts,
                orgId,
                startImage: options.firstFrame,
                totalDuration: options.totalDuration,
                aspectRatio: options.aspectRatio,
                resolution: options.resolution,
                seed: options.seed,
                negativePrompt: options.negativePrompt,
            });

            // Return a mock entry that the UI can subscribe to via Firebase
            // The URL is empty because it's asynchronous
            return [{
                id: jobId,
                url: '',
                prompt: options.prompt
            }];

        } catch (error) {
            console.error("Failed to trigger long-form video generation:", error);
            throw error;
        }
    }

    async triggerVideoGeneration(options: VideoGenerationOptions & { orgId: string }): Promise<{ jobId: string }> {
        try {
            // Re-importing inside function to ensure context but can be top-level
            const triggerVideoJob = httpsCallable(functions, 'triggerVideoJob');

            const jobId = uuidv4();

            await triggerVideoJob({
                ...options,
                jobId,
            });

            return { jobId };
        } catch (error) {
            console.error("Failed to trigger video generation:", error);
            throw error;
        }
    }

    /**
     * Subscribes to the status of a specific video job.
     * Returns an unsubscribe function.
     */
    subscribeToJob(jobId: string, callback: (job: VideoJob | null) => void): Unsubscribe {
        const jobRef = doc(db, 'videoJobs', jobId);

        return onSnapshot(jobRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                callback({
                    id: snapshot.id,
                    prompt: data.prompt,
                    status: data.status,
                    videoUrl: data.videoUrl,
                    error: data.error,
                    createdAt: data.createdAt?.toMillis() || Date.now(),
                    updatedAt: data.updatedAt?.toMillis()
                } as VideoJob);
            } else {
                callback(null);
            }
        }, (error) => {
            console.error(`[VideoGenerationService] Subscription error for ${jobId}:`, error);
        });
    }

    /**
     * One-off check for job status (polling alternative)
     */
    async getJobStatus(jobId: string): Promise<VideoJob | null> {
        return new Promise((resolve, reject) => {
            const unsub = this.subscribeToJob(jobId, (job) => {
                unsub();
                resolve(job);
            });
        });
    }
}

// Export singleton instance and alias for backward compatibility
export const VideoGenerationService = new VideoGenerationServiceImpl();
export const VideoGeneration = VideoGenerationService;
// Also export as default if needed, or keep named exports
export default VideoGenerationService;
