import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { useStore, ShotItem } from '@/core/store';
import { v4 as uuidv4 } from 'uuid';
import { extractVideoFrame } from '@/utils/video';
import { functions, db, auth } from '@/services/firebase';
import { MembershipService } from '@/services/MembershipService';
import { QuotaExceededError } from '@/shared/types/errors';

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
        onProgress?: (current: number, total: number) => void;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        const BLOCK_DURATION = 8; // seconds
        const numBlocks = Math.ceil(options.totalDuration / BLOCK_DURATION);
        const results: { id: string, url: string, prompt: string }[] = [];
        let currentFirstFrame = options.firstFrame;

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
            for (let i = 0; i < numBlocks; i++) {
                if (options.onProgress) {
                    options.onProgress(i + 1, numBlocks);
                }

                // Generate 8s block
                const blockResults = await this.generateVideo({
                    prompt: `${options.prompt} (Part ${i + 1}/${numBlocks})`,
                    aspectRatio: options.aspectRatio,
                    resolution: options.resolution,
                    seed: options.seed ? options.seed + i : undefined,
                    negativePrompt: options.negativePrompt,
                    firstFrame: currentFirstFrame,
                });

                if (blockResults.length > 0) {
                    const video = blockResults[0];
                    results.push(video);

                    // Extract last frame for next iteration
                    try {
                        const lastFrameData = await extractVideoFrame(video.url);
                        currentFirstFrame = lastFrameData;
                    } catch (err: unknown) {
                        console.warn(`Failed to extract frame from video ${video.id}, breaking chain.`, err);
                        break;
                    }
                } else {
                    break;
                }
            }
        } catch (e: unknown) {
            console.error("Long Form Generation Error:", e);
            throw e;
        }

        return results;
    }

    async triggerVideoGeneration(options: VideoGenerationOptions & { orgId: string }): Promise<{ jobId: string }> {
        try {
            const { functions } = await import('../firebase');
            const { httpsCallable } = await import('firebase/functions');

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
}

export const VideoGeneration = new VideoGenerationService();
