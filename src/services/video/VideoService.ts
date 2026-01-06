import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { env } from '@/config/env';
import { MembershipService } from '@/services/MembershipService';
import { QuotaExceededError } from '@/shared/types/errors';

export interface VideoGenerationOptions {
    prompt: string;
    image?: { mimeType: string; data: string }; // Base64 data - used as first frame
    mask?: { mimeType: string; data: string }; // Base64 data
    anchors?: { mimeType: string; data: string }[];
    resolution?: '720p' | '1080p';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    durationSeconds?: number;
    // Veo 3.1 enhanced options
    firstFrame?: { mimeType: string; data: string }; // Explicit first frame control
    lastFrame?: { mimeType: string; data: string }; // Explicit last frame control
    referenceImages?: { mimeType: string; data: string }[]; // Up to 3 reference images
    generateAudio?: boolean; // Enable native audio generation
}

// Local config interface to avoid 'any'
interface GenerationConfig {
    numberOfVideos?: number;
    resolution?: string;
    aspectRatio?: string;
    durationSeconds?: number;
    referenceImages?: Array<{
        image: { imageBytes: string; mimeType: string };
        referenceType: string;
    }>;
    lastFrame?: string;
    generateAudio?: boolean;
}

export class VideoService {

    async generateMotionBrush(image: { mimeType: string; data: string }, mask: { mimeType: string; data: string }): Promise<string | null> {
        try {
            // Step 1: Plan Motion
            const analysisRes = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: image.mimeType, data: image.data } },
                        { inlineData: { mimeType: 'image/png', data: mask.data } },
                        { text: "Describe masked area motion prompt. JSON: {video_prompt}" }
                    ]
                },
                config: { responseMimeType: 'application/json', ...AI_CONFIG.THINKING.HIGH }
            });
            const plan = AI.parseJSON(analysisRes.text());

            // Step 2: Generate Video
            const videoPrompt = typeof plan.video_prompt === 'string' ? plan.video_prompt : "Animate";
            const uri = await AI.generateVideo({
                model: AI_MODELS.VIDEO.GENERATION,
                prompt: videoPrompt,
                image: { imageBytes: image.data, mimeType: image.mimeType },
                config: { aspectRatio: '16:9', durationSeconds: 5 }
            });

            return uri || null;
        } catch (e) {
            console.error("Motion Brush Error:", e);
            throw e;
        }
    }

    async generateVideo(options: VideoGenerationOptions): Promise<string | null> {
        // Pre-flight quota checks (Section 8 compliance)
        const durationSeconds = options.durationSeconds || 5;

        // Check daily generation limit
        const quotaCheck = await MembershipService.checkQuota('video', 1);
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

        // Check video duration limit
        const durationCheck = await MembershipService.checkVideoDurationQuota(durationSeconds);
        if (!durationCheck.allowed) {
            const tier = await MembershipService.getCurrentTier();
            throw new QuotaExceededError(
                'video',
                tier,
                `Video duration exceeds ${MembershipService.formatDuration(durationCheck.maxDuration)} limit for ${durationCheck.tierName} tier. ${MembershipService.getUpgradeMessage(tier, 'video')}`,
                durationSeconds,
                durationCheck.maxDuration
            );
        }

        try {
            const model = AI_MODELS.VIDEO.GENERATION;
            const config: GenerationConfig = {
                numberOfVideos: 1,
                resolution: options.resolution || '720p',
                aspectRatio: options.aspectRatio || '16:9',
                durationSeconds: durationSeconds,
            };

            // Add reference images (up to 3 per Veo 3.1 limit)
            const refImages = options.referenceImages || options.anchors;
            if (refImages && refImages.length > 0) {
                const limitedRefs = refImages.slice(0, 3); // Enforce 3 image limit
                config.referenceImages = limitedRefs.map((img, index) => ({
                    image: { imageBytes: img.data, mimeType: img.mimeType },
                    referenceType: index === 0 ? 'STYLE' : 'ASSET'
                }));
            }

            // Add last frame control for keyframe transitions
            if (options.lastFrame) {
                config.lastFrame = `data:${options.lastFrame.mimeType};base64,${options.lastFrame.data}`;
            }

            // Enable native audio generation
            if (options.generateAudio) {
                config.generateAudio = true;
            }

            // Determine input image (firstFrame takes priority over image)
            const firstFrameSource = options.firstFrame || options.image;
            const inputImage = firstFrameSource
                ? { imageBytes: firstFrameSource.data, mimeType: firstFrameSource.mimeType }
                : undefined;

            const uri = await AI.generateVideo({
                model,
                prompt: options.prompt,
                image: inputImage,
                config: config as unknown as Record<string, unknown>
            });

            // Increment usage counter after successful generation
            if (uri) {
                try {
                    const { useStore } = await import('@/core/store');
                    const userId = useStore.getState().userProfile?.id;
                    if (userId) {
                        await MembershipService.incrementUsage(userId, 'video', 1, durationSeconds);
                    }
                } catch (e) {
                    console.warn('[VideoService] Failed to track usage:', e);
                }
            }

            return uri || null;
        } catch (e) {
            console.error("Video Generation Error:", e);
            throw e;
        }
    }

    async generateKeyframeTransition(startImage: { mimeType: string; data: string }, endImage: { mimeType: string; data: string }, prompt: string): Promise<string | null> {
        try {
            const uri = await AI.generateVideo({
                model: AI_MODELS.VIDEO.GENERATION,
                prompt: prompt || "Transition",
                image: { imageBytes: startImage.data, mimeType: startImage.mimeType },
                config: {
                    aspectRatio: '16:9',
                    durationSeconds: 5,
                    lastFrame: `data:${endImage.mimeType};base64,${endImage.data}`
                }
            });
            return uri || null;
        } catch (e) {
            console.error("Keyframe Transition Error:", e);
            throw e;
        }
    }

    // Helper to fetch the video blob from the URI (which might be a signed URL or API endpoint)
    async fetchVideoBlob(uri: string): Promise<string> {

        // We need to handle the API key injection if it's not already in the URI
        const apiKey = env.apiKey;
        const fetchUrl = uri.includes('key=') ? uri : `${uri}&key=${apiKey}`;

        const res = await fetch(fetchUrl);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }
}

export const Video = new VideoService();
