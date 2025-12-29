/**
 * SceneExtensionService - Enables 60s+ video creation via scene chaining
 *
 * Per Video Editing Improvement Plan Phase 1.1:
 * - Chain multiple video segments using last frame as continuation reference
 * - Maintains visual continuity across segments
 * - Respects MembershipService tier quotas
 */

import { AI } from '../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { MembershipService } from '@/services/MembershipService';
import { QuotaExceededError } from '@/shared/types/errors';

export interface SceneSegment {
    id: string;
    prompt: string;
    durationSeconds: number;
    videoUri?: string;
    status: 'pending' | 'generating' | 'completed' | 'failed';
    error?: string;
}

export interface ExtendedVideoProject {
    id: string;
    prompt: string;
    totalDurationSeconds: number;
    segmentDurationSeconds: number;
    aspectRatio: '16:9' | '9:16' | '1:1';
    resolution: '720p' | '1080p';
    segments: SceneSegment[];
    status: 'idle' | 'generating' | 'completed' | 'failed';
    firstFrame?: { mimeType: string; data: string };
    lastFrame?: { mimeType: string; data: string };
    referenceImages?: { mimeType: string; data: string }[];
    generateAudio?: boolean;
}

export interface SceneExtensionOptions {
    prompt: string;
    totalDurationSeconds: number;
    segmentDurationSeconds?: number; // Default 8s per segment
    aspectRatio?: '16:9' | '9:16' | '1:1';
    resolution?: '720p' | '1080p';
    firstFrame?: { mimeType: string; data: string };
    referenceImages?: { mimeType: string; data: string }[];
    generateAudio?: boolean;
    onProgress?: (project: ExtendedVideoProject) => void;
}

export interface SceneExtensionResult {
    project: ExtendedVideoProject;
    videoUris: string[];
    totalDurationSeconds: number;
}

class SceneExtensionServiceImpl {
    private readonly DEFAULT_SEGMENT_DURATION = 8; // 8 seconds per segment (Veo 3.1 optimal)
    private readonly MAX_SEGMENTS = 10; // Max 10 segments per project
    private readonly MAX_REFERENCE_IMAGES = 3; // Veo 3.1 limit

    /**
     * Create an extended video project with multiple scene segments
     */
    async createExtendedVideo(options: SceneExtensionOptions): Promise<SceneExtensionResult> {
        const segmentDuration = options.segmentDurationSeconds || this.DEFAULT_SEGMENT_DURATION;
        const totalDuration = options.totalDurationSeconds;
        const numSegments = Math.ceil(totalDuration / segmentDuration);

        // Validate segment count
        if (numSegments > this.MAX_SEGMENTS) {
            throw new Error(`Too many segments (${numSegments}). Maximum is ${this.MAX_SEGMENTS} segments.`);
        }

        // Check quota for all segments
        await this.validateQuota(numSegments, totalDuration);

        // Validate reference images
        if (options.referenceImages && options.referenceImages.length > this.MAX_REFERENCE_IMAGES) {
            console.warn(`[SceneExtension] Trimming reference images to ${this.MAX_REFERENCE_IMAGES}`);
            options.referenceImages = options.referenceImages.slice(0, this.MAX_REFERENCE_IMAGES);
        }

        // Create project structure
        const project: ExtendedVideoProject = {
            id: crypto.randomUUID(),
            prompt: options.prompt,
            totalDurationSeconds: totalDuration,
            segmentDurationSeconds: segmentDuration,
            aspectRatio: options.aspectRatio || '16:9',
            resolution: options.resolution || '720p',
            segments: this.createSegments(numSegments, segmentDuration, totalDuration),
            status: 'generating',
            firstFrame: options.firstFrame,
            referenceImages: options.referenceImages,
            generateAudio: options.generateAudio ?? true,
        };

        options.onProgress?.(project);

        // Generate segments sequentially (each uses previous segment's last frame)
        const videoUris: string[] = [];
        let previousLastFrame: { mimeType: string; data: string } | undefined = options.firstFrame;

        for (let i = 0; i < project.segments.length; i++) {
            const segment = project.segments[i];
            segment.status = 'generating';
            options.onProgress?.(project);

            try {
                // Create segment-specific prompt with continuity hint
                const segmentPrompt = i === 0
                    ? options.prompt
                    : `${options.prompt}. Continue the scene seamlessly from the previous shot.`;

                const uri = await this.generateSegment({
                    prompt: segmentPrompt,
                    durationSeconds: segment.durationSeconds,
                    aspectRatio: project.aspectRatio,
                    resolution: project.resolution,
                    firstFrame: previousLastFrame,
                    referenceImages: project.referenceImages,
                    generateAudio: project.generateAudio && i === 0, // Audio only on first segment
                });

                segment.videoUri = uri;
                segment.status = 'completed';
                videoUris.push(uri);

                // Extract last frame for next segment
                if (i < project.segments.length - 1) {
                    previousLastFrame = await this.extractLastFrame(uri);
                    project.lastFrame = previousLastFrame;
                }

                options.onProgress?.(project);

            } catch (error) {
                segment.status = 'failed';
                segment.error = error instanceof Error ? error.message : 'Unknown error';
                project.status = 'failed';
                options.onProgress?.(project);
                throw error;
            }
        }

        project.status = 'completed';
        options.onProgress?.(project);

        // Track usage for all segments
        await this.trackUsage(numSegments, totalDuration);

        return {
            project,
            videoUris,
            totalDurationSeconds: videoUris.length * segmentDuration,
        };
    }

    /**
     * Continue an existing video by extending from its last frame
     */
    async extendVideo(
        existingVideoUri: string,
        prompt: string,
        additionalSeconds: number,
        options?: {
            aspectRatio?: '16:9' | '9:16' | '1:1';
            resolution?: '720p' | '1080p';
            generateAudio?: boolean;
            onProgress?: (status: string) => void;
        }
    ): Promise<string> {
        options?.onProgress?.('Extracting last frame from existing video...');

        // Validate quota
        await this.validateQuota(1, additionalSeconds);

        // Extract last frame from existing video
        const lastFrame = await this.extractLastFrame(existingVideoUri);

        options?.onProgress?.('Generating continuation...');

        // Generate continuation segment
        const uri = await this.generateSegment({
            prompt: `${prompt}. Continue seamlessly from the previous scene.`,
            durationSeconds: additionalSeconds,
            aspectRatio: options?.aspectRatio || '16:9',
            resolution: options?.resolution || '720p',
            firstFrame: lastFrame,
            generateAudio: options?.generateAudio,
        });

        // Track usage
        await this.trackUsage(1, additionalSeconds);

        options?.onProgress?.('Extension complete!');

        return uri;
    }

    /**
     * Generate a single video segment using Veo 3.1
     */
    private async generateSegment(config: {
        prompt: string;
        durationSeconds: number;
        aspectRatio: '16:9' | '9:16' | '1:1';
        resolution: '720p' | '1080p';
        firstFrame?: { mimeType: string; data: string };
        referenceImages?: { mimeType: string; data: string }[];
        generateAudio?: boolean;
    }): Promise<string> {
        const generationConfig: Record<string, unknown> = {
            aspectRatio: config.aspectRatio,
            durationSeconds: config.durationSeconds,
            resolution: config.resolution,
        };

        // Add reference images if provided
        if (config.referenceImages && config.referenceImages.length > 0) {
            generationConfig.referenceImages = config.referenceImages.map((img, index) => ({
                image: { imageBytes: img.data, mimeType: img.mimeType },
                referenceType: index === 0 ? 'STYLE' : 'ASSET',
            }));
        }

        // Enable native audio generation
        if (config.generateAudio) {
            generationConfig.generateAudio = true;
        }

        const uri = await AI.generateVideo({
            model: AI_MODELS.VIDEO.GENERATION,
            prompt: config.prompt,
            image: config.firstFrame
                ? { imageBytes: config.firstFrame.data, mimeType: config.firstFrame.mimeType }
                : undefined,
            config: generationConfig as any,
        });

        return uri;
    }

    /**
     * Extract the last frame from a video URI
     * Uses canvas to capture the final frame
     */
    private async extractLastFrame(videoUri: string): Promise<{ mimeType: string; data: string }> {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.muted = true;

            video.onloadedmetadata = () => {
                // Seek to last frame
                video.currentTime = video.duration - 0.1;
            };

            video.onseeked = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    ctx.drawImage(video, 0, 0);
                    const dataUrl = canvas.toDataURL('image/png');
                    const base64 = dataUrl.split(',')[1];

                    resolve({
                        mimeType: 'image/png',
                        data: base64,
                    });
                } catch (error) {
                    reject(error);
                }
            };

            video.onerror = () => {
                reject(new Error('Failed to load video for frame extraction'));
            };

            video.src = videoUri;
            video.load();
        });
    }

    /**
     * Create segment definitions for the project
     */
    private createSegments(
        numSegments: number,
        segmentDuration: number,
        totalDuration: number
    ): SceneSegment[] {
        const segments: SceneSegment[] = [];

        for (let i = 0; i < numSegments; i++) {
            const isLastSegment = i === numSegments - 1;
            const remainingDuration = totalDuration - (i * segmentDuration);
            const duration = isLastSegment
                ? Math.min(segmentDuration, remainingDuration)
                : segmentDuration;

            segments.push({
                id: crypto.randomUUID(),
                prompt: '', // Will be set during generation
                durationSeconds: duration,
                status: 'pending',
            });
        }

        return segments;
    }

    /**
     * Validate quota before generation
     */
    private async validateQuota(numSegments: number, totalDurationSeconds: number): Promise<void> {
        // Check video generation quota
        const quotaCheck = await MembershipService.checkQuota('video', numSegments);
        if (!quotaCheck.allowed) {
            const tier = await MembershipService.getCurrentTier();
            throw new QuotaExceededError(
                'video',
                tier,
                MembershipService.getUpgradeMessage(tier, 'video'),
                quotaCheck.currentUsage,
                quotaCheck.maxAllowed
            );
        }

        // Check total duration limit
        const durationCheck = await MembershipService.checkVideoDurationQuota(totalDurationSeconds);
        if (!durationCheck.allowed) {
            const tier = await MembershipService.getCurrentTier();
            throw new QuotaExceededError(
                'video',
                tier,
                `Extended video duration (${totalDurationSeconds}s) exceeds ${MembershipService.formatDuration(durationCheck.maxDuration)} limit. ${MembershipService.getUpgradeMessage(tier, 'video')}`,
                totalDurationSeconds,
                durationCheck.maxDuration
            );
        }
    }

    /**
     * Track usage after successful generation
     */
    private async trackUsage(numSegments: number, totalDurationSeconds: number): Promise<void> {
        try {
            const { useStore } = await import('@/core/store');
            const userId = useStore.getState().userProfile?.id;
            if (userId) {
                await MembershipService.incrementUsage(userId, 'video', numSegments, totalDurationSeconds);
            }
        } catch (e) {
            console.warn('[SceneExtension] Failed to track usage:', e);
        }
    }

    /**
     * Get recommended segment count for a duration
     */
    getRecommendedSegments(totalDurationSeconds: number): number {
        return Math.min(
            Math.ceil(totalDurationSeconds / this.DEFAULT_SEGMENT_DURATION),
            this.MAX_SEGMENTS
        );
    }

    /**
     * Get max duration based on tier
     */
    async getMaxDuration(): Promise<number> {
        const tier = await MembershipService.getCurrentTier();
        return MembershipService.getMaxVideoDurationSeconds(tier);
    }
}

export const SceneExtensionService = new SceneExtensionServiceImpl();
