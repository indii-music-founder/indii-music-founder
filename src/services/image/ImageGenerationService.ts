import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { env } from '@/config/env';
import { isInlineDataPart } from '@/shared/types/ai.dto';
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
        const quotaCheck = await subscriptionService.canPerformAction('generateImage', count);
        if (!quotaCheck.allowed) {
            throw new QuotaExceededError(
                'images',
                (await subscriptionService.getCurrentSubscription().then(s => s.tier)),
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
                images: options.sourceImages,
                apiKey: env.apiKey
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

            for (const img of data.images) {
                if (img.bytesBase64Encoded) {
                    const mimeType = img.mimeType || 'image/png';
                    const url = `data:${mimeType};base64,${img.bytesBase64Encoded}`;
                    results.push({
                        id: crypto.randomUUID(),
                        url,
                        prompt: options.prompt
                    });
                }
            }
        } catch (err) {
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
            const response = await AI.generateContent({
                model: AI_MODELS.IMAGE.GENERATION,
                contents: {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: options.contentImage.mimeType, data: options.contentImage.data } }, { text: "Content Ref" },
                        { inlineData: { mimeType: options.styleImage.mimeType, data: options.styleImage.data } }, { text: "Style Ref" },
                        { text: `Generate: ${options.prompt || "Fusion"}` }
                    ]
                },
                config: AI_CONFIG.IMAGE.DEFAULT
            });

            const part = response.response.candidates?.[0]?.content?.parts?.[0];
            if (part && isInlineDataPart(part)) {
                return { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` };
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
        try {
            for (const target of options.targetImages) {
                const response = await AI.generateContent({
                    model: AI_MODELS.IMAGE.GENERATION,
                    contents: {
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType: target.mimeType, data: target.data } },
                            { text: "[Content Reference]" },
                            { inlineData: { mimeType: options.styleImage.mimeType, data: options.styleImage.data } },
                            { text: "[Style Reference]" },
                            { text: `Render the Content image exactly in the style of the Reference image. ${options.prompt || "Restyle"}` }
                        ]
                    },
                    config: AI_CONFIG.IMAGE.DEFAULT
                });

                const part = response.response.candidates?.[0]?.content?.parts?.[0];
                if (part && isInlineDataPart(part)) {
                    const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    results.push({
                        id: crypto.randomUUID(),
                        url,
                        prompt: `Batch Style: ${options.prompt || "Restyle"}`
                    });
                }
            }
        } catch (e) {
            console.error("Batch Remix Error:", e);
            throw e;
        }
        return results;
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
