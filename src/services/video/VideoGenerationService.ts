import { functions, db } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { useStore, ShotItem } from '@/core/store';
import { v4 as uuidv4 } from 'uuid';
import { functions, db, auth } from '@/services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { MembershipService } from '@/services/MembershipService';
import { QuotaExceededError } from '@/shared/types/errors';
import { delay } from '@/utils/async';
import { functions, db } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

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
    aspectRatio?: '16:9' | '9:16' | '1:1';
    duration?: '5s' | '10s';
    style?: string;
}

export class VideoGenerationService {

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
            url: '', // Empty URL signifies an async job
            prompt: enrichedPrompt
        }];
    }

    /**
     * Subscribes to a video job status.
     */
    subscribeToJob(jobId: string, callback: (job: any) => void): () => void {
        const jobRef = doc(db, 'videoJobs', jobId);
        return onSnapshot(jobRef, (snapshot) => {
            if (snapshot.exists()) {
                callback({ id: snapshot.id, ...snapshot.data() });
            } else {
                callback(null);
            }
        });
    }

    /**
     * Await a job to reach a terminal state (completed or failed).
     */
    async waitForJob(jobId: string, timeoutMs: number = 300000): Promise<any> {
        let unsub: (() => void) | undefined;

        const jobPromise = new Promise((resolve, reject) => {
            unsub = this.subscribeToJob(jobId, (job) => {
                if (!job) return;
                if (job.status === 'completed' || job.status === 'failed') {
                    if (job.status === 'completed') {
                        resolve(job);
                    } else {
                        reject(new Error(job.error || 'Video generation failed.'));
                    }
                }
            });
        });

        const timeoutPromise = delay(timeoutMs).then(() => {
            throw new Error(`Video generation timeout for Job ID: ${jobId}`);
        });

        try {
            return await Promise.race([jobPromise, timeoutPromise]);
        } finally {
            if (unsub) unsub();
        }
    }

    async generateLongFormVideo(options: {
        prompt: string;
        totalDuration: number;
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
        const triggerLongFormVideoJob = httpsCallable(functions, 'triggerLongFormVideoJob');
        const jobId = uuidv4();
        const orgId = useStore.getState().currentOrganizationId;

        // Generate prompts for segments (server will handle daisychaining)
        const BLOCK_DURATION = 5; // Veo generates 5s clips
        const numSegments = Math.ceil(options.totalDuration / BLOCK_DURATION);
        const prompts = Array.from({ length: numSegments }, (_, i) =>
            `${options.prompt} (Part ${i + 1}/${numSegments})`
        );

        // Explicitly map properties to avoid spreading non-serializable objects (like onProgress)
        // and to match backend schema.
        await triggerLongFormVideoJob({
            jobId,
            prompts,
            orgId,
            totalDuration: options.totalDuration,
            startImage: options.firstFrame,
            // Pass specific options expected by VideoJobSchema
            options: {
                aspectRatio: options.aspectRatio || "16:9",
                resolution: options.resolution,
                seed: options.seed,
                negativePrompt: options.negativePrompt
            }
        });

        // Return a placeholder for the parent job
        return [{
            id: jobId,
            url: '', // Will be updated when completed
            prompt: options.prompt
        }];
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
            const jobId = `long_${uuidv4()}`;
            const orgId = useStore.getState().currentOrganizationId;
            const triggerLongFormVideoJob = httpsCallable(functions, 'triggerLongFormVideoJob');

            await triggerLongFormVideoJob({
                jobId,
                prompts: [options.prompt], // Array wrapper for initial prompt
                orgId,
                startImage: options.firstFrame,
                totalDuration: options.totalDuration,
                aspectRatio: options.aspectRatio,
                resolution: options.resolution,
                seed: options.seed,
                negativePrompt: options.negativePrompt,
            });

            // Return a placeholder list with the main jobId
            // The UI will subscribe to this jobId and see updates as progress changes
            return [{
                id: jobId,
                url: '',
                prompt: options.prompt
            }];

        } catch (e: unknown) {
            console.error("Long Form Generation Error:", e);
            throw e;
        }
    }
class VideoGenerationServiceImpl {
    /**
     * Triggers a video generation job via Cloud Functions.
     * Returns the jobId for tracking.
     */
    async generateVideo(prompt: string, options: VideoGenerationOptions = {}): Promise<string> {
        const jobId = uuidv4();
        const triggerFn = httpsCallable(functions, 'triggerVideoJob');

        try {
            const { functions } = await import('../firebase');
            const { httpsCallable } = await import('firebase/functions');

            const triggerVideoJob = httpsCallable(functions, 'triggerVideoJob');

            const jobId = uuidv4();

            await triggerVideoJob({
                ...options,
            await triggerFn({
                jobId,
                prompt,
                ...options
            });
            return jobId;
        } catch (error) {
            console.error('[VideoGenerationService] Failed to trigger job:', error);
            throw error;
        }
    }
}

export const VideoGeneration = new VideoGenerationService();

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
                    prompt: data.prompt, // Note: Ensure prompt is saved in trigger or update
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

export const VideoGenerationService = new VideoGenerationServiceImpl();
