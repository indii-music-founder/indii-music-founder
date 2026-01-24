import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { functionsWest1 as functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { env } from '@/config/env';
// isInlineDataPart removed - remixImage/batchRemix now use Cloud Function
import { getImageConstraints, getDistributorPromptContext, type ImageConstraints } from '@/services/onboarding/DistributorContext';
import type { UserProfile } from '@/modules/workflow/types';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { usageTracker } from '@/services/subscription/UsageTracker';
import { QuotaExceededError } from '@/shared/types/errors';

export interface ImageGenerationOptions {
    prompt: string;
    count?: number;
    aspectRatio?: string;
    resolution?: string;
    seed?: number;
    negativePrompt?: string;
    sourceImages?: { mimeType: string; data: string }[]; // For edit/reference modes
    projectContext?: string;
    // Distributor-aware options
    userProfile?: UserProfile;
    isCoverArt?: boolean; // If true, enforces distributor cover art specs
    // Gemini 3 Configuration
    model?: 'fast' | 'pro';
    thinking?: boolean;
    mediaResolution?: 'low' | 'medium' | 'high';
    useGrounding?: boolean;
}

export interface RemixOptions {
    contentImage: { mimeType: string; data: string };
    styleImage: { mimeType: string; data: string };
    prompt?: string;
}

export class ImageGenerationService {

    /**
     * Get distributor-aware image constraints
     * Returns the image specs required by the user's distributor
     */
    getDistributorConstraints(profile: UserProfile): ImageConstraints {
        return getImageConstraints(profile);
    }

    /**
     * Build a distributor-aware prompt that includes sizing requirements
     */
    private buildDistributorAwarePrompt(options: ImageGenerationOptions): string {
        let prompt = options.prompt;

        // If cover art mode and profile is provided, inject distributor context
        if (options.isCoverArt && options.userProfile) {
            const constraints = getImageConstraints(options.userProfile);
            const distributorContext = getDistributorPromptContext(options.userProfile);

            // Prepend distributor requirements to ensure proper sizing
            prompt = `[COVER ART REQUIREMENTS: Generate a ${constraints.width}x${constraints.height}px square image. ${constraints.colorMode} color mode only.]\n\n${prompt}`;

            // Add project context if not already provided
            if (!options.projectContext) {
                options.projectContext = `\n\n${distributorContext}`;
            }
        }

        return prompt + (options.projectContext || '') + (options.negativePrompt ? ` --negative_prompt: ${options.negativePrompt}` : '');
    }

    /**
     * Get the appropriate aspect ratio for the request
     */
    private getAspectRatio(options: ImageGenerationOptions): string {
        // If cover art mode, always use 1:1 square
        if (options.isCoverArt) {
            return '1:1';
        }
        return options.aspectRatio || '1:1';
    }

    async generateImages(options: ImageGenerationOptions): Promise<{ id: string, url: string, prompt: string }[]> {
        const results: { id: string, url: string, prompt: string }[] = [];
        const count = options.count || 1;

        // Pre-flight quota check
        const userId = options.userProfile?.id;
        const quotaCheck = await subscriptionService.canPerformAction('generateImage', count, userId);
        if (!quotaCheck.allowed) {
            let tier: any = 'free'; // Using any to bypass strict enum mismatch if needed, but MembershipTier includes 'free'
            try {
                const sub = userId
                    ? await subscriptionService.getSubscription(userId)
                    : await subscriptionService.getCurrentSubscription();
                tier = sub.tier;
            } catch (e) {
                console.warn("Failed to fetch tier for QuotaExceededError, defaulting to free", e);
            }

            throw new QuotaExceededError(
                'images',
                tier,
                quotaCheck.reason || 'Quota exceeded',
                quotaCheck.currentUsage?.used || 0,
                quotaCheck.currentUsage?.limit || count
            );
        }

        try {
            const generateImage = httpsCallable(functions, 'generateImageV3');

            const fullPrompt = this.buildDistributorAwarePrompt(options);
            const aspectRatio = this.getAspectRatio(options);

            const result = await generateImage({
                prompt: fullPrompt,
                aspectRatio: aspectRatio,
                count: count,
                images: options.sourceImages?.length ? options.sourceImages : [],
                model: options.model || 'fast',
                thinking: options.thinking ?? false,
                mediaResolution: options.mediaResolution || 'medium',
                useGrounding: options.useGrounding ?? false
            });

            interface GenerateImageResponse {
                images: Array<{
                    bytesBase64Encoded?: string;
                    mimeType?: string;
                }>;
            }
            const data = result.data as GenerateImageResponse;

            // Cloud Function returns { images: [{ bytesBase64Encoded, mimeType }] }
            if (!data.images || data.images.length === 0) {
                return [];
            }

            // Bolt Optimization: Parallelize image processing and uploading
            // processing images in parallel significantly reduces total latency for batches (count > 1)
            const promises = data.images.map(async (img) => {
                if (!img.bytesBase64Encoded) return null;

                const mimeType = img.mimeType || 'image/png';
                const dataUri = `data:${mimeType};base64,${img.bytesBase64Encoded}`;
                const id = crypto.randomUUID();

                let finalUrl = dataUri;

                try {
                    const { useStore } = await import('@/core/store');
                    const userId = useStore.getState().userProfile?.id;

                    if (userId) {
                        const { CloudStorageService } = await import('@/services/CloudStorageService');
                        const saved = await CloudStorageService.smartSave(dataUri, id, userId);
                        finalUrl = saved.url;
                    }
                } catch (e) {
                    console.warn("Failed to upload to cloud storage, falling back to compressed data URI:", e);
                    try {
                        const { CloudStorageService } = await import('@/services/CloudStorageService');
                        // Compress heavily for Firestore safety (max 1MB doc limit includes all thoughts)
                        const compressed = await CloudStorageService.compressImage(dataUri, {
                            maxWidth: 512,
                            maxHeight: 512,
                            quality: 0.6
                        });
                        finalUrl = compressed.dataUri;
                    } catch (compressionError) {
                        console.warn("Compression failed, using original size:", compressionError);
                    }
                }

                return {
                    id,
                    url: finalUrl,
                    prompt: options.prompt
                };
            });

            const parallelResults = await Promise.all(promises);
            parallelResults.forEach(res => {
                if (res) results.push(res);
            });
        } catch (err: any) {
            console.error("❌ Image Generation Error:", err);
            console.error("Error details:", {
                message: err?.message,
                code: err?.code,
                details: err?.details,
                stack: err?.stack?.substring(0, 500)
            });

            throw err;
        }

        // Track usage after successful generation
        if (results.length > 0) {
            try {
                const { useStore } = await import('@/core/store');
                const userId = useStore.getState().userProfile?.id;
                if (userId) {
                    await usageTracker.trackImageGeneration(userId, results.length, {
                        prompt: options.prompt,
                        aspectRatio: options.aspectRatio,
                        resolution: options.resolution
                    });
                }
            } catch (e) {
                // Usage tracking failure should not block generation
            }
        }

        return results;
    }

    /**
     * Generate cover art with automatic distributor compliance
     * This is the recommended method for generating release artwork
     */
    async generateCoverArt(
        prompt: string,
        profile: UserProfile,
        options?: Partial<ImageGenerationOptions>
    ): Promise<{ id: string, url: string, prompt: string, constraints: ImageConstraints }[]> {
        const constraints = getImageConstraints(profile);

        const results = await this.generateImages({
            ...options,
            prompt,
            userProfile: profile,
            isCoverArt: true,
            aspectRatio: '1:1', // Cover art is always square
        });

        // Attach constraints to results for UI display
        return results.map(r => ({ ...r, constraints }));
    }

    async remixImage(options: RemixOptions): Promise<{ url: string } | null> {
        try {
            // Use Cloud Function for image generation (properly uses REST API)
            const generateImage = httpsCallable(functions, 'generateImageV3');

            const result = await generateImage({
                prompt: `Blend these two images together. Content reference should define the subject/composition. Style reference should define the artistic style, colors, and mood. ${options.prompt || 'Create a cohesive fusion.'}`,
                images: [
                    { mimeType: options.contentImage.mimeType, data: options.contentImage.data },
                    { mimeType: options.styleImage.mimeType, data: options.styleImage.data }
                ],
                aspectRatio: '1:1'
            });

            interface GenerateImageResponse {
                images: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
            }
            const data = result.data as GenerateImageResponse;

            if (data.images?.[0]?.bytesBase64Encoded) {
                const mimeType = data.images[0].mimeType || 'image/png';
                return { url: `data:${mimeType};base64,${data.images[0].bytesBase64Encoded}` };
            }
            return null;
        } catch (e) {
            console.error("Remix Error:", e);
            throw e;
        }
    }

    async extractStyle(image: { mimeType: string; data: string }): Promise<{ prompt_desc?: string, style_context?: string, negative_prompt?: string }> {
        try {
            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: image.mimeType, data: image.data } },
                        { text: `Analyze this image. Return JSON: { "prompt_desc": "Visual description", "style_context": "Artistic style, camera, lighting tags", "negative_prompt": "What to avoid" }` }
                    ]
                },
                config: {
                    responseMimeType: 'application/json',
                    ...AI_CONFIG.THINKING.LOW
                }
            });

            return AI.parseJSON(response.text());
        } catch (e) {
            console.error("Style Extraction Error:", e);
            throw e;
        }
    }

    async batchRemix(options: {
        styleImage: { mimeType: string; data: string };
        targetImages: { mimeType: string; data: string; width?: number; height?: number }[];
        prompt?: string;
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        const results: { id: string, url: string, prompt: string }[] = [];
        const generateImage = httpsCallable(functions, 'generateImageV3');

        try {
            // Bolt Optimization: Parallelize requests to improve batch latency
            const promises = options.targetImages.map(async (target) => {
                try {
                    // Determine aspect ratio based on target image dimensions
                    let aspectRatio = '1:1';
                    if (target.width && target.height) {
                        if (target.width > target.height * 1.2) aspectRatio = '16:9';
                        else if (target.height > target.width * 1.2) aspectRatio = '9:16';
                    }

                    const result = await generateImage({
                        prompt: `Render this content image in the artistic style of the reference image. Maintain the composition and subject from content, apply colors, textures, and mood from style. ${options.prompt || 'Restyle'}`,
                        images: [
                            { mimeType: target.mimeType, data: target.data },
                            { mimeType: options.styleImage.mimeType, data: options.styleImage.data }
                        ],
                        aspectRatio
                    });

                    interface GenerateImageResponse {
                        images: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
                    }
                    const data = result.data as GenerateImageResponse;

                    if (data.images?.[0]?.bytesBase64Encoded) {
                        const mimeType = data.images[0].mimeType || 'image/png';
                        return {
                            id: crypto.randomUUID(),
                            url: `data:${mimeType};base64,${data.images[0].bytesBase64Encoded}`,
                            prompt: `Batch Style: ${options.prompt || "Restyle"}`
                        };
                    }
                    return null;
                } catch (error) {
                    console.error("Individual Batch Remix Error:", error);
                    return null;
                }
            });

            const parallelResults = await Promise.all(promises);
            parallelResults.forEach(res => {
                if (res) results.push(res);
            });
        } catch (e) {
            console.error("Batch Remix Error:", e);
            throw e;
        }
        return results;
    }

    async editImage(options: {
        image: string;
        prompt: string;
        mask?: string;
        referenceImage?: string;
        imageMimeType?: string;
        maskMimeType?: string;
        refMimeType?: string;
    }): Promise<any> {
        try {
            const editImage = httpsCallable(functions, 'editImage');
            const result = await editImage(options);
            return result.data;
        } catch (e) {
            console.error("Image Edit Error:", e);
            throw e;
        }
    }

    /**
     * Extracts the "essence" of an image using a Vision LLM.
     * Used by the Whisk pipeline for Subject, Scene, and Style locking.
     */
    async captionImage(image: { mimeType: string, data: string }, category: 'subject' | 'scene' | 'style'): Promise<string> {
        try {
            const promptMap = {
                subject: "Describe the primary subject of this image in detail. Focus on appearance, clothing, ethnicity, hair, and notable features. Keep it descriptive for an AI image generator.",
                scene: "Describe the setting, environment, and background of this image. Focus on location, objects, architecture, and spatial arrangement.",
                style: "Describe the artistic style, lighting, mood, color palette, and camera technique of this image. Focus on the visual 'vibe' rather than the content."
            };

            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT, // Use Pro model for detailed analysis
                contents: {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: image.mimeType, data: image.data } },
                        { text: promptMap[category] }
                    ]
                },
                config: AI_CONFIG.THINKING.HIGH
            });

            return response.text().trim();
        } catch (e) {
            console.error(`Captioning Error (${category}):`, e);
            return "Visual reference"; // Fallback
        }
    }
}

export const ImageGeneration = new ImageGenerationService();
