import { firebaseAI } from '../ai/FirebaseAIService';
import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { useStore, ShotItem } from '@/core/store';
import { v4 as uuidv4 } from 'uuid';
import { extractVideoFrame } from '@/utils/video';
import { functions, db, auth } from '@/services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { usageTracker } from '@/services/subscription/UsageTracker';
import { QuotaExceededError } from '@/shared/types/errors';
import { delay } from '@/utils/async';
import { UserProfile } from '@/modules/workflow/types';
import { getVideoConstraints } from '../onboarding/DistributorContext';

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
    userProfile?: UserProfile;
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

            return await firebaseAI.analyzeImage(analysisPrompt, image);
        } catch (e) {
            // Temporal analysis failure should not block generation
            return "";
        }
    }

    private async checkVideoQuota(count: number = 1): Promise<{ canGenerate: boolean, reason?: string }> {
        try {
            const quotaCheck = await subscriptionService.canPerformAction('generateVideo', count);
            return {
                canGenerate: quotaCheck.allowed,
                reason: quotaCheck.allowed ? undefined : quotaCheck.reason
            };
        } catch (e) {
            // Quota check failure should not block generation on fallback
            return { canGenerate: true }; // Fallback to avoid blocking
        }
    }

    private enrichPrompt(basePrompt: string, settings: { camera?: string, motion?: number, fps?: number }, userProfile?: UserProfile): string {
        let prompt = basePrompt;

        if (userProfile) {
            const constraints = getVideoConstraints(userProfile);
            if (constraints.canvas) {
                prompt += `. Optimized for Spotify Canvas (${constraints.canvas.resolution}, vertical 9:16). High visual impact loop.`;
            }
        }

        if (settings.camera && settings.camera !== 'Static') {
            prompt += `, cinematic ${settings.camera.toLowerCase()} camera movement`;
        }
        if (settings.motion && settings.motion > 0.8) {
            prompt += `, high dynamic motion`;
        }
        return prompt;
    }

    private determineTargetAspectRatio(options: { aspectRatio?: string, userProfile?: UserProfile }): string | undefined {
        // 1. Explicit override takes precedence
        if (options.aspectRatio) return options.aspectRatio;

        // 2. Fallback to Distributor Constraints
        if (options.userProfile) {
            const constraints = getVideoConstraints(options.userProfile);
            if (constraints.canvas) {
                return constraints.canvas.aspectRatio;
            }
        }

        return undefined;
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
        let enrichedPrompt = this.enrichPrompt(options.prompt, {
            camera: options.cameraMovement,
            motion: options.motionStrength,
            fps: options.fps
        }, options.userProfile);

        if (temporalContext) {
            enrichedPrompt += ` ${temporalContext}`;
        }

        const targetAspectRatio = this.determineTargetAspectRatio(options);

        const orgId = useStore.getState().currentOrganizationId;

        const { jobId } = await this.triggerVideoGeneration({
            ...options,
            aspectRatio: targetAspectRatio,
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
    async waitForJob(jobId: string, timeoutMs: number = AI_CONFIG.VIDEO.MAX_TIMEOUT_MS): Promise<any> {
        let unsub: (() => void) | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

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

        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Video generation timeout for Job ID: ${jobId}`));
            }, timeoutMs);
        });

        try {
            return await Promise.race([jobPromise, timeoutPromise]);
        } finally {
            if (unsub) unsub();
            if (timeoutId) clearTimeout(timeoutId);
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
        onProgress?: (current: number, total: number) => void;
        userProfile?: UserProfile;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        // Pre-flight duration quota check
        const quotaCheck = await subscriptionService.canPerformAction('generateVideo', options.totalDuration);
        if (!quotaCheck.allowed) {
            const tier = await subscriptionService.getCurrentSubscription().then(s => s.tier);
            throw new QuotaExceededError(
                'video_duration',
                await tier,
                quotaCheck.reason || `Video duration ${options.totalDuration}s exceeds tier limit`,
                options.totalDuration,
                quotaCheck.currentUsage?.limit || options.totalDuration
            );
        }

        const jobId = `long_${uuidv4()}`;
        const orgId = useStore.getState().currentOrganizationId;
        const triggerLongFormVideoJob = httpsCallable(functions, 'triggerLongFormVideoJob');

        // Enrich prompt with distributor context
        const enrichedPrompt = this.enrichPrompt(options.prompt, {}, options.userProfile);

        const targetAspectRatio = this.determineTargetAspectRatio(options);

        // Construct segment-wise prompts for the background worker
        const BLOCK_DURATION = 8;
        const numBlocks = Math.ceil(options.totalDuration / BLOCK_DURATION);
        const prompts = Array.from({ length: numBlocks }, (_, i) =>
            `${enrichedPrompt} (Part ${i + 1}/${numBlocks})`
        );

        await triggerLongFormVideoJob({
            jobId,
            prompts,
            orgId,
            startImage: options.firstFrame,
            totalDuration: options.totalDuration,
            aspectRatio: targetAspectRatio,
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
    }

    async triggerVideoGeneration(options: VideoGenerationOptions & { orgId: string }): Promise<{ jobId: string }> {
        const { functions } = await import('../firebase');
        const { httpsCallable } = await import('firebase/functions');

        const triggerVideoJob = httpsCallable(functions, 'triggerVideoJob');

        const jobId = uuidv4();

        await triggerVideoJob({
            ...options,
            jobId,
        });

        return { jobId };
    }
}

export const VideoGeneration = new VideoGenerationService();
