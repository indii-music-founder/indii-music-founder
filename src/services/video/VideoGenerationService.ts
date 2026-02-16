import { firebaseAI } from '../ai/FirebaseAIService';
import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import type { ShotItem } from '@/core/store';
import { v4 as uuidv4 } from 'uuid';
import { extractVideoFrame } from '@/utils/video';
import { functionsWest1 as functions, db, auth } from '@/services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { usageTracker } from '@/services/subscription/UsageTracker';
import { QuotaExceededError } from '@/shared/types/errors';
import { delay } from '@/utils/async';
import { UserProfile } from '@/modules/workflow/types';
import { getVideoConstraints } from '../onboarding/DistributorContext';
import { VideoGenerationOptionsSchema, VideoGenerationOptions, VideoAspectRatioSchema } from '@/modules/video/schemas';
import { z } from 'zod';
import { InputSanitizer } from '@/services/ai/utils/InputSanitizer';
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';

type VideoAspectRatio = z.infer<typeof VideoAspectRatioSchema>;

/**
 * VideoGenerationService - Client-side orchestrator for AI video production
 * 
 * Handles quota checking, prompt enrichment (cinematography/physics), 
 * temporal context analysis, and triggering both atomic and long-form 
 * Daisychaining video generation via Cloud Functions.
 */
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

    private enrichPrompt(basePrompt: string, settings: { camera?: string, motion?: number, fps?: number, thinking?: boolean }, userProfile?: UserProfile): string {
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

    private determineTargetAspectRatio(options: { aspectRatio?: string, userProfile?: UserProfile }): VideoAspectRatio | undefined {
        // 1. Explicit override takes precedence
        if (options.aspectRatio) return options.aspectRatio as VideoAspectRatio;

        // 2. Fallback to Distributor Constraints
        if (options.userProfile) {
            const constraints = getVideoConstraints(options.userProfile);
            if (constraints.canvas) {
                return constraints.canvas.aspectRatio as VideoAspectRatio;
            }
        }

        return undefined;
    }

    /**
     * Triggers a standard (atomic) video generation job.
     * Enriches the prompt, analyzes temporal context, and invokes the triggerVideoJob function.
     * 
     * @param options - Configuration for the video generation request.
     * @returns A promise resolving to an array containing the jobId placeholder.
     */
    async generateVideo(options: VideoGenerationOptions): Promise<{ id: string, url: string, prompt: string }[]> {
        // Zod Validation
        const validation = VideoGenerationOptionsSchema.safeParse(options);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Invalid video parameters: ${errorMsg}`);
        }

        // Enforce Authentication
        if (!auth.currentUser) {
            throw new Error("You must be signed in to generate video. Please log in.");
        }

        // Enforce quota check
        const quota = await this.checkVideoQuota(1);
        if (!quota.canGenerate) {
            throw new Error(`Quota exceeded: ${quota.reason}`);
        }

        // Security: Sanitize Prompt (Redact PII)
        const sanitizedPrompt = InputSanitizer.sanitize(options.prompt);

        // Temporal context analysis
        let temporalContext = "";
        if (options.firstFrame || options.lastFrame) {
            const reference = options.firstFrame || options.lastFrame;
            if (reference) {
                temporalContext = await this.analyzeTemporalContext(reference, options.timeOffset || 4, options.prompt);
            }
        }

        // Map internal parameters to AI service expectations
        let enrichedPrompt = this.enrichPrompt(sanitizedPrompt, {
            camera: options.cameraMovement,
            motion: options.motionStrength,
            fps: options.fps,
            thinking: options.thinking
        }, options.userProfile);

        if (temporalContext) {
            enrichedPrompt += ` ${temporalContext}`;
        }

        const targetAspectRatio = this.determineTargetAspectRatio(options);

        const { useStore } = await import('@/core/store');
        const orgId = useStore.getState().currentOrganizationId;

        const { jobId } = await this.triggerVideoGeneration({
            ...options,
            aspectRatio: targetAspectRatio,
            prompt: enrichedPrompt,
            orgId
        });

        // Persist video metadata for future retrieval and agent context
        metadataPersistenceService.save('video', {
            jobId,
            prompt: options.prompt,
            enrichedPrompt,
            aspectRatio: targetAspectRatio,
            cameraMovement: options.cameraMovement,
            motionStrength: options.motionStrength,
            duration: options.duration || 4,
            hasFirstFrame: !!options.firstFrame,
            hasLastFrame: !!options.lastFrame,
            generateAudio: options.generateAudio || false,
            model: options.model,
            status: 'pending',
            generatedAt: new Date().toISOString(),
        }, {
            showToasts: false, // Don't spam toasts for background saves
            maxRetries: 1,
            queueOnFailure: true,
        }).catch(err => {
            console.warn('[VideoGeneration] Failed to persist video metadata:', err);
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
        let maxQualityLevel = 0;

        const getQualityLevel = (q?: string): number => {
            if (q === 'pro') return 2;
            if (q === 'flash') return 1;
            return 0;
        };

        return onSnapshot(jobRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const quality = data.output?.metadata?.quality;
                const currentLevel = getQualityLevel(quality);

                // Race Condition Protection:
                // If we have already seen a higher quality result (e.g. Pro),
                // ignore any subsequent lower quality updates (e.g. late arriving Flash).
                if (currentLevel < maxQualityLevel) {
                    return;
                }

                if (currentLevel > maxQualityLevel) {
                    maxQualityLevel = currentLevel;
                }

                callback({ id: snapshot.id, ...data });
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
            unsub = this.subscribeToJob(jobId, async (job) => {
                if (!job) return;

                if (job.status === 'completed' || job.status === 'failed') {
                    if (job.status === 'completed') {
                        // Enforce MIME Type Guard for Veo 3.1 Compliance
                        const mimeType = job.output?.metadata?.mime_type;
                        if (mimeType && mimeType !== 'video/mp4') {
                            reject(new Error(`Security Violation: Invalid MIME type '${mimeType}'. Expected 'video/mp4'.`));
                            return;
                        }

                        // Lens 🎥 Integrity Check: Verify Video Asset Availability (404 Protection)
                        const videoUrl = job.output?.url;
                        if (videoUrl) {
                            try {
                                // HEAD request to verify existence without downloading payload
                                const response = await fetch(videoUrl, { method: 'HEAD' });
                                if (!response.ok) {
                                    reject(new Error(`Asset Integrity Failure: Video URL is unreachable (${response.status}).`));
                                    return;
                                }
                            } catch (e) {
                                // Network error during verification should not block generation unless strictly required.
                                // We log the warning for debugging purposes, but proceed with strict verification logic.
                                console.warn("Lens: Video verification check failed", e);
                            }
                        }

                        resolve(job);
                    } else {
                        // Enhanced Safety Reporting
                        let errorMsg = job.error || 'Video generation failed.';
                        if (job.safety_ratings && Array.isArray(job.safety_ratings)) {
                            const blocked = job.safety_ratings.find((r: any) => r.blocked);
                            if (blocked) {
                                errorMsg = `Safety Violation: ${blocked.category} (${blocked.probability})`;
                            }
                        }
                        reject(new Error(errorMsg));
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

    /**
     * Triggers a long-form (Daisychaining) video generation job.
     * Splices a long request into segments, enriches them, and invokes triggerLongFormVideoJob.
     * 
     * @param options - Configuration for long-form generation including totalDuration.
     * @returns A promise resolving to the main jobId placeholder.
     */
    async generateLongFormVideo(options: {
        prompt: string;
        totalDuration: number;
        aspectRatio?: string;
        resolution?: string;
        seed?: number;
        negativePrompt?: string;
        firstFrame?: string;
        generateAudio?: boolean;
        thinking?: boolean;
        model?: string;
        onProgress?: (current: number, total: number) => void;
        userProfile?: UserProfile;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        // Security: Sanitize Prompt (Redact PII)
        const sanitizedPrompt = InputSanitizer.sanitize(options.prompt);

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
        const { useStore } = await import('@/core/store');
        const orgId = useStore.getState().currentOrganizationId;
        const triggerLongFormVideoJob = httpsCallable(functions, 'triggerLongFormVideoJob');

        // Enrich prompt with distributor context
        const enrichedPrompt = this.enrichPrompt(sanitizedPrompt, {
            thinking: options.thinking
        }, options.userProfile);

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
            aspectRatio: targetAspectRatio,
            startImage: options.firstFrame,
            totalDuration: options.totalDuration,
            options: {
                aspectRatio: targetAspectRatio,
                resolution: options.resolution,
                seed: options.seed,
                generateAudio: options.generateAudio,
                thinking: options.thinking,
                model: options.model,
                negativePrompt: options.negativePrompt,
            }
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
        const triggerVideoJob = httpsCallable(functions, 'triggerVideoJob');

        const jobId = uuidv4();

        await triggerVideoJob({
            ...options,
            generateAudio: options.generateAudio,
            jobId,
        });

        return { jobId };
    }
}

export const VideoGeneration = new VideoGenerationService();
